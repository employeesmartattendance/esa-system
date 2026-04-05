import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  base: "./", // CRITICAL: Ensures relative paths for Electron
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Treat all tags with a dash as custom elements if needed
          isCustomElement: (tag) => tag.includes("-"),
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://esasystem.onrender.com",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "https://esasystem.onrender.com",
        ws: true,
        changeOrigin: true,
      },
      "/uploads": {
        target: "https://esasystem.onrender.com",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: false, // Keep logs for debugging the white screen
        drop_debugger: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ["vue", "vue-router", "pinia"],
          axios: ["axios"],
          socket: ["socket.io-client"],
        },
      },
    },
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
  },
});
