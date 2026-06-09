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
  frp: number | null;
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

export interface HealthInfo {
  status: string;
  app: string;
  version: string;
  environment: string;
  firms_configured: boolean;
  llm_enabled: boolean;
  rag_mode?: string;
  time: string;
}

export interface SensorReading {
  id: number;
  region_id: number | null;
  device_id: string;
  temperature: number | null;
  humidity: number | null;
  smoke: number | null;
  soil_moisture: number | null;
  created_at: string;
}

export interface SensorRegionLatest {
  region_id: number;
  region_name: string;
  reading: SensorReading | null;
}

export interface CrossValidation {
  firms_foci: number;
  inpe_foci: number;
  firms_cells: number;
  inpe_cells: number;
  confirmed_cells: number;
  only_firms_cells: number;
  only_inpe_cells: number;
  confirmation_rate: number;
  grid_deg: number;
}

export interface RiskHistoryPoint {
  score: number;
  level: RiskLevel;
  created_at: string;
}

export interface RiskItem {
  region_id: number;
  name: string;
  state?: string;
  score: number;
  level: RiskLevel;
  explanation: string;
  features: Record<string, unknown>;
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
  id?: string;
  title: string;
  source_url: string;
}

export type AlertStatus = Alert["status"];

export interface RiskSummaryItem {
  region_id: number;
  name: string;
  score: number;
  level: RiskLevel;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  used_tools: string[];
  available: boolean;
}

export interface MlMetricSet {
  accuracy: number;
  balanced_accuracy: number;
  macro_f1: number;
}

export interface MlCoefficient {
  class: string;
  top_features: Array<{ feature: string; weight: number }>;
}

export interface MlValidationFold {
  train_count: number;
  test_count: number;
  metrics: MlMetricSet;
}

export interface MlTemporalValidation {
  strategy: string;
  fold_count: number;
  metrics_mean: MlMetricSet;
  metrics_std: MlMetricSet;
  folds: MlValidationFold[];
}

export interface MlSyntheticAugmentation {
  n_per_class: number;
  total_added: number;
  real_train: number;
  class_distribution: Record<string, number>;
  strategy: string;
  note: string;
}

export interface MlExperiment {
  available: boolean;
  error?: string;
  model?: string;
  task?: string;
  target?: string;
  sample_count?: number;
  train_count?: number;
  test_count?: number;
  class_distribution?: Record<string, number>;
  feature_names?: string[];
  labels?: string[];
  confusion_matrix?: number[][];
  metrics?: MlMetricSet;
  temporal_validation?: MlTemporalValidation | null;
  baseline?: MlMetricSet & { strategy: string; predicted_class: string };
  coefficients?: MlCoefficient[];
  warnings?: string[];
  trained_at?: string;
  synthetic_augmentation?: MlSyntheticAugmentation;
}
