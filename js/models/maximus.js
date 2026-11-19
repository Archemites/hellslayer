'use strict';

function buildMaximusSword() {
  const g = new THREE.Group();
  const glowMats = [];
  const steelCol = 0x9aa4b4;
  const darkSteel = 0x4a505e;
  const bronzeCol = 0x6e4a2c;
  const leatherCol = 0x8c562c;

  function swordPart(w, h, d, col, x, y, z, glow) {
    const m = part(g, w, h, d, col, x, y, z, glow ? { em: 0x180406 } : undefined);
    if (glow && m.material) glowMats.push(m.material);
    return m;
  }

  // Pomo facetado em gota na base
  swordPart(0.11, 0.13, 0.11, steelCol, 0, -0.52, 0);
  swordPart(0.07, 0.06, 0.07, darkSteel, 0, -0.60, 0);

  // Empunhadura longa de duas mãos (couro trançado + anéis nervurados)
  swordPart(0.065, 0.48, 0.065, leatherCol, 0, -0.24, 0);
  for (let i = 0; i < 6; i++) {
    const ry = -0.42 + i * 0.075;
    swordPart(0.078, 0.026, 0.078, i % 2 === 0 ? 0x3b2416 : 0xb0723c, 0, ry, 0);
  }

  // Guarda-mão (cruzeta longa curvada com pontas espatuladas)
  const guardL = swordPart(0.40, 0.036, 0.042, steelCol, -0.20, 0.02, 0);
  guardL.rotation.z = -0.14;
  const tipL = swordPart(0.14, 0.046, 0.068, steelCol, -0.44, 0.06, 0);
  tipL.rotation.z = 0.18;
  const guardR = swordPart(0.40, 0.036, 0.042, steelCol, 0.20, 0.02, 0);
  guardR.rotation.z = 0.14;
  const tipR = swordPart(0.14, 0.046, 0.068, steelCol, 0.44, 0.06, 0);
  tipR.rotation.z = -0.18;

  // Anéis concêntricos da guarda (basket/ring guard estilo Zweihänder)
  const ringGeo1 = new THREE.TorusGeometry(0.14, 0.016, 6, 16);
  const ringMat = MT(steelCol);
  for (const [rx, ry, rz, ryPos] of [
    [Math.PI / 2, 0, 0, 0.03],
    [Math.PI / 2 + 0.32, 0.2, 0, 0.00],
    [Math.PI / 2 - 0.32, -0.2, 0, -0.03]
  ]) {
    const ring = new THREE.Mesh(ringGeo1, ringMat);
    ring.position.set(0, ryPos, 0);
    ring.rotation.set(rx, ry, rz);
    g.add(ring);
  }

  // Ricasso (base não afiada acima da guarda) + ganchos de aparo (parrying hooks)
  swordPart(0.095, 0.40, 0.034, bronzeCol, 0, 0.23, 0);
  const hookL = swordPart(0.14, 0.032, 0.032, steelCol, -0.10, 0.40, 0);
  hookL.rotation.z = -0.52;
  const hookR = swordPart(0.14, 0.032, 0.032, steelCol, 0.10, 0.40, 0);
  hookR.rotation.z = 0.52;

  // Lâmina Flamberge serrilhada / ondulada longa
  const bladeLen = 1.68;
  swordPart(0.078, bladeLen, 0.022, steelCol, 0, 0.43 + bladeLen * 0.5, 0, true);
  swordPart(0.030, bladeLen - 0.08, 0.032, 0xc2ccd8, 0, 0.43 + bladeLen * 0.5, 0, true);

  // Dentes flamejantes (ondulação Flamberge ao longo dos dois gumes)
  const teethN = 18;
  for (let i = 0; i < teethN; i++) {
    const ty = 0.48 + (i / teethN) * (bladeLen - 0.14);
    const side = (i % 2 === 0) ? 1 : -1;
    const toothL = swordPart(0.044, 0.056, 0.016, 0xb8c2d0, -0.045 - (side > 0 ? 0.012 : 0), ty, 0, true);
    toothL.rotation.z = side * 0.42;
    const toothR = swordPart(0.044, 0.056, 0.016, 0xb8c2d0, 0.045 + (side < 0 ? 0.012 : 0), ty, 0, true);
    toothR.rotation.z = -side * 0.42;
  }

  // Ponta afiada de lança
  const tipGeo = new THREE.ConeGeometry(0.052, 0.22, 4);
  const tipMat = MT(0xc8d2e0, { em: 0x180406 });
  glowMats.push(tipMat);
  const tip = new THREE.Mesh(tipGeo, tipMat);
  tip.position.set(0, 0.43 + bladeLen + 0.10, 0);
  tip.rotation.y = Math.PI / 4;
  g.add(tip);

  return { root: g, glowMats };
}

function buildMaximus() {
  const root = new THREE.Group();
  const scale = 1.78;
  root.scale.setScalar(scale);
  const rig = { root, h: 2.52 * scale };

  const ARMOR_DARK = 0x161820;
  const ARMOR_MID = 0x242834;
  const ARMOR_HI = 0x3b4254;
  const CHAIN_COL = 0x626a7a;
  const TATTER_COL = 0x111218;
  const PLUME_COL = 0x4e141c;

  // Pernas esguias blindadas articuladas (grevas escuras + joelheiras pontudas + solas carmesim)
  const mkLeg = (side) => {
    const l = limb(root, 0.28, 0.50, 0.28, ARMOR_DARK, side * 0.20, 1.02, 0);
    // Coxote segmentado
    part(l, 0.30, 0.42, 0.32, ARMOR_MID, 0, -0.22, 0);
    part(l, 0.22, 0.36, 0.06, ARMOR_HI, 0, -0.22, 0.16);
    // Junta do joelho -> joelheira pontuda + greva + sabaton
    const kn = limb(l, 0.26, 0.52, 0.26, ARMOR_DARK, 0, -0.48, 0);
    l.userData.subMesh = kn.userData.mesh;
    const knee = part(kn, 0.26, 0.18, 0.12, ARMOR_HI, 0, 0, 0.16);
    knee.rotation.x = -0.25;
    part(kn, 0.08, 0.14, 0.08, ARMOR_HI, side * 0.14, 0.02, 0.06);
    // Greva esguia
    part(kn, 0.26, 0.44, 0.28, ARMOR_DARK, 0, -0.26, 0);
    part(kn, 0.16, 0.38, 0.06, ARMOR_HI, 0, -0.26, 0.14);
    // Sabaton pontudo + detalhe carmesim na sola
    part(kn, 0.24, 0.12, 0.38, ARMOR_MID, 0, -0.47, 0.07);
    part(kn, 0.25, 0.03, 0.40, 0xaa141c, 0, -0.53, 0.07, { em: 0x3a0408 });
    return { leg: l, knee: kn };
  };
  const legLObj = mkLeg(-1), legRObj = mkLeg(1);
  rig.legL = legLObj.leg; rig.kneeL = legLObj.knee;
  rig.legR = legRObj.leg; rig.kneeR = legRObj.knee;

  // Tronco: cintura fina + costelas esqueléticas blindadas + peitoral escuro
  rig.torso = part(root, 0.62, 0.86, 0.42, ARMOR_DARK, 0, 1.46, 0);
  // Cintura fina blindada + cinto com fivela gótica
  part(rig.torso, 0.56, 0.16, 0.40, ARMOR_MID, 0, -0.34, 0);
  part(rig.torso, 0.18, 0.20, 0.08, ARMOR_HI, 0, -0.34, 0.21);
  // Costelas / placas torácicas angulares
  for (let r = 0; r < 4; r++) {
    const ry = -0.14 + r * 0.11;
    const rw = 0.54 + r * 0.06;
    part(rig.torso, rw, 0.055, 0.44, ARMOR_MID, 0, ry, 0.01);
    part(rig.torso, rw * 0.65, 0.035, 0.06, ARMOR_HI, 0, ry, 0.22);
  }
  // Colarinho blindado
  part(rig.torso, 0.46, 0.12, 0.38, ARMOR_HI, 0, 0.42, 0);

  // Saiote / mantos esfarrapados na cintura (tattered tassets)
  for (const sx of [-1, 1]) {
    const tasset = part(rig.torso, 0.26, 0.68, 0.06, TATTER_COL, sx * 0.32, -0.64, -0.02);
    tasset.rotation.z = sx * -0.14;
    const tassetBack = part(rig.torso, 0.32, 0.86, 0.05, TATTER_COL, sx * 0.18, -0.72, -0.22);
    tassetBack.rotation.x = 0.18;
    tassetBack.rotation.z = sx * -0.08;
  }
  const backCape = part(rig.torso, 0.52, 1.05, 0.04, TATTER_COL, 0, -0.26, -0.24);
  backCape.rotation.x = 0.14;

  // Correntes penduradas na cintura
  for (let c = 0; c < 4; c++) {
    part(rig.torso, 0.035, 0.07, 0.035, CHAIN_COL, -0.24, -0.38 - c * 0.09, 0.18);
  }

  // Cabeça: crânio em chamas por baixo + elmo pontudo removível por cima
  rig.head = new THREE.Group();
  rig.head.position.set(0, 2.08, 0);
  root.add(rig.head);

  // 1) Cabeça em chamas (revelada na Fase 2)
  const flameHead = new THREE.Group();
  flameHead.visible = false;
  rig.head.add(flameHead);
  rig.flameHead = flameHead;
  part(flameHead, 0.32, 0.36, 0.34, 0x1c1210, 0, 0, 0, { em: 0x3a0a00 });
  part(flameHead, 0.24, 0.14, 0.26, 0x160e0c, 0, -0.14, 0.04);
  // Olhos em brasa
  part(flameHead, 0.08, 0.05, 0.04, 0xffaa20, -0.08, 0.03, 0.17, { basic: true });
  part(flameHead, 0.08, 0.05, 0.04, 0xffaa20, 0.08, 0.03, 0.17, { basic: true });
  // Chamas animadas no crânio
  const flames = [];
  const flameSpecs = [
    [0, 0.24, 0, 0.16, 0.34, 0.16, 0xff4500],
    [-0.10, 0.20, 0.04, 0.12, 0.28, 0.12, 0xff8800],
    [0.10, 0.20, -0.03, 0.12, 0.28, 0.12, 0xff6600],
    [0, 0.22, -0.10, 0.14, 0.30, 0.14, 0xff2200],
    [0, 0.36, 0, 0.09, 0.22, 0.09, 0xffd040]
  ];
  flameSpecs.forEach(([fx, fy, fz, fw, fh, fd, fcol]) => {
    const fm = part(flameHead, fw, fh, fd, fcol, fx, fy, fz, { basic: true });
    fm.userData.basePos = [fx, fy, fz];
    flames.push(fm);
  });
  rig.flames = flames;

  // 2) Elmo pontudo do cavaleiro (Fase 1, removido na transição para Fase 2)
  const helmetGroup = new THREE.Group();
  rig.head.add(helmetGroup);
  rig.helmetGroup = helmetGroup;
  // Crânio do elmo
  part(helmetGroup, 0.36, 0.36, 0.40, ARMOR_MID, 0, 0.02, -0.02);
  // Viseira pontuda (bico) para frente
  const beak = part(helmetGroup, 0.26, 0.14, 0.32, ARMOR_HI, 0, 0.06, 0.16);
  beak.rotation.x = 0.22;
  // Fenda ocular vermelha brilhante
  part(helmetGroup, 0.28, 0.035, 0.05, 0xff1820, 0, 0.01, 0.24, { basic: true });
  // Mandíbula com dentes afiados
  part(helmetGroup, 0.26, 0.12, 0.24, ARMOR_DARK, 0, -0.11, 0.10);
  for (let tx = -0.09; tx <= 0.09; tx += 0.045) {
    part(helmetGroup, 0.022, 0.05, 0.025, 0x9aa2b0, tx, -0.06, 0.22);
  }
  // Crista e penacho longo vermelho-escuro atrás do elmo
  const crest = part(helmetGroup, 0.08, 0.26, 0.34, ARMOR_HI, 0, 0.22, -0.14);
  crest.rotation.x = -0.35;
  const plume1 = part(helmetGroup, 0.12, 0.56, 0.10, PLUME_COL, 0, 0.04, -0.34);
  plume1.rotation.x = 0.42;
  const plume2 = part(helmetGroup, 0.08, 0.52, 0.06, 0x340c12, 0, -0.36, -0.52);
  plume2.rotation.x = 0.55;
  rig.plume = plume1;

  // Braços articulados com ombreiras pontudas (spiked pauldrons), manoplas com garras e correntes
  const mkArm = (side) => {
    const a = limb(root, 0.24, 0.45, 0.24, ARMOR_DARK, side * 0.44, 1.84, 0);
    // Ombreira angular pontuda estilo cavaleiro sombrio
    const pauldron = part(a, 0.38, 0.22, 0.38, ARMOR_MID, side * 0.06, -0.02, 0);
    pauldron.rotation.z = side * -0.26;
    const spike = part(a, 0.22, 0.10, 0.24, ARMOR_HI, side * 0.24, 0.08, 0);
    spike.rotation.z = side * -0.45;
    // Junta do cotovelo -> braçadeira pontuda + manopla com garras + corrente
    const fore = limb(a, 0.22, 0.46, 0.22, ARMOR_DARK, 0, -0.42, 0);
    a.userData.subMesh = fore.userData.mesh;
    part(fore, 0.26, 0.38, 0.26, ARMOR_MID, 0, -0.10, 0);
    const elbowSpike = part(fore, 0.08, 0.22, 0.10, ARMOR_HI, side * 0.12, 0, -0.12);
    elbowSpike.rotation.x = -0.45;
    // Manopla com garras
    part(fore, 0.22, 0.18, 0.22, ARMOR_HI, 0, -0.36, 0.02);
    // Correntes penduradas no pulso
    part(fore, 0.03, 0.22, 0.03, CHAIN_COL, side * 0.12, -0.40, 0.04);
    return { arm: a, forearm: fore };
  };
  const armLObj = mkArm(-1), armRObj = mkArm(1);
  rig.armL = armLObj.arm; rig.forearmL = armLObj.forearm;
  rig.armR = armRObj.arm; rig.forearmR = armRObj.forearm;

  // Espada Flamberge detalhada na mão direita
  const swordObj = buildMaximusSword();
  swordObj.root.position.set(0, -0.44, 0.08);
  swordObj.root.rotation.x = Math.PI * 0.48;
  rig.forearmR.add(swordObj.root);
  rig.sword = swordObj.root;
  rig.swordGlowMats = swordObj.glowMats;

  // Prop do rosário na mão esquerda (visível apenas na cutscene de morte ao entregar para Nivaldo)
  const rosaryProp = buildRosary(0.88, { hanging: true });
  rosaryProp.root.position.set(0, -0.44, 0.14);
  rosaryProp.root.visible = false;
  rig.forearmL.add(rosaryProp.root);
  rig.rosaryProp = rosaryProp.root;

  return rig;
}

BUILD.maximus = buildMaximus;
