import { useEffect, useState } from "react";
import { getAllAgentSeries, combineSeries, platforms, type AgentSeries, type DataPoint } from "./mockData";
import { computeBollinger, trendDirection, todayStatus, type BollingerPoint } from "./bollinger";

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

function buildAgent(s: AgentSeries): AgentRecord {
  const series = computeBollinger(s.data);
  const ts = todayStatus(series)!;
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
  };
}

function buildAll(): Omit<DashboardData, "loading"> {
  const allSeries = getAllAgentSeries();
  const agents = allSeries.map(buildAgent);

  const platformRecords: PlatformRecord[] = platforms.map((p) => {
    const pAgents = agents.filter((a) => a.platformId === p.id);
    const raw = combineSeries(allSeries.filter((s) => s.platformId === p.id));
    const series = computeBollinger(raw);
    const ts = todayStatus(series)!;
    return {
      id: p.id,
      name: p.name,
      agents: pAgents,
      raw,
      series,
      latest: ts.point,
      status: ts.status,
      trend: trendDirection(raw),
      hasBreakout: pAgents.some((a) => a.status !== "within"),
    };
  });

  const aggregateRaw = combineSeries(allSeries);
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

  useEffect(() => {
    const t = setTimeout(() => {
      setData(buildAll());
      setLoading(false);
    }, 800);
    return () => clearTimeout(t);
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
