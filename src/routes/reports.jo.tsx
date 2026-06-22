import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useDashboardData } from "@/data/useDashboardData";
import { TopNav } from "@/components/TopNav";
import { formatGBP } from "@/lib/format";
import { trendPercentChange } from "@/data/bollinger";
import {
  HIGH_REASONS, LOW_REASONS, alertTypeLabel,
  getJoEntries, saveJoEntries, escalateToCarl,
  type JoEntry,
} from "@/data/reportingData";

export const Route = createFileRoute("/reports/jo")({
  head: () => ({ meta: [{ title: "Jo's Report · TLP Monitor" }] }),
  component: JoReportPage,
});

function JoReportPage() {
  const data = useDashboardData();
  const [entries, setEntries] = useState<JoEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (data.loading) return;
    const existing = getJoEntries();

    const alerts: JoEntry[] = [];

    // Breakout alerts
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

    // Trend alerts
    const trendDown = data.agents.filter(a => a.trend === "down" && a.latest.mean >= 25000);
    for (const agent of trendDown) {
      const pct = trendPercentChange(agent.raw);
      if (pct > -15) continue;
      const id = `jo-${today}-${agent.platformId}-${agent.agentId}-trend`;
      const ex = existing.find(e => e.id === id);
      alerts.push(ex ?? {
        id, date: today,
        agentId: agent.agentId, agentName: agent.agentName,
        platformId: agent.platformId, platformName: agent.platformName,
        alertType: "trend_down", balance: agent.latest.balance,
        variancePct: pct, reason: "", notes: "", action: "", passedToCarl: false,
      });
    }

    // Carry over unresolved from previous days
    const oldUnresolved = existing.filter(e =>
      e.date !== today && e.action === "" && !alerts.find(a => a.id === e.id)
    );

    setEntries([...alerts, ...oldUnresolved]);
  }, [data.loading]);

  function update(id: string, field: keyof JoEntry, value: string) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    setSaved(false);
  }

  function handleEscalate(entry: JoEntry) {
    const updated = entries.map(e =>
      e.id === entry.id
        ? { ...e, action: "escalate_carl" as const, passedToCarl: true, passedToCarlAt: new Date().toISOString() }
        : e
    );
    setEntries(updated);
    saveJoEntries(updated);
    escalateToCarl({ ...entry, action: "escalate_carl", passedToCarl: true });
    setSaved(true);
  }

  function handleNoAction(id: string) {
    const updated = entries.map(e => e.id === id ? { ...e, action: "no_action" as const } : e);
    setEntries(updated);
    saveJoEntries(updated);
    setSaved(true);
  }

  function saveAll() {
    saveJoEntries(entries);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const pending = entries.filter(e => e.action === "").length;

  return (
    <div className="min-h-screen bg-surface">
      <TopNav lastUpdated={data.lastUpdated} usingLiveData={data.usingLiveData} />
      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Jo's Report</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {entries.length} alert{entries.length !== 1 ? "s" : ""} · {pending} pending review
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-green-600">✓ Saved</span>}
            <button onClick={saveAll} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary transition">
              Save
            </button>
          </div>
        </div>

        {data.loading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-text-secondary">Loading alerts…</div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm" style={{ color: "#1E8449" }}>
            ✓ No active alerts — nothing to review today.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => {
              const isHigh = entry.alertType === "above_band" || entry.alertType === "trend_up";
              const reasons = isHigh ? HIGH_REASONS : LOW_REASONS;
              const showNotes = entry.reason === "Other" || entry.reason === "Potential fraud";
              const isDone = entry.action !== "";
              const borderColor = isDone
                ? entry.action === "no_action" ? "#27AE60" : "#2E7D8A"
                : entry.alertType.includes("above") || entry.alertType.includes("up") ? "#C8773A" : "#E74C3C";

              return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
                  style={{ borderLeft: `4px solid ${borderColor}`, opacity: isDone ? 0.7 : 1 }}
                >
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
                        background: isHigh ? "rgba(200,119,58,0.13)" : "rgba(231,76,60,0.12)",
                        color: isHigh ? "#C8773A" : "#E74C3C",
                      }}>
                        {alertTypeLabel(entry.alertType)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="tabular-nums text-sm font-medium text-text-primary">{formatGBP(entry.balance)}</span>
                      <span className="text-sm font-medium" style={{ color: entry.variancePct >= 0 ? "#27AE60" : "#E74C3C" }}>
                        {entry.variancePct >= 0 ? "+" : ""}{Math.abs(entry.variancePct).toFixed(1)}%
                      </span>
                      {isDone && (
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500,
                          background: entry.action === "no_action" ? "rgba(39,174,96,0.12)" : "rgba(46,125,138,0.12)",
                          color: entry.action === "no_action" ? "#1E8449" : "#2E7D8A",
                        }}>
                          {entry.action === "no_action" ? "No action required" : "Escalated to Carl"}
                        </span>
                      )}
                    </div>
                  </div>

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
                            {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>

                        {!showNotes && entry.reason && (
                          <div className="flex items-end gap-2 mt-5">
                            <button
                              onClick={() => handleEscalate(entry)}
                              className="text-xs px-4 py-2 rounded text-white font-medium transition hover:opacity-90"
                              style={{ background: "#1B2E4B" }}
                            >
                              Escalate to Carl
                            </button>
                            <button
                              onClick={() => handleNoAction(entry.id)}
                              className="text-xs px-4 py-2 rounded font-medium border border-border hover:bg-secondary transition"
                            >
                              No action required
                            </button>
                          </div>
                        )}
                      </div>

                      {showNotes && (
                        <>
                          <div>
                            <label className="text-xs font-medium text-text-secondary mb-1 block">Notes</label>
                            <textarea
                              rows={3}
                              value={entry.notes}
                              onChange={e => update(entry.id, "notes", e.target.value)}
                              placeholder="Add notes…"
                              className="w-full border border-border rounded px-3 py-2 text-sm bg-card text-text-primary resize-y"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEscalate(entry)}
                              disabled={!entry.notes.trim()}
                              className="text-xs px-4 py-2 rounded text-white font-medium transition hover:opacity-90 disabled:opacity-40"
                              style={{ background: "#1B2E4B" }}
                            >
                              Escalate to Carl
                            </button>
                            <button
                              onClick={() => handleNoAction(entry.id)}
                              className="text-xs px-4 py-2 rounded font-medium border border-border hover:bg-secondary transition"
                            >
                              No action required
                            </button>
                          </div>
                        </>
                      )}
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
