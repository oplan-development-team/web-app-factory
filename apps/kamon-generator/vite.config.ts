import { defineConfig } from "vite";

export default defineConfig({
  // サブパス配信でも壊れないように相対パスで出力する（NFR-002.2）
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
