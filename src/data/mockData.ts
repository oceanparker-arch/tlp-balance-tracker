// Mock data layer for TLP Client Account Monitor.
// Replace the generators here with real API calls when wiring backend.

import { addDays, format, isWeekend, startOfDay, subDays } from "date-fns";

export interface Platform {
  id: string;
  name: string;
  agents: string[];
}

export const platforms: Platform[] = [
  { id: "alto", name: "Alto", agents: ["Acme Lettings", "Boulton & Griffiths", "Premier Properties", "Landmark Homes"] },
  { id: "street", name: "Street", agents: ["Keystone Homes", "Best Nest Lets", "Urban Nest", "Cityscape Lettings"] },
  { id: "jupix", name: "Jupix", agents: ["Huelin Homes", "South Coast Lets", "Coastal Properties"] },
  { id: "tenninety", name: "10Ninety", agents: ["Bristol Property Centre", "Japan Services", "Westland Lets"] },
  { id: "acquaint", name: "Acquaint", agents: ["Letsafe Homes", "Metro Lettings", "Apex Residential"] },
  { id: "genie", name: "Genie", agents: ["Phillips & Stubbs", "SJW Property", "Harbour Lets"] },
  { id: "veco", name: "Veco", agents: ["Northgate Lettings", "Crown Residential"] },
  { id: "sme", name: "SME", agents: ["Riverside Lets", "Park Lane Properties", "Capital Homes"] },
  { id: "reapit", name: "Reapit", agents: ["Prestige Lettings", "County Homes", "Landmark Residential", "Blue Door Lettings"] },
];

// A small set of UK bank holidays in the period covered.
const UK_BANK_HOLIDAYS = new Set<string>([
  "2025-08-25", "2025-12-25", "2025-12-26",
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25",
]);

function isWorkingDay(d: Date): boolean {
  if (isWeekend(d)) return false;
  return !UK_BANK_HOLIDAYS.has(format(d, "yyyy-MM-dd"));
}

// Deterministic pseudo-random so charts are stable between renders.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DataPoint {
  date: string; // yyyy-MM-dd
  ts: number;
  wd: number;       // working day of month (1..~22)
  wdMax: number;    // total working days in that month
  balance: number;
}

// Generate working-day series for 12 months ending today.
// Pattern per month:
//   - WD1-3: sharp rental-income spike (£40k–£120k * scale)
//   - WD4 .. last-5: sharp decay to £2k–£15k * scale
//   - Final 5 working days: slight build back to £10k–£30k * scale
//   - ±20% noise per point
function generateAgentSeries(agentId: string): DataPoint[] {
  const rand = seeded(hashString(agentId));
  // Per-agent scale multiplier so agents differ in size (0.5x – 1.6x).
  const scale = 0.5 + rand() * 1.1;

  const today = startOfDay(new Date());
  const start = subDays(today, 365);

  const monthGroups = new Map<string, Date[]>();
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (!isWorkingDay(d)) continue;
    const key = format(d, "yyyy-MM");
    const arr = monthGroups.get(key) ?? [];
    arr.push(d);
    monthGroups.set(key, arr);
  }

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const points: DataPoint[] = [];
  for (const [, days] of monthGroups) {
    const wdMax = days.length;
    const lateStart = wdMax - 5; // last 5 working days
    days.forEach((d, idx) => {
      const wd = idx + 1;
      let base: number;
      if (wd <= 3) {
        // Spike: WD1 highest, WD2 slightly lower, WD3 lower still.
        const spikeProfile = wd === 1 ? 1.0 : wd === 2 ? 0.85 : 0.65;
        base = lerp(40000, 120000, rand()) * spikeProfile;
      } else if (wd <= lateStart) {
        // Sharp decay from WD4 down to mid-month low.
        const span = Math.max(1, lateStart - 3);
        const t = (wd - 4) / span; // 0..1 across the decay region
        // Exponential-ish decay: from ~25k down to 2k–15k floor.
        const startVal = lerp(20000, 35000, rand());
        const endVal = lerp(2000, 15000, rand());
        base = startVal * Math.pow(endVal / startVal, t);
      } else {
        // Late-month slight build back up.
        const t = (wd - lateStart) / 5; // 0..1
        const lowVal = lerp(2000, 15000, rand());
        const peakVal = lerp(10000, 30000, rand());
        base = lerp(lowVal, peakVal, t);
      }
      const noise = 1 + (rand() - 0.5) * 0.4; // ±20%
      const balance = Math.max(500, base * scale * noise);
      points.push({
        date: format(d, "yyyy-MM-dd"),
        ts: d.getTime(),
        wd,
        wdMax,
        balance: Math.round(balance),
      });
    });
  }
  return points.sort((a, b) => a.ts - b.ts);
}

// ---- Public API ----------------------------------------------------------

export interface AgentSeries {
  platformId: string;
  platformName: string;
  agentId: string;
  agentName: string;
  data: DataPoint[];
}

let _cache: AgentSeries[] | null = null;
export function getAllAgentSeries(): AgentSeries[] {
  if (_cache) return _cache;
  const out: AgentSeries[] = [];
  for (const p of platforms) {
    for (const a of p.agents) {
      const agentId = a.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const data = generateAgentSeries(`${p.id}:${agentId}`);
      // Demo: force one agent into an "above band" breakout so the
      // breakout UI is visible against otherwise in-band mock data.
      if (p.id === "alto" && agentId === "premier-properties" && data.length) {
        const last = data[data.length - 1];
        last.balance = Math.round(last.balance * 3 + 80000);
      }
      out.push({
        platformId: p.id,
        platformName: p.name,
        agentId,
        agentName: a,
        data,
      });
    }
  }
  _cache = out;
  return out;
}

// Sum a set of agent series day-by-day into a combined series.
export function combineSeries(series: AgentSeries[]): DataPoint[] {
  const map = new Map<string, DataPoint>();
  for (const s of series) {
    for (const d of s.data) {
      const existing = map.get(d.date);
      if (existing) existing.balance += d.balance;
      else map.set(d.date, { ...d });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
}
