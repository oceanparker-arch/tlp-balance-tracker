import { useEffect, useState } from "react";
import { getAllAgentSeries, combineSeries, platforms, type AgentSeries, type DataPoint } from "./mockData";
import { computeBollinger, trendDirection, todayStatus, breakoutInfo, type BollingerPoint } from "./bollinger";
import {
  listImportedAgents,
  onImportedAgentsChange,
  importedRowsToDataPoints,
} from "./importedAgents";

export interface AgentRecord {
  platformId: string;
  platformName: string;
  agentId: string;
  agentName: string;
  raw: DataPoint[];
  series: BollingerPoint[];
  latest: BollingerPoint;
  status: "within" | "above" | "below";
  trend: "up" | "down" | "flat";
  isLive: boolean;
  breakoutPct: number | null;
  breakoutBoundary: number | null;
  breakoutBoundaryLabel: string | null;
}

export interface PlatformRecord {
  id: string;
  name: string;
  agents: AgentRecord[];
  raw: DataPoint[];
  series: BollingerPoint[];
  latest: BollingerPoint;
  status: "within" | "above" | "below";
  trend: "up" | "down" | "flat";
  hasBreakout: boolean;
}

export interface DashboardData {
  loading: boolean;
  lastUpdated: Date;
  aggregate: BollingerPoint[];
  aggregateLatest: BollingerPoint | null;
  platforms: PlatformRecord[];
  agents: AgentRecord[];
  breakouts: AgentRecord[];
}

function buildAgent(s: AgentSeries, isLive: boolean): AgentRecord {
  const series = computeBollinger(s.data);
  const ts = todayStatus(series)!;
  const bi = breakoutInfo(series);
  return {
    platformId: s.platformId,
    platformName: s.platformName,
    agentId: s.agentId,
    agentName: s.agentName,
    raw: s.data,
    series,
    latest: ts.point,
    status: ts.status,
    trend: trendDirection(s.data),
    isLive,
    breakoutPct: bi?.pct ?? null,
    breakoutBoundary: bi?.boundary ?? null,
    breakoutBoundaryLabel: bi?.boundaryLabel ?? null,
  };
}

function buildAll(): Omit<DashboardData, "loading"> {
  const mockSeries = getAllAgentSeries();
  const imported = listImportedAgents();
  const liveKey = (p: string, a: string) => `${p}::${a}`;
  const liveSet = new Set(imported.map((i) => liveKey(i.platformId, i.agentId)));

  // Replace mock data for imported agents, and add any net-new imported agents.
  const merged: { series: AgentSeries; isLive: boolean }[] = mockSeries
    .filter((s) => !liveSet.has(liveKey(s.platformId, s.agentId)))
    .map((s) => ({ series: s, isLive: false }));

  for (const i of imported) {
    merged.push({
      series: {
        platformId: i.platformId,
        platformName: i.platformName,
        agentId: i.agentId,
        agentName: i.agentName,
        data: importedRowsToDataPoints(i.points),
      },
      isLive: true,
    });
  }

  const agents = merged
    .filter((m) => m.series.data.length > 0)
    .map((m) => buildAgent(m.series, m.isLive));

  const platformRecords: PlatformRecord[] = platforms.map((p) => {
    const pAgents = agents.filter((a) => a.platformId === p.id);
    const raw = combineSeries(
      merged.filter((m) => m.series.platformId === p.id).map((m) => m.series),
    );
    const series = computeBollinger(raw);
    const ts = todayStatus(series) ?? null;
    return {
      id: p.id,
      name: p.name,
      agents: pAgents,
      raw,
      series,
      latest: ts ? ts.point : ({} as BollingerPoint),
      status: ts ? ts.status : "within",
      trend: trendDirection(raw),
      hasBreakout: pAgents.some((a) => a.status !== "within"),
    };
  });

  const aggregateRaw = combineSeries(merged.map((m) => m.series));
  const aggregate = computeBollinger(aggregateRaw);
  const aggregateLatest = aggregate.length ? aggregate[aggregate.length - 1] : null;
  const breakouts = agents.filter((a) => a.status !== "within");

  return {
    lastUpdated: new Date(),
    aggregate,
    aggregateLatest,
    platforms: platformRecords,
    agents,
    breakouts,
  };
}

export function useDashboardData(): DashboardData {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Omit<DashboardData, "loading"> | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setData(buildAll());
      setLoading(false);
    }, version === 0 ? 800 : 0);
    return () => clearTimeout(t);
  }, [version]);

  useEffect(() => {
    return onImportedAgentsChange(() => setVersion((v) => v + 1));
  }, []);

  if (loading || !data) {
    return {
      loading: true,
      lastUpdated: new Date(),
      aggregate: [],
      aggregateLatest: null,
      platforms: [],
      agents: [],
      breakouts: [],
    };
  }
  return { loading: false, ...data };
}
