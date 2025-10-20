import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
  colors: {
    neutral: {
      900: "#454a538a",
      800: "#5e6775ff",
      700: "#84878bff",
      400: "#d3d5d8ff",
      100: "#FAFBFD",
    },
    black: "#1b1b1bd3",
    blue: { 500: "#9BC0FF" },
  },
}
  },
  plugins: [],
} satisfies Config;
