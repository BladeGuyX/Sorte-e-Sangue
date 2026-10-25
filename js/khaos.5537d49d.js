'use strict';
/* ============================================================
   SORTE & SANGUE — modo Khaos
   Antes da partida cada jogador bane 3 cartas (saem dos dois baralhos).
   O primeiro evento caótico vem depois de 2 a 4 rodadas; os seguintes, a cada 1 a 3 rodadas (sorteado).
   Uma rodada = um turno de cada jogador; as rodadas começam nos turnos ímpares (1, 3, 5...).
   ============================================================ */

const KHAOS_BANS = 3;
const KHAOS_EVENTS = [
  { id: 'flip', name: 'Flip', icon: '🔄', desc: 'O campo se inverte: todas as cartas em jogo de cada lado vão para o outro.' },
  { id: 'trade', name: 'Trade', icon: '🤝', desc: 'Os jogadores trocam as mãos.' },
  { id: 'change', name: 'Change', icon: '🎲', desc: 'Todas as cartas das mãos e do campo viram outras, completamente aleatórias.' },
  { id: 'ruin', name: 'Ruin', icon: '🏚️', desc: 'Todos os combatentes perdem 300 de poder (quem chegar a 0 é destruído).' },
  { id: 'obliterate', name: 'Obliterate', icon: '☄️', desc: 'O campo inteiro é destruído, inclusive as magias.' },
  { id: 'bless', name: 'Bless', icon: '🌟', desc: 'Cada jogador escolhe: curar 5 corações, comprar 2 cartas ou jogar 1 carta sem custo.' },
];

const Khaos = {
  nextIn: () => 2 * (1 + Math.floor(Math.random() * 3)),   // 1 a 3 rodadas entre eventos (em turnos: 2, 4 ou 6)

  setup(opts) {
    // primeiro evento: depois de 2 a 4 rodadas completas (no início da 3ª à 5ª rodada = turnos 5, 7 ou 9)
    return opts.khaos ? { next: 1 + 2 * (2 + Math.floor(Math.random() * 3)), banned: opts.banned || [] } : null;
  },

  announce() {
    const names = S.khaos.banned.map((id) => `<b class="cn">${DEF(id).name}</b>`).join(', ');
    log(`🌀 <b>Modo Khaos!</b> O primeiro evento caótico vem em 2 a 4 rodadas; depois, a cada 1 a 3 rodadas.${names ? ` Cartas banidas: ${names}.` : ''}`);
  },

  // chamado no início de cada turno, depois da rolagem e dos efeitos de início de turno
  async maybeEvent() {
    if (!S.khaos || S.turn < S.khaos.next) return;
    S.khaos.next = S.turn + this.nextIn();
    const ev = KHAOS_EVENTS[Math.floor(Math.random() * KHAOS_EVENTS.length)];
    log(`🌀 <b>KHAOS — ${ev.name}!</b> ${ev.desc}`);
    await UI.khaosBanner(ev);
    await this[ev.id]();
    render();
  },

  async flip() {
    const [a, b] = S.players;
    const all = [...a.field, ...a.magic, ...b.field, ...b.magic].filter(Boolean);
    const snap = UI.rects(all);
    [a.field, b.field] = [b.field, a.field];
    [a.magic, b.magic] = [b.magic, a.magic];
    for (const p of S.players) for (const c of [...p.field, ...p.magic]) if (c) { c.controller = p.id; c.movedTurn = 0; }
    SFX.play('magic');
    render();
    await UI.flip(snap);
  },

  async trade() {
    const [a, b] = S.players;
    [a.hand, b.hand] = [b.hand, a.hand];
    for (const p of S.players) for (const c of p.hand) { c.owner = c.controller = p.id; c.isNew = true; }
    SFX.play('draw');
    render();
    await sleep(500);
  },

  async change() {
    const banned = new Set(S.khaos.banned);
    const pool = [...DECK_POOL, ...FUSIONS].filter((d) => !banned.has(d.id));
    const combatants = pool.filter((d) => d.type === 'combatant');
    const passives = pool.filter((d) => d.type === 'magic' && d.kind === 'passive');
    const rnd = (list) => list[Math.floor(Math.random() * list.length)];
    for (const p of S.players) {
      p.hand = p.hand.map(() => { const c = newInstance(rnd(pool).id, p.id); c.isNew = true; return c; });
      p.field = p.field.map((old) => old && newInstance(rnd(combatants).id, p.id));
      p.magic = p.magic.map((old) => {
        if (!old) return null;
        const m = newInstance(rnd(passives).id, p.id);
        const ab = ABILITIES[m.defId] || {};
        if (ab.onPlace) ab.onPlace(m);
        return m;
      });
    }
    SFX.play('magic');
    render();
    await sleep(700);
  },

  async ruin() {
    const all = S.players.flatMap((p) => p.field.filter(Boolean));
    for (const c of all) { c.bonus -= 300; UI.float(c, '−300', 'debuff'); }
    SFX.play('debuff');
    render();
    await sleep(600);
    for (const c of all) if (locate(c) && power(c) <= 0) await destroy(c, { noSave: true });
  },

  async obliterate() {
    for (const zone of ['field', 'magic']) {
      for (const p of S.players) for (const c of [...p[zone]]) if (c && locate(c)) await destroy(c, { noSave: true, selfDestruct: true, silent: true });
    }
    log('☄️ O campo foi obliterado.');
  },

  async bless() {
    for (const id of [S.current, 1 - S.current]) {
      const p = P(id);
      const choice = await ask(p, 'choose', {
        title: '🌟 Bless', text: `${p.name}, escolha sua bênção:`, purpose: 'bless',
        options: [
          { label: '❤ Curar 5 corações', value: 'heal', disabled: p.hp >= MAX_HP },
          { label: '🃏 Comprar 2 cartas', value: 'draw' },
          { label: '🎁 Jogar 1 carta sem custo', value: 'free', disabled: !!p.freeCard },
        ],
      });
      if (choice === 'heal') await heal(p, 5);
      else if (choice === 'free') {
        p.freeCard = true;
        log(`🎁 ${p.name} vai poder jogar a próxima carta com custo sem pagar nada.`, p.id);
        render();
      } else {
        log(`${p.name} compra 2 cartas.`, p.id);
        await draw(p);
        await draw(p);
      }
    }
  },

  // a IA bane as cartas que mais teme (um pouco de sorteio entre as mais fortes)
  aiBans(already) {
    const score = (d) => (d.type === 'combatant' ? d.power / 100 + (AI_EXTRA[d.id] || 0) : (AI_MAGIC[d.id] || 2) + 1);
    const top = DECK_POOL.filter((d) => !already.includes(d.id)).sort((x, y) => score(y) - score(x)).slice(0, 10);
    return shuffle(top).slice(0, KHAOS_BANS).map((d) => d.id);
  },

  validBans: (ids) => [...new Set((Array.isArray(ids) ? ids : []).filter((id) => DECK_POOL.some((d) => d.id === id)))].slice(0, KHAOS_BANS),

  // tela de escolha: 3 cartas para banir
  pickBans(name) {
    return new Promise((resolve) => {
      const sel = new Set();
      let query = '';
      const ov = document.createElement('div');
      ov.className = 'modal-wrap';
      ov.innerHTML = `<div class="modal wide ban"><h3>🚫 ${name}: escolha ${KHAOS_BANS} cartas para banir</h3>
        <div class="m-body">As cartas banidas saem dos baralhos dos dois jogadores nesta partida (e das cartas aleatórias do evento Change).</div>
        <input class="search" id="banSearch" type="search" placeholder="🔍 Buscar carta…" autocomplete="off">
        <div class="m-cards" id="banGrid"></div>
        <div class="m-btns"><button class="btn primary" data-b="0" disabled>Confirmar (0/${KHAOS_BANS})</button><button class="btn" data-b="1">🎲 Completar aleatório</button></div></div>`;
      const draw = () => {
        const list = DECK_POOL.filter((d) => matchesSearch(d, query));
        ov.querySelector('#banGrid').innerHTML = list.map((d) => `<div class="m-card clickable ${sel.has(d.id) ? 'banned' : ''}" data-ban="${d.id}">${cardHTML(d)}</div>`).join('')
          || '<div class="m-empty">Nenhuma carta.</div>';
        const ok = ov.querySelector('[data-b="0"]');
        ok.disabled = sel.size !== KHAOS_BANS;
        ok.textContent = `Confirmar (${sel.size}/${KHAOS_BANS})`;
      };
      ov.addEventListener('input', (e) => { if (e.target.id === 'banSearch') { query = e.target.value; draw(); } });
      ov.addEventListener('click', (e) => {
        const card = e.target.closest('[data-ban]');
        if (card) {
          const id = card.dataset.ban;
          if (sel.has(id)) sel.delete(id);
          else if (sel.size < KHAOS_BANS) sel.add(id);
          else { SFX.play('error'); return; }
          SFX.play('click');
          draw();
          return;
        }
        const b = e.target.closest('[data-b]');
        if (!b || b.disabled) return;
        SFX.play('click');
        if (b.dataset.b === '1') {
          for (const d of shuffle(DECK_POOL.slice())) { if (sel.size >= KHAOS_BANS) break; sel.add(d.id); }
          draw();
          return;
        }
        ov.remove();
        resolve([...sel]);
      });
      $('#overlay').appendChild(ov);
      draw();
    });
  },

  waiting(text) {
    const ov = document.createElement('div');
    ov.className = 'pass-screen khaos-wait';
    ov.innerHTML = `<div class="pass-box"><div class="pass-ico">⏳</div><h2>${text}</h2></div>`;
    $('#overlay').appendChild(ov);
    return () => ov.remove();
  },
};

// partida Khaos local (contra a IA ou 2 jogadores): banimentos e depois o jogo
async function startKhaos(opp, hearts) {
  const names = opp === 'ai' ? ['Você', 'IA'] : ['Jogador 1', 'Jogador 2'];
  $('#overlay').innerHTML = '';
  let bans = [];
  if (opp === 'hotseat') await UI.passScreen({ id: 0, name: names[0] }, `Escolha as ${KHAOS_BANS} cartas que você quer banir.`);
  bans = bans.concat(await Khaos.pickBans(names[0]));
  if (opp === 'hotseat') {
    await UI.passScreen({ id: 1, name: names[1] }, `Escolha as ${KHAOS_BANS} cartas que você quer banir.`);
    bans = bans.concat(await Khaos.pickBans(names[1]));
  } else bans = bans.concat(Khaos.aiBans(bans));
  const banned = [...new Set(bans)];
  await modal({ title: '🚫 Cartas banidas nesta partida', sections: [{ cards: banned.map((id) => DEF(id)) }], buttons: [{ label: 'Começar ▶', value: true, cls: 'primary' }] });
  startGame(opp, { hearts, khaos: true, banned });
}
