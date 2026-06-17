import { useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Scatter,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { BollingerPoint } from "@/data/bollinger";
import { formatGBP } from "@/lib/format";

interface Props {
  data: BollingerPoint[];
  height?: number;
  showWdAxis?: boolean; // when true, x labels are WD numbers (single-month view)
}

export function BollingerChart({ data, height = 320, showWdAxis = false }: Props) {
  const monthMarks = useMemo(() => {
    if (showWdAxis) return [];
    const marks: { date: string; label: string }[] = [];
    let lastMonth = "";
    for (const d of data) {
      const m = d.date.slice(0, 7);
      if (m !== lastMonth) {
        marks.push({ date: d.date, label: format(parseISO(d.date), "MMM") });
        lastMonth = m;
      }
    }
    return marks;
  }, [data, showWdAxis]);

  const breakouts = data.filter((d) => d.breakout);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="bbFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1F4E79" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#1F4E79" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey={showWdAxis ? "wd" : "date"}
            tick={showWdAxis ? { fill: "#718096", fontSize: 11 } : false}
            tickLine={false}
            axisLine={{ stroke: "#E2E8F0" }}
            interval="preserveStartEnd"
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
                  <div className="mt-0.5" style={{ color }}>{status} · WD {p.wd}</div>
                </div>
              );
            }}
          />
          {/* Band fill: render upper as area, then lower as area in background fill */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill="url(#bbFill)"
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="#F8F9FA"
            activeDot={false}
            isAnimationActive={false}
          />
          {!showWdAxis && monthMarks.map((m) => (
            <ReferenceLine
              key={m.date}
              x={m.date}
              stroke="#E2E8F0"
              strokeDasharray="2 3"
              label={{ value: m.label, position: "insideTop", fill: "#A0AEC0", fontSize: 10, dy: -4 }}
            />
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
            dot={false}
            isAnimationActive={false}
          />
          <Scatter data={breakouts} dataKey="balance" fill="#E74C3C" shape="circle" isAnimationActive={false} />
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
