# Pega o Bebê! — site estático (HTML + CSS + JS puro, sem build).
# Só precisa de um servidor web servindo a pasta.
FROM nginx:alpine

# configuração própria: cache longo nas imagens, revalidação no html/css/js
COPY nginx.conf /etc/nginx/conf.d/default.conf

# arquivos do jogo
COPY index.html style.css game.js /usr/share/nginx/html/
COPY img/ /usr/share/nginx/html/img/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
