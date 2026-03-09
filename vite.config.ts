import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 5177,
  },
  plugins: [tailwindcss(), !process.env.VITEST && reactRouter(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: "./test/setup.ts",
    globals: true,
    include: ["app/**/*.test.tsx", "app/**/*.test.ts"],
  },
});
