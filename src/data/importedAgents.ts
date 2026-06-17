// Persistence + parsing for user-imported agent data.
// Storage shape lives in localStorage under STORAGE_KEY.

import { parse as parseDate, format } from "date-fns";
import type { DataPoint } from "./mockData";
import { platforms } from "./mockData";

const STORAGE_KEY = "tlp_imported_agents";
const CHANGE_EVENT = "tlp-imported-agents-changed";

export interface ImportedAgentRow {
  date: string; // yyyy-MM-dd
  balance: number;
}

export interface ImportedAgent {
  platformId: string;
  platformName: string;
  agentId: string;
  agentName: string;
  points: ImportedAgentRow[];
  importedAt: string;
}

function toAgentId(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function listImportedAgents(): ImportedAgent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveImportedAgent(agent: ImportedAgent) {
  if (typeof window === "undefined") return;
  const all = listImportedAgents().filter(
    (a) => !(a.platformId === agent.platformId && a.agentId === agent.agentId),
  );
  all.push(agent);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function removeImportedAgent(platformId: string, agentId: string) {
  if (typeof window === "undefined") return;
  const all = listImportedAgents().filter(
    (a) => !(a.platformId === platformId && a.agentId === agentId),
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onImportedAgentsChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

// ---- Parsing ------------------------------------------------------------

export interface ParseResult {
  rows: ImportedAgentRow[];
  errors: { line: number; text: string; reason: string }[];
}

const DATE_FORMATS = ["dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd", "dd-MM-yyyy"];

function tryParseDate(input: string): Date | null {
  for (const fmt of DATE_FORMATS) {
    const d = parseDate(input, fmt, new Date());
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function parsePastedData(text: string): ParseResult {
  const rows: ImportedAgentRow[] = [];
  const errors: ParseResult["errors"] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return; // skip blank rows
    // split on tab or whitespace (allow multiple columns, take first two)
    const parts = trimmed.split(/\t|\s{2,}|\s+/).filter(Boolean);
    if (parts.length < 2) {
      errors.push({ line: i + 1, text: trimmed, reason: "Expected date and balance columns" });
      return;
    }
    const dateStr = parts[0];
    // re-join remaining parts in case balance had a stray space
    const balStr = parts.slice(1).join("").replace(/£/g, "").replace(/,/g, "").replace(/[^0-9.\-]/g, "");
    const date = tryParseDate(dateStr);
    if (!date) {
      errors.push({ line: i + 1, text: trimmed, reason: `Could not parse date "${dateStr}"` });
      return;
    }
    const balance = Number(balStr);
    if (!isFinite(balance)) {
      errors.push({ line: i + 1, text: trimmed, reason: `Could not parse balance "${parts.slice(1).join(" ")}"` });
      return;
    }
    rows.push({ date: format(date, "yyyy-MM-dd"), balance });
  });
  // de-dup by date, keep latest entry
  const map = new Map<string, ImportedAgentRow>();
  for (const r of rows) map.set(r.date, r);
  return {
    rows: Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)),
    errors,
  };
}

// Convert imported rows into DataPoints with wd/wdMax computed from the
// imported set (working days = days actually present, in calendar order).
export function importedRowsToDataPoints(rows: ImportedAgentRow[]): DataPoint[] {
  const byMonth = new Map<string, ImportedAgentRow[]>();
  for (const r of rows) {
    const k = r.date.slice(0, 7);
    const arr = byMonth.get(k) ?? [];
    arr.push(r);
    byMonth.set(k, arr);
  }
  const out: DataPoint[] = [];
  for (const [, list] of byMonth) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const wdMax = list.length;
    list.forEach((r, idx) => {
      const d = new Date(r.date + "T00:00:00Z");
      out.push({
        date: r.date,
        ts: d.getTime(),
        wd: idx + 1,
        wdMax,
        balance: r.balance,
      });
    });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

export function buildAgentIdFromName(name: string): string {
  return toAgentId(name);
}

export function platformNameFor(platformId: string): string {
  return platforms.find((p) => p.id === platformId)?.name ?? platformId;
}
