import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { useDashboardData } from "@/data/useDashboardData";
import { TopNav } from "@/components/TopNav";
import { formatGBP } from "@/lib/format";
import {
  CARL_REASONS, PLATFORM_MANAGERS, alertTypeLabel,
  getCarlEntries, saveCarlEntries,
  type CarlEntry,
} from "@/data/reportingData";

export const Route = createFileRoute("/reports/carl")({
  head: () => ({ meta: [{ title: "Carl's Report · TLP Monitor" }] }),
  component: CarlReportPage,
});

function DeadlineBadge({ deadline, status }: { deadline: string; status: CarlEntry["status"] }) {
  const days = differenceInDays(parseISO(deadline), new Date());
  if (status === "overdue") return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: "rgba(231,76,60,0.12)", color: "#E74C3C" }}>
      Overdue
    </span>
  );
  if (days <= 2) return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: "rgba(200,119,58,0.13)", color: "#C8773A" }}>
      {days === 0 ? "Due today" : `${days}d left`}
    </span>
  );
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: "rgba(46,125,138,0.12)", color: "#2E7D8A" }}>
      {days}d left
    </span>
  );
}

function CarlReportPage() {
  const data = useDashboardData();
  const [entries, setEntries] = useState<CarlEntry[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setEntries(getCarlEntries());
  }, []);

  function update(id: string, field: keyof CarlEntry, value: string) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    setSaved(false);
  }

  function handleEscalateChris(entry: CarlEntry) {
    const updated = entries.map(e =>
      e.id === entry.id ? { ...e, action: "escalate_chris" as const, status: "escalated" as const } : e
    );
    setEntries(updated);
    saveCarlEntries(updated);
    setSaved(true);
  }

  function handlePassedToManager(entry: CarlEntry) {
    if (!entry.passedToManager) return;
    const updated = entries.map(e =>
      e.id === entry.id ? { ...e, action: "passed_to_manager" as const, status: "passed_to_manager" as const } : e
    );
    setEntries(updated);
    saveCarlEntries(updated);
    setSaved(true);
  }

  function saveAll() {
    saveCarlEntries(entries);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const open = entries.filter(e => e.status === "open" || e.status === "overdue").length;
  const overdue = entries.filter(e => e.status === "overdue").length;

  return (
    <div className="min-h-screen bg-surface">
      <TopNav lastUpdated={data.lastUpdated} usingLiveData={data.usingLiveData} />
      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Carl's Report</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {open} open · {overdue > 0 && <span style={{ color: "#E74C3C" }}>{overdue} overdue</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-green-600">✓ Saved</span>}
            <button onClick={saveAll} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary transition">Save</button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-text-secondary">
            No reports escalated from Jo yet.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => {
              const isDone = entry.status === "escalated" || entry.status === "passed_to_manager";
              const borderColor = entry.status === "overdue" ? "#E74C3C"
                : isDone ? "#27AE60"
                : "#1B2E4B";

              return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
                  style={{ borderLeft: `4px solid ${borderColor}`, opacity: isDone ? 0.7 : 1 }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Link
                        to="/agent/$platformId/$agentId"
                        params={{ platformId: entry.platformId, agentId: entry.agentId }}
                        className="font-semibold hover:underline"
                        style={{ color: "var(--teal)" }}
                      >
                        {entry.agentName}
                      </Link>
                      <span className="text-xs text-text-secondary">{entry.platformName}</span>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500,
                        background: "rgba(231,76,60,0.12)", color: "#E74C3C",
                      }}>
                        {alertTypeLabel(entry.alertType)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-sm font-medium text-text-primary">{formatGBP(entry.balance)}</span>
                      <span className="text-sm font-medium" style={{ color: entry.variancePct >= 0 ? "#27AE60" : "#E74C3C" }}>
                        {entry.variancePct >= 0 ? "+" : ""}{Math.abs(entry.variancePct).toFixed(1)}%
                      </span>
                      <DeadlineBadge deadline={entry.deadline} status={entry.status} />
                      {isDone && (
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500,
                          background: "rgba(39,174,96,0.12)", color: "#1E8449",
                        }}>
                          {entry.status === "escalated" ? "Escalated to Chris" : "Passed to manager"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Jo's context */}
                  <div className="px-5 py-3 border-b border-border bg-secondary/30">
                    <div className="text-xs text-text-secondary mb-1">From Jo — {format(parseISO(entry.passedToCarlAt), "dd MMM yyyy HH:mm")}</div>
                    <div className="flex items-center gap-4 text-sm">
                      <span><span className="text-text-secondary text-xs">Reason: </span>{entry.joReason || "—"}</span>
                      {entry.joNotes && <span><span className="text-text-secondary text-xs">Notes: </span>{entry.joNotes}</span>}
                    </div>
                  </div>

                  {/* Carl's actions */}
                  {!isDone && (
                    <div className="px-5 py-4 flex flex-col gap-3">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <label className="text-xs font-medium text-text-secondary mb-1 block">Reason</label>
                          <select
                            value={entry.reason}
                            onChange={e => update(entry.id, "reason", e.target.value)}
                            className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card text-text-primary"
                          >
                            <option value="">Select reason…</option>
                            {CARL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-text-secondary mb-1 block">Pass to manager</label>
                          <select
                            value={entry.passedToManager ?? ""}
                            onChange={e => update(entry.id, "passedToManager", e.target.value)}
                            className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card text-text-primary"
                          >
                            <option value="">Select platform manager…</option>
                            {Object.entries(PLATFORM_MANAGERS).map(([k, v]) => (
                              <option key={k} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-secondary mb-1 block">Notes</label>
                        <textarea
                          rows={3}
                          value={entry.notes}
                          onChange={e => update(entry.id, "notes", e.target.value)}
                          placeholder="Add findings and notes…"
                          className="w-full border border-border rounded px-3 py-2 text-sm bg-card text-text-primary resize-y"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEscalateChris(entry)}
                          disabled={!entry.reason || !entry.notes.trim()}
                          className="text-xs px-4 py-2 rounded text-white font-medium transition hover:opacity-90 disabled:opacity-40"
                          style={{ background: "#1B2E4B" }}
                        >
                          Escalate to Chris
                        </button>
                        <button
                          onClick={() => handlePassedToManager(entry)}
                          disabled={!entry.passedToManager}
                          className="text-xs px-4 py-2 rounded font-medium border border-border hover:bg-secondary transition disabled:opacity-40"
                        >
                          Passed to manager
                        </button>
                      </div>
                    </div>
                  )}

                  {isDone && entry.notes && (
                    <div className="px-5 py-3 text-sm text-text-secondary">
                      <span className="text-xs font-medium text-text-secondary">Carl's notes: </span>{entry.notes}
                      {entry.passedToManager && <span className="ml-3 text-xs text-text-secondary">→ {entry.passedToManager}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
