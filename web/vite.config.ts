import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// In development the API runs on its own port; the proxy keeps both on one origin.
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
});
