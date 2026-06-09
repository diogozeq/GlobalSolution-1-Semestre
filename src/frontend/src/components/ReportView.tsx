import type { ReportResult, RiskItem, SensorReading } from "../types";
import { riskBg, riskColor } from "../lib/risk";
import { toast } from "../lib/toast";
import ScoreBreakdown from "./ScoreBreakdown";

const VECTORS = [
  { key: "fire_activity",    label: "Atividade de fogo",  color: "#cc3300" },
  { key: "weather_stress",   label: "Estresse climático", color: "#996600" },
  { key: "spread_potential", label: "Dispersão (vento)",  color: "#005599" },
  { key: "trend",            label: "Tendência",          color: "#006655" },
];

function buildPrintHTML(report: ReportResult, regionName?: string, riskItem?: RiskItem | null, sensor?: SensorReading | null): string {
  const r = report.report!;
  const now = new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });

  const f = (riskItem?.features ?? {}) as Record<string, unknown>;
  const comp = (f.components ?? f) as Record<string, unknown>;
  const weighted = (f.weighted_components ?? {}) as Record<string, unknown>;
  const scoreRows = VECTORS.map((v) => {
    const sub = typeof comp[v.key] === "number" ? (comp[v.key] as number) : 0;
    const contrib = typeof weighted[v.key] === "number" ? (weighted[v.key] as number) : 0;
    return { ...v, sub, contrib };
  });
  const score = riskItem?.score ?? scoreRows.reduce((s, r) => s + r.contrib, 0);

  const levelColors: Record<string, string> = {
    baixo: "#006600", moderado: "#886600", alto: "#cc4400", crítico: "#aa0000",
    low: "#006600", moderate: "#886600", high: "#cc4400", critical: "#aa0000",
  };
  const levelKey = (r.risk_level ?? "").toLowerCase();
  const levelColor = levelColors[levelKey] ?? "#333";

  const evidenceItems = r.evidence.map(e => `<li>${e}</li>`).join("");
  const actionItems = r.recommended_actions.map(a => `<li>${a}</li>`).join("");

  const scoreSection = riskItem ? `
    <div class="print-section">
      <div class="print-section-title">Decomposição do Score</div>
      <div style="font-size:9pt;color:#555;margin-bottom:6pt;">Score total: <strong>${score.toFixed(1)}</strong>/100</div>
      ${scoreRows.map(v => `
        <div style="display:flex;align-items:center;gap:8pt;margin-bottom:4pt;font-size:9pt;">
          <span style="width:130pt;color:#333;">${v.label}</span>
          <div style="flex:1;height:5pt;background:#e5e5e5;border-radius:3pt;overflow:hidden;">
            <div style="width:${v.sub}%;height:100%;background:${v.color};border-radius:3pt;"></div>
          </div>
          <span style="width:30pt;text-align:right;color:#555;">${v.sub.toFixed(0)}</span>
          <span style="width:36pt;text-align:right;font-weight:600;color:${v.color};">+${v.contrib.toFixed(1)}</span>
        </div>`).join("")}
    </div>` : "";

  const sensorSection = sensor ? `
    <div class="print-section">
      <div class="print-section-title">Sensor de Solo (IoT) — Cruzamento Satélite + Solo</div>
      <div class="print-sensor-grid">
        ${[
          { label: "Temperatura", value: sensor.temperature, unit: "°C" },
          { label: "Umidade", value: sensor.humidity, unit: "%" },
          { label: "Fumaça", value: sensor.smoke, unit: "" },
          { label: "Umid. Solo", value: sensor.soil_moisture, unit: "%" },
        ].map(m => `
          <div class="print-sensor-cell">
            <div class="print-sensor-label">${m.label}</div>
            <div class="print-sensor-value">${m.value ?? "—"}${m.unit}</div>
          </div>`).join("")}
      </div>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Laudo Técnico OrbitGuard — ${r.title}</title>
<style>
  @page { size: A4 portrait; margin: 18mm 20mm 18mm 20mm; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Inter", Arial, sans-serif; font-size: 10pt; line-height: 1.55; color: #111; background: #fff; }
  .header { border-bottom: 2px solid #111; padding-bottom: 8pt; margin-bottom: 14pt; display: flex; justify-content: space-between; align-items: flex-end; }
  .header-left { }
  .header-title { font-size: 17pt; font-weight: 700; color: #111; letter-spacing: -0.3px; }
  .header-sub { font-size: 8pt; color: #555; margin-top: 3pt; }
  .header-meta { text-align: right; font-size: 8pt; color: #555; line-height: 1.7; }
  .title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10pt; margin-bottom: 10pt; }
  .report-title { font-size: 13pt; font-weight: 700; color: #111; flex: 1; }
  .level-badge { display: inline-block; padding: 2pt 9pt; border-radius: 4pt; font-weight: 700; font-size: 9pt; letter-spacing: 0.5px; border: 1.5px solid; white-space: nowrap; color: ${levelColor}; border-color: ${levelColor}; background: #fff; }
  .section { margin-bottom: 12pt; page-break-inside: avoid; }
  .section-title { font-size: 7pt; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ccc; padding-bottom: 3pt; margin-bottom: 6pt; }
  p { font-size: 10pt; color: #111; margin-bottom: 4pt; }
  ul { padding-left: 14pt; }
  ul li { font-size: 10pt; color: #111; margin-bottom: 3pt; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; }
  .print-sensor-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; text-align: center; }
  .print-sensor-cell { border: 1px solid #ccc; padding: 5pt; border-radius: 4pt; }
  .print-sensor-label { font-size: 7pt; color: #777; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2pt; }
  .print-sensor-value { font-size: 13pt; font-weight: 700; color: #111; }
  .print-section-title { font-size: 7pt; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ccc; padding-bottom: 3pt; margin-bottom: 6pt; }
  .print-section { margin-bottom: 12pt; page-break-inside: avoid; }
  .limitations { font-style: italic; color: #555; font-size: 9.5pt; }
  .footer { margin-top: 14pt; padding-top: 6pt; border-top: 1px solid #ccc; font-size: 7.5pt; color: #888; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="header-title">OrbitGuard AI — Laudo Técnico</div>
      <div class="header-sub">Sistema de monitoramento de risco ambiental por satélite · FIAP Global Solution 2026</div>
    </div>
    <div class="header-meta">
      ${regionName ? `<div><strong>Região:</strong> ${regionName}</div>` : ""}
      <div><strong>Data:</strong> ${now}</div>
      <div><strong>Modelo:</strong> ${report.model ?? "n/d"}</div>
    </div>
  </div>

  <div class="title-row">
    <div class="report-title">${r.title}</div>
    <span class="level-badge">RISCO ${r.risk_level?.toUpperCase()}</span>
  </div>

  <div class="section">
    <div class="section-title">Resumo Executivo</div>
    <p>${r.summary}</p>
  </div>

  ${scoreSection}

  <div class="grid-2">
    <div class="section">
      <div class="section-title">Evidências Identificadas</div>
      <ul>${evidenceItems}</ul>
    </div>
    <div class="section">
      <div class="section-title">Ações Recomendadas</div>
      <ul>${actionItems}</ul>
    </div>
  </div>

  ${sensorSection}

  <div class="section">
    <div class="section-title">Limitações e Avisos</div>
    <p class="limitations">${r.limitations}</p>
  </div>

  <div class="footer">
    <span>OrbitGuard AI · POC Acadêmica — Não substitui avaliação de órgãos oficiais (INPE, IBAMA, Defesa Civil)</span>
    <span>${now}</span>
  </div>
</body>
</html>`;
}

interface Props {
  report: ReportResult | null;
  loading: boolean;
  regionName?: string;
  riskItem?: RiskItem | null;
  sensor?: SensorReading | null;
}

function reportToText(report: ReportResult, regionName?: string): string {
  const r = report.report;
  if (!r) return "";
  return [
    `LAUDO TÉCNICO — OrbitGuard AI`,
    regionName ? `Região: ${regionName}` : "",
    `${r.title} · Nível: ${r.risk_level}`,
    "",
    `RESUMO`,
    r.summary,
    "",
    `EVIDÊNCIAS`,
    ...r.evidence.map((e) => `- ${e}`),
    "",
    `AÇÕES RECOMENDADAS`,
    ...r.recommended_actions.map((a) => `- ${a}`),
    "",
    `LIMITAÇÕES`,
    r.limitations,
    "",
    `Modelo: ${report.model ?? "n/d"} · POC acadêmica, não substitui órgãos oficiais.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function ReportView({ report, loading, regionName, riskItem, sensor }: Props) {
  const canExport = !loading && report?.available && report.report;
  const isFallback = Boolean(report?.model?.toLowerCase().includes("fallback"));

  const handlePrint = () => {
    if (!report?.report) return;
    const html = buildPrintHTML(report, regionName, riskItem, sensor);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { toast("Pop-up bloqueado. Permita pop-ups para este site.", "error"); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.addEventListener("load", () => { win.focus(); win.print(); });
  };

  const handleCopy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(reportToText(report, regionName));
      toast("Laudo copiado para a área de transferência", "success");
    } catch {
      toast("Não foi possível copiar o laudo", "error");
    }
  };

  return (
    <div
      className="flex-1 flex flex-col p-6 overflow-y-auto min-w-0"
      style={{ background: "#05090D" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="font-data-mono text-[14px] text-terminal-cyan leading-none">▤</span>
        <span className="font-data-mono text-[10px] text-terminal-cyan tracking-widest uppercase">
          Laudo Técnico
        </span>
        {regionName && (
          <span className="font-data-mono text-[10px] text-on-surface-variant opacity-60">
            / {regionName}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canExport && (
            <>
              <button
                onClick={handleCopy}
                aria-label="Copiar laudo"
                title="Copiar laudo"
                className="flex items-center gap-1 px-2 py-0.5 rounded-full font-data-mono text-[9px]
                           text-on-surface-variant hover:text-terminal-cyan transition-colors"
                style={{ border: "1px solid #1B2A36" }}
              >
                <span className="font-data-mono text-[10px] leading-none">⧉</span>
                Copiar
              </button>
              <button
                onClick={handlePrint}
                aria-label="Imprimir / salvar PDF"
                title="Imprimir / salvar PDF"
                className="flex items-center gap-1 px-2 py-0.5 rounded-full font-data-mono text-[9px]
                           text-on-surface-variant hover:text-terminal-cyan transition-colors"
                style={{ border: "1px solid #1B2A36" }}
              >
                <span className="font-data-mono text-[11px] leading-none">⎙</span>
                PDF
              </button>
            </>
          )}
          <span
            className="font-data-mono text-[9px] px-2 py-0.5 rounded-full"
            style={{
              background: isFallback ? "rgba(255,200,87,0.08)" : "rgba(50,211,194,0.08)",
              color: isFallback ? "#FFC857" : "#32D3C2",
              border: `1px solid ${isFallback ? "rgba(255,200,87,0.25)" : "rgba(50,211,194,0.2)"}`,
            }}
          >
            {isFallback ? "Fallback local" : "IA Generativa"}
          </span>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div
          className="rounded p-4 skeleton-shimmer"
          style={{ border: "1px solid #1B2A36" }}
        >
          <div className="h-3 w-48 rounded mb-3" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="h-2 w-full rounded mb-2" style={{ background: "rgba(255,255,255,0.04)" }} />
          <div className="h-2 w-3/4 rounded mb-2" style={{ background: "rgba(255,255,255,0.04)" }} />
          <div className="h-2 w-5/6 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
          <p className="font-data-mono text-[10px] text-on-surface-variant mt-3">
            Consultando IA generativa...
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !report && (
        <div
          className="rounded p-4 flex flex-col gap-2"
          style={{ background: "#0B141C", border: "1px solid #1B2A36" }}
        >
          <div className="flex items-center gap-2">
            <span className="font-data-mono text-[14px] text-on-surface-variant opacity-40 leading-none">▤</span>
            <p className="font-data-mono text-[10px] text-on-surface-variant opacity-60">
              Nenhum laudo gerado ainda.
            </p>
          </div>
          <p className="text-[12px] text-on-surface-variant">
            Selecione uma região em{" "}
            <span style={{ color: "#32D3C2" }}>risco Alto ou Crítico</span>
            {" "}e clique em{" "}
            <span style={{ color: "#FF5A2D" }}>Gerar Laudo IA</span>.
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && report && !report.available && (
        <div
          className="rounded p-4"
          style={{ background: "rgba(255,200,87,0.06)", border: "1px solid rgba(255,200,87,0.25)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-data-mono text-[12px] text-risk-moderate leading-none">!</span>
            <span className="font-data-mono text-[10px] text-risk-moderate tracking-wider uppercase">
              Laudo Indisponível
            </span>
          </div>
          <p className="text-[12px] text-on-surface-variant">
            {report.error ?? "Serviço de IA indisponível. Score de risco calculado permanece válido."}
          </p>
        </div>
      )}

      {/* Report */}
      {!loading && report?.available && report.report && (
        <div className="flex flex-col gap-3 animate-fade-in">
          {/* Title + level */}
          <div
            className="rounded p-3 flex items-start justify-between gap-3"
            style={{
              background: riskBg(report.report.risk_level),
              border: `1px solid ${riskColor(report.report.risk_level)}33`,
            }}
          >
            <h4 className="text-[13px] font-semibold text-on-surface leading-snug flex-1">
              {report.report.title}
            </h4>
            <span
              className="font-data-mono text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{
                color: riskColor(report.report.risk_level),
                background: riskBg(report.report.risk_level),
                border: `1px solid ${riskColor(report.report.risk_level)}44`,
              }}
            >
              {report.report.risk_level?.toUpperCase()}
            </span>
          </div>

          {/* Summary */}
          <p className="text-[12px] text-on-surface leading-relaxed">{report.report.summary}</p>

          {/* Score decomposition */}
          {riskItem && <ScoreBreakdown item={riskItem} />}

          {/* Ground sensor cross-reference (satélite + solo) */}
          {sensor && (
            <div className="rounded p-3" style={{ background: "#0B141C", border: "1px solid #1B2A36" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-data-mono text-[12px] leading-none" style={{ color: "#5EBBFF" }}>⌁</span>
                <span className="font-data-mono text-[9px] text-on-surface-variant tracking-widest uppercase">
                  Sensor de solo (IoT) · cruzamento satélite + solo
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "TEMP", value: sensor.temperature, unit: "°C" },
                  { label: "UMID", value: sensor.humidity, unit: "%" },
                  { label: "FUMAÇA", value: sensor.smoke, unit: "" },
                  { label: "SOLO", value: sensor.soil_moisture, unit: "%" },
                ].map((m) => (
                  <div key={m.label} className="rounded py-1.5" style={{ background: "#101B24" }}>
                    <div className="font-data-mono text-[8px] text-on-surface-variant tracking-wider">{m.label}</div>
                    <div className="font-data-mono text-[13px] text-terminal-cyan">
                      {m.value ?? "--"}<span className="text-[9px] text-on-surface-variant">{m.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence + Actions */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded p-3"
              style={{ background: "#0B141C", border: "1px solid #1B2A36" }}
            >
              <div className="font-data-mono text-[9px] text-on-surface-variant tracking-widest uppercase mb-2">
                Evidências
              </div>
              <ul className="space-y-1">
                {report.report.evidence.map((e, i) => (
                  <li key={i} className="flex gap-2 text-[11px] text-on-surface">
                    <span style={{ color: "#32D3C2", opacity: 0.7 }}>›</span>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="rounded p-3"
              style={{ background: "#0B141C", border: "1px solid #1B2A36" }}
            >
              <div className="font-data-mono text-[9px] text-on-surface-variant tracking-widest uppercase mb-2">
                Ações Recomendadas
              </div>
              <ul className="space-y-1">
                {report.report.recommended_actions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-[11px] text-on-surface">
                    <span style={{ color: "#FF5A2D", opacity: 0.7 }}>›</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Limitations + model */}
          <div
            className="rounded p-3"
            style={{ background: "#0B141C", border: "1px solid #1B2A36" }}
          >
            <div className="font-data-mono text-[9px] text-on-surface-variant tracking-widest uppercase mb-1.5">
              Limitações
            </div>
            <p className="text-[11px] text-on-surface-variant italic">{report.report.limitations}</p>
            <div className="mt-2 pt-2 border-t border-outline-variant flex items-center justify-between">
              <span className="font-data-mono text-[9px] text-on-surface-variant opacity-50">
                {report.model ?? "modelo não informado"}
              </span>
              <span
                className="font-data-mono text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(50,211,194,0.06)", color: "#32D3C2", border: "1px solid rgba(50,211,194,0.15)" }}
              >
                POC · Não substitui órgãos oficiais
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
