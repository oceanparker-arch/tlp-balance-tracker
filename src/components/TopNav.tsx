import { format } from "date-fns";
import { Link } from "@tanstack/react-router";

export function TopNav({ lastUpdated }: { lastUpdated: Date }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border" style={{ background: "var(--navy)" }}>
      <div className="mx-auto flex h-14 max-w-[1400px] items-center px-6">
        <Link to="/" className="text-[20px] font-bold tracking-tight text-white">TLP</Link>
        <div className="ml-6 flex-1 text-sm font-normal text-white/90">Client Account Monitor</div>
        <div className="text-right text-xs text-white/70">
          <div>{format(new Date(), "EEE dd MMM yyyy")}</div>
          <div className="text-white/50">Last updated: {format(lastUpdated, "HH:mm")}</div>
        </div>
      </div>
    </header>
  );
}
