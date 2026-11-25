import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const target = process.env.VITE_PROXY_TARGET || "http://localhost:8000";

// Proxying /api and /ws keeps everything same-origin in dev, so the httpOnly
// refresh-token cookie works without CORS or SameSite headaches.
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true, css: false },
  server: {
    port: 5173,
    proxy: {
      "/api": { target, changeOrigin: true },
      "/media": { target, changeOrigin: true },
      "/ws": { target: target.replace("http", "ws"), ws: true },
    },
  },
});
