import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { preserveSymlinks: true },
  server: {
    port: 5180,
    strictPort: true,
    open: false,
    proxy: {
      "/ark-proxy": {
        target: "https://ark.cn-beijing.volces.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/ark-proxy/, "/api/v3"),
      },
    },
  },
});
