import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative paths so the build works from any host or subfolder (e.g. GitHub Pages).
  base: "./",
  plugins: [react()],
  server: { port: 5199 },
});
