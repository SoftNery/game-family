# Pega o Bebê! — site estático (HTML + CSS + JS puro, sem build).
# Só precisa de um servidor web servindo a pasta.
FROM nginx:alpine

# configuração própria: cache longo nas imagens, revalidação no html/css/js
COPY nginx.conf /etc/nginx/conf.d/default.conf

# arquivos do jogo
COPY index.html style.css game.js audio.js /usr/share/nginx/html/

# Carimba o hash do conteúdo na referência de cada arquivo dentro do HTML:
#   <script src="game.js">  ->  <script src="game.js?v=05e0a30b">
# Deploy com mudança = URL nova = navegador obrigado a baixar de novo, sem
# depender de revalidação de cache, que proxy ou CDN no meio do caminho pode
# furar. Arquivo que não mudou mantém a mesma URL e segue vindo do cache.
# É idempotente: rodar de novo não duplica, porque o padrão inclui a aspa.
RUN cd /usr/share/nginx/html && \
    for f in style.css audio.js game.js; do \
      h=$(md5sum "$f" | cut -c1-8); \
      sed -i "s|\"$f\"|\"$f?v=$h\"|g" index.html; \
    done && \
    echo "--- referências versionadas ---" && \
    grep -E 'href="style|src="(game|audio)' index.html

COPY img/ /usr/share/nginx/html/img/
# pasta inteira: clipes novos entram no deploy sem mexer aqui
COPY audio/ /usr/share/nginx/html/audio/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
