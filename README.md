# Pega o Bebê!

Jogo web de corrida lateral: a mãe precisa alcançar o filho, que está fugindo
pela casa para não trocar a fralda. A casa é um circuito — sala, corredor e
quarto do bebê, repetindo — e o danado é escorregadio: **precisa ser pego 3
vezes**. Nas duas primeiras ele se debate, escapole e dispara na frente um
pouco mais rápido; só na terceira vem o colo de vez.

HTML5 Canvas com **HTML, CSS e JavaScript puro**. Sem frameworks, sem
bibliotecas externas, sem etapa de build.

## Como jogar

**Computador**

| Tecla | Ação |
|---|---|
| `A` / `D` ou `←` / `→` | correr |
| `Espaço` ou `↑` | pular |
| `E` ou `Enter` | pegar |
| `P` | pausar |

**Celular** — quatro botões grandes na tela. Precisa estar deitado (modo
paisagem); em pé aparece o aviso para girar.

A mãe começa com 3 vidas. Tropeçar na bagunça do chão ou levar um brinquedo /
fralda na cabeça custa uma vida. O botão **PEGAR** só funciona quando o bebê
está ao alcance — aí aparece a seta "PEGA!" em cima dele. Cada pegada devolve
os corações, então cada trecho da perseguição é um fôlego novo.

Três finais: a mãe pega as 3 vezes, as vidas acabam (`mae-cansada`), ou o bebê
completa o circuito (`filho-comemorando-fuga`).

### Equilíbrio

Duas ajudas invisíveis existem porque a vantagem de velocidade da mãe é
pequena (~20%), e sem elas quem titubeia fica mais lento que o bebê e nunca
mais encosta nele — terminando a partida sem uma pegada sequer:

- **Ele enrola quando está longe:** olha para trás, vê a perseguição e afrouxa
  o passo, proporcional à distância.
- **Ele cansa:** depois de alguns segundos solto, vai perdendo o pique, e fica
  mais desastrado (tropeça com mais frequência).

Ambas só valem **enquanto a mãe está de fato correndo atrás**. Quem fica parado
não ganha ajuda nenhuma — senão ficar parado viraria um impasse arrastado em
vez de uma derrota. E quem joga bem pega o bebê antes dos 8 segundos, então
nunca vê nada disso acontecer.

## Som

Não há nenhum arquivo de áudio no projeto. Efeitos e música são **gerados na
hora** pela Web Audio API (osciladores, ruído e envelopes de ganho), o que
mantém a regra de não usar bibliotecas nem assets externos e não pesa no
carregamento.

O botão ♪ no HUD liga e desliga o som, e a preferência fica salva no
`localStorage`. O navegador só libera áudio depois de um gesto do usuário, então
o contexto é criado no primeiro clique, toque ou tecla.

A "risada" do bebê é um motivo saltitante de propósito: síntese simples não
imita voz humana sem soar robótica, então ela virou um efeito de molecagem em
vez de uma voz falsa.

### Vozes da família

Além da síntese, o jogo toca clipes gravados de verdade. Ficam em `audio/` e
são declarados na lista `VOZES`, no topo do [audio.js](audio.js).

Momentos disponíveis (todos já chamados pelo jogo, basta ter clipe):
`inicio`, `pegada`, `dano`, `vitoria`, `derrota`, `fuga`. Se houver mais de um
clipe para o mesmo momento, o jogo sorteia entre eles.

**Jeito fácil — só o nome do arquivo.** Batize como `<momento>-NN.<extensão>`,
jogue em `audio/` e acabou; não precisa mexer em código nenhum:

```
audio/pegada-01.m4a      audio/vitoria-01.m4a
audio/pegada-02.m4a      audio/derrota-01.mp3
```

O jogo procura do `01` em diante e para no primeiro que faltar, então numere
sem pular. Ele descobre isso fazendo algumas requisições que voltam 404 no
carregamento — inofensivas, mas aparecem no console do navegador. Para
desligar, `VOZ_AUTO.ativo = false`.

**Jeito explícito — nome descritivo.** Se preferir manter um nome que diga o
que é, declare na lista `VOZES`:

```js
{ id: 'bronca', arquivo: 'audio/mae-brigando.m4a',
  evento: 'derrota', chance: 1, cooldown: 9, volume: 1 },
```

O `Dockerfile` copia a pasta `audio/` inteira nos dois casos, então clipe novo
nunca exige mexer no deploy.

Enquanto alguém fala, a música abaixa sozinha, e duas falas nunca se
atropelam. O botão de mudo cala as vozes junto.

**Formato:** prefira **.m4a** ou **.mp3**. O campo `arquivo` também aceita uma
lista em ordem de preferência — o jogo usa o primeiro formato que o navegador
tocar e, se o arquivo não existir, cai sozinho para o próximo. Isso permite
manter um `.m4a` para iPhone antigo e um `.ogg` para o resto, no mesmo clipe.

> iPhone e iPad com iOS 16 ou anterior **não tocam .ogg**. Nesses aparelhos o
> jogo simplesmente segue sem a voz, sem quebrar nada.

## Rodando na sua máquina

Qualquer servidor estático serve:

```bash
python -m http.server 8123
```

Depois abra `http://localhost:8123`. Abrir o `index.html` direto com dois
cliques também funciona (o jogo não usa `fetch` nem leitura de pixels do
canvas, então não esbarra em CORS).

## Deploy no Dokploy

O projeto sobe como **site estático servido por nginx**.

1. No Dokploy: **Create Application** → provider **GitHub** (ou Git) e aponte
   para este repositório e a branch `main`.
2. Build Type: **Dockerfile** (o `Dockerfile` está na raiz).
3. Em **Ports**, use a porta **80** do container.
4. Adicione o domínio em **Domains** e ligue o certificado (Let's Encrypt).
5. **Deploy**.

Não precisa de variável de ambiente nenhuma.

### Cache: por que o deploy sempre aparece

O build carimba o hash do conteúdo na referência de cada script dentro do
`index.html`:

```html
<script src="game.js?v=05e0a30b"></script>
```

Mudou o arquivo, muda o hash, muda a URL — e o navegador é obrigado a baixar
de novo. Não depende de revalidação de cache, que é justamente o que proxy e
CDN no meio do caminho costumam furar. Arquivo que não mudou mantém a URL e
continua vindo do cache.

O carimbo acontece só dentro da imagem Docker. Rodando local os arquivos ficam
sem `?v=`, então nada muda no dia a dia.

A tela inicial mostra o hash no rodapé (`versão 05e0a30b`), então dá para
bater o olho e saber se o deploy pegou. Abrindo local aparece `versão local`.

### Sobre performance

São ~23 MB de PNG (só os três cenários somam 4,4 MB). O `nginx.conf` já manda
`Cache-Control: immutable` de um ano para `/img/`, então o peso é só na
primeira visita — depois carrega do cache do navegador. O HTML, o CSS e o JS
revalidam a cada deploy para ninguém ficar preso numa versão antiga.

Se quiser deixar a primeira carga mais leve, dá para converter os PNGs para
WebP e servir os dois formatos — mas isso mexe nos arquivos de arte, então
ficou de fora de propósito.

## Estrutura

```
index.html    canvas, HUD, botões de toque e as 8 telas
style.css     moldura 16:9, HUD, controles e telas
game.js       motor completo (assets, animação, física, câmera, estados)
audio.js      síntese dos efeitos e da música (Web Audio API, sem arquivos)
img/          86 PNGs (cenários, mãe, filho, obstáculos, projéteis)
Dockerfile    imagem nginx com os arquivos estáticos
nginx.conf    cache e gzip
```

### Nota sobre os sprites

Os PNGs têm dimensões e sobras de transparência diferentes entre si, então o
`game.js` guarda em `ATLAS` o recorte real do corpo em cada quadro, medido a
partir do canal alfa. Isso mantém os pés no chão, normaliza o tamanho pela
área desenhada em vez da moldura do arquivo, e corta sobras soltas presentes
em alguns arquivos (`mae-pegando-filho-02/03/04` têm um bebê duplicado na
borda esquerda que não aparece no jogo).

A sequência de corrida do filho está nomeada `filho-corrento-01..06` nos
arquivos originais — o código usa esse nome.
