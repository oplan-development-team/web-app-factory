import { defineConfig } from 'vite';

// GitHub Pages serves this project from a sub-path
// (https://<org>.github.io/web-app-factory/kintsugi-mending-studio/), so
// asset URLs must stay relative rather than root-absolute.
export default defineConfig({
  base: './',
});
