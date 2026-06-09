import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { getRiskHistory } from "../services/api";
import { riskColor } from "../lib/risk";
import type { RiskHistoryPoint } from "../types";

export default function RiskHistorySparkline({ regionId, level }: { regionId: number; level?: string }) {
  const [data, setData] = useState<RiskHistoryPoint[]>([]);

  useEffect(() => {
    let ok = true;
    getRiskHistory(regionId)
      .then((d) => ok && setData(d))
      .catch(() => undefined);
    return () => {
      ok = false;
    };
  }, [regionId]);

  if (data.length < 2) {
    return (
      <div className="font-data-mono text-[9px] text-on-surface-variant opacity-50">
        histórico insuficiente — recalcule o risco algumas vezes
      </div>
    );
  }

  const color = riskColor(level);
  const chartData = data.map((p, i) => ({ i, score: p.score }));
  const delta = data[data.length - 1].score - data[0].score;
  const deltaColor = delta > 1 ? "#FF5A2D" : delta < -1 ? "#22D47B" : "#6F808A";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-data-mono text-[9px] text-on-surface-variant tracking-wider uppercase">
          Tendência · {data.length} medições
        </span>
        <span className="font-data-mono text-[9px]" style={{ color: deltaColor }}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "▬"} {Math.abs(delta).toFixed(1)} pts
        </span>
      </div>
      <ResponsiveContainer width="100%" height={36}>
        <LineChart data={chartData} margin={{ top: 3, bottom: 3, left: 0, right: 0 }}>
          <YAxis hide domain={[0, 100]} />
          <Line
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
