import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'https://kojima-solutions.ch',
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Lift the warning floor — heavy chunks below are intentional, named
    // vendor bundles that we want the browser to cache long-term.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split heavy third-party deps so the initial admin shell stays
        // small and downstream chunks (recharts, framer, react-markdown)
        // load only when the matching feature is opened. Saves ~400-700KB
        // of JS on the first paint of the login screen / docs page.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-recharts";
            if (id.includes("framer-motion")) return "vendor-motion";
            if (id.includes("@radix-ui")) return "vendor-radix";
            if (id.includes("react-markdown") || id.includes("remark-") || id.includes("micromark")) return "vendor-markdown";
            if (id.includes("@dnd-kit")) return "vendor-dnd";
            if (id.includes("pdf-lib")) return "vendor-pdf";
            if (id.includes("date-fns")) return "vendor-datefns";
            if (id.includes("lucide-react")) return "vendor-icons";
          }
        },
      },
    },
  },
}));
