import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages はプロジェクトサイトを /<repo>/<slug>/ のサブパスで配信するため、
  // 生成アセットの URL を相対にしておく（NFR-002.2）。
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
