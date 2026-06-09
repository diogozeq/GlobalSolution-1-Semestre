import type { RiskItem } from "../types";

const VECTORS = [
  { key: "fire_activity",    label: "Atividade de fogo", glyph: "▲", color: "#FF5A2D" },
  { key: "weather_stress",   label: "Estresse climático", glyph: "°", color: "#FFC857" },
  { key: "spread_potential", label: "Dispersão (vento)",  glyph: "⌁", color: "#5EBBFF" },
  { key: "trend",            label: "Tendência",          glyph: "↗", color: "#32D3C2" },
];

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export default function ScoreBreakdown({ item, compact = false }: { item: RiskItem; compact?: boolean }) {
  const f = (item.features ?? {}) as Record<string, unknown>;
  const comp = (f.components ?? f) as Record<string, unknown>;
  const weighted = (f.weighted_components ?? {}) as Record<string, unknown>;

  const rows = VECTORS.map((v) => ({
    ...v,
    sub: num(comp[v.key]),
    contrib: num(weighted[v.key]),
  }));
  const score = item.score || rows.reduce((s, r) => s + r.contrib, 0);

  return (
    <div className="rounded p-3" style={{ background: "#0B141C", border: "1px solid #1B2A36" }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="font-data-mono text-[9px] text-on-surface-variant tracking-widest uppercase">
          Por que esse risco?
        </div>
        <div className="font-data-mono text-[10px] text-on-surface-variant">
          score <span className="text-terminal-cyan">{score.toFixed(1)}</span>/100
        </div>
      </div>

      {/* Stacked contribution bar (segments sum to the score) */}
      <div className="w-full h-2 rounded-full overflow-hidden flex mb-3" style={{ background: "rgba(255,255,255,0.05)" }}>
        {rows.map((r) => (
          <div
            key={r.key}
            title={`${r.label}: +${r.contrib.toFixed(1)} pts`}
            style={{ width: `${r.contrib}%`, background: r.color, opacity: 0.9 }}
          />
        ))}
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="font-data-mono text-[13px] shrink-0 w-[14px] text-center leading-none" style={{ color: r.color }}>
              {r.glyph}
            </span>
            {!compact && (
              <span className="text-[11px] text-on-surface w-[120px] shrink-0 truncate">{r.label}</span>
            )}
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="h-full rounded-full" style={{ width: `${r.sub}%`, background: r.color, opacity: 0.8 }} />
            </div>
            <span className="font-data-mono text-[9px] text-on-surface-variant w-9 text-right">{r.sub.toFixed(0)}</span>
            <span className="font-data-mono text-[9px] w-12 text-right" style={{ color: r.color }}>
              +{r.contrib.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
