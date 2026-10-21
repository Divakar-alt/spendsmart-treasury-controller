import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#060a17",
          900: "#0b132b",
          850: "#101b3b",
          800: "#1c2541",
          700: "#2d3748",
          600: "#3a506b",
        },
        teal: {
          400: "#2dd4bf",
          500: "#14b8a6",
          accent: "#00f2fe",
          emerald: "#10b981",
        },
        cyan: {
          glow: "#4facfe",
        },
      },
    },
  },
  plugins: [],
};
export default config;
