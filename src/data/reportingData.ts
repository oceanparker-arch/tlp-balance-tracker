// ── Reporting data layer ───────────────────────────────────────────────────

export const HIGH_REASONS = [
  "Large landlord joining",
  "Acquisition",
  "High volume of move ins / deposits",
  "Large float in account",
  "Other",
] as const;

export const LOW_REASONS = [
  "Large landlord leaving",
  "Large float being returned",
  "Large suspense items",
  "Potential fraud",
  "Other",
] as const;

export const CARL_REASONS = [
  "Large landlord leaving",
  "Large landlord joining",
  "Acquisition",
  "Large float being returned",
  "Large suspense items",
  "High volume of move ins / deposits",
  "Potential fraud",
  "Other",
] as const;

export const PLATFORM_MANAGERS: Record<string, string> = {
  alto:        "Alto Manager",
  street:      "Street Manager",
  jupix:       "Jupix Manager",
  tenninety:   "10Ninety Manager",
  acquaint:    "Acquaint Manager",
  genie:       "Genie Manager",
  veco:        "Veco Manager",
  sme:         "SME Manager",
  reapit:      "Reapit Manager",
};

export type JoAction = "escalate_carl" | "no_action";
export type CarlAction = "escalate_chris" | "passed_to_manager";

export interface JoEntry {
  id: string;
  date: string;
  agentId: string;
  agentName: string;
  platformId: string;
  platformName: string;
  alertType: "above_band" | "below_band" | "trend_down" | "trend_up";
  balance: number;
  variancePct: number;
  reason: string;
  notes: string;
  action: JoAction | "";
  passedToCarl: boolean;
  passedToCarlAt?: string;
}

export interface CarlEntry {
  id: string;
  joEntryId: string;
  date: string;
  agentId: string;
  agentName: string;
  platformId: string;
  platformName: string;
  alertType: "above_band" | "below_band" | "trend_down" | "trend_up";
  balance: number;
  variancePct: number;
  joReason: string;
  joNotes: string;
  reason: string;
  notes: string;
  action: CarlAction | "";
  passedToManager?: string; // platform manager name
  passedToCarlAt: string;
  deadline: string; // 7 days from passedToCarlAt
  status: "open" | "escalated" | "passed_to_manager" | "overdue";
}

const JO_KEY   = "tlp_jo_entries";
const CARL_KEY = "tlp_carl_entries";

export function getJoEntries(): JoEntry[] {
  try { return JSON.parse(localStorage.getItem(JO_KEY) ?? "[]"); } catch { return []; }
}

export function saveJoEntries(entries: JoEntry[]): void {
  localStorage.setItem(JO_KEY, JSON.stringify(entries));
}

export function getCarlEntries(): CarlEntry[] {
  try {
    const entries: CarlEntry[] = JSON.parse(localStorage.getItem(CARL_KEY) ?? "[]");
    const today = new Date().toISOString().slice(0, 10);
    let changed = false;
    for (const e of entries) {
      if (e.status === "open" && e.deadline < today) {
        e.status = "overdue";
        changed = true;
      }
    }
    if (changed) localStorage.setItem(CARL_KEY, JSON.stringify(entries));
    return entries;
  } catch { return []; }
}

export function saveCarlEntries(entries: CarlEntry[]): void {
  localStorage.setItem(CARL_KEY, JSON.stringify(entries));
}

export function escalateToCarl(jo: JoEntry): void {
  const now = new Date();
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + 7);
  const carl: CarlEntry = {
    id: `carl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    joEntryId: jo.id,
    date: now.toISOString().slice(0, 10),
    agentId: jo.agentId,
    agentName: jo.agentName,
    platformId: jo.platformId,
    platformName: jo.platformName,
    alertType: jo.alertType,
    balance: jo.balance,
    variancePct: jo.variancePct,
    joReason: jo.reason,
    joNotes: jo.notes,
    reason: "",
    notes: "",
    action: "",
    passedToCarlAt: now.toISOString(),
    deadline: deadline.toISOString().slice(0, 10),
    status: "open",
  };
  const entries = getCarlEntries();
  entries.unshift(carl);
  saveCarlEntries(entries);
}

export function alertTypeLabel(t: string): string {
  return { above_band: "↑ Above band", below_band: "↓ Below band", trend_down: "↘ Trend down", trend_up: "↗ Trend up" }[t] ?? t;
}
