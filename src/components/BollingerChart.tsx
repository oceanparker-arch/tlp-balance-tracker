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

// Recharts band fill trick: render a "bandwidth" area stacked on top of lower.
// We pass lower as the baseline and (upper - lower) as the value so the fill
// sits exactly between the two bands.
function buildBandData(data: BollingerPoint[]) {
  return data.map((d) => ({
    ...d,
    bandBase: d.lower,
    bandWidth: Math.max(0, d.upper - d.lower),
  }));
}

export function BollingerChart({ data, height = 320, showWdAxis = false }: Props) {
  const bandData = useMemo(() => buildBandData(data), [data]);

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

  // Custom dot renderer for breakout points — sits exactly on the balance line
  const BreakoutDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload?.breakout || cx == null || cy == null) return null;
    const fill = payload.breakout === "above" ? "#E74C3C" : "#E74C3C";
    return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="#fff" strokeWidth={1.5} />;
  };

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <ComposedChart data={bandData} margin={{ top: 28, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="bbGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4A90D9" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#4A90D9" stopOpacity={0.10} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey={showWdAxis ? "wd" : "date"}
            tick={showWdAxis ? { fill: "#718096", fontSize: 11 } : false}
            tickLine={false}
            axisLine={{ stroke: "#E2E8F0" }}
          />
          <YAxis
            tickFormatter={(v) => formatGBP(v, { compact: true })}
            tick={{ fill: "#718096", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={60}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as BollingerPoint;
              const status = p.breakout === "above" ? "Above upper band" : p.breakout === "below" ? "Below lower band" : "Within band";
              const color = p.breakout ? "#E74C3C" : "#27AE60";
              return (
                <div className="rounded-md border border-border bg-white px-3 py-2 text-xs shadow-md">
                  <div className="font-semibold text-text-primary mb-1">
                    {showWdAxis ? `WD ${p.wd}` : format(parseISO(p.date), "EEE dd MMM yyyy")}
                  </div>
                  <div className="text-text-primary">{formatGBP(p.balance)}</div>
                  <div className="mt-0.5 font-medium" style={{ color }}>{status}</div>
                  <div className="mt-1 text-text-secondary border-t border-border pt-1">
                    <span>Upper: {formatGBP(p.upper)}</span>
                    <span className="mx-2">·</span>
                    <span>Lower: {formatGBP(p.lower)}</span>
                  </div>
                </div>
              );
            }}
          />

          {/* Band base — invisible, just sets the floor for the stacked area */}
          <Area
            type="monotone"
            dataKey="bandBase"
            stroke="none"
            fill="none"
            legendType="none"
            isAnimationActive={false}
            activeDot={false}
          />

          {/* Band width — fills from lower to upper with light blue */}
          <Area
            type="monotone"
            dataKey="bandWidth"
            stackId="band"
            stroke="rgba(74,144,217,0.3)"
            strokeWidth={0.5}
            fill="url(#bbGrad)"
            legendType="none"
            isAnimationActive={false}
            activeDot={false}
            baseValue="bandBase"
          />

          {/* Month separator lines with labels */}
          {!showWdAxis && monthMarks.map((m) => (
            <ReferenceLine
              key={m.date}
              x={m.date}
              stroke="#CBD5E0"
              strokeDasharray="3 4"
              strokeWidth={1}
              label={{
                value: m.label,
                position: "insideTopLeft",
                fill: "#A0AEC0",
                fontSize: 11,
                dy: -22,
              }}
            />
          ))}

          {/* Trendline — dashed grey */}
          <Line
            type="monotone"
            dataKey="trend"
            stroke="#AAAAAA"
            strokeDasharray="5 4"
            strokeWidth={1}
            dot={false}
            legendType="none"
            isAnimationActive={false}
          />

          {/* Closing balance — solid dark blue line with breakout dots */}
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#1F4E79"
            strokeWidth={2}
            dot={<BreakoutDot />}
            activeDot={{ r: 4, fill: "#1F4E79" }}
            isAnimationActive={false}
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
        <span className="block h-3 w-6 rounded-sm" style={{ background: "rgba(74,144,217,0.18)", border: "0.5px solid rgba(74,144,217,0.35)" }} />
        Expected range ±2σ
      </div>
      <div className="flex items-center gap-2">
        <span className="block w-6" style={{ borderTop: "1.5px dashed #AAAAAA" }} />
        Trendline
      </div>
      <div className="flex items-center gap-2">
        <span className="block h-2.5 w-2.5 rounded-full" style={{ background: "#E74C3C" }} />
        Breakout flag
      </div>
    </div>
  );
}
