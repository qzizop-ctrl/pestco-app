/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand
        primary: { DEFAULT: "#0F2E5E", mid: "#2A5FA8" },
        gold: { DEFAULT: "#C08A3E", soft: "#F3E6D0" },
        danger: "#B3401F",
        // Theme surfaces — these read from the same CSS variables the app
        // already sets on <html> for light/dark mode (see index.css), so
        // e.g. `bg-surface` now does what `style={{ background: SURFACE }}` did.
        bg: "var(--bg)",
        surface: { DEFAULT: "var(--surface)", subtle: "var(--surface-subtle)" },
        ink: "var(--text)",
        muted: "var(--muted)",
        line: "var(--line)",
        // Status colors used across visits/offers/activity
        status: {
          overdue: "#C4443A",
          today: "#DB9A2C",
          upcoming: "#2E6B8F",
          none: "#9AA39B",
        },
      },
      fontFamily: {
        sans: ["Tajawal", "sans-serif"],
      },
      transitionProperty: {
        screen: "opacity, transform",
      },
      keyframes: {
        "screen-in": {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "screen-in": "screen-in 180ms ease-out",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};
