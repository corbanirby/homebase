import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative paths, so the same build works at the site root (Netlify) and under /homebase/ (GitHub Pages)
  base: "./",
});
