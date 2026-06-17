import { useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { BollingerPoint } from "@/data/bollinger";
import { formatGBP } from "@/lib/format";

interface Props {
  data: BollingerPoint[];
  height?: number;
  showWdAxis?: boolean;
}

interface ChartPoint extends BollingerPoint {
  band: [number, number]; // [lower, upper] — Recharts renders Area as a range
}

export function BollingerChart({ data, height = 320, showWdAxis = false }: Props) {
  const chartData: ChartPoint[] = useMemo(
    () => data.map((d) => ({ ...d, band: [d.lower, d.upper] as [number, number] })),
    [data],
  );

  // Month metadata: first date (for separator line) and centre date (for label tick).
  const monthMeta = useMemo(() => {
    if (showWdAxis) return { starts: [] as string[], centres: new Map<string, string>() };
    const groups = new Map<string, string[]>();
    for (const d of data) {
      const k = d.date.slice(0, 7);
      const arr = groups.get(k) ?? [];
      arr.push(d.date);
      groups.set(k, arr);
    }
    const starts: string[] = [];
    const centres = new Map<string, string>(); // date -> label
    for (const [, dates] of groups) {
      starts.push(dates[0]);
      const mid = dates[Math.floor(dates.length / 2)];
      centres.set(mid, format(parseISO(mid), "MMM"));
    }
    return { starts, centres };
  }, [data, showWdAxis]);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
          <XAxis
            dataKey={showWdAxis ? "wd" : "date"}
            tick={
              showWdAxis
                ? { fill: "#718096", fontSize: 11 }
                : ({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
                    const label = monthMeta.centres.get(payload.value);
                    if (!label) return <g />;
                    return (
                      <text x={x} y={y + 14} textAnchor="middle" fill="#A0AEC0" fontSize={11}>
                        {label}
                      </text>
                    );
                  }
            }
            tickLine={false}
            axisLine={{ stroke: "#E2E8F0" }}
            interval={0}
          />
          <YAxis
            tickFormatter={(v) => formatGBP(v, { compact: true })}
            tick={{ fill: "#718096", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as BollingerPoint;
              const status = p.breakout === "above" ? "Above band" : p.breakout === "below" ? "Below band" : "Within band";
              const color = p.breakout ? "#E74C3C" : "#27AE60";
              return (
                <div className="rounded-md border border-border bg-white px-3 py-2 text-xs shadow-md">
                  <div className="font-medium text-text-primary">{format(parseISO(p.date), "EEE dd MMM yyyy")}</div>
                  <div className="mt-1 text-text-primary">{formatGBP(p.balance)}</div>
                  <div className="mt-0.5" style={{ color }}>{status}</div>
                </div>
              );
            }}
          />

          {/* Band fill between lower and upper — single Area rendered as a range. */}
          <Area
            type="monotone"
            dataKey="band"
            stroke="none"
            fill="#1F4E79"
            fillOpacity={0.18}
            activeDot={false}
            isAnimationActive={false}
          />

          {!showWdAxis && monthMeta.starts.map((d) => (
            <ReferenceLine key={d} x={d} stroke="#CBD5E0" strokeDasharray="3 4" />
          ))}

          <Line
            type="monotone"
            dataKey="trend"
            stroke="#999"
            strokeDasharray="4 4"
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#1F4E79"
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; payload?: BollingerPoint; index?: number }) => {
              const { cx, cy, payload, index } = props;
              if (cx == null || cy == null || !payload || !payload.breakout) {
                return <g key={`d-${index ?? 0}`} />;
              }
              return (
                <circle
                  key={`b-${index ?? 0}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill="#E74C3C"
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              );
            }}
            activeDot={{ r: 5, fill: "#1F4E79", stroke: "#fff", strokeWidth: 1.5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-secondary">
      <div className="flex items-center gap-2">
        <span className="block h-0.5 w-6" style={{ background: "#1F4E79" }} />
        Closing balance
      </div>
      <div className="flex items-center gap-2">
        <span className="block h-3 w-6 rounded-sm" style={{ background: "rgba(31,78,121,0.2)" }} />
        Expected range ±2σ
      </div>
      <div className="flex items-center gap-2">
        <span className="block h-0 w-6 border-t border-dashed" style={{ borderColor: "#999" }} />
        Trendline
      </div>
      <div className="flex items-center gap-2">
        <span className="block h-2 w-2 rounded-full" style={{ background: "#E74C3C" }} />
        Breakout flag
      </div>
    </div>
  );
}
