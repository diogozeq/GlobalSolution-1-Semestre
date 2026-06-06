import type { ReportResult } from "../types";
import { riskColor } from "../lib/risk";

interface Props {
  report: ReportResult | null;
  loading: boolean;
  regionName?: string;
}

export default function ReportView({ report, loading, regionName }: Props) {
  return (
    <div className="flex-1 p-6 overflow-y-auto border-r border-outline-variant min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-terminal-cyan" style={{ fontVariationSettings: "'FILL' 1" }}>
          description
        </span>
        <h3 className="font-label-caps text-label-caps text-terminal-cyan">
          Relatório Técnico OrbitGuard AI
        </h3>
        {regionName && (
          <span className="font-data-mono text-[10px] text-on-surface-variant">/ {regionName}</span>
        )}
      </div>

      {loading && (
        <div className="bg-surface-container p-4 rounded-lg border border-outline-variant/30 animate-pulse text-on-surface-variant font-data-mono text-body-sm">
          Gerando laudo com IA Generativa...
        </div>
      )}

      {!loading && !report && (
        <div className="bg-surface-container p-4 rounded-lg border border-outline-variant/30 text-on-surface-variant text-body-sm">
          Selecione uma região com risco e clique em <span className="text-terminal-cyan">"Gerar Laudo AI"</span> para
          produzir um laudo técnico baseado nas evidências dos dados.
        </div>
      )}

      {!loading && report && !report.available && (
        <div className="bg-surface-container p-4 rounded-lg border border-risk-moderate/40 text-body-sm">
          <span className="text-risk-moderate font-label-caps text-[10px]">LAUDO INDISPONÍVEL</span>
          <p className="mt-1 text-on-surface-variant">
            {report.error ?? "Serviço de IA indisponível. O risco calculado permanece válido."}
          </p>
        </div>
      )}

      {!loading && report?.available && report.report && (
        <div className="bg-surface-container p-4 rounded-lg border border-outline-variant/30 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="font-headline-md text-body-md font-bold text-on-surface">{report.report.title}</h4>
            <span
              className="font-data-mono text-[11px] px-2 py-0.5 rounded border"
              style={{
                color: riskColor(report.report.risk_level),
                borderColor: `${riskColor(report.report.risk_level)}66`,
              }}
            >
              {report.report.risk_level}
            </span>
          </div>
          <p className="text-body-sm text-on-surface">{report.report.summary}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-[10px] font-label-caps text-on-surface-variant mb-1">EVIDÊNCIAS DETECTADAS</h4>
              <ul className="text-body-sm list-disc pl-4 space-y-1 text-on-surface">
                {report.report.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-label-caps text-on-surface-variant mb-1">AÇÕES RECOMENDADAS</h4>
              <ul className="text-body-sm list-disc pl-4 space-y-1 text-on-surface">
                {report.report.recommended_actions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-2 border-t border-outline-variant/20">
            <p className="text-[11px] text-on-surface-variant italic">{report.report.limitations}</p>
            <span className="font-data-mono text-[11px] text-terminal-cyan">
              MODEL: {report.model ?? "n/a"} | OrbitGuard AI · POC acadêmica (não é alerta oficial)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
