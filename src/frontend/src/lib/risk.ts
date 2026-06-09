import type { RiskItem } from "../types";

export const RISK_HEX: Record<string, string> = {
  Critico:  "#FF3347",  // critical-red
  Alto:     "#FF5A2D",  // alert-orange
  Moderado: "#FFC857",  // warning-yellow
  Baixo:    "#22D47B",  // success-green
};

export const RISK_BG: Record<string, string> = {
  Critico:  "rgba(255,51,71,0.16)",
  Alto:     "rgba(255,90,45,0.14)",
  Moderado: "rgba(255,200,87,0.12)",
  Baixo:    "rgba(34,212,123,0.12)",
};

export const RISK_BORDER: Record<string, string> = {
  Critico:  "rgba(255,51,71,0.45)",
  Alto:     "rgba(255,90,45,0.42)",
  Moderado: "rgba(255,200,87,0.30)",
  Baixo:    "rgba(34,212,123,0.28)",
};

export const RISK_TOKEN: Record<string, string> = {
  Critico:  "risk-critical",
  Alto:     "risk-high",
  Moderado: "risk-moderate",
  Baixo:    "risk-low",
};

export const RISK_PRIORITY: Record<string, string> = {
  Critico:  "P1",
  Alto:     "P2",
  Moderado: "P3",
  Baixo:    "P4",
};

export const RISK_GLOW_CLASS: Record<string, string> = {
  Critico:  "risk-glow-critical",
  Alto:     "risk-glow-high",
  Moderado: "risk-glow-moderate",
  Baixo:    "",
};

export function riskColor(level?: string): string {
  return (level && RISK_HEX[level]) || "#32D3C2";
}

export function riskBg(level?: string): string {
  return (level && RISK_BG[level]) || "rgba(50,211,194,0.1)";
}

export function riskBorder(level?: string): string {
  return (level && RISK_BORDER[level]) || "rgba(50,211,194,0.3)";
}

export function riskToken(level?: string): string {
  return (level && RISK_TOKEN[level]) || "terminal-cyan";
}

export function riskGlowClass(level?: string): string {
  return (level && RISK_GLOW_CLASS[level]) || "border border-outline-variant";
}

export function levelLabel(level?: string): string {
  if (level === "Critico")  return "CRÍTICO";
  if (level === "Alto")     return "ALTO";
  if (level === "Moderado") return "MODERADO";
  if (level === "Baixo")    return "BAIXO";
  return "PENDENTE";
}

export function riskForRegion(risk: RiskItem[], regionId: number | null): RiskItem | undefined {
  if (regionId == null) return undefined;
  return risk.find((r) => r.region_id === regionId);
}

export function maxRisk(risk: RiskItem[]): RiskItem | undefined {
  return [...risk].sort((a, b) => b.score - a.score)[0];
}
