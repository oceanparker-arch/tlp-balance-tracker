import { createFileRoute, Link } from "@tanstack/react-router";
import { useDashboardData } from "@/data/useDashboardData";
import { TopNav } from "@/components/TopNav";
import { BollingerChart } from "@/components/BollingerChart";
import { Sparkline } from "@/components/Sparkline";
import { PlatformBadge, StatusPill, TrendArrow } from "@/components/StatusPill";
import { formatGBP } from "@/lib/format";

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

function Dashboard() {
  const data = useDashboardData();

  const trendDownAgents = data.loading ? [] : data.agents.filter((a) => a.trend === "down");

  return (
    <div className="min-h-screen bg-surface">
      <TopNav lastUpdated={data.lastUpdated} />
      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">

        {/* Section 1: Master Bollinger Chart */}
        <section className="relative rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text-primary">TLP Aggregate Client Account Balance</h2>
          </div>

          {data.loading ? <Skeleton className="h-[320px]" /> : <BollingerChart data={data.aggregate} height={320} />}
        </section>

        {/* Section 2: Breakout Alerts */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">Breakout Alerts</h2>
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold text-white"
              style={{ background: "var(--tlp-red)" }}
            >
              {data.loading ? "…" : data.breakouts.length}
            </span>
          </div>
          {data.loading ? (
            <Skeleton className="h-32" />
          ) : data.breakouts.length === 0 ? (
            <div
              className="rounded-md border px-4 py-6 text-sm"
              style={{ background: "rgba(39,174,96,0.08)", borderColor: "rgba(39,174,96,0.25)", color: "#1d8049" }}
            >
              ✓ All accounts within expected range — no breakouts detected.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-2">Agent</th>
                    <th className="px-4 py-2">Platform</th>
                    <th className="px-4 py-2 text-right">Closing balance</th>
                    <th className="px-4 py-2">Breakout</th>
                  </tr>
                </thead>
                <tbody>
                  {data.breakouts.slice(0, 10).map((a) => (
                    <tr
                      key={`${a.platformId}-${a.agentId}`}
                      className="border-t border-border"
                      style={{ borderLeft: "3px solid var(--tlp-red)" }}
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          to="/agent/$platformId/$agentId"
                          params={{ platformId: a.platformId, agentId: a.agentId }}
                          className="font-semibold hover:underline"
                          style={{ color: "var(--teal)" }}
                        >
                          {a.agentName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5"><PlatformBadge name={a.platformName} /></td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatGBP(a.latest.balance)}</td>
                      <td className="px-4 py-2.5">
                        {a.status === "above" ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "rgba(200,119,58,0.13)", color: "#C8773A" }}>↑ Above upper</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "rgba(231,76,60,0.12)", color: "#E74C3C" }}>↓ Below lower</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.breakouts.length > 10 && (
                <div className="border-t border-border bg-secondary px-4 py-2 text-right text-xs">
                  <a href="#" className="font-medium hover:underline" style={{ color: "var(--teal)" }}>View all →</a>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section 3: Trend Down Alerts */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">Trending Down (90 days)</h2>
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold text-white"
              style={{ background: "#C8773A" }}
            >
              {data.loading ? "…" : trendDownAgents.length}
            </span>
          </div>
          {data.loading ? (
            <Skeleton className="h-32" />
          ) : trendDownAgents.length === 0 ? (
            <div
              className="rounded-md border px-4 py-6 text-sm"
              style={{ background: "rgba(39,174,96,0.08)", borderColor: "rgba(39,174,96,0.25)", color: "#1d8049" }}
            >
              ✓ No accounts showing a sustained downward trend over the last 90 days.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-2">Agent</th>
                    <th className="px-4 py-2">Platform</th>
                    <th className="px-4 py-2 text-right">Closing balance</th>
                    <th className="px-4 py-2">Band status</th>
                  </tr>
                </thead>
                <tbody>
                  {trendDownAgents.slice(0, 10).map((a) => (
                    <tr
                      key={`${a.platformId}-${a.agentId}`}
                      className="border-t border-border"
                      style={{ borderLeft: "3px solid #C8773A" }}
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          to="/agent/$platformId/$agentId"
                          params={{ platformId: a.platformId, agentId: a.agentId }}
                          className="font-semibold hover:underline"
                          style={{ color: "var(--teal)" }}
                        >
                          {a.agentName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5"><PlatformBadge name={a.platformName} /></td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatGBP(a.latest.balance)}</td>
                      <td className="px-4 py-2.5"><StatusPill status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {trendDownAgents.length > 10 && (
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
              {data.platforms.map((p) => (
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
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xl font-bold text-text-primary hover:underline">{p.name}</div>
                      <div className="text-xs text-text-secondary">{p.agents.length} agents</div>
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-semibold tabular-nums text-text-primary">
                    {formatGBP(p.latest.balance)}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <StatusPill status={p.status} />
                    <TrendArrow trend={p.trend} label="90d" />
                  </div>
                  <div className="mt-3">
                    <Sparkline
                      data={p.raw}
                      color={p.status === "within" ? "#2E7D8A" : p.status === "above" ? "#C8773A" : "#E74C3C"}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
