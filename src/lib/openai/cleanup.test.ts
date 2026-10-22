import { describe, expect, it, vi } from "vitest";
import { releaseVoiceSession } from "@/lib/openai/cleanup";
import { canStartSession, safeClientMessage } from "@/lib/openai/session-state";

describe("voice session cleanup", () => {
  it("stops tracks and closes the connection even when one step throws", () => {
    const stop = vi.fn(() => {
      throw new Error("already stopped");
    });
    const closeChannel = vi.fn();
    const closePeer = vi.fn();
    const clearAudio = vi.fn();
    const stopMeter = vi.fn();
    releaseVoiceSession({
      tracks: [{ stop }],
      dataChannel: { close: closeChannel },
      peer: { close: closePeer },
      clearAudio,
      stopMeter,
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(closeChannel).toHaveBeenCalledOnce();
    expect(closePeer).toHaveBeenCalledOnce();
    expect(clearAudio).toHaveBeenCalledOnce();
    expect(stopMeter).toHaveBeenCalledOnce();
  });

  it("does not start a second session while one is active", () => {
    expect(canStartSession("ready")).toBe(true);
    expect(canStartSession("disconnected")).toBe(true);
    expect(canStartSession("connecting")).toBe(false);
    expect(canStartSession("listening")).toBe(false);
    expect(canStartSession("speaking")).toBe(false);
  });

  it("hides secrets from voice errors", () => {
    expect(safeClientMessage("bad key sk-live-secret")).toBe("The voice service rejected the session.");
    expect(safeClientMessage("Microphone access was denied.")).toContain("Microphone");
  });
});
