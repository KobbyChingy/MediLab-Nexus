import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_DEV_API_PROXY_TARGET ?? "http://localhost:4000";

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/@tiptap") || id.includes("rich-text-editor")) {
              return "editor";
            }

            if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
              return "react-vendor";
            }

            if (id.includes("node_modules/pdfjs-dist")) {
              return "pdf-tools";
            }

            if (id.includes("node_modules/mammoth")) {
              return "doc-import";
            }

            if (id.includes("node_modules/html-docx-js-typescript")) {
              return "doc-export";
            }

            return undefined;
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
        "/health": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
