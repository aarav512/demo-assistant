import { buildReceptionistInstructions } from "@/lib/clinic/instructions";
import { REALTIME_TOOLS, realtimeModel } from "@/lib/openai/tools";
import type { ClinicSettings } from "@/types/domain";

export class VoiceSessionError extends Error {
  constructor(
    message: string,
    readonly code: "voice_not_configured" | "voice_unauthorized" | "voice_unavailable" = "voice_unavailable",
  ) {
    super(message);
  }
}

export function buildSessionConfig(clinic: ClinicSettings) {
  return {
    type: "realtime",
    model: realtimeModel(),
    output_modalities: ["audio"],
    instructions: buildReceptionistInstructions(clinic),
    tool_choice: "auto",
    tools: REALTIME_TOOLS,
    audio: {
      input: {
        transcription: { model: "gpt-4o-mini-transcribe" },
        turn_detection: { type: "server_vad", create_response: true, interrupt_response: true },
        noise_reduction: { type: "near_field" },
      },
      output: { voice: "marin" },
    },
  };
}

/**
 * Exchange a browser SDP offer for a Realtime API answer.
 * The permanent API key is sent only on this server-side request.
 */
export async function createRealtimeAnswer(options: {
  sdp: string;
  clinic: ClinicSettings;
  safetyId: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new VoiceSessionError("Voice service not configured.", "voice_not_configured");
  }
  const form = new FormData();
  form.set("sdp", options.sdp);
  form.set("session", JSON.stringify(buildSessionConfig(options.clinic)));
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Safety-Identifier": options.safetyId,
    },
    body: form,
  });
  const body = await response.text();
  if (!response.ok || !body.startsWith("v=")) {
    console.error("Realtime session was rejected", response.status);
    if (response.status === 401 || response.status === 403) {
      throw new VoiceSessionError("The voice service rejected the server credentials.", "voice_unauthorized");
    }
    throw new VoiceSessionError("The voice service could not start a session.", "voice_unavailable");
  }
  return body;
}
