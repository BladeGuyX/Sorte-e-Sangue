'use strict';
/* ============================================================
   SORTE & SANGUE — interface, animações e entrada do jogador
   ============================================================ */

const $ = (s) => document.querySelector(s);

const ICON = {
  drop: '<svg viewBox="0 0 24 24" class="ic drop"><path d="M12 2C12 2 5 10.5 5 15a7 7 0 0 0 14 0C19 10.5 12 2 12 2z"/><path d="M9 14.5a3 3 0 0 0 2 3" stroke="rgba(255,255,255,.55)" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  clover: '<svg viewBox="0 0 24 24" class="ic clover"><path d="M12 12 L15 22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="6.6" r="4"/><circle cx="6.6" cy="12" r="4"/><circle cx="17.4" cy="12" r="4"/><circle cx="12" cy="17.4" r="4"/></svg>',
  bclover: '<svg viewBox="0 0 24 24" class="ic bclover"><path d="M12 12 L15 22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="6.6" r="4"/><circle cx="6.6" cy="12" r="4"/><circle cx="17.4" cy="12" r="4"/><circle cx="12" cy="17.4" r="4"/><path d="M12 8.2c0 0-2.7 3.2-2.7 5a2.7 2.7 0 0 0 5.4 0c0-1.8-2.7-5-2.7-5z" fill="#2b0306"/></svg>',
  sword: '<svg viewBox="0 0 24 24" class="ic sword"><path d="M20.5 2.5l-1 4.6L9.4 17.2l-2.6-2.6L16.9 4.5z"/><path d="M5.2 13.5l5.3 5.3-1.5 1.5-1.6-1.6-2.6 2.6-1.6-1.6 2.6-2.6-1.6-1.6z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" class="ic heart"><path d="M12 21s-7.6-4.7-9.6-9.3C1.1 8.5 3.3 4.8 6.9 4.8c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.6 0 5.8 3.7 4.5 6.9C19.6 16.3 12 21 12 21z"/></svg>',
};

const UI = {
  busy: false, picking: null, fresh: new Set(), thinking: false, preview: '',
  revealedFor: null, extraCards: [],
};

const viewer = () => (S.mode === 'online' ? Net.myId : S.mode === 'ai' ? 0 : S.current);
const isHumanTurn = () => S && !cur().isAI && viewer() === S.current && S.phase !== 'over';

/* ---------------- cartas ---------------- */

function costHTML(d) {
  const c = d.cost;
  if (c.t === 'free') return '';
  if (c.t === 'blood') {
    const drops = c.v >= 4 ? `${ICON.drop}<b>×${c.v}</b>` : ICON.drop.repeat(c.v);
    return `<div class="c-cost blood" title="Sangue ${c.v}">${drops}</div>`;
  }
  if (c.t === 'luck') return `<div class="c-cost luck" title="Sorte ${c.v}">${ICON.clover}<b>${c.v}</b></div>`;
  return `<div class="c-cost bluck" title="Sorte de sangue ${c.v}">${ICON.bclover}<b>${c.v}</b></div>`;
}

function costLabel(d) {
  const c = d.cost;
  if (d.fusion) return `Fusão — materiais em jogo + ${FUSION_COST} corações`;
  if (c.t === 'free') return 'Sem custo';
  if (c.t === 'blood') return `Sangue ${c.v} — sacrifique ${c.v} combatente${c.v > 1 ? 's' : ''} seu${c.v > 1 ? 's' : ''}`;
  if (c.t === 'luck') return `Sorte ${c.v} — precisa ter ${c.v} ou mais de sorte (não gasta)`;
  return `Sorte de sangue ${c.v} — gasta ${c.v} de sorte`;
}

function typeLabel(d) {
  if (d.token) return 'Ficha';
  if (d.fusion) return d.type === 'magic' ? 'Fusão · Magia Passiva' : 'Fusão';
  if (d.type === 'combatant') return 'Combatente';
  return d.kind === 'active' ? 'Magia · Ativa' : 'Magia · Passiva';
}

// o Coringa disfarçado é escondido de quem não o controla
const hiddenDisguise = (c) => !!(c && c.disguise && S && S.players && viewer() !== c.controller);
// poder que o jogador desta tela enxerga (no disfarce, troca a base do Coringa pela da carta imitada)
const seenPower = (c, ctx = {}) => (hiddenDisguise(c) ? apparentPower(c, ctx) : power(c, ctx));
// sorte que o jogador desta tela enxerga (a do oponente pode estar com a fachada do Coringa)
const seenLuck = (p) => (S && S.players && viewer() !== p.id ? luckTxt(p) : p.luck);
const excaliburOn = (c) => S && S.players && S.players.some((pl) => pl.magic.some((m) => m && (m.bound === c || m.boundUid === c.uid)));

function cardHTML(c, o = {}) {
  const inst = !!c.defId;
  const masked = inst && hiddenDisguise(c);
  const d = DEF(inst ? (masked ? c.disguise : c.defId) : c.id);
  const abId = inst ? c.abilityId : d.id;
  const copied = inst && abId !== d.id;
  const cls = ['card', d.type, d.kind || '', d.token ? 'token' : '', d.fusion ? 'fusion' : '', inst && c.vanish ? 'clone' : '', o.extra || ''];
  if (inst && UI.fresh.has(c.uid)) cls.push('summon');
  let text = d.text;
  if (inst && c.disguise && !masked) text = `<span class="copied">Disfarçado de ${DEF(c.disguise).name}:</span> ${DEF(c.disguise).text}`;
  else if (copied && !masked) text = `<span class="copied">Efeito de ${DEF(abId).name}:</span> ${DEF(abId).text}`;
  else if (d.fusion) text = `<span class="mats">${d.materials.map((id) => DEF(id).name).join(' + ')}.</span> ${text}`;
  let bottom = '';
  if (d.type === 'combatant') {
    const pw = inst ? (onField(c) ? seenPower(c) : d.power + c.bonus) : d.power;
    const mod = pw > d.power ? 'up' : pw < d.power ? 'down' : '';
    bottom = `<div class="c-power ${mod}">${ICON.sword}<span>${pw}</span></div>`;
  }
  const badges = [];
  const live = inst && S && locate(c);
  if (live && c.charges) {
    const [ico, tip] = { muralha: ['🛡', 'Dano que ainda absorve'], bastiao: ['🛡', 'Dano que ainda absorve'], protecao: ['🕊', 'Magias que ainda anula'] }[c.defId] || ['⏳', 'Turnos restantes'];
    badges.push(`<div class="c-badge" title="${tip}">${ico} ${c.charges}</div>`);
  }
  if (live && c.timer != null) badges.push(`<div class="c-badge timer" title="Turnos até se autodestruir">⏳ ${c.timer}</div>`);
  if (live && c.spellCharges) badges.push(`<div class="c-badge atk" title="Magias que ainda anula">🕊 ${c.spellCharges}</div>`);
  if (inst && c.disguise && !masked) badges.push(`<div class="c-badge ward" title="Coringa disfarçado de ${DEF(c.disguise).name} (só você vê)">🎭</div>`);
  if (live && excaliburOn(c)) badges.push('<div class="c-badge copy" title="Empunha a Excalibur: +200 ao atacar e cura 1 coração por ataque">⚔️</div>');
  if (live && AB(c).spellWard && !c.wardUsed) badges.push('<div class="c-badge ward" title="Imune à próxima magia inimiga">✨</div>');
  if (live && c.movedTurn === S.turn && S.current === c.controller) badges.push('<div class="c-badge moved" title="Trocou de posição: não ataca neste turno">↔</div>');
  else if (live && S.phase === 'combat' && c.controller === S.current && onField(c)) {
    const a = AB(c), max = a.attacks || 1;
    if (max > 1 && !a.cantAttack) badges.push(`<div class="c-badge atk">⚔ ${Math.max(0, max - c.attacksUsed)}</div>`);
  }
  if (copied && !c.disguise) badges.push('<div class="c-badge copy" title="Efeito copiado">◈</div>');
  if (inst && c.vanish) badges.push('<div class="c-badge copy" title="Clone: some ao ser destruído ou descartado">👥</div>');
  if (live && c.scaredUntil >= S.turn) badges.push('<div class="c-badge moved" title="Assustado: não ataca no próximo turno do dono">😱</div>');
  if (live && S.phase === 'main' && c.controller === S.current && fusionOptions(ctl(c)).some((f) => f.materials.includes(c.defId)))
    badges.push('<div class="c-badge ward" title="Pronto para fusão">🧬</div>');
  let attr = ` data-def="${d.id}"`;
  if (inst) attr = o.modal ? ` data-muid="${c.uid}"` : ` data-uid="${c.uid}"`;
  return `<div class="${cls.join(' ')}"${attr} style="--hue:${d.hue}">
    <div class="c-top"><div class="c-name">${d.name}</div>${costHTML(d)}</div>
    <div class="c-art"><span>${d.art}</span>${badges.join('')}</div>
    <div class="c-type">${typeLabel(d)}</div>
    <div class="c-text">${text}</div>
    ${bottom}
  </div>`;
}

function findByUid(uid) {
  if (!S) return null;
  for (const p of S.players) {
    for (const z of ['hand', 'field', 'magic', 'discard']) {
      const c = p[z].find((x) => x && x.uid === uid);
      if (c) return c;
    }
  }
  return UI.extraCards.find((x) => x.uid === uid) || null;
}

/* ---------------- render ---------------- */

function slotHTML(p, zone, i, c) {
  const cls = ['slot', zone];
  const pk = UI.picking;
  if (pk && pk.candidates.some((x) => x.side === p.id && x.zone === zone && x.slot === i)) cls.push('pickable');
  if (pk && pk.marked && c && pk.marked.includes(c)) cls.push('marked');
  if (pk && pk.moving && c === pk.moving) cls.push('moving');
  if (c && zone === 'field' && isHumanTurn() && !UI.busy && canAttack(c)) cls.push('can-attack');
  if (c && zone === 'magic' && isHumanTurn() && p.id === S.current && !UI.picking) cls.push('own-magic');
  let inner = c ? cardHTML(c) : `<div class="slot-empty">${zone === 'field' ? '⚔' : '✦'}</div>`;
  if (c && zone === 'field' && isHumanTurn() && !UI.busy && !UI.picking && canMove(p, c)) {
    cls.push('movable');
    inner += `<button class="move-btn" data-move="${i}" title="Trocar de posição (1 por turno; quem troca não ataca neste turno)">↔</button>`;
  }
  return `<div class="${cls.join(' ')}" data-side="${p.id}" data-zone="${zone}" data-slot="${i}">${inner}</div>`;
}

function panelHTML(p) {
  const isCur = S.current === p.id && S.phase !== 'over';
  let hearts = '';
  if (MAX_HP <= 12) for (let i = 0; i < MAX_HP; i++) hearts += `<span class="heart ${i < p.hp ? 'full' : 'empty'}">${ICON.heart}</span>`;
  else hearts = `<span class="heart full">${ICON.heart}</span><b class="hp-num">${p.hp}</b><span class="hp-bar"><i style="width:${(100 * p.hp) / MAX_HP}%"></i></span><small>/${MAX_HP}</small>`;
  return `<div class="p-head"><div class="p-name">${p.isAI ? '🤖 ' : ''}${p.name}</div>${isCur ? '<div class="p-turn">VEZ</div>' : ''}</div>
    <div class="hearts" title="${p.hp}/${MAX_HP} corações">${hearts}</div>
    <div class="p-stats">
      <div class="stat luck" title="Sorte atual">${ICON.clover}<b>${seenLuck(p)}</b><small>Sorte</small></div>
      <div class="stat" title="Cartas no baralho"><i>📚</i><b>${p.deck.length}</b><small>Baralho</small></div>
      <div class="stat clickable" data-discard="${p.id}" title="Descarte (clique para ver)"><i>🗑️</i><b>${p.discard.length}</b><small>Descarte</small></div>
      <div class="stat" title="Cartas na mão (limite ${HAND_LIMIT})"><i>✋</i><b>${p.hand.length}/${HAND_LIMIT}</b><small>Mão</small></div>
    </div>
    <div class="p-extra">
      <span title="Cargas Sortudas (partida inteira): re-rolar a sorte ou comprar 1 carta extra no início do turno">✨ Cargas Sortudas: <b>${p.lucky}</b>/${LUCKY_CHARGES}</span>
      ${isCur ? `<span title="Trocar um combatente de posição (fase principal)">↔ Troca: <b>${p.moveUsed ? 'usada' : 'disponível'}</b></span>` : ''}
      ${p.luckLock ? `<span class="lock" title="Caixinha Dourada">🎁 Sorte guardada: ${p.luckLock.value + (viewer() !== p.id ? p.luckLock.mask || 0 : 0)} (${p.luckLock.turns} turno${p.luckLock.turns > 1 ? 's' : ''})</span>` : ''}
      ${p.luckDebt ? `<span class="debt" title="Efeito do Ladrão de Sorte">🦝 −${p.luckDebt} de sorte na próxima rolagem</span>` : ''}
    </div>`;
}

function renderMid() {
  const p = cur();
  const human = isHumanTurn();
  const canAct = human && !UI.busy && !UI.picking;
  const ph = S.phase;
  const step = (id, label) => `<span class="ph ${ph === id ? 'on' : ''}">${label}</span>`;
  let hint;
  if (ph === 'over') hint = 'Fim de jogo.';
  else if (UI.thinking) hint = '🤖 A IA está pensando…';
  else if (UI.waitingFor) hint = `⏳ Aguardando ${UI.waitingFor} decidir…`;
  else if (!human) hint = `${turnOf(p)}…`;
  else if (UI.preview) hint = UI.preview;
  else if (ph === 'main' && startWindow(p) && (canLuckyDraw(p) || canTradeDraw(p))) hint = 'Início do turno: compre cartas extras agora, se quiser.';
  else if (ph === 'main') hint = S.turn === 1 ? 'Jogue cartas da mão. Ninguém ataca no 1º turno.' : 'Jogue cartas e troque posições (clique no combatente). Depois, ataque.';
  else if (ph === 'combat') hint = 'Clique num combatente brilhando para atacar.';
  else if (ph === 'mulligan') hint = 'Conferindo as mãos iniciais…';
  else hint = '…';
  let btns = '';
  if (human && canLuckyDraw(p)) btns += `<button class="btn luck" id="btnLuckyDraw" ${canAct ? '' : 'disabled'} title="Gasta 1 Carga Sortuda (1 vez por turno, só antes de agir)">✨ +1 carta</button>`;
  if (human && canFuse(p)) btns += `<button class="btn fusion" id="btnFusion" ${canAct ? '' : 'disabled'} title="Fundir combatentes (custa 1 coração)">🧬 Fusão</button>`;
  if (human && canTradeDraw(p)) btns += `<button class="btn trade" id="btnTradeDraw" ${canAct ? '' : 'disabled'} title="Centro de Comércio: gasta ${TRADE_COST} de sorte (só antes de agir)">🏪 +1 carta (−${TRADE_COST})</button>`;
  if (ph === 'main' && S.turn > 1) btns += `<button class="btn atk" id="btnCombat" ${canAct ? '' : 'disabled'}>⚔ Atacar</button>`;
  if (ph === 'main' || ph === 'combat') btns += `<button class="btn primary" id="btnEnd" ${canAct ? '' : 'disabled'}>Encerrar turno ▶</button>`;
  $('#midbar').innerHTML = `
    <div class="mid-left"><div class="turnno">Turno ${S.turn}</div><div class="phases">${step('main', 'Principal')}<i>›</i>${step('combat', 'Ataque')}</div></div>
    <div class="mid-center"><div class="bigluck ${seenLuck(p) >= 15 ? 'hi' : seenLuck(p) <= 5 ? 'lo' : ''}">${ICON.clover}<b>${seenLuck(p)}</b></div><div class="mid-who">${luckOf(p)}</div></div>
    <div class="mid-right"><div class="hint">${hint}</div><div class="mid-btns">${btns}</div></div>`;
}

function renderHand(me) {
  const el = $('#meHand');
  const toggle = $('#btnHideHand');
  toggle.style.display = S.mode === 'hotseat' && UI.revealedFor === me.id ? '' : 'none';
  toggle.innerHTML = UI.handHidden ? '👁 Revelar mão' : '🙈 Esconder mão';
  const hidden = S.mode === 'hotseat' && (UI.revealedFor !== me.id || UI.handHidden);
  if (hidden) { el.innerHTML = me.hand.map(() => '<div class="hand-slot"><div class="card-back"></div></div>').join(''); layoutHand(el, me.hand.length); return; }
  const canPlayNow = isHumanTurn() && me.id === S.current && !UI.busy;
  el.innerHTML = me.hand.map((c, i) => {
    const extra = [];
    if (UI.selectedUid === c.uid) extra.push('selected');
    if (c.isNew) extra.push('drawn');
    if (canPlayNow) extra.push(canPlay(me, c).ok ? 'playable' : 'unplayable');
    return `<div class="hand-slot ${UI.selectedUid === c.uid ? 'sel' : ''}" data-hand="${c.uid}" style="--i:${i}">${cardHTML(c, { extra: extra.join(' ') })}</div>`;
  }).join('');
  me.hand.forEach((c) => { c.isNew = false; });
  layoutHand(el, me.hand.length);
}

function layoutHand(el, n) {
  const slots = el.querySelectorAll('.hand-slot');
  if (!slots.length) return;
  const w = slots[0].getBoundingClientRect().width || 100;
  const avail = el.clientWidth - 30;
  let gap = 10;
  if (n > 1 && n * w + (n - 1) * gap > avail) gap = (avail - n * w) / (n - 1);
  slots.forEach((s, i) => {
    const mid = (n - 1) / 2;
    s.style.marginLeft = i === 0 ? '0' : `${gap}px`;
    s.style.setProperty('--rot', `${(i - mid) * 2.2}deg`);
    s.style.setProperty('--dy', `${Math.abs(i - mid) * Math.abs(i - mid) * 1.6}px`);
  });
}

function render() {
  if (!S) return;
  const me = P(viewer()), op = opp(me);
  const pOpp = $('#panelOpp'), pMe = $('#panelMe');
  pOpp.dataset.player = op.id; pMe.dataset.player = me.id;
  pOpp.classList.toggle('current', S.current === op.id);
  pMe.classList.toggle('current', S.current === me.id);
  pOpp.innerHTML = panelHTML(op);
  pMe.innerHTML = panelHTML(me);
  // modo debug: dá para ver a mão do oponente
  $('#oppHand').innerHTML = S.debug && Debug.showOpp
    ? op.hand.map((c) => `<div class="opp-peek">${cardHTML(c)}</div>`).join('')
    : op.hand.map(() => '<div class="card-back mini"></div>').join('');
  $('#oppMagic').innerHTML = op.magic.map((c, i) => slotHTML(op, 'magic', i, c)).join('');
  $('#oppField').innerHTML = op.field.map((c, i) => slotHTML(op, 'field', i, c)).join('');
  $('#meField').innerHTML = me.field.map((c, i) => slotHTML(me, 'field', i, c)).join('');
  $('#meMagic').innerHTML = me.magic.map((c, i) => slotHTML(me, 'magic', i, c)).join('');
  renderHand(me);
  renderMid();
  renderPickBanner();
  if (UI.inspected && UI.inspected.defId) UI.inspect(findByUid(UI.inspected.uid) || UI.inspected);
  if (S.debug) Debug.refresh();
  Net.markDirty();
}

function renderPickBanner() {
  const b = $('#pickBanner');
  const pk = UI.picking;
  if (!pk) { b.classList.remove('show'); return; }
  const mid = $('#midbar');
  b.style.top = `${mid.offsetTop + mid.offsetHeight / 2}px`;
  b.innerHTML = `<span>${pk.prompt}</span>
    ${pk.confirmLabel ? `<button class="btn primary" data-pick="confirm">${pk.confirmLabel}</button>` : ''}
    ${pk.optional ? `<button class="btn" data-pick="cancel">${pk.cancelLabel || 'Cancelar'}</button>` : ''}`;
  b.classList.add('show');
}

/* ---------------- inspetor e registro ---------------- */

UI.inspect = function (c) {
  UI.inspected = c;
  const inst = !!c.defId;
  const masked = inst && hiddenDisguise(c);
  const d = DEF(inst ? (masked ? c.disguise : c.defId) : c.id);
  const lines = [`<div class="i-line"><span>Custo</span>${costLabel(d)}</div>`];
  if (d.type === 'combatant') {
    if (inst && onField(c)) {
      const pw = seenPower(c);
      lines.push(`<div class="i-line"><span>Poder</span><b>${pw}</b> <small>(base ${d.power}${c.bonus ? `, bônus ${c.bonus > 0 ? '+' : ''}${c.bonus}` : ''})</small></div>`);
      const a = AB(c);
      if (!a.cantAttack) lines.push(`<div class="i-line"><span>Ataques</span>${a.attacks || 1} por turno · dano direto ${directDamageLabel(c)}</div>`);
      lines.push(`<div class="i-line"><span>Dono</span>${ctl(c).name}</div>`);
    } else lines.push(`<div class="i-line"><span>Poder</span><b>${d.power + (inst ? c.bonus : 0)}</b></div>`);
  }
  if (d.fusion) lines.push(`<div class="i-line"><span>Materiais</span>${d.materials.map((id) => DEF(id).name).join(' + ')}</div>`);
  if (inst && c.disguise && !masked) lines.push(`<div class="i-line copy"><span>Disfarce</span>🎭 ${DEF(c.disguise).name} (o oponente vê esta carta)</div>`);
  else if (inst && !masked && c.abilityId !== c.defId) lines.push(`<div class="i-line copy"><span>Copiado</span>Efeito de ${DEF(c.abilityId).name}</div>`);
  if (inst && locate(c)) {
    if (AB(c).spellWard) lines.push(`<div class="i-line"><span>Imunidade</span>${c.wardUsed ? 'já usada' : '✨ ativa — anula a próxima magia inimiga'}</div>`);
    if (c.timer != null) lines.push(`<div class="i-line"><span>Restam</span>⏳ ${c.timer} turno(s) do dono</div>`);
    if (c.charges) lines.push(`<div class="i-line"><span>Restam</span>${['muralha', 'bastiao'].includes(c.defId) ? `🛡 ${c.charges} de dano` : c.defId === 'protecao' ? `🕊 ${c.charges} magia(s)` : `⏳ ${c.charges} turno(s)`}</div>`);
    if (c.spellCharges) lines.push(`<div class="i-line"><span>Anula</span>🕊 mais ${c.spellCharges} magia(s)</div>`);
    if (excaliburOn(c)) lines.push('<div class="i-line"><span>Excalibur</span>⚔️ +200 ao atacar, cura 1 coração por ataque</div>');
    const held = c.bound || (c.boundUid && findByUid(c.boundUid));
    if (c.defId === 'excalibur' && held) lines.push(`<div class="i-line"><span>Empunhada</span>${cn(held)}</div>`);
    if (c.movedTurn === S.turn && c.controller === S.current) lines.push('<div class="i-line"><span>Troca</span>Mudou de lugar: não ataca neste turno</div>');
  }
  $('#inspector').innerHTML = `<div class="i-card">${cardHTML(c, { modal: true })}</div><div class="i-info"><div class="i-type">${typeLabel(d)}</div>${lines.join('')}</div>`;
};

UI.addLog = function (e) {
  const box = $('#log');
  const div = document.createElement('div');
  div.className = `log-entry p${e.pid ?? 'n'}`;
  div.innerHTML = e.html;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
};

UI.toast = function (msg) {
  const t = $('#toast');
  t.innerHTML = msg;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(UI._toastT);
  UI._toastT = setTimeout(() => t.classList.remove('show'), 2400);
};

UI.setThinking = function (v) { UI.thinking = v; renderMid(); };

/* ---------------- escolhas ---------------- */

UI.pick = function (opts) {
  return new Promise((resolve) => {
    UI.picking = { ...opts, resolve };
    render();
  });
};

function resolvePick(v) {
  const pk = UI.picking;
  if (!pk) return;
  UI.picking = null;
  SFX.play('click');
  render();
  pk.resolve(v);
}

function modal({ title, html = '', sections = [], buttons = [], cls = '' }) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'modal-wrap';
    const secHTML = sections.map((s, si) => `<div class="m-sec">${s.label ? `<div class="m-label">${s.label}</div>` : ''}
      <div class="m-cards">${s.cards.length ? s.cards.map((c, ci) => `<div class="m-card ${s.clickable ? 'clickable' : ''}" data-s="${si}" data-c="${ci}">${cardHTML(c, { modal: true })}</div>`).join('') : '<div class="m-empty">Nenhuma carta.</div>'}</div></div>`).join('');
    ov.innerHTML = `<div class="modal ${cls}"><h3>${title}</h3>${html ? `<div class="m-body">${html}</div>` : ''}${secHTML}
      <div class="m-btns">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-b="${i}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`).join('')}</div></div>`;
    UI.extraCards = sections.flatMap((s) => s.cards);
    const done = (v) => {
      SFX.play('click');
      ov.classList.add('closing');
      setTimeout(() => ov.remove(), 160);
      UI.extraCards = [];
      resolve(v);
    };
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-b]');
      if (b) { done(buttons[+b.dataset.b].value); return; }
      const m = e.target.closest('.m-card.clickable');
      if (m) done(sections[+m.dataset.s].cards[+m.dataset.c]);
    });
    $('#overlay').appendChild(ov);
  });
}
UI.modal = modal;

UI.ask = async function (p, kind, d) {
  const who = S.mode === 'hotseat' && p.id !== S.current ? `<div class="who">${p.name} decide</div>` : '';
  switch (kind) {
    case 'confirm':
      return modal({ title: d.title, html: who + d.text, sections: d.cards ? [{ cards: d.cards }] : [],
        buttons: [{ label: d.yes || 'Sim', value: true, cls: 'primary' }, { label: d.no || 'Não', value: false }] });
    case 'pick': {
      const prompt = (who ? `${p.name}: ` : '') + d.prompt;
      return UI.pick({ ...d, prompt });
    }
    case 'card':
      return modal({ title: d.title, html: who + (d.text || ''), sections: [{ cards: d.cards, clickable: true }],
        buttons: d.optional ? [{ label: d.cancelLabel || 'Cancelar', value: null }] : [] });
    case 'choose':
      return modal({ title: d.title, html: who + (d.text || ''),
        buttons: d.options.map((o, i) => ({ label: o.label, value: o.value, cls: i === 0 ? 'primary' : '', disabled: o.disabled })) });
    case 'mulligan': {
      const name = S.mode === 'hotseat' ? `<div class="who">${p.name}</div>` : '';
      return modal({ title: 'Mão inicial', cls: 'wide',
        html: `${name}Não gostou da mão? Você pode re-rolá-la: as ${START_HAND} cartas voltam ao baralho e você compra ${START_HAND} novas. Essa chance é só agora, no começo da partida.`,
        sections: [{ cards: p.hand }],
        buttons: [{ label: 'Manter esta mão', value: 'keep', cls: 'primary' },
          { label: `🔄 Re-rolar mão (${d.left} restante${d.left > 1 ? 's' : ''})`, value: 'reroll' }] });
    }
    case 'crystal':
      return modal({ title: '🔮 Bola de Cristal', html: who + 'Você comprou esta carta. Quer ficar com ela, ou recusá-la e comprar outra?',
        sections: [{ cards: [d.card] }],
        buttons: [{ label: 'Ficar com ela', value: 'keep', cls: 'primary' }, { label: 'Recusar e comprar outra', value: 'reroll' }] });
    case 'handFull':
      return modal({ title: 'Mão cheia!', cls: 'wide',
        html: who + `Sua mão já tem ${HAND_LIMIT} cartas. Clique numa carta da sua mão para descartá-la e ficar com a nova — ou recuse a compra.`,
        sections: [{ label: 'Carta comprada', cards: [d.card] }, { label: 'Sua mão (clique para descartar)', cards: p.hand, clickable: true }],
        buttons: [{ label: 'Recusar a compra', value: null }] });
  }
  return null;
};

/* ---------------- efeitos visuais ---------------- */

const cardEl = (c) => document.querySelector(`#game [data-uid="${c.uid}"]`);
const slotEl = (side, zone, slot) => document.querySelector(`#game .slot[data-side="${side}"][data-zone="${zone}"][data-slot="${slot}"]`);

function floatAt(rect, text, cls) {
  const f = document.createElement('div');
  f.className = `float ${cls}`;
  f.innerHTML = text;
  f.style.left = `${rect.left + rect.width / 2}px`;
  f.style.top = `${rect.top + rect.height / 2}px`;
  $('#fx').appendChild(f);
  setTimeout(() => f.remove(), 1500);
}

UI.float = function (c, text, cls) {
  const el = cardEl(c);
  if (el) floatAt(el.getBoundingClientRect(), text, cls);
};

UI.floatPlayer = function (p, text, cls) {
  const el = document.querySelector(`.panel[data-player="${p.id}"] .hearts`);
  if (el) floatAt(el.getBoundingClientRect(), text, cls);
};

function impactAt(el) {
  const r = el.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'impact';
  f.style.left = `${r.left + r.width / 2}px`;
  f.style.top = `${r.top + r.height / 2}px`;
  $('#fx').appendChild(f);
  setTimeout(() => f.remove(), 600);
}

UI.animSummon = async function (c) {
  UI.fresh.add(c.uid);
  render();
  UI.fresh.delete(c.uid);
  SFX.play('place');
  await sleep(380);
};

UI.animDestroy = async function (c) {
  const el = cardEl(c);
  SFX.play('destroy');
  if (el) { el.classList.add('dying'); await sleep(480); }
};

UI.animAttack = async function (att, sideId, slot, zone = 'field') {
  const el = cardEl(att), target = slotEl(sideId, zone, slot);
  SFX.play('attack');
  if (!el || !target) { await sleep(300); return; }
  const a = el.getBoundingClientRect(), b = target.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  el.classList.add('attacking');
  setTimeout(() => impactAt(target), 300);
  await el.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: `translate(${-dx * 0.06}px, ${-dy * 0.06}px) scale(1.06)`, offset: 0.3 },
    { transform: `translate(${dx * 0.78}px, ${dy * 0.78}px) scale(1.12)`, offset: 0.56 },
    { transform: 'translate(0,0) scale(1)' },
  ], { duration: 560, easing: 'ease-in-out' }).finished;
  el.classList.remove('attacking');
};

UI.animClash = async function (att, def, pa, pd) {
  SFX.play('clash');
  const ea = cardEl(att), ed = cardEl(def);
  const cls = (x, y) => (x > y ? 'pw win' : x < y ? 'pw lose' : 'pw tie');
  if (ea) floatAt(ea.getBoundingClientRect(), pa, cls(pa, pd));
  if (ed) floatAt(ed.getBoundingClientRect(), pd, cls(pd, pa));
  await sleep(700);
};

UI.animDamage = async function (p, n) {
  SFX.play('hurt');
  render();
  const panel = document.querySelector(`.panel[data-player="${p.id}"]`);
  if (panel) {
    panel.classList.remove('hurt'); void panel.offsetWidth; panel.classList.add('hurt');
    setTimeout(() => panel.classList.remove('hurt'), 700);
  }
  const fl = document.createElement('div');
  fl.className = 'screen-flash';
  $('#fx').appendChild(fl);
  setTimeout(() => fl.remove(), 600);
  UI.floatPlayer(p, `−${n} ❤`, 'dmg');
  await sleep(600);
};

UI.animHeal = async function (p, n) {
  SFX.play('heal');
  render();
  UI.floatPlayer(p, `+${n} ❤`, 'heal');
  await sleep(500);
};

UI.rects = function (cards) {
  return cards.filter(Boolean).map((c) => { const el = cardEl(c); return { c, r: el && el.getBoundingClientRect() }; });
};

// anima cartas do lugar antigo até o novo (técnica FLIP)
UI.flip = async function (snap) {
  const anims = [];
  for (const { c, r } of snap) {
    const el = cardEl(c);
    if (!el || !r) continue;
    const n = el.getBoundingClientRect();
    el.style.zIndex = 30;
    anims.push(el.animate([
      { transform: `translate(${r.left - n.left}px, ${r.top - n.top}px)` },
      { transform: 'translate(0, 0)' },
    ], { duration: 380, easing: 'cubic-bezier(.3,.8,.3,1)' }).finished.then(() => { el.style.zIndex = ''; }));
  }
  await Promise.all(anims);
};

// opts.charges > 0: depois de cair, o jogador escolhe aceitar ou gastar uma Carga Sortuda. Retorna 'keep' | 'reroll'.
UI.rollDice = async function (label, value, opts = {}) {
  const ov = document.createElement('div');
  ov.className = 'dice-wrap';
  ov.innerHTML = `<div class="dice-box"><div class="d20 rolling">
      <svg viewBox="0 0 100 100"><polygon points="50,3 93,27 93,73 50,97 7,73 7,27" class="d-out"/><polygon points="50,22 78,68 22,68" class="d-in"/>
      <path d="M50,3 L50,22 M93,27 L78,68 M93,73 L78,68 M50,97 L78,68 M50,97 L22,68 M7,73 L22,68 M7,27 L22,68 M7,27 L50,22 M93,27 L50,22" class="d-edge"/></svg>
      <span class="d-num">?</span></div><div class="d-label">${label}</div></div>`;
  $('#overlay').appendChild(ov);
  const num = ov.querySelector('.d-num'), die = ov.querySelector('.d20');
  for (let i = 0; i < 13; i++) {
    num.textContent = 1 + Math.floor(Math.random() * 20);
    SFX.play('tick');
    await sleep(35 + i * 10);
  }
  num.textContent = value;
  die.classList.remove('rolling');
  die.classList.add('landed', value >= 15 ? 'hi' : value <= 5 ? 'lo' : 'mid');
  if (value === 20) { die.classList.add('crit'); SFX.play('crit'); }
  else if (value === 1) { die.classList.add('fail'); SFX.play('fail'); }
  else SFX.play('dice');
  ov.querySelector('.d-label').innerHTML = `${label}: <b>${value}</b>${value === 20 ? ' — CRÍTICO!' : value === 1 ? ' — que azar…' : ''}`;
  let choice = 'keep';
  if (opts.charges > 0) {
    ov.classList.add('interactive');
    const box = document.createElement('div');
    box.className = 'd-btns';
    box.innerHTML = `<button class="btn primary" data-d="keep">✔ Aceitar ${value}</button>
      <button class="btn" data-d="reroll">✨ Re-rolar (gasta 1 de ${opts.charges} Carga${opts.charges > 1 ? 's' : ''} Sortuda${opts.charges > 1 ? 's' : ''})</button>`;
    ov.querySelector('.dice-box').appendChild(box);
    choice = await new Promise((res) => box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-d]');
      if (b) { SFX.play('click'); res(b.dataset.d); }
    }));
  } else await sleep(value === 20 || value === 1 ? 1050 : 750);
  ov.classList.add('closing');
  await sleep(200);
  ov.remove();
  return choice;
};

UI.banner = async function (text) {
  const b = document.createElement('div');
  b.className = 'turn-banner';
  b.innerHTML = `<span>${text}</span>`;
  $('#overlay').appendChild(b);
  SFX.play('turn');
  await sleep(1000);
  b.remove();
};

UI.showPlay = async function (p, card) {
  const d = DEF(card.defId);
  const ov = document.createElement('div');
  ov.className = 'play-show';
  ov.innerHTML = `<div class="ps-label">${p.name} ${d.kind === 'active' ? 'usa' : 'joga'}</div><div class="ps-card">${cardHTML(card, { modal: true })}</div>`;
  $('#overlay').appendChild(ov);
  await sleep(p.isAI ? 950 : 700);
  ov.classList.add('closing');
  await sleep(180);
  ov.remove();
};

UI.passScreen = function (p, sub = '') {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'pass-screen';
    ov.innerHTML = `<div class="pass-box"><div class="pass-ico">🂠</div><h2>Vez de <b>${p.name}</b></h2>
      <p>Passe o computador para ${p.name}. O outro jogador não deve olhar a tela!${sub ? `<br>${sub}` : ''}</p>
      <button class="btn primary big">Estou pronto</button></div>`;
    ov.querySelector('button').addEventListener('click', () => {
      SFX.play('click');
      UI.revealedFor = p.id;
      UI.handHidden = false;
      ov.remove();
      render();
      resolve();
    });
    $('#overlay').appendChild(ov);
  });
};

UI.showGameOver = function () {
  if (document.querySelector('.pass-screen.over')) return;
  const w = P(S.winner), l = opp(w);
  const online = S.mode === 'online';
  const youWon = S.mode === 'ai' || online ? S.winner === viewer() : true;
  SFX.play(youWon ? 'win' : 'lose');
  const title = S.mode === 'ai' || online ? (youWon ? 'Vitória!' : 'Derrota…') : `${w.name} venceu!`;
  const ov = document.createElement('div');
  ov.className = 'pass-screen over';
  ov.innerHTML = `<div class="pass-box"><div class="pass-ico">${youWon ? '🏆' : '💀'}</div><h2>${title}</h2>
    <p>${l.name} ficou sem corações no turno ${S.turn}.</p>
    <div class="m-btns">${online && Net.role === 'guest'
      ? '<button class="btn big" disabled>Aguardando o anfitrião pedir revanche…</button>'
      : `<button class="btn primary big" data-again>${online ? 'Revanche' : 'Jogar de novo'}</button>`}<button class="btn big" data-menu>Menu</button></div></div>`;
  const again = ov.querySelector('[data-again]');
  if (again) again.addEventListener('click', () => { ov.remove(); startGame(S.mode, online ? { hearts: MAX_HP, names: [Net.myName, Net.oppName] } : S.opts); });
  ov.querySelector('[data-menu]').addEventListener('click', () => location.href = location.href.split('?')[0]);
  $('#overlay').appendChild(ov);
};

// convidado: o anfitrião começou (ou recomeçou) a partida
UI.beginOnlineGuest = function (m) {
  Net.myId = GUEST_ID;
  S = null;
  MAX_HP = m.hearts;
  UI.revealedFor = null;
  UI.handHidden = false;
  UI.inspected = null;
  UI.picking = null;
  UI.waitingFor = null;
  UI.busy = false;
  $('#log').innerHTML = '';
  $('#inspector').innerHTML = '<div class="i-empty">Passe o mouse sobre uma carta para ver os detalhes.</div>';
  $('#overlay').innerHTML = '';
  $('#netBadge').hidden = false;
  $('#netBadge').textContent = '🌐 Online';
  $('#netBadge').title = `Conectado com ${Net.oppName}`;
  showScreen('game');
};

UI.connectionLost = function (name) {
  if (document.querySelector('.pass-screen.lost')) return;
  UI.picking = null;
  const ov = document.createElement('div');
  ov.className = 'pass-screen over lost';
  ov.innerHTML = `<div class="pass-box"><div class="pass-ico">📡</div><h2>Conexão perdida</h2>
    <p>${name || 'O oponente'} saiu da partida ou a conexão caiu.</p>
    <div class="m-btns"><button class="btn primary big" data-menu>Voltar ao menu</button></div></div>`;
  ov.querySelector('[data-menu]').addEventListener('click', () => location.href = location.href.split('?')[0]);
  $('#overlay').appendChild(ov);
  SFX.play('lose');
};

/* ---------------- ações do jogador humano ---------------- */

async function act(fn) {
  if (UI.busy) return;
  UI.busy = true;
  render();
  try { await fn(); }
  catch (e) {
    if (e instanceof GameOver) { UI.busy = false; render(); UI.showGameOver(); return; }
    console.error(e);
    UI.toast('Erro: ' + e.message);
  } finally {
    UI.busy = false;
    if (S) render();
  }
}

// executa uma jogada do jogador desta tela: localmente (com validação) ou enviando ao anfitrião
async function perform(action) {
  if (S.mode === 'online' && Net.role === 'guest') return Net.sendAction(action);
  const ok = await runAction(cur(), action);
  if (!ok && S && S.phase !== 'over') { UI.toast('Jogada inválida.'); SFX.play('error'); }
  return ok;
}

async function humanPlay(card) {
  const p = cur();
  const chk = canPlay(p, card);
  if (!chk.ok) { UI.toast(chk.reason); SFX.play('error'); return; }
  const d = DEF(card.defId);
  const choice = {};
  UI.selectedUid = card.uid;
  try {
    if (d.type === 'combatant') {
      if (d.id === 'coringa') {
        const pick = await modal({ title: '🎭 Coringa — escolha o disfarce', cls: 'wide all-cards',
          html: 'O oponente vai ver o Coringa como a carta escolhida, e o efeito dela funciona até ele ser revelado (ao atacar, ser atacado ou ser destruído).',
          sections: [{ cards: DISGUISES, clickable: true }], buttons: [{ label: 'Cancelar', value: null }] });
        if (!pick) return;
        choice.disguise = pick.id;
        // custo aparente: só faz diferença em cartas de sangue ou sorte de sangue, e só se ela seria jogável agora
        const fake = pick.cost;
        if ((fake.t === 'blood' || fake.t === 'bluck') && disguiseOptions(p).some((x) => x.id === pick.id)) {
          const what = fake.t === 'blood' ? `sacrificar ${fake.v} de sangue de verdade` : `mostrar um gasto de ${fake.v} de sorte (seu gasto real continua 4)`;
          const pay = await modal({ title: '🎭 Pagar o custo aparente?', sections: [{ cards: [pick] }],
            html: `Para o disfarce de <b>${pick.name}</b> ficar mais crível, você pode ${what}. Sem pagar, o oponente não vê nenhum custo sendo pago.`,
            buttons: [{ label: 'Pagar (mais crível)', value: 'pay', cls: 'primary' }, { label: 'Não pagar', value: 'skip' }, { label: 'Cancelar', value: null }] });
          if (!pay) return;
          choice.payDisguise = pay === 'pay';
        }
      }
      choice.sacrifices = [];
      const blood = S.debug && S.debugFree ? 0 : d.cost.t === 'blood' ? d.cost.v : choice.payDisguise && DEF(choice.disguise).cost.t === 'blood' ? DEF(choice.disguise).cost.v : 0;
      if (blood) {
        let paid = 0;
        while (paid < blood) {
          const cands = fieldCands(p, (c) => !AB(c).cantSacrifice && !choice.sacrifices.includes(c));
          const pk = await UI.pick({ prompt: `Sacrifique combatentes para ${d.name} (sangue ${paid}/${blood})`, candidates: cands, optional: true, marked: choice.sacrifices });
          if (!pk) return;
          const s = p.field[pk.slot];
          choice.sacrifices.push(s);
          paid += bloodValue(s);
        }
      }
      const cands = summonSlots(p, card, choice.sacrifices);
      const pk = await UI.pick({
        prompt: d.id === 'peso' ? 'Escolha um espaço — o seu ou um livre do oponente' : `Escolha um espaço para ${d.name}`,
        candidates: cands, optional: true, marked: choice.sacrifices,
      });
      if (!pk) return;
      choice.side = pk.side; choice.slot = pk.slot;
    } else if (d.kind === 'passive') {
      const cands = p.magic.map((m, slot) => (m ? null : { side: p.id, zone: 'magic', slot })).filter(Boolean);
      const pk = await UI.pick({ prompt: `Escolha um espaço de magia para ${d.name}`, candidates: cands, optional: true });
      if (!pk) return;
      choice.slot = pk.slot;
    } else {
      const ab = ABILITIES[d.id];
      if (ab.targets) {
        const pk = await UI.pick({ prompt: `${d.name}: ${ab.prompt}`, candidates: ab.targets(p), optional: true });
        if (!pk) return;
        choice.target = pk;
      } else {
        const pk = await UI.pick({ prompt: `Usar ${d.name}?`, candidates: [], optional: true, confirmLabel: `Usar ${d.name}` });
        if (!pk) return;
      }
    }
  } finally { UI.selectedUid = null; }
  if (choice.sacrifices) choice.sacrifices = choice.sacrifices.map((c) => c.uid);
  await perform({ type: 'play', uid: card.uid, choice });
}

async function humanAttack(c) {
  const targets = attackTargets(c);
  let t = targets[0];
  if (targets.length > 1) {
    const taunt = tauntSlot(opp(ctl(c))) >= 0 ? ' (a Sentinela vai atrair este ataque!)' : '';
    t = await UI.pick({ prompt: `${DEF(c.defId).name}: escolha o alvo do ataque${taunt}`, optional: true, candidates: targets });
    if (!t) return;
  }
  clearPreview();
  await perform({ type: 'attack', uid: c.uid, slot: t.slot, zone: t.zone });
}

async function humanMove(c) {
  const p = ctl(c), from = locate(c).slot;
  const cands = [0, 1, 2, 3].filter((s) => s !== from).map((s) => ({ side: p.id, zone: 'field', slot: s }));
  clearPreview();
  const pk = await UI.pick({ prompt: `Para onde mover ${DEF(c.defId).name}? (quem trocar de lugar não ataca neste turno)`,
    candidates: cands, optional: true, moving: c });
  if (pk) await perform({ type: 'move', from, to: pk.slot });
}

async function humanFusion(p) {
  const opts = fusionOptions(p);
  if (!opts.length) return;
  const f = await modal({ title: '🧬 Fusão', cls: 'wide',
    html: `Escolha a fusão. Os materiais são destruídos, você perde <b>${FUSION_COST} corações</b> e a carta de fusão surge num espaço à sua escolha.`,
    sections: [{ cards: opts, clickable: true }], buttons: [{ label: 'Cancelar', value: null }] });
  if (!f) return;
  const pk = await UI.pick({ prompt: `Onde ${f.name} vai surgir?`, candidates: fusionSlots(p, f), optional: true, marked: fusionMaterials(p, f) });
  if (pk) await perform({ type: 'fuse', id: f.id, slot: pk.slot });
}

async function showAllCards() {
  const sorted = (type) => DECK_POOL.filter((d) => d.type === type)
    .sort((a, b) => COST_ORDER[a.cost.t] - COST_ORDER[b.cost.t] || (a.cost.v || 0) - (b.cost.v || 0));
  await modal({ title: '📚 Todas as cartas', cls: 'wide all-cards',
    sections: [{ label: 'Combatentes', cards: sorted('combatant') }, { label: 'Magias', cards: sorted('magic') },
      { label: '🧬 Fusões (fora do baralho — surgem ao fundir os materiais no campo)', cards: FUSIONS }],
    buttons: [{ label: 'Fechar', value: null, cls: 'primary' }] });
}

async function humanDiscardMagic(p, slot) {
  const m = p.magic[slot];
  const ok = await modal({ title: 'Descartar magia?', html: `Remover ${cn(m)} do campo e mandá-la para o descarte?`,
    sections: [{ cards: [m] }], buttons: [{ label: 'Descartar', value: true, cls: 'danger' }, { label: 'Cancelar', value: false }] });
  if (ok) await perform({ type: 'discardMagic', slot });
}

async function humanEndTurn() {
  const p = cur();
  if (S.phase === 'main' && S.turn > 1 && p.field.some((c) => c && !AB(c).cantAttack)) {
    const ok = await modal({ title: 'Encerrar sem atacar?', html: 'Você tem combatentes que poderiam atacar. Encerrar o turno mesmo assim?',
      buttons: [{ label: 'Encerrar turno', value: true, cls: 'primary' }, { label: 'Voltar', value: false }] });
    if (!ok) return;
  }
  await perform({ type: 'end' });
}

function clearPreview() {
  UI.preview = '';
  document.querySelectorAll('.slot.targeted').forEach((s) => s.classList.remove('targeted'));
}

function previewAttack(c) {
  const o = opp(ctl(c));
  const taunt = tauntSlot(o);
  if (taunt < 0 && attackTargets(c).length > 1) { UI.preview = `🎯 ${DEF(c.defId).name} escolhe o alvo ao atacar.`; renderMid(); return; }
  const slot = taunt >= 0 ? taunt : locate(c).slot;
  const e = o.field[slot];
  const t = slotEl(o.id, 'field', slot);
  if (t) t.classList.add('targeted');
  const pa = power(c, { attacking: true });
  const trap = o.magic.some((m) => m && m.defId === 'armadilha');
  if (!e) UI.preview = trap ? `⛓️ Cuidado: ${o.name} tem uma Armadilha de Ferro!` : `Ataque direto: <b>${directDamageLabel(c)}</b> de dano em ${o.name}.`;
  else {
    const pd = seenPower(e, { defending: true });
    const res = pa > pd ? '<span class="good">vence</span>' : pa < pd ? '<span class="bad">é destruído</span>' : '<span class="meh">empate (ambos caem)</span>';
    UI.preview = `${taunt >= 0 ? '🗿 Atraído! ' : ''}${pa} vs ${pd} contra ${DEF(hiddenDisguise(e) ? e.disguise : e.defId).name} → ${res}`;
  }
  renderMid();
}

/* ---------------- eventos ---------------- */

document.addEventListener('click', (e) => {
  const bPick = e.target.closest('[data-pick]');
  if (bPick) { resolvePick(bPick.dataset.pick === 'confirm' ? { confirm: true } : null); return; }

  const disc = e.target.closest('[data-discard]');
  if (disc && S) {
    const p = P(+disc.dataset.discard);
    modal({ title: `Descarte de ${p.name}`, cls: 'wide', sections: [{ cards: [...p.discard].reverse() }], buttons: [{ label: 'Fechar', value: null }] });
    return;
  }

  if (e.target.closest('#btnAllCards')) { SFX.play('click'); showAllCards(); return; }
  if (e.target.closest('#btnHideHand')) { SFX.play('click'); UI.handHidden = !UI.handHidden; render(); return; }

  if (!S || S.phase === 'over' || !e.target.closest('#game')) return;
  const moveBtn = e.target.closest('[data-move]');
  if (moveBtn && !UI.picking && !UI.busy && isHumanTurn()) {
    const c = cur().field[+moveBtn.dataset.move];
    if (c) act(() => humanMove(c));
    return;
  }
  const slot = e.target.closest('.slot');
  const hand = e.target.closest('[data-hand]');

  if (UI.picking) {
    if (slot) {
      const side = +slot.dataset.side, zone = slot.dataset.zone, idx = +slot.dataset.slot;
      const cand = UI.picking.candidates.find((x) => x.side === side && x.zone === zone && x.slot === idx);
      if (cand) resolvePick(cand);
    }
    return;
  }

  if (e.target.closest('#btnCombat')) { SFX.play('click'); act(() => perform({ type: 'combat' })); return; }
  if (e.target.closest('#btnLuckyDraw')) { act(() => perform({ type: 'luckyDraw' })); return; }
  if (e.target.closest('#btnTradeDraw')) { act(() => perform({ type: 'tradeDraw' })); return; }
  if (e.target.closest('#btnFusion')) { act(() => humanFusion(cur())); return; }
  if (e.target.closest('#btnEnd')) { act(humanEndTurn); return; }
  if (UI.busy || !isHumanTurn()) return;
  const me = cur();

  if (hand) {
    const card = me.hand.find((c) => c.uid === +hand.dataset.hand);
    if (card) act(() => humanPlay(card));
    return;
  }
  if (slot) {
    const side = +slot.dataset.side, zone = slot.dataset.zone, idx = +slot.dataset.slot;
    const c = P(side)[zone][idx];
    if (!c || side !== me.id) return;
    if (zone === 'magic') { act(() => humanDiscardMagic(me, idx)); return; }
    if (canAttack(c)) act(() => humanAttack(c));
    else if ((S.phase === 'main' || AB(c).cantAttack) && canMove(me, c)) act(() => humanMove(c));
    else if (S.phase === 'main') { UI.toast('Você já trocou um combatente de posição neste turno.'); SFX.play('error'); }
    else { UI.toast(cantAttackReason(c)); SFX.play('error'); }
  }
});

document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('.card');
  if (!el || el.closest('#inspector')) return;
  let c = null;
  if (el.dataset.uid) c = findByUid(+el.dataset.uid);
  else if (el.dataset.muid) c = findByUid(+el.dataset.muid);
  if (!c && el.dataset.def) c = DEF(el.dataset.def);
  if (!c) return;
  if (S && $('#game').classList.contains('active')) UI.inspect(c);
  if (c.defId && S && !UI.busy && !UI.picking && isHumanTurn() && canAttack(c)) previewAttack(c);
});

document.addEventListener('mouseout', (e) => {
  const el = e.target.closest('.card');
  if (el && UI.preview && !el.contains(e.relatedTarget)) { clearPreview(); if (S) renderMid(); }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && UI.picking && UI.picking.optional) resolvePick(null);
});

UI.fit = function () {
  const board = $('#board');
  if (!board) return;
  const H = board.clientHeight || innerHeight, W = board.clientWidth || innerWidth;
  let cw = Math.min((H - 125) / 7, (W - 40) / 4.8, 132);
  cw = Math.max(cw, 58);
  document.documentElement.style.setProperty('--cwb', `${cw}px`);
};

window.addEventListener('resize', () => { UI.fit(); if (S && $('#game').classList.contains('active')) render(); });
