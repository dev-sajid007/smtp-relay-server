import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxyConfig = {
  "/api": {
    target: "http://localhost:3000",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ""),
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: proxyConfig,
  },
  preview: {
    port: 4173,
    proxy: proxyConfig,
    allowedHosts: ["mail-admin.entrogic.com"],
  },
});
