import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDashboardData } from "@/data/useDashboardData";
import { TopNav } from "@/components/TopNav";
import { BollingerChart, ChartLegend } from "@/components/BollingerChart";
import { Sparkline } from "@/components/Sparkline";
import { StatusPill, TrendArrow } from "@/components/StatusPill";
import { LiveBadge } from "@/components/LiveBadge";
import { formatGBP } from "@/lib/format";

export const Route = createFileRoute("/platform/$platformId")({
  head: () => ({
    meta: [
      { title: "Platform Overview · TLP Monitor" },
      { name: "description", content: "Platform-level Bollinger band analysis of client account balances." },
    ],
  }),
  component: PlatformPage,
});

function PlatformPage() {
  const { platformId } = useParams({ from: "/platform/$platformId" });
  const data = useDashboardData();
  const [sortDesc, setSortDesc] = useState(true);

  const platform = data.platforms.find((p) => p.id === platformId);
  const sortedAgents = useMemo(() => {
    if (!platform) return [];
    return [...platform.agents].sort((a, b) =>
      sortDesc ? b.latest.balance - a.latest.balance : a.latest.balance - b.latest.balance,
    );
  }, [platform, sortDesc]);

  return (
    <div className="min-h-screen bg-surface">
      <TopNav lastUpdated={data.lastUpdated} />
      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        <div>
          <Link to="/" className="text-sm font-medium hover:underline" style={{ color: "var(--teal)" }}>← Dashboard</Link>
        </div>

        {!platform ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-text-secondary">
            {data.loading ? "Loading platform…" : "Platform not found."}
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{platform.name} — Agent Overview</h1>
              <p className="text-sm text-text-secondary">{platform.agents.length} agents · combined balance {formatGBP(platform.latest.balance)}</p>
            </div>

            <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">{platform.name} Combined Balance — Rolling 12 Months</h2>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={platform.status} />
                  <TrendArrow trend={platform.trend} label="90d" />
                </div>
              </div>
              <div className="mb-3"><ChartLegend /></div>
              <BollingerChart data={platform.series} height={280} />
            </section>

            <section className="rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-base font-semibold text-text-primary">Agents</h2>
                <button
                  onClick={() => setSortDesc((d) => !d)}
                  className="text-xs font-medium hover:underline"
                  style={{ color: "var(--teal)" }}
                >
                  Sort by balance {sortDesc ? "↓" : "↑"}
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-5 py-2">Agent</th>
                    <th className="px-5 py-2 text-right">Closing balance</th>
                    <th className="px-5 py-2">Band status</th>
                    <th className="px-5 py-2">90-day trend</th>
                    <th className="px-5 py-2 w-[140px]">12-month history</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map((a) => (
                    <tr key={a.agentId} className="border-t border-border">
                      <td className="px-5 py-3">
                        <Link
                          to="/agent/$platformId/$agentId"
                          params={{ platformId: a.platformId, agentId: a.agentId }}
                          className="font-semibold hover:underline"
                          style={{ color: "var(--teal)" }}
                        >
                          {a.agentName}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatGBP(a.latest.balance)}</td>
                      <td className="px-5 py-3"><StatusPill status={a.status} /></td>
                      <td className="px-5 py-3"><TrendArrow trend={a.trend} label="90d" /></td>
                      <td className="px-5 py-3"><div style={{ width: 120 }}><Sparkline data={a.raw} height={40} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
