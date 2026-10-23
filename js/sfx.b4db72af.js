'use strict';
/* Efeitos sonoros sintetizados (Web Audio) — sem arquivos externos */
const SFX = {
  ctx: null,
  on: true,
  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.on = false; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur, { type = 'sine', vol = 0.12, slide = 0, delay = 0 } = {}) {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  },
  noise(dur, { vol = 0.15, delay = 0, freq = 1200 } = {}) {
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = buf;
    f.type = 'lowpass'; f.frequency.value = freq;
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  },
  play(name) {
    if (!this.on) return;
    this.init();
    if (!this.ctx) return;
    try {
      switch (name) {
        case 'click': this.tone(880, 0.05, { type: 'triangle', vol: 0.05 }); break;
        case 'draw': this.noise(0.12, { vol: 0.08, freq: 3000 }); this.tone(660, 0.08, { type: 'triangle', vol: 0.05, delay: 0.04 }); break;
        case 'place': this.tone(180, 0.15, { type: 'square', vol: 0.06, slide: -60 }); this.noise(0.1, { vol: 0.12, freq: 800 }); break;
        case 'magic': [523, 784, 1047].forEach((f, i) => this.tone(f, 0.25, { type: 'sine', vol: 0.07, delay: i * 0.06 })); break;
        case 'attack': this.noise(0.18, { vol: 0.18, freq: 2500 }); this.tone(320, 0.18, { type: 'sawtooth', vol: 0.05, slide: -220 }); break;
        case 'clash': this.tone(140, 0.2, { type: 'square', vol: 0.08 }); this.noise(0.25, { vol: 0.2, freq: 1500 }); break;
        case 'destroy': this.tone(260, 0.45, { type: 'sawtooth', vol: 0.08, slide: -200 }); this.noise(0.4, { vol: 0.12, freq: 900 }); break;
        case 'hurt': this.tone(110, 0.35, { type: 'square', vol: 0.1, slide: -50 }); this.noise(0.2, { vol: 0.15, freq: 600 }); break;
        case 'heal': [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.22, { type: 'sine', vol: 0.07, delay: i * 0.07 })); break;
        case 'buff': this.tone(500, 0.18, { type: 'triangle', vol: 0.07, slide: 400 }); break;
        case 'debuff': this.tone(500, 0.22, { type: 'triangle', vol: 0.07, slide: -300 }); break;
        case 'luck': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.15, { type: 'triangle', vol: 0.06, delay: i * 0.05 })); break;
        case 'block': this.tone(900, 0.12, { type: 'square', vol: 0.05 }); this.tone(600, 0.15, { type: 'square', vol: 0.05, delay: 0.05 }); break;
        case 'tick': this.tone(1200 + Math.random() * 600, 0.03, { type: 'square', vol: 0.03 }); break;
        case 'dice': this.tone(700, 0.12, { type: 'triangle', vol: 0.08 }); break;
        case 'crit': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.07, delay: i * 0.06 })); break;
        case 'fail': this.tone(300, 0.4, { type: 'sawtooth', vol: 0.06, slide: -200 }); break;
        case 'phase': this.tone(220, 0.3, { type: 'sawtooth', vol: 0.05, slide: 220 }); break;
        case 'turn': this.tone(392, 0.2, { type: 'triangle', vol: 0.06 }); this.tone(523, 0.3, { type: 'triangle', vol: 0.06, delay: 0.12 }); break;
        case 'error': this.tone(150, 0.18, { type: 'square', vol: 0.06 }); break;
        case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.08, delay: i * 0.13 })); break;
        case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.45, { type: 'sawtooth', vol: 0.05, delay: i * 0.2 })); break;
      }
    } catch (e) { /* som é opcional */ }
  },
};
