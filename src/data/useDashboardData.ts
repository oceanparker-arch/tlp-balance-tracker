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
  usingLiveData: boolean;
}

// ── API config ─────────────────────────────────────────────────────────────────
// The Python API server runs on localhost:5000.
// If unreachable the dashboard falls back to mock data automatically.
const API_BASE = "http://localhost:5000";

// ── Convert API response into DataPoint[] ──────────────────────────────────────
function apiPointsToDataPoints(points: { date: string; balance: number; wd: number }[]): DataPoint[] {
  return points.map((p) => ({
    date: p.date,
    ts: new Date(p.date).getTime(),
    wd: p.wd,
    wdMax: 22, // approximation — will be refined once bank holiday awareness added
    balance: p.balance,
  }));
}

// ── Fetch live data from API ───────────────────────────────────────────────────
async function fetchLiveData(): Promise<AgentSeries[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/data`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = await res.json();

    const series: AgentSeries[] = [];
    for (const platform of json.platforms ?? []) {
      for (const agent of platform.agents ?? []) {
        if (!agent.data?.length) continue;
        series.push({
          platformId:   platform.id,
          platformName: platform.name,
          agentId:      agent.id,
          agentName:    agent.name,
          data:         apiPointsToDataPoints(agent.data),
        });
      }
    }
    return series.length > 0 ? series : null;
  } catch {
    return null;
  }
}

// ── Build all records ──────────────────────────────────────────────────────────
function buildAgent(s: AgentSeries, isLive: boolean): AgentRecord {
  const series = computeBollinger(s.data);
  const ts = todayStatus(series)!;
  const bi = breakoutInfo(series);
  return {
    platformId:           s.platformId,
    platformName:         s.platformName,
    agentId:              s.agentId,
    agentName:            s.agentName,
    raw:                  s.data,
    series,
    latest:               ts.point,
    status:               ts.status,
    trend:                trendDirection(s.data),
    isLive,
    breakoutPct:          bi?.pct ?? null,
    breakoutBoundary:     bi?.boundary ?? null,
    breakoutBoundaryLabel:bi?.boundaryLabel ?? null,
  };
}

// Build a platform list from whichever agent series we have.
// If live data is present for a platform, use it; otherwise fall back to mock.
function buildPlatforms(
  merged: { series: AgentSeries; isLive: boolean }[],
  agents: AgentRecord[],
  liveSet: Set<string>,
): PlatformRecord[] {
  // Collect all platform ids seen (live + mock)
  const allPlatformIds = new Map<string, string>(); // id -> name
  for (const m of merged) {
    allPlatformIds.set(m.series.platformId, m.series.platformName);
  }
  // Also include mock platforms so they remain visible even when not in live data
  for (const p of platforms) {
    if (!allPlatformIds.has(p.id)) {
      allPlatformIds.set(p.id, p.name);
    }
  }

  return Array.from(allPlatformIds.entries()).map(([pid, pname]) => {
    const pAgents = agents.filter((a) => a.platformId === pid);
    const rawAll = combineSeries(
      merged.filter((m) => m.series.platformId === pid).map((m) => m.series),
    );
    // Rolling 12 months for platform chart
    const raw = rawAll.slice(-365);
    const series = computeBollinger(raw);
    const ts = todayStatus(series) ?? null;
    return {
      id:         pid,
      name:       pname,
      agents:     pAgents,
      raw,
      series,
      latest:     ts ? ts.point : ({} as BollingerPoint),
      status:     ts ? ts.status : "within",
      trend:      trendDirection(raw),
      hasBreakout:pAgents.some((a) => a.status !== "within"),
    };
  });
}

async function buildAll(): Promise<Omit<DashboardData, "loading">> {
  // Try live API first
  const liveSeries = await fetchLiveData();
  const usingLiveData = liveSeries !== null && liveSeries.length > 0;

  const mockSeries = getAllAgentSeries();
  const imported   = listImportedAgents();
  const liveKey    = (p: string, a: string) => `${p}::${a}`;

  // Keys covered by live API data
  const liveApiKeys = new Set((liveSeries ?? []).map((s) => liveKey(s.platformId, s.agentId)));

  // Keys covered by manually imported data (from import page)
  const importedKeys = new Set(imported.map((i) => liveKey(i.platformId, i.agentId)));

  // All live keys (API + imported) replace their mock counterparts
  const replacedKeys = new Set([...liveApiKeys, ...importedKeys]);

  const merged: { series: AgentSeries; isLive: boolean }[] = [
    // Only include mock agents when there is NO live API data at all.
    // Once real data is flowing, mock placeholders are hidden entirely.
    ...(!usingLiveData
      ? mockSeries
          .filter((s) => !replacedKeys.has(liveKey(s.platformId, s.agentId)))
          .map((s) => ({ series: s, isLive: false }))
      : []
    ),

    // Live API agents
    ...(liveSeries ?? []).map((s) => ({ series: s, isLive: true })),

    // Manually imported agents
    ...imported
      .filter((i) => !liveApiKeys.has(liveKey(i.platformId, i.agentId))) // don't double-add
      .map((i) => ({
        series: {
          platformId:   i.platformId,
          platformName: i.platformName,
          agentId:      i.agentId,
          agentName:    i.agentName,
          data:         importedRowsToDataPoints(i.points),
        },
        isLive: true,
      })),
  ];

  const agents = merged
    .filter((m) => m.series.data.length > 0)
    .map((m) => buildAgent(m.series, m.isLive));

  const platformRecords = buildPlatforms(merged, agents, replacedKeys);

  const aggregateRawAll = combineSeries(merged.map((m) => m.series));
  // Rolling 12 months for main chart
  const aggregateRaw    = aggregateRawAll.slice(-365);
  const aggregate       = computeBollinger(aggregateRaw);
  const aggregateLatest = aggregate.length ? aggregate[aggregate.length - 1] : null;
  const breakouts       = agents.filter((a) => a.status !== "within");

  return {
    lastUpdated:     new Date(),
    aggregate,
    aggregateLatest,
    platforms:       platformRecords,
    agents,
    breakouts,
    usingLiveData,
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useDashboardData(): DashboardData {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Omit<DashboardData, "loading"> | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildAll().then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
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
      usingLiveData: false,
    };
  }
  return { loading: false, ...data };
}
