import { isAdminRequest } from "@/lib/auth/admin";
import { getRepository } from "@/lib/data/store";
import { errorResponse, jsonError, readJson } from "@/lib/http";
import { buildCallSummary, limitTranscript } from "@/lib/summary/build-summary";
import { safeClientMessage } from "@/lib/openai/session-state";
import { endCallSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const store = getRepository();
    const token = bearer(request);
    const call = isAdminRequest(request) ? await store.getCall(id) : token ? await store.getCallForToken(id, token) : null;
    if (!call) return jsonError(404, "not_found", "That demo call was not found.");
    const [appointments, enquiries] = await Promise.all([
      store.listAppointmentsForCall(id),
      store.listEnquiriesForCall(id),
    ]);
    return Response.json({ call, appointments, enquiries });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const token = bearer(request);
    if (!token) return jsonError(401, "unauthorized", "This demo call could not be closed.");
    const parsed = endCallSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError(400, "invalid_request", "The demo call could not be closed.");
    const store = getRepository();
    const call = await store.getCallForToken(id, token);
    if (!call) return jsonError(404, "not_found", "That demo call was not found.");
    const [appointments, enquiries] = await Promise.all([
      store.listAppointmentsForCall(id),
      store.listEnquiriesForCall(id),
    ]);
    if (call.outcome !== "in_progress") {
      return Response.json({ call, appointments, enquiries });
    }
    const outcome = parsed.data.outcome ?? "completed";
    const failureReason = parsed.data.failureReason ? safeClientMessage(parsed.data.failureReason) : null;
    const transcript = parsed.data.transcript?.map((line) => ({
      role: line.role,
      text: line.text,
      at: line.at ?? new Date().toISOString(),
    }));
    const fresh = (await store.getCall(id)) ?? call;
    const summary = buildCallSummary({
      call: fresh,
      appointments,
      enquiries,
      outcome,
      failureReason,
    });
    const saved = await store.endCall(id, {
      outcome,
      summary: summary.narrative,
      summaryDetail: summary,
      transcript: limitTranscript(transcript, fresh.storeTranscript),
      failureReason,
      callReason: summary.reason,
      callerName: summary.callerName,
      humanFollowUp: summary.humanAssistanceNeeded,
      followUpStatus: summary.humanAssistanceNeeded ? "needed" : fresh.followUpStatus,
    });
    return Response.json({ call: saved, appointments, enquiries, summary });
  } catch (error) {
    return errorResponse(error);
  }
}
