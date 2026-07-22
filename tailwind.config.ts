import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        garage: {
          bg: "#18181a",
          panel: "#222226",
          "panel-raised": "#2a2a2f",
          border: "#3a3a42",
          "border-bright": "#4a4a54",
          orange: "#e85d04",
          "orange-dim": "#c44d03",
          steel: "#8b919a",
          text: "#ececee",
          muted: "#9494a0",
          success: "#34d399",
          warning: "#fbbf24",
          danger: "#f87171",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
      transitionTimingFunction: {
        industrial: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset",
        "panel-raised": "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 4px 16px rgba(0,0,0,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
