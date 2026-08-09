import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.CRADLE_API_TARGET ?? "http://localhost:8787";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
