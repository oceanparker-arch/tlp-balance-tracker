import type { DataPoint } from "./mockData";

export interface BollingerPoint extends DataPoint {
  mean: number;
  upper: number;
  lower: number;
  trend: number;
  breakout: "above" | "below" | null;
}

// ── Fast Bollinger calculation ─────────────────────────────────────────────
// Pre-computes per-WD stats once using last 12 months of data,
// then applies them to all points in O(n) rather than O(n²).

function stdDev(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  const variance = vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1);
  return Math.sqrt(variance);
}

function mean(vals: number[]): number {
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

export function computeBollinger(data: DataPoint[]): BollingerPoint[] {
  if (!data.length) return [];

  // Use last 12 months of data for band calculation
  const latest = data[data.length - 1].date;
  const cutoffDate = new Date(latest);
  cutoffDate.setMonth(cutoffDate.getMonth() - 12);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  // Group non-zero values by WD position within the 12-month window
  const wdGroups = new Map<number, number[]>();
  for (const d of data) {
    if (d.date >= cutoff && d.balance > 0) {
      const arr = wdGroups.get(d.wd) ?? [];
      arr.push(d.balance);
      wdGroups.set(d.wd, arr);
    }
  }

  // Pre-compute bands per WD position
  const wdBands = new Map<number, { mean: number; upper: number; lower: number }>();
  for (const [wd, vals] of wdGroups) {
    const m     = mean(vals);
    const s     = stdDev(vals);
    const floor = m >= 5000 ? m * 0.20 : 0;
    wdBands.set(wd, {
      mean:  m,
      upper: m + 2 * s,
      lower: Math.max(m - 2 * s, floor),
    });
  }

  // Trendline — simple linear regression on last 365 non-zero points
  const trendSlice = data.filter(d => d.balance > 0).slice(-365);
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

  // Apply to all points in a single pass
  return data.map((d, i) => {
    const bands = wdBands.get(d.wd) ?? { mean: d.balance, upper: d.balance, lower: 0 };

    const localIdx = i - trendStartIdx;
    const trend    = localIdx >= 0 ? intercept + slope * localIdx : NaN;

    let breakout: "above" | "below" | null = null;
    if (d.balance > 0) {
      if (d.balance > bands.upper) {
        const pct = bands.upper > 0 ? ((d.balance - bands.upper) / bands.upper) * 100 : 0;
        if (pct >= 5) breakout = "above";
      } else if (d.balance < bands.lower) {
        breakout = "below";
      }
    }

    return { ...d, mean: bands.mean, upper: bands.upper, lower: bands.lower, trend, breakout };
  });
}

// ── Static stats for summary metrics ──────────────────────────────────────
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
    const s = stdDev(vals);
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
