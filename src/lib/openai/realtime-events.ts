const GREETING =
  "Greet the caller now with the configured opening. Keep it to one or two short sentences and ask at most one question.";

export type RealtimeCommand = Record<string, unknown>;

type JsonRecord = Record<string, unknown>;

export function sessionUpdateCommand(): RealtimeCommand {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      output_modalities: ["audio"],
      audio: {
        input: {
          transcription: { model: "gpt-4o-mini-transcribe" },
          turn_detection: { type: "server_vad", create_response: true, interrupt_response: true },
        },
        output: { voice: "marin" },
      },
    },
  };
}

export function greetingCommand(): RealtimeCommand {
  return {
    type: "response.create",
    response: { output_modalities: ["audio"], instructions: GREETING },
  };
}

export function textTurnCommands(text: string): RealtimeCommand[] {
  return [
    {
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
    },
    { type: "response.create", response: { output_modalities: ["audio"] } },
  ];
}

export function audioResponseCommand(): RealtimeCommand {
  return { type: "response.create", response: { output_modalities: ["audio"] } };
}

export function assistantDelta(event: JsonRecord): { itemId: string; text: string } | null {
  const type = String(event.type ?? "");
  if (type !== "response.output_audio_transcript.delta" && type !== "response.output_text.delta") return null;
  const text = String(event.delta ?? "");
  if (!text) return null;
  return { itemId: String(event.item_id ?? "assistant"), text };
}

export function assistantFinalText(event: JsonRecord): { itemId: string; text: string } | null {
  const type = String(event.type ?? "");
  if (type === "response.output_audio_transcript.done") {
    const text = String(event.transcript ?? "").trim();
    return text ? { itemId: String(event.item_id ?? ""), text } : null;
  }
  if (type === "response.output_text.done") {
    const text = String(event.text ?? "").trim();
    return text ? { itemId: String(event.item_id ?? ""), text } : null;
  }
  if (type !== "response.done") return null;
  const response = event.response as JsonRecord | undefined;
  const output = Array.isArray(response?.output) ? (response.output as JsonRecord[]) : [];
  for (const item of output) {
    if (item.type !== "message") continue;
    const content = Array.isArray(item.content) ? (item.content as JsonRecord[]) : [];
    const text = content
      .map((part) => String(part.transcript ?? part.text ?? "").trim())
      .filter(Boolean)
      .join(" ");
    if (text) return { itemId: String(item.id ?? ""), text };
  }
  return null;
}

export function callerTranscript(event: JsonRecord): string | null {
  if (String(event.type ?? "") !== "conversation.item.input_audio_transcription.completed") return null;
  const text = String(event.transcript ?? "").trim();
  return text || null;
}

export function responseFailure(event: JsonRecord): string | null {
  if (String(event.type ?? "") !== "response.done") return null;
  const response = event.response as JsonRecord | undefined;
  if (String(response?.status ?? "") !== "failed") return null;
  const details = response?.status_details as JsonRecord | undefined;
  const error = details?.error as JsonRecord | undefined;
  return String(error?.message ?? "The receptionist could not complete that reply.");
}
