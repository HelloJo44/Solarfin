FROM nginx:alpine

# Copie de vos fichiers web dans le dossier par défaut de Nginx
COPY index.html /usr/share/nginx/html/index.html
COPY manifest.json /usr/share/nginx/html/manifest.json
COPY sw.js /usr/share/nginx/html/sw.js

# Modèle de configuration : au démarrage, l'image nginx remplace ${SEER_URL} par la variable d'environnement
COPY default.conf.template /etc/nginx/templates/default.conf.template
