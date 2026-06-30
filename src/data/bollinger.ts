import type { DataPoint } from "./mockData";

export interface BollingerPoint extends DataPoint {
  mean: number;
  upper: number;
  lower: number;
  trend: number;
  breakout: "above" | "below" | null;
}

// ── Rolling Bollinger calculation ──────────────────────────────────────────
// For each point, bands are computed from the trailing `windowMonths` of data
// at the same working-day position. As new data arrives, bands recalculate
// dynamically per point — no fixed one-shot window.

function stdDev(vals: number[], m: number): number {
  if (vals.length < 2) return 0;
  const variance = vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1);
  return Math.sqrt(variance);
}

function mean(vals: number[]): number {
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

export function computeBollinger(
  data: DataPoint[],
  windowMonths = 12,
  stdMultiplier = 2,
): BollingerPoint[] {
  if (!data.length) return [];

  // Index non-zero balances by working-day position, sorted by timestamp.
  const byWd = new Map<number, { ts: number; balance: number }[]>();
  for (const d of data) {
    if (d.balance <= 0) continue;
    const arr = byWd.get(d.wd) ?? [];
    arr.push({ ts: d.ts, balance: d.balance });
    byWd.set(d.wd, arr);
  }
  for (const arr of byWd.values()) arr.sort((a, b) => a.ts - b.ts);

  // Trendline — linear regression on last 365 non-zero points.
  const trendSlice = data.filter((d) => d.balance > 0).slice(-365);
  let slope = 0, intercept = 0;
  const trendStartIdx = data.length - trendSlice.length;
  if (trendSlice.length >= 2) {
    const n = trendSlice.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i; sumY += trendSlice[i].balance;
      sumXY += i * trendSlice[i].balance; sumXX += i * i;
    }
    slope     = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
    intercept = (sumY - slope * sumX) / n;
  }

  return data.map((d, i) => {
    // Trailing window ending at this point's date.
    const cutoffDate = new Date(d.ts);
    cutoffDate.setMonth(cutoffDate.getMonth() - windowMonths);
    const cutoffTs = cutoffDate.getTime();

    const wdPoints = byWd.get(d.wd) ?? [];
    const vals: number[] = [];
    for (const p of wdPoints) {
      if (p.ts > d.ts) break;
      if (p.ts >= cutoffTs) vals.push(p.balance);
    }

    const m     = vals.length ? mean(vals) : d.balance;
    const s     = stdDev(vals, m);
    const floor = m >= 5000 ? m * 0.20 : 0;
    const upper = m + stdMultiplier * s;
    const lower = Math.max(m - stdMultiplier * s, floor);

    const localIdx = i - trendStartIdx;
    const trend    = localIdx >= 0 ? intercept + slope * localIdx : NaN;

    let breakout: "above" | "below" | null = null;
    if (d.balance > 0) {
      if (d.balance > upper) {
        const pct = upper > 0 ? ((d.balance - upper) / upper) * 100 : 0;
        if (pct >= 5) breakout = "above";
      } else if (d.balance < lower) {
        breakout = "below";
      }
    }

    return { ...d, mean: m, upper, lower, trend, breakout };
  });
}

// ── Static stats for summary metrics ──────────────────────────────────────
// Uses the trailing 12 months ending at the latest point.
export function bollingerStats(data: DataPoint[]) {
  const latest = data[data.length - 1]?.date ?? "";
  const cutoffDate = new Date(latest);
  cutoffDate.setMonth(cutoffDate.getMonth() - 12);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const groups = new Map<number, number[]>();
  for (const d of data) {
    if (d.date >= cutoff && d.balance > 0) {
      const arr = groups.get(d.wd) ?? [];
      arr.push(d.balance);
      groups.set(d.wd, arr);
    }
  }
  const stats = new Map<number, { mean: number; std: number; upper: number; lower: number }>();
  for (const [wd, vals] of groups) {
    const m = mean(vals);
    const s = stdDev(vals, m);
    const floor = m >= 5000 ? m * 0.20 : 0;
    stats.set(wd, { mean: m, std: s, upper: m + 2*s, lower: Math.max(m - 2*s, floor) });
  }
  return stats;
}


// ── Trend calculations ─────────────────────────────────────────────────────

function getSecondWednesday(year: number, month: number): string {
  let count = 0;
  for (let day = 1; day <= 14; day++) {
    const d = new Date(year, month, day);
    if (d.getDay() === 3) {
      count++;
      if (count === 2) return d.toISOString().slice(0, 10);
    }
  }
  return new Date(year, month, 14).toISOString().slice(0, 10);
}

function subtractOneMonth(dateStr: string): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function stableAverage(data: DataPoint[], endDate: string, startDate: string): number {
  const points = data
    .filter(d => d.date >= startDate && d.date <= endDate && d.balance > 0)
    .map(d => d.balance)
    .sort((a, b) => b - a);
  if (points.length < 6) return 0;
  const dataset = points.slice(5, 15);
  return dataset.length ? dataset.reduce((s, v) => s + v, 0) / dataset.length : 0;
}

export function trendPercentChange(data: DataPoint[]): number {
  if (data.length < 15) return 0;
  const latest      = data[data.length - 1].date;
  const latestDate  = new Date(latest);
  const currentAnchor = getSecondWednesday(latestDate.getFullYear(), latestDate.getMonth());
  const currentStart  = subtractOneMonth(currentAnchor);
  const priorAnchorDate = new Date(currentAnchor);
  priorAnchorDate.setMonth(priorAnchorDate.getMonth() - 3);
  const priorAnchor = getSecondWednesday(priorAnchorDate.getFullYear(), priorAnchorDate.getMonth());
  const priorStart  = subtractOneMonth(priorAnchor);
  const current = stableAverage(data, currentAnchor, currentStart);
  const prior   = stableAverage(data, priorAnchor, priorStart);
  if (!prior || !current) return 0;
  return ((current - prior) / prior) * 100;
}

export type TrendDirection = "up" | "down" | "flat";

export function trendDirection(data: DataPoint[]): TrendDirection {
  const pct = trendPercentChange(data);
  if (pct >= 15)  return "up";
  if (pct <= -15) return "down";
  return "flat";
}

export function trendlineSlope(data: DataPoint[], windowDays = 365) {
  const slice = data.filter(d => d.balance > 0).slice(-windowDays);
  if (slice.length < 2) return { slope: 0, intercept: slice[0]?.balance ?? 0, startIndex: data.length - slice.length };
  const n = slice.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += slice[i].balance;
    sumXY += i * slice[i].balance; sumXX += i * i;
  }
  const slope     = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept, startIndex: data.length - slice.length };
}

export function todayStatus(data: BollingerPoint[]): { point: BollingerPoint; status: "within" | "above" | "below" } | null {
  if (!data.length) return null;
  const p = data[data.length - 1];
  const status = p.breakout === "above" ? "above" : p.breakout === "below" ? "below" : "within";
  return { point: p, status };
}

export function breakoutInfo(series: BollingerPoint[]): { pct: number; boundary: number; boundaryLabel: "Upper band" | "Lower band" } | null {
  if (!series.length) return null;
  const p = series[series.length - 1];
  if (!p.breakout) return null;
  if (p.breakout === "above") return { pct: p.upper > 0 ? ((p.balance - p.upper) / p.upper) * 100 : 0, boundary: p.upper, boundaryLabel: "Upper band" };
  return { pct: p.lower > 0 ? ((p.lower - p.balance) / p.lower) * 100 : 0, boundary: p.lower, boundaryLabel: "Lower band" };
}
