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

  async function load() {
    const response = await fetch("/api/appointments", { cache: "no-store" });
    const body = (await response.json()) as { appointments?: AppointmentRequest[]; error?: string };
    if (!response.ok) {
      setMessage(body.error ?? "Appointment requests could not be loaded.");
      return;
    }
    setItems(body.appointments ?? []);
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
        <h1>Appointment requests</h1>
        <p className="lede">
          The receptionist saves a request. Confirmed appears only after a demo administrator sets that status here. No calendar is
          connected, and no message is sent.
        </p>
      </header>
      {!admin.admin ? (
        <p className="banner">Sign in as the demo administrator to review and update appointment requests.</p>
      ) : (
        <>
          <label className="field">
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
          {message ? <p role="status">{message}</p> : null}
          {visible.length === 0 ? (
            <EmptyState title={EMPTY_APPOINTMENTS.title} description={EMPTY_APPOINTMENTS.description} />
          ) : (
            <ul className="record-list">
              {visible.map((item) => (
                <li key={item.id} className="detail">
                  <div className="record-top">
                    <h2>{item.callerName}</h2>
                    {item.isSample ? <span className="badge sample">Sample data</span> : <span className="badge">{APPOINTMENT_LABEL[item.status]}</span>}
                  </div>
                  <p>Phone {item.callerPhone}</p>
                  <p>Service {item.requestedService || "Not specified"}</p>
                  <p>Doctor {item.requestedDoctor || "Not specified"}</p>
                  <p>Preferred {item.preferredDate} at {item.preferredTime}</p>
                  <p>Notes {item.notes || "None"}</p>
                  <p className="meta">Created {formatWhen(item.createdAt)}. Demonstration data until a real calendar is connected.</p>
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
                            setMessage(body.notice || body.error || "The status could not be updated.");
                            if (response.ok) await load();
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
          )}
        </>
      )}
    </div>
  );
}
