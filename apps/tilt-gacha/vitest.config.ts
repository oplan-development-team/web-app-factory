import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // 既定は node。DOM が要る統合テストはファイル先頭の `@vitest-environment jsdom` で切り替える。
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // main.ts はブートストラップのみ、types.ts は型のみ（NFR-008.4 の除外対象）
      exclude: ["src/main.ts", "src/**/types.ts"],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
