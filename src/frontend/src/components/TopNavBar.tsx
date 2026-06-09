import { useEffect, useState } from "react";

interface Props {
  onRefresh: () => void;
  onRecalc: () => void;
  busy: "ingest" | "risk" | null;
  usingFixture: boolean;
  apiOnline: boolean;
  activePage: string;
  onPageChange: (page: string) => void;
  lastUpdatedAt?: string | null;
  alertCount?: number;
}

function relativeTime(iso?: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 60) return "agora";
  if (secs < 3600) return `há ${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `há ${Math.floor(secs / 3600)}h`;
  return `há ${Math.floor(secs / 86400)}d`;
}

function OrbitalLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <ellipse
        cx="14" cy="14" rx="12" ry="5.5"
        stroke="#5EBBFF" strokeWidth="1" fill="none" opacity="0.5"
        transform="rotate(-28 14 14)"
      />
      <path
        d="M 6.5 14 A 7.5 7.5 0 0 1 21.5 14"
        stroke="#32D3C2" strokeWidth="1.6" strokeLinecap="round"
      />
      <circle cx="14" cy="14" r="2.8" fill="#32D3C2" />
      <circle cx="14" cy="14" r="1.2" fill="#05090D" />
      <circle cx="24.2" cy="10.2" r="1.6" fill="#5EBBFF" opacity="0.8" />
    </svg>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const t = now.toLocaleTimeString("pt-BR", { hour12: false, timeZone: "America/Sao_Paulo" });
  return (
    <span className="font-data-mono text-[12px] text-terminal-cyan tabular-nums">
      BRT {t}
    </span>
  );
}

const NAV = [
  { key: "missoes", label: "Visão Geral" },
  { key: "telemetria", label: "Telemetria" },
  { key: "ativos", label: "Regiões" },
  { key: "laudo", label: "Laudos" },
  { key: "chat", label: "Chat" },
] as const;

export default function TopNavBar({
  onRefresh,
  onRecalc,
  busy,
  usingFixture,
  apiOnline,
  activePage,
  onPageChange,
  lastUpdatedAt,
  alertCount = 0,
}: Props) {
  const updated = relativeTime(lastUpdatedAt);
  const healthLabel = !apiOnline ? "OFFLINE" : usingFixture ? "DEMO" : "AO VIVO";
  const healthColor = !apiOnline
    ? "bg-risk-critical"
    : usingFixture
      ? "bg-risk-moderate"
      : "bg-risk-low";

  return (
    <header className="topbar-glass border-b border-outline-variant flex items-center justify-between px-5 h-[60px] z-50 shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5 select-none">
          <OrbitalLogo />
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-tight text-on-surface">
              OrbitGuard
            </span>
            <span
              className="text-[9px] font-data-mono tracking-widest uppercase"
              style={{ color: "#32D3C2", opacity: 0.8 }}
            >
              IA · Inteligência climática
            </span>
          </div>
        </div>

        <div className="h-5 w-px bg-outline-variant" />

        <nav className="hidden md:flex gap-1">
          {NAV.map((item) => {
            const active = activePage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onPageChange(item.key)}
                className={`px-3 py-1.5 rounded text-[11px] font-data-mono tracking-wide transition-all duration-120 ${
                  active
                    ? "bg-surface-container-high text-terminal-cyan border border-outline-variant"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-bright"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded border border-outline-variant bg-surface-container-high">
          <span className={`w-1.5 h-1.5 rounded-full ${healthColor} animate-pulse-dot`} />
          <span className="font-data-mono text-[10px] text-on-surface-variant tracking-wider">
            {healthLabel}
          </span>
          <div className="w-px h-3.5 bg-outline-variant mx-1" />
          <Clock />
          {updated && (
            <>
              <div className="w-px h-3.5 bg-outline-variant mx-1" />
              <span
                className="font-data-mono text-[10px] text-on-surface-variant tracking-wider"
                title="Última coleta de dados"
              >
                ↻ {updated}
              </span>
            </>
          )}
        </div>

        <button
          onClick={onRefresh}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-outline-variant bg-surface-container-high
                     text-on-surface-variant hover:text-terminal-cyan hover:border-terminal-cyan/50
                     text-[11px] font-data-mono tracking-wide
                     transition-all duration-120 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className={`w-4 text-center font-data-mono text-[13px] leading-none ${busy === "ingest" ? "animate-spin" : ""}`}>
            ↻
          </span>
          {busy === "ingest" ? "Coletando..." : "Atualizar"}
        </button>

        <button
          onClick={onRecalc}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded
                     text-[11px] font-data-mono tracking-wide font-semibold
                     transition-all duration-120 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, #32D3C2 0%, #2E7BFF 100%)",
            color: "#05090D",
          }}
        >
          <span className={`w-4 text-center font-data-mono text-[13px] leading-none ${busy === "risk" ? "animate-spin" : ""}`}>
            ↻
          </span>
          {busy === "risk" ? "Calculando..." : "Recalcular risco"}
        </button>

        <div className="flex items-center gap-1 pl-1 border-l border-outline-variant">
          <button
            onClick={() => onPageChange("missoes")}
            aria-label={`Alertas${alertCount ? ` (${alertCount})` : ""}`}
            title="Feed de alertas"
            className="relative w-8 h-8 flex items-center justify-center rounded text-on-surface-variant
                       hover:text-terminal-cyan hover:bg-surface-bright transition-all duration-120"
          >
            <span className="font-data-mono text-[13px] leading-none">!</span>
            {alertCount > 0 && (
              <span
                className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                style={{ background: "#FF3347", boxShadow: "0 0 6px #FF3347" }}
              />
            )}
          </button>
          <button
            onClick={() => onPageChange("config")}
            aria-label="Configurações"
            title="Status / Ambiente"
            className="w-8 h-8 flex items-center justify-center rounded text-on-surface-variant
                       hover:text-terminal-cyan hover:bg-surface-bright transition-all duration-120"
          >
            <span className="font-data-mono text-[13px] leading-none">⚙</span>
          </button>
          <button
            onClick={() => onPageChange("saude")}
            aria-label="Saúde do sistema"
            title="Saúde do sistema"
            className="w-8 h-8 flex items-center justify-center rounded text-on-surface-variant
                       hover:text-terminal-cyan hover:bg-surface-bright transition-all duration-120"
          >
            <span className="font-data-mono text-[13px] leading-none">●</span>
          </button>
        </div>
      </div>
    </header>
  );
}
