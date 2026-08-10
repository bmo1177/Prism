/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        border: "var(--border)",
        faint: "var(--border-faint)",
        text: "var(--text)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "accent-fg": "var(--accent-fg)",
        link: "var(--link)",
        warn: "var(--warn)",
        ok: "var(--ok)",
        error: "var(--error)",
        focus: "var(--focus-ring)",
        glow: "var(--depth-glow)",
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "16px",
        input: "12px",
      },
      boxShadow: {
        card: "0 1px 3px var(--depth-shallow), 0 4px 16px var(--depth-mid)",
        pop: "0 8px 30px var(--depth-deep), 0 2px 8px var(--depth-mid)",
        glow: "0 0 0 1px color-mix(in srgb, var(--depth-glow) 25%, transparent), 0 0 12px color-mix(in srgb, var(--depth-glow) 8%, transparent)",
      },
    },
  },
  plugins: [],
};
