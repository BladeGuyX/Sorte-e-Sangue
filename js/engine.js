'use strict';
/* ============================================================
   SORTE & SANGUE — motor de regras
   ============================================================ */

let S = null;      // estado da partida
let UID = 1;
class GameOver extends Error {}

const CARD_BY_ID = Object.fromEntries(CARD_DEFS.map((d) => [d.id, d]));
const DEF = (id) => CARD_BY_ID[id];
const AB = (c) => ABILITIES[c.abilityId] || {};
const P = (i) => S.players[i];
const cur = () => S.players[S.current];
const opp = (p) => S.players[1 - p.id];
const ctl = (c) => S.players[c.controller];
const cn = (c) => `<b class="cn">${DEF(c.defId).name}</b>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const d20 = () => 1 + Math.floor(Math.random() * 20);
const hearts = (n) => (n === 1 ? '1 coração' : `${n} corações`);
// textos que soam naturais com os nomes "Você" e "IA"
const luckOf = (p) => (S.mode === 'ai' ? (p.isAI ? 'Sorte da IA' : 'Sua sorte') : `Sorte de ${p.name}`);   // online: nomes neutros, o texto vai para os dois
const turnOf = (p) => (S.mode === 'ai' ? (p.isAI ? 'Turno da IA' : 'Seu turno') : `Turno de ${p.name}`);

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newInstance(defId, owner) {
  return { uid: UID++, defId, abilityId: defId, bonus: 0, owner, controller: owner,
    attacksUsed: 0, extraAttackUsed: false, charges: 0, isNew: false };
}

// cartas que entram no baralho padrão e no montador de decks (fichas e fusões ficam de fora)
const DECK_POOL = CARD_DEFS.filter((d) => !d.token && !d.fusion);
const FUSIONS = CARD_DEFS.filter((d) => d.fusion);

// deckIds: lista de ids (modo de decks montados); sem ela, uma cópia de cada carta
function mkPlayer(id, name, isAI, deckIds) {
  const ids = deckIds || DECK_POOL.map((d) => d.id);
  const deck = shuffle(ids.map((defId) => newInstance(defId, id)));
  return { id, name, isAI, hp: MAX_HP, luck: 0, deck, hand: [], discard: [],
    field: Array(FIELD_SLOTS).fill(null), magic: Array(MAGIC_SLOTS).fill(null),
    lucky: LUCKY_CHARGES, luckDebt: 0, luckLock: null, lastRoll: null,
    moveUsed: false, acted: false, luckyDrawUsed: false };
}

// opts: { hearts, decks: [ids0, ids1], names: [n0, n1] }
// modo 'online': o jogador 0 é o anfitrião (roda as regras), o 1 é o convidado remoto
function newGame(mode, opts = {}) {
  UID = 1;
  MAX_HP = Math.max(1, Math.min(40, opts.hearts || 10));
  const names = opts.names || (mode === 'ai' ? ['Você', 'IA'] : ['Jogador 1', 'Jogador 2']);
  const decks = opts.decks || [];
  S = {
    mode, opts,
    players: [mkPlayer(0, names[0], false, decks[0]), mkPlayer(1, names[1], mode === 'ai', decks[1])],
    current: Math.random() < 0.5 ? 0 : 1,
    turn: 1, phase: 'start', winner: null, log: [], reserved: null, lastActive: {}, effectSource: null,
  };
  if (mode === 'online') S.players[1].remote = true;
  for (const p of S.players) for (let i = 0; i < START_HAND; i++) p.hand.push(p.deck.pop());
}

// clones, fichas e fusões não vão para o descarte: simplesmente somem
function toDiscard(p, card) {
  const d = DEF(card.defId);
  if (d.token || d.fusion || card.vanish) return;
  p.discard.push(card);
}

async function spawnToken(p, slot, id, msg) {
  const t = newInstance(id, p.id);
  p.field[slot] = t;
  if (msg) log(msg, p.id);
  await UI.animSummon(t);
  return t;
}

// dano direto de um atacante (Deus da Sorte rola, Imperador depende do campo)
function directDamageOf(c) {
  const a = AB(c);
  if (a.randomDirect) return 1 + Math.floor(Math.random() * 5);
  if (a.directDamageFn) return a.directDamageFn(c);
  return a.directDamage || 1;
}
const directDamageLabel = (c) => (AB(c).randomDirect ? '1 a 5' : String(directDamageOf(c)));

function log(html, pid = null) {
  const entry = { html, pid, turn: S.turn };
  S.log.push(entry);
  UI.addLog(entry);
}

async function ask(p, kind, data) {
  if (p.isAI) { await sleep(450); return AI.decide(p, kind, data); }
  if (p.remote) return Net.ask(p, kind, data);
  return UI.ask(p, kind, data);
}

/* ---------------- consultas ---------------- */

function locate(c) {
  for (const p of S.players) {
    let i = p.field.indexOf(c);
    if (i >= 0) return { p, zone: 'field', slot: i };
    i = p.magic.indexOf(c);
    if (i >= 0) return { p, zone: 'magic', slot: i };
  }
  return null;
}
const onField = (c) => { const l = locate(c); return !!l && l.zone === 'field'; };
const allField = () => S.players.flatMap((p) => p.field.filter(Boolean));

// Dragão Ancestral & cia: a primeira magia inimiga que os afetaria é anulada
function spellBlocked(caster, c) {
  if (!c || ctl(c) === caster || !AB(c).spellWard || c.wardUsed) return false;
  c.wardUsed = true;
  log(`${cn(c)} ignora a magia!`, c.controller);
  UI.float(c, '✨ Imune', 'info');
  SFX.play('block');
  render();
  return true;
}

function power(c, ctx = {}) {
  const d = DEF(c.defId);
  let v = d.power + c.bonus;
  const a = AB(c);
  if (a.powerMod) v += a.powerMod(c, ctx);
  if (onField(c)) {
    const p = ctl(c);
    for (const o of p.field) if (o && o !== c && AB(o).allyAura) v += AB(o).allyAura;
    for (const m of p.magic) if (m && ABILITIES[m.defId].allyPower) v += ABILITIES[m.defId].allyPower;
    // Líder de Torcida: os aliados ganham o poder dele (sem contar outros líderes, para não entrar em laço)
    if (!ctx.noCheer) for (const o of p.field) if (o && o !== c && AB(o).cheer) v += power(o, { noCheer: true });
  }
  return Math.max(0, v);
}

const sacrificable = (p) => p.field.filter((c) => c && !AB(c).cantSacrifice);
const bloodValue = (c) => AB(c).bloodValue || 1;   // Mr. Sanduíche vale 2
const bloodAvailable = (p) => sacrificable(p).reduce((s, c) => s + bloodValue(c), 0);

function summonSlots(p, card, sacs = []) {
  const res = [];
  const needsFront = ABILITIES[card.defId] && ABILITIES[card.defId].needsFront;   // Cavaleiro Errante
  p.field.forEach((c, slot) => {
    if ((!c || sacs.includes(c)) && (!needsFront || opp(p).field[slot])) res.push({ side: p.id, zone: 'field', slot });
  });
  if (ABILITIES[card.defId] && ABILITIES[card.defId].enemySide) {
    opp(p).field.forEach((c, slot) => { if (!c) res.push({ side: 1 - p.id, zone: 'field', slot }); });
  }
  return res;
}

function canPlay(p, card) {
  const no = (reason) => ({ ok: false, reason });
  if (S.current !== p.id) return no('Não é o seu turno.');
  if (S.phase === 'combat') return no('Na fase de ataque não dá mais para jogar cartas.');
  if (S.phase !== 'main') return no('Aguarde…');
  const d = DEF(card.defId), c = d.cost;
  if (c.t === 'luck' && p.luck < c.v) return no(`Precisa de ${c.v} de sorte (você tem ${p.luck}).`);
  if (c.t === 'bluck' && p.luck < c.v) return no(`Precisa gastar ${c.v} de sorte (você tem ${p.luck}).`);
  if (d.type === 'combatant') {
    if (c.t === 'blood') {
      if (bloodAvailable(p) < c.v) return no(`Precisa sacrificar ${c.v} de sangue em combatentes.`);
    } else if (!summonSlots(p, card).length) {
      return no(ABILITIES[d.id] && ABILITIES[d.id].needsFront ? 'Precisa de um espaço livre com um combatente inimigo à frente.' : 'Nenhum espaço de combatente livre.');
    }
  } else if (d.kind === 'passive') {
    if (!p.magic.includes(null)) return no('Nenhum espaço de magia livre.');
    if (opp(p).magic.some((m) => m && m.defId === 'selo')) return no('O Selo do Silêncio do oponente impede magias passivas.');
  } else {
    const ab = ABILITIES[d.id];
    if (ab.targets && !ab.targets(p).length) return no('Nenhum alvo válido para esta magia.');
    if (ab.usable && !ab.usable(p)) return no(ab.unusableMsg);
  }
  return { ok: true };
}

function canAttack(c) {
  const l = locate(c);
  if (!l || l.zone !== 'field' || l.p.id !== S.current) return false;
  if (S.phase !== 'combat' || S.turn === 1) return false;
  const a = AB(c);
  if (a.cantAttack || c.movedTurn === S.turn || c.scaredUntil === S.turn) return false;
  if (c.attacksUsed >= (a.attacks || 1)) return false;
  return attackTargets(c).length > 0;
}

function cantAttackReason(c) {
  if (S.turn === 1) return 'Ninguém ataca no primeiro turno da partida.';
  if (S.phase !== 'combat') return 'Vá para a fase de ataque (botão ⚔ Atacar).';
  if (AB(c).cantAttack) return `${DEF(c.defId).name} não pode atacar.`;
  if (c.movedTurn === S.turn) return `${DEF(c.defId).name} trocou de posição neste turno e não pode atacar.`;
  if (c.scaredUntil === S.turn) return `${DEF(c.defId).name} está assustado e não ataca neste turno.`;
  if (c.attacksUsed < (AB(c).attacks || 1)) return `${DEF(c.defId).name} não tem alvo (nunca ataca diretamente).`;
  return `${DEF(c.defId).name} já atacou neste turno.`;
}

/* ---------------- vida ---------------- */

async function damage(p, n, opts = {}) {
  if (n <= 0 || S.phase === 'over') return;
  if (opts.direct) {
    const strong = opts.source && power(opts.source, { attacking: true }) > 500;
    for (const m of p.magic) {
      if (!m || m.defId !== 'muralha' || n <= 0) continue;
      if (strong) { log(`${cn(m)} não segura um golpe tão forte quanto o de ${cn(opts.source)}!`, p.id); continue; }
      const absorbed = Math.min(m.charges, n);
      m.charges -= absorbed;
      n -= absorbed;
      log(`${cn(m)} absorve ${absorbed} de dano.`, p.id);
      UI.float(m, `🛡 ${absorbed}`, 'info');
      SFX.play('block');
      render();
      await sleep(350);
      if (m.charges <= 0) await destroy(m, { noSave: true, selfDestruct: true });
    }
    if (n <= 0) return;
  }
  p.hp = Math.max(0, p.hp - n);
  log(`${p.name} perde ${hearts(n)} (${p.hp}/${MAX_HP}).`, p.id);
  await UI.animDamage(p, n);
  if (p.hp <= 0) {
    S.phase = 'over';
    S.winner = 1 - p.id;
    log(`<b>${P(S.winner).name} venceu a partida!</b>`, S.winner);
    render();
    throw new GameOver();
  }
}

async function heal(p, n) {
  const before = p.hp;
  p.hp = Math.min(MAX_HP, p.hp + n);
  const got = p.hp - before;
  if (got > 0) { log(`${p.name} recupera ${hearts(got)}.`, p.id); await UI.animHeal(p, got); }
  else log(`${p.name} já está com os corações cheios.`, p.id);
}

/* ---------------- compra ---------------- */

async function draw(p, opts = {}) {
  if (!p.deck.length) {
    if (p.discard.length) {
      p.deck = shuffle(p.discard.splice(0));
      log(`O baralho de ${p.name} acabou: o descarte foi embaralhado de volta.`, p.id);
      UI.toast(`${p.name} reembaralha o descarte.`);
    } else {
      log(`${p.name} não tem mais cartas para comprar!`, p.id);
      await damage(p, 1);
      return null;
    }
  }
  const card = p.deck.pop();
  if (!opts.noCristal && p.magic.some((m) => m && m.defId === 'cristal')) {
    const r = await ask(p, 'crystal', { card });
    if (r === 'reroll') {
      toDiscard(p, card);
      log(`${p.name} usa a Bola de Cristal para recusar uma carta.`, p.id);
      SFX.play('magic');
      return draw(p, { noCristal: true });
    }
  }
  if (p.hand.length >= HAND_LIMIT) {
    const out = await ask(p, 'handFull', { card });
    if (!out) {
      toDiscard(p, card);
      log(`${p.name} está com a mão cheia e recusa a compra.`, p.id);
      render();
      return null;
    }
    p.hand.splice(p.hand.indexOf(out), 1);
    toDiscard(p, out);
    log(`${p.name} descarta ${cn(out)} para abrir espaço.`, p.id);
  }
  card.isNew = true;
  p.hand.push(card);
  SFX.play('draw');
  render();
  await sleep(250);
  return card;
}

/* ---------------- invocação e destruição ---------------- */

async function summon(p, card, side, slot) {
  card.controller = side.id;
  card.owner = side.id;
  card.attacksUsed = 0;
  card.extraAttackUsed = false;
  side.field[slot] = card;
  if (side !== p) {
    const where = S.mode === 'ai' ? (side.isAI ? 'no campo da IA' : 'no seu campo') : `no campo de ${side.name}`;
    log(`${p.name} invoca ${cn(card)} ${where}!`, p.id);
  }
  await UI.animSummon(card);
  const a = AB(card);
  if (a.onPlay) {
    const prev = S.effectSource;
    S.effectSource = card;
    try { await a.onPlay(card); } finally { S.effectSource = prev; }
  }
}

// opts: noSave (Mago/Arcanjo não salvam), sacrifice, fusion, combat, source (quem causou a destruição)
async function destroy(card, opts = {}) {
  const l = locate(card);
  if (!l) return null;
  const owner = l.p;
  const source = opts.source || S.effectSource;
  const voluntary = opts.sacrifice || opts.fusion;

  // Deus da Sorte: 50% de sobreviver e destruir quem tentou destruí-lo
  if (l.zone === 'field' && AB(card).luckyGod && !voluntary && !opts.selfDestruct) {
    const lucky = Math.random() < 0.5;
    UI.float(card, lucky ? '🎰 Sorte!' : '🎰 Azar…', lucky ? 'buff' : 'debuff');
    if (lucky) {
      log(`🎰 ${cn(card)} gira a roleta e escapa da morte!`, owner.id);
      SFX.play('crit');
      render();
      await sleep(500);
      if (source && source !== card && locate(source)) await destroy(source, { source: card });
      else if (source && source !== card) log(`${cn(source)} se desfaz diante do ${cn(card)}.`, owner.id);
      return null;
    }
    log(`🎰 A roleta do ${cn(card)} falha.`, owner.id);
  }

  // Arcanjo Guardião: salva automaticamente uma carta por turno
  if (!opts.noSave && !voluntary) {
    const angel = owner.field.find((c) => c && c !== card && AB(c).guardian && c.guardTurn !== S.turn);
    if (angel) {
      angel.guardTurn = S.turn;
      log(`${cn(angel)} estende as asas e protege ${cn(card)}!`, owner.id);
      UI.float(card, '👼 Salvo', 'heal');
      SFX.play('heal');
      render();
      await sleep(400);
      return null;
    }
  }

  // Mago Branco: salva a carta e morre no lugar
  if (!opts.noSave) {
    const mago = owner.field.find((c) => c && c !== card && AB(c).saver);
    if (mago) {
      const yes = await ask(owner, 'confirm', {
        title: 'Mago Branco',
        text: `${cn(card)} vai ser destruído. Sacrificar ${cn(mago)} para salvá-lo?`,
        cards: [card, mago], yes: 'Salvar', no: 'Deixar ser destruído', purpose: 'save', saved: card, mago,
      });
      if (yes) {
        log(`${cn(mago)} se sacrifica para salvar ${cn(card)}!`, owner.id);
        SFX.play('magic');
        return destroy(mago, { ...opts, noSave: true });
      }
    }
  }

  card.death = { power: l.zone === 'field' ? power(card) : 0, abilityId: card.abilityId,
    controller: card.controller, slot: l.slot, zone: l.zone, source, combat: !!opts.combat };
  await UI.animDestroy(card);
  owner[l.zone][l.slot] = null;

  const d = DEF(card.defId);
  const dAb = ABILITIES[card.death.abilityId] || {};
  card.bonus = 0; card.abilityId = card.defId; card.charges = 0;
  card.timer = null; card.wardUsed = false; card.movedTurn = 0; card.scaredUntil = 0; card.freeAimTurn = 0;
  card.controller = card.owner;
  toDiscard(P(card.owner), card);
  if (!opts.silent) log(opts.sacrifice ? `${cn(card)} foi sacrificado.` : `${cn(card)} foi destruído.`, owner.id);
  render();

  if (l.zone === 'field') {
    if (dAb.onDestroyed) await dAb.onDestroyed(card, card.death);
    for (const x of allField()) {
      const a = AB(x);
      if (a.onAnyDestroyed && locate(x)) await a.onAnyDestroyed(x, card);
    }
    for (const m of P(card.death.controller).magic) {
      if (m && m.defId === 'espelho') {
        const victim = opp(P(card.death.controller));
        log(`${cn(m)} reflete a perda: ${victim.name} perde 1 coração.`, card.death.controller);
        await damage(victim, 1);
      }
    }
  } else {
    // Selo do Silêncio: quem o destrói no próprio turno paga 1 coração
    if (card.defId === 'selo' && S.current !== card.death.controller && !opts.selfDestruct) {
      const culprit = cur();
      log(`O ${cn(card)} se parte e amaldiçoa ${culprit.name}!`, card.death.controller);
      await damage(culprit, 1);
    }
    await magicGone(card);
  }
  render();
  return card;
}

// uma magia saiu de um espaço de magia (destruída, descartada ou devolvida)
async function magicGone(m) {
  // Controle Remoto: o combatente controlado volta ao dono (ou é destruído sem espaço)
  if (m.controlled) {
    const t = m.controlled;
    m.controlled = null;
    const l = locate(t);
    if (l && l.zone === 'field' && t.controller !== t.owner) {
      const home = P(t.owner), back = m.fromSlot ?? l.slot;
      const free = home.field[back] ? home.field.indexOf(null) : back;   // volta ao espaço de origem, se possível
      if (free < 0) {
        log(`O sinal do ${cn(m)} cai e ${cn(t)} se perde (sem espaço para voltar).`, t.owner);
        await destroy(t, { noSave: true });
      } else {
        const snap = UI.rects([t]);
        l.p.field[l.slot] = null;
        home.field[free] = t;
        t.controller = home.id;
        log(`O sinal do ${cn(m)} cai: ${cn(t)} volta para ${home.name}.`, home.id);
        render();
        await UI.flip(snap);
      }
    }
  }
  // Devorador de Runas se alimenta
  for (const x of allField()) {
    if (!AB(x).runeEater) continue;
    x.bonus += 100;
    const p = ctl(x);
    p.luck = Math.min(LUCK_CAP, p.luck + 1);
    log(`${cn(x)} devora as runas de ${cn(m)}: +100 de poder e +1 de sorte.`, p.id);
    UI.float(x, '+100', 'buff');
    SFX.play('buff');
  }
  render();
}

/* ---------------- jogar cartas ---------------- */

// choice: { sacrifices:[cards], side, slot } p/ combatentes; { slot } p/ passivas; { target } p/ ativas
async function playCard(p, card, choice = {}) {
  const d = DEF(card.defId);
  p.acted = true;
  p.hand.splice(p.hand.indexOf(card), 1);
  if (p.isAI || d.kind === 'active') await UI.showPlay(p, card);
  log(`${p.name} joga ${cn(card)}.`, p.id);

  if (d.cost.t === 'bluck') {
    p.luck -= d.cost.v;
    UI.floatPlayer(p, `−${d.cost.v} 🍀`, 'debuff');
    log(`${p.name} gasta ${d.cost.v} de sorte (resta ${p.luck}).`, p.id);
  }

  // Proteção Divina do oponente anula a magia (o custo já foi pago)
  if (d.type === 'magic') {
    const shield = opp(p).magic.find((m) => m && m.defId === 'protecao' && m.charges > 0);
    if (shield) {
      shield.charges--;
      toDiscard(p, card);
      log(`${cn(shield)} anula ${cn(card)}!${shield.charges ? ` (resta ${shield.charges})` : ''}`, 1 - p.id);
      UI.float(shield, '🕊 Anulada', 'info');
      SFX.play('block');
      render();
      await sleep(500);
      if (shield.charges <= 0) await destroy(shield, { noSave: true, selfDestruct: true });
      render();
      return;
    }
  }

  if (d.type === 'combatant') {
    let sacBonus = 0;
    if (d.cost.t === 'blood') {
      sacBonus = choice.sacrifices.reduce((s, c) => s + (AB(c).sacBonus || 0), 0);
      S.reserved = { side: choice.side, slot: choice.slot };
      for (const s of choice.sacrifices) await destroy(s, { noSave: true, sacrifice: true });
      S.reserved = null;
    }
    const side = P(choice.side);
    let slot = choice.slot;
    if (side.field[slot]) slot = side.field.indexOf(null);
    if (slot < 0) { toDiscard(p, card); log(`Sem espaço para ${cn(card)}!`, p.id); render(); return; }
    if (sacBonus) {
      card.bonus += sacBonus;
      log(`O sacrifício saboroso dá +${sacBonus} de poder a ${cn(card)}.`, p.id);
    }
    await summon(p, card, side, slot);
    if (sacBonus) UI.float(card, `+${sacBonus}`, 'buff');
  } else if (d.kind === 'passive') {
    card.controller = p.id;
    p.magic[choice.slot] = card;
    const a = ABILITIES[d.id];
    if (a.onPlace) a.onPlace(card);
    SFX.play('magic');
    await UI.animSummon(card);
    if (a.onEnter) await a.onEnter(card, p);
  } else {
    SFX.play('magic');
    if (d.id !== 'eco') S.lastActive[p.id] = d.id;
    const prev = S.effectSource;
    S.effectSource = card;
    try { await ABILITIES[d.id].resolve(p, choice.target); } finally { S.effectSource = prev; }
    card.controller = p.id;
    toDiscard(p, card);
  }
  render();
}

/* ---------------- fusões ---------------- */

// fusões cujos materiais estão todos no campo de p
function fusionOptions(p) {
  return FUSIONS.filter((f) => f.materials.every((id) => p.field.some((c) => c && c.defId === id)));
}
const canFuse = (p) => S.current === p.id && S.phase === 'main' && p.hp > 1 && fusionOptions(p).length > 0;
const fusionMaterials = (p, f) => f.materials.map((id) => p.field.find((c) => c && c.defId === id));
// espaços onde a fusão pode surgir: livres ou ocupados pelos próprios materiais
function fusionSlots(p, f) {
  const mats = fusionMaterials(p, f);
  return p.field.map((c, slot) => (!c || mats.includes(c) ? { side: p.id, zone: 'field', slot } : null)).filter(Boolean);
}

async function fuse(p, f, slot) {
  const mats = fusionMaterials(p, f);
  p.acted = true;
  log(`🧬 ${p.name} funde ${mats.map(cn).join(' + ')} em <b>${f.name}</b>!`, p.id);
  SFX.play('magic');
  await damage(p, 1);
  S.reserved = { side: p.id, slot };
  for (const m of mats) await destroy(m, { noSave: true, fusion: true, silent: true });
  S.reserved = null;
  if (p.field[slot]) slot = p.field.indexOf(null);
  if (slot < 0) { log('Não sobrou espaço para a fusão!', p.id); return; }
  const card = newInstance(f.id, p.id);
  await UI.showPlay(p, card);
  await summon(p, card, p, slot);
  render();
}

async function discardMagic(p, slot) {
  const m = p.magic[slot];
  if (!m) return;
  await UI.animDestroy(m);
  p.magic[slot] = null;
  m.charges = 0;
  toDiscard(p, m);
  log(`${p.name} descarta ${cn(m)} do campo.`, p.id);
  render();
  await magicGone(m);
}

/* ---------------- início do turno: compras extras ---------------- */

// as compras extras só valem logo depois da rolagem, antes de jogar, mover ou atacar
const startWindow = (p) => S.current === p.id && S.phase === 'main' && !p.acted;
const canLuckyDraw = (p) => startWindow(p) && p.lucky > 0 && !p.luckyDrawUsed;
const canTradeDraw = (p) => startWindow(p) && p.luck >= TRADE_COST && p.magic.some((m) => m && m.defId === 'centro');

async function luckyDraw(p) {
  if (!canLuckyDraw(p)) return;
  p.lucky--;
  p.luckyDrawUsed = true;
  log(`${p.name} gasta 1 Carga Sortuda para comprar uma carta (restam ${p.lucky}).`, p.id);
  SFX.play('luck');
  await draw(p);
}

async function tradeDraw(p) {
  if (!canTradeDraw(p)) return;
  p.luck -= TRADE_COST;
  log(`${p.name} paga ${TRADE_COST} de sorte no Centro de Comércio por uma carta (sorte ${p.luck}).`, p.id);
  UI.floatPlayer(p, `−${TRADE_COST} 🍀`, 'debuff');
  await draw(p);
}

/* ---------------- troca de posição ---------------- */

function canMove(p, c) {
  if (S.current !== p.id || p.moveUsed || S.phase !== 'main') return false;
  const l = locate(c);
  return !!l && l.zone === 'field' && l.p === p;
}

// move um combatente para outro espaço; se estiver ocupado, os dois trocam de lugar
async function moveCombatant(p, from, to) {
  const a = p.field[from], b = p.field[to];
  const snap = UI.rects([a, b]);
  p.field[from] = b;
  p.field[to] = a;
  p.moveUsed = true;
  p.acted = true;
  a.movedTurn = S.turn;
  if (b) b.movedTurn = S.turn;
  log(b ? `${p.name} troca ${cn(a)} de lugar com ${cn(b)}.` : `${p.name} move ${cn(a)} para outro espaço.`, p.id);
  SFX.play('place');
  render();
  await UI.flip(snap);
}

/* ---------------- combate ---------------- */

// alvos possíveis de um ataque: { side, zone, slot }
function attackTargets(c) {
  const o = opp(ctl(c)), a = AB(c), front = locate(c).slot;
  const anywhere = a.anyTarget || a.sniper || c.freeAimTurn === S.turn;
  let field = (anywhere ? [0, 1, 2, 3] : [front]).map((slot) => ({ side: o.id, zone: 'field', slot }));
  if (a.noDirect) field = field.filter((t) => o.field[t.slot]);   // Cavaleiro Errante
  const magic = a.magicAttacker || a.sniper ? magicCands(o) : [];
  return [...field, ...magic];
}

// Sentinela de Pedra do defensor que ainda vai atrair o 1º ataque deste turno
function tauntSlot(o) {
  if (S.tauntUsed) return -1;
  return o.field.findIndex((c) => c && AB(c).taunt);
}

async function attack(att, slot, opts = {}) {
  const p = ctl(att), o = opp(p);
  if (!opts.extra) att.attacksUsed++;
  let zone = opts.zone || 'field';
  const t = tauntSlot(o);
  S.tauntUsed = true;
  if (t >= 0 && !(zone === 'field' && slot === t)) {
    log(`${cn(o.field[t])} atrai o ataque de ${cn(att)} para si!`, o.id);
    UI.float(o.field[t], '🗿 Provocação', 'info');
    zone = 'field';
    slot = t;
  }
  if (zone === 'magic') {
    const m = o.magic[slot];
    if (!m) return;
    await UI.animAttack(att, o.id, slot, 'magic');
    log(`${cn(att)} ataca ${cn(m)}!`, p.id);
    await destroy(m, { source: att });
    render();
    return;
  }
  const def = o.field[slot];
  if (!def && (opts.noDirect || AB(att).noDirect)) return;
  await UI.animAttack(att, o.id, slot);
  if (!def) {
    const trap = o.magic.find((m) => m && m.defId === 'armadilha');
    if (trap) {
      log(`⛓️ ${cn(att)} cai na ${cn(trap)}!`, o.id);
      await destroy(att, { source: trap });
      await destroy(trap, { noSave: true, selfDestruct: true });
      render();
      return;
    }
    const dmg = directDamageOf(att);
    log(`${cn(att)} ataca diretamente${AB(att).randomDirect ? ` e a roleta marca <b>${dmg}</b>` : ''}!`, p.id);
    await damage(o, dmg, { direct: true, source: att });
  } else {
    await combat(att, def);
  }
  render();
}

async function combat(att, def) {
  const pa = power(att, { attacking: true }), pd = power(def, { defending: true });
  log(`${cn(att)} (${pa}) enfrenta ${cn(def)} (${pd}).`, att.controller);
  await UI.animClash(att, def, pa, pd);
  if (pa > pd) {
    const v = await destroy(def, { source: att, combat: true });
    if (v && v !== att && locate(att) && AB(att).onKill) await AB(att).onKill(att, v, { attacking: true });
  } else if (pd > pa) {
    const v = await destroy(att, { source: def, combat: true });
    if (v && v !== def && locate(def) && AB(def).onKill) await AB(def).onKill(def, v, { attacking: false });
  } else {
    log('Empate! Os dois combatentes caem.', att.controller);
    await destroy(def, { source: att, combat: true });
    await destroy(att, { source: def, combat: true });
  }
}

/* ---------------- turnos ---------------- */

// rolagem de sorte; o jogador pode gastar Cargas Sortudas para rolar de novo
async function rollLuck(p, label) {
  const o = opp(p);
  const cat = o.field.some((c) => c && AB(c).blackCat);
  const thief = o.field.some((c) => c && AB(c).thiefCat);
  for (;;) {
    let r = d20();
    if (cat) {
      const r2 = d20();
      log(`Um gato preto cruza o caminho de ${p.name}: rolou ${r} e ${r2}, fica com o menor.`, o.id);
      if (thief && r !== r2) {
        const diff = Math.abs(r - r2);
        o.luck = Math.min(LUCK_CAP, o.luck + diff);
        log(`O Gatuno da Meia-Noite embolsa a diferença: ${o.name} +${diff} de sorte (agora ${o.luck}).`, o.id);
        UI.floatPlayer(o, `+${diff} 🍀`, 'luck');
      }
      r = Math.min(r, r2);
    }
    const shown = cat ? `${label} 🐈 (pior de 2)` : label;
    const res = p.remote ? await Net.rollDice(p, shown, r) : await UI.rollDice(shown, r, { charges: p.isAI ? 0 : p.lucky });
    const again = p.lucky > 0 && (p.isAI ? AI.wantsReroll(p, r) : res === 'reroll');
    if (!again) return r;
    p.lucky--;
    log(`${p.name} tirou ${r} e gasta 1 Carga Sortuda para rolar de novo (restam ${p.lucky}).`, p.id);
    SFX.play('dice');
    render();
    if (p.isAI) await sleep(250);
  }
}

// mão inicial: cada jogador pode trocar a mão até 2 vezes, só agora
async function mulliganPhase() {
  S.phase = 'mulligan';
  render();
  for (const id of [S.current, 1 - S.current]) {
    const p = P(id);
    if (S.mode === 'hotseat') await UI.passScreen(p, 'Hora de conferir sua mão inicial.');
    let left = MULLIGANS;
    while (left > 0) {
      const r = await ask(p, 'mulligan', { left });
      if (r !== 'reroll') break;
      left--;
      p.deck.push(...p.hand.splice(0));
      shuffle(p.deck);
      for (let i = 0; i < START_HAND; i++) p.hand.push(p.deck.pop());
      log(`${p.name} re-rola a mão inicial.`, p.id);
      SFX.play('draw');
      render();
    }
  }
}

async function startTurn() {
  const p = cur();
  S.phase = 'start';
  p.moveUsed = false;
  p.acted = false;
  p.luckyDrawUsed = false;
  S.tauntUsed = false;
  for (const c of p.field) if (c) { c.attacksUsed = 0; c.extraAttackUsed = false; }
  render();
  if (S.mode === 'hotseat') await UI.passScreen(p);
  await UI.banner(S.turn === 1 ? (S.mode === 'ai' ? (p.isAI ? 'A IA começa!' : 'Você começa!') : `${p.name} começa!`) : turnOf(p));
  log(`<span class="turn-line">— Turno ${S.turn}: ${p.name} —</span>`, p.id);

  if (S.turn > 1) await draw(p);

  if (p.luckLock && p.luckLock.turns > 0) {
    p.luckLock.turns--;
    p.luck = p.luckLock.value;
    p.lastRoll = null;
    log(`A Caixinha Dourada se abre: ${p.name} fica com <b>${p.luck}</b> de sorte sem rolar${p.luckLock.turns ? ' (mais 1 turno)' : ''}.`, p.id);
    if (!p.luckLock.turns) p.luckLock = null;
    UI.floatPlayer(p, `🎁 ${p.luck}`, 'luck');
    SFX.play('luck');
    render();
    await sleep(600);
  } else {
    const r = await rollLuck(p, luckOf(p));
    p.luck = r;
    p.lastRoll = r;
    log(`${p.name} rolou <b>${r}</b> de sorte.`, p.id);
  }
  if (p.luckDebt) {
    const lost = Math.min(p.luckDebt, p.luck);
    p.luck -= lost;
    p.luckDebt = 0;
    log(`O Ladrão de Sorte cobra a dívida: ${p.name} perde ${lost} de sorte (fica com ${p.luck}).`, p.id);
    render();
    UI.floatPlayer(p, `−${lost} 🍀`, 'debuff');
    SFX.play('debuff');
    await sleep(500);
  }
  render();

  for (const m of [...p.magic]) {
    if (m && ABILITIES[m.defId].onTurnStart && locate(m)) await ABILITIES[m.defId].onTurnStart(m, p);
  }
  for (const c of [...p.field]) {
    if (c && AB(c).onOwnerTurnStart && locate(c)) await AB(c).onOwnerTurnStart(c);
  }
  S.phase = 'main';
  render();
  if (p.isAI) await AI.takeTurn(p);
}

function goCombat() {
  if (S.phase !== 'main' || S.turn === 1) return;
  S.phase = 'combat';
  cur().acted = true;
  log(`${cur().name} entra na fase de ataque.`, S.current);
  SFX.play('phase');
  render();
}

async function endTurn() {
  S.phase = 'end';
  render();
  await sleep(250);
  S.turn++;
  S.current = 1 - S.current;
  await startTurn();
}

/* ---------------- ações do jogador ----------------
   Toda jogada humana passa por aqui (local ou vinda da rede), sempre revalidada contra o estado real.
   Retorna true se a ação foi aplicada. */

const sameCand = (a, b) => !!a && !!b && a.side === b.side && a.zone === b.zone && a.slot === b.slot;

// converte a escolha "serializável" (uids e espaços) de volta para o formato do playCard, validando tudo
function hydrateChoice(p, card, ch) {
  const d = DEF(card.defId);
  if (d.type === 'combatant') {
    const uids = Array.isArray(ch.sacrifices) ? ch.sacrifices : [];
    const sacrifices = uids.map((uid) => p.field.find((c) => c && c.uid === uid));
    if (sacrifices.some((c) => !c || AB(c).cantSacrifice) || new Set(sacrifices).size !== sacrifices.length) return null;
    if (d.cost.t === 'blood') {
      if (sacrifices.reduce((s, c) => s + bloodValue(c), 0) < d.cost.v) return null;
    } else if (sacrifices.length) return null;
    if (!summonSlots(p, card, sacrifices).some((t) => sameCand(t, { side: ch.side, zone: 'field', slot: ch.slot }))) return null;
    return { sacrifices, side: ch.side, slot: ch.slot };
  }
  if (d.kind === 'passive') {
    return Number.isInteger(ch.slot) && ch.slot >= 0 && ch.slot < MAGIC_SLOTS && p.magic[ch.slot] === null ? { slot: ch.slot } : null;
  }
  const ab = ABILITIES[d.id];
  if (!ab.targets) return {};
  const t = ab.targets(p).find((x) => sameCand(x, ch.target));
  return t ? { target: t } : null;
}

async function runAction(p, a) {
  if (!a || !S || S.phase === 'over' || S.current !== p.id) return false;
  switch (a.type) {
    case 'play': {
      const card = p.hand.find((c) => c.uid === a.uid);
      if (!card || !canPlay(p, card).ok) return false;
      const choice = hydrateChoice(p, card, a.choice || {});
      if (!choice) return false;
      await playCard(p, card, choice);
      return true;
    }
    case 'attack': {
      const c = p.field.find((x) => x && x.uid === a.uid);
      const zone = a.zone === 'magic' ? 'magic' : 'field';
      if (!c || !canAttack(c) || !attackTargets(c).some((t) => t.zone === zone && t.slot === a.slot)) return false;
      await attack(c, a.slot, { zone });
      return true;
    }
    case 'move': {
      const c = Number.isInteger(a.from) ? p.field[a.from] : null;
      if (!c || !canMove(p, c) || !Number.isInteger(a.to) || a.to < 0 || a.to >= FIELD_SLOTS || a.to === a.from) return false;
      await moveCombatant(p, a.from, a.to);
      return true;
    }
    case 'combat':
      if (S.phase !== 'main' || S.turn === 1) return false;
      goCombat();
      return true;
    case 'end':
      if (S.phase !== 'main' && S.phase !== 'combat') return false;
      await endTurn();
      return true;
    case 'fuse': {
      const f = FUSIONS.find((x) => x.id === a.id);
      if (!f || !canFuse(p) || !fusionOptions(p).includes(f) || !fusionSlots(p, f).some((t) => t.slot === a.slot)) return false;
      await fuse(p, f, a.slot);
      return true;
    }
    case 'luckyDraw':
      if (!canLuckyDraw(p)) return false;
      await luckyDraw(p);
      return true;
    case 'tradeDraw':
      if (!canTradeDraw(p)) return false;
      await tradeDraw(p);
      return true;
    case 'discardMagic':
      if ((S.phase !== 'main' && S.phase !== 'combat') || !Number.isInteger(a.slot) || !p.magic[a.slot]) return false;
      await discardMagic(p, a.slot);
      return true;
  }
  return false;
}
