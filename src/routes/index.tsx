import { createFileRoute, Link } from "@tanstack/react-router";
import { useDashboardData } from "@/data/useDashboardData";
import { TopNav } from "@/components/TopNav";
import { BollingerChart } from "@/components/BollingerChart";
import { Sparkline } from "@/components/Sparkline";
import { PlatformBadge, StatusPill, TrendArrow } from "@/components/StatusPill";
import { LiveBadge } from "@/components/LiveBadge";
import { formatGBP } from "@/lib/format";
import { trendPercentChange, breakoutInfo } from "@/data/bollinger";

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

function Dashboard() {
  const data = useDashboardData();
  // Trend alerts: trending down only, sorted by steepest % drop
  const trendAlerts = data.loading
    ? []
    : data.agents
        .filter((a) => a.trend === "down")
        .map((a) => ({ ...a, trendPct: trendPercentChange(a.raw, 90) }))
        .sort((a, b) => a.trendPct - b.trendPct); // most negative first

  // Breakout alerts sorted by biggest % outside band
  const sortedBreakouts = data.loading
    ? []
    : [...data.breakouts].sort((a, b) => (b.breakoutPct ?? 0) - (a.breakoutPct ?? 0));

  const aggLatest = data.aggregateLatest;
  const aggPct = data.loading ? 0 : trendPercentChange(data.aggregate, 90);
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
      <TopNav lastUpdated={data.lastUpdated} />
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
                sub="Rolling 90-day avg"
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
                  <col className="w-[28%]" />
                  <col className="w-[16%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                  <col className="w-[16%]" />
                </colgroup>
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-2.5">Agent</th>
                    <th className="px-4 py-2.5">Platform</th>
                    <th className="px-4 py-2.5 text-right">Closing balance</th>
                    <th className="px-4 py-2.5">Breakout</th>
                    <th className="px-4 py-2.5 text-right">Band boundary</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBreakouts.slice(0, 10).map((a) => (
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
                      <td className="px-4 py-3">
                        <StatusPill status={a.status} pct={a.breakoutPct ?? undefined} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-secondary text-xs">
                        {a.breakoutBoundary != null ? (
                          <div>
                            <div className="text-[10px] text-text-secondary">{a.breakoutBoundaryLabel}</div>
                            <div className="font-medium text-text-primary">{formatGBP(a.breakoutBoundary)}</div>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedBreakouts.length > 10 && (
                <div className="border-t border-border bg-secondary px-4 py-2 text-right text-xs">
                  <a href="#" className="font-medium hover:underline" style={{ color: "var(--teal)" }}>View all →</a>
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
                  {trendAlerts.slice(0, 10).map((a) => (
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
                  <a href="#" className="font-medium hover:underline" style={{ color: "var(--teal)" }}>View all →</a>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section 4: Platform overview */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Platform Overview</h2>
          {data.loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.platforms.map((p) => {
                const pct = trendPercentChange(p.raw, 90);
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
                      <TrendArrow trend={p.trend} pct={pct} label="90d" />
                    </div>
                    {/* Show boundary if in breakout */}
                    {pBI && (
                      <div className="mt-1 text-xs text-text-secondary">
                        {pBI.boundaryLabel}: {formatGBP(pBI.boundary)}
                      </div>
                    )}
                    <div className="mt-3">
                      <Sparkline
                        data={p.raw}
                        color={p.status === "within" ? "#2E7D8A" : p.status === "above" ? "#C8773A" : "#E74C3C"}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
