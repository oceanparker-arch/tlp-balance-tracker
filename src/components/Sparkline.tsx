import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import type { DataPoint } from "@/data/mockData";

export function Sparkline({ data, color = "#2E7D8A", height = 60 }: { data: DataPoint[]; color?: string; height?: number }) {
  // Show full 12 months
  const slice = data.slice(-365);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={slice} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="balance" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
