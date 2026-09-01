import { defineConfig } from 'vite';

// GitHub Pages はプロジェクトサイト（サブパス配信）になるため相対パスにする
export default defineConfig({
  base: './',
});
