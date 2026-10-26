import { createHash } from "crypto";
import { getRepository } from "@/lib/data/store";
import { errorResponse, jsonError, readJson } from "@/lib/http";
import { createRealtimeAnswer, VoiceSessionError } from "@/lib/openai/realtime-session";
import { openAiApiKey } from "@/lib/openai/server-env";
import { buildCallSummary } from "@/lib/summary/build-summary";
import { clientIp, allowRequest } from "@/lib/utils/rate-limit";
import { originAllowed } from "@/lib/utils/origin";
import { voiceSessionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!originAllowed(request)) {
      return jsonError(403, "forbidden", "This demo cannot be started from that site.");
    }
    if (!allowRequest(`voice:${clientIp(request)}`, 8, 10 * 60 * 1000)) {
      return jsonError(429, "rate_limited", "Too many demo sessions were started. Wait a few minutes and try again.");
    }
    const parsed = voiceSessionSchema.safeParse(await readJson(request, 100_000));
    if (!parsed.success) {
      return jsonError(400, "invalid_request", parsed.error.issues[0]?.message ?? "The demo could not start.");
    }
    if (!parsed.data.sdp.startsWith("v=")) {
      return jsonError(400, "invalid_sdp", "The voice connection could not be prepared.");
    }
    if (!(await openAiApiKey())) {
      return jsonError(503, "voice_not_configured", "Voice service not configured.");
    }

    const store = getRepository();
    const settings = await store.getSettings();
    const created = await store.createCall({
      callerConsent: true,
      storeTranscript: parsed.data.storeTranscript,
    });

    try {
      const sdp = await createRealtimeAnswer({
        sdp: parsed.data.sdp,
        clinic: settings,
        safetyId: createHash("sha256").update(created.call.id).digest("hex").slice(0, 32),
      });
      return Response.json({
        sdp,
        callId: created.call.id,
        callToken: created.token,
        storage: store.mode,
        clinicName: settings.clinicName,
      });
    } catch (error) {
      const failure = "The voice service could not start.";
      const summary = buildCallSummary({
        call: created.call,
        appointments: [],
        enquiries: [],
        outcome: "failed",
        failureReason: failure,
      });
      await store.endCall(created.call.id, {
        outcome: "failed",
        summary: summary.narrative,
        summaryDetail: summary,
        transcript: null,
        failureReason: failure,
      });
      if (error instanceof VoiceSessionError) {
        const status = error.code === "voice_unauthorized" ? 503 : 502;
        return jsonError(status, error.code, error.message);
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
