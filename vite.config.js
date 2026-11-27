import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative paths, so the same build works at the site root (Netlify) and under /homebase/ (GitHub Pages)
  base: "./",
  // A fresh number every build, added to sprite URLs so phones don't keep showing old art
  define: { __BUILD_ID__: JSON.stringify(String(Date.now())) },
});
