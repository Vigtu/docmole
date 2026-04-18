export const USER_AGENT = "docmole/1.0";
export const FETCH_TIMEOUT_MS = 30_000;

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}
