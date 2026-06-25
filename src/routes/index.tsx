import React from "react";
import ReactDOM from "react-dom";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useDashboardData } from "@/data/useDashboardData";
import { TopNav } from "@/components/TopNav";
import { BollingerChart } from "@/components/BollingerChart";

import { PlatformBadge, StatusPill, TrendArrow } from "@/components/StatusPill";
import { LiveBadge } from "@/components/LiveBadge";
import { formatGBP } from "@/lib/format";
import { trendPercentChange, breakoutInfo } from "@/data/bollinger";
import { HIGH_REASONS, LOW_REASONS, getJoEntries, saveJoEntries, escalateToCarl, type JoEntry } from "@/data/reportingData";





// ── Review Modal ─────────────────────────────────────────────────────────────
interface ReviewModalProps {
  agent: { platformId: string; agentId: string; agentName: string; platformName: string; latest: { balance: number }; status: string; breakoutPct?: number | null; };
  onClose: () => void;
  onDone: (entry: JoEntry) => void;
}

function ReviewModal({ agent, onClose, onDone }: ReviewModalProps) {
  if (!agent) return null;
  const [reason, setReason] = React.useState("");
  const [notes, setNotes]   = React.useState("");
  const today    = new Date().toISOString().slice(0, 10);
  const isHigh   = agent.status === "above";
  const reasons  = isHigh ? HIGH_REASONS : LOW_REASONS;
  const showNotes = reason === "Other" || reason === "Potential fraud";
  const entryId  = `jo-${today}-${agent.platformId}-${agent.agentId}-band`;

  function buildEntry(action: "escalate_carl" | "no_action"): JoEntry {
    return {
      id: entryId, date: today,
      agentId: agent.agentId, agentName: agent.agentName,
      platformId: agent.platformId, platformName: agent.platformName,
      alertType: isHigh ? "above_band" : "below_band",
      balance: agent.latest.balance, variancePct: agent.breakoutPct ?? 0,
      reason, notes, action, passedToCarl: action === "escalate_carl",
      passedToCarlAt: action === "escalate_carl" ? new Date().toISOString() : undefined,
    };
  }

  function handleEscalate() {
    const entry = buildEntry("escalate_carl");
    const existing = getJoEntries().filter(e => e.id !== entryId);
    saveJoEntries([...existing, entry]);
    escalateToCarl(entry);
    onDone(entry);
  }

  function handleNoAction() {
    const entry = buildEntry("no_action");
    const existing = getJoEntries().filter(e => e.id !== entryId);
    saveJoEntries([...existing, entry]);
    onDone(entry);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#ffffff", borderRadius: 12, border: "0.5px solid #e5e7eb", width: "100%", maxWidth: 520, boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#111" }}>{agent.agentName}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              {agent.platformName} · {isHigh ? "↑ Above band" : "↓ Below band"} · {agent.breakoutPct != null ? `${agent.breakoutPct >= 0 ? "+" : ""}${agent.breakoutPct.toFixed(1)}%` : ""}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#666", lineHeight: 1, padding: "4px 8px" }}>×</button>
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>Reason</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 10px", fontSize: 13, background: "#fff", color: "#111" }}
            >
              <option value="">Select reason…</option>
              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {showNotes && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add notes…"
                rows={3}
                style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 10px", fontSize: 13, background: "#fff", color: "#111", resize: "vertical", boxSizing: "border-box" as const }}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{ fontSize: 13, padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "none", cursor: "pointer", color: "#111" }}
            >
              Cancel
            </button>
            <button
              onClick={handleNoAction}
              disabled={!reason}
              style={{ fontSize: 13, padding: "8px 16px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "none", cursor: "pointer", color: "var(--color-text-primary)", opacity: reason ? 1 : 0.4 }}
            >
              No action required
            </button>
            <button
              onClick={handleEscalate}
              disabled={!reason || (showNotes && !notes.trim())}
              style={{ fontSize: 13, padding: "8px 16px", borderRadius: 6, border: "none", background: "#1B2E4B", color: "white", cursor: "pointer", opacity: (!reason || (showNotes && !notes.trim())) ? 0.4 : 1 }}
            >
              Escalate to Carl
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")(({
  head: () => ({
    meta: [
      { title: "TLP Client Account Monitor" },
      { name: "description", content: "Internal dashboard monitoring client account balances across letting platforms with Bollinger band alerting." },
    ],
  }),
  component: Dashboard,
}));

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-text-secondary">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-text-primary">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-secondary">{sub}</div>}
    </div>
  );
}

interface DashboardContentProps {
  onReview: (agent: { platformId: string; agentId: string; agentName: string; platformName: string; latest: { balance: number }; status: string; breakoutPct?: number | null }) => void;
  doneIds: Record<string, "no_action" | "escalate_carl">;
}

const DashboardContent = React.memo(function DashboardContent({ onReview, doneIds }: DashboardContentProps) {
  const data = useDashboardData();
  const [showAllBreakouts, setShowAllBreakouts] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const [showAllTrends, setShowAllTrends] = React.useState(false);
  const [showAllTrendUp, setShowAllTrendUp] = React.useState(false);

  // Pre-calculate trendPct for all agents once - avoids recalculating per render
  const agentsWithTrend = React.useMemo(() =>
    data.loading ? [] : data.agents.map(a => ({ ...a, trendPct: trendPercentChange(a.raw) })),
    [data.agents, data.loading]
  );

  const trendAlerts = React.useMemo(() =>
    agentsWithTrend
      .filter((a) => a.trend === "down" && a.latest.mean >= 25000 && a.trendPct <= -15)
      .sort((a, b) => a.trendPct - b.trendPct),
    [agentsWithTrend]
  );

  const trendUpAlerts = React.useMemo(() =>
    agentsWithTrend
      .filter((a) => a.trend === "up" && a.latest.mean >= 25000 && a.trendPct >= 15)
      .sort((a, b) => b.trendPct - a.trendPct),
    [agentsWithTrend]
  );

  // Breakout alerts sorted by biggest % outside band
  const sortedBreakouts = data.loading
    ? []
    : [...data.breakouts].sort((a, b) => (b.breakoutPct ?? 0) - (a.breakoutPct ?? 0));

  const aggLatest = data.aggregateLatest;
  const aggPct = data.loading ? 0 : trendPercentChange(data.aggregate);
  const aggTrend = aggPct > 5 ? "up" : aggPct < -5 ? "down" : "flat";
  const aggBreakout = data.loading ? null : breakoutInfo(data.aggregate);

  // Band status sub label for main stat card
  const bandSub = aggLatest
    ? aggBreakout
      ? `${aggBreakout.boundaryLabel}: ${formatGBP(aggBreakout.boundary)}`
      : `Mean ${formatGBP(aggLatest.mean)}`
    : null;

  return (
    <div className="min-h-screen bg-surface">
      <TopNav lastUpdated={data.lastUpdated} usingLiveData={data.usingLiveData} />
      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">

        {/* Section 1: Master Bollinger Chart */}
        <section className="relative rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <h2 className="text-lg font-semibold text-text-primary">TLP Aggregate Client Account Balance</h2>
            <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
              Rolling 12 months
            </span>
          </div>

          {data.loading ? (
            <Skeleton className="h-20 mb-4" />
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-4">
              <StatCard label="Total balance" value={formatGBP(aggLatest?.balance ?? 0)} />
              <StatCard
                label="Band status"
                value={
                  <StatusPill
                    status={aggLatest?.breakout === "above" ? "above" : aggLatest?.breakout === "below" ? "below" : "within"}
                    pct={aggBreakout?.pct}
                  />
                }
                sub={bandSub}
              />
              <StatCard
                label="90-day trend"
                value={<TrendArrow trend={aggTrend} pct={aggPct} />}
                sub="Rolling 3-month comparison"
              />
              <StatCard
                label="Platforms"
                value={`${data.platforms.length}`}
                sub={`${data.agents.length} agents total`}
              />
            </div>
          )}

          {data.loading ? <Skeleton className="h-[320px]" /> : (
            <BollingerChart data={data.aggregate} height={320} agentName="tlp-aggregate" />
          )}
        </section>

        {/* Section 2: Breakout Alerts — sorted by biggest % breakout */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">Breakout Alerts</h2>
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold text-white"
              style={{ background: "var(--tlp-red)" }}
            >
              {data.loading ? "…" : sortedBreakouts.length}
            </span>
          </div>
          {data.loading ? (
            <Skeleton className="h-32" />
          ) : sortedBreakouts.length === 0 ? (
            <div
              className="rounded-md border px-4 py-6 text-sm"
              style={{ background: "rgba(39,174,96,0.08)", borderColor: "rgba(39,174,96,0.25)", color: "#1d8049" }}
            >
              ✓ All accounts within expected range — no breakouts detected.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[13%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-2.5">Agent</th>
                    <th className="px-4 py-2.5">Platform</th>
                    <th className="px-4 py-2.5 text-right">Closing balance</th>
                    <th className="px-4 py-2.5 text-right">Band limit</th>
                    <th className="px-4 py-2.5">Breakout</th>
                    <th className="px-4 py-2.5 text-right">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllBreakouts ? sortedBreakouts : sortedBreakouts.slice(0, 10)).map((a) => (
                    <tr
                      key={`${a.platformId}-${a.agentId}`}
                      className="border-t border-border"
                      style={{ borderLeft: "3px solid var(--tlp-red)" }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            to="/agent/$platformId/$agentId"
                            params={{ platformId: a.platformId, agentId: a.agentId }}
                            className="font-semibold hover:underline truncate"
                            style={{ color: "var(--teal)" }}
                          >
                            {a.agentName}
                          </Link>
                          {a.isLive && <LiveBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-3"><PlatformBadge name={a.platformName} /></td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatGBP(a.latest.balance)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                        {a.breakoutBoundary != null ? (
                          <>
                            <span className="text-[11px] uppercase tracking-wide mr-1">{a.breakoutBoundaryLabel}:</span>
                            {formatGBP(a.breakoutBoundary)}
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={a.status} pct={a.breakoutPct ?? undefined} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const eid = `jo-${today}-${a.platformId}-${a.agentId}-band`;
                          const done = doneIds[eid];
                          return done ? (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: done === "no_action" ? "rgba(39,174,96,0.12)" : "rgba(46,125,138,0.12)", color: done === "no_action" ? "#1E8449" : "#2E7D8A" }}>
                              {done === "no_action" ? "No action" : "→ Carl"}
                            </span>
                          ) : (
                            <button
                              onClick={() => onReview({ platformId: a.platformId, agentId: a.agentId, agentName: a.agentName, platformName: a.platformName, latest: a.latest, status: a.status, breakoutPct: a.breakoutPct })}
                              className="text-xs px-3 py-1 rounded border border-border hover:bg-secondary transition font-medium"
                              style={{ color: "var(--teal)" }}
                            >
                              Review
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedBreakouts.length > 10 && (
                <div className="border-t border-border bg-secondary px-4 py-2 text-right text-xs">
                  <button onClick={() => setShowAllBreakouts(s => !s)} className="font-medium hover:underline" style={{ color: "var(--teal)" }}>
                    {showAllBreakouts ? "Show less ↑" : `View all ${sortedBreakouts.length} →`}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section 3: Trend Alerts — trending down, sorted by steepest drop, within band only */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">Trend Alerts</h2>
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold text-white"
              style={{ background: "#C8773A" }}
            >
              {data.loading ? "…" : trendAlerts.length}
            </span>
          </div>
          {data.loading ? (
            <Skeleton className="h-32" />
          ) : trendAlerts.length === 0 ? (
            <div
              className="rounded-md border px-4 py-6 text-sm"
              style={{ background: "rgba(39,174,96,0.08)", borderColor: "rgba(39,174,96,0.25)", color: "#1d8049" }}
            >
              ✓ No accounts showing a sustained downward trend over the last 90 days.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[20%]" />
                  <col className="w-[25%]" />
                  <col className="w-[25%]" />
                </colgroup>
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-2.5">Agent</th>
                    <th className="px-4 py-2.5">Platform</th>
                    <th className="px-4 py-2.5 text-right">Closing balance</th>
                    <th className="px-4 py-2.5">90-day trend</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllTrends ? trendAlerts : trendAlerts.slice(0, 10)).map((a) => (
                    <tr
                      key={`${a.platformId}-${a.agentId}`}
                      className="border-t border-border"
                      style={{ borderLeft: "3px solid #C8773A" }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            to="/agent/$platformId/$agentId"
                            params={{ platformId: a.platformId, agentId: a.agentId }}
                            className="font-semibold hover:underline truncate"
                            style={{ color: "var(--teal)" }}
                          >
                            {a.agentName}
                          </Link>
                          {a.isLive && <LiveBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-3"><PlatformBadge name={a.platformName} /></td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatGBP(a.latest.balance)}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold" style={{ color: "#E74C3C" }}>
                          ↘ {Math.abs(a.trendPct).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {trendAlerts.length > 10 && (
                <div className="border-t border-border bg-secondary px-4 py-2 text-right text-xs">
                  <button onClick={() => setShowAllTrends(s => !s)} className="font-medium hover:underline" style={{ color: "var(--teal)" }}>
                    {showAllTrends ? "Show less ↑" : `View all ${trendAlerts.length} →`}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section 4: Trend Up Alerts */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">Trending Up (3 months)</h2>
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold text-white"
              style={{ background: "#27AE60" }}
            >
              {data.loading ? "…" : trendUpAlerts.length}
            </span>
          </div>
          {data.loading ? (
            <div className="animate-pulse rounded-md bg-muted h-32" />
          ) : trendUpAlerts.length === 0 ? (
            <div
              className="rounded-md border px-4 py-6 text-sm"
              style={{ background: "rgba(39,174,96,0.08)", borderColor: "rgba(39,174,96,0.25)", color: "#1d8049" }}
            >
              ✓ No accounts showing a significant upward trend over the last 3 months.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[20%]" />
                  <col className="w-[25%]" />
                  <col className="w-[25%]" />
                </colgroup>
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-2.5">Agent</th>
                    <th className="px-4 py-2.5">Platform</th>
                    <th className="px-4 py-2.5 text-right">Closing balance</th>
                    <th className="px-4 py-2.5">3-month trend</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllTrendUp ? trendUpAlerts : trendUpAlerts.slice(0, 10)).map((a) => (
                    <tr
                      key={`${a.platformId}-${a.agentId}`}
                      className="border-t border-border"
                      style={{ borderLeft: "3px solid #27AE60" }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            to="/agent/$platformId/$agentId"
                            params={{ platformId: a.platformId, agentId: a.agentId }}
                            className="font-semibold hover:underline truncate"
                            style={{ color: "var(--teal)" }}
                          >
                            {a.agentName}
                          </Link>
                          {a.isLive && <LiveBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-3"><PlatformBadge name={a.platformName} /></td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatGBP(a.latest.balance)}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold" style={{ color: "#27AE60" }}>
                          ↗ {Math.abs(a.trendPct).toFixed(1)}%
                        </span>
                        <span className="text-xs text-text-secondary ml-1">(3M)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {trendUpAlerts.length > 10 && (
                <div className="border-t border-border bg-secondary px-4 py-2 text-right text-xs">
                  <button onClick={() => setShowAllTrendUp(s => !s)} className="font-medium hover:underline" style={{ color: "var(--teal)" }}>
                    {showAllTrendUp ? "Show less ↑" : `View all ${trendUpAlerts.length} →`}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section 5: Platform overview */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Platform Overview</h2>
          {data.loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.platforms.map((p) => {
                const pct = agentsWithTrend.find(a => a.platformId === p.id)?.trendPct ?? trendPercentChange(p.raw);
                const pBI = breakoutInfo(p.series);
                return (
                  <Link
                    key={p.id}
                    to="/platform/$platformId"
                    params={{ platformId: p.id }}
                    className="relative block rounded-lg border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
                  >
                    {p.hasBreakout && (
                      <span
                        className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full"
                        style={{ background: "var(--tlp-red)", boxShadow: "0 0 0 3px rgba(231,76,60,0.18)" }}
                      />
                    )}
                    <div className="text-xl font-bold text-text-primary hover:underline">{p.name}</div>
                    <div className="text-xs text-text-secondary mb-3">{p.agents.length} agents</div>
                    <div className="text-2xl font-semibold tabular-nums text-text-primary">
                      {formatGBP(p.latest.balance)}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <StatusPill status={p.status} pct={pBI?.pct} />
                      <TrendArrow trend={p.trend} pct={pct} label="3M" />
                    </div>
                    {/* Show boundary if in breakout */}
                    {pBI && (
                      <div className="mt-1 text-xs text-text-secondary">
                        {pBI.boundaryLabel}: {formatGBP(pBI.boundary)}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
});

function Dashboard() {
  const [reviewingAgent, setReviewingAgent] = React.useState<{
    platformId: string; agentId: string; agentName: string; platformName: string;
    latest: { balance: number }; status: string; breakoutPct?: number | null;
  } | null>(null);
  const [doneIds, setDoneIds] = React.useState<Record<string, "no_action" | "escalate_carl">>(() => {
    const existing = getJoEntries();
    const map: Record<string, "no_action" | "escalate_carl"> = {};
    for (const e of existing) if (e.action) map[e.id] = e.action as any;
    return map;
  });

  const handleReview = React.useCallback((agent: any) => setReviewingAgent(agent), []);

  return (
    <>
      <DashboardContent onReview={handleReview} doneIds={doneIds} />
      {reviewingAgent && ReactDOM.createPortal(
        <ReviewModal
          agent={reviewingAgent}
          onClose={() => setReviewingAgent(null)}
          onDone={(entry) => {
            setDoneIds(prev => ({ ...prev, [entry.id]: entry.action as any }));
            setReviewingAgent(null);
          }}
        />,
        document.body
      )}
    </>
  );
}
