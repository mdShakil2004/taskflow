/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#12151B", // base canvas
          panel: "#1B212B",   // raised surface (cards, rail)
          raised: "#232B37",  // hover/active surface
          line: "#2A3242",    // borders/dividers
        },
        paper: {
          DEFAULT: "#E9EBEF", // primary text on ink
          muted: "#8B93A6",   // secondary text
          faint: "#5B6373",   // tertiary / placeholder
        },
        signal: {
          amber: "#E8A33D",  // in_progress, pending job
          green: "#4CAF7D",  // done, completed, dispatched
          red: "#E5484D",    // urgent, failed
          blue: "#5B8DEF",   // review, active job, info
          ash: "#6B7280",    // todo, low priority
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: 1, transform: "scale(1)" },
          "50%": { opacity: 0.4, transform: "scale(0.75)" },
        },
      },
      animation: {
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
