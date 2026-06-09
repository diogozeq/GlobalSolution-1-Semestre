import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { DashboardHook } from "../hooks/useDashboard";
import { apiBaseURL } from "../services/api";
import * as apiSvc from "../services/api";
import { levelLabel, riskColor } from "../lib/risk";
import { toast } from "../lib/toast";
import ScoreBreakdown from "./ScoreBreakdown";
import RiskHistorySparkline from "./RiskHistorySparkline";
import type { IngestRun, MlExperiment, SensorRegionLatest } from "../types";

interface Props {
  page: string;
  d: DashboardHook;
  onOpenMission: (regionId?: number) => void;
}

const SOURCE_META: Record<string, string> = {
  FIRMS: "Focos MODIS/VIIRS por área (NASA). Requer FIRMS_MAP_KEY.",
  INPE: "CSV diário oficial do Brasil (Programa Queimadas). Sem chave.",
  "Open-Meteo": "Clima atual por coordenada. Sem chave.",
  EONET: "Eventos naturais ativos (NASA). Sem chave.",
  NASA_POWER: "Meteorologia histórica diária (NASA POWER). Sem chave.",
};

function copernicusUrl(lat: number, lon: number): string {
  return `https://browser.dataspace.copernicus.eu/?zoom=8&lat=${lat.toFixed(4)}&lng=${lon.toFixed(4)}`;
}

function EnvBanner({ d }: { d: DashboardHook }) {
  if (d.apiOnline && !d.usingFixture) return null;
  const offline = !d.apiOnline;
  return (
    <div
      className="mb-4 rounded px-3 py-2 font-data-mono text-[10px]"
      style={{
        background: offline ? "rgba(255,51,71,0.08)" : "rgba(255,200,87,0.08)",
        border: `1px solid ${offline ? "rgba(255,51,71,0.3)" : "rgba(255,200,87,0.25)"}`,
        color: offline ? "#FF6B7A" : "#FFC857",
      }}
    >
      {offline
        ? "⚠ Backend offline — dados podem estar desatualizados."
        : "⚠ Modo demo: exibindo fixtures locais. Clique em Atualizar para dados reais."}
    </div>
  );
}

function Shell({ title, subtitle, d, children }: { title: string; subtitle: string; d?: DashboardHook; children: ReactNode }) {
  return (
    <section className="flex-1 overflow-y-auto bg-surface-container-lowest p-6">
      <div className="mb-5">
        <h1 className="font-headline-md text-headline-md text-terminal-cyan">{title}</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">{subtitle}</p>
      </div>
      {d && <EnvBanner d={d} />}
      {children}
    </section>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-surface-container border border-outline-variant rounded-lg p-4 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-label-caps text-label-caps text-terminal-cyan uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-body-sm text-on-surface-variant opacity-60 py-4 text-center font-data-mono text-[11px]">
      {text}
    </p>
  );
}

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function runStatus(status: string) {
  if (status === "success") return "sucesso";
  if (status === "partial") return "parcial";
  if (status === "failed") return "falha";
  return status;
}

function statusColor(status: string) {
  if (status === "success") return "#22D47B";
  if (status === "partial") return "#FFC857";
  if (status === "failed") return "#FF3347";
  return "#6F808A";
}

function bySource(items: { source: string }[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.source] = (acc[item.source] ?? 0) + 1;
    return acc;
  }, {});
}

function TelemetryPage({ d }: { d: DashboardHook }) {
  const fireSources = bySource(d.fires);
  const weatherSources = bySource(Object.values(d.weather));

  return (
    <Shell title="Telemetria" subtitle="Leitura operacional das coletas reais, clima, eventos e fontes ativas." d={d}>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Fontes de fogo">
          <div className="space-y-2">
            {Object.entries(fireSources).map(([source, count]) => (
              <div key={source} className="flex justify-between text-body-sm">
                <span>{source}</span>
                <span className="font-data-mono text-terminal-cyan">{count}</span>
              </div>
            ))}
            {Object.keys(fireSources).length === 0 && <Empty text="Sem focos carregados." />}
          </div>
        </Panel>

        <Panel title="Clima">
          <div className="space-y-2">
            {Object.entries(weatherSources).map(([source, count]) => (
              <div key={source} className="flex justify-between text-body-sm">
                <span>{source}</span>
                <span className="font-data-mono text-terminal-cyan">{count} regiões</span>
              </div>
            ))}
            {Object.keys(weatherSources).length === 0 && <Empty text="Sem leituras de clima." />}
          </div>
        </Panel>

        <Panel title="Eventos naturais">
          <div className="flex justify-between text-body-sm">
            <span>EONET ativos</span>
            <span className="font-data-mono text-terminal-cyan">{d.events.length}</span>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        <Panel title="Clima por região">
          <div className="space-y-2">
            {d.regions.map((region) => {
              const w = d.weather[region.id];
              return (
                <div key={region.id} className="grid grid-cols-5 gap-2 text-body-sm border-b border-outline-variant/40 pb-2">
                  <span className="col-span-2 text-on-surface">{region.name}</span>
                  <span>{w?.temp ?? "-"} °C</span>
                  <span>{w?.humidity ?? "-"}% UR</span>
                  <span>{w?.wind ?? "-"} km/h</span>
                </div>
              );
            })}
            {d.regions.length === 0 && <Empty text="Sem regiões." />}
          </div>
        </Panel>

        <Panel title="Últimas coletas">
          <div className="space-y-2">
            {d.runHistory.slice(0, 8).map((run) => (
              <div key={run.id} className="flex flex-col gap-0.5 border-b border-outline-variant/40 pb-2">
                <div className="grid grid-cols-4 gap-2 text-body-sm">
                  <span>{run.source}</span>
                  <span style={{ color: statusColor(run.status) }}>{runStatus(run.status)}</span>
                  <span className="font-data-mono text-terminal-cyan">{run.records_count}</span>
                  <span>{run.used_fixture ? "fixture" : "real"}</span>
                </div>
                {run.status === "failed" && run.error && (
                  <p className="font-data-mono text-[9px] opacity-70 truncate" style={{ color: "#FF6B7A" }} title={run.error}>
                    ↳ {run.error}
                  </p>
                )}
              </div>
            ))}
            {d.runHistory.length === 0 && <Empty text="Nenhuma coleta executada ainda." />}
          </div>
        </Panel>
      </div>
    </Shell>
  );
}

function AssetsPage({ d, onOpenMission }: { d: DashboardHook; onOpenMission: (regionId?: number) => void }) {
  const sourceStatus = useMemo(() => {
    const map = new Map<string, (typeof d.runHistory)[number]>();
    for (const run of d.runHistory) if (!map.has(run.source)) map.set(run.source, run);
    return [...map.values()];
  }, [d.runHistory]);

  return (
    <Shell title="Ativos monitorados" subtitle="Regiões, fontes externas (status real) e análise orbital." d={d}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Regiões">
          <div className="space-y-3">
            {d.regions.map((region) => (
              <div key={region.id} className="border border-outline-variant rounded-lg p-3">
                <div className="flex justify-between gap-4">
                  <button onClick={() => onOpenMission(region.id)} className="text-left hover:text-terminal-cyan transition-colors">
                    <div className="font-bold text-on-surface">{region.name}</div>
                    <div className="text-[11px] text-on-surface-variant">
                      {region.state} - {Math.round(region.area_km2).toLocaleString("pt-BR")} km²
                    </div>
                  </button>
                  <div className="text-right">
                    <div className="font-data-mono text-[11px] text-terminal-cyan">
                      {region.center_lat.toFixed(2)}, {region.center_lon.toFixed(2)}
                    </div>
                    <a
                      href={copernicusUrl(region.center_lat, region.center_lon)}
                      target="_blank" rel="noreferrer"
                      className="font-data-mono text-[10px]"
                      style={{ color: "#5EBBFF" }}
                    >
                      🛰 Sentinel →
                    </a>
                  </div>
                </div>
              </div>
            ))}
            {d.regions.length === 0 && <Empty text="Sem regiões." />}
          </div>
        </Panel>

        <Panel title="Fontes (status real)">
          <div className="space-y-3">
            {sourceStatus.map((run) => (
              <div key={run.source} className="border border-outline-variant rounded-lg p-3">
                <div className="flex justify-between gap-3 items-center">
                  <span className="font-bold">{run.source}</span>
                  <span className="font-label-caps text-[10px]" style={{ color: statusColor(run.status) }}>
                    {runStatus(run.status)} · {run.used_fixture ? "fixture" : "real"}
                  </span>
                </div>
                <p className="text-body-sm text-on-surface-variant mt-1">{SOURCE_META[run.source] ?? "Fonte de dados."}</p>
                <p className="font-data-mono text-[10px] text-on-surface-variant opacity-60 mt-1">
                  {run.records_count} registros · {fmtDate(run.started_at)}
                </p>
              </div>
            ))}
            {sourceStatus.length === 0 && <Empty text="Nenhuma fonte coletada. Clique em Atualizar." />}
          </div>
        </Panel>
      </div>
    </Shell>
  );
}

function RiskPage({ d, onOpenMission }: { d: DashboardHook; onOpenMission: (regionId?: number) => void }) {
  return (
    <Shell
      title="Modelos de risco"
      subtitle="Scores explicáveis por região: foco de calor, clima, dispersão e tendência."
      d={d}
    >
      {d.risk.length === 0 ? (
        <Panel title="Sem avaliação">
          <Empty text="Nenhum risco calculado. Use Atualizar → Recalcular risco." />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {d.risk.map((item) => {
            const color = riskColor(item.level);
            const region = d.regions.find((r) => r.id === item.region_id);
            return (
              <div key={item.region_id} className="bg-surface-container border border-outline-variant rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h2 className="font-headline-md text-body-md font-bold">{item.name}</h2>
                    <p className="text-body-sm text-on-surface-variant mt-1">{item.explanation}</p>
                  </div>
                  <span className="font-data-mono text-[12px] px-2 py-1 rounded border shrink-0" style={{ color, borderColor: `${color}66` }}>
                    {item.score.toFixed(1)} · {levelLabel(item.level)}
                  </span>
                </div>

                <ScoreBreakdown item={item} />

                <div className="mt-3">
                  <RiskHistorySparkline regionId={item.region_id} level={item.level} />
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => onOpenMission(item.region_id)}
                    className="font-data-mono text-[11px] px-3 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:text-terminal-cyan hover:border-terminal-cyan/50 transition-colors"
                  >
                    Abrir no mapa
                  </button>
                  {region && (
                    <a
                      href={copernicusUrl(region.center_lat, region.center_lon)}
                      target="_blank" rel="noreferrer"
                      className="font-data-mono text-[11px]" style={{ color: "#5EBBFF" }}
                    >
                      🛰 Imagem orbital →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

function HistoryPage({ d }: { d: DashboardHook }) {
  return (
    <Shell title="Histórico" subtitle="Registro das ingestões executadas no backend." d={d}>
      <Panel title="Execuções">
        {d.runHistory.length === 0 ? (
          <Empty text="Nenhuma ingestão registrada ainda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead className="text-left text-on-surface-variant font-label-caps text-[10px]">
                <tr>
                  <th className="py-2">Data</th><th>Fonte</th><th>Status</th><th>Registros</th><th>Origem</th><th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {d.runHistory.map((run) => (
                  <tr key={run.id} className="border-t border-outline-variant/40">
                    <td className="py-2">{fmtDate(run.started_at)}</td>
                    <td>{run.source}</td>
                    <td style={{ color: statusColor(run.status) }}>{runStatus(run.status)}</td>
                    <td className="font-data-mono text-terminal-cyan">{run.records_count}</td>
                    <td>{run.used_fixture ? "fixture" : "real"}</td>
                    <td className="max-w-[420px] truncate text-on-surface-variant">{run.error ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Shell>
  );
}

function rand(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

function SensorPage({ d }: { d: DashboardHook }) {
  const [rows, setRows] = useState<SensorRegionLatest[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => {
    apiSvc.getSensorRegionsLatest().then(setRows).catch(() => undefined);
  };
  useEffect(load, []);

  const simulate = async (regionId: number, risky: boolean) => {
    setBusy(true);
    try {
      await apiSvc.postSensorReading({
        region_id: regionId,
        device_id: "esp32-wokwi-sim",
        temperature: rand(risky ? 34 : 24, risky ? 43 : 32),
        humidity: rand(risky ? 6 : 30, risky ? 22 : 70),
        smoke: rand(0, risky ? 320 : 40),
        soil_moisture: rand(risky ? 4 : 20, risky ? 18 : 55),
      });
      toast("Leitura de sensor (ESP32) registrada", "success");
      load();
    } catch {
      toast("Falha ao registrar leitura do sensor", "error");
    } finally {
      setBusy(false);
    }
  };

  const riskByRegion = useMemo(() => new Map(d.risk.map((r) => [r.region_id, r])), [d.risk]);

  return (
    <Shell
      title="Sensores de solo (IoT)"
      subtitle="Camada Edge/IoT — ESP32/Wokwi simulado. Cruza dados orbitais (satélite) com leituras de solo."
      d={d}
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {d.regions.map((region) => {
          const row = rows.find((r) => r.region_id === region.id);
          const reading = row?.reading;
          const risk = riskByRegion.get(region.id);
          const risky = risk ? risk.level === "Alto" || risk.level === "Critico" : false;
          return (
            <Panel
              key={region.id}
              title={region.name}
              action={
                <button
                  onClick={() => simulate(region.id, risky)}
                  disabled={busy}
                  className="font-data-mono text-[10px] px-2.5 py-1 rounded bg-terminal-cyan text-surface-container-lowest disabled:opacity-50"
                >
                  {busy ? "..." : "Simular leitura"}
                </button>
              }
            >
              {reading ? (
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "TEMP", value: reading.temperature, unit: "°C" },
                    { label: "UMID", value: reading.humidity, unit: "%" },
                    { label: "FUMAÇA", value: reading.smoke, unit: "" },
                    { label: "SOLO", value: reading.soil_moisture, unit: "%" },
                  ].map((m) => (
                    <div key={m.label} className="rounded py-2 bg-surface-container-high">
                      <div className="font-data-mono text-[8px] text-on-surface-variant tracking-wider">{m.label}</div>
                      <div className="font-data-mono text-[15px] text-terminal-cyan">
                        {m.value ?? "--"}<span className="text-[9px] text-on-surface-variant">{m.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="Sem leitura. Clique em Simular leitura." />
              )}
              {reading && (
                <p className="font-data-mono text-[9px] text-on-surface-variant opacity-60 mt-2">
                  {reading.device_id} · {fmtDate(reading.created_at)}
                </p>
              )}
            </Panel>
          );
        })}
      </div>
    </Shell>
  );
}

function pct(value?: number) {
  if (value == null) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function taskLabel(value?: string) {
  if (!value) return "-";
  if (value.includes("classificacao") || value.includes("classificação")) {
    return "classificação multiclasse do nível de risco";
  }
  return value.replace(/_/g, " ");
}

function MlPage() {
  const [experiment, setExperiment] = useState<MlExperiment | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (loading) return;
    setExperiment(null);  // clear previous results so loading state is visible
    setLoading(true);
    try {
      const result = await apiSvc.runMlRiskLogreg();
      setExperiment(result);
      toast(result.available ? "Experimento concluído" : "Erro no experimento", result.available ? "success" : "error");
    } catch {
      setExperiment({ available: false, error: "Falha ao rodar experimento ML. Verifique backend e scikit-learn." });
      toast("Falha ao rodar experimento ML", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Shell
      title="ML experimental"
      subtitle="LogisticRegression treinado com labels geradas pelo motor de regras. Experimento de comparação, não verdade-terreno."
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Execução">
          <div className="space-y-3 text-body-sm">
            <p className="text-on-surface-variant">
              Modelo aprende a imitar o score por regras usando features de fogo, clima, dispersão e tendência.
              Augmentação oracle ativa: 75 amostras sintéticas/classe (seed=42).
            </p>
            <button
              onClick={run}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded bg-terminal-cyan text-surface-container-lowest font-label-caps text-[11px] disabled:opacity-50 transition-opacity"
            >
              {loading && (
                <span
                  className="w-3 h-3 rounded-full border-2 border-surface-container-lowest border-t-transparent animate-spin"
                  style={{ display: "inline-block" }}
                />
              )}
              {loading ? "Treinando modelo..." : "Rodar experimento"}
            </button>
          </div>
        </Panel>

        <Panel title="Amostra">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[40, 60, 50, 40].map((w, i) => (
                <div key={i} className="h-3 rounded" style={{ width: `${w}%`, background: "rgba(255,255,255,0.06)" }} />
              ))}
            </div>
          ) : (
            <div className="space-y-2 text-body-sm">
              <div>Reais coletados: <span className="text-terminal-cyan">{experiment?.sample_count ?? "-"}</span></div>
              {experiment?.synthetic_augmentation ? (
                <>
                  <div>
                    Treino real:{" "}
                    <span className="text-terminal-cyan">{experiment.synthetic_augmentation.real_train}</span>
                    <span className="text-on-surface-variant"> + </span>
                    <span style={{ color: "#FFC857" }}>{experiment.synthetic_augmentation.total_added} sintéticos</span>
                  </div>
                  <div>Treino total: <span className="text-terminal-cyan">{experiment?.train_count ?? "-"}</span></div>
                </>
              ) : (
                <div>Treino: <span className="text-terminal-cyan">{experiment?.train_count ?? "-"}</span></div>
              )}
              <div>Teste (somente reais): <span className="text-terminal-cyan">{experiment?.test_count ?? "-"}</span></div>
            </div>
          )}
        </Panel>

        <Panel title="Métricas">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[55, 70, 50].map((w, i) => (
                <div key={i} className="h-3 rounded" style={{ width: `${w}%`, background: "rgba(255,255,255,0.06)" }} />
              ))}
            </div>
          ) : experiment?.available && experiment.metrics ? (
            <div className="space-y-2 text-body-sm">
              <div>Acurácia: <span className="text-terminal-cyan">{pct(experiment.metrics.accuracy)}</span></div>
              <div>Acurácia balanceada: <span className="text-terminal-cyan">{pct(experiment.metrics.balanced_accuracy)}</span></div>
              <div>Macro F1: <span className="text-terminal-cyan">{pct(experiment.metrics.macro_f1)}</span></div>
            </div>
          ) : (
            <p className="text-body-sm text-on-surface-variant">{loading ? "Calculando..." : experiment?.error ?? "Sem resultado."}</p>
          )}
        </Panel>
      </div>

      {experiment?.warnings && experiment.warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-risk-moderate/50 bg-risk-moderate/10 p-4 text-body-sm text-on-surface-variant">
          {experiment.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}

      {experiment?.available && experiment.synthetic_augmentation && (
        <div className="mt-4 rounded-lg p-4 text-body-sm space-y-3" style={{ background: "rgba(255,200,87,0.06)", border: "1px solid rgba(255,200,87,0.25)" }}>
          <div className="flex items-center gap-2">
            <span className="font-data-mono text-[12px] leading-none" style={{ color: "#FFC857" }}>⊕</span>
            <span className="font-label-caps text-[10px] tracking-widest uppercase" style={{ color: "#FFC857" }}>
              Augmentação Oracle ({experiment.synthetic_augmentation.total_added} amostras sintéticas)
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(experiment.synthetic_augmentation.class_distribution).map(([lbl, n]) => (
              <div key={lbl} className="rounded p-2 text-center" style={{ background: "#101B24", border: "1px solid #1B2A36" }}>
                <div className="font-label-caps text-[9px] text-on-surface-variant mb-1">{lbl}</div>
                <div className="font-data-mono text-[16px]" style={{ color: "#FFC857" }}>{n}</div>
                <div className="font-data-mono text-[9px] text-on-surface-variant">amostras</div>
              </div>
            ))}
          </div>
          <p className="text-on-surface-variant">{experiment.synthetic_augmentation.note}</p>
        </div>
      )}

      {experiment?.available && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          <Panel title="Matriz de confusão">
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm text-center">
                <thead className="font-label-caps text-[10px] text-on-surface-variant">
                  <tr>
                    <th className="p-2 text-left">Real \ Previsto</th>
                    {experiment.labels?.map((label) => <th key={label} className="p-2">{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {experiment.labels?.map((label, row) => (
                    <tr key={label} className="border-t border-outline-variant/40">
                      <th className="p-2 text-left font-normal">{label}</th>
                      {experiment.confusion_matrix?.[row]?.map((value, col) => (
                        <td key={`${label}-${col}`} className={`p-2 font-data-mono ${row === col ? "text-risk-low" : "text-risk-moderate"}`}>{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Distribuição das classes">
            <div className="space-y-2">
              {Object.entries(experiment.class_distribution ?? {}).map(([label, count]) => (
                <div key={label} className="flex justify-between text-body-sm">
                  <span>{label}</span>
                  <span className="font-data-mono text-terminal-cyan">{count}</span>
                </div>
              ))}
            </div>
            {experiment.baseline && (
              <div className="mt-4 border-t border-outline-variant pt-3 text-body-sm text-on-surface-variant">
                Baseline classe majoritária ({experiment.baseline.predicted_class}):{" "}
                <span className="text-terminal-cyan">{pct(experiment.baseline.balanced_accuracy)}</span> acurácia balanceada.
              </div>
            )}
          </Panel>

          <Panel title="Validação temporal">
            {experiment.temporal_validation ? (
              <div className="space-y-3 text-body-sm">
                <div className="flex justify-between"><span>Janelas</span><span className="font-data-mono text-terminal-cyan">{experiment.temporal_validation.fold_count}</span></div>
                <div>Acurácia balanceada média: <span className="text-terminal-cyan">{pct(experiment.temporal_validation.metrics_mean.balanced_accuracy)}</span> +/- {pct(experiment.temporal_validation.metrics_std.balanced_accuracy)}</div>
                <div>Macro F1 médio: <span className="text-terminal-cyan">{pct(experiment.temporal_validation.metrics_mean.macro_f1)}</span> +/- {pct(experiment.temporal_validation.metrics_std.macro_f1)}</div>
              </div>
            ) : (
              <p className="text-body-sm text-on-surface-variant">Amostra ainda pequena para validação temporal.</p>
            )}
          </Panel>

          <Panel title="Contrato técnico">
            <div className="space-y-2 text-body-sm text-on-surface-variant">
              <p>Target: {experiment.target}</p>
              <p>Tarefa: {taskLabel(experiment.task)}</p>
              <p>Modelo: {experiment.model}</p>
              <p>Features: {experiment.feature_names?.join(", ")}</p>
            </div>
          </Panel>
        </div>
      )}
    </Shell>
  );
}

function HealthPage({ d }: { d: DashboardHook }) {
  const realMode = d.apiOnline && !d.usingFixture;
  const [reindexing, setReindexing] = useState(false);

  const reindex = async () => {
    setReindexing(true);
    try {
      const res = await apiSvc.reindexRag();
      toast(`RAG reindexado · ${res.indexed_chunks} chunks (${res.mode ?? "?"})`, "success");
    } catch {
      toast("Reindexação indisponível (somente em development)", "error");
    } finally {
      setReindexing(false);
    }
  };

  return (
    <Shell title="Saúde do sistema" subtitle="Estado técnico do app, backend e configuração de dados reais." d={d}>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="API">
          <div className="space-y-2 text-body-sm">
            <div>Status: <span style={{ color: d.apiOnline ? "#22D47B" : "#FF3347" }}>{d.apiOnline ? "online" : "offline"}</span></div>
            <div>Backend: <span className="text-terminal-cyan break-all">{apiBaseURL}</span></div>
            <div>Ambiente: <span className="text-terminal-cyan">{d.health?.environment ?? "-"}</span></div>
            <div>Versão: <span className="text-terminal-cyan">{d.health?.version ?? "-"}</span></div>
          </div>
        </Panel>

        <Panel title="Dados">
          <div className="space-y-2 text-body-sm">
            <div>Modo: <span className={realMode ? "text-risk-low" : "text-risk-moderate"}>{realMode ? "real" : "verificar"}</span></div>
            <div>Focos: <span className="text-terminal-cyan">{d.fires.length}</span></div>
            <div>Última fonte fixture: <span className="text-terminal-cyan">{d.usingFixture ? "sim" : "não"}</span></div>
          </div>
        </Panel>

        <Panel title="IA / RAG" action={
          <button onClick={reindex} disabled={reindexing} className="font-data-mono text-[10px] px-2 py-1 rounded border border-outline-variant text-on-surface-variant hover:text-terminal-cyan hover:border-terminal-cyan/50 disabled:opacity-50">
            {reindexing ? "..." : "Reindexar RAG"}
          </button>
        }>
          <div className="space-y-2 text-body-sm">
            <div>OpenRouter: <span className="text-terminal-cyan">{d.health?.llm_enabled ? "configurado" : "sem chave (fallback)"}</span></div>
            <div>FIRMS: <span className="text-terminal-cyan">{d.health?.firms_configured ? "configurado" : "sem chave"}</span></div>
            <div>RAG: <span className="text-terminal-cyan">{d.health?.rag_mode ?? "—"}</span></div>
          </div>
        </Panel>
      </div>
    </Shell>
  );
}

interface SourceDef {
  key: string;
  dbName: string;
  label: string;
  desc: string;
  endpoint: string;
  needsKey?: boolean;
}

const SOURCE_DEFS: SourceDef[] = [
  { key: "firms", dbName: "FIRMS", label: "NASA FIRMS", desc: "Focos ativos MODIS/VIIRS por área.", endpoint: "firms.modaps.eosdis.nasa.gov", needsKey: true },
  { key: "inpe", dbName: "INPE", label: "INPE Queimadas", desc: "Focos oficiais do Brasil (CSV diário).", endpoint: "data.inpe.br/queimadas" },
  { key: "weather", dbName: "Open-Meteo", label: "Open-Meteo", desc: "Clima atual por coordenada da região.", endpoint: "api.open-meteo.com" },
  { key: "eonet", dbName: "EONET", label: "NASA EONET", desc: "Eventos naturais ativos (fogo/tempestade/cheia).", endpoint: "eonet.gsfc.nasa.gov" },
  { key: "power", dbName: "NASA_POWER", label: "NASA POWER", desc: "Meteorologia diária (chuva/temp/umidade/vento).", endpoint: "power.larc.nasa.gov" },
];

function relTime(iso?: string | null): string {
  if (!iso) return "nunca";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "-";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)}m`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
}

function SourceRow({ def, run, collecting, disabled, noKey, onCollect }: {
  def: SourceDef;
  run?: IngestRun;
  collecting: boolean;
  disabled: boolean;
  noKey: boolean;
  onCollect: () => void;
}) {
  const color = run ? statusColor(run.status) : "#5A6B78";
  const origin = run ? (run.used_fixture ? "fixture local" : "API real") : "—";
  return (
    <div className="rounded-lg p-3 border" style={{ background: "#0B141C", borderColor: collecting ? "rgba(50,211,194,0.4)" : "#1B2A36" }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: collecting ? "#32D3C2" : color, boxShadow: `0 0 6px ${collecting ? "#32D3C2" : color}88` }} />
        <span className="font-bold text-[13px] text-on-surface">{def.label}</span>
        <span
          className="font-data-mono text-[8px] px-1.5 py-0.5 rounded-full tracking-wide uppercase"
          style={{ background: `${color}1f`, color, border: `1px solid ${color}44` }}
        >
          {run ? `${runStatus(run.status)} · ${run.used_fixture ? "fixture" : "real"}` : "nunca coletada"}
        </span>
        <button
          onClick={onCollect}
          disabled={disabled}
          className="ml-auto font-data-mono text-[10px] px-2.5 py-1 rounded border border-outline-variant text-on-surface-variant hover:text-terminal-cyan hover:border-terminal-cyan/50 transition-colors disabled:opacity-40"
        >
          {collecting ? "Coletando..." : "Coletar"}
        </button>
      </div>
      <p className="text-[11px] text-on-surface-variant mb-1.5">{def.desc}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-data-mono text-[10px] text-on-surface-variant">
        <span className="text-terminal-cyan">{run ? run.records_count : 0} registros</span>
        <span>·</span>
        <span>{relTime(run?.started_at)}</span>
        <span>·</span>
        <span style={{ color: run && !run.used_fixture ? "#5EBBFF" : run ? "#FFC857" : "#6F808A" }}>{origin}</span>
        <span>·</span>
        <span className="opacity-60">{def.endpoint}</span>
      </div>
      {run?.error && (
        <p className="text-[10px] mt-1.5 break-words" style={{ color: "#FF6B7A" }}>⚠ {run.error}</p>
      )}
      {noKey && (!run || run.status === "failed") && (
        <p className="text-[10px] mt-1.5" style={{ color: "#FFC857" }}>
          Sem FIRMS_MAP_KEY — INPE cobre os focos no modo real.
        </p>
      )}
    </div>
  );
}

function ConfigPage({ d }: { d: DashboardHook }) {
  const [days, setDays] = useState(2);
  const [collecting, setCollecting] = useState<string | null>(null);

  const latestBySource = useMemo(() => {
    const map = new Map<string, IngestRun>();
    for (const run of d.runHistory) if (!map.has(run.source)) map.set(run.source, run);
    return map;
  }, [d.runHistory]);

  const collect = async (sources: string, tag: string) => {
    setCollecting(tag);
    try {
      await d.ingest({ sources, days });
    } finally {
      setCollecting(null);
    }
  };

  const allKeys = SOURCE_DEFS.map((s) => s.key).join(",");
  const totalRecords = SOURCE_DEFS.reduce((sum, s) => sum + (latestBySource.get(s.dbName)?.records_count ?? 0), 0);

  return (
    <Shell title="Status / Ambiente" subtitle="Coleta de dados por fonte, scraps recentes e estado das chaves." d={d}>
      {/* Control bar */}
      <div className="bg-surface-container border border-outline-variant rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-data-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Janela</span>
            <input
              type="number" min={1} max={10} value={days}
              onChange={(e) => setDays(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              className="w-14 bg-surface-container-high border border-outline-variant rounded px-2 py-1 font-data-mono text-[11px] outline-none focus:border-terminal-cyan"
            />
            <span className="font-data-mono text-[10px] text-on-surface-variant">dias</span>
          </div>
          <span className="font-data-mono text-[10px] text-on-surface-variant opacity-60">
            {totalRecords} registros na última coleta de cada fonte
          </span>
          <div className="flex-1" />
          <button
            onClick={() => collect(allKeys, "__all__")}
            disabled={d.busy !== null}
            className="font-data-mono text-[11px] px-3 py-1.5 rounded bg-terminal-cyan text-surface-container-lowest disabled:opacity-50"
          >
            {collecting === "__all__" ? "Coletando..." : "Coletar todas (real)"}
          </button>
          <button
            onClick={() => { setCollecting("__demo__"); d.runDemo().finally(() => setCollecting(null)); }}
            disabled={d.busy !== null}
            className="font-data-mono text-[11px] px-3 py-1.5 rounded border border-risk-moderate/50 text-risk-moderate hover:bg-risk-moderate/10 disabled:opacity-50"
          >
            {collecting === "__demo__" ? "Carregando..." : "Modo demo (fixtures)"}
          </button>
        </div>
      </div>

      {/* Per-source scraps */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-4">
        {SOURCE_DEFS.map((s) => (
          <SourceRow
            key={s.key}
            def={s}
            run={latestBySource.get(s.dbName)}
            collecting={collecting === s.key}
            disabled={d.busy !== null}
            noKey={Boolean(s.needsKey) && !d.health?.firms_configured}
            onCollect={() => collect(s.key, s.key)}
          />
        ))}
      </div>

      {/* Keys + RAG */}
      <Panel title="Chaves e serviços">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-body-sm">
          <div className="flex justify-between md:block">
            <span className="text-on-surface-variant">FIRMS_MAP_KEY</span>
            <div className={d.health?.firms_configured ? "text-risk-low" : "text-risk-moderate"}>{d.health?.firms_configured ? "configurada" : "pendente"}</div>
          </div>
          <div className="flex justify-between md:block">
            <span className="text-on-surface-variant">OPENROUTER_API_KEY</span>
            <div className={d.health?.llm_enabled ? "text-risk-low" : "text-risk-moderate"}>{d.health?.llm_enabled ? "configurada" : "pendente (fallback)"}</div>
          </div>
          <div className="flex justify-between md:block">
            <span className="text-on-surface-variant">RAG</span>
            <div className="text-terminal-cyan">{d.health?.rag_mode ?? "—"}</div>
          </div>
        </div>
        <p className="font-data-mono text-[10px] text-on-surface-variant opacity-60 pt-3">
          INPE, Open-Meteo, EONET e NASA POWER funcionam sem chave. Sem OpenRouter, laudos e chat usam fallback determinístico.
        </p>
      </Panel>
    </Shell>
  );
}

export default function DashboardPages({ page, d, onOpenMission }: Props) {
  if (page === "telemetria") return <TelemetryPage d={d} />;
  if (page === "ativos") return <AssetsPage d={d} onOpenMission={onOpenMission} />;
  if (page === "risco") return <RiskPage d={d} onOpenMission={onOpenMission} />;
  if (page === "ml") return <MlPage />;
  if (page === "historico") return <HistoryPage d={d} />;
  if (page === "sensor") return <SensorPage d={d} />;
  if (page === "saude") return <HealthPage d={d} />;
  if (page === "config") return <ConfigPage d={d} />;
  return <TelemetryPage d={d} />;
}
