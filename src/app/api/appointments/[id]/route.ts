import { isAdminRequest } from "@/lib/auth/admin";
import { getRepository } from "@/lib/data/store";
import { errorResponse, jsonError, readJson } from "@/lib/http";
import { appointmentStatusSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    if (!isAdminRequest(request)) {
      const configured = Boolean(process.env.DEMO_ADMIN_PASSWORD?.trim() && process.env.SESSION_SECRET?.trim());
      return jsonError(
        configured ? 401 : 503,
        configured ? "unauthorized" : "admin_not_configured",
        configured ? "Only a demo administrator can change an appointment request." : "Demo admin access is not configured.",
      );
    }
    const parsed = appointmentStatusSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError(400, "invalid_request", "Choose a valid appointment status.");
    const { id } = await context.params;
    const updated = await getRepository().updateAppointmentStatus(id, parsed.data.status);
    if (!updated) return jsonError(404, "not_found", "That appointment request was not found.");
    return Response.json({
      appointment: updated,
      notice:
        updated.status === "confirmed"
          ? "Marked confirmed inside this demo only. No calendar booking or message was sent."
          : "The demonstration status was updated.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
