import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { TopNav } from "@/components/TopNav";
import { LiveBadge } from "@/components/LiveBadge";
import { platforms } from "@/data/mockData";
import {
  parsePastedData,
  saveImportedAgent,
  listImportedAgents,
  removeImportedAgent,
  buildAgentIdFromName,
  platformNameFor,
  type ParseResult,
} from "@/data/importedAgents";
import { formatGBP } from "@/lib/format";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import Data · TLP Monitor" },
      { name: "description", content: "Import live client account balance data for a specific letting agent." },
    ],
  }),
  component: ImportPage,
});

const SAMPLE = `05/05/2026\t£62,020.36
06/05/2026\t£58,400.00
07/05/2026\t£41,200.50`;

function ImportPage() {
  const navigate = useNavigate();
  const [platformId, setPlatformId] = useState(platforms[0].id);
  const [agentName, setAgentName] = useState("");
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [imports, setImports] = useState(() => listImportedAgents());

  const canParse = raw.trim().length > 0;
  const canConfirm = !!parsed && parsed.rows.length > 0 && agentName.trim().length > 0;

  const previewStats = useMemo(() => {
    if (!parsed || !parsed.rows.length) return null;
    const balances = parsed.rows.map((r) => r.balance);
    return {
      rows: parsed.rows.length,
      min: Math.min(...balances),
      max: Math.max(...balances),
      first: parsed.rows[0].date,
      last: parsed.rows[parsed.rows.length - 1].date,
    };
  }, [parsed]);

  const handleParse = () => {
    setConfirmMsg(null);
    const result = parsePastedData(raw);
    setParsed(result);
  };

  const handleConfirm = () => {
    if (!parsed || !agentName.trim()) return;
    const agentId = buildAgentIdFromName(agentName);
    saveImportedAgent({
      platformId,
      platformName: platformNameFor(platformId),
      agentId,
      agentName: agentName.trim(),
      points: parsed.rows,
      importedAt: new Date().toISOString(),
    });
    setImports(listImportedAgents());
    setConfirmMsg(`Loaded ${parsed.rows.length} rows for ${agentName.trim()}.`);
    // navigate to the agent detail page
    setTimeout(() => {
      navigate({ to: "/agent/$platformId/$agentId", params: { platformId, agentId } });
    }, 600);
  };

  const handleRemove = (pid: string, aid: string) => {
    removeImportedAgent(pid, aid);
    setImports(listImportedAgents());
  };

  return (
    <div className="min-h-screen bg-surface">
      <TopNav lastUpdated={new Date()} />
      <main className="mx-auto max-w-[1100px] space-y-6 px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Import client account data</h1>
          <p className="text-sm text-text-secondary">
            Paste raw closing balance data for a specific agent. Imported data overrides the mock series for that agent and persists in this browser.
          </p>
        </div>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-secondary">
                Platform
              </label>
              <select
                value={platformId}
                onChange={(e) => setPlatformId(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--teal)]"
              >
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-secondary">
                Agent name
              </label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value.slice(0, 100))}
                placeholder="e.g. Acme Lettings"
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--teal)]"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-secondary">
              Pasted data (date and balance, tab or whitespace separated)
            </label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={SAMPLE}
              spellCheck={false}
              rows={14}
              className="w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--teal)]"
            />
            <p className="mt-1 text-xs text-text-secondary">
              Supports formats like <code>05/05/2026 62020.36</code> or <code>05/05/2026 £62,020.36</code>. Blank lines are ignored.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleParse}
              disabled={!canParse}
              className="inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--teal)" }}
            >
              Parse
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--navy)" }}
            >
              Confirm &amp; Load
            </button>
            {confirmMsg && (
              <span className="text-sm font-medium" style={{ color: "#1d8049" }}>
                ✓ {confirmMsg}
              </span>
            )}
          </div>
        </section>

        {parsed && (
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary">Parse preview</h2>
              {previewStats && (
                <div className="text-xs text-text-secondary">
                  {previewStats.rows} rows · {format(parseISO(previewStats.first), "dd MMM yyyy")} → {format(parseISO(previewStats.last), "dd MMM yyyy")} ·
                  {" "}min {formatGBP(previewStats.min)} · max {formatGBP(previewStats.max)}
                </div>
              )}
            </div>

            {parsed.errors.length > 0 && (
              <div
                className="mb-3 rounded-md border px-3 py-2 text-xs"
                style={{ background: "rgba(231,76,60,0.08)", borderColor: "rgba(231,76,60,0.3)", color: "#a4271c" }}
              >
                <div className="font-semibold">Skipped {parsed.errors.length} line{parsed.errors.length === 1 ? "" : "s"}:</div>
                <ul className="mt-1 space-y-0.5">
                  {parsed.errors.slice(0, 5).map((e) => (
                    <li key={e.line}>Line {e.line}: {e.reason} — “{e.text}”</li>
                  ))}
                  {parsed.errors.length > 5 && <li>…and {parsed.errors.length - 5} more.</li>}
                </ul>
              </div>
            )}

            <div className="max-h-[360px] overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((r) => (
                    <tr key={r.date} className="border-t border-border">
                      <td className="px-4 py-1.5 tabular-nums">{format(parseISO(r.date), "EEE dd MMM yyyy")}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{formatGBP(r.balance)}</td>
                    </tr>
                  ))}
                  {!parsed.rows.length && (
                    <tr><td colSpan={2} className="px-4 py-6 text-center text-text-secondary">No valid rows parsed.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-text-primary">Currently imported agents</h2>
          {imports.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
              No agents imported yet. The dashboard is showing mock data for everyone.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {imports.map((i) => (
                <li key={`${i.platformId}-${i.agentId}`} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{i.agentName}</span>
                    <LiveBadge />
                    <span className="text-xs text-text-secondary">{i.platformName} · {i.points.length} rows</span>
                  </div>
                  <button
                    onClick={() => handleRemove(i.platformId, i.agentId)}
                    className="text-xs font-medium text-text-secondary hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
