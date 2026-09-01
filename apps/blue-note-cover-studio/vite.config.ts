import { defineConfig } from 'vite';

// base: './' keeps built asset URLs relative so dist/ can be served from any
// static host or subpath (matches the other apps/ prototypes in this repo,
// and is required for the GitHub Pages preview at /web-app-factory/<slug>/).
export default defineConfig({
  base: './',
});
