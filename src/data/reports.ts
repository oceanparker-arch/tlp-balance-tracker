// ── Reports data layer ─────────────────────────────────────────────────────
// Stores alert logs and investigation reports in localStorage.
// Structured so it can be swapped for a real API backend later.

export type AlertStatus = "pending" | "reviewed" | "escalated" | "resolved";
export type AlertType = "above_band" | "below_band" | "trend_down" | "trend_up";
export type EscalationTarget = "head_of_client_accounts" | "ocean_parker" | "coo";

export const REASONS = [
  "Large landlord leaving",
  "Large float being returned",
  "Acquisition",
  "High volume of move ins / deposits",
  "Large suspense items",
  "Potential fraud",
  "Other",
] as const;

export type Reason = (typeof REASONS)[number];

export interface AlertLogEntry {
  id: string;
  date: string; // ISO date of the log entry
  agentId: string;
  agentName: string;
  platformId: string;
  platformName: string;
  alertType: AlertType;
  balance: number;
  variancePct: number;
  reason: Reason | "";
  notes: string;
  status: AlertStatus;
  reviewedBy: string;
  timestamp: string; // ISO datetime when last updated
  reportId?: string; // linked investigation report if escalated
}

export interface InvestigationReport {
  id: string;
  ref: string; // e.g. INC-2026-0047
  createdAt: string;
  agentId: string;
  agentName: string;
  platformId: string;
  platformName: string;
  alertType: AlertType;
  balance: number;
  variancePct: number;
  reason: Reason | "";
  findings: string;
  recommendedAction: string;
  assignedTo: EscalationTarget | "";
  reviewDeadline: string; // ISO date
  submittedBy: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  status: "submitted" | "reviewed" | "overdue" | "closed";
}

const LOG_KEY    = "tlp_alert_log";
const REPORT_KEY = "tlp_reports";

// ── Alert log ──────────────────────────────────────────────────────────────

export function getAlertLog(): AlertLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveAlertLog(entries: AlertLogEntry[]): void {
  localStorage.setItem(LOG_KEY, JSON.stringify(entries));
}

export function upsertLogEntry(entry: AlertLogEntry): void {
  const log = getAlertLog();
  const idx = log.findIndex(e => e.id === entry.id);
  if (idx >= 0) log[idx] = entry;
  else log.unshift(entry);
  saveAlertLog(log);
}

// ── Investigation reports ──────────────────────────────────────────────────

export function getReports(): InvestigationReport[] {
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveReports(reports: InvestigationReport[]): void {
  localStorage.setItem(REPORT_KEY, JSON.stringify(reports));
}

export function createReport(report: Omit<InvestigationReport, "id" | "ref">): InvestigationReport {
  const reports = getReports();
  const year = new Date().getFullYear();
  const seq  = (reports.filter(r => r.ref.startsWith(`INC-${year}`)).length + 1).toString().padStart(4, "0");
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const full: InvestigationReport = { ...report, id, ref: `INC-${year}-${seq}` };
  reports.unshift(full);
  saveReports(reports);
  return full;
}

export function updateReport(id: string, updates: Partial<InvestigationReport>): void {
  const reports = getReports();
  const idx = reports.findIndex(r => r.id === id);
  if (idx >= 0) { reports[idx] = { ...reports[idx], ...updates }; saveReports(reports); }
}

// ── Overdue check ──────────────────────────────────────────────────────────

export function checkOverdue(): void {
  const reports = getReports();
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;
  for (const r of reports) {
    if (r.status === "submitted" && r.reviewDeadline < today) {
      r.status = "overdue";
      changed = true;
    }
  }
  if (changed) saveReports(reports);
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function alertTypeLabel(t: AlertType): string {
  return { above_band: "↑ Above band", below_band: "↓ Below band", trend_down: "↘ Trend down", trend_up: "↗ Trend up" }[t];
}

export function escalationLabel(t: EscalationTarget): string {
  return { head_of_client_accounts: "Head of Client Accounts", ocean_parker: "Ocean Parker", coo: "COO" }[t];
}

export const ESCALATION_TARGETS: { value: EscalationTarget; label: string }[] = [
  { value: "head_of_client_accounts", label: "Head of Client Accounts" },
  { value: "ocean_parker", label: "Ocean Parker" },
  { value: "coo", label: "COO" },
];
