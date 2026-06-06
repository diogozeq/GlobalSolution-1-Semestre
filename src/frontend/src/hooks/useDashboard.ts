import { useCallback, useEffect, useRef, useState } from "react";
import * as apiSvc from "../services/api";
import type {
  Alert,
  FireFocus,
  IngestRunResult,
  NaturalEvent,
  Region,
  RiskItem,
  WeatherReading,
} from "../types";

export function useDashboard() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [fires, setFires] = useState<FireFocus[]>([]);
  const [weather, setWeather] = useState<Record<number, WeatherReading>>({});
  const [events, setEvents] = useState<NaturalEvent[]>([]);
  const [risk, setRisk] = useState<RiskItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [lastRuns, setLastRuns] = useState<IngestRunResult[]>([]);
  const [busy, setBusy] = useState<"ingest" | "risk" | null>(null);
  const [usingFixture, setUsingFixture] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(true);
  const initialized = useRef(false);

  const loadCore = useCallback(async () => {
    const [reg, fire, ev] = await Promise.all([
      apiSvc.getRegions(),
      apiSvc.getFires(),
      apiSvc.getEvents(),
    ]);
    setRegions(reg);
    setFires(fire);
    setEvents(ev);
    const w = await apiSvc.getWeather();
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
    } catch {
      setRisk([]);
    }
    try {
      setAlerts(await apiSvc.getAlerts());
    } catch {
      setAlerts([]);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setBusy("ingest");
    try {
      const res = await apiSvc.ingestRun({
        useFixture: false,
        sources: "firms,weather,eonet,inpe",
        days: 2,
      });
      setLastRuns(res.runs);
      setUsingFixture(res.runs.some((r) => r.used_fixture));
      setApiOnline(true);
      await loadCore();
    } catch {
      setApiOnline(false);
    } finally {
      setBusy(null);
    }
  }, [loadCore]);

  const recalc = useCallback(async () => {
    setBusy("risk");
    try {
      await apiSvc.recalcRisk();
      await loadRisk();
    } catch {
      /* risk engine not available yet */
    } finally {
      setBusy(null);
    }
  }, [loadRisk]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        await apiSvc.getHealth();
        setApiOnline(true);
        const fire = await loadCore();
        await loadRisk();
        if (fire.length === 0) {
          const res = await apiSvc.ingestRun({
            useFixture: true,
            sources: "firms,weather,eonet,inpe",
          });
          setLastRuns(res.runs);
          setUsingFixture(true);
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
  }, [loadCore, loadRisk]);

  // Poll alerts (live feed)
  useEffect(() => {
    const id = setInterval(() => {
      apiSvc.getAlerts().then(setAlerts).catch(() => undefined);
    }, 45000);
    return () => clearInterval(id);
  }, []);

  const ackAlert = useCallback(async (id: number) => {
    try {
      await apiSvc.patchAlertStatus(id, "ack");
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "ack" } : a)),
      );
    } catch {
      /* ignore */
    }
  }, []);

  return {
    regions,
    fires,
    weather,
    events,
    risk,
    alerts,
    selectedRegionId,
    setSelectedRegionId,
    lastRuns,
    busy,
    usingFixture,
    apiOnline,
    bootstrapping,
    refreshData,
    recalc,
    reloadRisk: loadRisk,
    ackAlert,
  };
}

export type DashboardHook = ReturnType<typeof useDashboard>;
