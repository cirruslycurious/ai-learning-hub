import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // PWA manifest and workbox config in later stories
    }),
  ],
  resolve: {
    alias: {
      "@ai-learning-hub/types": path.resolve(
        __dirname,
        "../backend/shared/types/src"
      ),
    },
  },
});
