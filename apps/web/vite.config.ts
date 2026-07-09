import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@headstone/agent": fileURLToPath(
        new URL("../../packages/agent/src/index.ts", import.meta.url),
      ),
      "@headstone/core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
      "@headstone/render": fileURLToPath(
        new URL("../../packages/render/src/index.ts", import.meta.url),
      ),
      "@headstone/schema": fileURLToPath(
        new URL("../../packages/schema/src/index.ts", import.meta.url),
      ),
    },
  },
});
