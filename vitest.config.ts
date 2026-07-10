import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@headstone/agent": fileURLToPath(new URL("./packages/agent/src/index.ts", import.meta.url)),
      "@headstone/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@headstone/export": fileURLToPath(new URL("./packages/export/src/index.ts", import.meta.url)),
      "@headstone/proof": fileURLToPath(new URL("./packages/proof/src/index.ts", import.meta.url)),
      "@headstone/render": fileURLToPath(new URL("./packages/render/src/index.ts", import.meta.url)),
      "@headstone/schema": fileURLToPath(new URL("./packages/schema/src/index.ts", import.meta.url)),
    },
  },
});
