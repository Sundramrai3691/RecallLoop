import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: [fileURLToPath(new URL("../", import.meta.url))] },
    proxy: {
      "/api": apiTarget,
    },
  },
  preview: {
    proxy: { "/api": apiTarget },
  },
});
