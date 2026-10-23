'use strict';
/* ============================================================
   SORTE & SANGUE — menus, configuração, montador de decks
   ============================================================ */

const DECK_SIZE = 40, DECK_MAX_COPIES = 2;
const MODE_INFO = {
  ai: { title: 'Contra a IA', desc: 'Você contra o computador. Cada um usa um baralho com uma cópia de cada carta.' },
  hotseat: { title: '2 Jogadores', desc: 'Dois jogadores no mesmo computador, revezando a vez. Cada um usa um baralho com uma cópia de cada carta.' },
  deck: { title: 'Duelo de Decks', desc: `Dois jogadores no mesmo computador. Cada um monta seu próprio deck de ${DECK_SIZE} cartas (até ${DECK_MAX_COPIES} cópias de cada) e eles se enfrentam.` },
};

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* armazenamento indisponível */ } },
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

function startGame(mode, opts = {}) {
  SFX.init();
  if (mode === 'online') Net.myId = HOST_ID;
  newGame(mode, opts);
  // online: avisa o convidado antes da primeira foto do estado
  if (mode === 'online') Net.send({ t: 'start', hearts: MAX_HP, names: opts.names });
  $('#netBadge').hidden = mode !== 'online';
  if (mode === 'online') { $('#netBadge').textContent = '🌐 Online'; $('#netBadge').title = `Conectado com ${Net.oppName}`; }
  UI.revealedFor = null;
  UI.handHidden = false;
  UI.inspected = null;
  UI.picking = null;
  UI.waitingFor = null;
  $('#log').innerHTML = '';
  $('#inspector').innerHTML = '<div class="i-empty">Passe o mouse sobre uma carta para ver os detalhes.</div>';
  $('#overlay').innerHTML = '';
  showScreen('game');
  UI.fit();
  render();
  act(async () => { await mulliganPhase(); await startTurn(); });
}

/* ---------------- sala online ---------------- */

const ON = { hearts: store.get('ss-hearts') || 10 };

function openOnline(code) {
  $('#onName').value = store.get('ss-name') || '';
  $('#onCode').value = code || '';
  setOnlineHearts(ON.hearts);
  renderOnlineStatus({ state: 'idle' });
  showScreen('online');
  if (code) $('#onName').focus();
}

function setOnlineHearts(v) {
  ON.hearts = Math.max(1, Math.min(40, Math.round(+v) || 10));
  $('#onHeartsRange').value = ON.hearts;
  $('#onHeartsNum').textContent = ON.hearts;
  document.querySelectorAll('[data-onhearts]').forEach((b) => b.classList.toggle('on', +b.dataset.onhearts === ON.hearts));
}

const playerName = () => {
  const n = $('#onName').value.trim().slice(0, 18) || 'Jogador';
  store.set('ss-name', n);
  return n;
};

function renderOnlineStatus(st) {
  const busy = ['creating', 'hosting', 'joining', 'connected'].includes(st.state);
  document.querySelectorAll('#onCreateBtn, #onJoinBtn, #onName, #onCode, #onHeartsRange, [data-onhearts]').forEach((el) => { el.disabled = busy; });
  const box = $('#onStatus');
  const spin = '<span class="spinner"></span>';
  if (st.state === 'idle') box.innerHTML = '';
  else if (st.state === 'creating') box.innerHTML = `<div class="on-msg">${spin} Criando a sala…</div>`;
  else if (st.state === 'joining') box.innerHTML = `<div class="on-msg">${spin} Conectando à sala <b>${st.code}</b>…</div><button class="btn" id="onCancel">Cancelar</button>`;
  else if (st.state === 'connected') box.innerHTML = `<div class="on-msg ok">${spin} Conectado! Começando a partida…</div>`;
  else if (st.state === 'error') box.innerHTML = `<div class="on-msg err">⚠ ${st.msg}</div>`;
  else if (st.state === 'hosting') {
    const local = location.protocol === 'file:';
    box.innerHTML = `<div class="on-room">
        <div class="on-label">Código da sala</div><div class="on-code">${st.code}</div>
        <div class="on-label">Link de convite</div>
        <div class="on-link"><input id="onLink" readonly value="${st.link}"><button class="btn primary" id="onCopyLink">📋 Copiar link</button></div>
        ${local ? '<div class="on-note">O jogo foi aberto como arquivo, então o link só funciona neste computador. Mande o <b>código</b>: o convidado escolhe "Entrar numa sala" no jogo dele. Publicado no Netlify, o link funciona para qualquer pessoa.</div>' : ''}
        ${st.note ? `<div class="on-note">${st.note}</div>` : ''}
        <div class="on-msg">${spin} Aguardando o oponente entrar…</div>
        <button class="btn" id="onCancel">Cancelar sala</button>
      </div>`;
  }
}

function copyText(text, btn) {
  const done = () => { const old = btn.textContent; btn.textContent = '✔ Copiado!'; setTimeout(() => { btn.textContent = old; }, 1500); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback());
  else fallback();
  function fallback() {
    const input = $('#onLink');
    input.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* o texto fica selecionado para copiar à mão */ }
  }
}

Net.onStatus = (st) => {
  if (st.state === 'connected' && Net.role === 'guest') store.set('ss-name', Net.myName);
  if ($('#online').classList.contains('active') || st.state === 'error') renderOnlineStatus(st);
  if (st.state === 'error' && !$('#online').classList.contains('active')) { showScreen('online'); renderOnlineStatus(st); }
};

/* ---------------- configuração da partida ---------------- */

const SETUP = { mode: 'ai', hearts: store.get('ss-hearts') || 10 };

function openSetup(mode) {
  SETUP.mode = mode;
  const info = MODE_INFO[mode];
  $('#setupTitle').textContent = info.title;
  $('#setupDesc').textContent = info.desc;
  $('#setupGo').textContent = mode === 'deck' ? 'Montar os decks ▶' : 'Começar ▶';
  setHearts(SETUP.hearts);
  showScreen('setup');
}

function setHearts(v) {
  SETUP.hearts = Math.max(1, Math.min(40, Math.round(+v) || 10));
  $('#heartsRange').value = SETUP.hearts;
  $('#heartsNum').textContent = SETUP.hearts;
  document.querySelectorAll('[data-hearts]').forEach((b) => b.classList.toggle('on', +b.dataset.hearts === SETUP.hearts));
}

/* ---------------- montador de decks ---------------- */

const DB = { player: 0, counts: {}, filter: 'all', decks: [] };
const deckTotal = () => Object.values(DB.counts).reduce((s, n) => s + n, 0);
const deckIds = () => Object.entries(DB.counts).flatMap(([id, n]) => Array(n).fill(id));

async function openBuilder(player) {
  DB.player = player;
  DB.counts = {};
  DB.filter = 'all';
  DB.query = '';
  $('#dbSearch').value = '';
  await UI.passScreen({ id: player, name: `Jogador ${player + 1}` }, `Hora de montar seu deck de ${DECK_SIZE} cartas.`);
  showScreen('deckbuild');
  renderBuilder();
}

function addCard(id, n = 1) {
  const cur = DB.counts[id] || 0;
  const can = Math.min(n, DECK_MAX_COPIES - cur, DECK_SIZE - deckTotal());
  if (can <= 0) { SFX.play('error'); return; }
  DB.counts[id] = cur + can;
  SFX.play('draw');
  renderBuilder();
}

function removeCard(id) {
  if (!DB.counts[id]) return;
  if (--DB.counts[id] === 0) delete DB.counts[id];
  SFX.play('click');
  renderBuilder();
}

function fillRandom() {
  const pool = DECK_POOL.flatMap((d) => Array(DECK_MAX_COPIES - (DB.counts[d.id] || 0)).fill(d.id));
  shuffle(pool);
  while (deckTotal() < DECK_SIZE && pool.length) {
    const id = pool.pop();
    DB.counts[id] = (DB.counts[id] || 0) + 1;
  }
  SFX.play('magic');
  renderBuilder();
}

function renderBuilder() {
  const total = deckTotal();
  const saved = store.get(`ss-deck-${DB.player}`);
  $('#dbTitle').innerHTML = `Deck do Jogador ${DB.player + 1} <span class="db-count ${total === DECK_SIZE ? 'full' : ''}">${total}/${DECK_SIZE}</span>`;
  $('#dbLoad').disabled = !saved;
  $('#dbConfirm').disabled = total !== DECK_SIZE;
  document.querySelectorAll('[data-dbfilter]').forEach((b) => b.classList.toggle('on', b.dataset.dbfilter === DB.filter));

  const defs = DECK_POOL.filter((d) => DB.filter === 'all' || d.type === DB.filter || (DB.filter === 'free' && d.cost.t === 'free'))
    .filter((d) => matchesSearch(d, DB.query || ''))
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'combatant' ? -1 : 1)
      || COST_ORDER[a.cost.t] - COST_ORDER[b.cost.t] || (a.cost.v || 0) - (b.cost.v || 0));
  $('#dbGrid').innerHTML = defs.map((d) => {
    const n = DB.counts[d.id] || 0;
    return `<div class="db-item ${n ? 'in' : ''} ${n >= DECK_MAX_COPIES ? 'max' : ''}" data-dbadd="${d.id}" title="Clique: adicionar · Botão direito: remover">
      ${cardHTML(d)}${n ? `<div class="db-n">×${n}</div>` : ''}
      <div class="db-ctrl"><button class="btn" data-dbminus="${d.id}" ${n ? '' : 'disabled'}>−</button><button class="btn" data-dbplus="${d.id}" ${n >= DECK_MAX_COPIES || total >= DECK_SIZE ? 'disabled' : ''}>+</button></div>
    </div>`;
  }).join('');

  const chosen = DECK_POOL.filter((d) => DB.counts[d.id]);
  const count = (fn) => chosen.reduce((s, d) => s + (fn(d) ? DB.counts[d.id] : 0), 0);
  const fusionsReady = FUSIONS.filter((f) => f.materials.every((id) => DB.counts[id]));
  $('#dbStats').innerHTML = `
    <div><b>${count((d) => d.type === 'combatant')}</b> combatentes · <b>${count((d) => d.type === 'magic')}</b> magias</div>
    <div><b>${count((d) => d.cost.t === 'free')}</b> sem custo · <b>${count((d) => d.cost.t === 'luck')}</b> sorte · <b>${count((d) => d.cost.t === 'bluck')}</b> sorte de sangue · <b>${count((d) => d.cost.t === 'blood')}</b> sangue</div>
    ${fusionsReady.length ? `<div class="db-fus">🧬 Fusões possíveis: ${fusionsReady.map((f) => f.name).join(', ')}</div>` : ''}`;
  $('#dbList').innerHTML = chosen.length ? chosen.map((d) => `<div class="db-row" data-dbhover="${d.id}">
      <span class="db-row-n">${DB.counts[d.id]}×</span><span class="db-row-name">${d.name}</span>
      <span class="db-row-cost">${d.cost.t === 'free' ? '—' : d.cost.t === 'blood' ? `🩸${d.cost.v}` : `${d.cost.t === 'bluck' ? '♦' : '🍀'}${d.cost.v}`}</span>
      <button class="icon-btn" data-dbminus="${d.id}">−</button></div>`).join('')
    : '<div class="m-empty">Clique nas cartas à esquerda para montar o deck.</div>';
}

async function confirmDeck() {
  if (deckTotal() !== DECK_SIZE) return;
  const ids = deckIds();
  store.set(`ss-deck-${DB.player}`, ids);
  DB.decks[DB.player] = ids;
  SFX.play('luck');
  if (DB.player === 0) { await openBuilder(1); return; }
  startGame('hotseat', { hearts: SETUP.hearts, decks: [DB.decks[0], DB.decks[1]] });
}

/* ---------------- coleção ---------------- */

const COST_ORDER = { free: 0, luck: 1, bluck: 2, blood: 3 };
// busca sem diferenciar maiúsculas nem acentos, no nome, no texto e no tipo da carta
const fold = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function matchesSearch(d, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold([d.name, d.text, typeLabel(d), costLabel(d), ...(d.materials || []).map((id) => DEF(id).name)].join(' '));
  return words.every((w) => hay.includes(w));
}

const COLL = { filter: 'all', query: '' };
function renderCollection(filter = COLL.filter) {
  COLL.filter = filter;
  const defs = (filter === 'fusion' ? FUSIONS : filter === 'all' ? [...DECK_POOL, ...FUSIONS] : DECK_POOL.filter((d) => d.type === filter))
    .filter((d) => matchesSearch(d, COLL.query))
    .slice()
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'combatant' ? -1 : 1)
      || COST_ORDER[a.cost.t] - COST_ORDER[b.cost.t] || (a.cost.v || 0) - (b.cost.v || 0));
  $('#collGrid').innerHTML = defs.length ? '' : `<div class="m-empty search-empty">Nenhuma carta encontrada para "${COLL.query.replace(/[<>&]/g, '')}".</div>`;
  $('#collGrid').innerHTML += defs.map((d) => `<div class="coll-item">${cardHTML(d)}<div class="coll-cost">${d.fusion ? `🧬 Fusão de ${d.materials.map((id) => DEF(id).name).join(' + ')}` : costLabel(d)}</div></div>`).join('');
  $('#collCount').textContent = `${defs.length} carta${defs.length !== 1 ? 's' : ''}`;
  document.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('on', b.dataset.filter === filter));
}

/* ---------------- ligações ---------------- */

document.addEventListener('click', (e) => {
  const setup = e.target.closest('[data-setup]');
  if (setup) { SFX.play('click'); openSetup(setup.dataset.setup); return; }
  const hb = e.target.closest('[data-hearts]');
  if (hb) { SFX.play('click'); setHearts(hb.dataset.hearts); return; }
  if (e.target.closest('#setupGo')) {
    SFX.play('click');
    store.set('ss-hearts', SETUP.hearts);
    if (SETUP.mode === 'deck') { DB.decks = []; openBuilder(0); }
    else startGame(SETUP.mode, { hearts: SETUP.hearts });
    return;
  }
  // sala online
  if (e.target.closest('[data-online]')) { SFX.play('click'); openOnline(''); return; }
  const oh = e.target.closest('[data-onhearts]');
  if (oh) { SFX.play('click'); setOnlineHearts(oh.dataset.onhearts); return; }
  if (e.target.closest('#onCreateBtn')) { SFX.init(); SFX.play('click'); store.set('ss-hearts', ON.hearts); Net.host(playerName(), ON.hearts); return; }
  if (e.target.closest('#onJoinBtn')) { SFX.init(); SFX.play('click'); Net.join($('#onCode').value, playerName()); return; }
  if (e.target.closest('#onCancel')) { SFX.play('click'); Net.reset(); renderOnlineStatus({ state: 'idle' }); return; }
  if (e.target.closest('#onCopyLink')) { copyText($('#onLink').value, e.target.closest('#onCopyLink')); return; }

  const scr = e.target.closest('[data-screen]');
  if (scr) {
    if (Net.role && !Net.started) { Net.reset(); history.replaceState(null, '', location.href.split('?')[0]); }
    SFX.play('click');
    if (scr.dataset.screen === 'collection') { COLL.query = ''; $('#collSearch').value = ''; renderCollection('all'); }
    showScreen(scr.dataset.screen);
    return;
  }
  const f = e.target.closest('[data-filter]');
  if (f) { SFX.play('click'); renderCollection(f.dataset.filter); return; }

  // montador de decks
  const minus = e.target.closest('[data-dbminus]');
  if (minus) { removeCard(minus.dataset.dbminus); return; }
  const plus = e.target.closest('[data-dbplus]');
  if (plus) { addCard(plus.dataset.dbplus); return; }
  const add = e.target.closest('[data-dbadd]');
  if (add && !e.target.closest('.c-text')) { addCard(add.dataset.dbadd); return; }
  const dbf = e.target.closest('[data-dbfilter]');
  if (dbf) { SFX.play('click'); DB.filter = dbf.dataset.dbfilter; renderBuilder(); return; }
  if (e.target.closest('#dbRandom')) { fillRandom(); return; }
  if (e.target.closest('#dbClear')) { DB.counts = {}; SFX.play('click'); renderBuilder(); return; }
  if (e.target.closest('#dbLoad')) {
    const saved = store.get(`ss-deck-${DB.player}`) || [];
    DB.counts = {};
    for (const id of saved) if (DEF(id) && !DEF(id).fusion && !DEF(id).token) DB.counts[id] = Math.min(DECK_MAX_COPIES, (DB.counts[id] || 0) + 1);
    SFX.play('magic');
    renderBuilder();
    return;
  }
  if (e.target.closest('#dbConfirm')) { confirmDeck(); return; }
  if (e.target.closest('#dbBack')) {
    modal({ title: 'Sair do montador?', html: 'Os decks montados até agora serão descartados.',
      buttons: [{ label: 'Voltar ao menu', value: true, cls: 'danger' }, { label: 'Continuar montando', value: false, cls: 'primary' }] })
      .then((ok) => { if (ok) showScreen('menu'); });
    return;
  }

  if (e.target.closest('#btnSound')) {
    SFX.on = !SFX.on;
    $('#btnSound').textContent = SFX.on ? '🔊' : '🔇';
    if (SFX.on) SFX.play('click');
    return;
  }
  if (e.target.closest('#btnMenu')) {
    modal({ title: 'Voltar ao menu?', html: 'A partida atual será perdida.',
      buttons: [{ label: 'Sair da partida', value: true, cls: 'danger' }, { label: 'Continuar jogando', value: false, cls: 'primary' }] })
      .then((ok) => { if (ok) location.href = location.href.split('?')[0]; });
  }
});

document.addEventListener('contextmenu', (e) => {
  const item = e.target.closest('[data-dbadd]');
  if (!item) return;
  e.preventDefault();
  removeCard(item.dataset.dbadd);
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'heartsRange') setHearts(e.target.value);
  if (e.target.id === 'onHeartsRange') setOnlineHearts(e.target.value);
  if (e.target.id === 'collSearch') { COLL.query = e.target.value; renderCollection(); }
  if (e.target.id === 'dbSearch') { DB.query = e.target.value; renderBuilder(); }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !$('#online').classList.contains('active')) return;
  if (e.target.id === 'onCode' && !$('#onJoinBtn').disabled) $('#onJoinBtn').click();
});

// link de convite: ?sala=codigo abre direto a tela para entrar
(function inviteFromUrl() {
  const code = new URLSearchParams(location.search).get('sala');
  if (code) openOnline(code);
})();

/* cartas decorativas do menu */
(function menuCards() {
  const ids = ['besta', 'vazio', 'deus', 'cristal', 'imperador', 'pocao', 'peso'];
  const el = $('#menuCards');
  el.innerHTML = ids.map((id, i) => {
    const mid = (ids.length - 1) / 2;
    return `<div class="menu-card" style="--r:${(i - mid) * 9}deg;--y:${Math.abs(i - mid) * Math.abs(i - mid) * 7}px;--d:${i * 0.08}s">${cardHTML(DEF(id))}</div>`;
  }).join('');
})();
