import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useDashboardData } from "@/data/useDashboardData";
import { TopNav } from "@/components/TopNav";
import { BollingerChart, ChartLegend } from "@/components/BollingerChart";
import { StatusPill, TrendArrow } from "@/components/StatusPill";
import { formatGBP } from "@/lib/format";
import { trendPercentChange } from "@/data/bollinger";

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
  const [view, setView] = useState<"all" | "month">("all");
  const [showRaw, setShowRaw] = useState(false);

  const agent = data.agents.find((a) => a.platformId === platformId && a.agentId === agentId);
  const platform = data.platforms.find((p) => p.id === platformId);

  const monthSeries = useMemo(() => {
    if (!agent) return [];
    const currentMonth = agent.series[agent.series.length - 1]?.date.slice(0, 7);
    return agent.series.filter((p) => p.date.startsWith(currentMonth ?? ""));
  }, [agent]);

  const pct = agent ? trendPercentChange(agent.raw, 90) : 0;

  return (
    <div className="min-h-screen bg-surface">
      <TopNav lastUpdated={data.lastUpdated} />
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
              <StatCard label="Band status" value={<StatusPill status={agent.status} />} sub={`Mean ${formatGBP(agent.latest.mean)}`} />
              <StatCard
                label="90-day trend"
                value={<TrendArrow trend={agent.trend} pct={pct} />}
                sub="Rolling 90-day average"
              />
            </div>

            <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <h2 className="text-base font-semibold text-text-primary">Closing Balance — Rolling 12 Months</h2>
                <div className="flex items-center gap-3">
                  <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
                    <button
                      onClick={() => setView("all")}
                      className={`px-3 py-1.5 ${view === "all" ? "text-white" : "text-text-secondary"}`}
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
                data={view === "all" ? agent.series : monthSeries}
                height={360}
                showWdAxis={view === "month"}
                agentName={agent.agentName}
              />
            </section>

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
