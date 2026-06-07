import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink)",
        surface: "var(--color-surface)",
        paper: "var(--color-paper)",
        muted: "var(--color-muted)",
        line: "var(--color-line)",
        accent: "var(--color-accent)",
        advance: "var(--color-advance)",
        conditional: "var(--color-conditional)",
        pass: "var(--color-pass)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
