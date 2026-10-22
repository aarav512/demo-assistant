import { isAdminRequest } from "@/lib/auth/admin";
import { getRepository } from "@/lib/data/store";
import { errorResponse, jsonError, readJson } from "@/lib/http";
import { resetSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      const configured = Boolean(process.env.DEMO_ADMIN_PASSWORD?.trim() && process.env.SESSION_SECRET?.trim());
      return jsonError(
        configured ? 401 : 503,
        configured ? "unauthorized" : "admin_not_configured",
        configured ? "Only a demo administrator can reset demo data." : "Demo admin access is not configured.",
      );
    }
    const parsed = resetSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError(400, "confirmation_required", "Confirm the reset before demo records are deleted.");
    await getRepository().resetDemo();
    return Response.json({ reset: true, notice: "Demo calls, enquiries, and appointment requests were deleted. Clinic settings were kept." });
  } catch (error) {
    return errorResponse(error);
  }
}
