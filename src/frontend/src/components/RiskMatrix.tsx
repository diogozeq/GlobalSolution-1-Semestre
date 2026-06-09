import { useMemo, useState } from "react";
import type { Region, RiskItem } from "../types";
import { RISK_PRIORITY, levelLabel, riskBg, riskBorder, riskColor, riskGlowClass } from "../lib/risk";

interface Props {
  regions: Region[];
  risk: RiskItem[];
  fires: { region_id: number | null }[];
  selectedRegionId: number | null;
  onSelect: (id: number) => void;
}

interface Row {
  region: Region;
  item?: RiskItem;
  fireCount: number;
}

const LEVEL_FILTERS = [
  { key: null,       label: "Todos" },
  { key: "Critico",  label: "Crítico" },
  { key: "Alto",     label: "Alto" },
  { key: "Moderado", label: "Moderado" },
  { key: "Baixo",    label: "Baixo" },
] as const;

export default function RiskMatrix({ regions, risk, fires, selectedRegionId, onSelect }: Props) {
  const [levelFilter, setLevelFilter] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const riskMap = new Map(risk.map((r) => [r.region_id, r]));
    const counts = new Map<number, number>();
    for (const f of fires) {
      if (f.region_id != null) counts.set(f.region_id, (counts.get(f.region_id) ?? 0) + 1);
    }
    return regions
      .map((region) => ({
        region,
        item: riskMap.get(region.id),
        fireCount: counts.get(region.id) ?? 0,
      }))
      .sort((a, b) => (b.item?.score ?? b.fireCount) - (a.item?.score ?? a.fireCount));
  }, [regions, risk, fires]);

  const visibleRows = levelFilter ? rows.filter((r) => r.item?.level === levelFilter) : rows;

  return (
    <div className="p-4" style={{ background: "#0B141C" }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="font-data-mono text-[14px] text-terminal-cyan leading-none">▦</span>
          <span className="font-data-mono text-[10px] text-terminal-cyan tracking-widest uppercase">
            Matriz de Risco
          </span>
        </div>
        <span className="font-data-mono text-[10px] text-on-surface-variant">
          {visibleRows.length}/{rows.length}
        </span>
      </div>

      {/* Level filter chips */}
      <div className="flex gap-1 flex-wrap mb-3">
        {LEVEL_FILTERS.map(({ key, label }) => {
          const active = levelFilter === key;
          const color = key ? riskColor(key) : "#32D3C2";
          return (
            <button
              key={label}
              onClick={() => setLevelFilter(active ? null : key)}
              className="font-data-mono text-[9px] px-2 py-0.5 rounded-full transition-all duration-120"
              style={{
                background: active ? `${color}22` : "rgba(255,255,255,0.03)",
                color: active ? color : "#6F808A",
                border: `1px solid ${active ? `${color}55` : "#1B2A36"}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 mb-1.5">
        <span className="font-data-mono text-[9px] text-on-surface-variant tracking-widest uppercase">Região</span>
        <span className="font-data-mono text-[9px] text-on-surface-variant tracking-widest uppercase">Score</span>
        <span className="font-data-mono text-[9px] text-on-surface-variant tracking-widest uppercase">Nível</span>
      </div>

      <div className="space-y-1.5">
        {visibleRows.map(({ region, item, fireCount }) => {
          const color   = riskColor(item?.level);
          const bg      = riskBg(item?.level);
          const border  = riskBorder(item?.level);
          const glow    = riskGlowClass(item?.level);
          const isSel   = selectedRegionId === region.id;
          const score   = item ? item.score : Math.min(fireCount * 6, 100);
          const pct     = `${score.toFixed(0)}%`;

          return (
            <button
              key={region.id}
              onClick={() => onSelect(region.id)}
              className={`w-full text-left rounded p-3 transition-all duration-150 ${glow}`}
              style={{
                background: isSel ? "rgba(50,211,194,0.06)" : "#101B24",
                border: isSel
                  ? "1px solid rgba(50,211,194,0.45)"
                  : `1px solid ${border}`,
                boxShadow: isSel ? "0 0 16px rgba(50,211,194,0.14)" : undefined,
              }}
            >
              {/* Row top */}
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-on-surface truncate">
                    {region.name}
                  </div>
                  <div className="font-data-mono text-[9px] text-on-surface-variant tracking-wider">
                    {region.state} · {item ? `${fireCount} focos` : `${fireCount} foco(s)`}
                  </div>
                </div>

                {/* Score + Level badge */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="font-data-mono text-[13px] font-semibold tabular-nums"
                    style={{ color }}
                  >
                    {item ? item.score.toFixed(1) : "--"}
                  </span>
                  <span
                    className="font-data-mono text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide"
                    style={{ background: bg, color }}
                  >
                    {levelLabel(item?.level)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div
                className="w-full h-1 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: pct, background: color, opacity: 0.85 }}
                />
              </div>

              {/* Footer row */}
              <div className="flex justify-between mt-1.5">
                <span className="font-data-mono text-[9px] text-on-surface-variant">
                  {item?.explanation?.substring(0, 42) ?? "Aguardando cálculo de risco"}
                  {item?.explanation && item.explanation.length > 42 ? "…" : ""}
                </span>
                {item && (
                  <span
                    className="font-data-mono text-[9px] font-bold"
                    style={{ color }}
                  >
                    {RISK_PRIORITY[item.level]}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {visibleRows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="font-data-mono text-[24px] text-on-surface-variant opacity-40 leading-none">⌁</span>
            <p className="font-data-mono text-[10px] text-on-surface-variant opacity-60">
              Nenhum dado de risco calculado.
            </p>
            <p className="font-data-mono text-[9px] text-on-surface-variant opacity-40">
              Execute ingestão e recalcule.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
