export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
      style={{ background: "rgba(39,174,96,0.14)", color: "#1d8049" }}
      title="Imported live data"
    >
      <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "#27AE60" }} />
      Live
    </span>
  );
}
