import { defineConfig } from "vitest/config";

export default defineConfig({
  root: ".",
  // base: './' keeps built asset URLs relative so `dist/` can be served from
  // any subdirectory (e.g. GitHub Pages project sites under /<repo>/<slug>/).
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      // main.ts is pure wiring exercised by E2E, not by the unit/integration suite.
      exclude: ["src/main.ts"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
