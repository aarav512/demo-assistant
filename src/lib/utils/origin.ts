export function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const host = request.headers.get("host");
  if (host && parsed.host === host) return true;
  const base = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  return Boolean(base && origin === base);
}
