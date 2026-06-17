import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import type { DataPoint } from "@/data/mockData";

export function Sparkline({
  data,
  color = "#2E7D8A",
  height = 60,
}: {
  data: DataPoint[];
  color?: string;
  height?: number;
}) {
  const slice = data.slice(-365);

  // Compute simple linear regression trendline
  const n = slice.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += slice[i].balance;
    sumXY += i * slice[i].balance; sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  const slope = denom ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;

  const chartData = slice.map((d, i) => ({
    ...d,
    trendVal: intercept + slope * i,
  }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="balance"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="trendVal"
            stroke="#AAAAAA"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
