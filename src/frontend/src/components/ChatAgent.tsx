import { useRef, useState } from "react";
import * as apiSvc from "../services/api";
import type { ChatSource } from "../types";

interface Msg {
  role: "user" | "agent";
  text: string;
  sources?: ChatSource[];
  tools?: string[];
}

interface Props {
  selectedRegionId: number | null;
}

const SUGGESTIONS = [
  "Por que o Pará está em risco alto?",
  "Qual a diferença entre FIRMS e EONET?",
  "Que ações preventivas fazem sentido com muitos focos e vento alto?",
];

export default function ChatAgent({ selectedRegionId }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "agent",
      text: "Olá, Operador. Estou analisando as camadas de dados. Pergunte sobre o risco de uma região ou sobre as fontes orbitais — respondo com fontes citadas.",
      sources: [
        { title: "INPE Queimadas", source_url: "https://data.inpe.br/queimadas/" },
        { title: "NASA FIRMS", source_url: "https://firms.modaps.eosdis.nasa.gov/" },
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
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "agent", text: "Agente indisponível no momento. Verifique o backend / OPENROUTER_API_KEY." },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  };

  const totalSources = messages.reduce((n, m) => n + (m.sources?.length ?? 0), 0);

  return (
    <div className="w-[500px] flex flex-col p-6 bg-surface-container-low/50 min-w-0">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary">psychology</span>
          <h3 className="font-label-caps text-label-caps text-tertiary">Análise Contextual RAG</h3>
        </div>
        <span className="text-[10px] font-data-mono text-on-surface-variant">
          Sources: {String(totalSources).padStart(2, "0")} Verified
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto mb-4 space-y-3 min-h-0 pr-1">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "bg-secondary-container/60 p-3 rounded-lg ml-auto max-w-[85%] animate-fade-in"
                : "bg-surface-container-highest p-3 rounded-lg border border-outline-variant/20 max-w-[90%] animate-fade-in"
            }
          >
            <p className="text-body-sm whitespace-pre-wrap">{m.text}</p>
            {m.tools && m.tools.length > 0 && (
              <div className="mt-2 text-[9px] font-data-mono text-tertiary">tools: {m.tools.join(", ")}</div>
            )}
            {m.sources && m.sources.length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {m.sources.map((s, j) => (
                  <a
                    key={j}
                    href={s.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9px] px-2 py-0.5 rounded border border-outline-variant bg-surface-container text-on-surface-variant font-data-mono hover:text-terminal-cyan hover:border-terminal-cyan transition-colors"
                  >
                    Source: {s.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="bg-surface-container-highest p-3 rounded-lg border border-outline-variant/20 max-w-[60%] animate-pulse">
            <p className="text-body-sm text-on-surface-variant font-data-mono">consultando base + dados vivos...</p>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[10px] px-2 py-1 rounded border border-outline-variant text-on-surface-variant hover:text-terminal-cyan hover:border-terminal-cyan transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          className="w-full bg-surface-container border border-outline-variant rounded-lg pl-4 pr-12 py-3 text-body-sm focus:border-terminal-cyan focus:ring-1 focus:ring-terminal-cyan transition-all outline-none"
          placeholder="Pergunte sobre riscos ou dados regionais..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
        />
        <button
          onClick={() => send(input)}
          disabled={busy}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-terminal-cyan hover:scale-110 transition-transform disabled:opacity-40"
        >
          <span className="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>
  );
}
