"use client";

import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SUGGESTED_PROMPTS } from "@/lib/clinic/default-clinic";
import { BrowserVoiceSession, type TranscriptItem } from "@/lib/openai/browser-session";
import { canStartSession } from "@/lib/openai/session-state";
import { APPOINTMENT_LABEL, STATUS_LABEL } from "@/lib/utils/format";
import type { AppointmentRequest, CallSummary, VoiceStatus } from "@/types/domain";

export function CallPanel({ clinicName, onFinished }: { clinicName: string; onFinished: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const sessionRef = useRef<BrowserVoiceSession | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("ready");
  const [level, setLevel] = useState(0);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [storeTranscript, setStoreTranscript] = useState(false);
  const [muted, setMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [typed, setTyped] = useState("");
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRequest[]>([]);
  const active = !canStartSession(status);

  const finishedRef = useRef(onFinished);
  useEffect(() => {
    finishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const session = new BrowserVoiceSession(audio, (event) => {
      if (event.type === "status") setStatus(event.status);
      if (event.type === "transcript") setItems(event.items);
      if (event.type === "level") setLevel(event.level);
      if (event.type === "error") setError(event.message);
      if (event.type === "needs-gesture") setNeedsGesture(true);
      if (event.type === "finished") {
        setSummary(event.summary);
        setAppointments(event.appointments);
        finishedRef.current();
      }
    });
    sessionRef.current = session;
    return () => session.destroy();
  }, []);

  const bars = Array.from({ length: 28 }, (_, index) => {
    const distance = Math.abs(index - 13.5) / 14;
    const height = active ? Math.max(0.14, level * (1 - distance * 0.55) + 0.08) : 0.12;
    return height;
  });
  const tone = status === "speaking" ? "speaking" : active ? "live" : "";

  return (
    <section className="stage" id="call-demo" aria-labelledby="call-title">
      <div className="panel-head">
        <div>
          <p className="page-kicker">{clinicName}</p>
          <h2
            id="call-title"
            className={`stage-state status ${active ? "live" : status === "disconnected" && error ? "bad" : ""}`}
            role="status"
          >
            <i />
            {STATUS_LABEL[status]}
          </h2>
          <p className="meta">A browser conversation, not a phone call.</p>
        </div>
      </div>

      <div className={`waveform ${tone}`} aria-hidden="true">
        {bars.map((height, index) => (
          <span key={index} style={{ transform: `scaleY(${height})` }} />
        ))}
      </div>
      <audio ref={audioRef} className="audio-slot" autoPlay playsInline />

      <div className="transcript" aria-live="polite" aria-relevant="additions">
        {items.length === 0 ? (
          <div className="empty-state">
            <h3>Nothing said yet</h3>
            <p>The microphone is requested only after you start. English and Hinglish both work.</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`bubble ${item.role}`}>
              <b>{item.role === "caller" ? "Caller" : "Receptionist"}</b>
              <p>{item.text}</p>
            </div>
          ))
        )}
      </div>

      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {needsGesture ? (
        <button className="button secondary" type="button" onClick={() => void audioRef.current?.play().then(() => setNeedsGesture(false))}>
          Play the reply
        </button>
      ) : null}

      {!active ? (
        <div className="checks">
          <label>
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>
              I know this is an AI receptionist in a browser demo, not a phone call. The demo may save a summary and any name
              or phone number I share. Audio is not recorded.
            </span>
          </label>
          <label>
            <input type="checkbox" checked={storeTranscript} onChange={(event) => setStoreTranscript(event.target.checked)} />
            <span>Save the written transcript of this demo.</span>
          </label>
        </div>
      ) : null}

      <div className="actions">
        {!active ? (
          <button
            className="button primary call-start"
            type="button"
            disabled={!consent}
            onClick={() => {
              setError(null);
              setSummary(null);
              setAppointments([]);
              void sessionRef.current?.start({ consent, storeTranscript });
            }}
          >
            <Phone size={18} aria-hidden="true" />
            {status === "disconnected" ? "Call again" : "Start the call"}
          </button>
        ) : (
          <>
            <button className="button danger" type="button" onClick={() => void sessionRef.current?.end()}>
              <PhoneOff size={18} aria-hidden="true" />
              End call
            </button>
            <button
              className="button secondary"
              type="button"
              aria-pressed={muted}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                sessionRef.current?.setMuted(next);
              }}
            >
              {muted ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
              {muted ? "Unmute microphone" : "Mute microphone"}
            </button>
          </>
        )}
      </div>
      {!active ? <p className="meta">Your browser asks for the microphone when the call starts.</p> : null}

      <div className="stack">
        <h3>Try asking</h3>
        <div className="prompts">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                if (active) sessionRef.current?.sendText(prompt);
                else setTyped(prompt);
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
        <form
          className="actions"
          onSubmit={(event) => {
            event.preventDefault();
            sessionRef.current?.sendText(typed);
            setTyped("");
          }}
        >
          <label className="field" style={{ flex: "1 1 16rem" }}>
            Type a line
            <input value={typed} onChange={(event) => setTyped(event.target.value)} disabled={!active} />
          </label>
          <button className="button secondary" type="submit" disabled={!active || !typed.trim()}>
            Send
          </button>
        </form>
      </div>

      {summary ? (
        <div className="detail">
          <h3>Summary</h3>
          <p>{summary.narrative}</p>
          <p>Follow-up: {summary.followUpAction}</p>
          {appointments.map((appointment) => (
            <article key={appointment.id}>
              <p>
                <strong>Appointment request · {APPOINTMENT_LABEL[appointment.status]}</strong>
              </p>
              <p>
                {appointment.callerName} · {appointment.requestedDoctor || appointment.requestedService} · {appointment.preferredDate} ·{" "}
                {appointment.preferredTime}
              </p>
              <p className="meta">This is a request, not a confirmed booking.</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
