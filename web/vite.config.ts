import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://192.168.73.12:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws:192.168.73.12:3000",
        ws: true,
      },
    },
  },
});
