import { isAdminRequest } from "@/lib/auth/admin";
import { getRepository } from "@/lib/data/store";
import { errorResponse, jsonError } from "@/lib/http";
import { maskPhone } from "@/lib/utils/phone";
import type { AppointmentRequest, DemoCall } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function revealCall(call: DemoCall, reveal: boolean): DemoCall {
  if (reveal) return call;
  return { ...call, callerPhone: maskPhone(call.callerPhone), transcript: null };
}

function revealAppointment(appointment: AppointmentRequest, reveal: boolean): AppointmentRequest {
  if (reveal) return appointment;
  return { ...appointment, callerPhone: maskPhone(appointment.callerPhone) ?? "Hidden" };
}

export async function GET(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      return jsonError(
        process.env.DEMO_ADMIN_PASSWORD && process.env.SESSION_SECRET ? 401 : 503,
        process.env.DEMO_ADMIN_PASSWORD && process.env.SESSION_SECRET ? "unauthorized" : "admin_not_configured",
        process.env.DEMO_ADMIN_PASSWORD && process.env.SESSION_SECRET
          ? "Sign in to review demo records."
          : "Demo admin access is not configured.",
      );
    }
    const store = getRepository();
    await store.applyRetention();
    const [calls, appointments] = await Promise.all([store.listCalls(), store.listAppointments()]);
    return Response.json({
      calls: calls.map((call) => revealCall(call, true)),
      appointments: appointments.map((appointment) => revealAppointment(appointment, true)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
