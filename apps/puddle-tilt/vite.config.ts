import { defineConfig } from 'vite';

// base: './' keeps built asset URLs relative so dist/ can be hosted from a
// GitHub Pages subpath (/<repo>/puddle-tilt/) as well as the repo root.
export default defineConfig({
  base: './',
});
