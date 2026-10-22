import { isAdminRequest } from "@/lib/auth/admin";
import { getRepository } from "@/lib/data/store";
import { errorResponse, jsonError, readJson } from "@/lib/http";
import { clinicSettingsSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getRepository().getSettings();
    return Response.json({ settings, demonstration: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      const configured = Boolean(process.env.DEMO_ADMIN_PASSWORD?.trim() && process.env.SESSION_SECRET?.trim());
      return jsonError(
        configured ? 401 : 503,
        configured ? "unauthorized" : "admin_not_configured",
        configured ? "Only a demo administrator can edit clinic settings." : "Demo admin access is not configured.",
      );
    }
    const parsed = clinicSettingsSchema.safeParse(await readJson(request, 20_000));
    if (!parsed.success) {
      return jsonError(400, "invalid_request", parsed.error.issues[0]?.message ?? "Check the clinic settings and try again.");
    }
    const settings = await getRepository().updateSettings({
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    });
    return Response.json({ settings, demonstration: true });
  } catch (error) {
    return errorResponse(error);
  }
}
