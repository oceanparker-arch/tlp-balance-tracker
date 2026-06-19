import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { useDashboardData } from "@/data/useDashboardData";
import { TopNav } from "@/components/TopNav";
import { formatGBP } from "@/lib/format";
import { trendPercentChange, breakoutInfo } from "@/data/bollinger";
import {
  getAlertLog, upsertLogEntry, getReports, createReport, updateReport, checkOverdue,
  alertTypeLabel, escalationLabel, REASONS, ESCALATION_TARGETS,
  type AlertLogEntry, type AlertType, type InvestigationReport, type Reason, type EscalationTarget,
} from "@/data/reports";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports · TLP Monitor" }] }),
  component: ReportsPage,
});

type Tab = "log" | "reports";

function statusPill(status: AlertLogEntry["status"]) {
  const map = {
    pending:   { bg: "#FFF3CD", color: "#856404", label: "Pending" },
    reviewed:  { bg: "#D4EDDA", color: "#155724", label: "Reviewed" },
    escalated: { bg: "#F8D7DA", color: "#721C24", label: "Escalated" },
    resolved:  { bg: "#D1ECF1", color: "#0C5460", label: "Resolved" },
  };
  const s = map[status];
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 500 }}>{s.label}</span>;
}

function reportStatusPill(status: InvestigationReport["status"]) {
  const map = {
    submitted: { bg: "#D4EDDA", color: "#155724", label: "Submitted" },
    reviewed:  { bg: "#CCE5FF", color: "#004085", label: "Reviewed" },
    overdue:   { bg: "#F8D7DA", color: "#721C24", label: "Overdue" },
    closed:    { bg: "#E2E3E5", color: "#383D41", label: "Closed" },
  };
  const s = map[status];
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 500 }}>{s.label}</span>;
}

// ── Daily Log ───────────────────────────────────────────────────────────────

function DailyLog({ usingLiveData }: { usingLiveData: boolean }) {
  const data = useDashboardData();
  const [entries, setEntries] = useState<AlertLogEntry[]>([]);
  const [saved, setSaved] = useState(false);

  // Build today's date key
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    checkOverdue();
    const existing = getAlertLog();

    if (data.loading) return;

    // Build list of today's active alerts
    const activeAlerts: AlertLogEntry[] = [];

    for (const agent of data.breakouts) {
      const id = `${today}-${agent.platformId}-${agent.agentId}-band`;
      const existing_entry = existing.find(e => e.id === id);
      const alertType: AlertType = agent.status === "above" ? "above_band" : "below_band";
      activeAlerts.push(existing_entry ?? {
        id, date: today,
        agentId: agent.agentId, agentName: agent.agentName,
        platformId: agent.platformId, platformName: agent.platformName,
        alertType, balance: agent.latest.balance,
        variancePct: agent.breakoutPct ?? 0,
        reason: "", notes: "", status: "pending",
        reviewedBy: "Jo Chapman", timestamp: new Date().toISOString(),
      });
    }

    const trendDown = data.agents.filter(a => a.trend === "down" && a.latest.mean >= 25000);
    for (const agent of trendDown) {
      const pct = trendPercentChange(agent.raw);
      if (pct > -15) continue;
      const id = `${today}-${agent.platformId}-${agent.agentId}-trend-down`;
      const existing_entry = existing.find(e => e.id === id);
      activeAlerts.push(existing_entry ?? {
        id, date: today,
        agentId: agent.agentId, agentName: agent.agentName,
        platformId: agent.platformId, platformName: agent.platformName,
        alertType: "trend_down", balance: agent.latest.balance,
        variancePct: pct,
        reason: "", notes: "", status: "pending",
        reviewedBy: "Jo Chapman", timestamp: new Date().toISOString(),
      });
    }

    const trendUp = data.agents.filter(a => a.trend === "up" && a.latest.mean >= 25000);
    for (const agent of trendUp) {
      const pct = trendPercentChange(agent.raw);
      if (pct < 15) continue;
      const id = `${today}-${agent.platformId}-${agent.agentId}-trend-up`;
      const existing_entry = existing.find(e => e.id === id);
      activeAlerts.push(existing_entry ?? {
        id, date: today,
        agentId: agent.agentId, agentName: agent.agentName,
        platformId: agent.platformId, platformName: agent.platformName,
        alertType: "trend_up", balance: agent.latest.balance,
        variancePct: pct,
        reason: "", notes: "", status: "pending",
        reviewedBy: "Jo Chapman", timestamp: new Date().toISOString(),
      });
    }

    // Also include any older unresolved entries
    const olderUnresolved = existing.filter(e =>
      e.date !== today && e.status !== "resolved" && e.status !== "reviewed" &&
      !activeAlerts.find(a => a.id === e.id)
    );

    setEntries([...activeAlerts, ...olderUnresolved]);
  }, [data.loading]);

  function update(id: string, field: keyof AlertLogEntry, value: string) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value, timestamp: new Date().toISOString() } : e));
    setSaved(false);
  }

  function saveAll() {
    entries.forEach(e => upsertLogEntry(e));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function escalateToReport(entry: AlertLogEntry) {
    update(entry.id, "status", "escalated");
    // Navigate to create report
    window.location.hash = `new-report-${entry.id}`;
  }

  const pending = entries.filter(e => e.status === "pending").length;

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            Alert log — {format(new Date(), "dd MMM yyyy")}
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            {entries.length} alert{entries.length !== 1 ? "s" : ""} · {pending} pending review
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600">✓ Saved</span>}
          <button
            onClick={saveAll}
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary transition"
          >
            Save log
          </button>
        </div>
      </div>

      {data.loading ? (
        <div className="p-8 text-center text-sm text-text-secondary">Loading alerts…</div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center text-sm" style={{ color: "#1E8449" }}>
          ✓ No active alerts today — nothing to log.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "15%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "19%" }} />
              <col style={{ width: "13%" }} />
            </colgroup>
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-4 py-2.5">Agent</th>
                <th className="px-4 py-2.5">Platform</th>
                <th className="px-4 py-2.5">Alert</th>
                <th className="px-4 py-2.5 text-right">Balance</th>
                <th className="px-4 py-2.5 text-right">Variance</th>
                <th className="px-4 py-2.5">Reason</th>
                <th className="px-4 py-2.5">Notes</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr
                  key={entry.id}
                  className="border-t border-border"
                  style={{ borderLeft: `3px solid ${entry.status === "escalated" ? "#721C24" : entry.alertType.includes("up") ? "#27AE60" : "#E74C3C"}` }}
                >
                  <td className="px-4 py-3">
                    <Link
                      to="/agent/$platformId/$agentId"
                      params={{ platformId: entry.platformId, agentId: entry.agentId }}
                      className="font-semibold hover:underline truncate block text-xs"
                      style={{ color: "var(--teal)" }}
                    >
                      {entry.agentName}
                    </Link>
                    <div className="text-[10px] text-text-secondary">{entry.date !== today ? `Carried over from ${entry.date}` : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary">{entry.platformName}</td>
                  <td className="px-4 py-3">
                    <span style={{
                      fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 500,
                      background: entry.alertType === "above_band" ? "rgba(200,119,58,0.13)" : entry.alertType === "trend_up" ? "rgba(39,174,96,0.12)" : "rgba(231,76,60,0.12)",
                      color: entry.alertType === "above_band" ? "#C8773A" : entry.alertType === "trend_up" ? "#1E8449" : "#E74C3C",
                    }}>
                      {alertTypeLabel(entry.alertType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs">{formatGBP(entry.balance)}</td>
                  <td className="px-4 py-3 text-right text-xs font-medium" style={{ color: entry.variancePct >= 0 ? "#27AE60" : "#E74C3C" }}>
                    {entry.variancePct >= 0 ? "+" : ""}{Math.abs(entry.variancePct).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={entry.reason}
                      onChange={e => update(entry.id, "reason", e.target.value)}
                      style={{ fontSize: 11, width: "100%", border: "0.5px solid var(--color-border-secondary)", borderRadius: 4, padding: "3px 4px", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
                    >
                      <option value="">Select reason…</option>
                      {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={entry.notes}
                      placeholder="Add notes…"
                      onChange={e => update(entry.id, "notes", e.target.value)}
                      style={{ fontSize: 11, width: "100%", border: "0.5px solid var(--color-border-secondary)", borderRadius: 4, padding: "3px 6px", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={entry.status}
                      onChange={e => {
                        const val = e.target.value as AlertLogEntry["status"];
                        update(entry.id, "status", val);
                        if (val === "escalated") escalateToReport(entry);
                      }}
                      style={{ fontSize: 11, width: "100%", border: "0.5px solid var(--color-border-secondary)", borderRadius: 4, padding: "3px 4px", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
                    >
                      <option value="pending">Pending</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="escalated">Escalated</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entries.length > 0 && (
        <div className="px-5 py-2.5 border-t border-border flex items-center justify-between">
          <span className="text-xs text-text-secondary">Reviewed by: Jo Chapman</span>
          <button
            onClick={saveAll}
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary transition"
          >
            {saved ? "✓ Saved" : "Save log"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Investigation reports ────────────────────────────────────────────────────

function InvestigationReports() {
  const [reports, setReports] = useState<InvestigationReport[]>([]);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<InvestigationReport | null>(null);
  const [form, setForm] = useState({ reason: "" as Reason | "", findings: "", recommendedAction: "", assignedTo: "" as EscalationTarget | "", reviewDeadline: "", agentName: "", platformName: "", balance: 0, variancePct: 0, alertType: "below_band" as AlertType });

  useEffect(() => {
    checkOverdue();
    setReports(getReports());
  }, []);

  function refresh() { setReports(getReports()); }

  function submitReport() {
    const report = createReport({
      ...form,
      createdAt: new Date().toISOString(),
      agentId: "", platformId: "",
      submittedBy: "Jo Chapman",
      submittedAt: new Date().toISOString(),
      status: "submitted",
    });
    setCreating(false);
    setSelected(report);
    refresh();
  }

  function signOff(report: InvestigationReport, notes: string) {
    updateReport(report.id, { status: "reviewed", reviewedBy: "Reviewer", reviewedAt: new Date().toISOString(), reviewNotes: notes });
    refresh();
    setSelected(getReports().find(r => r.id === report.id) ?? null);
  }

  const overdue = reports.filter(r => r.status === "overdue").length;

  if (selected) {
    return <ReportDetail report={selected} onBack={() => { setSelected(null); refresh(); }} onSignOff={signOff} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-text-primary">Investigation reports</h2>
          {overdue > 0 && (
            <span style={{ background: "#F8D7DA", color: "#721C24", fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 500 }}>
              {overdue} overdue
            </span>
          )}
        </div>
        <button
          onClick={() => setCreating(true)}
          className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary transition"
          style={{ color: "var(--teal)" }}
        >
          + New report
        </button>
      </div>

      {creating && (
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border" style={{ background: "#1B2E4B" }}>
            <div className="text-sm font-semibold text-white">New investigation report</div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Agent name</label>
                <input type="text" placeholder="Agent name" value={form.agentName} onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card text-text-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Platform</label>
                <input type="text" placeholder="Platform" value={form.platformName} onChange={e => setForm(f => ({ ...f, platformName: e.target.value }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card text-text-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Alert type</label>
                <select value={form.alertType} onChange={e => setForm(f => ({ ...f, alertType: e.target.value as AlertType }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card text-text-primary">
                  <option value="below_band">↓ Below band</option>
                  <option value="above_band">↑ Above band</option>
                  <option value="trend_down">↘ Trend down</option>
                  <option value="trend_up">↗ Trend up</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Reason</label>
                <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value as Reason }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card text-text-primary">
                  <option value="">Select reason…</option>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">Findings</label>
              <textarea rows={4} value={form.findings} onChange={e => setForm(f => ({ ...f, findings: e.target.value }))} placeholder="Describe what was observed when reviewing the account…" className="w-full border border-border rounded px-3 py-2 text-sm bg-card text-text-primary resize-y" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">Recommended action</label>
              <textarea rows={2} value={form.recommendedAction} onChange={e => setForm(f => ({ ...f, recommendedAction: e.target.value }))} placeholder="What action should be taken?" className="w-full border border-border rounded px-3 py-2 text-sm bg-card text-text-primary resize-y" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Assign to</label>
                <select value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value as EscalationTarget }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card text-text-primary">
                  <option value="">Select reviewer…</option>
                  {ESCALATION_TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Review deadline</label>
                <input type="date" value={form.reviewDeadline} onChange={e => setForm(f => ({ ...f, reviewDeadline: e.target.value }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card text-text-primary" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCreating(false)} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary transition">Cancel</button>
              <button
                onClick={submitReport}
                disabled={!form.agentName || !form.findings || !form.assignedTo || !form.reviewDeadline}
                className="text-xs px-4 py-1.5 rounded text-white transition disabled:opacity-40"
                style={{ background: "#1B2E4B" }}
              >
                Submit report
              </button>
            </div>
          </div>
        </div>
      )}

      {reports.length === 0 && !creating ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-text-secondary">
          No investigation reports yet. Reports are created when an alert is escalated.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-5 py-2.5">Ref</th>
                <th className="px-5 py-2.5">Agent</th>
                <th className="px-5 py-2.5">Alert</th>
                <th className="px-5 py-2.5">Assigned to</th>
                <th className="px-5 py-2.5">Deadline</th>
                <th className="px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr
                  key={r.id}
                  className="border-t border-border cursor-pointer hover:bg-secondary transition"
                  onClick={() => setSelected(r)}
                  style={{ borderLeft: r.status === "overdue" ? "3px solid #E74C3C" : "3px solid transparent" }}
                >
                  <td className="px-5 py-3 font-mono text-xs text-text-secondary">{r.ref}</td>
                  <td className="px-5 py-3 font-semibold text-text-primary">{r.agentName}</td>
                  <td className="px-5 py-3 text-xs text-text-secondary">{alertTypeLabel(r.alertType)}</td>
                  <td className="px-5 py-3 text-xs text-text-secondary">{r.assignedTo ? escalationLabel(r.assignedTo) : "—"}</td>
                  <td className="px-5 py-3 text-xs text-text-secondary">{r.reviewDeadline ? format(parseISO(r.reviewDeadline), "dd MMM yyyy") : "—"}</td>
                  <td className="px-5 py-3">{reportStatusPill(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Report detail ─────────────────────────────────────────────────────────────

function ReportDetail({ report, onBack, onSignOff }: { report: InvestigationReport; onBack: () => void; onSignOff: (r: InvestigationReport, notes: string) => void }) {
  const [notes, setNotes] = useState(report.reviewNotes ?? "");
  const [signing, setSigning] = useState(false);

  function handleExport() {
    const content = `INVESTIGATION REPORT — ${report.ref}
Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AGENT:       ${report.agentName}
PLATFORM:    ${report.platformName}
ALERT TYPE:  ${alertTypeLabel(report.alertType)}
BALANCE:     ${formatGBP(report.balance)}
VARIANCE:    ${report.variancePct >= 0 ? "+" : ""}${report.variancePct.toFixed(1)}%
REASON:      ${report.reason || "—"}

FINDINGS
${report.findings}

RECOMMENDED ACTION
${report.recommendedAction}

SIGN-OFF
Submitted by: ${report.submittedBy} on ${format(parseISO(report.submittedAt), "dd MMM yyyy HH:mm")}
Assigned to:  ${report.assignedTo ? escalationLabel(report.assignedTo) : "—"}
Deadline:     ${report.reviewDeadline ? format(parseISO(report.reviewDeadline), "dd MMM yyyy") : "—"}
${report.reviewedBy ? `Reviewed by: ${report.reviewedBy} on ${format(parseISO(report.reviewedAt!), "dd MMM yyyy HH:mm")}` : ""}
${report.reviewNotes ? `Review notes: ${report.reviewNotes}` : ""}
`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${report.ref}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm hover:underline" style={{ color: "var(--teal)" }}>← Back to reports</button>

      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-3" style={{ background: "#1B2E4B" }}>
          <div className="text-sm font-semibold text-white">Client account alert — investigation report</div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
            {report.ref} · Generated {format(parseISO(report.createdAt), "dd MMM yyyy HH:mm")}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5 border-b border-border">
          {[
            ["Agent", report.agentName],
            ["Platform", report.platformName],
            ["Alert type", alertTypeLabel(report.alertType)],
            ["Balance / Variance", `${formatGBP(report.balance)}  (${report.variancePct >= 0 ? "+" : ""}${report.variancePct.toFixed(1)}%)`],
          ].map(([label, value]) => (
            <div key={label} className="bg-secondary rounded-md px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-text-secondary">{label}</div>
              <div className="text-sm font-medium text-text-primary mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-b border-border">
          <div className="text-xs font-medium text-text-secondary mb-1">Reason</div>
          <div className="text-sm text-text-primary">{report.reason || "—"}</div>
        </div>

        <div className="px-5 py-4 border-b border-border">
          <div className="text-xs font-medium text-text-secondary mb-1">Findings</div>
          <div className="text-sm text-text-primary whitespace-pre-wrap">{report.findings}</div>
        </div>

        <div className="px-5 py-4 border-b border-border">
          <div className="text-xs font-medium text-text-secondary mb-1">Recommended action</div>
          <div className="text-sm text-text-primary whitespace-pre-wrap">{report.recommendedAction}</div>
        </div>

        <div className="px-5 py-4 border-b border-border space-y-3">
          <div className="text-xs font-medium text-text-primary">Sign-off chain</div>

          <div className="flex items-center justify-between p-3 rounded-md" style={{ background: "#EAF3DE" }}>
            <div className="flex items-center gap-2">
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#639922", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: "white" }}>JC</div>
              <div>
                <div className="text-xs font-medium" style={{ color: "#27500A" }}>Jo Chapman — Compliance</div>
                <div className="text-[10px]" style={{ color: "#3B6D11" }}>Submitted {format(parseISO(report.submittedAt), "dd MMM yyyy · HH:mm")}</div>
              </div>
            </div>
            <span style={{ fontSize: 10, background: "#639922", color: "white", padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>Submitted</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-md border border-border">
            <div className="flex items-center gap-2">
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-background-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: "var(--color-text-secondary)" }}>
                {report.assignedTo === "head_of_client_accounts" ? "HCA" : report.assignedTo === "ocean_parker" ? "OP" : "COO"}
              </div>
              <div>
                <div className="text-xs font-medium text-text-primary">{report.assignedTo ? escalationLabel(report.assignedTo) : "—"}</div>
                <div className="text-[10px] text-text-secondary">
                  {report.reviewDeadline ? `Review by ${format(parseISO(report.reviewDeadline), "dd MMM yyyy")}` : "No deadline set"}
                </div>
              </div>
            </div>
            {reportStatusPill(report.status)}
          </div>
        </div>

        {report.status === "submitted" || report.status === "overdue" ? (
          <div className="px-5 py-4 border-b border-border">
            <div className="text-xs font-medium text-text-secondary mb-2">Sign off — add review notes</div>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add review notes…"
              className="w-full border border-border rounded px-3 py-2 text-sm bg-card text-text-primary resize-y"
            />
          </div>
        ) : report.reviewNotes ? (
          <div className="px-5 py-4 border-b border-border">
            <div className="text-xs font-medium text-text-secondary mb-1">Review notes</div>
            <div className="text-sm text-text-primary">{report.reviewNotes}</div>
            <div className="text-[10px] text-text-secondary mt-1">
              Reviewed by {report.reviewedBy} · {report.reviewedAt ? format(parseISO(report.reviewedAt), "dd MMM yyyy HH:mm") : ""}
            </div>
          </div>
        ) : null}

        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-mono text-text-secondary">{report.ref}</span>
          <div className="flex items-center gap-2">
            <button onClick={handleExport} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary transition">
              ↓ Export
            </button>
            {(report.status === "submitted" || report.status === "overdue") && (
              <button
                onClick={() => onSignOff(report, notes)}
                className="text-xs px-4 py-1.5 rounded text-white"
                style={{ background: "#1B2E4B" }}
              >
                Sign off
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function ReportsPage() {
  const data = useDashboardData();
  const [tab, setTab] = useState<Tab>("log");

  const reports = getReports();
  const overdue = reports.filter(r => r.status === "overdue").length;

  return (
    <div className="min-h-screen bg-surface">
      <TopNav lastUpdated={data.lastUpdated} usingLiveData={data.usingLiveData} />
      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
          <p className="text-sm text-text-secondary">Alert log and investigation reports</p>
        </div>

        <div className="inline-flex overflow-hidden rounded-md border border-border text-sm">
          <button
            onClick={() => setTab("log")}
            className={`px-4 py-2 ${tab === "log" ? "text-white" : "text-text-secondary hover:bg-secondary"}`}
            style={{ background: tab === "log" ? "var(--navy)" : "white" }}
          >
            Daily log
          </button>
          <button
            onClick={() => setTab("reports")}
            className={`border-l border-border px-4 py-2 flex items-center gap-2 ${tab === "reports" ? "text-white" : "text-text-secondary hover:bg-secondary"}`}
            style={{ background: tab === "reports" ? "var(--navy)" : "white" }}
          >
            Investigation reports
            {overdue > 0 && (
              <span style={{ background: "#E74C3C", color: "white", fontSize: 10, padding: "1px 6px", borderRadius: 10, fontWeight: 600 }}>
                {overdue}
              </span>
            )}
          </button>
        </div>

        {tab === "log" ? <DailyLog usingLiveData={data.usingLiveData} /> : <InvestigationReports />}
      </main>
    </div>
  );
}
