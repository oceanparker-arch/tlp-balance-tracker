import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useDashboardData } from "@/data/useDashboardData";
import { TopNav } from "@/components/TopNav";
import { BollingerChart, ChartLegend } from "@/components/BollingerChart";
import { StatusPill, TrendArrow } from "@/components/StatusPill";
import { formatGBP } from "@/lib/format";
import { trendPercentChange, breakoutInfo } from "@/data/bollinger";
import {
  HIGH_REASONS, LOW_REASONS, alertTypeLabel,
  getJoEntries, saveJoEntries, escalateToCarl,
  type JoEntry,
} from "@/data/reportingData";

export const Route = createFileRoute("/agent/$platformId/$agentId")({
  head: () => ({
    meta: [{ title: "Agent Detail · TLP Monitor" }],
  }),
  component: AgentPage,
});

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-text-secondary">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{value}</div>
      {sub && <div className="mt-1 text-xs text-text-secondary">{sub}</div>}
    </div>
  );
}

function AgentPage() {
  const { platformId, agentId } = useParams({ from: "/agent/$platformId/$agentId" });
  const data = useDashboardData();
  const [view, setView] = useState<"all" | "12months" | "3months" | "month">("12months");
  const [showRaw, setShowRaw] = useState(false);

  const agent = data.agents.find((a) => a.platformId === platformId && a.agentId === agentId);
  const platform = data.platforms.find((p) => p.id === platformId);

  const monthSeries = useMemo(() => {
    if (!agent) return [];
    const currentMonth = agent.series[agent.series.length - 1]?.date.slice(0, 7);
    return agent.series.filter((p) => p.date.startsWith(currentMonth ?? ""));
  }, [agent]);

  const threeMonthSeries = useMemo(() => {
    if (!agent) return [];
    return agent.series.slice(-66); // ~22 working days x 3 months
  }, [agent]);

  const twelveMonthSeries = useMemo(() => {
    if (!agent) return [];
    return agent.series.slice(-265); // ~22 working days x 12 months
  }, [agent]);

  const pct = agent ? trendPercentChange(agent.raw) : 0;

  return (
    <div className="min-h-screen bg-surface">
      <TopNav lastUpdated={data.lastUpdated} usingLiveData={data.usingLiveData} />
      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        <div>
          {platform ? (
            <Link to="/platform/$platformId" params={{ platformId }} className="text-sm font-medium hover:underline" style={{ color: "var(--teal)" }}>
              ← {platform.name}
            </Link>
          ) : (
            <Link to="/" className="text-sm font-medium hover:underline" style={{ color: "var(--teal)" }}>← Dashboard</Link>
          )}
        </div>

        {!agent ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-text-secondary">
            {data.loading ? "Loading agent…" : "Agent not found."}
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{agent.agentName}</h1>
              <p className="text-sm text-text-secondary">{agent.platformName}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Today's closing balance" value={formatGBP(agent.latest.balance)} />
              <StatCard label="Band status" value={<StatusPill status={agent.status} pct={breakoutInfo(agent.series)?.pct} />} sub={`Mean ${formatGBP(agent.latest.mean)}`} />
              <StatCard
                label="90-day trend"
                value={<TrendArrow trend={agent.trend} pct={pct} />}
                sub="Rolling 3-month comparison"
              />
            </div>

            <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <h2 className="text-base font-semibold text-text-primary">Closing Balance — Rolling 12 Months</h2>
                <div className="flex items-center gap-3">
                  <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
                    <button
                      onClick={() => setView("12months")}
                      className={`px-3 py-1.5 ${view === "12months" ? "text-white" : "text-text-secondary"}`}
                      style={{ background: view === "12months" ? "var(--navy)" : "white" }}
                    >
                      12 months
                    </button>
                    <button
                      onClick={() => setView("3months")}
                      className={`border-l border-border px-3 py-1.5 ${view === "3months" ? "text-white" : "text-text-secondary"}`}
                      style={{ background: view === "3months" ? "var(--navy)" : "white" }}
                    >
                      3 months
                    </button>
                    <button
                      onClick={() => setView("all")}
                      className={`border-l border-border px-3 py-1.5 ${view === "all" ? "text-white" : "text-text-secondary"}`}
                      style={{ background: view === "all" ? "var(--navy)" : "white" }}
                    >
                      All history
                    </button>
                    <button
                      onClick={() => setView("month")}
                      className={`border-l border-border px-3 py-1.5 ${view === "month" ? "text-white" : "text-text-secondary"}`}
                      style={{ background: view === "month" ? "var(--navy)" : "white" }}
                    >
                      This month
                    </button>
                  </div>
                </div>
              </div>
              <div className="mb-3"><ChartLegend /></div>
              <BollingerChart
                data={view === "all" ? agent.series : view === "12months" ? twelveMonthSeries : view === "3months" ? threeMonthSeries : monthSeries}
                height={360}
                showWdAxis={view === "month"}
                agentName={agent.agentName}
              />
            </section>

            {(agent.status === "above" || agent.status === "below") && (
              <ReviewSection agent={agent} />
            )}


            <section className="rounded-lg border border-border bg-card shadow-sm">
              <button
                onClick={() => setShowRaw((s) => !s)}
                className="flex w-full items-center justify-between px-5 py-3 text-left"
              >
                <span className="text-sm font-semibold text-text-primary">View raw data</span>
                <span className="text-text-secondary">{showRaw ? "▾" : "▸"}</span>
              </button>
              {showRaw && (
                <div className="max-h-[420px] overflow-auto border-t border-border">
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[26%]" />
                      <col className="w-[22%]" />
                      <col className="w-[30%]" />
                    </colgroup>
                    <thead className="sticky top-0 bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                      <tr>
                        <th className="px-5 py-2.5">Date</th>
                        <th className="px-5 py-2.5 text-right">Closing balance</th>
                        <th className="px-5 py-2.5">Band status</th>
                        <th className="px-5 py-2.5 text-right">Variance from mean</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...agent.series].reverse().map((p) => {
                        const status = p.breakout === "above" ? "above" : p.breakout === "below" ? "below" : "within";
                        const variance = p.balance - p.mean;
                        return (
                          <tr key={p.date} className="border-t border-border">
                            <td className="px-5 py-2">{format(parseISO(p.date), "dd MMM yyyy")}</td>
                            <td className="px-5 py-2 text-right tabular-nums">{formatGBP(p.balance)}</td>
                            <td className="px-5 py-2"><StatusPill status={status as "within" | "above" | "below"} /></td>
                            <td className="px-5 py-2 text-right tabular-nums" style={{ color: variance >= 0 ? "#27AE60" : "#E74C3C" }}>
                              {variance >= 0 ? "+" : ""}{formatGBP(variance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

type AgentLike = NonNullable<ReturnType<typeof useDashboardData>["agents"][number]>;

function ReviewSection({ agent }: { agent: AgentLike }) {
  const today = new Date().toISOString().slice(0, 10);
  const info = breakoutInfo(agent.series);
  const isHigh = agent.status === "above";
  const alertType: JoEntry["alertType"] = isHigh ? "above_band" : "below_band";
  const variancePct = info?.pct ?? 0;
  const id = `jo-${today}-${agent.platformId}-${agent.agentId}-band`;

  const [entry, setEntry] = useState<JoEntry | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(true);

  useEffect(() => {
    const existing = getJoEntries().find((e) => e.id === id);
    if (existing) {
      setEntry(existing);
      setReason(existing.reason);
      setNotes(existing.notes);
      setEditing(existing.action === "");
    } else {
      setEntry(null);
      setReason("");
      setNotes("");
      setEditing(true);
    }
  }, [id]);

  const reasons = isHigh ? HIGH_REASONS : LOW_REASONS;
  const showNotes = reason === "Other" || reason === "Potential fraud";

  function buildEntry(): JoEntry {
    return entry ?? {
      id, date: today,
      agentId: agent.agentId, agentName: agent.agentName,
      platformId: agent.platformId, platformName: agent.platformName,
      alertType, balance: agent.latest.balance, variancePct,
      reason: "", notes: "", action: "", passedToCarl: false,
    };
  }

  function persist(updated: JoEntry) {
    const all = getJoEntries().filter((e) => e.id !== updated.id);
    saveJoEntries([...all, updated]);
    setEntry(updated);
  }

  function handleEscalate() {
    const updated: JoEntry = {
      ...buildEntry(), reason, notes,
      action: "escalate_carl", passedToCarl: true,
      passedToCarlAt: new Date().toISOString(),
    };
    persist(updated);
    escalateToCarl(updated);
    setEditing(false);
  }

  function handleNoAction() {
    const updated: JoEntry = {
      ...buildEntry(), reason, notes,
      action: "no_action", passedToCarl: false,
    };
    persist(updated);
    setEditing(false);
  }

  const borderColor = !editing
    ? entry?.action === "no_action" ? "#27AE60" : "#2E7D8A"
    : isHigh ? "#C8773A" : "#E74C3C";

  const varianceText = `${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(1)}%`;

  return (
    <section
      className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-text-primary">Review this alert</h2>
          <span style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500,
            background: isHigh ? "rgba(200,119,58,0.13)" : "rgba(231,76,60,0.12)",
            color: isHigh ? "#C8773A" : "#E74C3C",
          }}>
            {alertTypeLabel(alertType)} · {varianceText}
          </span>
        </div>
        {!editing && entry && (
          <span style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500,
            background: entry.action === "no_action" ? "rgba(39,174,96,0.12)" : "rgba(46,125,138,0.12)",
            color: entry.action === "no_action" ? "#1E8449" : "#2E7D8A",
          }}>
            {entry.action === "no_action" ? "No action required" : "Escalated to Carl"}
          </span>
        )}
      </div>

      {editing ? (
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full max-w-md border border-border rounded px-3 py-1.5 text-sm bg-card text-text-primary"
            >
              <option value="">Select reason…</option>
              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {showNotes && (
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes…"
                className="w-full border border-border rounded px-3 py-2 text-sm bg-card text-text-primary resize-y"
              />
            </div>
          )}

          {reason && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleNoAction}
                className="text-xs px-4 py-2 rounded border border-border hover:bg-secondary transition"
              >
                No action required
              </button>
              <button
                onClick={handleEscalate}
                disabled={showNotes && !notes.trim()}
                className="text-xs px-4 py-2 rounded text-white font-medium disabled:opacity-40"
                style={{ background: "#1B2E4B" }}
              >
                Escalate to Carl
              </button>
            </div>
          )}
        </div>
      ) : entry ? (
        <div className="px-5 py-4 flex items-start justify-between gap-4">
          <div className="text-sm">
            <div><span className="text-text-secondary text-xs">Reason: </span>{entry.reason || "—"}</div>
            {entry.notes && (
              <div className="mt-1"><span className="text-text-secondary text-xs">Notes: </span>{entry.notes}</div>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs hover:underline"
            style={{ color: "var(--teal)" }}
          >
            Edit
          </button>
        </div>
      ) : null}
    </section>
  );
}

