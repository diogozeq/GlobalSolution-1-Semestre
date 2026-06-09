import { useMemo, useState } from "react";
import type { Alert, NaturalEvent, Region } from "../types";
import { riskBg, riskColor } from "../lib/risk";

interface Props {
  alerts: Alert[];
  events: NaturalEvent[];
  regions: Region[];
  onGenerateReport: (regionId: number) => void;
  onAcknowledge: (alertId: number) => void;
  onClose: (alertId: number) => void;
  reportLoadingRegionId: number | null;
  disableReports: boolean;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.substring(11, 16) || "--:--";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

const STATUS_LABEL: Record<string, string> = {
  open:   "ABERTO",
  ack:    "RECONHECIDO",
  closed: "FECHADO",
};

type TypeFilter = "all" | "alertas" | "eventos";

export default function LiveDetectionFeed({
  alerts, events, regions,
  onGenerateReport, onAcknowledge, onClose,
  reportLoadingRegionId, disableReports,
}: Props) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const regionName = useMemo(
    () => new Map(regions.map((r) => [r.id, r.name])),
    [regions],
  );

  const showAlerts = typeFilter !== "eventos";
  const showEvents = typeFilter !== "alertas";

  return (
    <div className="flex-1 flex flex-col p-4 min-h-0" style={{ background: "#0B141C" }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="font-data-mono text-[12px] text-risk-high leading-none">!</span>
          <span className="font-data-mono text-[10px] text-terminal-cyan tracking-widest uppercase">
            Feed de Detecções
          </span>
        </div>
        <span className="flex items-center gap-1.5 font-data-mono text-[9px] text-risk-low">
          <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse-dot" />
          AO VIVO
        </span>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-1 mb-3">
        {(["all", "alertas", "eventos"] as TypeFilter[]).map((f) => {
          const label = f === "all" ? "Todos" : f === "alertas" ? "Alertas" : "Eventos";
          const count = f === "all" ? alerts.length + events.length : f === "alertas" ? alerts.length : events.length;
          const active = typeFilter === f;
          return (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className="font-data-mono text-[9px] px-2 py-0.5 rounded-full transition-all duration-120 flex items-center gap-1"
              style={{
                background: active ? "rgba(50,211,194,0.1)" : "rgba(255,255,255,0.03)",
                color: active ? "#32D3C2" : "#6F808A",
                border: `1px solid ${active ? "rgba(50,211,194,0.3)" : "#1B2A36"}`,
              }}
            >
              {label}
              <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-0.5">
        {showAlerts && alerts.map((a) => {
          const color   = riskColor(a.severity);
          const bg      = riskBg(a.severity);
          const loading = reportLoadingRegionId === a.region_id;
          return (
            <div
              key={`alert-${a.id}`}
              className="rounded p-3 animate-fade-in"
              style={{
                background: bg,
                borderLeft: `3px solid ${color}`,
                border: `1px solid ${color}33`,
                borderLeftWidth: "3px",
              }}
            >
              {/* Top row */}
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span
                  className="font-data-mono text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full"
                  style={{ background: `${color}22`, color }}
                >
                  {a.severity === "Critico" ? "ANOMALIA TÉRMICA" : "RISCO EM ALTA"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-data-mono text-[9px] text-on-surface-variant">
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                  <span className="font-data-mono text-[9px] text-on-surface-variant opacity-60">
                    {fmtTime(a.created_at)}
                  </span>
                </div>
              </div>

              {/* Body */}
              <p className="text-[12px] font-medium mb-2 leading-snug">
                <span style={{ color: "#32D3C2" }}>{regionName.get(a.region_id) ?? `Região ${a.region_id}`}</span>
                <span className="text-on-surface-variant mx-1">—</span>
                <span className="text-on-surface">{a.reason}</span>
              </p>

              {/* Score */}
              {a.score > 0 && (
                <div className="mb-2">
                  <div className="w-full h-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${a.score}%`, background: color }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="font-data-mono text-[9px] text-on-surface-variant">Score</span>
                    <span className="font-data-mono text-[9px]" style={{ color }}>{a.score.toFixed(1)}/100</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => onGenerateReport(a.region_id)}
                  disabled={loading || disableReports}
                  className="flex-1 py-1.5 rounded text-[10px] font-data-mono font-semibold tracking-wide
                             transition-all duration-120 disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg, #FF5A2D 0%, #FF3347 100%)",
                    color: "#E8F0F2",
                  }}
                >
                  {loading ? "Gerando..." : "Gerar Laudo IA"}
                </button>
                <button
                  onClick={() => onAcknowledge(a.id)}
                  disabled={a.status !== "open"}
                  className="flex-1 py-1.5 rounded text-[10px] font-data-mono tracking-wide
                             border border-outline-variant text-on-surface-variant
                             hover:border-risk-low hover:text-risk-low
                             transition-all duration-120 disabled:opacity-30"
                >
                  Reconhecer
                </button>
                <button
                  onClick={() => onClose(a.id)}
                  disabled={a.status === "closed"}
                  aria-label="Fechar alerta"
                  title="Encerrar alerta"
                  className="px-2.5 py-1.5 rounded text-[10px] font-data-mono tracking-wide
                             border border-outline-variant text-on-surface-variant
                             hover:border-risk-critical hover:text-risk-critical
                             transition-all duration-120 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        {/* Natural events */}
        {showEvents && events.slice(0, 15).map((e) => (
          <div
            key={`event-${e.id}`}
            className="rounded p-3 opacity-75"
            style={{ background: "#101B24", border: "1px solid #1B2A36", borderLeft: "3px solid #5EBBFF" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-data-mono text-[9px] tracking-wider text-data-cyan uppercase">
                {e.category || "EVENTO NATURAL"}
              </span>
              <span className="font-data-mono text-[9px] text-on-surface-variant opacity-60">
                {fmtTime(e.started_at)}
              </span>
            </div>
            <p className="text-[12px] text-on-surface">{e.title}</p>
          </div>
        ))}

        {/* Empty state */}
        {alerts.length === 0 && events.length === 0 && (
          <div
            className="rounded p-4 flex flex-col items-center gap-2 text-center"
            style={{ background: "#101B24", border: "1px solid #1B2A36" }}
          >
            <span className="font-data-mono text-[22px] text-on-surface-variant opacity-30 leading-none">◎</span>
            <p className="font-data-mono text-[10px] text-on-surface-variant opacity-60">
              Nenhuma detecção ativa.
            </p>
            <p className="font-data-mono text-[9px] text-on-surface-variant opacity-40">
              Execute "Atualizar" → "Recalcular Risco".
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
