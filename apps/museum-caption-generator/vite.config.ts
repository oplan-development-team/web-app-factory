import { defineConfig } from 'vite';

// base: './' keeps built asset URLs relative so `dist/` can be served from
// any subdirectory (e.g. GitHub Pages project sites under /<repo>/<slug>/).
export default defineConfig({
  base: './',
});
