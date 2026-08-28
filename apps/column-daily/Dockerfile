# --- build stage ---
# Vite 8 requires Node ^20.19.0 || >=22.12.0.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- runtime stage ---
# No SPA history fallback is configured on purpose: the app uses HashRouter,
# so every route is served by the same index.html.
FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
