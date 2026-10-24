'use strict';
/* ============================================================
   SORTE & SANGUE — oponente controlado pelo computador
   ============================================================ */

const AI_EXTRA = {
  vazio: 1.5, besta: 1.5, peso: -2, carmesim: 2, mago: 1, escudeiro: 0, rato: 0.5, lobo: 1.5,
  goblin: 0, aprendiz: 0.6, sentinela: 0.5, arqueira: 1, espadachim: 1, assassino: 0.5, golem: 1,
  dragao: 3, ceifador: 0.5, vampiro: 1, berserker: 0.5, paladino: 1, fenix: 1.5, hidra: 2.5,
  dados: 0, bobo: 0.3, gargula: 0.6, arauto: 0.6, necromante: 0.5, ladrao: 0.3, esqueleto: -0.5,
  antimago: 1, atirador: 2.5, lider: 1.5, sanduiche: 0.5, gato: 1.5, alquimista: 0.5, ladra: 1, devorador: 1,
  espantalho: 0.6, barril: 1.2, trapaceiro: 0.3, errante: 0, bardo: 0.8, mimico: 0.5, colecionador: 1, sucata: 1,
  deus: 3, imperador: 3, cerbero: 3, arcanjo: 3, conde: 3, gatuno: 2.5, lich: 4,
  coringa: 2, tita: 2.5, oraculo: 2.5, maestro: 3,
};
const AI_MAGIC = {
  cristal: 1.4, trevo: 2, estandarte: 2.4, muralha: 2.4, espelho: 2.5, grimorio: 3.5,
  pocao: 2, dissipar: 1.5, bencao: 2, maldicao: 2, fogo: 2.5, raio: 3,
  superbonus: 1.5, caixinha: 1.5, protecao: 2.4, centro: 2, ferradura: 1.8, desencantar: 2, eclipse: 2,
  roda: 1.2, pacto: 1, moeda: 1.5, armadilha: 2, furacao: 2, sobrecarga: 2, selo: 2, eco: 2, lua: 2, controle: 3,
  excalibur: 3, curapocao: 1.5, regen: 2.2, bastiao: 5, amuleto: 4.5, biblioteca: 5.5,
};

const AI = {
  value(c) {
    const d = DEF(c.defId);
    if (d.type !== 'combatant') return AI_MAGIC[d.id] || 2;
    let v = (onField(c) ? power(c) : d.power + c.bonus) / 100;
    v += AI_EXTRA[c.abilityId] || 0;
    return v;
  },

  estPower(p, card) {
    const d = DEF(card.defId);
    let v = d.power;
    if (d.id === 'espadachim') v += 20 * p.luck;
    if (d.id === 'berserker') v += 20 * (MAX_HP - p.hp);
    for (const o of p.field) {
      if (o && AB(o).allyAura) v += AB(o).allyAura;
      if (o && AB(o).cheer) v += power(o, { noCheer: true });
    }
    for (const m of p.magic) if (m && ABILITIES[m.defId].allyPower) v += ABILITIES[m.defId].allyPower;
    return v;
  },

  laneScore(p, slot, pw) {
    const e = opp(p).field[slot];
    if (!e) return 1.2;
    const ep = power(e, { defending: true });
    if (e.defId === 'peso' && AB(e).cantAttack) return pw > ep ? 2.4 : 0;
    if (pw > ep) return 1.5 + this.value(e) * 0.3;
    if (pw === ep) return 0.2;
    return -1.6;
  },

  // sacrifícios mais baratos por ponto de sangue (Mr. Sanduíche primeiro)
  pickSacs(p, need) {
    const pool = sacrificable(p).sort((a, b) => this.value(a) / bloodValue(a) - this.value(b) / bloodValue(b));
    const out = [];
    let sum = 0;
    for (const c of pool) {
      if (sum >= need) break;
      out.push(c);
      sum += bloodValue(c);
    }
    return sum >= need ? out : null;
  },

  bestMove(p) {
    const o = opp(p);
    const shielded = o.magic.some((m) => m && m.defId === 'protecao' && m.charges > 0);
    const oppMagic = o.magic.filter(Boolean);
    let best = null;
    const consider = (card, choice, score) => { if (!best || score > best.score) best = { card, choice, score }; };

    for (const card of p.hand) {
      if (!canPlay(p, card).ok) continue;
      const d = DEF(card.defId), ab = ABILITIES[d.id] || {};

      if (d.type === 'combatant') {
        if (d.id === 'peso') {
          const free = [0, 1, 2, 3].filter((s) => !o.field[s]);
          if (!free.length) continue;
          free.sort((a, b) => (p.field[b] ? 1 : 0) - (p.field[a] ? 1 : 0));
          consider(card, { sacrifices: [], side: o.id, slot: free[0] }, p.field[free[0]] ? 2.6 : 1.8);
          continue;
        }
        let sacs = [];
        if (d.cost.t === 'blood' && !p.freeCard) {
          sacs = this.pickSacs(p, d.cost.v);
          if (!sacs) continue;
          const lost = sacs.reduce((s, c) => s + this.value(c), 0);
          if (this.value(card) - lost < 1) continue;
        }
        const pw = this.estPower(p, card);
        let bs = null, bsc = -99;
        for (const s of summonSlots(p, card, sacs).filter((x) => x.side === p.id)) {
          const sc = this.laneScore(p, s.slot, pw);
          if (sc > bsc) { bsc = sc; bs = s; }
        }
        if (!bs) continue;
        let score = this.value(card) + bsc;
        if (d.cost.t === 'luck') score += 1;           // não gasta sorte: jogar antes
        if (d.cost.t === 'bluck') score -= d.cost.v * 0.04;
        if (d.id === 'assassino' && !fieldCands(o, (x) => apparentPower(x) <= 300).length) score -= 1;
        if (d.id === 'ceifador') score += Math.max(0, ...fieldCands(o).map((t) => this.value(o.field[t.slot])));
        if (d.id === 'necromante' && !p.discard.some((x) => DEF(x.defId).type === 'combatant')) score -= 0.5;
        if (d.id === 'lider') score += p.field.filter(Boolean).length * 0.4;
        if (d.id === 'ladra') score += oppMagic.length ? Math.max(...oppMagic.map((m) => AI_MAGIC[m.defId] || 1.5)) : -1;
        if (d.id === 'antimago') score += oppMagic.length * 0.5;
        const choice = { sacrifices: sacs, side: p.id, slot: bs.slot };
        if (d.id === 'coringa') { choice.disguise = this.pickDisguise(p); choice.payDisguise = true; score += 1; }
        consider(card, choice, score);
      } else if (d.kind === 'passive') {
        let score = AI_MAGIC[d.id] || 1.5;
        if (d.id === 'muralha' && p.hp <= 5) score += 1;
        if (d.id === 'estandarte') score += p.field.filter(Boolean).length * 0.4;
        if (d.id === 'espelho') score += p.field.filter(Boolean).length * 0.2;
        if (d.id === 'controle') {
          if (!o.field.some(Boolean) || !p.field.includes(null)) continue;
          score += Math.max(...o.field.filter(Boolean).map((c) => this.value(c))) * 0.5;
        }
        if (shielded) score -= 1.5;
        consider(card, { slot: p.magic.indexOf(null) }, score);
      } else {
        let score, choice = {};
        if (ab.targets) {
          const t = this.bestTarget(p, ab.purpose, ab.targets(p));
          if (!t) continue;
          score = t.score;
          if (d.id === 'raio' && score < 4) continue;
          choice = { target: t.cand };
        } else if (d.id === 'eclipse') {
          const mine = p.magic.filter(Boolean);
          score = oppMagic.reduce((s, m) => s + (AI_MAGIC[m.defId] || 1.5), 0)
            - mine.reduce((s, m) => s + (AI_MAGIC[m.defId] || 1.5), 0) + 0.4 * (oppMagic.length + mine.length);
          if (score < 1) continue;
        } else if (d.id === 'furacao') {
          score = oppMagic.reduce((s, m) => s + (AI_MAGIC[m.defId] || 1.5), 0) * 0.8;
          if (score < 1.5) continue;
        } else if (d.id === 'sobrecarga') {
          const mine = p.magic.filter(Boolean).map((m) => AI_MAGIC[m.defId] || 1.5).sort((a, b) => a - b);
          const theirs = oppMagic.map((m) => AI_MAGIC[m.defId] || 1.5).sort((a, b) => b - a).slice(0, 2);
          score = theirs.reduce((s, v) => s + v, 0) - mine[0];
          if (score < 1) continue;
        } else if (d.id === 'pacto') {
          if (p.hp < 6) continue;
          score = p.hand.some((c) => c !== card && ['luck', 'bluck'].includes(DEF(c.defId).cost.t)
            && DEF(c.defId).cost.v > p.luck && DEF(c.defId).cost.v <= p.luck + 8) ? 2.2 : -1;
        } else if (d.id === 'roda') {
          score = 1.2;
        } else if (d.id === 'caixinha') {
          if (p.luck - d.cost.v < 14) continue;
          score = 2.5;
        } else if (d.id === 'superbonus') {
          const near = p.hand.some((c) => c !== card && ['luck', 'bluck'].includes(DEF(c.defId).cost.t)
            && DEF(c.defId).cost.v > p.luck && DEF(c.defId).cost.v <= p.luck + 5);
          score = near ? 2.6 : 1;
        } else {
          score = 2;
          if (d.id === 'pocao' && p.hp <= 4) score += 0.5;
          if (d.id === 'curapocao') { if (MAX_HP - p.hp < 2) continue; score = 1.5 + (MAX_HP - p.hp) * 0.3; }
        }
        if (shielded) score -= 1.5;
        consider(card, choice, score);
      }
    }
    return best && best.score > 0.6 ? best : null;
  },

  // Coringa: com inimigos no campo, finge ser Ceifador (o efeito de invocação funciona); senão, Arauto (compra 2)
  // (a IA só usa disfarces sem custo de sangue, para não precisar escolher sacrifícios)
  pickDisguise(p) {
    const opts = disguiseOptions(p).filter((d) => d.cost.t !== 'blood');
    const o = opp(p), enemies = o.field.filter(Boolean);
    const score = (d) => (AI_EXTRA[d.id] || 0) + d.power / 200
      + (d.id === 'assassino' && enemies.some((x) => apparentPower(x) <= 300) ? 3 : 0)
      + (d.id === 'arauto' ? 2 : 0) + (d.id === 'bobo' && o.hand.length ? 1 : 0);
    return opts.sort((x, y) => score(y) - score(x))[0].id;
  },

  bestTarget(p, purpose, cands) {
    let best = null;
    for (const cand of cands) {
      const c = P(cand.side)[cand.zone][cand.slot];
      if (!c) continue;
      let score;
      if (purpose === 'destroy') score = this.value(c) + 0.5;
      else if (purpose === 'destroyMagic') score = (AI_MAGIC[c.defId] || 1.5);
      else if (purpose === 'curse') {
        const pw = power(c);
        const mine = P(1 - cand.side).field[cand.slot];
        if (pw <= 200) score = this.value(c) + 1;
        else if (mine && power(mine, { attacking: true }) <= pw && power(mine, { attacking: true }) > pw - 200) score = this.value(c) * 0.8 + 0.5;
        else score = 0.7;
      } else if (purpose === 'buff') {
        const pw = power(c);
        const e = opp(p).field[cand.slot];
        if (e && power(e, { defending: true }) >= pw && power(e, { defending: true }) < pw + 250) score = 2.6 + this.value(e) * 0.3;
        else score = 1 + pw / 1000;
      } else if (purpose === 'copy') score = AI_EXTRA[c.abilityId] || 0;
      else if (purpose === 'sacrificeMagic') score = -(AI_MAGIC[c.defId] || 1.5);
      else score = this.value(c);
      // magia contra quem ainda tem imunidade é desperdiçada
      if (cand.side !== p.id && AB(c).spellWard && !c.wardUsed) score *= 0.25;
      if (cand.side !== p.id && AB(c).luckyGod && purpose === 'destroy') score *= 0.5;
      if (!best || score > best.score) best = { cand, score };
    }
    return best;
  },

  targetScore(c, pa, t) {
    const o = P(t.side);
    if (t.zone === 'magic') {
      const m = o.magic[t.slot];
      return m ? (AI_MAGIC[m.defId] || 1.5) + 1.5 : -99;
    }
    const e = o.field[t.slot];
    if (!e) {
      if (o.magic.some((m) => m && m.defId === 'armadilha')) return 1.5 - this.value(c);   // só um combatente fraco desarma a armadilha
      return (AB(c).randomDirect ? 3 : directDamageOf(c)) * 3;
    }
    const pd = power(e, { defending: true });
    if (pa > pd) return 2 + this.value(e) + (e.defId === 'peso' && AB(e).cantAttack ? 3 : 0);
    if (pa === pd) return this.value(e) - this.value(c);
    return -99;
  },

  // ignoreTaunt: avalia como se a Sentinela já tivesse atraído o primeiro ataque
  attackOptions(p, ignoreTaunt = false) {
    const o = opp(p), opts = [];
    const taunt = ignoreTaunt ? -1 : tauntSlot(o);
    for (const c of p.field) {
      if (!c || !canAttack(c)) continue;
      const pa = power(c, { attacking: true });
      const targets = taunt >= 0 ? [{ side: o.id, zone: 'field', slot: taunt }] : attackTargets(c);
      for (const t of targets) opts.push({ c, slot: t.slot, zone: t.zone, score: this.targetScore(c, pa, t) });
    }
    return opts.sort((a, b) => b.score - a.score);
  },

  nextAttack(p) {
    let best = this.attackOptions(p)[0];
    const t = tauntSlot(opp(p));
    if ((!best || best.score <= 0) && t >= 0) {
      // jogar o combatente mais fraco na Sentinela só vale se liberar ataques melhores
      const attackers = p.field.filter((c) => c && canAttack(c)).sort((a, b) => this.value(a) - this.value(b));
      if (attackers.length >= 2) {
        const fodder = attackers[0];
        const perAttacker = new Map();
        for (const x of this.attackOptions(p, true)) {
          if (x.c !== fodder && x.score > 0) perAttacker.set(x.c, Math.max(perAttacker.get(x.c) || 0, x.score));
        }
        const gain = [...perAttacker.values()].reduce((s, v) => s + v, 0);
        if (gain > this.value(fodder) + 1) best = { c: fodder, slot: t, zone: 'field', score: 1 };
      }
    }
    return best && best.score > 0 ? best : null;
  },

  // troca de posição: tira do caminho um combatente que vai morrer e não tem bom ataque agora
  planMove(p) {
    if (p.moveUsed) return null;
    const o = opp(p);
    const danger = (c, slot) => {
      const e = o.field[slot];
      if (!e || AB(e).cantAttack) return 0.4;
      const pe = power(e, { attacking: true }), pc = power(c, { defending: true });
      return pe > pc ? -this.value(c) : pe === pc ? -0.5 : 0.8;
    };
    let best = null;
    for (const c of p.field) {
      if (!c) continue;
      const from = locate(c).slot, e = o.field[from];
      const goodAttack = !AB(c).cantAttack && S.turn > 1 && (!e || power(c, { attacking: true }) > power(e, { defending: true }));
      if (goodAttack) continue;
      const now = danger(c, from);
      for (let s = 0; s < FIELD_SLOTS; s++) {
        if (s === from || p.field[s]) continue;
        const gain = danger(c, s) - now;
        if (gain > 1.2 && (!best || gain > best.gain)) best = { from, to: s, gain };
      }
    }
    return best;
  },

  wantsReroll(p, r) {
    if (r <= 4) return true;
    if (r <= 8 && p.lucky >= 2) return true;
    // quase dá para jogar uma carta forte da mão
    return p.lucky >= 2 && p.hand.some((c) => {
      const k = DEF(c.defId).cost;
      return (k.t === 'luck' || k.t === 'bluck') && k.v > r && k.v - r <= 3 && k.v >= 12;
    });
  },

  async takeTurn(p) {
    UI.setThinking(true);
    await sleep(600);
    if (canLuckyDraw(p) && p.lucky >= 2 && p.hand.length <= 4) await luckyDraw(p);
    while (canTradeDraw(p) && p.luck >= TRADE_COST + 10 && p.hand.length < 6) await tradeDraw(p);
    for (let i = 0; i < 14; i++) {
      const mv = this.bestMove(p);
      if (!mv) break;
      await playCard(p, mv.card, mv.choice);
      render();
      await sleep(550);
    }
    for (const f of fusionOptions(p)) {
      if (p.hp < FUSION_COST + 2) break;
      const mats = fusionMaterials(p, f);
      const worth = f.type === 'magic' ? (AI_MAGIC[f.id] || 3) : f.power / 100 + (AI_EXTRA[f.id] || 0);
      const gain = worth - mats.reduce((s, c) => s + this.value(c), 0);
      if (gain < 0.3) continue;
      let bs = fusionSlots(p, f)[0], bsc = -99;
      if (f.type !== 'magic') {
        for (const sl of fusionSlots(p, f)) {
          const sc = this.laneScore(p, sl.slot, f.power);
          if (sc > bsc) { bsc = sc; bs = sl; }
        }
      }
      await fuse(p, f, bs.slot);
      await sleep(500);
      break;
    }
    const mvPos = this.planMove(p);
    if (mvPos) {
      await moveCombatant(p, mvPos.from, mvPos.to);
      await sleep(450);
    }
    if (S.turn > 1 && p.field.some((c) => c && !AB(c).cantAttack)) {
      goCombat();
      await sleep(500);
      for (let guard = 0; guard < 30; guard++) {
        const best = this.nextAttack(p);
        if (!best) break;
        await attack(best.c, best.slot, { zone: best.zone });
        await sleep(450);
      }
    }
    UI.setThinking(false);
    await sleep(400);
    await endTurn();
  },

  decide(p, kind, d) {
    switch (kind) {
      case 'confirm':
        if (d.purpose === 'save') return this.value(d.saved) > this.value(d.mago);
        return true;
      case 'pick': {
        if (d.purpose === 'reattack') {
          const pa = power(d.attacker, { attacking: true });
          const ok = d.candidates.filter((c) => power(P(c.side).field[c.slot], { defending: true }) < pa);
          const t = this.bestTarget(p, 'destroy', ok);
          return t ? t.cand : null;
        }
        if (d.purpose === 'sacrificeMagic' && d.optional) {
          // Golem de Sucata: só vale se a magia do oponente for melhor que a minha
          const mine = this.bestTarget(p, 'sacrificeMagic', d.candidates);
          const theirs = Math.max(0, ...opp(p).magic.filter(Boolean).map((m) => AI_MAGIC[m.defId] || 1.5));
          return mine && theirs > -mine.score ? mine.cand : null;
        }
        const t = this.bestTarget(p, d.purpose, d.candidates);
        return t ? t.cand : (d.optional ? null : d.candidates[0]);
      }
      case 'card': {
        if (d.purpose === 'swap') return [...d.cards].sort((a, b) => this.value(a) - this.value(b))[0] || null;
        if (d.purpose === 'alchemy') {
          const worst = [...d.cards].sort((a, b) => this.value(a) - this.value(b))[0];
          return worst && this.value(worst) < 2.2 && p.hand.length > 2 ? worst : null;
        }
        const sorted = [...d.cards].sort((a, b) => this.value(b) - this.value(a));
        return sorted[0] || null;
      }
      case 'choose': {
        const ok = d.options.filter((o) => !o.disabled);
        if (d.purpose === 'bless') {
          const can = (v) => ok.some((o) => o.value === v);
          if (can('heal') && p.hp <= MAX_HP - 4) return 'heal';
          if (can('free') && p.hand.some((c) => DEF(c.defId).cost.t !== 'free' && (DEF(c.defId).cost.v || 0) >= 12)) return 'free';
          return can('draw') ? 'draw' : ok[0] && ok[0].value;
        }
        if (d.purpose === 'superbonus') {
          const charge = ok.find((o) => o.value === 'charge');
          if (charge && p.lucky <= 1 && p.hp >= 6) return 'charge';
          return 'luck';
        }
        return ok[0] && ok[0].value;
      }
      case 'mulligan': {
        const cheap = p.hand.filter((c) => {
          const k = DEF(c.defId).cost;
          return k.t === 'free' || (k.t === 'luck' && k.v <= 9);
        }).length;
        return cheap < 2 ? 'reroll' : 'keep';
      }
      case 'crystal':
        return this.value(d.card) < 2 ? 'reroll' : 'keep';
      case 'handFull': {
        const worst = [...p.hand].sort((a, b) => this.value(a) - this.value(b))[0];
        return worst && this.value(worst) < this.value(d.card) ? worst : null;
      }
    }
    return null;
  },
};
