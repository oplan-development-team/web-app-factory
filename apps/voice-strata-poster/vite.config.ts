import { defineConfig } from 'vite';

// base: './' keeps built asset URLs relative so dist/ can be served from a
// GitHub Pages project subdirectory (/<repo>/<slug>/) as well as from a domain root.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
  },
});
