import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  // base: './' keeps built asset URLs relative so `dist/` can be served from
  // any subdirectory (e.g. GitHub Pages project sites under /<repo>/<slug>/).
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
  },
});
