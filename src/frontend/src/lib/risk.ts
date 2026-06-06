import type { RiskItem } from "../types";

export const RISK_HEX: Record<string, string> = {
  Critico: "#EF4444",
  Alto: "#F97316",
  Moderado: "#FBBF24",
  Baixo: "#10B981",
};

export const RISK_TOKEN: Record<string, string> = {
  Critico: "risk-critical",
  Alto: "risk-high",
  Moderado: "risk-moderate",
  Baixo: "risk-low",
};

export const RISK_PRIORITY: Record<string, string> = {
  Critico: "ALPHA",
  Alto: "BRAVO",
  Moderado: "CHARLIE",
  Baixo: "DELTA",
};

export function riskColor(level?: string): string {
  return (level && RISK_HEX[level]) || "#22D3EE";
}

export function riskToken(level?: string): string {
  return (level && RISK_TOKEN[level]) || "terminal-cyan";
}

export function levelLabel(level?: string): string {
  if (level === "Critico") return "CRITICAL";
  if (level === "Alto") return "HIGH";
  if (level === "Moderado") return "MODERATE";
  if (level === "Baixo") return "LOW";
  return "PENDING";
}

export function riskForRegion(risk: RiskItem[], regionId: number | null): RiskItem | undefined {
  if (regionId == null) return undefined;
  return risk.find((r) => r.region_id === regionId);
}

export function maxRisk(risk: RiskItem[]): RiskItem | undefined {
  return [...risk].sort((a, b) => b.score - a.score)[0];
}
