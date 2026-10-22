import {
  adminConfigured,
  adminCookieHeader,
  clearAdminCookieHeader,
  isAdminRequest,
  passwordsMatch,
  signAdminToken,
} from "@/lib/auth/admin";
import { errorResponse, jsonError, readJson } from "@/lib/http";
import { allowRequest, clientIp } from "@/lib/utils/rate-limit";
import { adminLoginSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.json({ admin: isAdminRequest(request), configured: adminConfigured() });
}

export async function POST(request: Request) {
  try {
    if (!adminConfigured()) {
      return jsonError(503, "admin_not_configured", "Demo admin access is not configured.");
    }
    if (!allowRequest(`login:${clientIp(request)}`, 8, 15 * 60 * 1000)) {
      return jsonError(429, "rate_limited", "Too many sign-in attempts. Wait a few minutes and try again.");
    }
    const parsed = adminLoginSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError(400, "invalid_request", "Enter the demo admin password.");
    const expected = process.env.DEMO_ADMIN_PASSWORD ?? "";
    if (!passwordsMatch(parsed.data.password, expected)) {
      return jsonError(401, "unauthorized", "That password was not accepted.");
    }
    const token = signAdminToken();
    if (!token) return jsonError(503, "admin_not_configured", "Demo admin access is not configured.");
    return Response.json(
      { admin: true },
      { headers: { "Set-Cookie": adminCookieHeader(token) } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  return Response.json({ admin: false }, { headers: { "Set-Cookie": clearAdminCookieHeader() } });
}
