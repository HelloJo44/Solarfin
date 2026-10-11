FROM nginx:alpine

# Copie de vos fichiers web dans le dossier par défaut de Nginx
COPY index.html /usr/share/nginx/html/index.html
COPY manifest.json /usr/share/nginx/html/manifest.json
COPY sw.js /usr/share/nginx/html/sw.js
COPY default.conf /etc/nginx/conf.d/default.conf
