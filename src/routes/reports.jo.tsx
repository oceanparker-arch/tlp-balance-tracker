import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useDashboardData } from "@/data/useDashboardData";
import { TopNav } from "@/components/TopNav";
import { formatGBP } from "@/lib/format";
import {
  HIGH_REASONS, LOW_REASONS, alertTypeLabel,
  getJoEntries, saveJoEntries, escalateToCarl,
  type JoEntry,
} from "@/data/reportingData";

export const Route = createFileRoute("/reports/jo")({
  head: () => ({ meta: [{ title: "Jo's Report · TLP Monitor" }] }),
  component: JoReportPage,
});

// Isolated card component — each card manages its own state
// so typing in one card never re-renders another
interface AlertCardProps {
  entry: JoEntry;
  onSave: (updated: JoEntry) => void;
}

function AlertCard({ entry: initialEntry, onSave }: AlertCardProps) {
  const [reason, setReason] = useState(initialEntry.reason);
  const [notes, setNotes]   = useState(initialEntry.notes);
  const [done, setDone]     = useState(initialEntry.action !== "");
  const [action, setAction] = useState(initialEntry.action);

  const isHigh   = initialEntry.alertType === "above_band" || initialEntry.alertType === "trend_up";
  const reasons  = isHigh ? HIGH_REASONS : LOW_REASONS;
  const showNotes = reason === "Other" || reason === "Potential fraud";
  const isDone   = done;

  const borderColor = !isDone ? (isHigh ? "#C8773A" : "#E74C3C")
    : action === "no_action" ? "#27AE60" : "#2E7D8A";

  function handleEscalate() {
    const updated: JoEntry = { ...initialEntry, reason, notes, action: "escalate_carl", passedToCarl: true, passedToCarlAt: new Date().toISOString() };
    setDone(true); setAction("escalate_carl");
    onSave(updated);
    escalateToCarl(updated);
  }

  function handleNoAction() {
    const updated: JoEntry = { ...initialEntry, reason, notes, action: "no_action", passedToCarl: false };
    setDone(true); setAction("no_action");
    onSave(updated);
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden" style={{ borderLeft: `4px solid ${borderColor}`, opacity: isDone ? 0.75 : 1 }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Link
            to="/agent/$platformId/$agentId"
            params={{ platformId: initialEntry.platformId, agentId: initialEntry.agentId }}
            className="font-semibold hover:underline"
            style={{ color: "var(--teal)" }}
          >
            {initialEntry.agentName}
          </Link>
          <span className="text-xs text-text-secondary">{initialEntry.platformName}</span>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: isHigh ? "rgba(200,119,58,0.13)" : "rgba(231,76,60,0.12)", color: isHigh ? "#C8773A" : "#E74C3C" }}>
            {alertTypeLabel(initialEntry.alertType)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="tabular-nums text-sm font-medium">{formatGBP(initialEntry.balance)}</span>
          <span className="text-sm font-medium" style={{ color: initialEntry.variancePct >= 0 ? "#27AE60" : "#E74C3C" }}>
            {initialEntry.variancePct >= 0 ? "+" : ""}{Math.abs(initialEntry.variancePct).toFixed(1)}%
          </span>
          {isDone && (
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: action === "no_action" ? "rgba(39,174,96,0.12)" : "rgba(46,125,138,0.12)", color: action === "no_action" ? "#1E8449" : "#2E7D8A" }}>
              {action === "no_action" ? "No action required" : "Escalated to Carl"}
            </span>
          )}
        </div>
      </div>

      {!isDone && (
        <div className="px-5 py-4 flex items-start gap-4 flex-wrap">
          <div style={{ minWidth: 200, flex: 1 }}>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Reason</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card text-text-primary"
            >
              <option value="">Select reason…</option>
              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {showNotes && (
            <div style={{ minWidth: 240, flex: 2 }}>
              <label className="text-xs font-medium text-text-secondary mb-1 block">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add notes…"
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card text-text-primary"
              />
            </div>
          )}

          {reason && (
            <div className="flex items-end gap-2 mt-5">
              <button
                onClick={handleEscalate}
                disabled={showNotes && !notes.trim()}
                className="text-xs px-4 py-2 rounded text-white font-medium disabled:opacity-40"
                style={{ background: "#1B2E4B" }}
              >
                Escalate to Carl
              </button>
              <button
                onClick={handleNoAction}
                className="text-xs px-4 py-2 rounded border border-border hover:bg-secondary transition"
              >
                No action required
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function JoReportPage() {
  const data = useDashboardData();
  const [entries, setEntries] = useState<JoEntry[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (data.loading) return;
    const existing = getJoEntries();
    const alerts: JoEntry[] = [];

    for (const agent of data.breakouts) {
      const id = `jo-${today}-${agent.platformId}-${agent.agentId}-band`;
      const ex = existing.find(e => e.id === id);
      alerts.push(ex ?? {
        id, date: today,
        agentId: agent.agentId, agentName: agent.agentName,
        platformId: agent.platformId, platformName: agent.platformName,
        alertType: agent.status === "above" ? "above_band" : "below_band",
        balance: agent.latest.balance,
        variancePct: agent.breakoutPct ?? 0,
        reason: "", notes: "", action: "", passedToCarl: false,
      });
    }

    const oldUnresolved = existing.filter(e =>
      e.date !== today && e.action === "" && !alerts.find(a => a.id === e.id)
    );

    setEntries([...alerts, ...oldUnresolved].sort((a, b) => {
      if (a.alertType === "below_band" && b.alertType !== "below_band") return -1;
      if (a.alertType !== "below_band" && b.alertType === "below_band") return 1;
      return Math.abs(b.variancePct) - Math.abs(a.variancePct);
    }));
  }, [data.loading]);

  function handleSave(updated: JoEntry) {
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    const existing = getJoEntries().filter(e => e.id !== updated.id);
    saveJoEntries([...existing, updated]);
  }

  const pending = entries.filter(e => e.action === "").length;

  return (
    <div className="min-h-screen bg-surface">
      <TopNav lastUpdated={data.lastUpdated} usingLiveData={data.usingLiveData} />
      <main className="mx-auto max-w-[1400px] space-y-4 px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Jo's Report</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {data.loading ? "Loading alerts…" : `${entries.length} alert${entries.length !== 1 ? "s" : ""} · ${pending} pending review`}
          </p>
        </div>

        {data.loading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-text-secondary">
            Loading alerts…
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm" style={{ color: "#1E8449" }}>
            ✓ No active alerts — nothing to review today.
          </div>
        ) : (
          entries.map(entry => (
            <AlertCard key={entry.id} entry={entry} onSave={handleSave} />
          ))
        )}
      </main>
    </div>
  );
}
