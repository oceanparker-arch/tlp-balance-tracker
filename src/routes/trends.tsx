import { createFileRoute, Link } from "@tanstack/react-router";
import React from "react";
import { useDashboardData } from "@/data/useDashboardData";
import { TopNav } from "@/components/TopNav";
import { formatGBP } from "@/lib/format";
import { trendPercentChange } from "@/data/bollinger";
import { PlatformBadge, TrendArrow } from "@/components/StatusPill";
import { LiveBadge } from "@/components/LiveBadge";

export const Route = createFileRoute("/trends")({
  head: () => ({ meta: [{ title: "Trend Alerts · TLP Monitor" }] }),
  component: TrendsPage,
});

function TrendsPage() {
  const data = useDashboardData();

  const agentsWithTrend = React.useMemo(() =>
    data.loading ? [] : data.agents.map(a => ({ ...a, trendPct: trendPercentChange(a.raw) })),
    [data.agents, data.loading]
  );

  const trendAlerts = React.useMemo(() =>
    agentsWithTrend.filter(a => a.trend === "down" && a.latest.mean >= 25000 && a.trendPct <= -15)
      .sort((a, b) => a.trendPct - b.trendPct),
    [agentsWithTrend]
  );

  const trendUpAlerts = React.useMemo(() =>
    agentsWithTrend.filter(a => a.trend === "up" && a.latest.mean >= 25000 && a.trendPct >= 15)
      .sort((a, b) => b.trendPct - a.trendPct),
    [agentsWithTrend]
  );

  function AgentRow({ a, color }: { a: typeof trendAlerts[0]; color: string }) {
    return (
      <tr className="border-t border-border" style={{ borderLeft: `3px solid ${color}` }}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Link
              to="/agent/$platformId/$agentId"
              params={{ platformId: a.platformId, agentId: a.agentId }}
              target="_blank"
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
        <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{formatGBP(a.latest.mean)}</td>
        <td className="px-4 py-3">
          <span className="text-sm font-semibold" style={{ color }}>
            {a.trendPct >= 0 ? "↗" : "↘"} {Math.abs(a.trendPct).toFixed(1)}%
          </span>
          <span className="text-xs text-text-secondary ml-1">(3M)</span>
        </td>
      </tr>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <TopNav lastUpdated={data.lastUpdated} usingLiveData={data.usingLiveData} />
      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Trend Alerts</h1>
          <p className="text-sm text-text-secondary mt-0.5">3-month rolling comparison — second Wednesday anchor method</p>
        </div>

        {/* Trending Down */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-base font-semibold text-text-primary">Trending Down</h2>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold text-white" style={{ background: "#E74C3C" }}>
              {data.loading ? "…" : trendAlerts.length}
            </span>
            <span className="text-xs text-text-secondary">Mean ≥ £25k · Drop ≥ 15%</span>
          </div>
          {data.loading ? (
            <div className="animate-pulse rounded-md bg-muted h-24" />
          ) : trendAlerts.length === 0 ? (
            <div className="rounded-md border px-4 py-6 text-sm" style={{ background: "rgba(39,174,96,0.08)", borderColor: "rgba(39,174,96,0.25)", color: "#1d8049" }}>
              ✓ No accounts showing a significant downward trend.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full table-fixed text-sm">
                <colgroup><col className="w-[28%]" /><col className="w-[16%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[20%]" /></colgroup>
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-2.5">Agent</th>
                    <th className="px-4 py-2.5">Platform</th>
                    <th className="px-4 py-2.5 text-right">Balance</th>
                    <th className="px-4 py-2.5 text-right">Mean</th>
                    <th className="px-4 py-2.5">3-month trend</th>
                  </tr>
                </thead>
                <tbody>
                  {trendAlerts.map(a => <AgentRow key={`${a.platformId}-${a.agentId}`} a={a} color="#E74C3C" />)}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Trending Up */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-base font-semibold text-text-primary">Trending Up</h2>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold text-white" style={{ background: "#27AE60" }}>
              {data.loading ? "…" : trendUpAlerts.length}
            </span>
            <span className="text-xs text-text-secondary">Mean ≥ £25k · Rise ≥ 15%</span>
          </div>
          {data.loading ? (
            <div className="animate-pulse rounded-md bg-muted h-24" />
          ) : trendUpAlerts.length === 0 ? (
            <div className="rounded-md border px-4 py-6 text-sm" style={{ background: "rgba(39,174,96,0.08)", borderColor: "rgba(39,174,96,0.25)", color: "#1d8049" }}>
              ✓ No accounts showing a significant upward trend.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full table-fixed text-sm">
                <colgroup><col className="w-[28%]" /><col className="w-[16%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[20%]" /></colgroup>
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-2.5">Agent</th>
                    <th className="px-4 py-2.5">Platform</th>
                    <th className="px-4 py-2.5 text-right">Balance</th>
                    <th className="px-4 py-2.5 text-right">Mean</th>
                    <th className="px-4 py-2.5">3-month trend</th>
                  </tr>
                </thead>
                <tbody>
                  {trendUpAlerts.map(a => <AgentRow key={`${a.platformId}-${a.agentId}`} a={a} color="#27AE60" />)}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
