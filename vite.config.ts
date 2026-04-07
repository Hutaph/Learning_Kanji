import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }
          if (id.includes("react") || id.includes("scheduler")) {
            return "react-vendor";
          }
          if (id.includes("framer-motion")) {
            return "motion-vendor";
          }
          if (id.includes("lucide-react")) {
            return "icon-vendor";
          }
          return "vendor";
        }
      }
    }
  },
  server: {
    proxy: {
      "/api/tts": {
        target: "https://translate.googleapis.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tts/, "/translate_tts")
      }
    }
  }
});
