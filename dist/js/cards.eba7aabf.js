'use strict';
/* ============================================================
   SORTE & SANGUE — definições das cartas e seus efeitos
   ============================================================ */

let MAX_HP = 10;   // escolhido antes de cada partida (1 a 40)
const START_HAND = 5, HAND_LIMIT = 7;
const FIELD_SLOTS = 4, MAGIC_SLOTS = 3, LUCK_CAP = 25;
const LUCKY_CHARGES = 4, MULLIGANS = 2, TRADE_COST = 5;

// cost.t: 'free' | 'blood' (sacrifícios) | 'luck' (sorte mínima) | 'bluck' (sorte de sangue: gasta sorte)
const CARD_DEFS = [
  // ---------------- COMBATENTES SEM CUSTO ----------------
  { id: 'peso', name: 'Peso Morto', type: 'combatant', cost: { t: 'free' }, power: 100, art: '⚓', hue: 30,
    text: 'Pode ser invocado num espaço livre do oponente, que vira o dono da carta. Não pode atacar nem ser sacrificado. Ao ser destruído, o dono perde 1 coração. Se autodestrói no início do 3º turno do dono.' },
  { id: 'dados', name: 'Jogador de Dados', type: 'combatant', cost: { t: 'free' }, power: 100, art: '🎲', hue: 50,
    text: 'Ao ser invocado, role sua sorte de novo. O novo valor substitui o atual.' },
  { id: 'rato', name: 'Rato de Esgoto', type: 'combatant', cost: { t: 'free' }, power: 150, art: '🐀', hue: 90,
    text: 'Ao ser destruído, o dono compra 1 carta.' },
  { id: 'aprendiz', name: 'Aprendiz de Vidente', type: 'combatant', cost: { t: 'free' }, power: 150, art: '📜', hue: 260,
    text: 'Ao ser invocado, compre 1 carta.' },
  { id: 'ladrao', name: 'Ladrão de Sorte', type: 'combatant', cost: { t: 'free' }, power: 150, art: '🦝', hue: 140,
    text: 'Ao ser invocado, você ganha +3 de sorte. Na próxima rolagem de sorte do oponente, ele perde 3 logo depois de rolar.' },
  { id: 'goblin', name: 'Goblin Apostador', type: 'combatant', cost: { t: 'free' }, power: 200, art: '👺', hue: 10,
    text: 'Ao ser invocado, rola um d20: com 11 ou mais ganha +200 de poder; abaixo de 11 perde 100.' },
  { id: 'escudeiro', name: 'Escudeiro', type: 'combatant', cost: { t: 'free' }, power: 250, art: '🗡️', hue: 35,
    text: 'Leal e confiável. Sem efeito.' },

  // ---------------- COMBATENTES DE SORTE ----------------
  { id: 'mago', name: 'Mago Branco', type: 'combatant', cost: { t: 'luck', v: 5 }, power: 300, art: '🧙', hue: 200,
    text: 'Se outra carta sua fosse ser destruída, você pode salvá-la e destruir esta no lugar.' },
  { id: 'sentinela', name: 'Sentinela de Pedra', type: 'combatant', cost: { t: 'luck', v: 6 }, power: 400, art: '🗿', hue: 30,
    text: 'Não pode atacar. O primeiro ataque do oponente em cada turno é desviado para esta carta, não importa qual alvo ele escolheu.' },
  { id: 'bobo', name: 'Bobo da Corte', type: 'combatant', cost: { t: 'luck', v: 6 }, power: 200, art: '🤡', hue: 320,
    text: 'Ao ser invocado, o oponente descarta 1 carta aleatória da mão.' },
  { id: 'berserker', name: 'Berserker', type: 'combatant', cost: { t: 'luck', v: 7 }, power: 300, art: '🪓', hue: 15,
    text: '+25 de poder para cada coração que você já perdeu.' },
  { id: 'arqueira', name: 'Arqueira Élfica', type: 'combatant', cost: { t: 'luck', v: 8 }, power: 300, art: '🏹', hue: 110,
    text: 'Pode atacar qualquer espaço do oponente, não só o da frente.' },
  { id: 'lobo', name: 'Lobo de Duas Cabeças', type: 'combatant', cost: { t: 'luck', v: 9 }, power: 250, art: '🐺', hue: 220,
    text: 'Ataca duas vezes por turno.' },
  { id: 'gargula', name: 'Gárgula', type: 'combatant', cost: { t: 'luck', v: 9 }, power: 400, art: '🦇', hue: 250,
    text: '+100 de poder durante o turno do oponente.' },
  { id: 'espadachim', name: 'Espadachim Sortudo', type: 'combatant', cost: { t: 'luck', v: 10 }, power: 200, art: '🤺', hue: 170,
    text: '+20 de poder para cada ponto da sua sorte atual.' },
  { id: 'paladino', name: 'Paladino', type: 'combatant', cost: { t: 'luck', v: 11 }, power: 450, art: '⚜️', hue: 45,
    text: 'Seus outros combatentes ganham +50 de poder.' },
  { id: 'assassino', name: 'Assassino das Sombras', type: 'combatant', cost: { t: 'luck', v: 12 }, power: 300, art: '🔪', hue: 270,
    text: 'Ao ser invocado, destrua um combatente inimigo com 300 de poder ou menos.' },
  { id: 'necromante', name: 'Necromante', type: 'combatant', cost: { t: 'luck', v: 13 }, power: 350, art: '☠️', hue: 290,
    text: 'Ao ser invocado, devolva um combatente do seu descarte para a mão.' },
  { id: 'vazio', name: 'Cavaleiro Vazio', type: 'combatant', cost: { t: 'luck', v: 14 }, power: 400, art: '🛡️', hue: 230,
    text: 'Ao destruir um combatente, ganha metade do poder dele e troca este efeito pelo efeito da carta destruída.' },
  { id: 'arauto', name: 'Arauto da Fortuna', type: 'combatant', cost: { t: 'luck', v: 18 }, power: 600, art: '👑', hue: 48,
    text: 'Ao ser invocado, compre 2 cartas.' },

  // ---------------- COMBATENTES DE SORTE DE SANGUE ----------------
  { id: 'vampiro', name: 'Vampiro Nobre', type: 'combatant', cost: { t: 'bluck', v: 8 }, power: 400, art: '🧛', hue: 345,
    text: 'Ao destruir um combatente, você recupera 1 coração.' },
  { id: 'fenix', name: 'Fênix', type: 'combatant', cost: { t: 'bluck', v: 12 }, power: 450, art: '🦅', hue: 20,
    text: 'Ao ser destruída, volta para a mão do dono.' },
  { id: 'carmesim', name: 'Cavaleiro Carmesim', type: 'combatant', cost: { t: 'bluck', v: 15 }, power: 500, art: '🩸', hue: 355,
    text: 'Sempre que qualquer combatente é destruído, ganha +100 de poder. Causa 2 de dano direto.' },

  // ---------------- COMBATENTES DE SANGUE ----------------
  { id: 'golem', name: 'Golem de Ossos', type: 'combatant', cost: { t: 'blood', v: 1 }, power: 400, art: '🦴', hue: 40,
    text: 'Ao ser destruído, deixa um Esqueleto (200 de poder) no lugar.' },
  { id: 'besta', name: 'Besta dos Pesadelos', type: 'combatant', cost: { t: 'blood', v: 2 }, power: 400, art: '👹', hue: 280,
    text: '+100 de poder ao atacar. Ao destruir um combatente atacando, pode atacar outro combatente inimigo (nunca direto). Só uma vez por turno.' },
  { id: 'ceifador', name: 'Ceifador', type: 'combatant', cost: { t: 'blood', v: 2 }, power: 400, art: '⚰️', hue: 260,
    text: 'Ao ser invocado, destrua um combatente inimigo à sua escolha.' },
  { id: 'hidra', name: 'Hidra', type: 'combatant', cost: { t: 'blood', v: 2 }, power: 400, art: '🐍', hue: 130,
    text: 'Ataca três vezes por turno.' },
  { id: 'dragao', name: 'Dragão Ancestral', type: 'combatant', cost: { t: 'blood', v: 4 }, power: 1000, art: '🐉', hue: 5,
    text: 'Causa 3 de dano direto. Imune à primeira magia inimiga que o afetaria.' },

  // ---------------- MAGIAS ----------------
  { id: 'cristal', name: 'Bola de Cristal', type: 'magic', kind: 'passive', cost: { t: 'free' }, art: '🔮', hue: 270,
    text: 'Sempre que comprar uma carta, você pode recusá-la e comprar outra (uma vez por compra).' },
  { id: 'trevo', name: 'Trevo de Quatro Folhas', type: 'magic', kind: 'passive', cost: { t: 'free' }, art: '🍀', hue: 120,
    text: 'No início do seu turno, depois de rolar, ganhe +2 de sorte.' },
  { id: 'dissipar', name: 'Dissipar', type: 'magic', kind: 'active', cost: { t: 'luck', v: 6 }, art: '🌀', hue: 200,
    text: 'Destrua uma carta de magia do oponente.' },
  { id: 'muralha', name: 'Muralha Arcana', type: 'magic', kind: 'passive', cost: { t: 'bluck', v: 7 }, art: '🧱', hue: 25,
    text: 'Absorve os próximos 3 de dano direto que você receberia. Não segura ataques de combatentes com mais de 500 de poder. Depois de absorver 3, é destruída.' },
  { id: 'pocao', name: 'Poção Misteriosa', type: 'magic', kind: 'active', cost: { t: 'luck', v: 8 }, art: '🧪', hue: 300,
    text: 'Um efeito aleatório: você ganha 2 corações; OU compra 1 carta; OU o oponente descarta 1 carta da mão e perde 1 coração.' },
  { id: 'bencao', name: 'Bênção da Lua', type: 'magic', kind: 'active', cost: { t: 'luck', v: 12 }, art: '🌙', hue: 220,
    text: 'Um combatente seu ganha +250 de poder permanentemente.' },
  { id: 'estandarte', name: 'Estandarte de Guerra', type: 'magic', kind: 'passive', cost: { t: 'luck', v: 11 }, art: '🚩', hue: 0,
    text: 'Seus combatentes ganham +100 de poder.' },
  { id: 'maldicao', name: 'Maldição', type: 'magic', kind: 'active', cost: { t: 'luck', v: 9 }, art: '🕸️', hue: 280,
    text: 'Um combatente inimigo perde 200 de poder permanentemente. Se chegar a 0, é destruído.' },
  { id: 'fogo', name: 'Bola de Fogo', type: 'magic', kind: 'active', cost: { t: 'luck', v: 10 }, art: '🔥', hue: 15,
    text: 'Destrua um combatente inimigo com 400 de poder ou menos. Se destruir, o oponente perde 1 coração.' },
  { id: 'espelho', name: 'Espelho Amaldiçoado', type: 'magic', kind: 'passive', cost: { t: 'luck', v: 12 }, art: '👁️', hue: 310,
    text: 'Sempre que um combatente seu é destruído, o oponente perde 1 coração.' },
  { id: 'grimorio', name: 'Grimório Proibido', type: 'magic', kind: 'passive', cost: { t: 'luck', v: 14 }, art: '📖', hue: 330,
    text: 'No início dos seus próximos 3 turnos, compre 1 carta adicional. Depois disso, é destruído.' },
  { id: 'raio', name: 'Raio Divino', type: 'magic', kind: 'active', cost: { t: 'bluck', v: 17 }, art: '⚡', hue: 55,
    text: 'Destrua até 2 combatentes inimigos quaisquer.' },

  // ---------------- EXPANSÃO: cartas pedidas ----------------
  { id: 'antimago', name: 'Anti-Mago', type: 'combatant', cost: { t: 'free' }, power: 200, art: '🚫', hue: 190,
    text: 'Ao atacar, pode escolher qualquer magia do oponente como alvo em vez do espaço da frente. A magia atacada é destruída na hora.' },
  { id: 'lider', name: 'Líder de Torcida', type: 'combatant', cost: { t: 'free' }, power: 50, art: '📣', hue: 320,
    text: 'Seus outros combatentes ganham o poder desta carta (se ela ficar mais forte, eles também ficam).' },
  { id: 'sanduiche', name: 'Mr. Sanduíche', type: 'combatant', cost: { t: 'free' }, power: 50, art: '🥪', hue: 40,
    text: 'Vale como 2 de sangue ao ser sacrificado. O combatente invocado com esse sacrifício ganha +50 de poder.' },
  { id: 'atirador', name: 'Atirador de Elite', type: 'combatant', cost: { t: 'blood', v: 3 }, power: 500, art: '🎯', hue: 0,
    text: 'Ataca duas vezes por turno e sempre escolhe o alvo: qualquer espaço de combatente ou de magia do oponente. Magias atacadas são destruídas.' },
  { id: 'superbonus', name: 'Super Bônus', type: 'magic', kind: 'active', cost: { t: 'free' }, art: '⭐', hue: 50,
    text: 'Escolha uma: perca 1 coração para recuperar 1 Carga Sortuda; OU ganhe +5 de sorte agora.' },
  { id: 'caixinha', name: 'Caixinha Dourada', type: 'magic', kind: 'active', cost: { t: 'bluck', v: 3 }, art: '🎁', hue: 45,
    text: 'Depois de pagar o custo, guarda sua sorte atual: nos seus próximos 2 turnos, em vez de rolar o d20, sua sorte será esse valor.' },
  { id: 'protecao', name: 'Proteção Divina', type: 'magic', kind: 'passive', cost: { t: 'luck', v: 6 }, art: '🕊️', hue: 200,
    text: 'Anula as próximas 2 magias que o oponente usar (ele paga o custo e perde a carta). Depois disso, é destruída.' },
  { id: 'centro', name: 'Centro de Comércio', type: 'magic', kind: 'passive', cost: { t: 'luck', v: 10 }, art: '🏪', hue: 35,
    text: 'No início do seu turno (logo depois de rolar, antes de agir), você pode gastar 5 de sorte para comprar 1 carta, quantas vezes quiser.' },

  // ---------------- EXPANSÃO: cartas novas ----------------
  { id: 'gato', name: 'Gato Preto', type: 'combatant', cost: { t: 'luck', v: 6 }, power: 200, art: '🐈', hue: 260,
    text: 'Enquanto estiver no campo, toda rolagem de sorte do oponente é feita duas vezes e fica o menor valor. Ao ser destruído, o dono ganha +4 de sorte.' },
  { id: 'alquimista', name: 'Alquimista Ganancioso', type: 'combatant', cost: { t: 'luck', v: 8 }, power: 300, art: '⚗️', hue: 100,
    text: 'Ao ser invocado, descarte quantas cartas quiser da sua mão: +3 de sorte para cada uma.' },
  { id: 'ladra', name: 'Ladra de Feitiços', type: 'combatant', cost: { t: 'luck', v: 11 }, power: 300, art: '🧝', hue: 280,
    text: 'Ao ser invocada, rouba uma magia do campo do oponente e a coloca num espaço de magia seu (com contadores e tudo). Sem espaço livre, a magia roubada é destruída.' },
  { id: 'devorador', name: 'Devorador de Runas', type: 'combatant', cost: { t: 'blood', v: 1 }, power: 300, art: '👾', hue: 300,
    text: 'Sempre que uma magia sai de um espaço de magia (destruída ou descartada, de qualquer jogador), ganha +100 de poder e você ganha +1 de sorte.' },
  { id: 'ferradura', name: 'Ferradura Torta', type: 'magic', kind: 'passive', cost: { t: 'luck', v: 4 }, art: '🧲', hue: 30,
    text: 'No início do seu turno: se a rolagem foi 10 ou menos, ganhe +4 de sorte. Se foi 18 ou mais, recupere 1 Carga Sortuda e esta carta se quebra.' },
  { id: 'desencantar', name: 'Desencantar', type: 'magic', kind: 'active', cost: { t: 'luck', v: 9 }, art: '✂️', hue: 180,
    text: 'Destrua uma magia do oponente. Você ganha sorte igual ao custo de sorte dela (máximo 8).' },
  { id: 'eclipse', name: 'Eclipse', type: 'magic', kind: 'active', cost: { t: 'luck', v: 12 }, art: '🌑', hue: 250,
    text: 'Destrua TODAS as magias nos espaços de magia, inclusive as suas. Você ganha +2 de sorte para cada magia destruída.' },

  // ---------------- EXPANSÃO 2: combatentes ----------------
  { id: 'espantalho', name: 'Espantalho', type: 'combatant', cost: { t: 'free' }, power: 100, art: '🌾', hue: 45,
    text: 'Quando um combatente inimigo o destrói, esse inimigo fica assustado e não pode atacar no próximo turno do dono dele.' },
  { id: 'barril', name: 'Barril de Pólvora', type: 'combatant', cost: { t: 'free' }, power: 100, art: '🛢️', hue: 20,
    text: 'Ao ser destruído em combate, explode e destrói também o combatente que lutou com ele.' },
  { id: 'trapaceiro', name: 'Trapaceiro', type: 'combatant', cost: { t: 'free' }, power: 150, art: '🃏', hue: 330,
    text: 'Ao ser invocado, escolha uma carta da sua mão e troque-a por uma carta aleatória da mão do oponente.' },
  { id: 'errante', name: 'Cavaleiro Errante', type: 'combatant', cost: { t: 'free' }, power: 300, art: '🐎', hue: 210,
    text: 'Só pode ser invocado num espaço que tenha um combatente inimigo à frente. Nunca ataca diretamente.' },
  { id: 'bardo', name: 'Bardo Inspirador', type: 'combatant', cost: { t: 'luck', v: 5 }, power: 200, art: '🎻', hue: 290,
    text: 'No início do seu turno, os combatentes nos espaços vizinhos (esquerda e direita) ganham +50 de poder permanentemente.' },
  { id: 'mimico', name: 'Mímico', type: 'combatant', cost: { t: 'luck', v: 7 }, power: 250, art: '📦', hue: 30,
    text: 'Ao ser invocado, copia o efeito de outro combatente no campo (seu ou do oponente), inclusive efeitos de "ao ser invocado".' },
  { id: 'colecionador', name: 'Colecionador de Relíquias', type: 'combatant', cost: { t: 'luck', v: 10 }, power: 300, art: '🏺', hue: 40,
    text: '+100 de poder para cada magia nos seus espaços de magia. Ao ser invocado sem nenhuma magia sua no campo, pega a primeira magia do seu baralho para a mão.' },
  { id: 'sucata', name: 'Golem de Sucata', type: 'combatant', cost: { t: 'blood', v: 2 }, power: 550, art: '⚙️', hue: 200,
    text: 'Ao ser invocado, você pode destruir uma magia sua: se fizer isso, destrua também uma magia do oponente e este combatente ganha +200 de poder.' },
  { id: 'deus', name: 'Deus da Sorte', type: 'combatant', cost: { t: 'luck', v: 20 }, power: 777, art: '🎰', hue: 50,
    text: 'Ao atacar diretamente, causa de 1 a 5 de dano (aleatório). Quando seria destruído, tem 50% de chance de sobreviver e destruir a carta que causaria sua morte (mesmo se for uma magia).' },
  { id: 'imperador', name: 'Imperador Sangrento', type: 'combatant', cost: { t: 'bluck', v: 20 }, power: 700, art: '🤴', hue: 350,
    text: 'Sempre que destrói um combatente, um clone dele vai para a sua mão (clones somem ao serem destruídos ou descartados). Causa 2 de dano direto, ou 4 se for o único combatente do seu lado.' },

  // ---------------- EXPANSÃO 2: magias ----------------
  { id: 'roda', name: 'Roda da Fortuna', type: 'magic', kind: 'active', cost: { t: 'free' }, art: '🎡', hue: 50,
    text: 'Role um d20. 1–5: perca 3 de sorte. 6–15: +3 de sorte. 16–19: +6 de sorte. 20: +6 de sorte e recupere 1 Carga Sortuda.' },
  { id: 'pacto', name: 'Pacto de Sangue', type: 'magic', kind: 'active', cost: { t: 'free' }, art: '🤝', hue: 0,
    text: 'Só com mais de 2 corações: perca 2 corações e ganhe +8 de sorte.' },
  { id: 'moeda', name: 'Moeda do Destino', type: 'magic', kind: 'active', cost: { t: 'luck', v: 3 }, art: '💰', hue: 45,
    text: 'Cara ou coroa. Cara: compre 2 cartas. Coroa: o oponente compra 1 carta e você recupera 1 Carga Sortuda.' },
  { id: 'armadilha', name: 'Armadilha de Ferro', type: 'magic', kind: 'passive', cost: { t: 'luck', v: 5 }, art: '⛓️', hue: 20,
    text: 'O primeiro combatente inimigo que tentar atacar você diretamente é destruído antes de causar dano. Depois disso, a armadilha é destruída.' },
  { id: 'furacao', name: 'Furacão', type: 'magic', kind: 'active', cost: { t: 'bluck', v: 5 }, art: '🌪️', hue: 190,
    text: 'Devolve todas as magias do campo do oponente para a mão dele (contadores são perdidos). As que não couberem na mão são destruídas.' },
  { id: 'sobrecarga', name: 'Sobrecarga', type: 'magic', kind: 'active', cost: { t: 'luck', v: 7 }, art: '💥', hue: 10,
    text: 'Destrua uma magia sua para destruir até 2 magias do oponente.' },
  { id: 'selo', name: 'Selo do Silêncio', type: 'magic', kind: 'passive', cost: { t: 'luck', v: 8 }, art: '🔏', hue: 260,
    text: 'Enquanto estiver no campo, o oponente não pode jogar magias passivas. Se o oponente destruir este selo, ele perde 1 coração.' },
  { id: 'eco', name: 'Eco Arcano', type: 'magic', kind: 'active', cost: { t: 'luck', v: 11 }, art: '🔁', hue: 230,
    text: 'Repete a última magia ativa que o oponente usou nesta partida, como se fosse sua (você escolhe os alvos).' },
  { id: 'lua', name: 'Ritual da Lua Cheia', type: 'magic', kind: 'passive', cost: { t: 'luck', v: 13 }, art: '🌕', hue: 50,
    text: 'No início do seu turno: se sua sorte for par, seus combatentes ganham +50 de poder permanentemente; se for ímpar, ganhe +2 de sorte.' },
  { id: 'controle', name: 'Controle Remoto', type: 'magic', kind: 'passive', cost: { t: 'luck', v: 19 }, art: '🎮', hue: 210,
    text: 'Ao ser jogada, escolha um combatente do oponente: se você tiver espaço livre, passa a controlá-lo até ele ou esta carta serem destruídos. Se esta carta sair do campo, ele volta para o oponente (sem espaço, é destruído).' },

  // ---------------- FUSÕES (fora do baralho) ----------------
  { id: 'cerbero', name: 'Cérbero', type: 'combatant', fusion: true, materials: ['lobo', 'hidra'], cost: { t: 'free' }, power: 700, art: '🐕', hue: 10,
    text: 'Ataca 3 vezes por turno. Depois de destruir um combatente, os ataques seguintes dele neste turno podem mirar qualquer espaço de combatente.' },
  { id: 'arcanjo', name: 'Arcanjo Guardião', type: 'combatant', fusion: true, materials: ['mago', 'paladino'], cost: { t: 'free' }, power: 800, art: '👼', hue: 50,
    text: 'Seus outros combatentes ganham +100 de poder. Uma vez por turno, se outra carta sua fosse ser destruída, ela é salva automaticamente.' },
  { id: 'conde', name: 'Conde Carmesim', type: 'combatant', fusion: true, materials: ['vampiro', 'carmesim'], cost: { t: 'free' }, power: 850, art: '🍷', hue: 345,
    text: 'Sempre que qualquer combatente é destruído, ganha +100 de poder; se era do oponente, você também recupera 1 coração. Causa 2 de dano direto.' },
  { id: 'gatuno', name: 'Gatuno da Meia-Noite', type: 'combatant', fusion: true, materials: ['gato', 'ladrao'], cost: { t: 'free' }, power: 450, art: '😼', hue: 270,
    text: 'O oponente rola a sorte duas vezes e fica com o menor valor; a diferença entre as rolagens vira sorte sua. Ao ser destruído, o dono ganha +4 de sorte.' },
  { id: 'lich', name: 'Rei Lich', type: 'combatant', fusion: true, materials: ['necromante', 'golem', 'fenix'], cost: { t: 'free' }, power: 1000, art: '🧟', hue: 280,
    text: 'Ao surgir, devolve até 2 combatentes do seu descarte para a mão. No início do seu turno, levanta um Esqueleto (200) num espaço livre seu. Ao ser destruído, enche seus espaços livres de Esqueletos.' },

  // ---------------- FICHAS (fora do baralho) ----------------
  { id: 'esqueleto', name: 'Esqueleto', type: 'combatant', cost: { t: 'free' }, power: 200, art: '💀', hue: 0, token: true,
    text: 'Ficha. Sem efeito.' },
];

/* Helpers usados pelos efeitos (definidos em engine.js) */
const fieldCands = (player, filter = () => true) =>
  player.field.map((c, slot) => (c && filter(c) ? { side: player.id, zone: 'field', slot } : null)).filter(Boolean);
const magicCands = (player) =>
  player.magic.map((c, slot) => (c ? { side: player.id, zone: 'magic', slot } : null)).filter(Boolean);

/* ============================================================
   EFEITOS — chaveados pelo id. Combatentes usam c.abilityId
   (o Cavaleiro Vazio pode trocar o seu).
   ============================================================ */
const ABILITIES = {
  // ---------- combatentes ----------
  vazio: {
    async onKill(c, victim) {
      const gain = Math.floor(victim.death.power / 2);
      c.bonus += gain;
      c.abilityId = victim.death.abilityId;
      const nd = DEF(c.abilityId);
      log(`${cn(c)} absorve ${cn(victim)}: +${gain} de poder e agora tem o efeito de <b>${nd.name}</b>.`, c.controller);
      UI.float(c, `+${gain}`, 'buff');
      SFX.play('buff');
      render();
      await sleep(500);
    },
  },
  besta: {
    powerMod: (c, ctx) => (ctx.attacking ? 100 : 0),
    async onKill(c, victim, ctx) {
      if (!ctx.attacking || c.extraAttackUsed) return;
      const p = ctl(c), o = opp(p);
      const cands = fieldCands(o);
      if (!cands.length) return;
      c.extraAttackUsed = true;
      const pk = await ask(p, 'pick', {
        prompt: `${DEF(c.defId).name} pode atacar de novo! Escolha outro combatente inimigo.`,
        candidates: cands, optional: true, cancelLabel: 'Pular', purpose: 'reattack', attacker: c,
      });
      if (pk && locate(c)) {
        log(`${cn(c)} ataca novamente!`, p.id);
        await attack(c, pk.slot, { extra: true, noDirect: true });
      }
    },
  },
  peso: {
    cantAttack: true, cantSacrifice: true, enemySide: true,
    onPlay(c) { c.timer = 3; },
    async onOwnerTurnStart(c) {
      c.timer = (c.timer ?? 3) - 1;
      render();
      if (c.timer > 0) return;
      log(`${cn(c)} desmorona sozinho!`, c.controller);
      await destroy(c, { noSave: true, selfDestruct: true });
    },
    async onDestroyed(c, info) {
      const p = P(info.controller);
      log(`${cn(c)} caiu: ${p.name} perde 1 coração.`, p.id);
      await damage(p, 1);
    },
  },
  carmesim: {
    directDamage: 2,
    async onAnyDestroyed(c) {
      c.bonus += 100;
      UI.float(c, '+100', 'buff');
      log(`${cn(c)} se fortalece com o sangue derramado (+100).`, c.controller);
    },
  },
  mago: { saver: true },
  escudeiro: {},
  rato: {
    async onDestroyed(c, info) { await draw(P(info.controller)); },
  },
  lobo: { attacks: 2 },
  goblin: {
    async onPlay(c) {
      const r = d20();
      await UI.rollDice(`Aposta do ${DEF(c.defId).name}`, r);
      if (r >= 11) { c.bonus += 200; UI.float(c, '+200', 'buff'); SFX.play('buff'); log(`${cn(c)} tirou ${r} e ganhou +200 de poder!`, c.controller); }
      else { c.bonus -= 100; UI.float(c, '−100', 'debuff'); SFX.play('debuff'); log(`${cn(c)} tirou ${r} e perdeu 100 de poder.`, c.controller); }
      render();
    },
  },
  aprendiz: { async onPlay(c) { await draw(ctl(c)); } },
  sentinela: { cantAttack: true, taunt: true },
  arqueira: { anyTarget: true },
  espadachim: { powerMod: (c) => 20 * ctl(c).luck },
  assassino: {
    async onPlay(c) {
      const p = ctl(c), o = opp(p);
      const cands = fieldCands(o, (x) => power(x) <= 300);
      if (!cands.length) { log(`${cn(c)} não encontrou alvos.`, p.id); return; }
      const pk = await ask(p, 'pick', { prompt: 'Assassino das Sombras: escolha um combatente inimigo (≤ 300) para destruir.', candidates: cands, purpose: 'destroy' });
      if (pk) await destroy(o.field[pk.slot]);
    },
  },
  golem: {
    async onDestroyed(c, info) {
      const p = P(info.controller);
      const reserved = S.reserved && S.reserved.side === p.id ? S.reserved.slot : -1;
      let slot = info.slot;
      if (p.field[slot] || slot === reserved) slot = p.field.findIndex((x, i) => !x && i !== reserved);
      if (slot < 0) return;
      const t = newInstance('esqueleto', p.id);
      p.field[slot] = t;
      log(`Um ${cn(t)} se levanta dos ossos do ${cn(c)}.`, p.id);
      await UI.animSummon(t);
    },
  },
  dragao: { directDamage: 3, spellWard: true },
  ceifador: {
    async onPlay(c) {
      const p = ctl(c), o = opp(p);
      const cands = fieldCands(o);
      if (!cands.length) { log(`${cn(c)} não encontrou alvos.`, p.id); return; }
      const pk = await ask(p, 'pick', { prompt: 'Ceifador: escolha um combatente inimigo para destruir.', candidates: cands, purpose: 'destroy' });
      if (pk) await destroy(o.field[pk.slot]);
    },
  },
  vampiro: {
    async onKill(c) { await heal(ctl(c), 1, c); },
  },
  berserker: { powerMod: (c) => 25 * Math.max(0, MAX_HP - ctl(c).hp) },
  paladino: { allyAura: 50 },
  fenix: {
    async onDestroyed(c) {
      const p = P(c.owner);
      if (p.hand.length >= HAND_LIMIT) { log(`${cn(c)} não pôde renascer: mão cheia.`, p.id); return; }
      const i = p.discard.indexOf(c);
      if (i >= 0) p.discard.splice(i, 1);
      c.isNew = true;
      p.hand.push(c);
      log(`${cn(c)} renasce das cinzas e volta para a mão de ${p.name}!`, p.id);
      SFX.play('heal');
      render();
    },
  },
  hidra: { attacks: 3 },
  dados: {
    async onPlay(c) {
      const p = ctl(c);
      const r = await rollLuck(p, `${DEF(c.defId).name} — nova ${luckOf(p).toLowerCase()}`);
      p.luck = r;
      log(`${cn(c)}: a sorte de ${p.name} agora é <b>${r}</b>.`, p.id);
      render();
    },
  },
  bobo: {
    async onPlay(c) {
      const p = ctl(c), o = opp(p);
      if (!o.hand.length) return;
      const i = Math.floor(Math.random() * o.hand.length);
      const [x] = o.hand.splice(i, 1);
      toDiscard(o, x);
      log(`${cn(c)} faz ${o.name} descartar ${cn(x)}.`, p.id);
      SFX.play('debuff');
      render();
    },
  },
  gargula: { powerMod: (c) => (S.current !== c.controller ? 100 : 0) },
  arauto: { async onPlay(c) { await draw(ctl(c)); await draw(ctl(c)); } },
  necromante: {
    async onPlay(c) {
      const p = ctl(c);
      const cards = p.discard.filter((x) => DEF(x.defId).type === 'combatant');
      if (!cards.length) { log(`${cn(c)}: nenhum combatente no descarte.`, p.id); return; }
      if (p.hand.length >= HAND_LIMIT) { log(`${cn(c)}: mão cheia.`, p.id); return; }
      const pick = await ask(p, 'card', { title: 'Necromante', text: 'Escolha um combatente do seu descarte para voltar à mão.', cards, purpose: 'necro' });
      if (!pick) return;
      p.discard.splice(p.discard.indexOf(pick), 1);
      pick.isNew = true;
      p.hand.push(pick);
      log(`${cn(c)} traz ${cn(pick)} de volta para a mão.`, p.id);
      SFX.play('draw');
      render();
    },
  },
  ladrao: {
    async onPlay(c) {
      const p = ctl(c), o = opp(p);
      o.luckDebt = (o.luckDebt || 0) + 3;
      p.luck = Math.min(LUCK_CAP, p.luck + 3);
      log(`${cn(c)}: ${p.name} ganha +3 de sorte, e a próxima rolagem de ${o.name} terá −3.`, p.id);
      UI.floatPlayer(p, '+3 🍀', 'luck');
      SFX.play('luck');
      render();
    },
  },

  antimago: { magicAttacker: true },
  atirador: { attacks: 2, sniper: true },
  lider: { cheer: true },
  sanduiche: { bloodValue: 2, sacBonus: 50 },
  devorador: { runeEater: true },
  gato: {
    blackCat: true,
    async onDestroyed(c, info) {
      const p = P(info.controller);
      p.luck = Math.min(LUCK_CAP, p.luck + 4);
      log(`${cn(c)} foge e deixa sorte para trás: ${p.name} ganha +4 (agora ${p.luck}).`, p.id);
      UI.floatPlayer(p, '+4 🍀', 'luck');
      SFX.play('luck');
      render();
    },
  },
  alquimista: {
    async onPlay(c) {
      const p = ctl(c);
      let n = 0;
      while (p.hand.length) {
        const pick = await ask(p, 'card', {
          title: 'Alquimista Ganancioso', text: `Escolha uma carta da mão para virar +3 de sorte (sorte atual: ${p.luck}).`,
          cards: p.hand, optional: true, cancelLabel: n ? 'Pronto' : 'Não descartar nada', purpose: 'alchemy',
        });
        if (!pick) break;
        p.hand.splice(p.hand.indexOf(pick), 1);
        toDiscard(p, pick);
        n++;
        p.luck = Math.min(LUCK_CAP, p.luck + 3);
        log(`${cn(c)} transmuta ${cn(pick)} em +3 de sorte (agora ${p.luck}).`, p.id);
        UI.floatPlayer(p, '+3 🍀', 'luck');
        SFX.play('luck');
        render();
      }
    },
  },
  ladra: {
    async onPlay(c) {
      const p = ctl(c), o = opp(p);
      const cands = magicCands(o);
      if (!cands.length) { log(`${cn(c)} não encontrou magias para roubar.`, p.id); return; }
      const pk = await ask(p, 'pick', { prompt: 'Ladra de Feitiços: escolha uma magia do oponente para roubar.', candidates: cands, purpose: 'destroyMagic' });
      if (!pk) return;
      const m = o.magic[pk.slot], free = p.magic.indexOf(null);
      if (free < 0) {
        log(`${cn(c)} não tem onde guardar ${cn(m)} e a destrói.`, p.id);
        await destroy(m);
        return;
      }
      const snap = UI.rects([m]);
      o.magic[pk.slot] = null;
      p.magic[free] = m;
      m.controller = p.id;
      log(`${cn(c)} rouba ${cn(m)} de ${o.name}!`, p.id);
      SFX.play('magic');
      render();
      await UI.flip(snap);
    },
  },

  // ---------- expansão 2: combatentes ----------
  espantalho: {
    async onDestroyed(c, info) {
      const k = info.source;
      if (!k || !onField(k) || k.controller === info.controller) return;
      k.scaredUntil = S.turn + (S.current === k.controller ? 2 : 1);
      log(`${cn(k)} se assusta com o ${cn(c)} e não vai atacar no próximo turno!`, info.controller);
      UI.float(k, '😱', 'debuff');
      render();
    },
  },
  barril: {
    async onDestroyed(c, info) {
      const k = info.source;
      if (!info.combat || !k || !onField(k)) return;
      log(`💥 ${cn(c)} explode e leva ${cn(k)} junto!`, info.controller);
      await destroy(k, { source: c });
    },
  },
  trapaceiro: {
    async onPlay(c) {
      const p = ctl(c), o = opp(p);
      if (!p.hand.length || !o.hand.length) { log(`${cn(c)} não tem com o que trapacear.`, p.id); return; }
      const mine = await ask(p, 'card', { title: 'Trapaceiro', text: 'Escolha uma carta da sua mão para trocar por uma carta aleatória da mão do oponente.', cards: p.hand, purpose: 'swap' });
      if (!mine) return;
      const theirs = o.hand[Math.floor(Math.random() * o.hand.length)];
      p.hand.splice(p.hand.indexOf(mine), 1);
      o.hand.splice(o.hand.indexOf(theirs), 1);
      mine.owner = mine.controller = o.id;
      theirs.owner = theirs.controller = p.id;
      mine.isNew = theirs.isNew = true;
      p.hand.push(theirs);
      o.hand.push(mine);
      log(`${cn(c)} troca uma carta de ${p.name} por uma carta de ${o.name}.`, p.id);
      SFX.play('draw');
      render();
    },
  },
  errante: { needsFront: true, noDirect: true },
  bardo: {
    async onOwnerTurnStart(c) {
      const p = ctl(c), s = locate(c).slot;
      for (const n of [s - 1, s + 1]) {
        const x = p.field[n];
        if (!x) continue;
        x.bonus += 50;
        UI.float(x, '+50', 'buff');
        log(`A música do ${cn(c)} inspira ${cn(x)} (+50).`, p.id);
      }
      SFX.play('buff');
      render();
      await sleep(250);
    },
  },
  mimico: {
    async onPlay(c) {
      const p = ctl(c);
      const cands = S.players.flatMap((pl) => fieldCands(pl, (x) => x !== c));
      if (!cands.length) { log(`${cn(c)} não tem ninguém para imitar.`, p.id); return; }
      const pk = await ask(p, 'pick', { prompt: 'Mímico: escolha um combatente (seu ou do oponente) para copiar o efeito.', candidates: cands, purpose: 'copy' });
      if (!pk) return;
      const t = P(pk.side).field[pk.slot];
      c.abilityId = t.abilityId;
      log(`${cn(c)} imita ${cn(t)} e ganha o efeito de <b>${DEF(c.abilityId).name}</b>.`, p.id);
      SFX.play('magic');
      render();
      const a = AB(c);
      if (a.onPlay && c.abilityId !== 'mimico') await a.onPlay(c);
    },
  },
  colecionador: {
    powerMod: (c) => 100 * ctl(c).magic.filter(Boolean).length,
    async onPlay(c) {
      const p = ctl(c);
      if (p.magic.some(Boolean)) return;
      const i = p.deck.findLastIndex((x) => DEF(x.defId).type === 'magic');   // o topo do baralho é o fim da lista
      if (i < 0) { log(`${cn(c)} não achou magias no baralho.`, p.id); return; }
      if (p.hand.length >= HAND_LIMIT) { log(`${cn(c)}: mão cheia.`, p.id); return; }
      const [m] = p.deck.splice(i, 1);
      m.isNew = true;
      p.hand.push(m);
      log(`${cn(c)} desenterra uma magia do baralho de ${p.name}.`, p.id);
      SFX.play('draw');
      render();
    },
  },
  sucata: {
    async onPlay(c) {
      const p = ctl(c), o = opp(p);
      if (!p.magic.some(Boolean) || !o.magic.some(Boolean)) return;
      const mine = await ask(p, 'pick', { prompt: 'Golem de Sucata: destruir uma magia sua para destruir uma do oponente e ganhar +200?',
        candidates: magicCands(p), optional: true, cancelLabel: 'Não', purpose: 'sacrificeMagic' });
      if (!mine) return;
      await destroy(p.magic[mine.slot], { noSave: true });
      const cands = magicCands(o);
      if (cands.length) {
        const t = await ask(p, 'pick', { prompt: 'Golem de Sucata: escolha a magia do oponente para destruir.', candidates: cands, purpose: 'destroyMagic' });
        if (t) await destroy(o.magic[t.slot]);
      }
      if (locate(c)) {
        c.bonus += 200;
        UI.float(c, '+200', 'buff');
        log(`${cn(c)} se reforça com a sucata (+200).`, p.id);
        render();
      }
    },
  },
  deus: { luckyGod: true, randomDirect: true },
  imperador: {
    directDamageFn: (c) => (ctl(c).field.filter(Boolean).length === 1 ? 4 : 2),
    async onKill(c) {
      const p = ctl(c);
      if (p.hand.length >= HAND_LIMIT) { log(`${cn(c)} tentou se clonar, mas a mão está cheia.`, p.id); return; }
      const clone = newInstance('imperador', p.id);
      clone.vanish = true;
      clone.isNew = true;
      p.hand.push(clone);
      log(`${cn(c)} se multiplica: um clone vai para a mão de ${p.name}!`, p.id);
      SFX.play('magic');
      render();
    },
  },

  // ---------- fusões ----------
  cerbero: {
    attacks: 3,
    async onKill(c) {
      c.freeAimTurn = S.turn;
      log(`${cn(c)} fareja novas presas: pode mirar qualquer espaço neste turno.`, c.controller);
    },
  },
  arcanjo: { allyAura: 100, guardian: true },
  conde: {
    directDamage: 2,
    async onAnyDestroyed(c, victim) {
      c.bonus += 100;
      UI.float(c, '+100', 'buff');
      if (victim.death && victim.death.controller !== c.controller) await heal(ctl(c), 1);
    },
  },
  gatuno: { blackCat: true, thiefCat: true, onDestroyed: (c, info) => ABILITIES.gato.onDestroyed(c, info) },
  lich: {
    async onPlay(c) {
      const p = ctl(c);
      for (let i = 0; i < 2; i++) {
        const cards = p.discard.filter((x) => DEF(x.defId).type === 'combatant');
        if (!cards.length || p.hand.length >= HAND_LIMIT) break;
        const pick = await ask(p, 'card', { title: 'Rei Lich', text: `Escolha um combatente do descarte para voltar à mão (${i + 1}/2).`,
          cards, optional: true, cancelLabel: 'Parar', purpose: 'necro' });
        if (!pick) break;
        p.discard.splice(p.discard.indexOf(pick), 1);
        pick.isNew = true;
        p.hand.push(pick);
        log(`${cn(c)} chama ${cn(pick)} de volta do túmulo.`, p.id);
        render();
      }
    },
    async onOwnerTurnStart(c) {
      const p = ctl(c), s = p.field.indexOf(null);
      if (s >= 0) await spawnToken(p, s, 'esqueleto', `${cn(c)} levanta um Esqueleto.`);
    },
    async onDestroyed(c, info) {
      const p = P(info.controller);
      for (let s = 0; s < FIELD_SLOTS; s++) {
        const reserved = S.reserved && S.reserved.side === p.id && S.reserved.slot === s;
        if (!p.field[s] && !reserved) await spawnToken(p, s, 'esqueleto', '');
      }
      log(`A queda do ${cn(c)} faz os mortos se levantarem!`, p.id);
    },
  },

  // ---------- magias ----------
  cristal: {},
  armadilha: {},
  selo: {},
  roda: {
    async resolve(p) {
      const r = d20();
      await UI.rollDice('Roda da Fortuna', r);
      const gain = r <= 5 ? -3 : r <= 15 ? 3 : 6;
      p.luck = Math.max(0, Math.min(LUCK_CAP, p.luck + gain));
      let extra = '';
      if (r === 20 && p.lucky < LUCKY_CHARGES) { p.lucky++; extra = ' e recupera 1 Carga Sortuda'; }
      log(`Roda da Fortuna parou no ${r}: ${p.name} ${gain > 0 ? 'ganha' : 'perde'} ${Math.abs(gain)} de sorte${extra} (sorte ${p.luck}).`, p.id);
      UI.floatPlayer(p, `${gain > 0 ? '+' : '−'}${Math.abs(gain)} 🍀`, gain > 0 ? 'luck' : 'debuff');
      SFX.play(gain > 0 ? 'luck' : 'debuff');
      render();
    },
  },
  pacto: {
    usable: (p) => p.hp > 2,
    unusableMsg: 'O Pacto de Sangue exige mais de 2 corações.',
    async resolve(p) {
      log(`${p.name} sela um Pacto de Sangue.`, p.id);
      await damage(p, 2);
      p.luck = Math.min(LUCK_CAP, p.luck + 8);
      log(`${p.name} ganha +8 de sorte (agora ${p.luck}).`, p.id);
      UI.floatPlayer(p, '+8 🍀', 'luck');
      SFX.play('luck');
      render();
    },
  },
  moeda: {
    async resolve(p) {
      const heads = Math.random() < 0.5;
      UI.toast(heads ? '🪙 Cara!' : '🪙 Coroa!');
      if (heads) {
        log(`Moeda do Destino: cara! ${p.name} compra 2 cartas.`, p.id);
        await draw(p);
        await draw(p);
      } else {
        const o = opp(p);
        if (p.lucky < LUCKY_CHARGES) p.lucky++;
        log(`Moeda do Destino: coroa! ${o.name} compra 1 carta e ${p.name} recupera 1 Carga Sortuda.`, p.id);
        await draw(o);
      }
      render();
    },
  },
  furacao: {
    usable: (p) => opp(p).magic.some(Boolean),
    unusableMsg: 'O oponente não tem magias no campo.',
    async resolve(p) {
      const o = opp(p);
      for (let i = 0; i < MAGIC_SLOTS; i++) {
        const m = o.magic[i];
        if (!m) continue;
        await UI.animDestroy(m);
        o.magic[i] = null;
        m.charges = 0;
        if (o.hand.length < HAND_LIMIT) { m.isNew = true; o.hand.push(m); log(`O Furacão devolve ${cn(m)} para a mão de ${o.name}.`, p.id); }
        else { toDiscard(o, m); log(`O Furacão despedaça ${cn(m)} (mão cheia).`, p.id); }
        render();
        await magicGone(m);
      }
    },
  },
  sobrecarga: {
    usable: (p) => p.magic.some(Boolean) && opp(p).magic.some(Boolean),
    unusableMsg: 'Precisa de uma magia sua e de uma do oponente no campo.',
    async resolve(p) {
      const o = opp(p);
      const mine = await ask(p, 'pick', { prompt: 'Sobrecarga: escolha a magia sua que vai explodir.', candidates: magicCands(p), purpose: 'sacrificeMagic' });
      if (mine) await destroy(p.magic[mine.slot], { noSave: true });
      for (let i = 0; i < 2; i++) {
        const cands = magicCands(o);
        if (!cands.length) break;
        const t = await ask(p, 'pick', { prompt: `Sobrecarga: escolha uma magia do oponente para destruir (${i + 1}/2).`, candidates: cands, purpose: 'destroyMagic' });
        if (!t) break;
        await destroy(o.magic[t.slot]);
      }
    },
  },
  eco: {
    usable: (p) => {
      const id = S.lastActive && S.lastActive[1 - p.id];
      if (!id) return false;
      const ab = ABILITIES[id];
      return !(ab.targets && !ab.targets(p).length) && !(ab.usable && !ab.usable(p));
    },
    unusableMsg: 'Não há uma magia ativa do oponente que dê para repetir agora.',
    async resolve(p) {
      const id = S.lastActive[1 - p.id], ab = ABILITIES[id];
      log(`O Eco Arcano repete <b>${DEF(id).name}</b>!`, p.id);
      let t;
      if (ab.targets) t = await ask(p, 'pick', { prompt: `Eco Arcano (${DEF(id).name}): ${ab.prompt}`, candidates: ab.targets(p), purpose: ab.purpose });
      await ab.resolve(p, t);
    },
  },
  lua: {
    async onTurnStart(m, p) {
      if (p.luck % 2 === 0) {
        const mine = p.field.filter(Boolean);
        for (const c of mine) { c.bonus += 50; UI.float(c, '+50', 'buff'); }
        if (mine.length) log(`${cn(m)}: sorte par! Seus combatentes ganham +50.`, p.id);
      } else {
        p.luck = Math.min(LUCK_CAP, p.luck + 2);
        log(`${cn(m)}: sorte ímpar, +2 de sorte (agora ${p.luck}).`, p.id);
        UI.floatPlayer(p, '+2 🍀', 'luck');
      }
      SFX.play('luck');
      render();
      await sleep(300);
    },
  },
  controle: {
    async onEnter(m, p) {
      const o = opp(p), free = p.field.indexOf(null);
      const cands = fieldCands(o);
      if (!cands.length) { log(`${cn(m)} não encontrou combatentes para controlar.`, p.id); return; }
      if (free < 0) { log(`${cn(m)}: sem espaço livre, nada a controlar.`, p.id); return; }
      const pk = await ask(p, 'pick', { prompt: 'Controle Remoto: escolha um combatente do oponente para controlar.', candidates: cands, purpose: 'destroy' });
      if (!pk) return;
      const t = o.field[pk.slot];
      const snap = UI.rects([t]);
      o.field[pk.slot] = null;
      p.field[free] = t;
      t.controller = p.id;
      t.attacksUsed = 0;
      m.controlled = t;
      m.fromSlot = pk.slot;
      log(`${p.name} assume o controle de ${cn(t)}!`, p.id);
      SFX.play('magic');
      render();
      await UI.flip(snap);
    },
  },
  centro: {},
  protecao: { onPlace(m) { m.charges = 2; } },
  ferradura: {
    async onTurnStart(m, p) {
      const r = p.lastRoll;
      if (r == null) return;
      if (r >= 18) {
        if (p.lucky < LUCKY_CHARGES) p.lucky++;
        log(`${cn(m)}: rolagem alta! ${p.name} recupera 1 Carga Sortuda (${p.lucky}/${LUCKY_CHARGES}) e a ferradura se quebra.`, p.id);
        SFX.play('luck');
        render();
        await destroy(m, { noSave: true, selfDestruct: true });
      } else if (r <= 10) {
        p.luck = Math.min(LUCK_CAP, p.luck + 4);
        log(`${cn(m)}: rolagem baixa, +4 de sorte (agora ${p.luck}).`, p.id);
        UI.floatPlayer(p, '+4 🍀', 'luck');
        SFX.play('luck');
        render();
        await sleep(300);
      }
    },
  },
  superbonus: {
    async resolve(p) {
      const canCharge = p.hp > 1 && p.lucky < LUCKY_CHARGES;
      const r = await ask(p, 'choose', {
        title: '⭐ Super Bônus', text: 'Escolha o seu bônus:', purpose: 'superbonus',
        options: [
          { label: '❤ → ✨ Perder 1 coração e recuperar 1 Carga Sortuda', value: 'charge', disabled: !canCharge },
          { label: '🍀 Ganhar +5 de sorte', value: 'luck' },
        ],
      });
      if (r === 'charge' && canCharge) {
        log(`${p.name} troca 1 coração por 1 Carga Sortuda.`, p.id);
        await damage(p, 1);
        p.lucky++;
      } else {
        p.luck = Math.min(LUCK_CAP, p.luck + 5);
        log(`${p.name} ganha +5 de sorte (agora ${p.luck}).`, p.id);
        UI.floatPlayer(p, '+5 🍀', 'luck');
        SFX.play('luck');
      }
      render();
    },
  },
  caixinha: {
    async resolve(p) {
      p.luckLock = { value: p.luck, turns: 2 };
      log(`${p.name} guarda <b>${p.luck}</b> de sorte na Caixinha Dourada pelos próximos 2 turnos.`, p.id);
      SFX.play('luck');
      render();
    },
  },
  desencantar: {
    targets: (p) => magicCands(opp(p)),
    purpose: 'destroyMagic',
    prompt: 'Escolha uma magia do oponente para desencantar.',
    async resolve(p, t) {
      const m = opp(p).magic[t.slot];
      const k = DEF(m.defId).cost;
      const refund = k.t === 'luck' || k.t === 'bluck' ? Math.min(8, k.v) : 0;
      if ((await destroy(m)) === m && refund) {
        p.luck = Math.min(LUCK_CAP, p.luck + refund);
        log(`A energia de ${cn(m)} volta para ${p.name}: +${refund} de sorte.`, p.id);
        UI.floatPlayer(p, `+${refund} 🍀`, 'luck');
        SFX.play('luck');
        render();
      }
    },
  },
  eclipse: {
    usable: (p) => S.players.some((x) => x.magic.some(Boolean)),
    unusableMsg: 'Não há magias no campo para o Eclipse apagar.',
    async resolve(p) {
      let n = 0;
      for (const m of S.players.flatMap((x) => x.magic.filter(Boolean))) {
        if (locate(m) && (await destroy(m)) === m) n++;
      }
      if (n) {
        p.luck = Math.min(LUCK_CAP, p.luck + 2 * n);
        log(`O Eclipse apaga ${n} magia${n > 1 ? 's' : ''}: ${p.name} ganha +${2 * n} de sorte.`, p.id);
        UI.floatPlayer(p, `+${2 * n} 🍀`, 'luck');
        SFX.play('luck');
        render();
      }
    },
  },
  trevo: {
    async onTurnStart(m, p) {
      p.luck = Math.min(LUCK_CAP, p.luck + 2);
      log(`${cn(m)}: +2 de sorte (agora ${p.luck}).`, p.id);
      UI.floatPlayer(p, '+2 🍀', 'luck');
      SFX.play('luck');
      render();
      await sleep(350);
    },
  },
  grimorio: {
    onPlace(m) { m.charges = 3; },
    async onTurnStart(m, p) {
      m.charges--;
      log(`${cn(m)}: ${p.name} compra uma carta extra${m.charges > 0 ? ` (${m.charges} restante${m.charges > 1 ? 's' : ''})` : ''}.`, p.id);
      await draw(p);
      if (m.charges <= 0) {
        log(`${cn(m)} se desfaz em cinzas.`, p.id);
        await destroy(m, { noSave: true, selfDestruct: true });
      }
    },
  },
  estandarte: { allyPower: 100 },
  muralha: { onPlace(m) { m.charges = 3; } },
  espelho: {},
  pocao: {
    async resolve(p) {
      const o = opp(p);
      const r = Math.floor(Math.random() * 3);
      if (r === 0) {
        log(`Poção: ${p.name} recupera 2 corações!`, p.id);
        await heal(p, 2);
      } else if (r === 1) {
        log(`Poção: ${p.name} compra uma carta.`, p.id);
        UI.toast('A poção revelou… uma carta!');
        await draw(p);
      } else {
        if (o.hand.length) {
          const i = Math.floor(Math.random() * o.hand.length);
          const [x] = o.hand.splice(i, 1);
          toDiscard(o, x);
          log(`Poção: ${o.name} descarta ${cn(x)} e perde 1 coração!`, p.id);
        } else log(`Poção: ${o.name} perde 1 coração!`, p.id);
        render();
        await damage(o, 1);
      }
    },
  },
  dissipar: {
    targets: (p) => magicCands(opp(p)),
    purpose: 'destroyMagic',
    prompt: 'Escolha uma magia do oponente para destruir.',
    async resolve(p, t) { await destroy(opp(p).magic[t.slot]); },
  },
  bencao: {
    targets: (p) => fieldCands(p),
    purpose: 'buff',
    prompt: 'Escolha um combatente seu para receber +250 de poder.',
    async resolve(p, t) {
      const c = p.field[t.slot];
      c.bonus += 250;
      UI.float(c, '+250', 'buff');
      SFX.play('buff');
      log(`${cn(c)} recebe a Bênção da Lua (+250).`, p.id);
      render();
    },
  },
  maldicao: {
    targets: (p) => fieldCands(opp(p)),
    purpose: 'curse',
    prompt: 'Escolha um combatente inimigo para amaldiçoar (−200).',
    async resolve(p, t) {
      const c = opp(p).field[t.slot];
      if (spellBlocked(p, c)) return;
      c.bonus -= 200;
      UI.float(c, '−200', 'debuff');
      SFX.play('debuff');
      log(`${cn(c)} é amaldiçoado (−200).`, p.id);
      render();
      await sleep(350);
      if (power(c) <= 0) await destroy(c);
    },
  },
  fogo: {
    targets: (p) => fieldCands(opp(p), (x) => power(x) <= 400),
    purpose: 'destroy',
    prompt: 'Escolha um combatente inimigo (≤ 400) para incinerar.',
    async resolve(p, t) {
      const o = opp(p), c = o.field[t.slot];
      if (spellBlocked(p, c)) return;
      if (await destroy(c)) {
        log(`As chamas alcançam ${o.name}!`, p.id);
        await damage(o, 1);
      }
    },
  },
  raio: {
    targets: (p) => fieldCands(opp(p)),
    purpose: 'destroy',
    prompt: 'Escolha o primeiro combatente inimigo para destruir.',
    async resolve(p, t) {
      const o = opp(p), first = o.field[t.slot];
      if (!spellBlocked(p, first)) await destroy(first);
      const cands = fieldCands(o);
      if (!cands.length) return;
      const pk = await ask(p, 'pick', { prompt: 'Raio Divino: escolha o segundo combatente inimigo.', candidates: cands, purpose: 'destroy' });
      if (!pk) return;
      const second = o.field[pk.slot];
      if (!spellBlocked(p, second)) await destroy(second);
    },
  },
};
