/** OrbitGuard AI — Design System tokens (DS v1). */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Backgrounds ──────────────────────────────────────
        "background":                 "#05090D",  // void black
        "surface":                    "#05090D",
        "surface-dim":                "#05090D",
        "surface-container-lowest":   "#071017",  // deep space (map bg)
        "surface-container-low":      "#0B141C",  // command panel (topbar)
        "surface-container":          "#0B141C",  // panels / sidebars
        "surface-container-high":     "#101B24",  // elevated surface (cards)
        "surface-container-highest":  "#101B24",  // card inner
        "surface-bright":             "#142330",  // hover surface
        "primary-container":          "#0B141C",

        // ── Borders ───────────────────────────────────────────
        "outline-variant":    "#1B2A36",  // border-default
        "outline":            "#13202A",  // border-subtle
        "secondary-container":"#1B2A36",  // sidebar active bg
        "surface-variant":    "#1B2A36",

        // ── Text ──────────────────────────────────────────────
        "on-surface":          "#E8F0F2",  // text-primary
        "on-surface-variant":  "#AAB7BE",  // text-secondary
        "on-background":       "#E8F0F2",
        "on-primary":          "#05090D",
        "on-primary-container":"#AAB7BE",
        "on-secondary":        "#E8F0F2",
        "on-secondary-container": "#AAB7BE",
        "inverse-on-surface":  "#05090D",

        // ── Accent — Orbit Teal (brand primary) ───────────────
        "terminal-cyan":  "#32D3C2",  // → orbit-teal
        "orbit-teal":     "#32D3C2",
        "data-cyan":      "#5EBBFF",
        "signal-blue":    "#2E7BFF",
        "primary":        "#32D3C2",
        "primary-fixed":  "#32D3C2",
        "secondary":      "#AAB7BE",

        // ── Risk / Severity ───────────────────────────────────
        "risk-critical":  "#FF3347",  // critical-red
        "risk-high":      "#FF5A2D",  // alert-orange
        "risk-moderate":  "#FFC857",  // warning-yellow
        "risk-low":       "#22D47B",  // success-green

        // ── Semantic aliases ──────────────────────────────────
        "alert-orange":   "#FF5A2D",
        "critical-red":   "#FF3347",
        "success-green":  "#22D47B",
        "warning-yellow": "#FFC857",
        "tertiary":       "#32D3C2",

        // ── Error ─────────────────────────────────────────────
        "error":              "#FF3347",
        "error-container":    "#3D0A0F",
        "on-error":           "#E8F0F2",
        "on-error-container": "#FF3347",

        // ── Keep a few legacy names untouched ─────────────────
        "space-gray-deep":        "#142330",
        "inverse-surface":        "#E8F0F2",
        "inverse-primary":        "#0B141C",
        "on-primary-fixed":       "#05090D",
        "on-tertiary":            "#05090D",
        "on-tertiary-container":  "#32D3C2",
        "tertiary-container":     "#071017",
        "tertiary-fixed":         "#32D3C2",
        "tertiary-fixed-dim":     "#5EBBFF",
      },

      borderRadius: {
        DEFAULT: "4px",
        sm:   "6px",
        md:   "10px",
        lg:   "6px",    // kept for backward compat (was 0.25rem/4px, now 6px)
        xl:   "10px",   // kept for backward compat
        "2xl":"14px",
        full: "999px",
      },

      spacing: {
        "base":          "4px",
        "gutter":        "16px",
        "margin-sm":     "12px",
        "margin-md":     "24px",
        "margin-lg":     "40px",
        "panel-padding": "16px",
      },

      fontFamily: {
        "sans":        ["Inter", "system-ui", "sans-serif"],
        "mono":        ['"JetBrains Mono"', "monospace"],
        "data-mono":   ['"JetBrains Mono"', "monospace"],
        "label-caps":  ['"JetBrains Mono"', "monospace"],
        "headline-md": ["Inter", "sans-serif"],
        "headline-lg": ["Inter", "sans-serif"],
        "body-md":     ["Inter", "sans-serif"],
        "body-sm":     ["Inter", "sans-serif"],
        "body-lg":     ["Inter", "sans-serif"],
      },

      fontSize: {
        "headline-xl":  ["36px", { lineHeight: "1.1",  letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg":  ["24px", { lineHeight: "1.2",  fontWeight: "650" }],
        "headline-md":  ["20px", { lineHeight: "1.25", fontWeight: "600" }],
        "body-lg":      ["16px", { lineHeight: "1.5",  fontWeight: "400" }],
        "body-md":      ["14px", { lineHeight: "1.45", fontWeight: "400" }],
        "body-sm":      ["13px", { lineHeight: "1.45", fontWeight: "400" }],
        "data-mono":    ["13px", { lineHeight: "1.4",  fontWeight: "500" }],
        "label-caps":   ["11px", { lineHeight: "1.4",  letterSpacing: "0.04em", fontWeight: "700" }],
      },

      boxShadow: {
        "panel":       "0 16px 50px rgba(0,0,0,0.45)",
        "glow-teal":   "0 0 24px rgba(50,211,194,0.28)",
        "glow-orange": "0 0 22px rgba(255,90,45,0.32)",
        "glow-blue":   "0 0 18px rgba(46,123,255,0.26)",
      },
    },
  },
  plugins: [],
};
