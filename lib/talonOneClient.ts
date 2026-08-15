/**
 * Thin browser-side client for the Talon.One Integration API v2.
 *
 * Every call resolves to an `ApiCallRecord` — success, HTTP error, transport
 * failure and misconfiguration all take the same shape — so the inspector can
 * render the last attempt unconditionally and callers never need try/catch.
 */

import { API_KEY, DEPLOYMENT_URL, getConfigError } from './constants';
import type { ApiCallRecord, TalonSessionPayload, TalonSessionResponse } from './types';

/** Builds the endpoint URL, appending ?dry=true only for dry runs. */
function buildUrl(sessionId: string, dryRun: boolean): string {
  const base = `${DEPLOYMENT_URL}/v2/customer_sessions/${encodeURIComponent(sessionId)}`;
  return dryRun ? `${base}?dry=true` : base;
}

/**
 * Pulls a human-readable message out of a Talon.One error body.
 * The API is inconsistent: sometimes `message`, sometimes an `Errors` array
 * of `{ title, details }`, sometimes plain text.
 */
function extractServerMessage(body: TalonSessionResponse | null): string | null {
  if (!body) return null;

  const message = body['message'];
  if (typeof message === 'string' && message.trim().length > 0) return message.trim();

  const errors = body['Errors'] ?? body['errors'];
  if (Array.isArray(errors) && errors.length > 0) {
    const parts = errors
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          const title = typeof record['title'] === 'string' ? record['title'] : null;
          const details = typeof record['details'] === 'string' ? record['details'] : null;
          return [title, details].filter(Boolean).join(': ');
        }
        return '';
      })
      .filter((part) => part.length > 0);
    if (parts.length > 0) return parts.join('; ');
  }

  return null;
}

/** Reads the response body as JSON, falling back to raw text under `message`. */
async function readBody(response: Response): Promise<TalonSessionResponse | null> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return null;
  }

  if (text.trim().length === 0) return null;

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as TalonSessionResponse;
    }
    return { message: text } as TalonSessionResponse;
  } catch {
    return { message: text } as TalonSessionResponse;
  }
}

/**
 * `PUT {deployment}/v2/customer_sessions/{sessionId}[?dry=true]`
 *
 * Never throws. Inspect `error` (null on success) and `status` to branch.
 */
export async function updateCustomerSession(
  sessionId: string,
  payload: TalonSessionPayload,
  opts: { dryRun: boolean },
): Promise<ApiCallRecord> {
  const url = buildUrl(sessionId, opts.dryRun);

  const base: Omit<ApiCallRecord, 'status' | 'responseBody' | 'error' | 'durationMs'> = {
    url,
    method: 'PUT',
    requestBody: payload,
  };

  // Fail before touching the network when the deployment is not configured.
  const configError = getConfigError();
  if (configError !== null) {
    return { ...base, status: null, responseBody: null, error: configError, durationMs: 0 };
  }

  const startedAt = performance.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey-v1 ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (caught) {
    const durationMs = Math.round(performance.now() - startedAt);
    const message = caught instanceof Error ? caught.message : String(caught);
    return { ...base, status: null, responseBody: null, error: message, durationMs };
  }

  const responseBody = await readBody(response);
  const durationMs = Math.round(performance.now() - startedAt);

  if (!response.ok) {
    const serverMessage = extractServerMessage(responseBody);
    const statusLabel = response.statusText ? ` ${response.statusText}` : '';
    const error = serverMessage
      ? `Talon.One returned ${response.status}${statusLabel}: ${serverMessage}`
      : `Talon.One returned ${response.status}${statusLabel}`;
    return { ...base, status: response.status, responseBody, error, durationMs };
  }

  return { ...base, status: response.status, responseBody, error: null, durationMs };
}
