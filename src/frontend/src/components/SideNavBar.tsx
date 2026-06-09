const TOP_ITEMS = [
  { glyph: "◎", label: "Mapa / Missão", page: "missoes" },
  { glyph: "◈", label: "Laudos IA", page: "laudo" },
  { glyph: "◑", label: "Chat RAG", page: "chat" },
  { glyph: "◍", label: "Regiões", page: "ativos" },
  { glyph: "⌁", label: "Telemetria", page: "telemetria" },
  { glyph: "▦", label: "Modelos de risco", page: "risco" },
  { glyph: "ML", label: "ML experimental", page: "ml" },
  { glyph: "↺", label: "Histórico", page: "historico" },
  { glyph: "⊞", label: "Explorador DB", page: "dados" },
];

const BOTTOM_ITEMS = [
  { glyph: "◇", label: "Saúde do sistema", page: "saude" },
  { glyph: "⚙", label: "Configurações", page: "config" },
];

interface Props {
  activePage: string;
  onPageChange: (page: string) => void;
}

export default function SideNavBar({ activePage, onPageChange }: Props) {
  return (
    <aside
      className="group flex flex-col py-3 z-40 shrink-0 overflow-hidden
                 transition-all duration-300 ease-out w-[56px] hover:w-[220px]
                 border-r border-outline-variant"
      style={{ background: "#0B141C" }}
    >
      <div className="px-3 mb-5 flex items-center gap-3 overflow-hidden whitespace-nowrap">
        <div
          className="min-w-[32px] h-8 rounded flex items-center justify-center shrink-0"
          style={{ background: "rgba(50,211,194,0.1)", border: "1px solid rgba(50,211,194,0.2)" }}
        >
          <span className="font-data-mono text-terminal-cyan text-[18px] leading-none">◎</span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="text-[11px] font-bold text-on-surface tracking-tight whitespace-nowrap">
            Centro de Comando
          </div>
          <div className="text-[9px] font-data-mono text-on-surface-variant opacity-60 whitespace-nowrap">
            Missão_Zero · Ativo
          </div>
        </div>
      </div>

      <div className="px-3 mb-1 h-4 overflow-hidden">
        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-data-mono tracking-widest text-on-surface-variant uppercase whitespace-nowrap">
          Módulos
        </span>
      </div>

      <nav className="flex-1 flex flex-col gap-px px-2">
        {TOP_ITEMS.map((item) => {
          const active = activePage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onPageChange(item.page)}
              className={`flex items-center gap-3 h-9 px-2 rounded text-left w-full overflow-hidden whitespace-nowrap transition-all duration-120 ${
                active ? "text-terminal-cyan" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-bright"
              }`}
              style={active
                ? { background: "rgba(50,211,194,0.08)", borderLeft: "2px solid #32D3C2" }
                : { borderLeft: "2px solid transparent" }}
            >
              <span className="w-[18px] shrink-0 text-center font-data-mono text-[14px] leading-none">
                {item.glyph}
              </span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-data-mono whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-px px-2 pt-2 mt-2 border-t border-outline-variant">
        {BOTTOM_ITEMS.map((item) => {
          const active = activePage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onPageChange(item.page)}
              className={`flex items-center gap-3 h-9 px-2 rounded text-left w-full overflow-hidden whitespace-nowrap transition-all duration-120 ${
                active ? "text-terminal-cyan" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-bright"
              }`}
              style={active
                ? { background: "rgba(50,211,194,0.08)", borderLeft: "2px solid #32D3C2" }
                : { borderLeft: "2px solid transparent" }}
            >
              <span className="w-[18px] shrink-0 text-center font-data-mono text-[14px] leading-none">
                {item.glyph}
              </span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-data-mono whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
