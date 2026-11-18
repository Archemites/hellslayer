'use strict';

function buildNivaldo() {
  const root = new THREE.Group();
  const scale = 0.88;
  root.scale.setScalar(scale);
  const rig = { root, h: 2.48 * scale };

  // Paleta inspirada na referência mantendo a estética quadradona PSX/voxel
  const BLOOD_1 = 0x6b0e10;
  const BLOOD_2 = 0x48090a;
  const PANTS_BASE = 0x382b23;
  const PANTS_CAMO1 = 0x4e3c2f;
  const PANTS_CAMO2 = 0x241c17;
  const PANTS_CAMO3 = 0x453b28;
  const BOOT_BASE = 0x5c331c;
  const BOOT_HI = 0x734226;
  const BOOT_DARK = 0x3b1f10;
  const SOLE_COL = 0x22140f;
  const BELT_COL = 0x321f13;
  const POUCH_COL = 0x784a22;
  const POUCH_SH = 0x563214;
  const HAIR_BASE = 0x160d08;
  const HAIR_HI = 0x26170f;
  const HAIR_SH = 0x0e0805;
  const GOLD_CROSS = 0xe8b931;
  const GOLD_CHAIN = 0xc9961a;

  // Helper de spike (cone piramidal metálico) para as pulseiras
  const spikeGeo = new THREE.ConeGeometry(0.038, 0.115, 4);
  function addWristSpikes(parent, yPos, radius) {
    part(parent, 0.36, 0.16, 0.36, 0x161214, 0, yPos, 0);
    part(parent, 0.37, 0.03, 0.37, 0x3a3e46, 0, yPos + 0.058, 0);
    part(parent, 0.37, 0.03, 0.37, 0x3a3e46, 0, yPos - 0.058, 0);
    const dirs = [
      [1, 0, 0, -Math.PI / 2],
      [-1, 0, 0, Math.PI / 2],
      [0, 0, 1, Math.PI / 2],
      [0, 0, -1, -Math.PI / 2]
    ];
    for (let i = 0; i < dirs.length; i++) {
      const [dx, dy, dz, ang] = dirs[i];
      const sp = new THREE.Mesh(spikeGeo, MT(0xd0d6e0));
      sp.position.set(dx * radius, yPos, dz * radius);
      if (dx !== 0) sp.rotation.z = ang;
      else sp.rotation.x = ang;
      parent.add(sp);
    }
    // Spikes diagonais extras
    const diag = radius * 0.78;
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        const sp = new THREE.Mesh(spikeGeo, MT(0xb8c0cc));
        sp.position.set(sx * diag, yPos, sz * diag);
        sp.rotation.order = 'YXZ';
        sp.rotation.y = Math.atan2(sx, sz);
        sp.rotation.x = Math.PI / 2;
        parent.add(sp);
      }
    }
  }

  // JUNTAS 1 e 2: Pernas articuladas — Calça Cargo Camuflada + Coturnos Marrons Altos
  const mkLeg = (side) => {
    const l = limb(root, 0.48, 0.48, 0.50, PANTS_BASE, side * 0.30, 0.98, 0);
    // Coxa larga com manchas camufladas e respingos de sangue
    part(l, 0.50, 0.44, 0.52, PANTS_BASE, 0, -0.22, 0.01);
    part(l, 0.22, 0.16, 0.53, PANTS_CAMO1, -side * 0.10, -0.14, 0.01);
    part(l, 0.20, 0.18, 0.53, PANTS_CAMO2, side * 0.12, -0.28, 0.01);
    part(l, 0.18, 0.12, 0.53, PANTS_CAMO3, 0, -0.36, 0.01);
    part(l, 0.14, 0.16, 0.04, BLOOD_1, -side * 0.06, -0.22, 0.26);
    part(l, 0.10, 0.10, 0.04, BLOOD_2, side * 0.08, -0.34, 0.26);
    // Bolso cargo grande na lateral externa da coxa
    part(l, 0.12, 0.24, 0.32, PANTS_CAMO1, side * 0.27, -0.26, 0.01);
    part(l, 0.13, 0.06, 0.34, PANTS_CAMO2, side * 0.27, -0.15, 0.01);
    part(l, 0.03, 0.10, 0.14, BLOOD_1, side * 0.325, -0.28, 0.04);

    // Joelho / Canela (joint filho)
    const knee = new THREE.Group();
    knee.position.set(0, -0.46, 0);
    l.add(knee);
    // Tecido amassado da calça camuflada na altura do joelho e boca da bota
    part(knee, 0.46, 0.18, 0.48, PANTS_BASE, 0, -0.02, 0);
    part(knee, 0.48, 0.10, 0.50, PANTS_CAMO2, 0, -0.04, 0.02);
    part(knee, 0.24, 0.10, 0.05, PANTS_CAMO1, side * 0.08, 0.01, 0.24);
    part(knee, 0.12, 0.08, 0.04, BLOOD_1, -side * 0.08, -0.03, 0.25);

    // Cano alto do coturno militar marrom com língua, cadarços e ilhós
    part(knee, 0.48, 0.30, 0.50, BOOT_BASE, 0, -0.24, 0.01);
    part(knee, 0.50, 0.06, 0.52, BOOT_DARK, 0, -0.11, 0.01); // borda superior do cano
    part(knee, 0.24, 0.28, 0.08, BOOT_HI, 0, -0.24, 0.24);   // língua frontal
    // Fileiras de cadarços cruzados e ilhós metálicos
    for (let ly = -0.14; ly >= -0.34; ly -= 0.055) {
      part(knee, 0.20, 0.022, 0.04, 0x26150c, 0, ly, 0.275);
      part(knee, 0.03, 0.025, 0.03, 0x8d8578, -0.11, ly, 0.27);
      part(knee, 0.03, 0.025, 0.03, 0x8d8578, 0.11, ly, 0.27);
    }
    part(knee, 0.14, 0.12, 0.04, BLOOD_1, side * 0.16, -0.26, 0.24);

    // Tornozelo / Pé do coturno com sola tratorada grossa (joint neto)
    const foot = new THREE.Group();
    foot.position.set(0, -0.38, 0);
    knee.add(foot);
    part(foot, 0.46, 0.12, 0.48, BOOT_DARK, 0, 0, 0.02);
    // Corpo do coturno marrom + biqueira larga
    part(foot, 0.52, 0.20, 0.62, BOOT_BASE, 0, -0.02, 0.07);
    part(foot, 0.40, 0.09, 0.28, BOOT_HI, 0, 0.06, 0.14);
    part(foot, 0.50, 0.15, 0.22, BOOT_HI, 0, -0.03, 0.32);
    part(foot, 0.16, 0.09, 0.14, BLOOD_1, -side * 0.10, 0.02, 0.34);
    // Cadarços no peito do pé
    part(foot, 0.20, 0.025, 0.05, 0x26150c, 0, 0.08, 0.20);
    part(foot, 0.20, 0.025, 0.05, 0x26150c, 0, 0.06, 0.26);
    // Sola tratorada pesada com cravos
    part(foot, 0.55, 0.08, 0.66, SOLE_COL, 0, -0.12, 0.07);
    for (let tz = -0.18; tz <= 0.34; tz += 0.13) {
      part(foot, 0.56, 0.035, 0.07, 0x160c09, 0, -0.165, tz);
    }
    // Calcanhar reforçado
    part(foot, 0.48, 0.12, 0.16, BOOT_DARK, 0, -0.04, -0.22);
    return { leg: l, knee, foot };
  };
  const legL = mkLeg(-1), legR = mkLeg(1);
  rig.legL = legL.leg; rig.kneeL = legL.knee; rig.footL = legL.foot;
  rig.legR = legR.leg; rig.kneeR = legR.knee; rig.footR = legR.foot;

  // JUNTA 3: Cintura / Quadril (calça camuflada + cinto marrom + fivela retangular + coldres de ferramentas)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.98, 0);
  root.add(torsoGroup);
  rig.torsoGroup = torsoGroup;

  // Quadril da calça camuflada
  part(torsoGroup, 0.98, 0.22, 0.58, PANTS_BASE, 0, 0.10, 0);
  part(torsoGroup, 0.34, 0.14, 0.60, PANTS_CAMO1, -0.24, 0.09, 0);
  part(torsoGroup, 0.30, 0.14, 0.60, PANTS_CAMO2, 0.26, 0.09, 0);
  // Cinto de couro marrom largo
  part(torsoGroup, 1.04, 0.14, 0.62, BELT_COL, 0, 0.08, 0);
  // Passantes do cinto
  for (const lx of [-0.42, -0.20, 0.20, 0.42]) {
    part(torsoGroup, 0.05, 0.16, 0.64, 0x24150c, lx, 0.08, 0);
  }
  // Fivela retangular metálica robusta
  part(torsoGroup, 0.20, 0.16, 0.05, 0x6c727c, 0, 0.08, 0.315);
  part(torsoGroup, 0.12, 0.10, 0.06, BELT_COL, 0, 0.08, 0.32);
  part(torsoGroup, 0.03, 0.11, 0.065, 0x8e96a2, -0.02, 0.08, 0.322);

  // Coldres / Bolsos utilitários de couro marrom nos dois lados da cintura
  for (const sx of [-1, 1]) {
    part(torsoGroup, 0.24, 0.22, 0.14, POUCH_COL, sx * 0.38, -0.01, 0.28);
    part(torsoGroup, 0.25, 0.06, 0.15, POUCH_SH, sx * 0.38, 0.06, 0.285);
    part(torsoGroup, 0.18, 0.14, 0.04, POUCH_SH, sx * 0.38, -0.03, 0.34);
  }
  // 3 ferramentas metálicas encaixadas no bolso da direita do Nivaldo (lado esquerdo na visão frontal)
  for (let ti = -1; ti <= 1; ti++) {
    part(torsoGroup, 0.04, 0.14, 0.03, 0x9aa2ae, -0.38 + ti * 0.065, 0.12, 0.29);
    part(torsoGroup, 0.045, 0.05, 0.035, 0x2e241e, -0.38 + ti * 0.065, 0.17, 0.29);
  }

  // Abdômen trincado (6-pack) + oblíquos + manchas de sangue
  rig.torso = part(torsoGroup, 0.94, 0.44, 0.55, SKIN_N, 0, 0.38, 0);
  for (let row = 0; row < 3; row++) {
    const ay = 0.45 - row * 0.115;
    part(torsoGroup, 0.19, 0.095, 0.06, SKIN_HI, -0.12, ay, 0.285);
    part(torsoGroup, 0.19, 0.095, 0.06, SKIN_HI, 0.12, ay, 0.285);
  }
  part(torsoGroup, 0.04, 0.38, 0.05, SKIN_SH, 0, 0.34, 0.292);
  // Oblíquos laterais
  part(torsoGroup, 0.12, 0.34, 0.42, SKIN_SH, -0.44, 0.34, 0.04);
  part(torsoGroup, 0.12, 0.34, 0.42, SKIN_SH, 0.44, 0.34, 0.04);
  // Respingos de sangue no abdômen
  part(torsoGroup, 0.14, 0.12, 0.02, BLOOD_1, -0.22, 0.36, 0.285);
  part(torsoGroup, 0.10, 0.16, 0.02, BLOOD_2, 0.18, 0.28, 0.285);

  // JUNTA 4: Meio do Peito / Coluna Torácica (Tronco nu super musculoso + Corrente e Crucifixo Dourado)
  const chestGroup = new THREE.Group();
  chestGroup.position.set(0, 0.52, 0);
  torsoGroup.add(chestGroup);
  rig.chestGroup = chestGroup;

  // Caixa torácica / dorsais imensas (silhueta larga em V)
  part(chestGroup, 1.40, 0.50, 0.68, SKIN_N, 0, 0.22, 0);
  // Peitorais enormes definidos
  part(chestGroup, 0.58, 0.34, 0.17, SKIN_HI, -0.33, 0.24, 0.30);
  part(chestGroup, 0.58, 0.34, 0.17, SKIN_HI, 0.33, 0.24, 0.30);
  part(chestGroup, 0.06, 0.32, 0.15, SKIN_SH, 0, 0.24, 0.32);
  // Respingos de sangue no peito
  part(chestGroup, 0.20, 0.12, 0.02, BLOOD_1, -0.34, 0.28, 0.385);
  part(chestGroup, 0.16, 0.10, 0.02, BLOOD_2, 0.30, 0.18, 0.385);
  part(chestGroup, 0.12, 0.14, 0.02, BLOOD_1, 0.42, 0.30, 0.385);
  // Costas / dorsais saltadas
  part(chestGroup, 1.32, 0.44, 0.14, SKIN_SH, 0, 0.22, -0.32);

  // TRAPÉZIO IMENSO (sobe dos ombros até a base da cabeça)
  const trapL = part(chestGroup, 0.58, 0.35, 0.54, SKIN_N, -0.35, 0.50, -0.02);
  trapL.rotation.z = 0.28;
  const trapR = part(chestGroup, 0.58, 0.35, 0.54, SKIN_N, 0.35, 0.50, -0.02);
  trapR.rotation.z = -0.28;
  part(chestGroup, 0.64, 0.26, 0.50, SKIN_HI, 0, 0.50, -0.04);
  // Pescoço grosso
  part(chestGroup, 0.44, 0.18, 0.44, SKIN_SH, 0, 0.60, 0.02);

  // Corrente Dourada no pescoço descendo em V até o Crucifixo Dourado no centro do peito
  const chainL = part(chestGroup, 0.036, 0.34, 0.036, GOLD_CHAIN, -0.11, 0.44, 0.31, { em: 0x2e1e00 });
  chainL.rotation.z = 0.42;
  chainL.rotation.x = -0.46;
  const chainR = part(chestGroup, 0.036, 0.34, 0.036, GOLD_CHAIN, 0.11, 0.44, 0.31, { em: 0x2e1e00 });
  chainR.rotation.z = -0.42;
  chainR.rotation.x = -0.46;
  // Parte de trás da corrente ao redor do pescoço
  part(chestGroup, 0.46, 0.036, 0.036, GOLD_CHAIN, 0, 0.54, -0.20, { em: 0x2e1e00 });
  part(chestGroup, 0.036, 0.036, 0.44, GOLD_CHAIN, -0.22, 0.54, 0.01, { em: 0x2e1e00 });
  part(chestGroup, 0.036, 0.036, 0.44, GOLD_CHAIN, 0.22, 0.54, 0.01, { em: 0x2e1e00 });
  // Elo + Crucifixo dourado grande no centro do peito
  part(chestGroup, 0.04, 0.05, 0.04, GOLD_CHAIN, 0, 0.32, 0.385, { em: 0x2e1e00 });
  part(chestGroup, 0.068, 0.29, 0.05, GOLD_CROSS, 0, 0.20, 0.395, { em: 0x4a3200 });
  part(chestGroup, 0.19, 0.064, 0.05, GOLD_CROSS, 0, 0.25, 0.395, { em: 0x4a3200 });

  // JUNTA 5: Cabeça (pivô na base do pescoço) — Rosto carrancudo com barba cheia e mullet cacheado
  const head = new THREE.Group();
  head.position.set(0, 0.64, 0.02);
  chestGroup.add(head);
  rig.head = head;

  part(head, 0.48, 0.48, 0.48, SKIN_N, 0, 0.18, 0);
  // Mandíbula quadrada + BARBA CHEIA E FECHADA escura
  part(head, 0.51, 0.18, 0.51, HAIR_BASE, 0, 0.01, 0.02);
  part(head, 0.46, 0.10, 0.46, HAIR_SH, 0, -0.06, 0.03); // base do queixo barbudo
  // Costeletas da barba descendo até o maxilar
  part(head, 0.09, 0.26, 0.18, HAIR_BASE, -0.23, 0.12, 0.10);
  part(head, 0.09, 0.26, 0.18, HAIR_BASE, 0.23, 0.12, 0.10);
  // Bigode espesso e cavanhaque fechando a expressão séria
  part(head, 0.26, 0.065, 0.07, HAIR_SH, 0, 0.085, 0.245);
  part(head, 0.20, 0.032, 0.05, 0x1a0b09, 0, 0.045, 0.252); // boca séria fechada
  part(head, 0.22, 0.06, 0.07, HAIR_BASE, 0, 0.00, 0.248);

  // Cabelo cacheado volumoso no topo + Mullet longo cacheado atrás
  // Camadas de cachos no topo da cabeça
  part(head, 0.52, 0.13, 0.50, HAIR_BASE, 0, 0.42, -0.02);
  part(head, 0.46, 0.10, 0.44, HAIR_HI, 0, 0.49, -0.01);
  // Topete cacheado (bloquetes irregulares para dar textura de cachos)
  const curlTops = [
    [-0.14, 0.49, 0.14, 0.18, 0.11, 0.18, HAIR_HI],
    [0.0, 0.51, 0.16, 0.18, 0.12, 0.18, HAIR_BASE],
    [0.14, 0.49, 0.14, 0.18, 0.11, 0.18, HAIR_HI],
    [-0.18, 0.44, 0.18, 0.13, 0.10, 0.13, HAIR_SH],
    [0.18, 0.44, 0.18, 0.13, 0.10, 0.13, HAIR_SH]
  ];
  for (const [cx, cy, cz, cw, ch, cd, cc] of curlTops) {
    part(head, cw, ch, cd, cc, cx, cy, cz);
  }
  // Parte de trás do mullet cacheado (camadas volumosas descendo pelos ombros)
  const mulletTop = part(head, 0.56, 0.34, 0.18, HAIR_BASE, 0, 0.22, -0.26);
  mulletTop.rotation.x = 0.10;
  const mulletMid = part(head, 0.66, 0.38, 0.17, HAIR_SH, 0, -0.04, -0.32);
  mulletMid.rotation.x = 0.20;
  const mulletLow = part(head, 0.72, 0.30, 0.14, HAIR_BASE, 0, -0.26, -0.38);
  mulletLow.rotation.x = 0.26;
  // Cachos laterais volumosos caindo atrás das orelhas e nos ombros
  for (const sx of [-1, 1]) {
    const sideLock = part(head, 0.18, 0.46, 0.18, HAIR_HI, sx * 0.27, 0.04, -0.22);
    sideLock.rotation.z = -sx * 0.14;
    sideLock.rotation.x = 0.16;
    part(head, 0.16, 0.18, 0.16, HAIR_BASE, sx * 0.32, -0.14, -0.26);
    const tipLock = part(head, 0.16, 0.22, 0.12, HAIR_HI, sx * 0.26, -0.30, -0.40);
    tipLock.rotation.z = -sx * 0.20;
    tipLock.rotation.x = 0.28;
  }
  const centerTip = part(head, 0.28, 0.18, 0.12, HAIR_HI, 0, -0.36, -0.42);
  centerTip.rotation.x = 0.30;

  // Orelhas
  part(head, 0.06, 0.14, 0.10, SKIN_SH, -0.26, 0.19, 0);
  part(head, 0.06, 0.14, 0.10, SKIN_SH, 0.26, 0.19, 0);
  // Sobrancelhas grossas muito franzidas em V
  const browL = part(head, 0.17, 0.06, 0.06, 0x100805, -0.11, 0.285, 0.245);
  browL.rotation.z = -0.30;
  const browR = part(head, 0.17, 0.06, 0.06, 0x100805, 0.11, 0.285, 0.245);
  browR.rotation.z = 0.30;
  // Ruga de raiva entre as sobrancelhas
  part(head, 0.04, 0.08, 0.03, SKIN_SH, 0, 0.265, 0.248);
  // Olhos semicerrados (brilham dourado no Modo Super-Fé)
  rig.eyeL = part(head, 0.095, 0.044, 0.02, 0xf0e6d0, -0.11, 0.22, 0.245, { basic: true });
  rig.eyeR = part(head, 0.095, 0.044, 0.02, 0xf0e6d0, 0.11, 0.22, 0.245, { basic: true });
  part(head, 0.042, 0.038, 0.025, 0x100808, -0.105, 0.22, 0.252, { basic: true });
  part(head, 0.042, 0.038, 0.025, 0x100808, 0.105, 0.22, 0.252, { basic: true });
  // Nariz largo
  part(head, 0.095, 0.095, 0.07, SKIN_SH, 0, 0.155, 0.255);

  // JUNTAS 6..11: Ombros gigantes -> Braços musculosos -> Antebraços com braceletes de spike -> Punhos
  const mkArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.62, 0.36, 0);
    chestGroup.add(shoulder);
    // Ponte muscular entre peito/trapézio e deltoide
    part(shoulder, 0.28, 0.28, 0.36, SKIN_N, side * 0.08, -0.04, 0);

    // Braço superior (upper arm) + Deltoide gigante e Bíceps saltado
    const arm = limb(shoulder, 0.38, 0.48, 0.38, SKIN_N, side * 0.24, 0, 0);
    part(arm, 0.46, 0.35, 0.46, SKIN_HI, side * 0.02, -0.10, 0);
    part(arm, 0.42, 0.26, 0.42, SKIN_N, 0, -0.32, 0.01);
    part(arm, 0.18, 0.16, 0.03, BLOOD_1, side * 0.04, -0.14, 0.235);

    // Cotovelo / Antebraço (joint filho)
    const forearm = new THREE.Group();
    forearm.position.set(0, -0.46, 0);
    arm.add(forearm);
    part(forearm, 0.30, 0.16, 0.30, SKIN_N, 0, 0, 0);
    part(forearm, 0.35, 0.44, 0.35, SKIN_N, 0, -0.22, 0);
    part(forearm, 0.24, 0.36, 0.37, SKIN_HI, 0, -0.20, 0.02);
    // Bracelete de couro escuro com spikes metálicos no pulso
    addWristSpikes(forearm, -0.36, 0.21);

    // Punho / Mão (joint neto)
    const hand = new THREE.Group();
    hand.position.set(0, -0.44, 0);
    forearm.add(hand);
    part(hand, 0.32, 0.22, 0.32, SKIN_N, 0, -0.06, 0);
    part(hand, 0.33, 0.07, 0.33, SKIN_SH, 0, -0.08, 0.02);
    return { shoulder, arm, forearm, hand };
  };
  const L = mkArm(-1), R = mkArm(1);
  rig.shoulderL = L.shoulder;
  rig.armL = L.arm;
  rig.forearmL = L.forearm;
  rig.handL = L.hand;
  rig.shoulderR = R.shoulder;
  rig.armR = R.arm;
  rig.forearmR = R.forearm;
  rig.handR = R.hand;

  // Prop 3D: Martelo de Obras na mão direita
  const hammer = new THREE.Group();
  hammer.position.set(0, -0.08, 0.06);
  hammer.rotation.x = Math.PI * 0.5;
  part(hammer, 0.08, 0.76, 0.08, 0x6a4420, 0, 0.24, 0);
  part(hammer, 0.18, 0.22, 0.40, 0x70747c, 0, 0.64, 0);
  part(hammer, 0.20, 0.24, 0.10, 0x45484e, 0, 0.64, -0.21);
  hammer.visible = false;
  rig.handL.add(hammer);
  rig.hammer = hammer;

  // Prop 3D: Coração Ateu na mão direita
  const heart = bioHeart(2.2);
  heart.position.set(0, -0.14, 0.14);
  heart.visible = false;
  rig.handR.add(heart);
  rig.heart = heart;

  // Prop 3D: Super-Cruz Dourada gigante do Galius na mão direita
  const cross = new THREE.Group();
  cross.position.set(0, -0.06, 0.08);
  cross.rotation.x = Math.PI * 0.5;
  const gs = 2.9;
  part(cross, 0.28 * gs, 3.4 * gs, 0.28 * gs, 0xd4a017, 0, 3.8, 0, { em: 0x3a2800 });
  part(cross, 1.5 * gs, 0.28 * gs, 0.28 * gs, 0xd4a017, 0, 6.4, 0, { em: 0x3a2800 });
  part(cross, 0.34 * gs, 0.34 * gs, 0.34 * gs, 0xfff0a0, 0, 6.4, 0, { basic: true });
  cross.visible = false;
  rig.handR.add(cross);
  rig.cross = cross;

  // Prop 3D: Estilingue na mão direita
  const sling = new THREE.Group();
  sling.position.set(0, -0.08, 0.06);
  sling.rotation.x = Math.PI * 0.5;
  sling.scale.setScalar(1.35);
  part(sling, 0.055, 0.28, 0.055, 0x6a4420, 0, 0.14, 0);
  part(sling, 0.07, 0.035, 0.07, 0x4a2e16, 0, 0.0, 0);
  part(sling, 0.08, 0.05, 0.06, 0x523418, 0, 0.28, 0);
  const slA = part(sling, 0.04, 0.20, 0.04, 0x6a4420, -0.041, 0.371, 0); slA.rotation.z = 0.42;
  const slB = part(sling, 0.04, 0.20, 0.04, 0x6a4420, 0.041, 0.371, 0); slB.rotation.z = -0.42;
  part(sling, 0.05, 0.03, 0.05, 0x4a2e16, -0.081, 0.46, 0);
  part(sling, 0.05, 0.03, 0.05, 0x4a2e16, 0.081, 0.46, 0);
  const sBandL = part(sling, 0.014, 0.014, 0.125, 0xaa5030, -0.041, 0.44, 0.045);
  sBandL.rotation.order = 'YXZ';
  sBandL.rotation.set(0.16, 0.736, 0);
  const sBandR = part(sling, 0.014, 0.014, 0.125, 0xaa5030, 0.041, 0.44, 0.045);
  sBandR.rotation.order = 'YXZ';
  sBandR.rotation.set(0.16, -0.736, 0);
  const sPouch = part(sling, 0.06, 0.05, 0.02, 0x4a2816, 0, 0.43, 0.095);
  const sRock = part(sling, 0.065, 0.065, 0.065, 0x8a8a90, 0, 0.43, 0.065);
  sling.bandL = sBandL;
  sling.bandR = sBandR;
  sling.pouch = sPouch;
  sling.rock = sRock;
  sling.userData = { tipY: 0.46, restY: 0.43, restZ: 0.095, rockZ: 0.065, baseLen: 0.125 };
  sling.visible = false;
  rig.handL.add(sling);
  rig.sling = sling;

  // Prop 3D: Foice (duas mãos) na mão direita (handL)
  const scythe = new THREE.Group();
  scythe.position.set(0, -0.08, 0.06);
  scythe.rotation.x = Math.PI * 0.5;
  scythe.scale.setScalar(1.35);
  const scyMesh = new THREE.Group();
  scyMesh.rotation.y = Math.PI;
  scythe.add(scyMesh);
  part(scyMesh, 0.05, 1.04, 0.05, 0x6a4420, 0, 0.42, 0);
  part(scyMesh, 0.065, 0.04, 0.065, 0x3a3c42, 0, -0.11, 0);
  part(scyMesh, 0.075, 0.08, 0.075, 0x45484e, 0, 0.93, 0);
  let sbx = -0.01, sby = 0.94;
  [
    { l: 0.18, h: 0.075, a: -0.15 },
    { l: 0.18, h: 0.068, a: 0.15 },
    { l: 0.17, h: 0.058, a: 0.48 },
    { l: 0.15, h: 0.045, a: 0.82 },
    { l: 0.12, h: 0.028, a: 1.15 }
  ].forEach((sg) => {
    const dx = Math.cos(sg.a), dy = Math.sin(sg.a), step = sg.l - 0.02;
    const m = part(scyMesh, sg.l, sg.h, 0.028, 0x8e939e, sbx - dx * (sg.l * 0.5 - 0.01), sby - dy * (sg.l * 0.5 - 0.01), 0);
    m.rotation.z = sg.a;
    sbx -= dx * step; sby -= dy * step;
  });
  scythe.visible = false;
  rig.handL.add(scythe);
  rig.scythe = scythe;

  // Prop 3D: Martelo de Demolição (duas mãos) na mão direita
  const demo = new THREE.Group();
  demo.position.set(0, -0.08, 0.06);
  demo.rotation.x = Math.PI * 0.5;
  demo.scale.setScalar(1.32);
  part(demo, 0.075, 1.12, 0.075, 0x5a3a1c, 0, 0.44, 0);
  part(demo, 0.095, 0.045, 0.095, 0x3a2410, 0, -0.12, 0);
  part(demo, 0.11, 0.06, 0.11, 0x2a2a30, 0, 0.81, 0);
  part(demo, 0.38, 0.26, 0.28, 0x4a4a52, 0, 0.98, 0);
  part(demo, 0.40, 0.05, 0.30, 0x2a2a30, 0, 1.13, 0);
  part(demo, 0.40, 0.05, 0.30, 0x2a2a30, 0, 0.83, 0);
  part(demo, 0.04, 0.22, 0.24, 0x666872, -0.20, 0.98, 0);
  part(demo, 0.04, 0.22, 0.24, 0x666872, 0.20, 0.98, 0);
  demo.visible = false;
  rig.handL.add(demo);
  rig.demo = demo;

  // Prop 3D: Sacra Cruz Papal (mão direita e mão esquerda para troca de mãos)
  const mkPapalCross = () => {
    const g = new THREE.Group();
    g.position.set(0, -0.08, 0.06);
    g.rotation.x = Math.PI * 0.5;
    g.scale.setScalar(1.3);
    const mesh = buildPapalCrossMesh({ auraScale: 0.85 });
    mesh.position.y = 0.12;
    g.add(mesh);
    g.visible = false;
    return g;
  };
  const papalCross = mkPapalCross();
  rig.handR.add(papalCross);
  rig.papalCross = papalCross;
  const papalCrossL = mkPapalCross();
  rig.handL.add(papalCrossL);
  rig.papalCrossL = papalCrossL;

  // Prop 3D: Rosário sagrado no pulso direito
  const rosary = buildRosary(0.96);
  rosary.root.position.set(0, -0.425, 0);
  rosary.root.visible = false;
  rig.forearmR.add(rosary.root);
  rig.rosary = rosary;

  // Prop 3D: Rosário segurado na mão direita durante a cutscene
  const handRosary = buildRosary(0.85, { hanging: true });
  handRosary.root.position.set(0, -0.06, 0.09);
  handRosary.root.visible = false;
  rig.handR.add(handRosary.root);
  rig.handRosary = handRosary.root;

  return rig;
}

BUILD.nivaldo = buildNivaldo;
