import { defineConfig } from 'vitest/config';

// Most modules under src/ are pure functions and run fastest in the node
// environment; the handful that touch the DOM opt into jsdom per-file via a
// `// @vitest-environment jsdom` docblock.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        // Entry point: three lines of side-effectful bootstrapping, covered
        // end-to-end by the Playwright suite instead.
        'src/main.ts',
        // Test fixture helper, not shipped code.
        'src/test-utils.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      reporter: ['text', 'html'],
    },
  },
});
