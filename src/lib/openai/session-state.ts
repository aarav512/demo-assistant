import type { VoiceStatus } from "@/types/domain";

export function canStartSession(status: VoiceStatus): boolean {
  return status === "ready" || status === "disconnected";
}

export function safeClientMessage(input: string): string {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text || /sk-|ek_|bearer|api[_ ]?key|secret/i.test(text)) {
    return "The voice service rejected the session.";
  }
  return text.slice(0, 180);
}

const ACTIVE: ReadonlySet<VoiceStatus> = new Set(["connecting", "listening", "speaking", "processing"]);

export function isSessionActive(status: VoiceStatus): boolean {
  return ACTIVE.has(status);
}
