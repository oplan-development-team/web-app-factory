import { defineConfig } from 'vite';

// GitHub Pages serves this project from a sub-path
// (https://<org>.github.io/web-app-factory/blow-out-wish/), so assets must
// be referenced with relative paths rather than root-absolute ones.
export default defineConfig({
  base: './',
});
