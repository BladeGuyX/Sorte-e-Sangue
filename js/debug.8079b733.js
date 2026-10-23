'use strict';
/* ============================================================
   SORTE & SANGUE — modo debug (para testes)
   Liberado no menu com Shift + K + M. Painel lateral que mexe
   livremente na partida: corações, sorte, cartas, tabuleiro...
   ============================================================ */

const Debug = {
  target: 0,        // jogador afetado pelas ações
  query: '',
  showOpp: false,   // mostrar a mão do oponente

  open() {
    let el = $('#debugPanel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'debugPanel';
      el.hidden = true;   // o toggle logo abaixo abre
      document.body.appendChild(el);
    }
    el.hidden = !el.hidden;
    if (!el.hidden) this.build();
  },

  close() { const el = $('#debugPanel'); if (el) el.hidden = true; },

  build() {
    const el = $('#debugPanel');
    el.innerHTML = `
      <div class="dbg-head"><b>🛠 Modo Debug</b><button class="icon-btn" data-dbg="close">✕</button></div>
      <div class="dbg-sec"><div class="dbg-label">Jogador afetado</div><div class="dbg-row" id="dbgTargets"></div><div class="dbg-stats" id="dbgStats"></div></div>
      <div class="dbg-sec"><div class="dbg-label">Corações</div><div class="dbg-row">
        <button class="btn" data-dbg="hp" data-v="-1">−1</button><button class="btn" data-dbg="hp" data-v="1">+1</button>
        <button class="btn" data-dbg="hpfull">Cheio</button><button class="btn danger" data-dbg="hpzero" title="Derrota imediata">Zerar</button></div></div>
      <div class="dbg-sec"><div class="dbg-label">Sorte e Cargas</div><div class="dbg-row">
        <input type="number" id="dbgLuck" min="0" max="${LUCK_CAP}" value="20"><button class="btn" data-dbg="luck">Definir sorte</button>
        <button class="btn" data-dbg="charges">Encher cargas</button></div></div>
      <div class="dbg-sec"><div class="dbg-label">Turno</div><div class="dbg-row">
        <button class="btn" data-dbg="draw">Comprar 1</button><button class="btn" data-dbg="renew" title="Ataques, troca de posição e compras extras do turno">Renovar turno</button>
        <button class="btn" data-dbg="clearhand">Esvaziar mão</button></div>
        <label class="dbg-check"><input type="checkbox" id="dbgFree"> Custos grátis (sorte e sangue não são exigidos)</label>
        <label class="dbg-check"><input type="checkbox" id="dbgShowOpp"> Mostrar a mão do oponente</label></div>
      <div class="dbg-sec"><div class="dbg-label">Tabuleiro (clique numa carta depois)</div><div class="dbg-row">
        <button class="btn danger" data-dbg="kill">Destruir</button><button class="btn" data-dbg="remove" title="Tira do campo sem ativar efeitos">Remover sem efeitos</button>
        <button class="btn" data-dbg="pow" data-v="100">+100 poder</button><button class="btn" data-dbg="pow" data-v="-100">−100 poder</button></div></div>
      <div class="dbg-sec dbg-cards"><div class="dbg-label">Pegar carta</div>
        <input type="search" id="dbgSearch" class="search" placeholder="🔍 Buscar carta…" autocomplete="off" value="${this.query.replace(/"/g, '')}">
        <div id="dbgList" class="dbg-list"></div></div>`;
    $('#dbgFree').checked = !!S.debugFree;
    $('#dbgShowOpp').checked = this.showOpp;
    this.renderList();
    this.refresh();
  },

  refresh() {
    const el = $('#debugPanel');
    if (!el || el.hidden || !S) return;
    $('#dbgTargets').innerHTML = S.players.map((p) => `<button class="chip ${this.target === p.id ? 'on' : ''}" data-dbg="target" data-v="${p.id}">${p.name}</button>`).join('');
    const p = P(this.target);
    $('#dbgStats').textContent = `❤ ${p.hp}/${MAX_HP} · 🍀 ${p.luck} · ✨ ${p.lucky} · mão ${p.hand.length}/${HAND_LIMIT} · baralho ${p.deck.length}`;
  },

  renderList() {
    const all = [...DECK_POOL, ...FUSIONS, ...CARD_DEFS.filter((d) => d.token)].filter((d) => matchesSearch(d, this.query));
    $('#dbgList').innerHTML = all.map((d) => `<div class="dbg-card" title="${d.text.replace(/"/g, '&quot;')}">
        <span class="dbg-art">${d.art}</span><span class="dbg-name">${d.name}<small>${typeLabel(d)}</small></span>
        <button class="icon-btn" data-dbg="hand" data-v="${d.id}" title="Pôr na mão">Mão</button>
        <button class="icon-btn" data-dbg="field" data-v="${d.id}" title="${d.kind === 'active' ? 'Usar o efeito agora' : 'Pôr no campo sem custo'}">${d.kind === 'active' ? 'Usar' : 'Campo'}</button>
      </div>`).join('') || '<div class="m-empty">Nenhuma carta.</div>';
  },

  note(msg) { log(`🛠 <i>Debug:</i> ${msg}`); },

  allBoardCands() {
    return S.players.flatMap((pl) => [...fieldCands(pl), ...pl.magic.map((m, slot) => (m ? { side: pl.id, zone: 'magic', slot } : null)).filter(Boolean)]);
  },

  async pickBoard(prompt, fieldOnly) {
    const cands = fieldOnly ? S.players.flatMap((pl) => fieldCands(pl)) : this.allBoardCands();
    if (!cands.length) { UI.toast('Não há cartas no tabuleiro.'); return null; }
    const pk = await UI.pick({ prompt: `🛠 ${prompt}`, candidates: cands, optional: true });
    return pk && P(pk.side)[pk.zone][pk.slot];
  },

  // coloca uma carta em jogo sem pagar nada (combatentes e passivas) ou resolve uma magia ativa
  async putInPlay(p, id) {
    const d = DEF(id), card = newInstance(id, p.id);
    if (d.type === 'combatant') {
      const slot = p.field.indexOf(null);
      if (slot < 0) { UI.toast('Sem espaço de combatente livre.'); return; }
      this.note(`${cn(card)} entra no campo de ${p.name}.`);
      await summon(p, card, p, slot);
    } else if (d.kind === 'passive') {
      const slot = p.magic.indexOf(null);
      if (slot < 0) { UI.toast('Sem espaço de magia livre.'); return; }
      this.note(`${cn(card)} entra na zona de magia de ${p.name}.`);
      card.controller = p.id;
      p.magic[slot] = card;
      const a = ABILITIES[id] || {};
      if (a.onPlace) a.onPlace(card);
      await UI.animSummon(card);
      if (a.onEnter) await a.onEnter(card, p);
    } else {
      const ab = ABILITIES[id];
      if (ab.usable && !ab.usable(p)) { UI.toast(ab.unusableMsg); return; }
      let t;
      if (ab.targets) {
        const cands = ab.targets(p);
        if (!cands.length) { UI.toast('Nenhum alvo válido.'); return; }
        t = await ask(p, 'pick', { prompt: `${d.name}: ${ab.prompt}`, candidates: cands, optional: true, purpose: ab.purpose });
        if (!t) return;
      }
      this.note(`${p.name} usa ${cn(card)} sem custo.`);
      await UI.showPlay(p, card);
      const prev = S.effectSource;
      S.effectSource = card;
      try { await ab.resolve(p, t); } finally { S.effectSource = prev; }
    }
    render();
  },

  async run(action, v) {
    const p = P(this.target);
    switch (action) {
      case 'hp':
        if (+v > 0) { p.hp = Math.min(MAX_HP, p.hp + 1); this.note(`${p.name} +1 coração.`); render(); }
        else { this.note(`${p.name} −1 coração.`); await damage(p, 1); }
        break;
      case 'hpfull': p.hp = MAX_HP; this.note(`${p.name} com corações cheios.`); render(); break;
      case 'hpzero': this.note(`${p.name} zerado.`); await damage(p, p.hp); break;
      case 'luck': {
        const n = Math.max(0, Math.min(LUCK_CAP, Math.round(+$('#dbgLuck').value) || 0));
        p.luck = n; p.luckMask = 0;
        this.note(`sorte de ${p.name} = ${n}.`);
        render();
        break;
      }
      case 'charges': p.lucky = LUCKY_CHARGES; this.note(`Cargas Sortudas de ${p.name} cheias.`); render(); break;
      case 'draw': this.note(`${p.name} compra 1 carta.`); await draw(p); break;
      case 'clearhand':
        for (const c of p.hand.splice(0)) toDiscard(p, c);
        this.note(`mão de ${p.name} descartada.`);
        render();
        break;
      case 'renew':
        for (const c of p.field) if (c) { c.attacksUsed = 0; c.extraAttackUsed = false; c.movedTurn = 0; c.scaredUntil = 0; }
        p.moveUsed = false; p.acted = false; p.luckyDrawUsed = false;
        if (S.current === p.id) S.tauntUsed = false;
        this.note(`turno de ${p.name} renovado (ataques, troca e compras extras).`);
        render();
        break;
      case 'hand': {
        if (p.hand.length >= HAND_LIMIT) { UI.toast(`Mão de ${p.name} cheia (limite ${HAND_LIMIT}).`); return; }
        const c = newInstance(v, p.id);
        c.isNew = true;
        p.hand.push(c);
        this.note(`${cn(c)} vai para a mão de ${p.name}.`);
        SFX.play('draw');
        render();
        break;
      }
      case 'field': await this.putInPlay(p, v); break;
      case 'kill': {
        const c = await this.pickBoard('Escolha a carta a destruir (efeitos de destruição ativam).');
        if (!c) return;
        this.note(`destruindo ${cn(c)}.`);
        await destroy(c, { noSave: true, selfDestruct: true });
        break;
      }
      case 'remove': {
        const c = await this.pickBoard('Escolha a carta a remover (sem efeitos).');
        if (!c) return;
        const l = locate(c);
        this.note(`${cn(c)} removido sem efeitos.`);
        await UI.animDestroy(c);
        l.p[l.zone][l.slot] = null;
        toDiscard(P(c.owner), c);
        if (l.zone === 'magic') await magicGone(c);
        render();
        break;
      }
      case 'pow': {
        const c = await this.pickBoard(`Escolha o combatente (${+v > 0 ? '+' : ''}${v} de poder).`, true);
        if (!c) return;
        c.bonus += +v;
        UI.float(c, `${+v > 0 ? '+' : ''}${v}`, +v > 0 ? 'buff' : 'debuff');
        this.note(`${cn(c)} ${+v > 0 ? '+' : ''}${v} de poder.`);
        render();
        break;
      }
    }
  },
};

document.addEventListener('click', (e) => {
  if (e.target.closest('#btnDebugPanel')) { SFX.play('click'); Debug.open(); return; }
  const b = e.target.closest('[data-dbg]');
  if (!b || !S || !S.debug) return;
  const action = b.dataset.dbg, v = b.dataset.v;
  if (action === 'close') { Debug.close(); return; }
  if (action === 'target') { Debug.target = +v; Debug.refresh(); return; }
  if (UI.busy || UI.picking) { UI.toast('Aguarde a ação atual terminar.'); return; }
  if (S.phase === 'over') { UI.toast('A partida acabou.'); return; }
  SFX.play('click');
  act(() => Debug.run(action, v));
});

document.addEventListener('change', (e) => {
  if (!S || !S.debug) return;
  if (e.target.id === 'dbgFree') { S.debugFree = e.target.checked; Debug.note(`custos grátis ${S.debugFree ? 'ligados' : 'desligados'}.`); render(); }
  if (e.target.id === 'dbgShowOpp') { Debug.showOpp = e.target.checked; render(); }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'dbgSearch') { Debug.query = e.target.value; Debug.renderList(); }
});
