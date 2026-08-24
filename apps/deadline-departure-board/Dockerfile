# Static site — no build stage is needed since this app is plain HTML/CSS/JS
# with no bundler or dependencies. We still follow the project's standard
# multi-stage layout (see .claude/CLAUDE.md) for consistency across apps.

FROM nginx:alpine AS runtime

COPY index.html /usr/share/nginx/html/index.html
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
