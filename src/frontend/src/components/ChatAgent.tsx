import { useEffect, useRef, useState } from "react";
import * as apiSvc from "../services/api";
import type { ChatSource } from "../types";

interface Msg {
  role: "user" | "agent";
  text: string;
  sources?: ChatSource[];
  tools?: string[];
  available?: boolean;
}

interface Props {
  selectedRegionId: number | null;
}

const SUGGESTIONS = [
  "Por que o Pará está em risco alto?",
  "Diferença entre FIRMS e EONET?",
  "Ações para muitos focos + vento alto?",
];

const TEXT_LIMIT = 600;

function MessageText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > TEXT_LIMIT;
  const shown = !isLong || expanded ? text : `${text.slice(0, TEXT_LIMIT).trimEnd()}…`;
  return (
    <div className="min-w-0">
      <p
        className="text-on-surface leading-relaxed whitespace-pre-wrap break-words"
        style={{ overflowWrap: "anywhere" }}
      >
        {shown}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 font-data-mono text-[9px] text-terminal-cyan hover:underline"
        >
          {expanded ? "ver menos ▲" : `ver mais ▾ (${text.length} caracteres)`}
        </button>
      )}
    </div>
  );
}

export default function ChatAgent({ selectedRegionId }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "agent",
      text: "Operador, estou online. Consulto base RAG + dados vivos. Pergunte sobre risco regional, fontes orbitais ou ações preventivas.",
      sources: [
        { title: "INPE Queimadas", source_url: "https://data.inpe.br/queimadas/" },
        { title: "NASA FIRMS",     source_url: "https://firms.modaps.eosdis.nasa.gov/" },
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await apiSvc.chat(q, selectedRegionId ?? undefined);
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: res.answer,
          sources: res.sources,
          tools: res.used_tools,
          available: res.available,
        },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "agent", text: "Agente indisponível. Verifique o backend ou OPENROUTER_API_KEY." }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
      );
    }
  };

  // Always keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const totalSources = messages.reduce((n, m) => n + (m.sources?.length ?? 0), 0);

  return (
    <div
      className="flex-1 flex flex-col p-4 min-w-0 min-h-0 overflow-hidden"
      style={{ background: "#05090D" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-data-mono text-[14px] leading-none" style={{ color: "#32D3C2" }}>◑</span>
          <span className="font-data-mono text-[10px] text-terminal-cyan tracking-widest uppercase">
            Chat RAG
          </span>
          {selectedRegionId && (
            <span
              className="font-data-mono text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(50,211,194,0.08)", color: "#32D3C2", border: "1px solid rgba(50,211,194,0.2)" }}
            >
              Região #{selectedRegionId}
            </span>
          )}
        </div>
        <span className="font-data-mono text-[9px] text-on-surface-variant">
          {String(totalSources).padStart(2, "0")} fontes
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto mb-3 space-y-2 min-h-0 pr-0.5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded p-3 text-[12px] animate-fade-in min-w-0 ${
              m.role === "user" ? "ml-6" : "mr-4"
            }`}
            style={m.role === "user"
              ? { background: "rgba(50,211,194,0.07)", border: "1px solid rgba(50,211,194,0.18)" }
              : { background: "#0B141C", border: "1px solid #1B2A36" }
            }
          >
            {/* Sender label */}
            <div className="font-data-mono text-[9px] mb-1.5" style={{
              color: m.role === "user" ? "#32D3C2" : "#6F808A",
            }}>
              {m.role === "user" ? "OPERADOR" : "ORBITGUARD AI"}
              {m.role === "agent" && m.available === false ? " · FALLBACK LOCAL" : ""}
            </div>

            {/* Text */}
            <MessageText text={m.text} />

            {/* Tools used */}
            {m.tools && m.tools.length > 0 && (
              <div className="mt-2 flex gap-1.5 flex-wrap">
                {m.tools.map((t, j) => (
                  <span
                    key={j}
                    className="font-data-mono text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(94,187,255,0.08)", color: "#5EBBFF", border: "1px solid rgba(94,187,255,0.2)" }}
                  >
                    ⚙ {t}
                  </span>
                ))}
              </div>
            )}

            {/* Sources */}
            {m.sources && m.sources.length > 0 && (
              <div className="mt-2 flex gap-1.5 flex-wrap">
                {m.sources.map((s, j) => (
                  <a
                    key={j}
                    href={s.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-data-mono text-[9px] px-2 py-0.5 rounded transition-all duration-120"
                    style={{
                      background: "rgba(50,211,194,0.05)",
                      color: "#AAB7BE",
                      border: "1px solid #1B2A36",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "#32D3C2";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(50,211,194,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "#AAB7BE";
                      (e.currentTarget as HTMLElement).style.borderColor = "#1B2A36";
                    }}
                  >
                    {s.id ? `${s.id}: ` : ""}{s.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Busy state */}
        {busy && (
          <div
            className="rounded p-3 mr-4 max-w-[75%]"
            style={{ background: "#0B141C", border: "1px solid #1B2A36" }}
          >
            <div className="font-data-mono text-[9px] text-on-surface-variant mb-1">ORBITGUARD AI</div>
            <p className="font-data-mono text-[11px] text-on-surface-variant">
              consultando RAG + dados vivos<span className="cursor-blink" />
            </p>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="font-data-mono text-[9px] px-2 py-1 rounded transition-all duration-120"
              style={{ background: "#0B141C", color: "#AAB7BE", border: "1px solid #1B2A36" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#32D3C2";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(50,211,194,0.4)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#AAB7BE";
                (e.currentTarget as HTMLElement).style.borderColor = "#1B2A36";
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <label htmlFor="orbitguard-chat-input" className="sr-only">
          Pergunta para o agente RAG
        </label>
        <input
          id="orbitguard-chat-input"
          className="w-full rounded pl-4 pr-10 py-2.5 text-[12px] font-data-mono
                     text-on-surface placeholder-on-surface-variant
                     outline-none transition-all duration-120"
          style={{
            background: "#0B141C",
            border: "1px solid #1B2A36",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(50,211,194,0.5)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(50,211,194,0.08)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#1B2A36";
            e.currentTarget.style.boxShadow = "none";
          }}
          placeholder="Pergunte sobre riscos ou dados regionais..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
        />
        <button
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
          aria-label="Enviar pergunta"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-all duration-120
                     disabled:opacity-30 hover:scale-110"
          style={{ color: "#32D3C2" }}
        >
          <span className="font-data-mono text-[14px] leading-none">↵</span>
        </button>
      </div>
    </div>
  );
}
