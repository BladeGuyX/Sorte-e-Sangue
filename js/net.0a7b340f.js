'use strict';
/* ============================================================
   SORTE & SANGUE — multijogador online (WebRTC via PeerJS)

   O anfitrião é a autoridade: só ele roda as regras. O convidado
   - recebe "fotos" do estado (com a mão do anfitrião e os baralhos escondidos),
   - recebe os efeitos visuais (fx) para ver as mesmas animações,
   - envia jogadas, que o anfitrião revalida em runAction(),
   - responde às perguntas do motor (alvos, Mago Branco, mão cheia...).
   ============================================================ */

const NET_PROTOCOL = 3;
const HOST_ID = 0, GUEST_ID = 1;
const ROOM_PREFIX = 'sorte-sangue-';
// efeitos visuais que o anfitrião repete na tela do convidado
const FX = ['khaosBanner', 'float', 'floatPlayer', 'animSummon', 'animDestroy', 'animAttack', 'animClash', 'animDamage', 'animHeal',
  'rollDice', 'banner', 'showPlay', 'toast', 'rects', 'flip', 'addLog', 'showGameOver'];

const isCard = (v) => v && typeof v === 'object' && 'uid' in v && 'defId' in v;
const isPlayer = (v) => v && typeof v === 'object' && 'hand' in v && 'field' in v;

// cópia de uma carta segura para enviar (sem referências a outras cartas)
function cardWire(c) {
  const { death, controlled, isNew, bound, ...rest } = c;
  if (bound) rest.boundUid = bound.uid;
  // o convidado nunca recebe a identidade verdadeira de um Coringa que não é dele
  if (rest.disguise && Net.role === 'host' && rest.controller !== GUEST_ID) {
    rest.defId = rest.disguise;
    rest.abilityId = rest.disguise;
    rest.disguise = null;
  }
  return rest;
}

function wire(v) {
  if (v == null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(wire);
  if (isCard(v)) return cardWire(v);
  if (isPlayer(v)) return { id: v.id, name: v.name, isAI: false };
  const o = {};
  for (const k of Object.keys(v)) if (typeof v[k] !== 'function') o[k] = wire(v[k]);
  return o;
}

const Net = {
  role: null,        // 'host' | 'guest' | null
  myId: HOST_ID,
  peer: null,
  conn: null,
  started: false,
  myName: '',
  oppName: '',
  hearts: 10,
  seq: 0,
  pending: new Map(),   // perguntas (anfitrião) ou jogadas (convidado) aguardando resposta
  dirty: false,
  depth: 0,
  lastRects: [],
  seenHand: new Set(),
  closing: false,
  onStatus: () => {},

  active() { return !!this.role && !!this.conn && this.conn.open; },
  send(msg) { if (this.conn && this.conn.open) this.conn.send(msg); },

  /* ---------------- sala ---------------- */

  newPeer(id) {
    return new Peer(id, {
      debug: 0,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] },
    });
  },

  roomCode() {
    const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  },

  inviteLink(code) {
    const base = location.href.split('#')[0].split('?')[0];
    return `${base}?sala=${code}`;
  },

  libraryOk() {
    if (typeof Peer !== 'undefined') return true;
    this.onStatus({ state: 'error', msg: 'Não foi possível carregar o modo online. Verifique a internet e recarregue a página.' });
    return false;
  },

  host(name, hearts, khaos = false, tries = 0) {
    if (!this.libraryOk()) return;
    this.reset();
    this.role = 'host';
    this.myId = HOST_ID;
    this.myName = name;
    this.hearts = hearts;
    this.khaos = khaos;
    const code = this.roomCode();
    this.code = code;
    this.onStatus({ state: 'creating' });
    const peer = this.newPeer(ROOM_PREFIX + code);
    this.peer = peer;
    peer.on('open', () => this.onStatus({ state: 'hosting', code, link: this.inviteLink(code) }));
    peer.on('connection', (conn) => this.acceptGuest(conn));
    peer.on('disconnected', () => { if (!this.started && !this.closing) peer.reconnect(); });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && tries < 5) { peer.destroy(); this.host(name, hearts, khaos, tries + 1); return; }
      if (this.started) return;   // depois de conectado, quem manda é a conexão
      this.onStatus({ state: 'error', msg: this.errorText(e) });
    });
  },

  acceptGuest(conn) {
    if (this.conn) {   // já tem convidado: recusa educadamente
      conn.on('open', () => { conn.send({ t: 'reject', reason: 'Esta sala já está cheia.' }); setTimeout(() => conn.close(), 300); });
      return;
    }
    this.conn = conn;
    conn.on('open', () => this.watch(conn));
    conn.on('data', (m) => this.receive(m));
    conn.on('close', () => this.lost(conn));
    conn.on('error', () => this.lost(conn));
  },

  // detecta queda de conexão: estado do WebRTC + sinal de vida (ping)
  watch(conn) {
    const pc = conn.peerConnection;
    if (pc) {
      pc.addEventListener('iceconnectionstatechange', () => {
        const st = pc.iceConnectionState;
        if (st === 'failed' || st === 'closed') this.lost(conn);
        else if (st === 'disconnected') {
          clearTimeout(this.iceTimer);
          this.iceTimer = setTimeout(() => { if (pc.iceConnectionState === 'disconnected') this.lost(conn); }, 10000);
        }
      });
    }
    this.lastSeen = Date.now();
    this.oppAway = false;
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (conn !== this.conn) { clearInterval(this.heartbeat); return; }
      this.send({ t: 'ping' });
      // aba do oponente em segundo plano pode ter os timers congelados: não conta como queda
      if (this.started && !this.oppAway && Date.now() - this.lastSeen > 30000) this.lost(conn);
    }, 3000);
  },

  join(code, name) {
    if (!this.libraryOk()) return;
    this.reset();
    this.role = 'guest';
    this.myId = GUEST_ID;
    this.myName = name;
    code = String(code || '').trim().toLowerCase().replace(/^.*[?&]sala=/, '').replace(/[^a-z0-9]/g, '');
    if (!code) { this.onStatus({ state: 'error', msg: 'Digite o código da sala.' }); this.reset(); return; }
    this.onStatus({ state: 'joining', code });
    const peer = this.newPeer();
    this.peer = peer;
    const timeout = setTimeout(() => {
      if (!this.started && !this.welcomed) { this.onStatus({ state: 'error', msg: 'Não foi possível conectar. Confira o código e tente de novo (algumas redes bloqueiam conexões diretas).' }); this.reset(); }
    }, 20000);
    peer.on('open', () => {
      const conn = peer.connect(ROOM_PREFIX + code, { reliable: true, serialization: 'json' });
      this.conn = conn;
      conn.on('open', () => { this.watch(conn); conn.send({ t: 'hello', v: NET_PROTOCOL, name }); });
      conn.on('data', (m) => { if (m && m.t === 'welcome') clearTimeout(timeout); this.receive(m); });
      conn.on('close', () => this.lost(conn));
      conn.on('error', () => this.lost(conn));
    });
    peer.on('error', (e) => {
      if (this.started) return;
      clearTimeout(timeout);
      this.onStatus({ state: 'error', msg: this.errorText(e) });
      this.reset();
    });
  },

  errorText(e) {
    if (e.type === 'peer-unavailable') return 'Sala não encontrada. Confira o código ou peça um link novo.';
    if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') return 'Sem conexão com o servidor de salas. Verifique a internet e tente de novo.';
    if (e.type === 'browser-incompatible') return 'Este navegador não suporta o modo online.';
    return 'Erro de conexão (' + (e.type || e.message || 'desconhecido') + ').';
  },

  reset() {
    this.closing = true;
    try { if (this.conn) this.conn.close(); } catch (e) { /* já fechada */ }
    try { if (this.peer) this.peer.destroy(); } catch (e) { /* já destruído */ }
    clearInterval(this.heartbeat);
    clearTimeout(this.iceTimer);
    this.peer = null; this.conn = null; this.role = null; this.started = false; this.welcomed = false;
    this.pending.clear(); this.seenHand.clear(); this.dirty = false;
    this.closing = false;
  },

  lost(conn) {
    if (this.closing || conn !== this.conn) return;
    if (!this.started) {
      if (this.role === 'host') {   // convidado saiu antes de começar: volta a esperar
        this.conn = null;
        this.onStatus({ state: 'hosting', code: this.code, link: this.inviteLink(this.code), note: 'O convidado saiu. Aguardando outro…' });
      } else if (this.welcomed) {
        this.onStatus({ state: 'error', msg: 'O anfitrião fechou a sala.' });
        this.reset();
      }
      return;
    }
    this.closing = true;
    UI.connectionLost(this.oppName);
  },

  /* ---------------- mensagens ---------------- */

  receive(m) {
    if (!m || typeof m !== 'object') return;
    this.lastSeen = Date.now();
    if (m.t === 'ping') return;
    if (m.t === 'away' || m.t === 'back') { this.oppAway = m.t === 'away'; return; }
    try {
      if (this.role === 'host') this.hostReceive(m);
      else this.guestReceive(m);
    } catch (e) { console.error('[online]', e); }
  },

  hostReceive(m) {
    switch (m.t) {
      case 'hello': {
        if (m.v !== NET_PROTOCOL) { this.send({ t: 'reject', reason: 'Versões diferentes do jogo. Atualizem a página (Ctrl+F5) e tentem de novo.' }); return; }
        let name = String(m.name || 'Convidado').slice(0, 18).trim() || 'Convidado';
        if (name === this.myName) name += ' (2)';
        this.oppName = name;
        this.send({ t: 'welcome', hostName: this.myName, hearts: this.hearts, khaos: this.khaos });
        this.started = true;
        this.onStatus({ state: 'connected' });
        if (this.khaos) this.khaosBans(name);
        else startGame('online', { hearts: this.hearts, names: [this.myName, name] });
        break;
      }
      case 'bans': if (this.banResolve) { this.banResolve(Khaos.validBans(m.ids)); this.banResolve = null; } break;
      case 'action': this.runRemoteAction(m); break;
      case 'answer': {
        const q = this.pending.get(m.id);
        if (!q) return;
        this.pending.delete(m.id);
        UI.waitingFor = null;
        renderMid();
        q.resolve(this.unwireAnswer(q, m.res));
        break;
      }
      case 'bye': this.lost(this.conn); break;
    }
  },

  guestReceive(m) {
    switch (m.t) {
      case 'welcome':
        this.welcomed = true;
        this.started = true;
        this.oppName = m.hostName;
        this.onStatus({ state: 'connected' });
        break;
      case 'banAsk':
        Khaos.pickBans(this.myName).then((ids) => {
          this.send({ t: 'bans', ids });
          Khaos.waiting(`Aguardando ${this.oppName} escolher as cartas banidas…`);
        });
        break;
      case 'reject':
        this.onStatus({ state: 'error', msg: m.reason });
        this.reset();
        break;
      case 'start': UI.beginOnlineGuest(m); this.seenHand.clear(); break;
      case 'state': this.applyState(m.s); break;
      case 'fx': this.playFx(m.n, m.a); break;
      case 'ask': this.answerAsk(m); break;
      case 'ack': {
        const q = this.pending.get(m.id);
        if (!q) return;
        this.pending.delete(m.id);
        if (!m.ok) { UI.toast('Jogada recusada (o estado mudou). Tente de novo.'); SFX.play('error'); }
        q.resolve(m.ok);
        break;
      }
      case 'bye': this.lost(this.conn); break;
    }
  },

  /* ---------------- anfitrião ---------------- */

  // foto do estado para o convidado: a mão do anfitrião e os baralhos vão só como contagem
  snapshot() {
    return {
      mode: 'online', turn: S.turn, current: S.current, phase: S.phase, winner: S.winner, tauntUsed: !!S.tauntUsed,
      lastActive: S.lastActive, maxHp: MAX_HP, opts: { hearts: MAX_HP },
      khaos: S.khaos ? { banned: S.khaos.banned } : null,
      players: S.players.map((p) => ({
        id: p.id, name: p.name, hp: p.hp, luck: p.id === GUEST_ID ? p.luck : luckTxt(p), lucky: p.lucky, luckDebt: p.luckDebt,
        luckLock: p.luckLock && (p.id === GUEST_ID ? p.luckLock : { value: p.luckLock.value + (p.luckLock.mask || 0), turns: p.luckLock.turns, mask: 0 }),
        lastRoll: p.lastRoll, moveUsed: p.moveUsed, acted: p.acted, luckyDrawUsed: p.luckyDrawUsed, freeCard: !!p.freeCard,
        deckCount: p.deck.length,
        hand: p.id === GUEST_ID ? p.hand.map(cardWire) : p.hand.length,
        field: p.field.map((c) => c && cardWire(c)),
        magic: p.magic.map((c) => c && cardWire(c)),
        discard: p.discard.map(cardWire),
      })),
    };
  },

  markDirty() {
    if (this.role !== 'host' || !this.started || !S || S.mode !== 'online' || this.dirty) return;
    this.dirty = true;
    setTimeout(() => this.flush(), 0);
  },

  flush() {
    if (this.role !== 'host' || !this.started || !S || S.mode !== 'online') return;
    this.dirty = false;
    this.send({ t: 'state', s: this.snapshot() });
  },

  fxArgs(n, args) {
    if (n === 'rollDice') return [args[0], args[1], { charges: 0 }];
    if (n === 'flip') return [];
    if (n === 'rects') return [wire(args[0] || [])];
    return wire(args);
  },

  // pergunta algo ao convidado e devolve a resposta já validada
  ask(p, kind, data) {
    return new Promise((resolve) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, kind, data, p });
      this.flush();
      this.send({ t: 'ask', id, pid: p.id, kind, data: wire(data) });
      UI.waitingFor = p.name;
      renderMid();
    });
  },

  unwireAnswer(q, res) {
    const d = q.data || {};
    switch (q.kind) {
      case 'confirm': return res === true;
      case 'pick': {
        const c = (d.candidates || []).find((x) => sameCand(x, res));
        if (c) return c;
        return d.optional ? null : (d.candidates || [])[0] || null;
      }
      case 'card': {
        const c = res && (d.cards || []).find((x) => x.uid === res.uid);
        return c || (d.optional ? null : (d.cards || [])[0] || null);
      }
      case 'handFull': return (res && q.p.hand.find((x) => x.uid === res.uid)) || null;
      case 'crystal': case 'mulligan': case 'dice': return res === 'reroll' ? 'reroll' : 'keep';
      case 'choose': {
        const ok = (d.options || []).filter((o) => !o.disabled);
        const o = ok.find((x) => x.value === res);
        return o ? o.value : ok[0] && ok[0].value;
      }
    }
    return null;
  },

  // rolagem de sorte do convidado: os dois veem o dado; quem decide re-rolar é o convidado
  async rollDice(p, label, value) {
    const [, res] = await Promise.all([
      UI._raw.rollDice(label, value, { charges: 0 }),
      this.ask(p, 'dice', { label, value, charges: p.lucky }),
    ]);
    return res;
  },

  // Khaos online: os dois banem ao mesmo tempo; depois o anfitrião começa a partida
  async khaosBans(guestName) {
    const theirs = new Promise((res) => { this.banResolve = res; });
    this.send({ t: 'banAsk' });
    const mine = await Khaos.pickBans(this.myName);
    const done = Khaos.waiting(`Aguardando ${guestName} escolher as cartas banidas…`);
    const other = await theirs;
    done();
    if (!this.active()) return;
    startGame('online', { hearts: this.hearts, names: [this.myName, guestName], khaos: true, banned: [...new Set([...mine, ...other])] });
  },

  async runRemoteAction(m) {
    while (UI.busy) await sleep(40);
    let ok = false;
    await act(async () => { ok = await runAction(P(GUEST_ID), m.action); });
    this.flush();
    this.send({ t: 'ack', id: m.id, ok });
  },

  /* ---------------- convidado ---------------- */

  applyState(s) {
    MAX_HP = s.maxHp;
    const players = s.players.map((p) => {
      const hand = Array.isArray(p.hand) ? p.hand : Array.from({ length: p.hand }, () => ({ hidden: true }));
      if (p.id === GUEST_ID) for (const c of hand) { c.isNew = !this.seenHand.has(c.uid); this.seenHand.add(c.uid); }
      return { ...p, isAI: false, deck: new Array(p.deckCount), hand };
    });
    const first = !S || S.mode !== 'online';
    S = { mode: 'online', opts: s.opts, turn: s.turn, current: s.current, phase: s.phase, winner: s.winner, tauntUsed: s.tauntUsed,
      lastActive: s.lastActive || {}, khaos: s.khaos || null, players, log: [], reserved: null, effectSource: null };
    if (first) UI.fit();
    render();
  },

  playFx(n, a) {
    if (!FX.includes(n) || !S) return;
    if (n === 'rects') { this.lastRects = UI.rects(a[0] || []); return; }
    if (n === 'flip') { UI.flip(this.lastRects); this.lastRects = []; return; }
    const r = UI[n](...a);
    if (r && r.catch) r.catch((e) => console.error('[fx]', n, e));
  },

  async answerAsk(m) {
    const p = S && S.players[m.pid];
    if (!p) return;
    let res;
    if (m.kind === 'dice') res = await UI.rollDice(m.data.label, m.data.value, { charges: m.data.charges });
    else res = await UI.ask(p, m.kind, m.data);
    this.send({ t: 'answer', id: m.id, res: wire(res) });
  },

  // envia uma jogada e espera o anfitrião confirmar que terminou de processá-la
  sendAction(action) {
    return new Promise((resolve) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve });
      this.send({ t: 'action', id, action });
    });
  },
};

// o anfitrião repete os efeitos visuais na tela do convidado (só os de primeiro nível, sem duplicar)
(function installFxRelay() {
  UI._raw = {};
  for (const n of FX) {
    const orig = UI[n];
    UI._raw[n] = orig;
    UI[n] = function (...args) {
      if (Net.depth === 0 && Net.role === 'host' && Net.started && S && S.mode === 'online') {
        Net.flush();
        Net.send({ t: 'fx', n, a: Net.fxArgs(n, args) });
      }
      Net.depth++;
      try { return orig.apply(UI, args); } finally { Net.depth--; }
    };
  }
})();

const sayBye = () => { if (Net.active()) Net.send({ t: 'bye' }); };
window.addEventListener('beforeunload', sayBye);
window.addEventListener('pagehide', sayBye);
document.addEventListener('visibilitychange', () => { if (Net.active()) Net.send({ t: document.hidden ? 'away' : 'back' }); });
