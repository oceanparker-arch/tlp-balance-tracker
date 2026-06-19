import { format } from "date-fns";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

export function TopNav({
  lastUpdated,
  usingLiveData = false,
}: {
  lastUpdated: Date;
  usingLiveData?: boolean;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await fetch("http://localhost:5000/api/refresh", { method: "POST" });
      if (res.ok) {
        setRefreshMsg("✓ Data refreshed");
        setTimeout(() => { setRefreshMsg(null); window.location.reload(); }, 1500);
      } else {
        setRefreshMsg("Refresh failed");
      }
    } catch {
      setRefreshMsg("Server not reachable");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border" style={{ background: "var(--navy)" }}>
      <div className="mx-auto flex h-14 max-w-[1400px] items-center px-6">
        <Link to="/" className="text-[20px] font-bold tracking-tight text-white">TLP</Link>
        <div className="ml-6 text-sm font-normal text-white/90">Client Account Monitor</div>

        <nav className="ml-8 flex items-center gap-5 text-sm">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="text-white/70 hover:text-white"
            activeProps={{ className: "text-white font-semibold" }}
          >
            Dashboard
          </Link>
          <Link
            to="/import"
            className="text-white/70 hover:text-white"
            activeProps={{ className: "text-white font-semibold" }}
          >
            Import data
          </Link>
          <Link
            to="/reports"
            className="text-white/70 hover:text-white"
            activeProps={{ className: "text-white font-semibold" }}
          >
            Reports
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition"
            style={{
              borderColor: "rgba(255,255,255,0.25)",
              color: refreshMsg?.startsWith("✓") ? "#82E0AA" : "rgba(255,255,255,0.7)",
              background: "transparent",
              cursor: refreshing ? "not-allowed" : "pointer",
              opacity: refreshing ? 0.6 : 1,
            }}
            title="Refresh data from S: drive"
          >
            <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none", fontSize: 13 }}>↻</span>
            {refreshMsg ?? (refreshing ? "Refreshing…" : "Refresh data")}
          </button>

          {/* Live data indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: usingLiveData ? "#27AE60" : "#888",
                boxShadow: usingLiveData ? "0 0 0 3px rgba(39,174,96,0.25)" : "none",
              }}
            />
            <span className={usingLiveData ? "text-green-300" : "text-white/40"}>
              {usingLiveData ? "Live data" : "Mock data"}
            </span>
          </div>

          <div className="text-right text-xs text-white/70">
            <div>{format(new Date(), "EEE dd MMM yyyy")}</div>
            <div className="text-white/50">Updated: {format(lastUpdated, "HH:mm")}</div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </header>
  );
}
