"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, EMPTY_CALLS } from "@/components/dashboard/empty-state";
import { useAdmin } from "@/components/layout/admin-context";
import { formatDuration, formatWhen } from "@/lib/utils/format";
import type { DemoCall } from "@/types/domain";

export function CallHistory() {
  const admin = useAdmin();
  const [calls, setCalls] = useState<DemoCall[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!admin.admin) return;
    void fetch("/api/calls", { cache: "no-store" }).then(async (response) => {
      const body = (await response.json()) as { calls?: DemoCall[]; error?: string };
      if (!response.ok) setError(body.error ?? "Calls could not be loaded.");
      else setCalls(body.calls ?? []);
      setLoaded(true);
    });
  }, [admin.admin]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = calls.filter((call) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "follow_up" ? call.humanFollowUp : call.outcome === filter);
      const haystack = [call.callerName, call.callReason, call.summary, call.id].join(" ").toLowerCase();
      return matchesFilter && (!needle || haystack.includes(needle));
    });
    return filtered.sort((left, right) => {
      if (sort === "oldest") return left.startedAt.localeCompare(right.startedAt);
      if (sort === "longest") return (right.durationSeconds ?? 0) - (left.durationSeconds ?? 0);
      return right.startedAt.localeCompare(left.startedAt);
    });
  }, [calls, filter, query, sort]);

  const current = visible.find((call) => call.id === selected) ?? null;

  return (
    <div className="stack">
      <header>
        <p className="page-kicker">Calls</p>
        <h1>What was said.</h1>
        <p className="lede">Browser demonstrations only. These are not telephone records or patient charts.</p>
      </header>
      {!admin.admin ? (
        <p className="banner">Sign in as admin to read call history. Contact details stay off the public page.</p>
      ) : (
        <>
          <div className="filters">
            <label className="field">
              Search
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, reason, or summary" />
            </label>
            <label className="field">
              Status
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In progress</option>
                <option value="failed">Failed</option>
                <option value="abandoned">Abandoned</option>
                <option value="follow_up">Needs follow-up</option>
              </select>
            </label>
            <label className="field">
              Sort
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="longest">Longest</option>
              </select>
            </label>
          </div>
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          {!loaded && !error ? <p role="status">Loading calls.</p> : null}
          {loaded && visible.length === 0 ? (
            <EmptyState title={EMPTY_CALLS.title} description={EMPTY_CALLS.description} />
          ) : null}
          {visible.length > 0 ? (
            <ul className="record-list">
              {visible.map((call) => (
                <li key={call.id}>
                  <button className="record" type="button" onClick={() => setSelected(call.id)} aria-pressed={selected === call.id}>
                    <div className="record-top">
                      <strong>{call.callerName || "Unknown caller"}</strong>
                      {call.isSample ? <span className="badge sample">Sample data</span> : <span className="badge">{call.outcome.replaceAll("_", " ")}</span>}
                    </div>
                    <p className="meta">
                      {call.id.slice(0, 8)} · {formatWhen(call.startedAt)} · {formatDuration(call.durationSeconds)}
                    </p>
                    <p>{call.callReason || "No reason captured"}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {current ? <CallDetail call={current} /> : null}
        </>
      )}
    </div>
  );
}

function CallDetail({ call }: { call: DemoCall }) {
  return (
    <article className="detail">
      <h2>Call {call.id.slice(0, 8)}</h2>
      {call.isSample ? <p className="badge sample">Sample data. Not a real caller.</p> : null}
      <dl className="facts">
        <div>
          <dt>Started</dt>
          <dd>{formatWhen(call.startedAt)}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(call.durationSeconds)}</dd>
        </div>
        <div>
          <dt>Caller</dt>
          <dd>{call.callerName || "Not provided"}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{call.callerPhone || "Not provided"}</dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd>{call.callReason || "Not captured"}</dd>
        </div>
        <div>
          <dt>Outcome</dt>
          <dd>{call.outcome.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>Follow-up</dt>
          <dd>{call.followUpStatus}</dd>
        </div>
      </dl>
      <p>{call.summary || "No summary was saved."}</p>
      {call.failureReason ? <p>Failure note: {call.failureReason}</p> : null}
      {call.transcript?.length ? (
        <div className="transcript">
          {call.transcript.map((line, index) => (
            <div key={`${line.at}-${index}`} className={`bubble ${line.role}`}>
              <b>{line.role === "caller" ? "Caller" : "Receptionist"}</b>
              <p>{line.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="meta">No transcript was stored for this demo.</p>
      )}
    </article>
  );
}
