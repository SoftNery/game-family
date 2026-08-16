/* ============================================================================
   PEGA O BEBÊ!  —  jogo de corrida lateral em HTML5 Canvas
   HTML + CSS + JavaScript puro, sem frameworks e sem bibliotecas externas.

   Organização do arquivo:
     1. CFG ......... todas as configurações (velocidade, escala, gravidade...)
     2. ATLAS ....... recorte real de cada PNG (calculado a partir do alfa)
     3. AssetLoader . pré-carregamento das imagens
     4. FrameCache .. pré-renderiza cada quadro já no tamanho final
     5. Animation ... controle de sequências de quadros
     6. Entidades ... Player (mãe), Baby (filho), Projectile, Obstacle
     7. Input ....... teclado + botões de toque
     8. Camera / Level
     9. Game ........ máquina de estados, laço principal, HUD e telas
   ========================================================================== */
'use strict';

/* ========================================================================== *
 * 1. CONFIGURAÇÃO CENTRAL
 * ========================================================================== */
const CFG = {
  // resolução lógica (o canvas é escalado para caber na tela)
  VIEW_W: 1280,
  VIEW_H: 720,
  MAX_DT: 1 / 30,            // delta time limitado, evita saltos

  // cenário
  BG_NATIVE_W: 1774,
  BG_NATIVE_H: 887,
  BG_H: 900,                 // altura do cenário em pixels lógicos
  BG_GROUND_FRAC: 0.85,      // altura relativa da imagem onde ficam os pés
  GROUND_Y: 620,             // linha do chão na tela

  // física
  GRAVITY: 2050,
  JUMP_V: 880,

  // velocidades (a mãe é um pouco mais rápida que o filho)
  MOM_SPEED: 330,
  MOM_BACK_SPEED: 240,
  BABY_SPEED: 270,
  BABY_FAR_SLOWDOWN: 0.9,    // alívio quando a mãe fica muito para trás
  BABY_FAR_GAP: 820,

  // escala dos desenhos: escala = UNIDADE / raiz(area do quadro)
  MOM_UNIT: 142,
  KID_UNIT: 89,
  OBST_UNIT: 100,
  PROJ_UNIT: 60,

  // regras
  LIVES: 3,
  CATCH_RANGE: 108,
  MOM_START_X: 170,
  BABY_START_X: 870,
  CAM_OFFSET: 0.26,          // posição da mãe na tela (fração da largura)

  // penalidades
  TRIP_TIME: 0.8,            // tropeço em obstáculo
  HIT_TIME: 0.7,             // atingida por objeto
  HIT_SLOW: 0.25,            // velocidade durante o atordoamento
  INVULN_TIME: 1.5,

  // projéteis
  PROJ_RELEASE_FRAME: 3,     // quadro em que o objeto sai da mão
  PROJ_VX: -390,
  PROJ_VY: -150,
  PROJ_G: 350,
  PROJ_SPIN: 7,
  PROJ_R: 26,                // raio de colisão

  // obstáculos (a distância mínima garante que sempre dá para pular)
  OBST_MIN_GAP: 400,
  OBST_GAP_RAND: 230,
  OBST_START_SAFE: 950,      // nada de obstáculo logo na largada
  OBST_END_SAFE: 320,
  OBST_HIT_W: 0.5,           // caixa de colisão menor que o desenho
  OBST_HIT_H: 0.82,

  // caixa de colisão da mãe (bem menor que o desenho, para ser justo)
  MOM_BODY_W: 74,
  MOM_BODY_H: 200,

  // comportamento do filho
  BABY_ACT_MIN: 1.7,
  BABY_ACT_MAX: 3.0,
  BABY_TRIP_COOLDOWN: 6.5,
  BABY_TRIP_FIRST: 3.5,      // espera antes do primeiro tropeço
  BABY_THROW_RANGE: 760,     // só arremessa se a mãe estiver ao alcance

  // fim de jogo
  CATCH_GRAB_TIME: 0.5,      // "filho-sendo-pego" antes do abraço
  END_HOLD: 0.7,             // respiro antes de mostrar a tela final
};

const ROOM_W = Math.round(CFG.BG_H * CFG.BG_NATIVE_W / CFG.BG_NATIVE_H); // 1800
const ROOMS = [
  { bg: 'cenario-sala', name: 'Sala' },
  { bg: 'cenario-corredor', name: 'Corredor' },
  { bg: 'cenario-quarto-bebe', name: 'Quarto do Bebê' },
];
const WORLD_W = ROOM_W * ROOMS.length;
const FINISH_X = WORLD_W - 260;
const BG_TOP = CFG.GROUND_Y - CFG.BG_H * CFG.BG_GROUND_FRAC;

/* ========================================================================== *
 * 2. ATLAS — recorte real de cada PNG
 *    u = retângulo de referência da sequência (união dos quadros)
 *    f = [x, y, w, h] do corpo em cada quadro (sobras soltas já removidas)
 *    p = raiz quadrada da área desenhada, usada para normalizar o tamanho
 *    Valores medidos direto do canal alfa dos arquivos.
 * ========================================================================== */
const ATLAS = {
  'filho-comemorando-fuga': { n: 5, u: [31,39,322,566], p: 265.3, f: [[39,122,311,480],[88,98,263,506],[70,99,278,506],[68,39,285,480],[31,128,291,472]] },
  'filho-correndo-jogando-brinquedo': { n: 5, u: [0,112,355,477], p: 250.0, f: [[27,112,264,471],[0,116,292,454],[0,125,295,460],[4,130,351,459],[52,129,268,459]] },
  'filho-correndo-jogando-fralda': { n: 5, u: [0,75,393,515], p: 272.1, f: [[30,75,283,509],[0,79,314,490],[0,88,312,498],[0,94,393,496],[39,93,293,497]] },
  'filho-correndo-rindo': { n: 4, u: [0,47,408,579], p: 313.3, f: [[0,50,341,568],[52,48,356,578],[18,47,386,569],[1,52,377,562]] },
  'filho-corrento': { n: 6, u: [7,92,245,438], p: 229.3, f: [[23,110,219,410],[15,96,232,407],[20,92,232,406],[55,125,189,405],[31,108,211,412],[7,109,237,407]] },
  'filho-parado': { n: 4, u: [38,40,326,619], p: 311.1, f: [[112,41,252,618],[94,40,247,619],[66,41,242,618],[38,41,252,618]] },
  'filho-sendo-pego': { n: 5, u: [29,43,366,588], p: 290.9, f: [[29,99,366,532],[31,90,364,539],[43,85,318,545],[50,56,290,502],[64,43,294,514]] },
  'filho-tropecando': { n: 6, u: [25,122,337,463], p: 242.7, f: [[42,124,313,461],[110,139,252,442],[100,212,262,370],[59,207,299,369],[74,216,261,356],[25,122,309,458]] },
  'mae-atingida-por-objeto': { n: 5, u: [14,68,421,535], p: 299.7, f: [[79,81,338,521],[40,68,395,534],[47,74,339,523],[15,76,382,527],[14,83,339,519]] },
  'mae-cansada': { n: 5, u: [0,79,397,540], p: 299.0, f: [[58,79,338,533],[87,107,310,511],[59,86,323,533],[26,221,326,396],[0,205,342,409]] },
  'mae-correndo': { n: 6, u: [0,96,336,493], p: 269.8, f: [[31,104,305,476],[31,96,292,462],[40,117,270,468],[16,105,282,456],[0,127,288,455],[10,123,284,466]] },
  'mae-parada': { n: 4, u: [25,25,390,642], p: 325.8, f: [[127,25,288,642],[96,28,286,639],[52,26,286,641],[25,49,288,618]] },
  'mae-pegando-filho': { n: 5, u: [28,52,407,548], p: 298.6, f: [[28,76,407,484],[143,119,292,457],[108,55,327,542],[102,55,317,545],[58,52,305,548]] },
  'mae-pulando': { n: 5, u: [26,36,377,576], p: 265.5, f: [[107,203,296,400],[51,121,324,447],[52,36,323,416],[26,129,356,448],[43,193,301,419]] },
  'mae-tropecando': { n: 6, u: [0,119,362,465], p: 265.5, f: [[31,119,331,465],[0,124,352,443],[3,144,359,435],[28,241,334,325],[12,216,322,356],[0,121,302,462]] },
  'obstaculo-almofadas': { n: 1, u: [30,30,1138,617], p: 691.9, f: [[30,30,1138,617]] },
  'obstaculo-banquinho': { n: 1, u: [30,30,964,625], p: 638.1, f: [[30,30,964,625]] },
  'obstaculo-brinquedos': { n: 1, u: [30,30,907,395], p: 488.7, f: [[30,30,907,395]] },
  'obstaculo-caixa-papelao': { n: 1, u: [30,30,941,456], p: 555.6, f: [[30,30,941,456]] },
  'obstaculo-cesto-roupas': { n: 1, u: [30,30,944,586], p: 644.5, f: [[30,30,944,586]] },
  'projetil-brinquedo': { n: 1, u: [30,30,466,490], p: 423.6, f: [[30,30,466,490]] },
  'projetil-fralda': { n: 1, u: [30,30,531,418], p: 403.7, f: [[30,30,531,418]] },
};

/* Tabelas de animação: estado -> sequência do ATLAS */
const MOM_ANIMS = {
  idle:  { seq: 'mae-parada', fps: 5, loop: true },
  run:   { seq: 'mae-correndo', fps: 14, loop: true },
  jump:  { seq: 'mae-pulando', fps: 0, loop: false },   // quadro vem do salto
  trip:  { seq: 'mae-tropecando', fps: 7, loop: false },
  hit:   { seq: 'mae-atingida-por-objeto', fps: 6.5, loop: false },
  tired: { seq: 'mae-cansada', fps: 4.5, loop: false },
  catch: { seq: 'mae-pegando-filho', fps: 3.4, loop: false },
};

const BABY_ANIMS = {
  idle:        { seq: 'filho-parado', fps: 5, loop: true },
  run:         { seq: 'filho-corrento', fps: 15, loop: true },
  laugh:       { seq: 'filho-correndo-rindo', fps: 9, loop: true },
  throwToy:    { seq: 'filho-correndo-jogando-brinquedo', fps: 8, loop: false },
  throwDiaper: { seq: 'filho-correndo-jogando-fralda', fps: 8, loop: false },
  trip:        { seq: 'filho-tropecando', fps: 7, loop: false },
  caught:      { seq: 'filho-sendo-pego', fps: 8, loop: false },
  celebrate:   { seq: 'filho-comemorando-fuga', fps: 7, loop: true },
};

const OBSTACLE_KEYS = [
  'obstaculo-brinquedos',
  'obstaculo-cesto-roupas',
  'obstaculo-almofadas',
  'obstaculo-caixa-papelao',
  'obstaculo-banquinho',
];

/* velocidade do filho em cada quadro do tropeço / arremesso */
const BABY_TRIP_SPEED = [0.55, 0.25, 0, 0, 0.15, 0.5];
const BABY_THROW_SPEED = [1, 0.96, 0.92, 0.92, 0.96];
const BABY_LAUGH_SPEED = 0.92;

/* ========================================================================== *
 * utilidades
 * ========================================================================== */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];

/** Nome do arquivo de um quadro. Sequências de 1 imagem não têm sufixo. */
function frameFile(seq, idx) {
  return ATLAS[seq].n === 1 ? seq : seq + '-' + String(idx + 1).padStart(2, '0');
}

/* ========================================================================== *
 * 3. ASSET LOADER — pré-carregamento com progresso e lista de falhas
 * ========================================================================== */
class AssetLoader {
  constructor(basePath) {
    this.base = basePath;
    this.images = Object.create(null);
    this.errors = [];
    this.total = 0;
    this.done = 0;
  }

  /** Monta a lista completa de arquivos a partir do ATLAS e dos cenários. */
  buildList() {
    const files = [];
    for (const room of ROOMS) files.push(room.bg);
    for (const seq of Object.keys(ATLAS)) {
      for (let i = 0; i < ATLAS[seq].n; i++) files.push(frameFile(seq, i));
    }
    return files;
  }

  load(onProgress) {
    const files = this.buildList();
    this.total = files.length;
    return Promise.all(files.map((name) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images[name] = img;
        this.done++;
        onProgress(this.done, this.total);
        resolve();
      };
      img.onerror = () => {
        this.errors.push(this.base + name + '.png');
        this.done++;
        onProgress(this.done, this.total);
        resolve();
      };
      img.src = this.base + name + '.png';
    })));
  }

  get(name) { return this.images[name]; }
}

/* ========================================================================== *
 * 4. FRAME CACHE
 *    Cada quadro é redesenhado uma única vez no tamanho final. Depois disso o
 *    jogo só copia bitmaps 1:1 — bem mais leve no celular e sem serrilhado.
 * ========================================================================== */
const SCALES = Object.create(null);
const FRAMES = Object.create(null);

function registerScales() {
  const reg = (seq, unit, k) => { SCALES[seq] = (unit * (k || 1)) / ATLAS[seq].p; };
  for (const d of Object.values(MOM_ANIMS)) reg(d.seq, CFG.MOM_UNIT, d.k);
  for (const d of Object.values(BABY_ANIMS)) reg(d.seq, CFG.KID_UNIT, d.k);
  for (const key of OBSTACLE_KEYS) reg(key, CFG.OBST_UNIT);
  reg('projetil-brinquedo', CFG.PROJ_UNIT);
  reg('projetil-fralda', CFG.PROJ_UNIT);
}

/**
 * Pré-renderiza todos os quadros.
 * dx/dy guardam a posição do quadro em relação à âncora da sequência
 * (centro horizontal + base do retângulo de referência), então os pés ficam
 * sempre no chão e não há tremidas entre quadros.
 */
function buildFrameCache(assets) {
  for (const seq of Object.keys(SCALES)) {
    const a = ATLAS[seq];
    const s = SCALES[seq];
    const anchorX = a.u[0] + a.u[2] / 2;
    const anchorY = a.u[1] + a.u[3];
    const list = [];
    for (let i = 0; i < a.n; i++) {
      const f = a.f[i];
      const img = assets.get(frameFile(seq, i));
      const w = Math.max(1, Math.round(f[2] * s));
      const h = Math.max(1, Math.round(f[3] * s));
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      if (img) c.drawImage(img, f[0], f[1], f[2], f[3], 0, 0, w, h);
      list.push({ c: cv, dx: (f[0] - anchorX) * s, dy: (f[1] - anchorY) * s, w, h });
    }
    FRAMES[seq] = list;
  }
}

/** Desenha um quadro ancorado pelo centro inferior (pés no chão). */
function drawFrame(ctx, seq, idx, x, y, flip) {
  const fr = FRAMES[seq][idx];
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(fr.c, fr.dx, fr.dy, fr.w, fr.h);
  ctx.restore();
}

/** Desenha um quadro centralizado e girado (usado nos projéteis). */
function drawFrameSpun(ctx, seq, x, y, angle) {
  const fr = FRAMES[seq][0];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(fr.c, -fr.w / 2, -fr.h / 2, fr.w, fr.h);
  ctx.restore();
}

/* ========================================================================== *
 * 5. ANIMATION — controla o quadro atual de uma sequência
 * ========================================================================== */
class Animation {
  constructor(table) {
    this.table = table;
    this.state = null;
    this.t = 0;
    this.frame = 0;
    this.finished = false;
  }

  play(state, restart) {
    if (this.state === state && !restart) return;
    this.state = state;
    this.t = 0;
    this.frame = 0;
    this.finished = false;
  }

  get def() { return this.table[this.state]; }

  update(dt) {
    const d = this.def;
    if (!d || d.fps <= 0) return;
    const n = ATLAS[d.seq].n;
    this.t += dt;
    const i = Math.floor(this.t * d.fps);
    if (d.loop) {
      this.frame = i % n;
    } else if (i >= n) {
      this.frame = n - 1;
      this.finished = true;
    } else {
      this.frame = i;
    }
  }

  draw(ctx, x, y, flip) {
    const d = this.def;
    if (!d) return;
    drawFrame(ctx, d.seq, this.frame, x, y, flip);
  }
}

/* ========================================================================== *
 * 6. ENTIDADES
 * ========================================================================== */

class Obstacle {
  constructor(x, key) {
    this.x = x;
    this.key = key;
    const fr = FRAMES[key][0];
    this.w = fr.w;
    this.h = fr.h;
    this.used = false;                 // cada bagunça derruba a mãe uma só vez
  }
  get topY() { return CFG.GROUND_Y - this.h * CFG.OBST_HIT_H; }
  get halfW() { return this.w * CFG.OBST_HIT_W / 2; }

  draw(ctx) { drawFrame(ctx, this.key, 0, this.x, CFG.GROUND_Y, false); }
}

class Projectile {
  constructor(x, y, key) {
    this.x = x;
    this.y = y;
    this.vx = CFG.PROJ_VX;
    this.vy = CFG.PROJ_VY;
    this.key = key;
    this.angle = 0;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += CFG.PROJ_G * dt;
    this.angle -= CFG.PROJ_SPIN * dt;
    if (this.y > CFG.GROUND_Y + 40 || this.x < -200) this.dead = true;
  }
  draw(ctx) { drawFrameSpun(ctx, this.key, this.x, this.y, this.angle); }
}

/** A mãe. */
class Player {
  constructor() { this.reset(); }

  reset() {
    this.x = CFG.MOM_START_X;
    this.y = CFG.GROUND_Y;      // y = altura dos pés
    this.vy = 0;
    this.onGround = true;
    this.facing = 1;
    this.lives = CFG.LIVES;
    this.stun = 0;              // tempo restante de tropeço/atordoamento
    this.stunType = null;       // 'trip' | 'hit'
    this.invuln = 0;
    this.jumpT = 0;
    this.anim = new Animation(MOM_ANIMS);
    this.anim.play('idle');
    this.frozen = false;        // durante as animações de final
  }

  get airHeight() { return CFG.GROUND_Y - this.y; }

  /** Caixa de colisão bem menor que o desenho, para não parecer injusto. */
  get body() {
    return {
      x: this.x - CFG.MOM_BODY_W / 2,
      y: this.y - CFG.MOM_BODY_H,
      w: CFG.MOM_BODY_W,
      h: CFG.MOM_BODY_H,
    };
  }

  hurt(type) {
    if (this.invuln > 0) return false;
    this.lives = Math.max(0, this.lives - 1);
    this.stun = type === 'trip' ? CFG.TRIP_TIME : CFG.HIT_TIME;
    this.stunType = type;
    this.invuln = CFG.INVULN_TIME;
    this.anim.play(type, true);
    // um tropeço interrompe o pulo
    if (type === 'trip') { this.y = CFG.GROUND_Y; this.vy = 0; this.onGround = true; }
    return true;
  }

  update(dt, input) {
    if (this.invuln > 0) this.invuln -= dt;

    if (this.frozen) { this.anim.update(dt); return; }

    if (this.stun > 0) {
      this.stun -= dt;
      // tropeço trava a corrida; objeto na cabeça só atrasa
      const drift = this.stunType === 'hit' ? CFG.MOM_SPEED * CFG.HIT_SLOW : 0;
      this.x += drift * dt;
      this.applyGravity(dt);
      this.anim.update(dt);
      if (this.stun <= 0) { this.stunType = null; this.anim.play('idle'); }
      return;
    }

    // ------- movimento -------
    let vx = 0;
    if (input.right) { vx = CFG.MOM_SPEED; this.facing = 1; }
    else if (input.left) { vx = -CFG.MOM_BACK_SPEED; this.facing = -1; }
    this.x += vx * dt;

    if (input.consumeJump() && this.onGround) {
      this.vy = -CFG.JUMP_V;
      this.onGround = false;
      this.jumpT = 0;
    }
    this.applyGravity(dt);

    // ------- animação -------
    if (!this.onGround) {
      this.jumpT += dt;
      this.anim.play('jump');
      const airTime = (2 * CFG.JUMP_V) / CFG.GRAVITY;
      const n = ATLAS[MOM_ANIMS.jump.seq].n;
      this.anim.frame = clamp(Math.floor((this.jumpT / airTime) * n), 0, n - 1);
    } else if (vx !== 0) {
      this.anim.play('run');
    } else {
      this.anim.play('idle');
    }
    this.anim.update(dt);
  }

  applyGravity(dt) {
    if (!this.onGround) {
      this.vy += CFG.GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y >= CFG.GROUND_Y) { this.y = CFG.GROUND_Y; this.vy = 0; this.onGround = true; }
    }
  }

  draw(ctx) {
    // pisca durante a invulnerabilidade
    if (this.invuln > 0 && this.stun <= 0 && Math.floor(this.invuln * 12) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }
    this.anim.draw(ctx, this.x, this.y, this.facing < 0);
    ctx.globalAlpha = 1;
  }
}

/** O filho. Corre sozinho e apronta pelo caminho. */
class Baby {
  constructor(game) { this.game = game; this.reset(); }

  reset() {
    this.x = CFG.BABY_START_X;
    this.y = CFG.GROUND_Y;
    this.state = 'run';
    this.timer = rand(CFG.BABY_ACT_MIN, CFG.BABY_ACT_MAX);
    this.tripCooldown = CFG.BABY_TRIP_FIRST;
    this.released = false;
    this.anim = new Animation(BABY_ANIMS);
    this.anim.play('run');
    this.frozen = false;
    this.hidden = false;
  }

  /** Fator de velocidade conforme o que ele está fazendo agora. */
  speedFactor() {
    const f = this.anim.frame;
    switch (this.state) {
      case 'trip': return BABY_TRIP_SPEED[Math.min(f, BABY_TRIP_SPEED.length - 1)];
      case 'throwToy':
      case 'throwDiaper': return BABY_THROW_SPEED[Math.min(f, BABY_THROW_SPEED.length - 1)];
      case 'laugh': return BABY_LAUGH_SPEED;
      case 'run': return 1;
      default: return 0;
    }
  }

  startAction(momGap) {
    const roll = Math.random();
    if (this.tripCooldown <= 0 && roll < 0.15) {
      // tropeço raro: é a chance de ouro da mãe
      this.state = 'trip';
      this.tripCooldown = CFG.BABY_TRIP_COOLDOWN;
    } else if (roll < 0.55 && momGap < CFG.BABY_THROW_RANGE) {
      this.state = Math.random() < 0.5 ? 'throwToy' : 'throwDiaper';
      this.released = false;
    } else {
      this.state = 'laugh';
      this.timer = rand(0.9, 1.5);
    }
    this.anim.play(this.state, true);
  }

  update(dt, momX) {
    if (this.frozen) { this.anim.update(dt); return; }

    if (this.tripCooldown > 0) this.tripCooldown -= dt;
    const gap = this.x - momX;

    // avança
    let speed = CFG.BABY_SPEED * this.speedFactor();
    if (gap > CFG.BABY_FAR_GAP) speed *= CFG.BABY_FAR_SLOWDOWN;
    this.x += speed * dt;

    this.anim.update(dt);

    // solta o objeto no quadro certo do arremesso
    if ((this.state === 'throwToy' || this.state === 'throwDiaper') &&
        !this.released && this.anim.frame >= CFG.PROJ_RELEASE_FRAME) {
      this.released = true;
      const key = this.state === 'throwToy' ? 'projetil-brinquedo' : 'projetil-fralda';
      this.game.projectiles.push(new Projectile(this.x - 30, CFG.GROUND_Y - 120, key));
    }

    // troca de comportamento
    if (this.state === 'run') {
      this.timer -= dt;
      if (this.timer <= 0) { this.startAction(gap); }
    } else if (this.state === 'laugh') {
      this.timer -= dt;
      if (this.timer <= 0) this.backToRun();
    } else if (this.anim.finished) {
      this.backToRun();
    }
  }

  backToRun() {
    this.state = 'run';
    this.anim.play('run', true);
    this.timer = rand(CFG.BABY_ACT_MIN, CFG.BABY_ACT_MAX);
  }

  draw(ctx) {
    if (this.hidden) return;
    this.anim.draw(ctx, this.x, this.y, false);
  }
}

/* ========================================================================== *
 * 7. INPUT — teclado e botões de toque
 * ========================================================================== */
class Input {
  constructor(game) {
    this.game = game;
    this.left = false;
    this.right = false;
    this.jumpQueued = false;
    this.catchQueued = false;
    this.touchUsed = false;
    this.bind();
  }

  reset() {
    this.left = this.right = false;
    this.jumpQueued = this.catchQueued = false;
    document.querySelectorAll('.tbtn.on').forEach((b) => b.classList.remove('on'));
  }

  consumeJump() { const v = this.jumpQueued; this.jumpQueued = false; return v; }
  consumeCatch() { const v = this.catchQueued; this.catchQueued = false; return v; }

  bind() {
    const KEYS_LEFT = ['ArrowLeft', 'a', 'A'];
    const KEYS_RIGHT = ['ArrowRight', 'd', 'D'];
    const KEYS_JUMP = [' ', 'Spacebar', 'ArrowUp', 'w', 'W'];
    const KEYS_CATCH = ['e', 'E', 'Enter'];
    const KEYS_PAUSE = ['p', 'P', 'Escape'];
    const ALL = [].concat(KEYS_LEFT, KEYS_RIGHT, KEYS_JUMP, KEYS_CATCH, KEYS_PAUSE);

    window.addEventListener('keydown', (e) => {
      if (ALL.indexOf(e.key) !== -1) e.preventDefault();
      if (e.repeat) return;
      if (KEYS_LEFT.indexOf(e.key) !== -1) this.left = true;
      else if (KEYS_RIGHT.indexOf(e.key) !== -1) this.right = true;
      else if (KEYS_JUMP.indexOf(e.key) !== -1) this.jumpQueued = true;
      else if (KEYS_CATCH.indexOf(e.key) !== -1) this.catchQueued = true;
      else if (KEYS_PAUSE.indexOf(e.key) !== -1) this.game.togglePause();
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      if (KEYS_LEFT.indexOf(e.key) !== -1) this.left = false;
      else if (KEYS_RIGHT.indexOf(e.key) !== -1) this.right = false;
    });

    // ------- botões de toque -------
    document.querySelectorAll('.tbtn').forEach((btn) => {
      const act = btn.dataset.act;
      const press = (e) => {
        e.preventDefault();
        this.showTouch();
        btn.classList.add('on');
        if (act === 'left') this.left = true;
        else if (act === 'right') this.right = true;
        else if (act === 'jump') this.jumpQueued = true;
        else if (act === 'catch') this.catchQueued = true;
      };
      const release = (e) => {
        e.preventDefault();
        btn.classList.remove('on');
        if (act === 'left') this.left = false;
        else if (act === 'right') this.right = false;
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    // impede que o toque role ou dê zoom na página
    // (mas deixa rolar dentro dos painéis de texto, que podem ser altos)
    document.addEventListener('touchmove', (e) => {
      if (!(e.target instanceof Element) || !e.target.closest('.panel')) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    window.addEventListener('touchstart', () => this.showTouch(), { passive: true });
  }

  showTouch() {
    if (this.touchUsed) return;
    this.touchUsed = true;
    const t = document.getElementById('touch');
    t.classList.remove('auto');   // força a exibição depois de um toque real
  }
}

/* ========================================================================== *
 * 8. CÂMERA
 * ========================================================================== */
class Camera {
  constructor() { this.x = 0; this.locked = false; }
  reset() { this.x = 0; this.locked = false; }
  follow(targetX) {
    if (this.locked) return;
    this.x = clamp(targetX - CFG.VIEW_W * CFG.CAM_OFFSET, 0, WORLD_W - CFG.VIEW_W);
  }
}

/* ========================================================================== *
 * 9. GAME
 * ========================================================================== */
const STATE = {
  LOADING: 'loading',
  ERROR: 'error',
  MENU: 'menu',
  PLAY: 'play',
  PAUSE: 'pause',
  END_CATCH: 'endCatch',     // a mãe pegou
  END_TIRED: 'endTired',     // acabaram as vidas
  END_ESCAPE: 'endEscape',   // o filho chegou ao quarto
};

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.assets = new AssetLoader('img/');
    this.player = null;
    this.baby = null;
    this.camera = new Camera();
    this.obstacles = [];
    this.projectiles = [];
    this.state = STATE.LOADING;
    this.last = 0;
    this.time = 0;
    this.endTimer = 0;
    this.endPhase = 0;
    this.inRange = false;
    this.hud = {
      hearts: document.getElementById('hearts'),
      room: document.getElementById('roomName'),
      fill: document.getElementById('progressFill'),
      mom: document.getElementById('markerMom'),
      baby: document.getElementById('markerBaby'),
      catchBtn: document.getElementById('btnCatch'),
    };
    this.hudCache = { lives: -1, room: -1, ready: null };
    this.setupUI();
    this.setupCanvas();
  }

  /* ---------------- inicialização ---------------- */

  setupCanvas() {
    const resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      // tudo é desenhado em coordenadas lógicas 1280x720
      this.scale = w / CFG.VIEW_W;
      this.checkOrientation();
    };
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 120));
    // pega também mudanças de layout sem evento de resize
    // (barra de endereço do celular abrindo/fechando, por exemplo)
    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(document.getElementById('stage'));
    }
    this.resize = resize;
    resize();
  }

  checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const show = portrait && touch;
    document.getElementById('rotate').classList.toggle('hidden', !show);
    if (show && this.state === STATE.PLAY) this.togglePause();
  }

  setupUI() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      el.addEventListener('click', fn);
    };
    on('btnPlay', () => this.start());
    on('btnAgainWin', () => this.start());
    on('btnAgainLose', () => this.start());
    on('btnPause', () => this.togglePause());
    on('btnResume', () => this.togglePause());
    on('btnQuit', () => this.toMenu());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === STATE.PLAY) this.togglePause();
    });
    window.addEventListener('blur', () => {
      if (this.state === STATE.PLAY) this.togglePause();
    });

    this.input = new Input(this);
  }

  showScreen(id) {
    ['scLoading', 'scError', 'scStart', 'scPause', 'scWin', 'scLose']
      .forEach((s) => document.getElementById(s).classList.toggle('hidden', s !== id));
  }

  async boot() {
    const fill = document.getElementById('loadFill');
    const txt = document.getElementById('loadTxt');
    await this.assets.load((done, total) => {
      const pct = Math.round((done / total) * 100);
      fill.style.width = pct + '%';
      txt.textContent = pct + '%';
    });

    if (this.assets.errors.length) {
      this.state = STATE.ERROR;
      const ul = document.getElementById('errList');
      ul.textContent = '';
      this.assets.errors.forEach((f) => {
        const li = document.createElement('li');
        li.textContent = f;
        ul.appendChild(li);
      });
      this.showScreen('scError');
      return;
    }

    registerScales();
    buildFrameCache(this.assets);

    this.player = new Player();
    this.baby = new Baby(this);
    this.buildLevel();

    this.state = STATE.MENU;
    this.baby.anim.play('idle');   // os dois esperando na sala, atrás do título
    this.showScreen('scStart');
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ---------------- nível ---------------- */

  buildLevel() {
    this.obstacles = [];
    let x = CFG.OBST_START_SAFE + rand(0, 200);
    while (x < FINISH_X - CFG.OBST_END_SAFE) {
      this.obstacles.push(new Obstacle(x, pick(OBSTACLE_KEYS)));
      x += CFG.OBST_MIN_GAP + rand(0, CFG.OBST_GAP_RAND);
    }
  }

  /* ---------------- controle de estados ---------------- */

  start() {
    this.player.reset();
    this.baby.reset();
    this.camera.reset();
    this.projectiles = [];
    this.buildLevel();
    this.input.reset();
    this.endTimer = 0;
    this.endPhase = 0;
    this.hudCache = { lives: -1, room: -1, ready: null };
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('touch').classList.remove('hidden');
    if (!this.input.touchUsed) document.getElementById('touch').classList.add('auto');
    this.showScreen(null);
    this.state = STATE.PLAY;
    this.last = performance.now();
  }

  toMenu() {
    this.state = STATE.MENU;
    this.player.reset();
    this.baby.reset();
    this.baby.anim.play('idle');
    this.camera.reset();
    this.projectiles = [];
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('touch').classList.add('hidden');
    this.showScreen('scStart');
  }

  togglePause() {
    if (this.state === STATE.PLAY) {
      this.state = STATE.PAUSE;
      this.input.reset();
      this.showScreen('scPause');
    } else if (this.state === STATE.PAUSE) {
      this.state = STATE.PLAY;
      this.showScreen(null);
      this.last = performance.now();
    }
  }

  /** Última atualização do HUD antes de congelar a partida. */
  freezeHud() {
    this.inRange = false;
    this.updateHud();
  }

  endCatch() {
    this.freezeHud();
    this.state = STATE.END_CATCH;
    this.endPhase = 0;
    this.endTimer = CFG.CATCH_GRAB_TIME;
    this.camera.locked = true;
    this.player.frozen = true;
    this.player.anim.play('idle', true);
    this.baby.frozen = true;
    this.baby.anim.play('caught', true);
    this.input.reset();
  }

  endTired() {
    this.freezeHud();
    this.state = STATE.END_TIRED;
    this.endTimer = 2.4;
    this.player.frozen = true;
    this.player.stun = 0;
    this.player.anim.play('tired', true);
    this.input.reset();
  }

  endEscape() {
    this.freezeHud();
    this.state = STATE.END_ESCAPE;
    this.endTimer = 2.2;
    this.baby.frozen = true;
    this.baby.anim.play('celebrate', true);
    this.player.frozen = true;
    this.player.anim.play('idle', true);
    this.camera.locked = true;
    this.input.reset();
  }

  showWin() {
    document.getElementById('winTxt').textContent =
      'A mãe pegou o bebê no colo bem antes do quarto. Agora sim: fralda limpa!';
    this.showScreen('scWin');
  }

  showLose(reason) {
    document.getElementById('loseTitle').textContent =
      reason === 'tired' ? 'A mãe cansou!' : 'O bebê escapou!';
    document.getElementById('loseTxt').textContent =
      reason === 'tired'
        ? 'Foram tropeços demais pela casa e o fôlego acabou. O bebê seguiu solto por aí!'
        : 'Ele chegou no quarto rindo à toa e ainda comemorou. Bora tentar de novo?';
    this.showScreen('scLose');
  }

  /* ---------------- laço principal ---------------- */

  loop(now) {
    const dt = Math.min((now - this.last) / 1000, CFG.MAX_DT);
    this.last = now;
    if (dt > 0) this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.time += dt;
    switch (this.state) {
      case STATE.PLAY: this.updatePlay(dt); break;
      case STATE.END_CATCH: this.updateEndCatch(dt); break;
      case STATE.END_TIRED:
      case STATE.END_ESCAPE: this.updateEndSimple(dt); break;
      case STATE.MENU:
        // personagens paradinhos no menu
        this.player.anim.update(dt);
        this.baby.anim.update(dt);
        break;
      default: break;
    }
  }

  updatePlay(dt) {
    const p = this.player;
    const b = this.baby;

    p.update(dt, this.input);
    b.update(dt, p.x);

    // limites do mundo: a mãe não ultrapassa o filho
    p.x = clamp(p.x, 40, Math.min(FINISH_X, b.x + 30));
    b.x = Math.min(b.x, FINISH_X);

    // ------- obstáculos -------
    for (const o of this.obstacles) {
      if (o.used) continue;
      if (Math.abs(o.x - p.x) > 220) continue;
      const body = p.body;
      const overlapX = body.x < o.x + o.halfW && body.x + body.w > o.x - o.halfW;
      const cleared = p.y < o.topY;          // pés acima da bagunça = passou por cima
      if (overlapX && !cleared) {
        o.used = true;
        if (p.hurt('trip') && p.lives <= 0) { this.endTired(); return; }
      }
    }

    // ------- projéteis -------
    for (const pr of this.projectiles) {
      pr.update(dt);
      if (pr.dead) continue;
      const body = p.body;
      const cx = clamp(pr.x, body.x, body.x + body.w);
      const cy = clamp(pr.y, body.y, body.y + body.h);
      const dx = pr.x - cx, dy = pr.y - cy;
      if (dx * dx + dy * dy < CFG.PROJ_R * CFG.PROJ_R) {
        if (p.hurt('hit')) {
          pr.dead = true;
          if (p.lives <= 0) { this.endTired(); return; }
        }
      }
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);

    // ------- pegar -------
    this.inRange = Math.abs(b.x - p.x) <= CFG.CATCH_RANGE && p.stun <= 0;
    if (this.input.consumeCatch() && this.inRange) { this.endCatch(); return; }

    // ------- o filho chegou ao quarto? -------
    if (b.x >= FINISH_X - 1) { this.endEscape(); return; }

    this.camera.follow(p.x);
    this.updateHud();
  }

  updateEndCatch(dt) {
    this.player.anim.update(dt);
    this.baby.anim.update(dt);
    this.endTimer -= dt;
    if (this.endPhase === 0 && this.endTimer <= 0) {
      // abraço final: a animação já traz mãe e filho juntos
      this.endPhase = 1;
      this.baby.hidden = true;
      this.player.anim.play('catch', true);
      this.endTimer = 99;
    } else if (this.endPhase === 1 && this.player.anim.finished) {
      this.endPhase = 2;
      this.endTimer = CFG.END_HOLD;
    } else if (this.endPhase === 2 && this.endTimer <= 0) {
      this.endPhase = 3;
      this.showWin();
    }
  }

  updateEndSimple(dt) {
    this.player.anim.update(dt);
    if (this.state === STATE.END_TIRED) {
      // o bebê continua fugindo enquanto a mãe recupera o fôlego
      this.baby.update(dt, this.player.x);
      this.baby.x = Math.min(this.baby.x, FINISH_X);
      this.camera.follow(this.player.x);
    } else {
      this.baby.anim.update(dt);
    }
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        this.showLose(this.state === STATE.END_TIRED ? 'tired' : 'escape');
      }
    }
  }

  /* ---------------- HUD ---------------- */

  updateHud() {
    const h = this.hud;
    if (this.hudCache.lives !== this.player.lives) {
      this.hudCache.lives = this.player.lives;
      h.hearts.textContent = '';
      for (let i = 0; i < CFG.LIVES; i++) {
        const s = document.createElement('span');
        s.className = 'heart' + (i < this.player.lives ? '' : ' off');
        s.textContent = '♥';
        h.hearts.appendChild(s);
      }
    }

    const room = clamp(Math.floor(this.player.x / ROOM_W), 0, ROOMS.length - 1);
    if (this.hudCache.room !== room) {
      this.hudCache.room = room;
      h.room.textContent = ROOMS[room].name;
    }

    const pm = clamp(this.player.x / FINISH_X, 0, 1);
    const pb = clamp(this.baby.x / FINISH_X, 0, 1);
    h.fill.style.width = (pm * 100).toFixed(1) + '%';
    h.mom.style.left = (pm * 100).toFixed(1) + '%';
    h.baby.style.left = (pb * 100).toFixed(1) + '%';

    if (this.hudCache.ready !== this.inRange) {
      this.hudCache.ready = this.inRange;
      h.catchBtn.classList.toggle('ready', this.inRange);
    }
  }

  /* ---------------- desenho ---------------- */

  render() {
    const ctx = this.ctx;
    if (this.state === STATE.LOADING || this.state === STATE.ERROR) return;

    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);

    const cam = this.camera.x;
    this.drawBackground(ctx, cam);

    ctx.save();
    ctx.translate(-cam, 0);

    for (const o of this.obstacles) {
      if (o.x + o.w < cam - 50 || o.x - o.w > cam + CFG.VIEW_W + 50) continue;
      o.draw(ctx);
    }

    this.drawFinishLine(ctx);

    // sombras simples no chão dão peso aos personagens
    this.drawShadow(ctx, this.baby.x, this.baby.y, 46, this.baby.hidden);
    this.drawShadow(ctx, this.player.x, this.player.y, 62, false);

    // o filho fica na frente enquanto foge
    this.player.draw(ctx);
    this.baby.draw(ctx);

    for (const pr of this.projectiles) pr.draw(ctx);

    if (this.state === STATE.PLAY && this.inRange) this.drawCatchHint(ctx);

    ctx.restore();
  }

  drawBackground(ctx, cam) {
    for (let i = 0; i < ROOMS.length; i++) {
      const sx = i * ROOM_W - cam;
      if (sx > CFG.VIEW_W || sx + ROOM_W < 0) continue;
      const img = this.assets.get(ROOMS[i].bg);
      if (img) ctx.drawImage(img, sx, BG_TOP, ROOM_W, CFG.BG_H);
      // sombra suave na emenda entre cômodos
      if (i > 0) {
        const g = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, 'rgba(0,0,0,0.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - 60, 0, 120, CFG.VIEW_H);
      }
    }
  }

  drawFinishLine(ctx) {
    const x = FINISH_X;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x - 5, CFG.GROUND_Y - 240, 10, 240);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#e63946';
    ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TROCADOR', x, CFG.GROUND_Y - 252);
    ctx.restore();
  }

  drawShadow(ctx, x, y, r, hidden) {
    if (hidden) return;
    const squash = clamp(1 - (CFG.GROUND_Y - y) / 260, 0.45, 1);
    ctx.save();
    ctx.globalAlpha = 0.28 * squash;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, CFG.GROUND_Y + 4, r * squash, r * 0.28 * squash, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Seta pulsante sobre o filho quando ele está ao alcance. */
  drawCatchHint(ctx) {
    const b = this.baby;
    const bob = Math.sin(this.time * 9) * 8;
    const y = b.y - 205 + bob;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#7a3b00';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(b.x, y + 34);
    ctx.lineTo(b.x - 20, y + 6);
    ctx.lineTo(b.x + 20, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeText('PEGA!', b.x, y - 6);
    ctx.fillText('PEGA!', b.x, y - 6);
    ctx.restore();
  }
}

/* ========================================================================== *
 * arranca
 * ========================================================================== */
const game = new Game();
game.boot();
