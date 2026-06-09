import { useEffect, useState } from "react";
import { subscribe, type ToastItem } from "../lib/toast";

const COLORS: Record<string, string> = {
  success: "#22D47B",
  error: "#FF3347",
  info: "#32D3C2",
};

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribe(setItems), []);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto panel-glass border rounded px-4 py-2.5 font-data-mono text-[11px] animate-fade-in flex items-center gap-2"
          style={{ borderColor: `${COLORS[t.kind]}55`, color: "#E8F0F2", minWidth: 240, background: "#0B141C" }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLORS[t.kind], boxShadow: `0 0 6px ${COLORS[t.kind]}` }} />
          {t.message}
        </div>
      ))}
    </div>
  );
}
