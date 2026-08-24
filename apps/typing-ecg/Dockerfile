# typing-ecg — static site (plain HTML/CSS/ES modules, no build step).
# Files are copied as-is into nginx's web root.
FROM nginx:alpine

COPY index.html styles.css app.js ecg-canvas.js diagnosis.js /usr/share/nginx/html/

EXPOSE 80
