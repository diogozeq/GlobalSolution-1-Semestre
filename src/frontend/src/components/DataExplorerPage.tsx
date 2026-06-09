import { useEffect, useState } from "react";
import * as apiSvc from "../services/api";
import type {
  Region, FireFocus, WeatherReading, NaturalEvent,
  Alert, SensorReading, IngestRun, RiskItem,
} from "../types";
import { riskColor } from "../lib/risk";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(v: unknown, unit = ""): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return `${v % 1 === 0 ? v : v.toFixed(2)}${unit}`;
  return String(v);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function statusColor(s: string) {
  if (s === "success") return "#22D47B";
  if (s === "failed")  return "#FF3347";
  if (s === "partial") return "#FFC857";
  if (s === "open")    return "#FF5A2D";
  if (s === "ack")     return "#FFC857";
  if (s === "closed")  return "#6F808A";
  return "#AAB7BE";
}

// ── sub-components ────────────────────────────────────────────────────────────

function Badge({ label, color = "#32D3C2" }: { label: string; color?: string }) {
  return (
    <span
      className="inline-block font-data-mono text-[9px] px-1.5 py-0.5 rounded-full leading-none"
      style={{ color, background: `${color}18`, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded p-3 flex flex-col gap-0.5" style={{ background: "#0B141C", border: "1px solid #1B2A36" }}>
      <div className="font-data-mono text-[8px] text-on-surface-variant tracking-widest uppercase">{label}</div>
      <div className="font-data-mono text-[22px] text-terminal-cyan leading-none">{value}</div>
      {sub && <div className="font-data-mono text-[9px] text-on-surface-variant">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-data-mono text-[9px] tracking-widest uppercase text-on-surface-variant mb-2">{children}</h2>
  );
}

function Table({ cols, rows }: { cols: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded" style={{ border: "1px solid #1B2A36" }}>
      <table className="w-full text-[11px]" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#0D1920", borderBottom: "1px solid #1B2A36" }}>
            {cols.map((c) => (
              <th
                key={c}
                className="font-data-mono text-[8px] tracking-widest uppercase text-on-surface-variant text-left px-3 py-2"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="px-3 py-4 text-center text-on-surface-variant font-data-mono text-[10px]">
                Sem dados disponíveis
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: "1px solid #111E28" }}
              className="hover:bg-[#0D1920] transition-colors"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-on-surface">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── tab sections ──────────────────────────────────────────────────────────────

function RegioesTab({ regions }: { regions: Region[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Regiões monitoradas" value={regions.length} sub="biomas brasileiros" />
        <StatCard label="Área total" value={`${(regions.reduce((s, r) => s + r.area_km2, 0) / 1_000_000).toFixed(1)}M`} sub="km²" />
        <StatCard label="Estados cobertos" value={[...new Set(regions.flatMap(r => r.state.split("/")))].length} sub="estados da federação" />
      </div>
      <div>
        <SectionTitle>Todas as regiões</SectionTitle>
        <Table
          cols={["ID", "Nome", "Estado", "Lat", "Lon", "Área (km²)", "Bbox"]}
          rows={regions.map((r) => [
            <span className="font-data-mono text-terminal-cyan">#{r.id}</span>,
            r.name,
            <Badge label={r.state} color="#5EBBFF" />,
            r.center_lat.toFixed(4),
            r.center_lon.toFixed(4),
            r.area_km2.toLocaleString("pt-BR"),
            <span className="font-data-mono text-[9px] text-on-surface-variant">{r.bbox}</span>,
          ])}
        />
      </div>
    </div>
  );
}

function FocosTab({ regions }: { regions: Region[] }) {
  const [fires, setFires] = useState<FireFocus[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");

  useEffect(() => {
    apiSvc.getFires({ limit: 500 }).then(setFires).catch(() => setFires([])).finally(() => setLoading(false));
  }, []);

  const sources = [...new Set(fires.map((f) => f.source))];
  const filtered = sourceFilter === "all" ? fires : fires.filter((f) => f.source === sourceFilter);

  const regionName = (id: number | null) => regions.find((r) => r.id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total de focos" value={loading ? "…" : fires.length} sub="últimos dados ingeridos" />
        <StatCard label="Fontes" value={sources.length} sub={sources.join(", ") || "—"} />
        <StatCard label="Com alta confiança" value={loading ? "…" : fires.filter((f) => (f.confidence ?? 0) >= 80).length} sub="confiança ≥ 80%" />
        <StatCard label="Com FRP" value={loading ? "…" : fires.filter((f) => f.frp !== null).length} sub="fire radiative power" />
      </div>

      <div className="flex items-center gap-3">
        <SectionTitle>Focos de incêndio ({filtered.length})</SectionTitle>
        <div className="ml-auto flex gap-2">
          {["all", ...sources].map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className="font-data-mono text-[9px] px-2 py-0.5 rounded-full transition-colors"
              style={{
                background: sourceFilter === s ? "rgba(50,211,194,0.12)" : "transparent",
                color: sourceFilter === s ? "#32D3C2" : "#6F808A",
                border: `1px solid ${sourceFilter === s ? "rgba(50,211,194,0.3)" : "#1B2A36"}`,
              }}
            >
              {s === "all" ? "Todos" : s}
            </button>
          ))}
        </div>
      </div>

      <Table
        cols={["ID", "Fonte", "Satélite", "Lat", "Lon", "Brilho", "FRP", "Confiança", "Região", "Data/Hora"]}
        rows={filtered.slice(0, 200).map((f) => [
          <span className="font-data-mono text-[10px] text-on-surface-variant">#{f.id}</span>,
          <Badge label={f.source} color={f.source === "FIRMS" ? "#5EBBFF" : "#32D3C2"} />,
          fmt(f.satellite),
          f.lat.toFixed(4),
          f.lon.toFixed(4),
          fmt(f.brightness),
          fmt(f.frp, " MW"),
          f.confidence !== null ? (
            <span style={{ color: (f.confidence ?? 0) >= 80 ? "#22D47B" : (f.confidence ?? 0) >= 50 ? "#FFC857" : "#FF5A2D" }}>
              {f.confidence}%
            </span>
          ) : "—",
          <span className="text-[10px] text-on-surface-variant">{regionName(f.region_id)}</span>,
          <span className="font-data-mono text-[10px] text-on-surface-variant">{fmtDate(f.acq_datetime)}</span>,
        ])}
      />
      {filtered.length > 200 && (
        <p className="font-data-mono text-[10px] text-on-surface-variant text-center">
          Exibindo 200 de {filtered.length} registros
        </p>
      )}
    </div>
  );
}

function ClimaTab({ regions }: { regions: Region[] }) {
  const [weather, setWeather] = useState<WeatherReading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiSvc.getWeather().then((d) => setWeather(Array.isArray(d) ? d : [d])).catch(() => setWeather([])).finally(() => setLoading(false));
  }, []);

  const regionName = (id: number | null) => regions.find((r) => r.id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Leituras" value={loading ? "…" : weather.length} />
        <StatCard label="Temp. média" value={loading ? "…" : weather.filter(w => w.temp !== null).length === 0 ? "—" : `${(weather.reduce((s, w) => s + (w.temp ?? 0), 0) / weather.filter(w => w.temp !== null).length).toFixed(1)}°C`} />
        <StatCard label="Umid. média" value={loading ? "…" : weather.filter(w => w.humidity !== null).length === 0 ? "—" : `${(weather.reduce((s, w) => s + (w.humidity ?? 0), 0) / weather.filter(w => w.humidity !== null).length).toFixed(0)}%`} />
        <StatCard label="Fontes" value={[...new Set(weather.map(w => w.source))].join(", ") || "—"} />
      </div>
      <SectionTitle>Leituras climáticas</SectionTitle>
      <Table
        cols={["ID", "Fonte", "Região", "Temp.", "Umidade", "Precip.", "Vento", "Timestamp"]}
        rows={weather.map((w) => [
          <span className="font-data-mono text-[10px] text-on-surface-variant">#{w.id}</span>,
          <Badge label={w.source} color="#5EBBFF" />,
          <span className="text-[10px] text-on-surface-variant">{regionName(w.region_id)}</span>,
          fmt(w.temp, "°C"),
          fmt(w.humidity, "%"),
          fmt(w.precip, " mm"),
          fmt(w.wind, " km/h"),
          <span className="font-data-mono text-[10px] text-on-surface-variant">{fmtDate(w.timestamp)}</span>,
        ])}
      />
    </div>
  );
}

function EventosTab() {
  const [events, setEvents] = useState<NaturalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiSvc.getEvents().then(setEvents).catch(() => setEvents([])).finally(() => setLoading(false));
  }, []);

  const cats = [...new Set(events.map((e) => e.category))];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Eventos naturais" value={loading ? "…" : events.length} sub="NASA EONET" />
        <StatCard label="Categorias" value={cats.length} sub={cats.slice(0, 3).join(", ")} />
        <StatCard label="Com coordenadas" value={loading ? "…" : events.filter(e => e.lat !== null).length} />
      </div>
      <SectionTitle>Eventos EONET</SectionTitle>
      <Table
        cols={["ID", "Título", "Categoria", "Fonte", "Lat", "Lon", "Início"]}
        rows={events.map((e) => [
          <span className="font-data-mono text-[10px] text-on-surface-variant">#{e.id}</span>,
          <span className="max-w-[220px] truncate block" title={e.title}>{e.title}</span>,
          <Badge label={e.category} color="#FFC857" />,
          e.source,
          fmt(e.lat),
          fmt(e.lon),
          <span className="font-data-mono text-[10px] text-on-surface-variant">{fmtDate(e.started_at)}</span>,
        ])}
      />
    </div>
  );
}

function AlertasTab({ regions }: { regions: Region[] }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiSvc.getAlerts().then(setAlerts).catch(() => setAlerts([])).finally(() => setLoading(false));
  }, []);

  const regionName = (id: number) => regions.find((r) => r.id === id)?.name ?? `#${id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total alertas" value={loading ? "…" : alerts.length} />
        <StatCard label="Abertos" value={loading ? "…" : alerts.filter(a => a.status === "open").length} sub="aguardando ação" />
        <StatCard label="Reconhecidos" value={loading ? "…" : alerts.filter(a => a.status === "ack").length} />
        <StatCard label="Fechados" value={loading ? "…" : alerts.filter(a => a.status === "closed").length} />
      </div>
      <SectionTitle>Alertas</SectionTitle>
      <Table
        cols={["ID", "Região", "Severidade", "Status", "Score", "Motivo", "Criado em"]}
        rows={alerts.map((a) => [
          <span className="font-data-mono text-[10px] text-on-surface-variant">#{a.id}</span>,
          <span className="text-[10px]">{regionName(a.region_id)}</span>,
          <Badge label={a.severity} color={a.severity === "Critico" ? "#FF3347" : "#FF5A2D"} />,
          <Badge label={a.status} color={statusColor(a.status)} />,
          <span style={{ color: a.score >= 70 ? "#FF5A2D" : "#FFC857" }}>{a.score.toFixed(1)}</span>,
          <span className="max-w-[200px] truncate block text-on-surface-variant text-[10px]" title={a.reason}>{a.reason}</span>,
          <span className="font-data-mono text-[10px] text-on-surface-variant">{fmtDate(a.created_at)}</span>,
        ])}
      />
    </div>
  );
}

function SensoresTab({ regions }: { regions: Region[] }) {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiSvc.getSensorReadings(undefined, 200).then(setReadings).catch(() => setReadings([])).finally(() => setLoading(false));
  }, []);

  const regionName = (id: number | null) => id ? (regions.find((r) => r.id === id)?.name ?? `#${id}`) : "—";
  const devices = [...new Set(readings.map(r => r.device_id))];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Leituras IoT" value={loading ? "…" : readings.length} />
        <StatCard label="Dispositivos" value={devices.length} sub={devices.slice(0, 2).join(", ")} />
        <StatCard label="Temp. média" value={loading ? "…" : readings.filter(r => r.temperature !== null).length === 0 ? "—" : `${(readings.reduce((s, r) => s + (r.temperature ?? 0), 0) / readings.filter(r => r.temperature !== null).length).toFixed(1)}°C`} />
        <StatCard label="Umid. solo média" value={loading ? "…" : readings.filter(r => r.soil_moisture !== null).length === 0 ? "—" : `${(readings.reduce((s, r) => s + (r.soil_moisture ?? 0), 0) / readings.filter(r => r.soil_moisture !== null).length).toFixed(0)}%`} />
      </div>
      <SectionTitle>Leituras de sensores ESP32 ({readings.length})</SectionTitle>
      <Table
        cols={["ID", "Dispositivo", "Região", "Temp.", "Umidade", "Fumaça", "Umid. Solo", "Capturado em"]}
        rows={readings.map((r) => [
          <span className="font-data-mono text-[10px] text-on-surface-variant">#{r.id}</span>,
          <span className="font-data-mono text-[10px]" style={{ color: "#5EBBFF" }}>{r.device_id}</span>,
          <span className="text-[10px] text-on-surface-variant">{regionName(r.region_id)}</span>,
          fmt(r.temperature, "°C"),
          fmt(r.humidity, "%"),
          r.smoke !== null ? <span style={{ color: (r.smoke ?? 0) > 500 ? "#FF3347" : (r.smoke ?? 0) > 200 ? "#FFC857" : "#22D47B" }}>{r.smoke}</span> : "—",
          fmt(r.soil_moisture, "%"),
          <span className="font-data-mono text-[10px] text-on-surface-variant">{fmtDate(r.created_at)}</span>,
        ])}
      />
    </div>
  );
}

function RiscoTab({ regions }: { regions: Region[] }) {
  const [risk, setRisk] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiSvc.getRisk().then(setRisk).catch(() => setRisk([])).finally(() => setLoading(false));
  }, []);

  const regionName = (id: number) => regions.find((r) => r.id === id)?.name ?? `#${id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Regiões avaliadas" value={loading ? "…" : risk.length} />
        <StatCard label="Score máximo" value={loading ? "…" : risk.length === 0 ? "—" : risk[0].score.toFixed(1)} sub={risk[0]?.name} />
        <StatCard label="Crítico" value={loading ? "…" : risk.filter(r => r.level === "Critico").length} sub="regiões" />
        <StatCard label="Alto" value={loading ? "…" : risk.filter(r => r.level === "Alto").length} sub="regiões" />
      </div>
      <SectionTitle>Avaliações de risco</SectionTitle>
      <Table
        cols={["Região", "Score", "Nível", "Fogo", "Clima", "Dispersão", "Tendência", "Explicação"]}
        rows={risk.map((r) => {
          const f = (r.features ?? {}) as Record<string, unknown>;
          const comp = (f.components ?? f) as Record<string, number>;
          return [
            <span className="font-semibold">{r.name}</span>,
            <span className="font-data-mono font-bold" style={{ color: riskColor(r.level) }}>{r.score.toFixed(1)}</span>,
            <Badge label={r.level} color={riskColor(r.level)} />,
            <span className="font-data-mono text-[10px]">{typeof comp.fire_activity === "number" ? comp.fire_activity.toFixed(0) : "—"}</span>,
            <span className="font-data-mono text-[10px]">{typeof comp.weather_stress === "number" ? comp.weather_stress.toFixed(0) : "—"}</span>,
            <span className="font-data-mono text-[10px]">{typeof comp.spread_potential === "number" ? comp.spread_potential.toFixed(0) : "—"}</span>,
            <span className="font-data-mono text-[10px]">{typeof comp.trend === "number" ? comp.trend.toFixed(0) : "—"}</span>,
            <span className="text-[10px] text-on-surface-variant max-w-[200px] truncate block" title={r.explanation}>{r.explanation}</span>,
          ];
        })}
      />
    </div>
  );
}

function IngestaoTab() {
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiSvc.getRuns().then(setRuns).catch(() => setRuns([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Execuções" value={loading ? "…" : runs.length} />
        <StatCard label="Com sucesso" value={loading ? "…" : runs.filter(r => r.status === "success").length} />
        <StatCard label="Parciais" value={loading ? "…" : runs.filter(r => r.status === "partial").length} />
        <StatCard label="Falhas" value={loading ? "…" : runs.filter(r => r.status === "failed").length} />
      </div>
      <SectionTitle>Histórico de ingestão</SectionTitle>
      <Table
        cols={["ID", "Fonte", "Status", "Registros", "Fixture", "Início", "Fim", "Erro"]}
        rows={runs.map((r) => [
          <span className="font-data-mono text-[10px] text-on-surface-variant">#{r.id}</span>,
          <Badge label={r.source} color="#5EBBFF" />,
          <Badge label={r.status} color={statusColor(r.status)} />,
          <span className="font-data-mono">{r.records_count}</span>,
          r.used_fixture ? <Badge label="fixture" color="#FFC857" /> : <span className="text-on-surface-variant text-[10px]">não</span>,
          <span className="font-data-mono text-[10px] text-on-surface-variant">{fmtDate(r.started_at)}</span>,
          <span className="font-data-mono text-[10px] text-on-surface-variant">{fmtDate(r.finished_at)}</span>,
          r.error ? <span className="text-[10px] text-risk-high truncate max-w-[120px] block" title={r.error}>{r.error}</span> : <span className="text-on-surface-variant text-[10px]">—</span>,
        ])}
      />
    </div>
  );
}

// ── tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "regioes",   label: "Regiões",    glyph: "◍",  color: "#32D3C2" },
  { key: "focos",     label: "Focos",      glyph: "▲",  color: "#FF5A2D" },
  { key: "clima",     label: "Clima",      glyph: "°",  color: "#5EBBFF" },
  { key: "eventos",   label: "Eventos",    glyph: "◈",  color: "#FFC857" },
  { key: "alertas",   label: "Alertas",    glyph: "!",  color: "#FF3347" },
  { key: "sensores",  label: "Sensores",   glyph: "⌁",  color: "#22D47B" },
  { key: "risco",     label: "Risco",      glyph: "▦",  color: "#FF5A2D" },
  { key: "ingestao",  label: "Ingestão",   glyph: "↺",  color: "#AAB7BE" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface Props {
  regions: Region[];
}

// ── main component ────────────────────────────────────────────────────────────

export default function DataExplorerPage({ regions }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("regioes");
  const active = TABS.find((t) => t.key === activeTab)!;

  return (
    <section className="flex-1 flex flex-col overflow-hidden" style={{ background: "#05090D" }}>
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-4 px-6 py-4 border-b border-outline-variant"
        style={{ background: "#0B141C" }}
      >
        <span className="font-data-mono text-[18px] leading-none" style={{ color: "#32D3C2" }}>⊞</span>
        <div>
          <h1 className="font-data-mono text-[13px] font-bold text-terminal-cyan tracking-wider uppercase">
            Explorador de Dados
          </h1>
          <p className="font-data-mono text-[10px] text-on-surface-variant">
            Visualize todos os dados disponíveis no banco de dados OrbitGuard
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="shrink-0 flex items-center gap-1 px-4 border-b border-outline-variant overflow-x-auto"
        style={{ background: "#071017" }}
      >
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-3 py-2.5 font-data-mono text-[10px] whitespace-nowrap transition-colors shrink-0"
              style={{
                color: isActive ? tab.color : "#6F808A",
                borderBottom: isActive ? `2px solid ${tab.color}` : "2px solid transparent",
                background: isActive ? `${tab.color}08` : "transparent",
              }}
            >
              <span className="text-[12px] leading-none">{tab.glyph}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1200px]">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-data-mono text-[14px] leading-none" style={{ color: active.color }}>{active.glyph}</span>
            <span className="font-data-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: active.color }}>
              {active.label}
            </span>
          </div>

          {activeTab === "regioes"  && <RegioesTab regions={regions} />}
          {activeTab === "focos"    && <FocosTab regions={regions} />}
          {activeTab === "clima"    && <ClimaTab regions={regions} />}
          {activeTab === "eventos"  && <EventosTab />}
          {activeTab === "alertas"  && <AlertasTab regions={regions} />}
          {activeTab === "sensores" && <SensoresTab regions={regions} />}
          {activeTab === "risco"    && <RiscoTab regions={regions} />}
          {activeTab === "ingestao" && <IngestaoTab />}
        </div>
      </div>
    </section>
  );
}
