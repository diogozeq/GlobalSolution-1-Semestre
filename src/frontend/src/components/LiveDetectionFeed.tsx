import { useMemo } from "react";
import type { Alert, NaturalEvent, Region } from "../types";
import { riskColor } from "../lib/risk";

interface Props {
  alerts: Alert[];
  events: NaturalEvent[];
  regions: Region[];
  onGenerateReport: (regionId: number) => void;
  reportLoadingRegionId: number | null;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "--:--:--";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.substring(11, 19) || "--:--:--";
  return d.toISOString().substring(11, 19) + " UTC";
}

export default function LiveDetectionFeed({
  alerts,
  events,
  regions,
  onGenerateReport,
  reportLoadingRegionId,
}: Props) {
  const regionName = useMemo(
    () => new Map(regions.map((r) => [r.id, r.name])),
    [regions],
  );

  return (
    <div className="flex-1 flex flex-col p-panel-padding bg-surface-container min-h-0">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-label-caps text-label-caps text-terminal-cyan uppercase tracking-widest">
          Live Detection Feed
        </h3>
        <span className="flex items-center gap-1 text-[10px] text-risk-low animate-pulse">
          <span className="w-1.5 h-1.5 bg-current rounded-full" /> LIVE
        </span>
      </div>

      <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
        {alerts.map((a) => {
          const color = riskColor(a.severity);
          const loading = reportLoadingRegionId === a.region_id;
          return (
            <div
              key={`alert-${a.id}`}
              className="flex gap-3 border-l-2 pl-3 pb-4 animate-fade-in"
              style={{ borderColor: color }}
            >
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-data-mono text-[10px] text-on-surface-variant">
                    {fmtTime(a.created_at)}
                  </span>
                  <span className="font-label-caps text-[10px]" style={{ color }}>
                    {a.severity === "Critico" ? "THERMAL ANOMALY" : "RISK RISING"}
                  </span>
                </div>
                <p className="text-body-sm font-medium mb-2">
                  <span className="text-terminal-cyan">{regionName.get(a.region_id) ?? `Região ${a.region_id}`}</span>
                  {" — "}
                  {a.reason}
                </p>
                <button
                  onClick={() => onGenerateReport(a.region_id)}
                  disabled={loading}
                  className="w-full py-1 border border-terminal-cyan/30 hover:bg-terminal-cyan hover:text-surface-container-lowest transition-all text-[10px] font-label-caps text-terminal-cyan rounded disabled:opacity-50"
                >
                  {loading ? "Gerando laudo..." : "Gerar Laudo AI"}
                </button>
              </div>
            </div>
          );
        })}

        {events.slice(0, 6).map((e) => (
          <div
            key={`event-${e.id}`}
            className="flex gap-3 border-l-2 border-outline-variant pl-3 pb-4 opacity-80"
          >
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <span className="font-data-mono text-[10px] text-on-surface-variant">
                  {fmtTime(e.started_at)}
                </span>
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">
                  {e.category || "EVENT"}
                </span>
              </div>
              <p className="text-body-sm font-medium">{e.title}</p>
            </div>
          </div>
        ))}

        {alerts.length === 0 && events.length === 0 && (
          <div className="flex gap-3 border-l-2 border-outline-variant pl-3 opacity-70">
            <div className="flex-1">
              <div className="font-data-mono text-[10px] text-on-surface-variant">SYSTEM LOG</div>
              <p className="text-body-sm">Sem detecções. Rode "Atualizar Dados" e "Recalcular Risco".</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
