import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  root: __dirname,
  build: {
    outDir: "dist-spa",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index-spa.html"),
    },
  },
});
