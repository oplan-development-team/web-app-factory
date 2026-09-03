# -- Build stage ----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
# Playwright is a devDependency used only by the local verification script;
# the image must not spend time (or disk) fetching browsers it never runs.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# -- Runtime stage --------------------------------------------------------
FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
