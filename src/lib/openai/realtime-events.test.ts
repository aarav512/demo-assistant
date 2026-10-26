import { describe, expect, it } from "vitest";
import {
  assistantDelta,
  assistantFinalText,
  audioResponseCommand,
  callerTranscript,
  greetingCommand,
  responseFailure,
  sessionUpdateCommand,
  textTurnCommands,
} from "@/lib/openai/realtime-events";

describe("realtime session commands", () => {
  it("asks the session to speak and to answer after the caller pauses", () => {
    const update = sessionUpdateCommand();
    expect(update.type).toBe("session.update");
    const session = update.session as {
      type: string;
      output_modalities: string[];
      audio: {
        input: { transcription: { model: string }; turn_detection: { create_response: boolean } };
        output: { voice: string };
      };
    };
    expect(session.type).toBe("realtime");
    expect(session.output_modalities).toEqual(["audio"]);
    expect(session.audio.output.voice).toBe("marin");
    expect(session.audio.input.transcription.model).toBe("gpt-4o-mini-transcribe");
    expect(session.audio.input.turn_detection.create_response).toBe(true);
    expect(greetingCommand().response).toMatchObject({ output_modalities: ["audio"] });
    expect(audioResponseCommand()).toEqual({ type: "response.create", response: { output_modalities: ["audio"] } });
  });

  it("sends a typed line and then requests a spoken reply", () => {
    const [item, response] = textTurnCommands("What time do you close?");
    expect(item).toMatchObject({
      type: "conversation.item.create",
      item: { role: "user", content: [{ type: "input_text", text: "What time do you close?" }] },
    });
    expect(response).toMatchObject({ type: "response.create", response: { output_modalities: ["audio"] } });
  });
});

describe("realtime server events", () => {
  it("reads caller speech and assistant audio or text transcripts", () => {
    expect(callerTranscript({ type: "conversation.item.input_audio_transcription.completed", transcript: "Hello" })).toBe("Hello");
    expect(assistantDelta({ type: "response.output_audio_transcript.delta", delta: "Hi", item_id: "msg_1" })).toEqual({
      itemId: "msg_1",
      text: "Hi",
    });
    expect(assistantDelta({ type: "response.output_text.delta", delta: "Hours", item_id: "msg_2" })?.text).toBe("Hours");
    expect(
      assistantFinalText({
        type: "response.done",
        response: { output: [{ id: "msg_3", type: "message", content: [{ type: "output_audio", transcript: "We close at 8." }] }] },
      }),
    ).toEqual({ itemId: "msg_3", text: "We close at 8." });
  });

  it("surfaces a failed model response", () => {
    expect(
      responseFailure({
        type: "response.done",
        response: { status: "failed", status_details: { error: { message: "The model could not respond." } } },
      }),
    ).toBe("The model could not respond.");
    expect(responseFailure({ type: "response.done", response: { status: "completed" } })).toBeNull();
  });
});
