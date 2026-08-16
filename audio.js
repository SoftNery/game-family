/* ============================================================================
   ÁUDIO — todos os sons são gerados na hora pela Web Audio API.
   Nenhum arquivo, nenhum download, nenhuma biblioteca.

   Osciladores + ruído + envelopes de ganho. A "risada" do bebê é um efeito
   travesso de propósito: síntese simples não imita voz humana sem soar
   robótica, então ela é um motivo saltitante em vez de uma voz.
   ========================================================================== */
'use strict';

const AUDIO_CFG = {
  MASTER: 0.5,
  SFX: 0.9,
  MUSIC: 0.22,
  BPM: 132,
  STORE_KEY: 'pegaobebe.mudo',
};

/** Semitons a partir de dó, por passo de colcheia. null = silêncio. */
const MELODIA = [
  0, null, 4, 7, null, 4, 0, null,
  2, null, 5, 9, null, 5, 2, null,
  4, null, 7, 12, null, 7, 4, null,
  2, null, 7, 5, 4, 2, 0, null,
];
/** Baixo: um por semínima (a cada 2 passos). */
const BAIXO = [0, 0, 0, 0, 7, 7, 7, 7, 9, 9, 9, 9, 5, 5, 5, 5];

const C4 = 261.63;
const nota = (semitons, oitava) => C4 * Math.pow(2, semitons / 12 + (oitava || 0));

class AudioKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noiseBuf = null;
    this.musicTimer = null;
    this.passo = 0;
    this.proximoTempo = 0;
    this.tocandoMusica = false;
    this.muted = this.lerPreferencia();
    this.pronto = false;
  }

  /* ---------------- preferência de mudo ---------------- */

  lerPreferencia() {
    try { return localStorage.getItem(AUDIO_CFG.STORE_KEY) === '1'; }
    catch (e) { return false; }   // localStorage pode estar bloqueado em file://
  }

  salvarPreferencia() {
    try { localStorage.setItem(AUDIO_CFG.STORE_KEY, this.muted ? '1' : '0'); }
    catch (e) { /* sem persistência, tudo bem */ }
  }

  /* ---------------- ciclo de vida ---------------- */

  /**
   * O navegador só deixa criar/rodar áudio depois de um gesto do usuário.
   * Chamado no primeiro clique, toque ou tecla.
   */
  unlock() {
    if (this.pronto) { this.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;                       // navegador sem Web Audio: jogo segue mudo
    try {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : AUDIO_CFG.MASTER;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = AUDIO_CFG.SFX;
      this.sfxBus.connect(this.master);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = AUDIO_CFG.MUSIC;
      this.musicBus.connect(this.master);

      this.noiseBuf = this.criarRuido(1);
      this.pronto = true;
    } catch (e) {
      this.pronto = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(v) {
    this.muted = v;
    this.salvarPreferencia();
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(v ? 0 : AUDIO_CFG.MASTER, t, 0.03);
    }
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  /* ---------------- blocos de síntese ---------------- */

  criarRuido(segundos) {
    const n = Math.floor(this.ctx.sampleRate * segundos);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Uma nota com varredura de frequência e envelope de decaimento. */
  tom(o) {
    if (!this.pronto) return;
    const t0 = this.ctx.currentTime + (o.atraso || 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = o.tipo || 'triangle';
    osc.frequency.setValueAtTime(o.de, t0);
    if (o.para && o.para !== o.de) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.para), t0 + o.dur);
    }
    const pico = o.ganho == null ? 0.3 : o.ganho;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(pico, t0 + Math.min(0.02, o.dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g).connect(o.bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  /** Rajada de ruído filtrado — batidas, pancadas, sopros. */
  ruido(o) {
    if (!this.pronto) return;
    const t0 = this.ctx.currentTime + (o.atraso || 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = o.tipoFiltro || 'lowpass';
    filtro.frequency.setValueAtTime(o.filtroDe || 1200, t0);
    if (o.filtroPara) {
      filtro.frequency.exponentialRampToValueAtTime(Math.max(40, o.filtroPara), t0 + o.dur);
    }
    filtro.Q.value = o.q || 1;
    const g = this.ctx.createGain();
    const pico = o.ganho == null ? 0.25 : o.ganho;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(pico, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(filtro).connect(g).connect(o.bus || this.sfxBus);
    src.start(t0);
    src.stop(t0 + o.dur + 0.02);
  }

  /* ---------------- efeitos do jogo ---------------- */

  pulo() {
    this.tom({ tipo: 'triangle', de: 300, para: 720, dur: 0.16, ganho: 0.26 });
  }

  aterrissar() {
    this.ruido({ dur: 0.09, filtroDe: 500, filtroPara: 120, ganho: 0.14 });
  }

  /** Tropeço da mãe: "wah-womp" descendente + baque. */
  tropeco() {
    this.ruido({ dur: 0.16, filtroDe: 900, filtroPara: 100, ganho: 0.3 });
    this.tom({ tipo: 'sawtooth', de: 420, para: 90, dur: 0.38, ganho: 0.22 });
    this.tom({ tipo: 'sine', de: 200, para: 60, dur: 0.3, ganho: 0.2, atraso: 0.05 });
  }

  /** Objeto na cabeça: pancada de desenho animado. */
  pancada() {
    this.tom({ tipo: 'square', de: 780, para: 180, dur: 0.13, ganho: 0.26 });
    this.ruido({ dur: 0.12, filtroDe: 2600, filtroPara: 400, ganho: 0.2 });
    this.tom({ tipo: 'sine', de: 150, para: 70, dur: 0.22, ganho: 0.2, atraso: 0.04 });
  }

  /** Arremesso: sopro curto. */
  arremesso() {
    this.ruido({ dur: 0.2, tipoFiltro: 'bandpass', filtroDe: 1800, filtroPara: 500, q: 2.5, ganho: 0.16 });
  }

  /** Molecagem do bebê: motivo saltitante, não é voz. */
  molecagem() {
    const p = [7, 12, 9, 14];
    p.forEach((s, i) => this.tom({
      tipo: 'triangle', de: nota(s, 1), para: nota(s + 2, 1),
      dur: 0.1, ganho: 0.17, atraso: i * 0.085,
    }));
  }

  /** Bebê tropeçando: escorregada cômica. */
  tropecoBebe() {
    this.tom({ tipo: 'square', de: nota(12, 1), para: nota(0, 0), dur: 0.34, ganho: 0.16 });
    this.ruido({ dur: 0.12, filtroDe: 700, filtroPara: 150, ganho: 0.14, atraso: 0.28 });
  }

  /** Bebê ao alcance: dois toques brilhantes de aviso. */
  aoAlcance() {
    this.tom({ tipo: 'sine', de: nota(7, 1), dur: 0.1, ganho: 0.2 });
    this.tom({ tipo: 'sine', de: nota(12, 1), dur: 0.14, ganho: 0.2, atraso: 0.09 });
  }

  /** Segurou o bebê, mas ainda não é a vitória: toque curto de conquista. */
  pegadaParcial() {
    this.tom({ tipo: 'triangle', de: nota(4, 1), dur: 0.14, ganho: 0.26 });
    this.tom({ tipo: 'triangle', de: nota(9, 1), dur: 0.2, ganho: 0.26, atraso: 0.1 });
  }

  /** Ele se soltou e disparou: escorregada + risadinha de escape. */
  fuga() {
    this.ruido({ dur: 0.22, tipoFiltro: 'bandpass', filtroDe: 900, filtroPara: 2600, q: 3, ganho: 0.18 });
    [12, 14, 16].forEach((s, i) => this.tom({
      tipo: 'square', de: nota(s, 1), para: nota(s + 3, 1),
      dur: 0.09, ganho: 0.14, atraso: 0.1 + i * 0.07,
    }));
  }

  /** Pegou! Fanfarra maior ascendente. */
  vitoria() {
    [0, 4, 7, 12, 16].forEach((s, i) => this.tom({
      tipo: 'triangle', de: nota(s, 1), dur: 0.3, ganho: 0.26, atraso: i * 0.11,
    }));
    this.tom({ tipo: 'sine', de: nota(0, 0), dur: 0.7, ganho: 0.18, atraso: 0.44 });
  }

  /** Derrota: arpejo menor descendente, sem drama. */
  derrota() {
    [12, 8, 5, 0].forEach((s, i) => this.tom({
      tipo: 'triangle', de: nota(s, 0), dur: 0.34, ganho: 0.22, atraso: i * 0.16,
    }));
  }

  /* ---------------- música de fundo ---------------- */

  /**
   * Agendador com antecedência: setInterval só decide o que tocar,
   * quem marca o tempo é o relógio do próprio AudioContext.
   */
  iniciarMusica() {
    if (!this.pronto || this.tocandoMusica) return;
    this.tocandoMusica = true;
    this.passo = 0;
    this.proximoTempo = this.ctx.currentTime + 0.06;
    this.musicTimer = setInterval(() => this.agendar(), 25);
  }

  pararMusica() {
    this.tocandoMusica = false;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  agendar() {
    if (!this.tocandoMusica || !this.ctx) return;
    const dur = 30 / AUDIO_CFG.BPM;           // uma colcheia
    // se o relógio pulou (aba estrangulada, retomada tardia), reancora:
    // sem isso o laço agendaria dezenas de notas atrasadas de uma vez só
    if (this.proximoTempo < this.ctx.currentTime - 0.2) {
      this.proximoTempo = this.ctx.currentTime + 0.05;
    }
    while (this.proximoTempo < this.ctx.currentTime + 0.15) {
      this.tocarPasso(this.passo, this.proximoTempo, dur);
      this.proximoTempo += dur;
      this.passo = (this.passo + 1) % MELODIA.length;
    }
  }

  tocarPasso(i, t, dur) {
    const bus = this.musicBus;

    // melodia
    const s = MELODIA[i];
    if (s !== null) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(nota(s, 1), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9);
      osc.connect(g).connect(bus);
      osc.start(t);
      osc.stop(t + dur);
    }

    // baixo a cada duas colcheias
    if (i % 2 === 0) {
      const b = BAIXO[(i / 2) % BAIXO.length];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(nota(b, -1), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.42, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.7);
      osc.connect(g).connect(bus);
      osc.start(t);
      osc.stop(t + dur * 2);
    }

    // chimbal leve no contratempo, só para dar balanço
    if (i % 2 === 1) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f).connect(g).connect(bus);
      src.start(t);
      src.stop(t + 0.07);
    }
  }
}
