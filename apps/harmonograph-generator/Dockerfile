# --- Build stage -----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage -----------------------------------------------------------
# 完全クライアントサイド (Canvas 2D / SVG組み立てを自前実装、外部通信なし) の
# 静的サイトなので nginx で配信する。
FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
