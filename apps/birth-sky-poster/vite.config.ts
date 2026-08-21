import { defineConfig } from 'vite';

// base: './' keeps built asset URLs relative so dist/ can be served from a
// subdirectory as well as from a domain root (NFR-002.2).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
});
