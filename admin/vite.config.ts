import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy in dev so the console and API share an origin — no CORS, and the
    // production build can sit behind the same reverse proxy.
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://127.0.0.1:4000",
        changeOrigin: true,
      },
    },
  },
});
