// Types mirroring the OrbitGuard backend API contracts.

export type RiskLevel = "Baixo" | "Moderado" | "Alto" | "Critico";

export interface Region {
  id: number;
  name: string;
  state: string;
  center_lat: number;
  center_lon: number;
  bbox: string;
  area_km2: number;
}

export interface FireFocus {
  id: number;
  lat: number;
  lon: number;
  brightness: number | null;
  confidence: number | null;
  acq_datetime: string | null;
  satellite: string | null;
  source: string;
  region_id: number | null;
}

export interface WeatherReading {
  id: number;
  source: string;
  region_id: number | null;
  temp: number | null;
  humidity: number | null;
  precip: number | null;
  wind: number | null;
  timestamp: string;
}

export interface NaturalEvent {
  id: number;
  source: string;
  category: string;
  title: string;
  lat: number | null;
  lon: number | null;
  started_at: string | null;
}

export interface IngestRunResult {
  source: string;
  status: "success" | "partial" | "failed";
  records_count: number;
  error: string | null;
  used_fixture: boolean;
}

export interface IngestRun {
  id: number;
  source: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  error: string | null;
  records_count: number;
  used_fixture: boolean;
}

export interface RiskItem {
  region_id: number;
  name: string;
  state?: string;
  score: number;
  level: RiskLevel;
  explanation: string;
  features: Record<string, number>;
  center_lat?: number;
  center_lon?: number;
}

export interface Alert {
  id: number;
  region_id: number;
  severity: string;
  reason: string;
  status: "open" | "ack" | "closed";
  score: number;
  report_text: string | null;
  created_at: string;
}

export interface ReportDoc {
  title: string;
  risk_level: string;
  summary: string;
  evidence: string[];
  recommended_actions: string[];
  limitations: string;
}

export interface ReportResult {
  available: boolean;
  report: ReportDoc | null;
  model?: string | null;
  error?: string | null;
}

export interface ChatSource {
  title: string;
  source_url: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  used_tools: string[];
  available: boolean;
}
