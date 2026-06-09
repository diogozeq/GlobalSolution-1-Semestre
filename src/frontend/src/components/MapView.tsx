import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { CrossValidation, FireFocus, NaturalEvent, Region, RiskItem, WeatherReading } from "../types";
import { levelLabel, riskColor } from "../lib/risk";
import { getFiresCrossValidation } from "../services/api";

interface Props {
  fires: FireFocus[];
  regions: Region[];
  risk: RiskItem[];
  events: NaturalEvent[];
  weather: Record<number, WeatherReading>;
  selectedRegionId: number | null;
  onSelectRegion: (id: number) => void;
}

type SourceFilter = "all" | "FIRMS" | "INPE";

const EVENT_COLORS: Record<string, string> = {
  wildfires: "#FF5A2D",
  severeStorms: "#5EBBFF",
  floods: "#2E7BFF",
  drought: "#FFC857",
};

// Foco exclusivo no Brasil — o mapa não sai destes limites.
// [[sul, oeste], [norte, leste]]
const BRAZIL_BOUNDS: [[number, number], [number, number]] = [
  [-34, -74],
  [6, -33],
];

function inBrazil(lat: number | null, lon: number | null): boolean {
  return lat != null && lon != null && lat >= -34 && lat <= 6 && lon >= -74 && lon <= -33;
}

function copernicusUrl(lat: number, lon: number): string {
  return `https://browser.dataspace.copernicus.eu/?zoom=8&lat=${lat.toFixed(4)}&lng=${lon.toFixed(4)}`;
}

// Writes coords directly to a DOM ref — no React state update during pan/zoom
function HudBridge({ coordsRef }: { coordsRef: { current: HTMLSpanElement | null } }) {
  const map = useMapEvents({
    move: () => {
      if (!coordsRef.current) return;
      const c = map.getCenter();
      coordsRef.current.textContent = `${c.lat.toFixed(4)}° · ${c.lng.toFixed(4)}°`;
    },
  });
  return null;
}

function FlyTo({ region }: { region?: Region }) {
  const map = useMap();
  useEffect(() => {
    if (region) map.flyTo([region.center_lat, region.center_lon], 6, { duration: 1.1 });
  }, [region, map]);
  return null;
}

// Frames the map tightly on Brazil on load (foco exclusivo no Brasil).
function FitBrazil() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(BRAZIL_BOUNDS, { padding: [10, 10] });
  }, [map]);
  return null;
}

const LEGEND = [
  { label: "CRÍTICO",  color: "#FF3347" },
  { label: "ALTO",     color: "#FF5A2D" },
  { label: "MODERADO", color: "#FFC857" },
  { label: "BAIXO",    color: "#22D47B" },
];

function LayerToggle({ active, onToggle, color, label }: {
  active: boolean; onToggle: () => void; color: string; label: string;
}) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 text-left transition-all duration-120 w-full">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-120"
        style={{ background: active ? color : "#374151", boxShadow: active ? `0 0 6px ${color}88` : "none" }}
      />
      <span className="font-data-mono text-[9px] tracking-wider" style={{ color: active ? "#E8F0F2" : "#6F808A" }}>
        {label}
      </span>
      <span className="ml-auto font-data-mono text-[8px]" style={{ color: active ? color : "#374151" }}>
        {active ? "ON" : "OFF"}
      </span>
    </button>
  );
}

const FireLayer = memo(function FireLayer({ fires, riskByRegion, show }: {
  fires: FireFocus[]; riskByRegion: Map<number, RiskItem>; show: boolean;
}) {
  if (!show) return null;
  return (
    <>
      {fires.map((f) => {
        const level = f.region_id != null ? riskByRegion.get(f.region_id)?.level : undefined;
        const color = riskColor(level);
        const radius = 2.5 + (f.confidence ? (f.confidence / 100) * 4 : 1.5);
        return (
          <CircleMarker
            key={`fire-${f.source}-${f.id}`}
            center={[f.lat, f.lon]}
            radius={radius}
            pathOptions={{ color, weight: f.source === "INPE" ? 1 : 0, fillColor: color, fillOpacity: 0.85, dashArray: f.source === "INPE" ? "1 1" : undefined }}
          >
            <Popup>
              <div className="font-data-mono text-xs space-y-0.5">
                <div className="font-bold" style={{ color: "#32D3C2" }}>{f.source}</div>
                <div>LAT {f.lat.toFixed(3)} · LON {f.lon.toFixed(3)}</div>
                <div>Brilho: {f.brightness ?? "—"} · FRP: {f.frp ?? "—"} MW</div>
                <div>Confiança: {f.confidence ?? "—"} · Sat: {f.satellite ?? "—"}</div>
                <div>{f.acq_datetime?.replace("T", " ").substring(0, 16) ?? ""}</div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
});

const EventLayer = memo(function EventLayer({ events, show }: { events: NaturalEvent[]; show: boolean }) {
  if (!show) return null;
  return (
    <>
      {events.filter((e) => inBrazil(e.lat, e.lon)).map((e) => {
        const color = EVENT_COLORS[e.category] ?? "#AAB7BE";
        return (
          <CircleMarker
            key={`event-${e.id}`}
            center={[e.lat as number, e.lon as number]}
            radius={7}
            pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.12 }}
          >
            <Popup>
              <div className="font-data-mono text-xs space-y-1 min-w-[150px]">
                <div className="font-bold uppercase" style={{ color }}>{e.category || "evento"}</div>
                <div style={{ color: "#E8F0F2" }}>{e.title}</div>
                <div style={{ color: "#6F808A" }}>{e.source} · {e.started_at?.substring(0, 10) ?? ""}</div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
});

const RegionLayer = memo(function RegionLayer({ regions, riskByRegion, selectedRegionId, onSelectRegion, show }: {
  regions: Region[]; riskByRegion: Map<number, RiskItem>; selectedRegionId: number | null;
  onSelectRegion: (id: number) => void; show: boolean;
}) {
  if (!show) return null;
  return (
    <>
      {regions.map((region) => {
        const r = riskByRegion.get(region.id);
        const color = riskColor(r?.level);
        const isSel = selectedRegionId === region.id;
        return (
          <CircleMarker
            key={`region-${region.id}`}
            center={[region.center_lat, region.center_lon]}
            radius={isSel ? 14 : 10}
            pathOptions={{ color, weight: isSel ? 2.5 : 1.5, fillColor: color, fillOpacity: isSel ? 0.18 : 0.1 }}
            eventHandlers={{ click: () => onSelectRegion(region.id) }}
          >
            <Popup>
              <div className="font-data-mono text-xs space-y-1 min-w-[150px]">
                <div className="font-bold" style={{ color: "#32D3C2" }}>{region.name}</div>
                <div style={{ color: "#AAB7BE" }}>{region.state}</div>
                {r ? (
                  <div style={{ color }}>{levelLabel(r.level)} · {r.score.toFixed(1)}/100</div>
                ) : (
                  <div style={{ color: "#6F808A" }}>Aguardando cálculo</div>
                )}
                <a
                  href={copernicusUrl(region.center_lat, region.center_lon)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#5EBBFF", textDecoration: "underline" }}
                >
                  Ver imagem orbital (Sentinel) →
                </a>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
});

export default function MapView({ fires, regions, risk, events, weather, selectedRegionId, onSelectRegion }: Props) {
  const coordsRef = useRef<HTMLSpanElement>(null);
  const [showFires, setShowFires] = useState(true);
  const [showRegions, setShowRegions] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [crossVal, setCrossVal] = useState<CrossValidation | null>(null);

  const selected = useMemo(() => regions.find((r) => r.id === selectedRegionId), [regions, selectedRegionId]);
  const selectedWeather = selected?.id != null ? weather[selected.id] : undefined;
  const riskByRegion = useMemo(() => new Map(risk.map((r) => [r.region_id, r])), [risk]);

  useEffect(() => {
    let ok = true;
    getFiresCrossValidation().then((d) => ok && setCrossVal(d)).catch(() => undefined);
    return () => { ok = false; };
  }, [fires.length]);

  const filteredFires = useMemo(() => {
    const base = sourceFilter === "all" ? fires : fires.filter((f) => f.source === sourceFilter);
    if (base.length <= 400) return base;
    return [...base].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 400);
  }, [fires, sourceFilter]);

  return (
    <section className="flex-1 relative" style={{ background: "#071017" }}>
      <div className="map-grid-overlay" />
      <div className="scan-line" />

      <MapContainer
        center={[-15, -54]}
        zoom={4}
        minZoom={4}
        maxBounds={BRAZIL_BOUNDS}
        maxBoundsViscosity={1.0}
        zoomControl
        className="w-full h-full z-0"
        preferCanvas
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
          updateWhenZooming={false}
          updateWhenIdle
          keepBuffer={2}
        />
        <HudBridge coordsRef={coordsRef} />
        <FitBrazil />
        <FlyTo region={selected} />

        <RegionLayer
          regions={regions}
          riskByRegion={riskByRegion}
          selectedRegionId={selectedRegionId}
          onSelectRegion={onSelectRegion}
          show={showRegions}
        />

        {selected && (
          <Circle
            center={[selected.center_lat, selected.center_lon]}
            radius={130000}
            pathOptions={{ color: "#32D3C2", weight: 1, fillOpacity: 0.03, dashArray: "5 8" }}
          />
        )}

        <FireLayer fires={filteredFires} riskByRegion={riskByRegion} show={showFires} />
        <EventLayer events={events} show={showEvents} />
      </MapContainer>

      {/* HUD: top-left */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 z-[400] pointer-events-none">
        <div className="panel-glass border border-outline-variant rounded px-3 py-2 flex flex-col gap-0.5">
          <span className="font-data-mono text-[9px] text-terminal-cyan tracking-widest">VISÃO ATUAL</span>
          <span ref={coordsRef} className="font-data-mono text-[11px] text-on-surface">-12.0000° · -52.0000°</span>
        </div>

        <div className="panel-glass border border-outline-variant rounded px-3 py-2 flex items-center gap-2">
          <span className="font-data-mono text-[12px] leading-none" style={{ color: "#FF5A2D" }}>▲</span>
          <span className="font-data-mono text-[9px] text-on-surface-variant tracking-wider">FOCOS</span>
          <span className="font-data-mono text-[13px] text-terminal-cyan ml-auto">{filteredFires.length}</span>
        </div>

        {selectedWeather && (
          <div className="panel-glass border border-outline-variant rounded px-3 py-2">
            <span className="font-data-mono text-[9px] text-on-surface-variant tracking-widest block mb-1">CLIMA DA REGIÃO</span>
            <div className="font-data-mono text-[11px] text-on-surface leading-relaxed">
              <span>{selectedWeather.temp ?? "--"}°C</span>
              <span className="text-on-surface-variant mx-1">·</span>
              <span>{selectedWeather.humidity ?? "--"}% UR</span>
              <span className="text-on-surface-variant mx-1">·</span>
              <span>{selectedWeather.wind ?? "--"} km/h</span>
            </div>
          </div>
        )}
      </div>

      {/* Layer filters + source + cross-validation: top-right */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
        <div className="panel-glass border border-outline-variant rounded px-3 py-2.5 flex flex-col gap-2 min-w-[160px]">
          <span className="font-data-mono text-[8px] text-on-surface-variant tracking-widest uppercase mb-0.5">Camadas</span>
          <LayerToggle active={showFires} onToggle={() => setShowFires((v) => !v)} color="#FF5A2D" label="Focos de calor" />
          <LayerToggle active={showRegions} onToggle={() => setShowRegions((v) => !v)} color="#32D3C2" label="Regiões" />
          <LayerToggle active={showEvents} onToggle={() => setShowEvents((v) => !v)} color="#5EBBFF" label="Eventos EONET" />

          <div className="h-px my-0.5" style={{ background: "#1B2A36" }} />
          <span className="font-data-mono text-[8px] text-on-surface-variant tracking-widest uppercase">Fonte de focos</span>
          <div className="flex gap-1">
            {(["all", "FIRMS", "INPE"] as SourceFilter[]).map((s) => {
              const active = sourceFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className="flex-1 font-data-mono text-[8px] py-0.5 rounded transition-all duration-120"
                  style={{
                    background: active ? "rgba(50,211,194,0.12)" : "rgba(255,255,255,0.03)",
                    color: active ? "#32D3C2" : "#6F808A",
                    border: `1px solid ${active ? "rgba(50,211,194,0.35)" : "#1B2A36"}`,
                  }}
                >
                  {s === "all" ? "Ambas" : s}
                </button>
              );
            })}
          </div>
        </div>

        {crossVal && (crossVal.firms_foci > 0 || crossVal.inpe_foci > 0) && (
          <div className="panel-glass border border-outline-variant rounded px-3 py-2 min-w-[160px]">
            <span className="font-data-mono text-[8px] text-on-surface-variant tracking-widest uppercase block mb-1">
              Validação FIRMS × INPE
            </span>
            <div className="font-data-mono text-[10px] text-on-surface space-y-0.5">
              <div className="flex justify-between"><span>FIRMS</span><span className="text-terminal-cyan">{crossVal.firms_foci}</span></div>
              <div className="flex justify-between"><span>INPE</span><span className="text-terminal-cyan">{crossVal.inpe_foci}</span></div>
              <div className="flex justify-between">
                <span>Confirmados</span>
                <span style={{ color: "#22D47B" }}>{crossVal.confirmed_cells} ({crossVal.confirmation_rate}%)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend: bottom-left */}
      <div className="absolute bottom-3 left-3 z-[400]">
        <div className="panel-glass border border-outline-variant rounded px-3 py-2 flex items-center gap-4">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: l.color, boxShadow: `0 0 6px ${l.color}66` }} />
              <span className="font-data-mono text-[9px] tracking-wide" style={{ color: l.color }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Source badge: bottom-right */}
      <div className="absolute bottom-3 right-3 z-[400]">
        <div className="panel-glass border border-outline-variant rounded px-3 py-1.5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-risk-low animate-pulse-dot" />
          <span className="font-data-mono text-[9px] text-on-surface-variant tracking-wider">
            NASA FIRMS · INPE · EONET · CARTO
          </span>
        </div>
      </div>
    </section>
  );
}
