import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Manually split heavy vendor libs to keep the main bundle slim and
        // improve cache hit-rate (these change less often than app code).
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": ["lucide-react", "sonner"],
          "charts-vendor": ["recharts"],
          "pdf-vendor": ["jspdf", "html2canvas"],
          "supabase-vendor": ["@supabase/supabase-js"],
        },
      },
    },
  },
});
