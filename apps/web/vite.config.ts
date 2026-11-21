import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const rootEnvDirectory = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => {
  const { API_PROXY_TARGET } = loadEnv(
    mode,
    rootEnvDirectory,
    "API_PROXY_TARGET",
  );

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": API_PROXY_TARGET || "http://localhost:3001",
      },
    },
  };
});
