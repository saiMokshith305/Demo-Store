/** Hardcoded session attribute sent on every request (see design spec). */
export const SHIPPING_CITY = 'Minneapolis';

/** Debounce window before an edit triggers a session sync. */
export const SYNC_DEBOUNCE_MS = 400;

export const RESPONSE_CONTENT = ['customerSession', 'customerProfile'];

export const DEPLOYMENT_URL = process.env.NEXT_PUBLIC_TALONONE_DEPLOYMENT_URL ?? '';
export const API_KEY = process.env.NEXT_PUBLIC_TALONONE_API_KEY ?? '';

/** Returns a human-readable problem with env config, or null when usable. */
export function getConfigError(): string | null {
  if (!DEPLOYMENT_URL && !API_KEY) {
    return 'Missing NEXT_PUBLIC_TALONONE_DEPLOYMENT_URL and NEXT_PUBLIC_TALONONE_API_KEY. Create .env.local (see README) and restart the dev server.';
  }
  if (!DEPLOYMENT_URL) {
    return 'Missing NEXT_PUBLIC_TALONONE_DEPLOYMENT_URL in .env.local. Restart the dev server after adding it.';
  }
  if (!API_KEY) {
    return 'Missing NEXT_PUBLIC_TALONONE_API_KEY in .env.local. Restart the dev server after adding it.';
  }
  return null;
}
