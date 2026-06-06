import { useEffect, useState } from "react";

interface Props {
  onRefresh: () => void;
  onRecalc: () => void;
  busy: "ingest" | "risk" | null;
  usingFixture: boolean;
  apiOnline: boolean;
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const t = now.toISOString().substring(11, 19);
  return <span className="font-data-mono text-data-mono text-terminal-cyan">MT: {t}</span>;
}

export default function TopNavBar({ onRefresh, onRecalc, busy, usingFixture, apiOnline }: Props) {
  const healthLabel = !apiOnline
    ? "SYSTEM HEALTH: OFFLINE"
    : usingFixture
      ? "SYSTEM HEALTH: FIXTURE MODE"
      : "SYSTEM HEALTH: OPTIMAL";
  const healthColor = !apiOnline
    ? "bg-risk-critical"
    : usingFixture
      ? "bg-risk-moderate"
      : "bg-risk-low";

  return (
    <header className="bg-surface-container-low text-terminal-cyan border-b border-outline-variant flex justify-between items-center w-full px-6 h-16 z-50 shrink-0">
      <div className="flex items-center gap-6">
        <span className="font-headline-md text-headline-md font-bold text-terminal-cyan tracking-tight">
          OrbitGuard AI
        </span>
        <div className="hidden md:flex gap-6 items-center">
          <a className="text-terminal-cyan border-b-2 border-terminal-cyan pb-1 font-label-caps text-label-caps" href="#">
            Missions
          </a>
          <a className="text-on-surface-variant hover:text-terminal-cyan transition-colors font-label-caps text-label-caps" href="#">
            Telemetry
          </a>
          <a className="text-on-surface-variant hover:text-terminal-cyan transition-colors font-label-caps text-label-caps" href="#">
            Assets
          </a>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center px-3 py-1 bg-surface-container rounded-lg border border-outline-variant gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${healthColor} animate-pulse`} />
            <span className="font-label-caps text-[10px] text-on-surface-variant">{healthLabel}</span>
          </div>
          <div className="h-4 w-px bg-outline-variant" />
          <Clock />
        </div>

        <button
          onClick={onRefresh}
          disabled={busy !== null}
          className="bg-surface-container border border-terminal-cyan/40 text-terminal-cyan px-4 py-1.5 rounded font-label-caps text-label-caps hover:bg-terminal-cyan hover:text-surface-container-lowest transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[18px] ${busy === "ingest" ? "animate-spin" : ""}`}>
            cloud_sync
          </span>
          {busy === "ingest" ? "Coletando..." : "Atualizar Dados"}
        </button>

        <button
          onClick={onRecalc}
          disabled={busy !== null}
          className="bg-terminal-cyan text-surface-container-lowest px-4 py-1.5 rounded font-label-caps text-label-caps hover:opacity-80 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[18px] ${busy === "risk" ? "animate-spin" : ""}`}>
            refresh
          </span>
          {busy === "risk" ? "Calculando..." : "Recalcular Risco"}
        </button>

        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-terminal-cyan">
            settings_input_component
          </span>
          <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-terminal-cyan">
            notifications_active
          </span>
          <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-terminal-cyan">
            account_circle
          </span>
        </div>
      </div>
    </header>
  );
}
