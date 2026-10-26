"use client";

import { useCallback, useEffect, useState } from "react";
import { CallPanel } from "@/components/receptionist/call-panel";
import { EmptyState, EMPTY_APPOINTMENTS, EMPTY_CALLS } from "@/components/dashboard/empty-state";
import { useAdmin } from "@/components/layout/admin-context";
import { APPOINTMENT_LABEL, formatDuration, formatWhen } from "@/lib/utils/format";
import type { AppointmentRequest, DemoCall, Metrics } from "@/types/domain";

type Health = { voice: string; database: string; admin: string };

export function Dashboard() {
  const admin = useAdmin();
  const [health, setHealth] = useState<Health | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [clinicName, setClinicName] = useState("Sunrise Family Clinic");
  const [calls, setCalls] = useState<DemoCall[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRequest[]>([]);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [healthResponse, metricsResponse, settingsResponse] = await Promise.all([
      fetch("/api/health", { cache: "no-store" }),
      fetch("/api/metrics", { cache: "no-store" }),
      fetch("/api/clinic-settings", { cache: "no-store" }),
    ]);
    setHealth((await healthResponse.json()) as Health);
    const metricBody = (await metricsResponse.json()) as Metrics;
    setMetrics(metricBody);
    const settingsBody = (await settingsResponse.json()) as { settings?: { clinicName?: string } };
    if (settingsBody.settings?.clinicName) setClinicName(settingsBody.settings.clinicName);
    if (!admin.admin) {
      setCalls([]);
      setAppointments([]);
      return;
    }
    const records = await fetch("/api/calls", { cache: "no-store" });
    if (!records.ok) return;
    const body = (await records.json()) as { calls: DemoCall[]; appointments: AppointmentRequest[] };
    setCalls(body.calls);
    setAppointments(body.appointments);
  }, [admin.admin]);

  useEffect(() => {
    // Demo records are loaded from the API after mount and after each call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="stack">
      <header className="hero">
        <p className="page-kicker">Kynex Code · AI Calling Assistant</p>
        <h1>
          Ask the
          <br />
          desk.
        </h1>
        <p className="lede">
          Sunrise Family Clinic answers in the browser. It can take an appointment request. It cannot confirm a booking.
        </p>
        <div className="actions">
          <a className="button primary" href="#call-demo">
            Start a call
          </a>
        </div>
      </header>

      {health === null ? (
        <p className="meta" role="status">
          Loading the demo.
        </p>
      ) : null}
      {health?.voice === "not_configured" ? (
        <p className="banner">
          <strong>Voice is not configured. </strong>
          Add OPENAI_API_KEY on the server. The call control will not pretend a live session is connected.
        </p>
      ) : null}
      {health?.database === "memory" ? (
        <p className="banner">
          <strong>Records are temporary. </strong>
          Supabase is not configured, so demo records stay in this server process and disappear when it stops.
        </p>
      ) : null}

      <CallPanel clinicName={clinicName} onFinished={load} />

      {admin.admin ? (
        <>
          <section aria-label="Demo activity">
            <p className="page-kicker">Saved demo activity</p>
            <div className="figures">
              <Figure label="Calls completed" value={metrics?.callsCompleted} />
              <Figure label="Enquiries captured" value={metrics?.enquiriesCaptured} />
              <Figure label="Appointment requests" value={metrics?.appointmentRequests} />
              <Figure label="Needs follow-up" value={metrics?.callsNeedingFollowUp} />
            </div>
          </section>

          <div className="split">
            <section>
              <h2>Recent calls</h2>
              {calls.length === 0 ? (
                <EmptyState title={EMPTY_CALLS.title} description={EMPTY_CALLS.description} />
              ) : (
                <ul className="record-list">
                  {calls.slice(0, 5).map((call) => (
                    <li key={call.id} className="record">
                      <div className="record-top">
                        <strong>{call.callerName || "Unknown caller"}</strong>
                        {call.isSample ? <span className="badge sample">Sample data</span> : null}
                      </div>
                      <p className="meta">
                        {call.callReason || "No reason captured"} · {formatWhen(call.startedAt)} · {formatDuration(call.durationSeconds)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2>Requests</h2>
              {appointments.length === 0 ? (
                <EmptyState title={EMPTY_APPOINTMENTS.title} description={EMPTY_APPOINTMENTS.description} />
              ) : (
                <ul className="record-list">
                  {appointments.slice(0, 5).map((appointment) => (
                    <li key={appointment.id} className="record">
                      <div className="record-top">
                        <strong>{appointment.callerName}</strong>
                        {appointment.isSample ? <span className="badge sample">Sample data</span> : <span className="badge">{APPOINTMENT_LABEL[appointment.status]}</span>}
                      </div>
                      <p className="meta">
                        {appointment.requestedDoctor || appointment.requestedService} · {appointment.preferredDate} · {appointment.preferredTime}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section>
            <h2>Reset demo data</h2>
            <p className="meta">Deletes saved calls, enquiries, and appointment requests. Clinic settings stay in place.</p>
            <button className="button danger" type="button" onClick={() => setResetOpen(true)}>
              Reset demo data
            </button>
            {resetOpen ? (
              <form
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  void fetch("/api/admin/reset", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ confirm: "RESET DEMO" }),
                  }).then(async (response) => {
                    const body = (await response.json()) as { notice?: string; error?: string };
                    setMessage(body.notice || body.error || "The reset could not be completed.");
                    setResetOpen(false);
                    setConfirmed(false);
                    await load();
                  });
                }}
              >
                <div className="checks">
                  <label>
                    <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                    <span>I understand this deletes the saved demo records.</span>
                  </label>
                </div>
                <div className="actions">
                  <button className="button danger" type="submit" disabled={!confirmed}>
                    Delete demo records
                  </button>
                  <button className="button secondary" type="button" onClick={() => setResetOpen(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
            {message ? <p role="status">{message}</p> : null}
          </section>
        </>
      ) : (
        <p className="meta">Sign in as admin to review saved calls and requests. Phone numbers stay off this page.</p>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number | undefined }) {
  return (
    <article className="figure">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </article>
  );
}
