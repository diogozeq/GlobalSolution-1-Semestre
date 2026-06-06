const TOP_ITEMS = [
  { icon: "layers", label: "Map Layers", active: true },
  { icon: "public", label: "Regions" },
  { icon: "satellite_alt", label: "Satellites" },
  { icon: "monitoring", label: "Risk Models" },
  { icon: "history", label: "Archive" },
];

const BOTTOM_ITEMS = [
  { icon: "analytics", label: "System Health" },
  { icon: "settings", label: "Settings" },
];

export default function SideNavBar() {
  return (
    <aside className="bg-surface-container text-terminal-cyan w-20 hover:w-64 transition-all duration-300 border-r border-outline-variant flex flex-col py-4 z-40 group overflow-hidden shrink-0">
      <div className="px-4 mb-8 flex items-center gap-4 overflow-hidden whitespace-nowrap">
        <div className="min-w-[48px] h-12 rounded bg-secondary-container flex items-center justify-center text-terminal-cyan">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            terminal
          </span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="font-headline-md text-headline-md text-terminal-cyan truncate">Command Center</div>
          <div className="text-[10px] text-on-surface-variant truncate">Operator: Mission_Zero</div>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {TOP_ITEMS.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-4 h-12 px-6 cursor-pointer overflow-hidden whitespace-nowrap transition-all ${
              item.active
                ? "bg-secondary-container text-terminal-cyan border-l-4 border-terminal-cyan"
                : "text-on-surface-variant hover:bg-surface-bright hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined min-w-[24px]">{item.icon}</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-label-caps text-label-caps">
              {item.label}
            </span>
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-2 border-t border-outline-variant pt-4">
        {BOTTOM_ITEMS.map((item) => (
          <div
            key={item.label}
            className="text-on-surface-variant hover:bg-surface-bright hover:text-on-surface flex items-center gap-4 h-12 px-6 cursor-pointer overflow-hidden whitespace-nowrap transition-all"
          >
            <span className="material-symbols-outlined min-w-[24px]">{item.icon}</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-label-caps text-label-caps">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
