import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TalonSessionPayload } from './types';

const DEPLOYMENT = 'https://demo.europe-west1.talon.one';
const API_KEY = 'test-api-key';

const PAYLOAD: TalonSessionPayload = {
  customerSession: {
    profileId: 'demo-customer-1',
    state: 'open',
    cartItems: [
      { name: 'HDMI-cable', sku: 'HDMI-cable', quantity: 4, price: 12.99, category: 'cables' },
    ],
    attributes: { ShippingCity: 'Minneapolis' },
  },
  responseContent: ['customerSession', 'customerProfile'],
};

/**
 * constants.ts snapshots process.env at import time, so each test re-imports
 * the module graph with the env it needs.
 */
async function loadClient(env: { url?: string; key?: string }) {
  vi.resetModules();
  if (env.url === undefined) delete process.env.NEXT_PUBLIC_TALONONE_DEPLOYMENT_URL;
  else process.env.NEXT_PUBLIC_TALONONE_DEPLOYMENT_URL = env.url;
  if (env.key === undefined) delete process.env.NEXT_PUBLIC_TALONONE_API_KEY;
  else process.env.NEXT_PUBLIC_TALONONE_API_KEY = env.key;
  return import('./talonOneClient');
}

const configured = () => loadClient({ url: DEPLOYMENT, key: API_KEY });

function mockFetch(response: Response | Error) {
  // Typed args so `mock.calls[n]` is a real tuple rather than `[]`.
  // `_init` is non-optional: the client always passes it, and a required
  // param keeps `mock.calls[n][1]` narrowed to RequestInit.
  const fn = vi.fn(async (_url: string, _init: RequestInit): Promise<Response> => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

describe('updateCustomerSession — request construction', () => {
  it('PUTs to the v2 customer_sessions endpoint for the given session', async () => {
    const fetchMock = mockFetch(json({ effects: [] }));
    const { updateCustomerSession } = await configured();

    await updateCustomerSession('InterviewSession', PAYLOAD, { dryRun: false });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${DEPLOYMENT}/v2/customer_sessions/InterviewSession`);
    expect(init.method).toBe('PUT');
  });

  it('sends the API key and JSON content type', async () => {
    const fetchMock = mockFetch(json({ effects: [] }));
    const { updateCustomerSession } = await configured();

    await updateCustomerSession('s1', PAYLOAD, { dryRun: false });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: `ApiKey-v1 ${API_KEY}`,
    });
    expect(JSON.parse(init.body as string)).toEqual(PAYLOAD);
  });

  it('appends ?dry=true only for dry runs', async () => {
    const fetchMock = mockFetch(json({ effects: [] }));
    const { updateCustomerSession } = await configured();

    await updateCustomerSession('s1', PAYLOAD, { dryRun: true });
    expect(fetchMock.mock.calls[0]![0]).toBe(`${DEPLOYMENT}/v2/customer_sessions/s1?dry=true`);

    await updateCustomerSession('s1', PAYLOAD, { dryRun: false });
    expect(fetchMock.mock.calls[1]![0]).toBe(`${DEPLOYMENT}/v2/customer_sessions/s1`);
  });

  it('URL-encodes session ids containing unsafe characters', async () => {
    const fetchMock = mockFetch(json({ effects: [] }));
    const { updateCustomerSession } = await configured();

    await updateCustomerSession('session/with space', PAYLOAD, { dryRun: false });

    expect(fetchMock.mock.calls[0]![0]).toBe(
      `${DEPLOYMENT}/v2/customer_sessions/session%2Fwith%20space`,
    );
  });
});

describe('updateCustomerSession — outcomes', () => {
  it('returns the parsed body and a null error on success', async () => {
    const body = { effects: [{ effectType: 'setDiscount', props: { name: 'X', value: 5 } }] };
    mockFetch(json(body));
    const { updateCustomerSession } = await configured();

    const record = await updateCustomerSession('s1', PAYLOAD, { dryRun: false });

    expect(record.status).toBe(200);
    expect(record.error).toBeNull();
    expect(record.responseBody).toEqual(body);
    expect(record.requestBody).toEqual(PAYLOAD);
    expect(Number.isInteger(record.durationMs)).toBe(true);
  });

  it('reports HTTP errors with the status and the server message', async () => {
    mockFetch(json({ message: 'invalid cart item' }, { status: 400, statusText: 'Bad Request' }));
    const { updateCustomerSession } = await configured();

    const record = await updateCustomerSession('s1', PAYLOAD, { dryRun: false });

    expect(record.status).toBe(400);
    expect(record.error).toContain('400');
    expect(record.error).toContain('invalid cart item');
  });

  it('extracts messages from the Errors array shape', async () => {
    mockFetch(
      json(
        { Errors: [{ title: 'Unauthorized', details: 'bad api key' }] },
        { status: 401, statusText: 'Unauthorized' },
      ),
    );
    const { updateCustomerSession } = await configured();

    const record = await updateCustomerSession('s1', PAYLOAD, { dryRun: false });

    expect(record.error).toContain('Unauthorized');
    expect(record.error).toContain('bad api key');
  });

  it('still reports a readable error when the body is not JSON', async () => {
    mockFetch(new Response('upstream exploded', { status: 502, statusText: 'Bad Gateway' }));
    const { updateCustomerSession } = await configured();

    const record = await updateCustomerSession('s1', PAYLOAD, { dryRun: false });

    expect(record.status).toBe(502);
    expect(record.responseBody).toEqual({ message: 'upstream exploded' });
    expect(record.error).toContain('502');
  });

  it('never throws on transport failure', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    const { updateCustomerSession } = await configured();

    const record = await updateCustomerSession('s1', PAYLOAD, { dryRun: false });

    expect(record.status).toBeNull();
    expect(record.responseBody).toBeNull();
    expect(record.error).toContain('Failed to fetch');
  });
});

describe('updateCustomerSession — misconfiguration', () => {
  it('does not call fetch when the deployment URL is missing', async () => {
    const fetchMock = mockFetch(json({}));
    const { updateCustomerSession } = await loadClient({ url: '', key: API_KEY });

    const record = await updateCustomerSession('s1', PAYLOAD, { dryRun: false });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(record.status).toBeNull();
    expect(record.error).toContain('NEXT_PUBLIC_TALONONE_DEPLOYMENT_URL');
  });

  it('does not call fetch when the API key is missing', async () => {
    const fetchMock = mockFetch(json({}));
    const { updateCustomerSession } = await loadClient({ url: DEPLOYMENT, key: '' });

    const record = await updateCustomerSession('s1', PAYLOAD, { dryRun: false });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(record.error).toContain('NEXT_PUBLIC_TALONONE_API_KEY');
  });
});
