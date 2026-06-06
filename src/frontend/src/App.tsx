import { useCallback, useState } from "react";
import TopNavBar from "./components/TopNavBar";
import SideNavBar from "./components/SideNavBar";
import MapView from "./components/MapView";
import RiskMatrix from "./components/RiskMatrix";
import LiveDetectionFeed from "./components/LiveDetectionFeed";
import ReportView from "./components/ReportView";
import ChatAgent from "./components/ChatAgent";
import { useDashboard } from "./hooks/useDashboard";
import * as apiSvc from "./services/api";
import type { ReportResult } from "./types";

export default function App() {
  const d = useDashboard();
  const [reportRegionId, setReportRegionId] = useState<number | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<ReportResult | null>(null);

  const handleGenerateReport = useCallback(async (regionId: number) => {
    setReportRegionId(regionId);
    setReportLoading(true);
    setReport(null);
    d.setSelectedRegionId(regionId);
    try {
      const res = await apiSvc.generateReport(regionId);
      setReport(res);
    } catch {
      setReport({ available: false, report: null, error: "Falha ao gerar laudo." });
    } finally {
      setReportLoading(false);
    }
  }, [d]);

  const reportRegionName = d.regions.find((r) => r.id === reportRegionId)?.name;

  return (
    <div className="h-screen flex flex-col bg-background text-on-surface">
      <TopNavBar
        onRefresh={d.refreshData}
        onRecalc={d.recalc}
        busy={d.busy}
        usingFixture={d.usingFixture}
        apiOnline={d.apiOnline}
      />

      <div className="flex flex-1 overflow-hidden">
        <SideNavBar />

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            <MapView
              fires={d.fires}
              regions={d.regions}
              risk={d.risk}
              selectedRegionId={d.selectedRegionId}
              onSelectRegion={d.setSelectedRegionId}
            />

            <aside className="w-[400px] border-l border-outline-variant bg-surface-container flex flex-col overflow-y-auto shrink-0">
              <RiskMatrix
                regions={d.regions}
                risk={d.risk}
                fires={d.fires}
                selectedRegionId={d.selectedRegionId}
                onSelect={d.setSelectedRegionId}
              />
              <LiveDetectionFeed
                alerts={d.alerts}
                events={d.events}
                regions={d.regions}
                onGenerateReport={handleGenerateReport}
                reportLoadingRegionId={reportLoading ? reportRegionId : null}
              />
            </aside>
          </div>

          <footer className="h-[280px] bg-surface-container-lowest border-t border-outline-variant flex shrink-0">
            <ReportView report={report} loading={reportLoading} regionName={reportRegionName} />
            <ChatAgent selectedRegionId={d.selectedRegionId} />
          </footer>
        </main>
      </div>
    </div>
  );
}
