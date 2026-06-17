import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDashboardData } from "@/data/useDashboardData";
import { TopNav } from "@/components/TopNav";
import { BollingerChart, ChartLegend } from "@/components/BollingerChart";

import { StatusPill, TrendArrow } from "@/components/StatusPill";
import { formatGBP } from "@/lib/format";
import { trendPercentChange, breakoutInfo } from "@/data/bollinger";

export const Route = createFileRoute("/platform/$platformId")({
  head: () => ({
    meta: [{ title: "Platform Overview · TLP Monitor" }],
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
      <TopNav lastUpdated={data.lastUpdated} usingLiveData={data.usingLiveData} />
      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        <Link to="/" className="text-sm font-medium hover:underline" style={{ color: "var(--teal)" }}>← Dashboard</Link>

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
                <h2 className="text-base font-semibold text-text-primary">{platform.name} Combined Balance — Rolling 12 Months</h2>
                <div className="flex items-center gap-3">
                  <StatusPill status={platform.status} pct={(() => { const bi = breakoutInfo(platform.series); return bi?.pct; })()} />
                  <TrendArrow trend={platform.trend} pct={trendPercentChange(platform.raw, 90)} label="90d" />
                </div>
              </div>
              <div className="mb-3"><ChartLegend /></div>
              <BollingerChart data={platform.series} height={280} agentName={platform.name} />
            </section>

            <section className="rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-base font-semibold text-text-primary">Agents</h2>
                <button onClick={() => setSortDesc((d) => !d)} className="text-xs font-medium hover:underline" style={{ color: "var(--teal)" }}>
                  Sort by balance {sortDesc ? "↓" : "↑"}
                </button>
              </div>
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[22%]" />
                  <col className="w-[20%]" />
                  <col className="w-[30%]" />
                </colgroup>
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-5 py-2.5">Agent</th>
                    <th className="px-5 py-2.5 text-right">Closing balance</th>
                    <th className="px-5 py-2.5">Band status</th>
                    <th className="px-5 py-2.5">90-day trend</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map((a) => {
                    const pct = trendPercentChange(a.raw, 90);
                    return (
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
                        <td className="px-5 py-3"><StatusPill status={a.status} pct={a.breakoutPct ?? undefined} /></td>
                        <td className="px-5 py-3">
                          <TrendArrow trend={a.trend} pct={pct} label="90d" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
