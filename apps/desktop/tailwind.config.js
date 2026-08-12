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
        "text-disabled": "var(--text-disabled)",
        accent: "var(--accent)",
        "accent-fg": "var(--accent-fg)",
        "accent-hover": "var(--accent-hover)",
        "accent-active": "var(--accent-active)",
        link: "var(--link)",
        warn: "var(--warn)",
        "warn-bg": "var(--warn-bg)",
        ok: "var(--ok)",
        "ok-bg": "var(--ok-bg)",
        error: "var(--error)",
        "error-bg": "var(--error-bg)",
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
        "rounded-input": "12px",
      },
      boxShadow: {
        card: "0 1px 3px var(--depth-shallow), 0 4px 16px var(--depth-mid)",
        pop: "0 8px 30px var(--depth-deep), 0 2px 8px var(--depth-mid)",
        glow: "0 0 0 1px color-mix(in srgb, var(--depth-glow) 25%, transparent), 0 0 12px color-mix(in srgb, var(--depth-glow) 8%, transparent)",
      },
      animation: {
        "toggle-switch": "toggleSwitch 160ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "ripple-in": "rippleIn 240ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "fade-in": "fadeIn 150ms ease-out 150ms both",
        "page-enter": "pageEnter 280ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "card-enter": "cardEnter 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "breathe-glow": "breatheGlow 3s ease-in-out infinite",
      },
      keyframes: {
        toggleSwitch: {
          "0%": { transform: "scaleX(1)" },
          "50%": { transform: "scaleX(0.9)" },
          "100%": { transform: "scaleX(1)" },
        },
        rippleIn: {
          "from": { opacity: "0", transform: "scale(0.97)" },
          "to": { opacity: "1", transform: "scale(1)" },
        },
        fadeIn: {
          "from": { opacity: "0" },
          "to": { opacity: "1" },
        },
        pageEnter: {
          "from": { opacity: "0", transform: "translateY(6px)" },
          "to": { opacity: "1", transform: "translateY(0)" },
        },
        cardEnter: {
          "from": { opacity: "0", transform: "translateY(10px) scale(0.985)" },
          "to": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        breatheGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 color-mix(in srgb, var(--depth-glow) 0%, transparent)" },
          "50%": { boxShadow: "0 0 8px 2px color-mix(in srgb, var(--depth-glow) 30%, transparent)" },
        },
      },
    },
  },
  plugins: [],
};
