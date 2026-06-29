import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Relative base so the built bundle loads over file:// inside Electron (prod)
// as well as from a dev server. Port 5273 to avoid colliding with sibling apps.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5273,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
  },
});
