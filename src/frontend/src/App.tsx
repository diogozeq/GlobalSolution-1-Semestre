import { useCallback, useEffect, useState } from "react";
import TopNavBar from "./components/TopNavBar";
import SideNavBar from "./components/SideNavBar";
import MapView from "./components/MapView";
import RiskMatrix from "./components/RiskMatrix";
import LiveDetectionFeed from "./components/LiveDetectionFeed";
import ReportView from "./components/ReportView";
import ChatAgent from "./components/ChatAgent";
import DashboardPages from "./components/DashboardPages";
import DataExplorerPage from "./components/DataExplorerPage";
import ToastHost from "./components/ToastHost";
import { useDashboard } from "./hooks/useDashboard";
import * as apiSvc from "./services/api";
import type { ReportResult, SensorReading } from "./types";

type PageKey = "missoes" | "laudo" | "chat" | "telemetria" | "ativos" | "risco" | "ml" | "historico" | "sensor" | "saude" | "config" | "dados";
const PAGES = new Set<PageKey>(["missoes", "laudo", "chat", "telemetria", "ativos", "risco", "ml", "historico", "sensor", "saude", "config", "dados"]);

function pageFromHash(): PageKey {
  const raw = window.location.hash.replace("#", "") as PageKey;
  return PAGES.has(raw) ? raw : "missoes";
}

export default function App() {
  const d = useDashboard();
  const [activePage, setActivePage] = useState<PageKey>(() => pageFromHash());
  const [reportRegionId, setReportRegionId] = useState<number | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [reportSensor, setReportSensor] = useState<SensorReading | null>(null);

  const changePage = useCallback((page: PageKey) => {
    setActivePage(page);
    window.location.hash = page;
  }, []);

  const handleGenerateReport = useCallback(async (regionId: number) => {
    if (reportLoading) return;
    setReportRegionId(regionId);
    setReportLoading(true);
    setReport(null);
    setReportSensor(null);
    d.setSelectedRegionId(regionId);
    changePage("laudo");
    apiSvc.getSensorLatest(regionId).then(setReportSensor).catch(() => undefined);
    try {
      const res = await apiSvc.generateReport(regionId);
      setReport(res);
    } catch {
      setReport({ available: false, report: null, error: "Falha ao gerar laudo." });
    } finally {
      setReportLoading(false);
    }
  }, [d, reportLoading, changePage]);

  useEffect(() => {
    const onHash = () => setActivePage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const reportRegionName = d.regions.find((r) => r.id === reportRegionId)?.name;
  const openMission = useCallback((regionId?: number) => {
    if (regionId != null) d.setSelectedRegionId(regionId);
    changePage("missoes");
  }, [d, changePage]);

  return (
    <div className="h-screen flex flex-col" style={{ background: "#05090D", color: "#E8F0F2" }}>
      <TopNavBar
        onRefresh={d.refreshData}
        onRecalc={d.recalc}
        busy={d.busy}
        usingFixture={d.usingFixture}
        apiOnline={d.apiOnline}
        activePage={activePage}
        onPageChange={(page) => changePage(page as PageKey)}
        lastUpdatedAt={d.lastUpdatedAt}
        alertCount={d.alerts.filter((a) => a.status === "open").length}
      />

      <div className="flex flex-1 overflow-hidden">
        <SideNavBar activePage={activePage} onPageChange={(page) => changePage(page as PageKey)} />

        <main className="flex-1 flex flex-col overflow-hidden">
          {activePage === "missoes" ? (
            <div className="flex-1 flex overflow-hidden">
              <MapView
                fires={d.fires}
                regions={d.regions}
                risk={d.risk}
                events={d.events}
                weather={d.weather}
                selectedRegionId={d.selectedRegionId}
                onSelectRegion={d.setSelectedRegionId}
              />

              {/* Right panel */}
              <aside
                className="w-[380px] flex flex-col overflow-hidden shrink-0 border-l border-outline-variant"
                style={{ background: "#0B141C" }}
              >
                {(d.coreError || d.riskError || d.bootstrapping || d.usingFixture) && (
                  <div
                    className="mx-3 mt-3 rounded px-3 py-2 font-data-mono text-[10px]"
                    style={{
                      background: d.bootstrapping ? "rgba(50,211,194,0.06)" : "rgba(255,200,87,0.08)",
                      border: d.bootstrapping
                        ? "1px solid rgba(50,211,194,0.2)"
                        : "1px solid rgba(255,200,87,0.25)",
                      color: d.bootstrapping ? "#32D3C2" : "#FFC857",
                    }}
                  >
                    {d.bootstrapping
                      ? "⟳ Coletando dados reais..."
                      : d.usingFixture
                      ? "⚠ Última ingestão usou fixture. Clique em Atualizar."
                      : d.coreError ?? d.riskError}
                  </div>
                )}

                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <RiskMatrix
                      regions={d.regions}
                      risk={d.risk}
                      fires={d.fires}
                      selectedRegionId={d.selectedRegionId}
                      onSelect={d.setSelectedRegionId}
                    />
                  </div>
                  <div className="h-px mx-3 shrink-0" style={{ background: "#1B2A36" }} />
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <LiveDetectionFeed
                      alerts={d.alerts}
                      events={d.events}
                      regions={d.regions}
                      onGenerateReport={handleGenerateReport}
                      onAcknowledge={d.ackAlert}
                      onClose={d.closeAlert}
                      reportLoadingRegionId={reportLoading ? reportRegionId : null}
                      disableReports={reportLoading}
                    />
                  </div>
                </div>
              </aside>
            </div>
          ) : activePage === "laudo" ? (
            <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#05090D" }}>
              {/* Page header */}
              <div
                className="shrink-0 flex items-center gap-4 px-6 py-4 border-b border-outline-variant"
                style={{ background: "#0B141C" }}
              >
                <span className="font-data-mono text-[18px] text-terminal-cyan leading-none">▤</span>
                <div>
                  <h1 className="font-data-mono text-[13px] font-bold text-terminal-cyan tracking-wider uppercase">
                    Laudos Técnicos
                  </h1>
                  <p className="font-data-mono text-[10px] text-on-surface-variant">
                    {d.health?.llm_enabled
                      ? "Análise IA generativa com evidências orbitais"
                      : "Fallback local com evidências orbitais"}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <select
                    className="rounded px-3 py-1.5 font-data-mono text-[11px] text-on-surface outline-none"
                    style={{
                      background: "#0B141C",
                      border: "1px solid #1B2A36",
                      color: reportRegionId ? "#E8F0F2" : "#6F808A",
                    }}
                    value={reportRegionId ?? ""}
                    onChange={(e) => setReportRegionId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Selecionar região...</option>
                    {d.regions.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { if (reportRegionId !== null) handleGenerateReport(reportRegionId); }}
                    disabled={reportRegionId === null || reportLoading}
                    className="px-4 py-1.5 rounded font-data-mono text-[11px] font-semibold
                               transition-all duration-120 disabled:opacity-40"
                    style={{
                      background: "linear-gradient(135deg, #FF5A2D 0%, #FF3347 100%)",
                      color: "#E8F0F2",
                    }}
                  >
                    {reportLoading ? "Gerando..." : "Gerar Laudo IA"}
                  </button>
                </div>
              </div>
              {/* Report content */}
              <div className="flex-1 overflow-hidden flex">
                <ReportView
                  report={report}
                  loading={reportLoading}
                  regionName={reportRegionName}
                  riskItem={d.risk.find((r) => r.region_id === reportRegionId) ?? null}
                  sensor={reportSensor}
                />
              </div>
            </div>
          ) : activePage === "chat" ? (
            <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#05090D" }}>
              {/* Page header */}
              <div
                className="shrink-0 flex items-center gap-4 px-6 py-4 border-b border-outline-variant"
                style={{ background: "#0B141C" }}
              >
                <span className="font-data-mono text-[18px] leading-none" style={{ color: "#32D3C2" }}>◑</span>
                <div>
                  <h1 className="font-data-mono text-[13px] font-bold text-terminal-cyan tracking-wider uppercase">
                    Chat RAG
                  </h1>
                  <p className="font-data-mono text-[10px] text-on-surface-variant">
                    {d.health?.llm_enabled
                      ? "Consulta contextual · ChromaDB + OpenRouter"
                      : "Consulta contextual · ChromaDB + fallback local"}
                  </p>
                </div>
                {d.selectedRegionId && (
                  <span
                    className="font-data-mono text-[10px] px-2 py-0.5 rounded-full ml-2"
                    style={{
                      background: "rgba(50,211,194,0.08)",
                      color: "#32D3C2",
                      border: "1px solid rgba(50,211,194,0.2)",
                    }}
                  >
                    Região #{d.selectedRegionId} ativa
                  </span>
                )}
              </div>
              {/* Chat area centred */}
              <div className="flex-1 flex justify-center overflow-hidden">
                <div className="w-full max-w-[760px] flex flex-col overflow-hidden">
                  <ChatAgent selectedRegionId={d.selectedRegionId} />
                </div>
              </div>
            </div>
          ) : activePage === "dados" ? (
            <DataExplorerPage regions={d.regions} />
          ) : (
            <DashboardPages page={activePage} d={d} onOpenMission={openMission} />
          )}
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
