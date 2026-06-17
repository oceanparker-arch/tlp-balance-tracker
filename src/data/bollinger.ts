import type { DataPoint } from "./mockData";

export interface BollingerPoint extends DataPoint {
  mean: number;
  upper: number;
  lower: number;
  trend: number;
  breakout: "above" | "below" | null;
}

// Group by working day of month, compute mean / std-dev per WD.
export function bollingerStats(data: DataPoint[]) {
  const groups = new Map<number, number[]>();
  for (const d of data) {
    const arr = groups.get(d.wd) ?? [];
    arr.push(d.balance);
    groups.set(d.wd, arr);
  }
  const stats = new Map<number, { mean: number; std: number; upper: number; lower: number }>();
  for (const [wd, vals] of groups) {
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, vals.length);
    const std = Math.sqrt(variance);
    stats.set(wd, {
      mean,
      std,
      upper: mean + 2 * std,
      lower: Math.max(0, mean - 2 * std),
    });
  }
  return stats;
}

// Linear regression slope across the last `windowDays` data points.
export function trendlineSlope(data: DataPoint[], windowDays = 90) {
  const slice = data.slice(-windowDays);
  if (slice.length < 2) return { slope: 0, intercept: slice[0]?.balance ?? 0, startIndex: data.length - slice.length };
  const n = slice.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += slice[i].balance;
    sumXY += i * slice[i].balance;
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept, startIndex: data.length - slice.length };
}

export function computeBollinger(data: DataPoint[]): BollingerPoint[] {
  const stats = bollingerStats(data);
  const { slope, intercept, startIndex } = trendlineSlope(data, 90);
  return data.map((d, i) => {
    const s = stats.get(d.wd);
    const mean = s?.mean ?? d.balance;
    const upper = s?.upper ?? d.balance;
    const lower = s?.lower ?? 0;
    const localIdx = i - startIndex;
    const trend = localIdx >= 0 ? intercept + slope * localIdx : NaN;
    let breakout: "above" | "below" | null = null;
    if (d.balance > upper) breakout = "above";
    else if (d.balance < lower) breakout = "below";
    return { ...d, mean, upper, lower, trend, breakout };
  });
}

export type TrendDirection = "up" | "down" | "flat";
export function trendDirection(data: DataPoint[]): TrendDirection {
  const { slope } = trendlineSlope(data, 90);
  const avg = data.slice(-90).reduce((s, d) => s + d.balance, 0) / Math.max(1, Math.min(90, data.length));
  const rel = avg ? (slope * 90) / avg : 0;
  if (rel > 0.05) return "up";
  if (rel < -0.05) return "down";
  return "flat";
}

export function trendPercentChange(data: DataPoint[], windowDays = 90) {
  const slice = data.slice(-windowDays);
  if (slice.length < 2) return 0;
  const first = slice[0].balance;
  const last = slice[slice.length - 1].balance;
  if (!first) return 0;
  return ((last - first) / first) * 100;
}

export function todayStatus(data: BollingerPoint[]): {
  point: BollingerPoint;
  status: "within" | "above" | "below";
} | null {
  if (!data.length) return null;
  const p = data[data.length - 1];
  let status: "within" | "above" | "below" = "within";
  if (p.breakout === "above") status = "above";
  else if (p.breakout === "below") status = "below";
  return { point: p, status };
}
