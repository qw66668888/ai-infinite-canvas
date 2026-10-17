import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { preserveSymlinks: true },
  server: { port: 5180, strictPort: true, open: false },
});
