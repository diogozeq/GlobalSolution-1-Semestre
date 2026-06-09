import { useCallback, useEffect, useRef, useState } from "react";
import * as apiSvc from "../services/api";
import { toast } from "../lib/toast";
import type {
  Alert,
  AlertStatus,
  FireFocus,
  HealthInfo,
  IngestRunResult,
  IngestRun,
  NaturalEvent,
  Region,
  RiskItem,
  WeatherReading,
} from "../types";

const LIVE_SOURCES = "inpe,weather,eonet,power,firms";

function summarizeRuns(runs: IngestRunResult[]): string {
  const total = runs.reduce((s, r) => s + r.records_count, 0);
  const failed = runs.filter((r) => r.status === "failed").map((r) => r.source);
  if (failed.length) return `Coleta: ${total} registros · falhou: ${failed.join(", ")}`;
  return `Coleta concluída · ${total} registros`;
}

export function useDashboard() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [fires, setFires] = useState<FireFocus[]>([]);
  const [weather, setWeather] = useState<Record<number, WeatherReading>>({});
  const [events, setEvents] = useState<NaturalEvent[]>([]);
  const [risk, setRisk] = useState<RiskItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [lastRuns, setLastRuns] = useState<IngestRunResult[]>([]);
  const [runHistory, setRunHistory] = useState<IngestRun[]>([]);
  const [busy, setBusy] = useState<"ingest" | "risk" | null>(null);
  const [usingFixture, setUsingFixture] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [coreError, setCoreError] = useState<string | null>(null);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const initialized = useRef(false);

  const loadCore = useCallback(async () => {
    const [regRes, fireRes, evRes] = await Promise.allSettled([
      apiSvc.getRegions(),
      apiSvc.getFires({ limit: 10000 }),
      apiSvc.getEvents(),
    ]);

    const failed = [regRes, fireRes, evRes].some((r) => r.status === "rejected");
    setCoreError(failed ? "Dados parciais: uma fonte da API nao respondeu." : null);

    const reg = regRes.status === "fulfilled" ? regRes.value : [];
    const fire = fireRes.status === "fulfilled" ? fireRes.value : [];
    const ev = evRes.status === "fulfilled" ? evRes.value : [];
    if (regRes.status === "fulfilled") setRegions(reg);
    if (fireRes.status === "fulfilled") setFires(fire);
    if (evRes.status === "fulfilled") setEvents(ev);

    const w = await apiSvc.getWeather().catch(() => []);
    const wmap: Record<number, WeatherReading> = {};
    (Array.isArray(w) ? w : [w]).forEach((r) => {
      if (r && r.region_id != null) wmap[r.region_id] = r;
    });
    setWeather(wmap);
    return fire;
  }, []);

  const loadRisk = useCallback(async () => {
    try {
      setRisk(await apiSvc.getRisk());
      setRiskError(null);
    } catch {
      setRisk([]);
      setRiskError("Motor de risco indisponivel. Tente recalcular.");
    }
    try {
      setAlerts(await apiSvc.getAlerts());
    } catch {
      setAlerts([]);
      setRiskError("Alertas indisponiveis. Verifique backend.");
    }
  }, []);

  const loadRuns = useCallback(async () => {
    const runs = await apiSvc.getRuns().catch(() => []);
    setRunHistory(runs);
    setUsingFixture(runs.slice(0, 5).some((r) => r.used_fixture));
    if (runs[0]?.started_at) setLastUpdatedAt(runs[0].started_at);
    return runs;
  }, []);

  const ingest = useCallback(
    async (opts: { sources?: string; days?: number; useFixture?: boolean }) => {
      setBusy("ingest");
      try {
        const res = await apiSvc.ingestRun({
          useFixture: opts.useFixture ?? false,
          sources: opts.sources ?? LIVE_SOURCES,
          days: opts.days ?? 10,
        });
        setLastRuns(res.runs);
        setUsingFixture(res.runs.some((r) => r.used_fixture));
        setApiOnline(true);
        await loadCore();
        await loadRuns();
        toast(summarizeRuns(res.runs), res.runs.some((r) => r.status === "failed") ? "info" : "success");
        return res.runs;
      } catch {
        setApiOnline(false);
        toast("Falha ao coletar dados. Backend offline?", "error");
        return [];
      } finally {
        setBusy(null);
      }
    },
    [loadCore, loadRuns],
  );

  const refreshData = useCallback(() => ingest({ sources: LIVE_SOURCES, days: 10 }), [ingest]);

  const runDemo = useCallback(async () => {
    const runs = await ingest({ sources: "firms,weather,eonet,inpe,power", useFixture: true, days: 10 });
    if (runs.length) {
      setBusy("risk");
      await apiSvc.recalcRisk().catch(() => undefined);
      await loadRisk();
      setBusy(null);
      toast("Modo demo: fixtures carregadas e risco recalculado", "success");
    }
  }, [ingest, loadRisk]);

  const recalc = useCallback(async () => {
    setBusy("risk");
    try {
      const res = await apiSvc.recalcRisk();
      await loadRisk();
      const critical = res.assessed.filter((a) => a.level === "Critico" || a.level === "Alto").length;
      toast(`Risco recalculado · ${critical} região(ões) em Alto/Crítico`, "success");
    } catch {
      toast("Não foi possível recalcular o risco", "error");
    } finally {
      setBusy(null);
    }
  }, [loadRisk]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        const h = await apiSvc.getHealth();
        setHealth(h);
        setApiOnline(true);
        const fire = await loadCore();
        const runs = await loadRuns();
        await loadRisk();
        const latestUsedFixture = runs.slice(0, 5).some((r) => r.used_fixture);
        if (fire.length === 0 || latestUsedFixture) {
          const res = await apiSvc.ingestRun({
            useFixture: false,
            sources: LIVE_SOURCES,
            days: 10,
          });
          setLastRuns(res.runs);
          setUsingFixture(res.runs.some((r) => r.used_fixture));
          await loadRuns();
          await loadCore();
          await apiSvc.recalcRisk().catch(() => undefined);
          await loadRisk();
        }
      } catch {
        setApiOnline(false);
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [loadCore, loadRisk, loadRuns]);

  // Poll alerts (live feed)
  useEffect(() => {
    const id = setInterval(() => {
      apiSvc.getAlerts().then(setAlerts).catch(() => undefined);
    }, 45000);
    return () => clearInterval(id);
  }, []);

  const setAlertStatus = useCallback(async (id: number, status: AlertStatus) => {
    try {
      await apiSvc.patchAlertStatus(id, status);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      toast(status === "ack" ? "Alerta reconhecido" : "Alerta encerrado", "success");
    } catch {
      toast("Não foi possível atualizar o alerta", "error");
    }
  }, []);

  const ackAlert = useCallback((id: number) => setAlertStatus(id, "ack"), [setAlertStatus]);
  const closeAlert = useCallback((id: number) => setAlertStatus(id, "closed"), [setAlertStatus]);

  return {
    regions,
    fires,
    weather,
    events,
    risk,
    alerts,
    health,
    selectedRegionId,
    setSelectedRegionId,
    lastRuns,
    runHistory,
    lastUpdatedAt,
    busy,
    usingFixture,
    apiOnline,
    bootstrapping,
    coreError,
    riskError,
    refreshData,
    recalc,
    ingest,
    runDemo,
    reloadRisk: loadRisk,
    ackAlert,
    closeAlert,
  };
}

export type DashboardHook = ReturnType<typeof useDashboard>;
