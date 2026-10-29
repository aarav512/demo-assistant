import { releaseVoiceSession } from "@/lib/openai/cleanup";
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
import { safeClientMessage } from "@/lib/openai/session-state";
import type { AppointmentRequest, CallSummary, DemoCall, TranscriptLine, VoiceStatus } from "@/types/domain";

export type TranscriptItem = TranscriptLine & { id: string; pending?: boolean };

export type VoiceListenerEvent =
  | { type: "status"; status: VoiceStatus }
  | { type: "transcript"; items: TranscriptItem[] }
  | { type: "level"; level: number }
  | { type: "error"; message: string }
  | { type: "needs-gesture" }
  | { type: "finished"; call: DemoCall | null; appointments: AppointmentRequest[]; summary: CallSummary | null };

type JsonRecord = Record<string, unknown>;

type StartOptions = {
  consent: boolean;
  storeTranscript: boolean;
};

export class BrowserVoiceSession {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private microphone: MediaStream | null = null;
  private meter: AudioContext | null = null;
  private frame = 0;
  private callId: string | null = null;
  private callToken: string | null = null;
  private storeTranscript = false;
  private items: TranscriptItem[] = [];
  private partialId: string | null = null;
  private handled = new Set<string>();
  private chain: Promise<void> = Promise.resolve();
  private starting = false;
  private closing = false;
  private greeted = false;
  private greetingTimer = 0;
  private status: VoiceStatus = "ready";

  constructor(
    private readonly audio: HTMLAudioElement,
    private readonly listener: (event: VoiceListenerEvent) => void,
  ) {}

  async start(options: StartOptions): Promise<void> {
    if (this.starting || this.peer) return;
    if (!options.consent) {
      this.fail("Consent is required before a demo can start.");
      return;
    }
    this.starting = true;
    this.closing = false;
    this.greeted = false;
    this.storeTranscript = options.storeTranscript;
    this.items = [];
    this.handled.clear();
    this.emitTranscript();
    this.setStatus("connecting");
    this.audio.autoplay = true;
    void this.audio.play().catch(() => undefined);

    let pendingMicrophone: Promise<MediaStream> | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.fail("This browser cannot use the microphone.");
        return;
      }
      pendingMicrophone = navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      const voiceState = await readVoiceState();
      if (voiceState === "not_configured") {
        this.stopStream(await pendingMicrophone.catch(() => null));
        this.fail("Voice service not configured.");
        return;
      }

      this.microphone = await pendingMicrophone;
      pendingMicrophone = null;
      const liveTracks = this.microphone.getAudioTracks().filter((track) => track.readyState === "live");
      if (liveTracks.length === 0) throw new Error("The microphone did not start.");
      this.startMeter();

      const peer = new RTCPeerConnection();
      this.peer = peer;
      peer.addEventListener("track", (event) => {
        const [stream] = event.streams;
        this.audio.srcObject = stream && stream.getAudioTracks().length > 0 ? stream : new MediaStream([event.track]);
        void this.audio.play().catch(() => this.listener({ type: "needs-gesture" }));
      });
      peer.addEventListener("connectionstatechange", () => {
        if (peer.connectionState === "failed") this.fail("The voice connection failed.");
      });
      peer.addEventListener("iceconnectionstatechange", () => {
        if (peer.iceConnectionState === "failed") this.fail("The voice connection could not reach the receptionist.");
      });
      for (const track of this.microphone.getAudioTracks()) peer.addTrack(track, this.microphone);

      // The data channel must exist before the SDP offer so Realtime events have a route.
      const channel = peer.createDataChannel("oai-events");
      this.channel = channel;
      channel.addEventListener("message", (event) => {
        this.onMessage(String(event.data));
      });
      channel.addEventListener("open", () => {
        this.setStatus("listening");
        this.sendCommand(sessionUpdateCommand());
        this.greetingTimer = window.setTimeout(() => this.greet(), 1200);
      });
      channel.addEventListener("close", () => {
        if (!this.closing) void this.finish("abandoned", "The voice connection closed.");
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIce(peer);
      const sdp = peer.localDescription?.sdp;
      if (!sdp) throw new Error("The voice connection could not be prepared.");

      const response = await fetch("/api/voice-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp, consent: true, storeTranscript: options.storeTranscript }),
        signal: AbortSignal.timeout(25_000),
      });
      const payload = await readJsonBody<{ sdp?: string; callId?: string; callToken?: string; error?: string }>(response);
      if (!response.ok || !payload.sdp || !payload.callId || !payload.callToken) {
        throw new Error(payload.error || "The voice service could not start a session.");
      }
      this.callId = payload.callId;
      this.callToken = payload.callToken;
      const answer = `${payload.sdp.replace(/(?:\r\n|\n|\r)+$/, "")}\r\n`;
      await peer.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (error) {
      if (pendingMicrophone) this.stopStream(await pendingMicrophone.catch(() => null));
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      const missingMic = error instanceof DOMException && (error.name === "NotFoundError" || error.name === "NotReadableError");
      const timedOut = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
      this.fail(
        denied
          ? "Microphone access was denied. Allow the microphone in your browser, then start the demo again."
          : missingMic
            ? "No microphone is available. Connect a microphone, then start the demo again."
            : timedOut
              ? "The voice service took too long to answer. Start the demo again."
              : safeClientMessage(error instanceof Error ? error.message : "The voice connection failed."),
      );
    } finally {
      this.starting = false;
    }
  }

  setMuted(muted: boolean): void {
    this.microphone?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  sendText(text: string): void {
    const line = text.trim();
    if (!line || !this.channel || this.channel.readyState !== "open") {
      this.listener({ type: "error", message: "Start the demo before sending a line." });
      return;
    }
    for (const command of textTurnCommands(line)) this.sendCommand(command);
    this.addLine("caller", line);
    this.setStatus("processing");
  }

  async end(): Promise<void> {
    await this.finish("completed");
  }

  destroy(): void {
    if (this.closing) {
      this.release();
      return;
    }
    this.closing = true;
    const token = this.callToken;
    const id = this.callId;
    this.release();
    if (id && token) {
      void fetch(`/api/calls/${id}`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outcome: "abandoned" }),
      });
    }
  }

  private async finish(outcome: "completed" | "failed" | "abandoned", failureReason?: string): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    const id = this.callId;
    const token = this.callToken;
    const transcript = this.storeTranscript
      ? this.items.filter((item) => !item.pending).map(({ role, text, at }) => ({ role, text, at }))
      : undefined;
    this.release();
    this.setStatus("disconnected");
    if (!id || !token) {
      this.listener({ type: "finished", call: null, appointments: [], summary: null });
      return;
    }
    try {
      const response = await fetch(`/api/calls/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outcome, failureReason, transcript }),
      });
      const payload = (await response.json()) as {
        call?: DemoCall;
        appointments?: AppointmentRequest[];
        summary?: CallSummary;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "The demo summary could not be saved.");
      this.listener({
        type: "finished",
        call: payload.call ?? null,
        appointments: payload.appointments ?? [],
        summary: payload.summary ?? payload.call?.summaryDetail ?? null,
      });
    } catch (error) {
      this.listener({
        type: "error",
        message: safeClientMessage(error instanceof Error ? error.message : "The demo summary could not be saved."),
      });
      this.listener({ type: "finished", call: null, appointments: [], summary: null });
    }
  }

  private onMessage(raw: string): void {
    let event: JsonRecord;
    try {
      event = JSON.parse(raw) as JsonRecord;
    } catch {
      return;
    }
    const type = String(event.type ?? "");
    if (type === "session.created") this.sendCommand(sessionUpdateCommand());
    if (type === "session.updated") this.greet();
    if (type === "input_audio_buffer.speech_started") this.setStatus("listening");
    if (type === "input_audio_buffer.speech_stopped") this.setStatus("processing");
    if (type === "response.created" || type === "output_audio_buffer.started") this.setStatus("speaking");
    if (type === "output_audio_buffer.stopped") this.setStatus("listening");
    const spoken = callerTranscript(event);
    if (spoken) this.addLine("caller", spoken);
    const delta = assistantDelta(event);
    if (delta) this.appendAssistant(delta.text, delta.itemId);
    const finalText = assistantFinalText(event);
    if (finalText) this.finishAssistant(finalText.text, finalText.itemId);
    const failure = responseFailure(event);
    if (failure) this.listener({ type: "error", message: safeClientMessage(failure) });
    if (type === "response.done") {
      this.chain = this.chain
        .then(() => this.handleFunctionCalls(event))
        .catch(() => {
          this.listener({ type: "error", message: "The receptionist could not complete that action." });
        });
    }
    if (type === "error") {
      const nested = event.error as JsonRecord | undefined;
      this.listener({ type: "error", message: safeClientMessage(String(nested?.message ?? "The voice service reported an error.")) });
    }
  }

  private async handleFunctionCalls(event: JsonRecord): Promise<void> {
    const response = event.response as JsonRecord | undefined;
    const output = Array.isArray(response?.output) ? (response.output as JsonRecord[]) : [];
    const calls = output.filter((item) => item.type === "function_call");
    if (calls.length === 0) {
      if (this.status === "speaking" || this.status === "processing") this.setStatus("listening");
      return;
    }
    this.setStatus("processing");
    for (const call of calls) {
      const openaiCallId = String(call.call_id ?? "");
      if (!openaiCallId || this.handled.has(openaiCallId) || !this.callId || !this.callToken) continue;
      this.handled.add(openaiCallId);
      let args: unknown = {};
      try {
        args = JSON.parse(String(call.arguments ?? "{}"));
      } catch {
        args = {};
      }
      const toolResponse = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: this.callId,
          callToken: this.callToken,
          openaiCallId,
          name: String(call.name ?? ""),
          arguments: args,
        }),
      });
      const data = (await toolResponse.json()) as { output?: unknown; error?: string };
      const toolOutput = toolResponse.ok ? data.output : { error: data.error ?? "The clinic system could not complete that action." };
      this.channel?.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: openaiCallId, output: JSON.stringify(toolOutput ?? { error: "No result." }) },
        }),
      );
    }
    this.sendCommand(audioResponseCommand());
  }

  private greet(): void {
    if (this.greeted || this.closing || this.channel?.readyState !== "open") return;
    this.greeted = true;
    if (this.greetingTimer) window.clearTimeout(this.greetingTimer);
    this.greetingTimer = 0;
    this.sendCommand(greetingCommand());
  }

  private sendCommand(command: Record<string, unknown>): void {
    if (this.channel?.readyState !== "open") return;
    this.channel.send(JSON.stringify(command));
  }

  private stopStream(stream: MediaStream | null): void {
    stream?.getTracks().forEach((track) => track.stop());
  }

  private startMeter(): void {
    if (!this.microphone || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const source = context.createMediaStreamSource(this.microphone);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(bins);
      let total = 0;
      for (const value of bins) total += value;
      this.listener({ type: "level", level: Math.min(1, total / bins.length / 72) });
      this.frame = window.requestAnimationFrame(tick);
    };
    this.meter = context;
    void context.resume().catch(() => undefined);
    this.frame = window.requestAnimationFrame(tick);
  }

  private addLine(role: TranscriptItem["role"], text: string): void {
    this.items.push({ id: crypto.randomUUID(), role, text, at: new Date().toISOString() });
    this.emitTranscript();
  }

  private appendAssistant(delta: string, itemId: string): void {
    if (!delta) return;
    if (!this.partialId) {
      this.partialId = itemId || crypto.randomUUID();
      this.items.push({ id: this.partialId, role: "receptionist", text: delta, at: new Date().toISOString(), pending: true });
    } else {
      const current = this.items.find((item) => item.id === this.partialId);
      if (current) current.text += delta;
    }
    this.emitTranscript();
  }

  private finishAssistant(text: string, itemId: string): void {
    const current = this.items.find((item) => item.id === this.partialId || item.id === itemId);
    if (current) {
      current.text = text;
      current.pending = false;
    } else {
      this.items.push({ id: itemId || crypto.randomUUID(), role: "receptionist", text, at: new Date().toISOString() });
    }
    this.partialId = null;
    this.emitTranscript();
  }

  private emitTranscript(): void {
    this.listener({ type: "transcript", items: this.items.map((item) => ({ ...item })) });
  }

  private setStatus(status: VoiceStatus): void {
    this.status = status;
    this.listener({ type: "status", status });
  }

  private fail(message: string): void {
    if (this.closing) return;
    this.closing = true;
    const id = this.callId;
    const token = this.callToken;
    this.release();
    this.setStatus("disconnected");
    this.listener({ type: "error", message });
    if (id && token) {
      void fetch(`/api/calls/${id}`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outcome: "failed", failureReason: "The voice connection failed." }),
      });
    }
  }

  private release(): void {
    if (this.greetingTimer) window.clearTimeout(this.greetingTimer);
    this.greetingTimer = 0;
    if (this.frame) window.cancelAnimationFrame(this.frame);
    const meter = this.meter;
    releaseVoiceSession({
      tracks: this.microphone?.getTracks() ?? [],
      dataChannel: this.channel,
      peer: this.peer,
      clearAudio: () => {
        this.audio.srcObject = null;
      },
      stopMeter: () => {
        void meter?.close();
      },
    });
    this.microphone = null;
    this.channel = null;
    this.peer = null;
    this.meter = null;
    this.frame = 0;
    this.callId = null;
    this.callToken = null;
  }
}

async function readVoiceState(): Promise<string> {
  try {
    const healthResponse = await fetch("/api/health", { cache: "no-store" });
    if (!healthResponse.ok) return "unknown";
    const health = await readJsonBody<{ voice?: string }>(healthResponse);
    return health.voice ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function readJsonBody<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

function waitForIce(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = window.setTimeout(done, 8000);
    function done() {
      window.clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", onState);
      resolve();
    }
    function onState() {
      if (peer.iceGatheringState === "complete") done();
    }
    peer.addEventListener("icegatheringstatechange", onState);
  });
}
