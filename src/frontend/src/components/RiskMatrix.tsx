import { useMemo } from "react";
import type { Region, RiskItem } from "../types";
import { RISK_PRIORITY, levelLabel, riskColor } from "../lib/risk";

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

export default function RiskMatrix({ regions, risk, fires, selectedRegionId, onSelect }: Props) {
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

  return (
    <div className="p-panel-padding bg-surface-container-high">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-label-caps text-label-caps text-terminal-cyan uppercase tracking-widest">
          Risk Matrix
        </h3>
        <span className="material-symbols-outlined text-on-surface-variant text-[18px]">info</span>
      </div>

      <div className="space-y-3">
        {rows.map(({ region, item, fireCount }) => {
          const color = riskColor(item?.level);
          const glow =
            item?.level === "Critico"
              ? "risk-glow-critical"
              : item?.level === "Alto"
                ? "risk-glow-high"
                : "border border-outline-variant";
          const selected = selectedRegionId === region.id;
          return (
            <button
              key={region.id}
              onClick={() => onSelect(region.id)}
              className={`w-full text-left bg-surface-container-highest p-3 rounded-lg transition-all ${glow} ${
                selected ? "ring-1 ring-terminal-cyan" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-headline-md text-body-md font-bold text-on-surface">
                    {region.name}
                  </div>
                  <div className="text-[10px] text-on-surface-variant font-label-caps">
                    {region.state} Sectors
                  </div>
                </div>
                <div
                  className="px-2 py-0.5 rounded font-data-mono text-[12px] border"
                  style={{ color, borderColor: `${color}66`, background: `${color}22` }}
                >
                  {item ? item.score.toFixed(1) : `${fireCount}🔥`}
                </div>
              </div>
              <div className="w-full bg-surface-container rounded-full h-1.5 mb-2 overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: `${item ? item.score : Math.min(fireCount * 4, 100)}%`, background: color }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-label-caps text-on-surface-variant">
                <span>STATUS: {levelLabel(item?.level)}</span>
                <span>PRIORITY: {item ? RISK_PRIORITY[item.level] : "—"}</span>
              </div>
            </button>
          );
        })}
        {rows.length === 0 && (
          <div className="text-on-surface-variant text-body-sm py-6 text-center font-label-caps text-[10px]">
            AGUARDANDO DADOS DE INGESTÃO
          </div>
        )}
      </div>
    </div>
  );
}
