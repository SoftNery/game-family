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
