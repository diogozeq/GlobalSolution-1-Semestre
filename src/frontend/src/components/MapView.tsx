import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { FireFocus, Region, RiskItem } from "../types";
import { levelLabel, riskColor } from "../lib/risk";

interface Props {
  fires: FireFocus[];
  regions: Region[];
  risk: RiskItem[];
  selectedRegionId: number | null;
  onSelectRegion: (id: number) => void;
}

function HudBridge({ onMove }: { onMove: (lat: number, lon: number) => void }) {
  const map = useMapEvents({
    move: () => {
      const c = map.getCenter();
      onMove(c.lat, c.lng);
    },
  });
  useEffect(() => {
    const c = map.getCenter();
    onMove(c.lat, c.lng);
  }, [map, onMove]);
  return null;
}

function FlyTo({ region }: { region?: Region }) {
  const map = useMap();
  useEffect(() => {
    if (region) map.flyTo([region.center_lat, region.center_lon], 6, { duration: 1.1 });
  }, [region, map]);
  return null;
}

const LEGEND = [
  { label: "CRITICAL", color: "#EF4444" },
  { label: "HIGH", color: "#F97316" },
  { label: "MODERATE", color: "#FBBF24" },
  { label: "LOW", color: "#10B981" },
];

export default function MapView({ fires, regions, risk, selectedRegionId, onSelectRegion }: Props) {
  const [coords, setCoords] = useState({ lat: -15.7942, lon: -47.8822 });
  const selected = regions.find((r) => r.id === selectedRegionId);
  const riskByRegion = useMemo(
    () => new Map(risk.map((r) => [r.region_id, r])),
    [risk],
  );

  return (
    <section className="flex-1 relative bg-surface-container-lowest">
      <MapContainer
        center={[-12, -52]}
        zoom={4}
        zoomControl={true}
        className="w-full h-full z-0"
        preferCanvas
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <HudBridge onMove={(lat, lon) => setCoords({ lat, lon })} />
        <FlyTo region={selected} />

        {regions.map((region) => {
          const r = riskByRegion.get(region.id);
          const color = riskColor(r?.level);
          return (
            <CircleMarker
              key={`region-${region.id}`}
              center={[region.center_lat, region.center_lon]}
              radius={selectedRegionId === region.id ? 13 : 9}
              pathOptions={{
                color,
                weight: selectedRegionId === region.id ? 3 : 1.5,
                fillColor: color,
                fillOpacity: 0.12,
              }}
              eventHandlers={{ click: () => onSelectRegion(region.id) }}
            >
              <Popup>
                <div className="font-data-mono text-xs">
                  <div className="font-bold text-terminal-cyan">{region.name}</div>
                  <div>{region.state}</div>
                  {r ? (
                    <div style={{ color }}>
                      {levelLabel(r.level)} · {r.score.toFixed(1)}/100
                    </div>
                  ) : (
                    <div className="opacity-70">risco: aguardando cálculo</div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {selected && (
          <Circle
            center={[selected.center_lat, selected.center_lon]}
            radius={120000}
            pathOptions={{ color: "#22D3EE", weight: 1, fillOpacity: 0.03, dashArray: "4 6" }}
          />
        )}

        {fires.map((f) => {
          const level = f.region_id != null ? riskByRegion.get(f.region_id)?.level : undefined;
          const color = riskColor(level);
          const radius = 2.5 + (f.confidence ? (f.confidence / 100) * 4 : 1.5);
          return (
            <CircleMarker
              key={`fire-${f.source}-${f.id}`}
              center={[f.lat, f.lon]}
              radius={radius}
              pathOptions={{ color, weight: 0, fillColor: color, fillOpacity: 0.8 }}
            >
              <Popup>
                <div className="font-data-mono text-xs space-y-0.5">
                  <div className="font-bold text-terminal-cyan">{f.source}</div>
                  <div>LAT {f.lat.toFixed(3)} LON {f.lon.toFixed(3)}</div>
                  <div>Brilho: {f.brightness ?? "—"}</div>
                  <div>Confiança: {f.confidence ?? "—"}</div>
                  <div>Sat: {f.satellite ?? "—"}</div>
                  <div>{f.acq_datetime?.replace("T", " ").substring(0, 16) ?? ""}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* HUD: viewport */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-[400] pointer-events-none">
        <div className="bg-surface-container/80 backdrop-blur-md border border-outline-variant p-3 rounded-lg flex flex-col">
          <span className="font-label-caps text-[10px] text-terminal-cyan">CURRENT VIEWPORT</span>
          <span className="font-data-mono text-body-sm">
            LAT: {coords.lat.toFixed(4)} LON: {coords.lon.toFixed(4)}
          </span>
        </div>
        <div className="bg-surface-container/80 backdrop-blur-md border border-outline-variant px-3 py-2 rounded-lg">
          <span className="font-label-caps text-[10px] text-on-surface-variant">FIRE FOCI: </span>
          <span className="font-data-mono text-body-sm text-terminal-cyan">{fires.length}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[400]">
        <div className="bg-surface-container/90 border border-outline-variant p-2 rounded flex items-center gap-4 px-4">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
              <span className="font-label-caps text-[10px]">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
