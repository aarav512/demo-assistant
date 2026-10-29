import { buildReceptionistInstructions } from "@/lib/clinic/instructions";
import { openAiApiKey, openAiRealtimeModel } from "@/lib/openai/server-env";
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

export function buildSessionConfig(clinic: ClinicSettings, model = realtimeModel()) {
  return {
    type: "realtime",
    model,
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
 * Multipart body for POST /v1/realtime/calls.
 * The OpenAPI encoding requires the SDP part to be application/sdp and the
 * session part to be application/json. A plain FormData string omits those
 * types, so the upstream call is rejected before any audio answer is returned.
 */
export function encodeRealtimeCall(sdp: string, session: unknown): { body: string; contentType: string } {
  const boundary = `kynexRealtime${crypto.randomUUID().replaceAll("-", "")}`;
  const sessionJson = JSON.stringify(session);
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="sdp"`,
    "Content-Type: application/sdp",
    "",
    sdp,
    `--${boundary}`,
    `Content-Disposition: form-data; name="session"`,
    "Content-Type: application/json",
    "",
    sessionJson,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

/** Upstream status plus a short description. Never returns keys or SDP. */
export function safeUpstreamDescription(status: number, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return `HTTP ${status} empty body`;
  if (trimmed.startsWith("v=") || trimmed.includes("\na=") || trimmed.includes("\r\na=")) {
    return `HTTP ${status} non-json body`;
  }
  let description = "";
  try {
    const parsed = JSON.parse(trimmed) as { error?: { code?: unknown; type?: unknown; message?: unknown } };
    const parts = [parsed.error?.code, parsed.error?.type, parsed.error?.message].filter(
      (part): part is string => typeof part === "string" && part.trim().length > 0,
    );
    description = parts.join(": ");
  } catch {
    description = trimmed.replace(/\s+/g, " ");
  }
  description = redactSecrets(description).replace(/\s+/g, " ").trim().slice(0, 240);
  return `HTTP ${status} ${description || "unreadable body"}`;
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
  const apiKey = await openAiApiKey();
  if (!apiKey) {
    throw new VoiceSessionError("Voice service not configured.", "voice_not_configured");
  }
  const model = await openAiRealtimeModel(realtimeModel());
  const encoded = encodeRealtimeCall(options.sdp, buildSessionConfig(options.clinic, model));
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/sdp",
      "Content-Type": encoded.contentType,
      "OpenAI-Safety-Identifier": options.safetyId,
    },
    body: encoded.body,
  });
  const body = await response.text();
  if (!response.ok || !body.trim().startsWith("v=")) {
    const errorCode = openAiErrorCode(body);
    console.error("Realtime session was rejected", safeUpstreamDescription(response.status, body));
    if (response.status === 401 || response.status === 403 || errorCode === "invalid_api_key") {
      throw new VoiceSessionError("The voice service rejected the server credentials.", "voice_unauthorized");
    }
    throw new VoiceSessionError("The voice service could not start a session.", "voice_unavailable");
  }
  return body.trim();
}

function openAiErrorCode(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string } };
    return typeof parsed.error?.code === "string" ? parsed.error.code : "";
  } catch {
    return "";
  }
}

function redactSecrets(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{4,}/g, "[redacted]")
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/v=0[\s\S]*/g, "[sdp]");
}
