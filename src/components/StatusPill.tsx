type Status = "within" | "above" | "below";

const map: Record<Status, { label: string; bg: string; fg: string }> = {
  within: { label: "Within band", bg: "rgba(46,125,138,0.12)", fg: "#2E7D8A" },
  above:  { label: "↑ Above band", bg: "rgba(200,119,58,0.14)", fg: "#C8773A" },
  below:  { label: "↓ Below band", bg: "rgba(231,76,60,0.12)",  fg: "#E74C3C" },
};

export function StatusPill({ status, pct }: { status: Status; pct?: number }) {
  const s = map[status];
  const pctStr = pct != null && status !== "within" ? ` · ${Math.abs(pct).toFixed(1)}%` : "";
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}{pctStr}
    </span>
  );
}

// pct = 90-day % change, label = e.g. "90d"
export function TrendArrow({
  trend,
  pct,
  label,
}: {
  trend: "up" | "down" | "flat";
  pct?: number;
  label?: string;
}) {
  const pctStr = pct != null ? ` ${Math.abs(pct).toFixed(1)}%` : "";
  const suffix = label ? ` (${label})` : "";
  if (trend === "up")
    return <span style={{ color: "#27AE60" }}>↗{pctStr}{suffix}</span>;
  if (trend === "down")
    return <span style={{ color: "#E74C3C" }}>↘{pctStr}{suffix}</span>;
  return <span style={{ color: "#718096" }}>→{suffix}</span>;
}

export function PlatformBadge({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: "var(--navy)", color: "white" }}
    >
      {name}
    </span>
  );
}
