"use client";

import { useEffect, useState } from "react";
import { EmptyState, EMPTY_APPOINTMENTS } from "@/components/dashboard/empty-state";
import { useAdmin } from "@/components/layout/admin-context";
import { APPOINTMENT_LABEL, formatWhen } from "@/lib/utils/format";
import type { AppointmentRequest, AppointmentStatus } from "@/types/domain";

const STATUSES: AppointmentStatus[] = ["new", "pending_confirmation", "confirmed", "cancelled"];

export function AppointmentBoard() {
  const admin = useAdmin();
  const [items, setItems] = useState<AppointmentRequest[]>([]);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const response = await fetch("/api/appointments", { cache: "no-store" });
    const body = (await response.json()) as { appointments?: AppointmentRequest[]; error?: string };
    if (!response.ok) {
      setError(body.error ?? "Appointment requests could not be loaded.");
      setLoaded(true);
      return;
    }
    setError(null);
    setItems(body.appointments ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    if (!admin.admin) return;
    // Appointment requests are loaded after the admin session is known.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [admin.admin]);

  const visible = items.filter((item) => filter === "all" || item.status === filter);

  return (
    <div className="stack">
      <header>
        <p className="page-kicker">Requests</p>
        <h1>Not booked yet.</h1>
        <p className="lede">
          The receptionist can save a request. Confirmed appears only after an admin sets it here. No calendar is connected, and
          no message is sent.
        </p>
      </header>
      {!admin.admin ? (
        <p className="banner">Sign in as admin to review and update appointment requests.</p>
      ) : (
        <>
          <label className="field" style={{ maxWidth: "22rem" }}>
            Status
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {APPOINTMENT_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          {message ? <p role="status">{message}</p> : null}
          {!loaded && !error ? <p role="status">Loading requests.</p> : null}
          {loaded && !error && visible.length === 0 ? (
            <EmptyState title={EMPTY_APPOINTMENTS.title} description={EMPTY_APPOINTMENTS.description} />
          ) : null}
          {visible.length > 0 ? (
            <ul className="record-list">
              {visible.map((item) => (
                <li key={item.id} className="detail">
                  <div className="record-top">
                    <h2>{item.callerName}</h2>
                    {item.isSample ? <span className="badge sample">Sample data</span> : <span className="badge">{APPOINTMENT_LABEL[item.status]}</span>}
                  </div>
                  <dl className="facts">
                    <div>
                      <dt>Phone</dt>
                      <dd>{item.callerPhone}</dd>
                    </div>
                    <div>
                      <dt>Service</dt>
                      <dd>{item.requestedService || "Not specified"}</dd>
                    </div>
                    <div>
                      <dt>Doctor</dt>
                      <dd>{item.requestedDoctor || "Not specified"}</dd>
                    </div>
                    <div>
                      <dt>Preferred</dt>
                      <dd>
                        {item.preferredDate} at {item.preferredTime}
                      </dd>
                    </div>
                    <div>
                      <dt>Notes</dt>
                      <dd>{item.notes || "None"}</dd>
                    </div>
                  </dl>
                  <p className="meta">Created {formatWhen(item.createdAt)}. Still a request until a real calendar is connected.</p>
                  <div className="actions">
                    {STATUSES.map((status) => (
                      <button
                        key={status}
                        className="button secondary"
                        type="button"
                        disabled={item.status === status}
                        onClick={() => {
                          void fetch(`/api/appointments/${item.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status }),
                          }).then(async (response) => {
                            const body = (await response.json()) as { notice?: string; error?: string };
                            if (!response.ok) {
                              setError(body.error || "The status could not be updated.");
                              setMessage(null);
                              return;
                            }
                            setError(null);
                            setMessage(body.notice || "The demonstration status was updated.");
                            await load();
                          });
                        }}
                      >
                        {APPOINTMENT_LABEL[status]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
