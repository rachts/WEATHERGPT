import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2D5016", // Deep Moss Green
          dark: "#173901",
          light: "#EAF2E2",
        },
        bg: {
          DEFAULT: "#FAF9F6", // Warm off-white
          chat: "#FAF9F6",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          card: "#FFFFFF",
          ai: "#F5F4F0", // AI bubble fill, no border
        },
        border: {
          DEFAULT: "#E8E6E1", // Card hairline border
          hairline: "#E8E6E1",
          dark: "#C3C9B9",
        },
        text: {
          primary: "#1A1A1A",
          secondary: "#6B6B6B",
          muted: "#5E5F5D",
        },
        severity: {
          low: "#2D5016",
          moderate: "#8A8781",
          high: "#BA1A1A",
          severe: "#701A1A",
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        none: "none",
      },
      backgroundImage: {
        none: "none",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.2s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
