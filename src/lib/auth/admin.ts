import { createHash, createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "kynex_demo_admin";

export function adminConfigured(): boolean {
  return Boolean(process.env.DEMO_ADMIN_PASSWORD?.trim() && process.env.SESSION_SECRET?.trim());
}

export function passwordsMatch(input: string, expected: string): boolean {
  const left = createHash("sha256").update(input).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function signAdminToken(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  const password = process.env.DEMO_ADMIN_PASSWORD?.trim();
  if (!secret || !password) return null;
  return createHmac("sha256", secret).update(`kynex-demo-admin-v1:${password}`).digest("base64url");
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function isAdminRequest(request: Request): boolean {
  const expected = signAdminToken();
  const actual = readCookie(request, ADMIN_COOKIE);
  if (!expected || !actual) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function adminCookieHeader(token: string, maxAge = 60 * 60 * 8): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearAdminCookieHeader(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}
