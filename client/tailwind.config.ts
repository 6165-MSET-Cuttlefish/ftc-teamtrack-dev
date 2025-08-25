import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./index.html",
  ],
  theme: {
    extend: {
      colors: {
        "team-dark": "#191919",
        "team-blue": "#B0E5FE", 
        "team-white": "#FFFFFF",
      },
    },
  },
  plugins: [], // Temporarily remove plugins
} satisfies Config;