import axios from "axios";
import type {
  Alert,
  ChatResponse,
  FireFocus,
  IngestRun,
  IngestRunResult,
  NaturalEvent,
  Region,
  ReportResult,
  RiskItem,
  WeatherReading,
} from "../types";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const api = axios.create({ baseURL, timeout: 120000 });

export async function getHealth() {
  const { data } = await api.get("/health");
  return data as { status: string; version: string; time: string };
}

export async function ingestRun(opts?: {
  useFixture?: boolean;
  sources?: string;
  days?: number;
  bbox?: string;
}): Promise<{ runs: IngestRunResult[] }> {
  const { data } = await api.post("/ingest/run", null, {
    params: {
      use_fixture: opts?.useFixture ?? false,
      sources: opts?.sources,
      days: opts?.days ?? 1,
      bbox: opts?.bbox,
    },
  });
  return data;
}

export async function getRuns(): Promise<IngestRun[]> {
  const { data } = await api.get("/ingest/runs");
  return data;
}

export async function getRegions(): Promise<Region[]> {
  const { data } = await api.get("/regions");
  return data;
}

export async function getFires(params?: {
  bbox?: string;
  source?: string;
}): Promise<FireFocus[]> {
  const { data } = await api.get("/fires", { params });
  return data;
}

export async function getWeather(regionId?: number): Promise<WeatherReading[] | WeatherReading> {
  const { data } = await api.get("/weather", { params: { region_id: regionId } });
  return data;
}

export async function getEvents(): Promise<NaturalEvent[]> {
  const { data } = await api.get("/events");
  return data;
}

// ---- Etapa 2 (intelligence) ----
export async function recalcRisk(): Promise<{ assessed: RiskItem[] }> {
  const { data } = await api.post("/risk/recalculate");
  return data;
}

export async function getRisk(): Promise<RiskItem[]> {
  const { data } = await api.get("/risk");
  return data;
}

export async function getAlerts(): Promise<Alert[]> {
  const { data } = await api.get("/alerts");
  return data;
}

export async function patchAlertStatus(id: number, status: string): Promise<Alert> {
  const { data } = await api.patch(`/alerts/${id}/status`, { status });
  return data;
}

export async function generateReport(regionId: number): Promise<ReportResult> {
  const { data } = await api.post(`/report/${regionId}`);
  return data;
}

export async function chat(question: string, regionId?: number): Promise<ChatResponse> {
  const { data } = await api.post("/chat", { question, region_id: regionId });
  return data;
}

export async function reindexRag(): Promise<{ indexed_chunks: number; docs: number }> {
  const { data } = await api.post("/rag/reindex");
  return data;
}
