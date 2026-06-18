import type { DataPoint } from "./mockData";

export interface BollingerPoint extends DataPoint {
  mean: number;
  upper: number;
  lower: number;
  trend: number;
  breakout: "above" | "below" | null;
}

// ── Rolling/expanding Bollinger stats ─────────────────────────────────────────
// For each data point, bands are calculated using ONLY data available up to
// and including that point's month. This makes the chart historically honest —
// you see where the bands actually were at the time, not in hindsight.
//
// We use an expanding window: as more months accumulate, the bands narrow
// and stabilise. A minimum of 2 months of history is required before bands
// are meaningful; before that we show the balance as the band centre.

function rollingBollingerStats(
  data: DataPoint[],
  pointIndex: number,
): { mean: number; upper: number; lower: number } {
  // Use all data up to and including the current point's month
  const currentMonth = data[pointIndex].date.slice(0, 7);

  // Find the index of the last point in the current month
  let lastIdxInMonth = pointIndex;
  while (
    lastIdxInMonth + 1 < data.length &&
    data[lastIdxInMonth + 1].date.slice(0, 7) === currentMonth
  ) {
    lastIdxInMonth++;
  }

  const historicalData = data.slice(0, lastIdxInMonth + 1);
  const wd = data[pointIndex].wd;

  // Collect WD values from the last 12 months of history only.
  // Using all history distorts bands when business size has changed over time.
  // 12 months = ~12 observations per WD position — enough for stable bands
  // without being skewed by old data from when balances were much lower/higher.
  const currentDate = new Date(data[pointIndex].date);
  const twelveMonthsAgo = new Date(currentDate);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoff = twelveMonthsAgo.toISOString().slice(0, 10);

  const vals = historicalData
    .filter((d) => d.wd === wd && d.balance > 0 && d.date >= cutoff)
    .map((d) => d.balance);

  if (vals.length < 2) {
    // Not enough history — use the single value as centre, no band
    const v = vals[0] ?? data[pointIndex].balance;
    return { mean: v, upper: v, lower: v };
  }

  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1);
  const std = Math.sqrt(variance);

  // Floor the lower band at 20% of mean — but only when mean >= £5,000.
  // Below £5k, zero is a normal operating state so bands fall naturally.
  // Above £5k, a lower band of £0 would be misleading.
  const rawLower = mean - 2 * std;
  const floor    = mean >= 5000 ? mean * 0.20 : 0;
  return {
    mean,
    upper: mean + 2 * std,
    lower: Math.max(rawLower, floor),
  };
}

// ── Static stats (used for summary metrics only, not chart bands) ─────────────
export function bollingerStats(data: DataPoint[]) {
  const groups = new Map<number, number[]>();
  for (const d of data) {
    // Exclude zeros from band calculations
    if (d.balance <= 0) continue;
    const arr = groups.get(d.wd) ?? [];
    arr.push(d.balance);
    groups.set(d.wd, arr);
  }
  const stats = new Map<number, { mean: number; std: number; upper: number; lower: number }>();
  for (const [wd, vals] of groups) {
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, vals.length - 1);
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

// ── Trendline ─────────────────────────────────────────────────────────────────
export function trendlineSlope(data: DataPoint[], windowDays = 365) {
  const slice = data.slice(-windowDays);
  if (slice.length < 2) return { slope: 0, intercept: slice[0]?.balance ?? 0, startIndex: data.length - slice.length };
  const n = slice.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += slice[i].balance;
    sumXY += i * slice[i].balance; sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept, startIndex: data.length - slice.length };
}

// ── Main compute function ─────────────────────────────────────────────────────
export function computeBollinger(data: DataPoint[]): BollingerPoint[] {
  const { slope, intercept, startIndex } = trendlineSlope(data, 365);

  return data.map((d, i) => {
    // Rolling bands — only use data available at this point in time
    const { mean, upper, lower } = rollingBollingerStats(data, i);

    const localIdx = i - startIndex;
    const trend = localIdx >= 0 ? intercept + slope * localIdx : NaN;

    let breakout: "above" | "below" | null = null;
    if (d.balance > 0) {
      if (d.balance > upper) breakout = "above";
      else if (d.balance < lower) breakout = "below";
    }

    return { ...d, mean, upper, lower, trend, breakout };
  });
}

export type TrendDirection = "up" | "down" | "flat";

function regressionSlope(data: DataPoint[], windowDays = 365) {
  const slice = data.slice(-windowDays);
  if (slice.length < 2) return { slope: 0, intercept: slice[0]?.balance ?? 0, n: slice.length };
  const n = slice.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += slice[i].balance;
    sumXY += i * slice[i].balance; sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept, n };
}

export function trendDirection(data: DataPoint[]): TrendDirection {
  const { slope, intercept, n } = regressionSlope(data, 365);
  if (n < 2 || !intercept) return "flat";
  const totalChange = (slope * (n - 1)) / intercept;
  if (totalChange > 0.03) return "up";
  if (totalChange < -0.03) return "down";
  return "flat";
}

export function trendPercentChange(data: DataPoint[], windowDays = 365) {
  const { slope, intercept, n } = regressionSlope(data, windowDays);
  if (n < 2 || !intercept) return 0;
  return ((slope * (n - 1)) / Math.abs(intercept)) * 100;
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

export function breakoutInfo(series: BollingerPoint[]): {
  pct: number;
  boundary: number;
  boundaryLabel: "Upper band" | "Lower band";
} | null {
  if (!series.length) return null;
  const p = series[series.length - 1];
  if (!p.breakout) return null;
  if (p.breakout === "above") {
    return {
      pct: p.upper > 0 ? ((p.balance - p.upper) / p.upper) * 100 : 0,
      boundary: p.upper,
      boundaryLabel: "Upper band",
    };
  }
  return {
    pct: p.lower > 0 ? ((p.lower - p.balance) / p.lower) * 100 : 0,
    boundary: p.lower,
    boundaryLabel: "Lower band",
  };
}
