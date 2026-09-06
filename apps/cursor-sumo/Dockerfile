# カーソル相撲 (Cursor Sumo) — 静的サイトのマルチステージビルド
# ビルドツール不使用（素のHTML/CSS/JS）だが、dist/生成の一貫性のためbuildステージを経由する。

FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN node scripts/build.js

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
