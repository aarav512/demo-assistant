import { isAdminRequest } from "@/lib/auth/admin";
import { getRepository } from "@/lib/data/store";
import { errorResponse, jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      const configured = Boolean(process.env.DEMO_ADMIN_PASSWORD?.trim() && process.env.SESSION_SECRET?.trim());
      return jsonError(
        configured ? 401 : 503,
        configured ? "unauthorized" : "admin_not_configured",
        configured ? "Sign in to review appointment requests." : "Demo admin access is not configured.",
      );
    }
    const appointments = await getRepository().listAppointments();
    return Response.json({ appointments });
  } catch (error) {
    return errorResponse(error);
  }
}
