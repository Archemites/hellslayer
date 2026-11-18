'use strict';

function getGargulaWingGeo(side) {
  const k = 'gargWing_' + side;
  if (_geo[k]) return _geo[k];
  const s = new THREE.Shape();
  // Silhueta ampla e rasgada de asa de gárgula (vértice superior alto, 4 pontas recortadas)
  const pts = [
    [0.00,  0.04],
    [0.48,  0.42],
    [0.98,  0.76], // ápice / pulso alto acima da cabeça
    [1.46,  0.44],
    [1.88,  0.02], // ponta externa superior
    [1.82, -0.88], // ponta 1 (mais externa)
    [1.52, -0.44],
    [1.30, -0.96], // ponta 2
    [1.04, -0.48],
    [0.82, -0.88], // ponta 3
    [0.58, -0.44],
    [0.40, -0.74], // ponta 4 (interna)
    [0.18, -0.40],
    [0.02, -0.30]
  ];
  s.moveTo(pts[0][0] * side, pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    s.lineTo(pts[i][0] * side, pts[i][1]);
  }
  s.closePath();

  // Pequenos rasgos/furos de desgaste na membrana de pedra
  const hole1 = new THREE.Path();
  hole1.moveTo(1.20 * side, -0.18);
  hole1.lineTo(1.30 * side, -0.14);
  hole1.lineTo(1.26 * side, -0.28);
  hole1.closePath();
  s.holes.push(hole1);

  const hole2 = new THREE.Path();
  hole2.moveTo(0.72 * side, -0.14);
  hole2.lineTo(0.80 * side, -0.10);
  hole2.lineTo(0.77 * side, -0.22);
  hole2.closePath();
  s.holes.push(hole2);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.024,
    bevelEnabled: false,
    curveSegments: 1
  });
  geo.translate(0, 0, -0.012);
  geo.computeBoundingBox();
  return (_geo[k] = geo);
}

function getGargConeGeo(k, rTop, rBot, h, segs) {
  return _geo[k] || (_geo[k] = new THREE.CylinderGeometry(rTop, rBot, h, segs || 6));
}

function buildGargula() {
  const root = new THREE.Group();
  const rig = { root, h: 2.0 };

  // Paleta de pedra antiga desgastada / rachada (fiel à imagem de referência)
  const C_STONE   = 0x6b5d4d;
  const C_HI      = 0x857561;
  const C_SH      = 0x4c4136;
  const C_DEEP    = 0x322a22;
  const C_MEMB    = 0x56493c;
  const C_HORN    = 0x2a231c;
  const C_HORN_HI = 0x3e342a;
  const C_TEETH   = 0xd6cab4;

  const mStone = { em: 0x0e0b08 };
  const mHi    = { em: 0x120f0b };
  const mSh    = { em: 0x090705 };
  const mDeep  = { em: 0x050403 };
  const mMemb  = { em: 0x0b0907 };
  const mHorn  = { em: 0x050403 };
  const mTeeth = { em: 0x1c1812 };

  const boneMat = MT(C_SH, mSh);
  const hornMat = MT(C_HORN, mHorn);
  const teethMat = MT(C_TEETH, mTeeth);

  const addWingBone = (parent, x0, y0, x1, y1, rTop, rBot, mat, key) => {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const geo = getGargConeGeo(key, rTop, rBot, len, 5);
    const m = new THREE.Mesh(geo, mat);
    m.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, 0);
    m.rotation.z = Math.atan2(dy, dx) - Math.PI * 0.5;
    parent.add(m);
    return m;
  };

  // --- TORSO MUSCULOSO EM V (pedra esculpida) ---
  rig.torso = part(root, 0.58, 0.72, 0.32, C_STONE, 0, 1.24, 0, mStone);
  // Peitoral largo e dividido
  const pecL = part(rig.torso, 0.28, 0.20, 0.11, C_HI, -0.15, 0.18, 0.13, mHi);
  const pecR = part(rig.torso, 0.28, 0.20, 0.11, C_HI,  0.15, 0.18, 0.13, mHi);
  pecL.rotation.y =  0.12;
  pecR.rotation.y = -0.12;
  // Trapézio / clavículas largas
  part(rig.torso, 0.72, 0.13, 0.30, C_HI, 0, 0.29, -0.01, mHi);
  // Costelas / serráteis laterais
  part(rig.torso, 0.08, 0.18, 0.22, C_SH, -0.29, 0.04, 0.02, mSh);
  part(rig.torso, 0.08, 0.18, 0.22, C_SH,  0.29, 0.04, 0.02, mSh);
  // Abdômen em gomos (6-pack) + sulco central
  part(rig.torso, 0.03, 0.28, 0.03, C_DEEP, 0, -0.07, 0.155, mDeep);
  for (let ai = 0; ai < 3; ai++) {
    const ay = 0.02 - ai * 0.095;
    part(rig.torso, 0.12, 0.075, 0.055, C_HI, -0.075, ay, 0.15, mHi);
    part(rig.torso, 0.12, 0.075, 0.055, C_HI,  0.075, ay, 0.15, mHi);
  }
  // Cintura fina e pelve angulosa
  part(rig.torso, 0.42, 0.16, 0.26, C_SH, 0, -0.28, 0, mSh);
  part(rig.torso, 0.22, 0.13, 0.22, C_STONE, 0, -0.35, 0.04, mStone);
  // Espinha dorsal com placas rochosas
  for (let si = 0; si < 5; si++) {
    part(rig.torso, 0.08, 0.08, 0.08, C_SH, 0, 0.24 - si * 0.11, -0.17, mSh);
  }
  // Pescoço grosso e musculoso
  part(rig.torso, 0.22, 0.18, 0.22, C_SH, 0, 0.40, 0.02, mSh);
  part(rig.torso, 0.06, 0.16, 0.06, C_HI, -0.08, 0.39, 0.09, mHi);
  part(rig.torso, 0.06, 0.16, 0.06, C_HI,  0.08, 0.39, 0.09, mHi);

  // --- CAUDA DE PEDRA PENDURADA ENTRE AS PERNAS ---
  const tail1 = part(rig.torso, 0.11, 0.34, 0.11, C_SH, 0, -0.46, -0.14, mSh);
  tail1.rotation.x = 0.12;
  const tail2 = part(rig.torso, 0.08, 0.30, 0.08, C_STONE, 0, -0.74, -0.18, mStone);
  tail2.rotation.x = 0.05;
  const tailTip = new THREE.Mesh(getGargConeGeo('gTailTip', 0.004, 0.055, 0.22, 5), boneMat);
  tailTip.position.set(0, -0.98, -0.19);
  tailTip.rotation.x = Math.PI;
  rig.torso.add(tailTip);

  // --- CABEÇA BESTIAL DE GÁRGULA ---
  rig.head = part(root, 0.32, 0.34, 0.32, C_STONE, 0, 1.78, 0.03, mStone);
  // Arcada supraciliar pesada e franzida
  const browL = part(rig.head, 0.15, 0.065, 0.10, C_HI, -0.075, 0.085, 0.14, mHi);
  const browR = part(rig.head, 0.15, 0.065, 0.10, C_HI,  0.075, 0.085, 0.14, mHi);
  browL.rotation.z = -0.28;
  browR.rotation.z =  0.28;
  // Órbitas fundas e olhos âmbar brilhantes
  part(rig.head, 0.08, 0.05, 0.03, C_DEEP, -0.075, 0.04, 0.155, mDeep);
  part(rig.head, 0.08, 0.05, 0.03, C_DEEP,  0.075, 0.04, 0.155, mDeep);
  part(rig.head, 0.055, 0.028, 0.02, 0xff7722, -0.075, 0.04, 0.168, { basic: true });
  part(rig.head, 0.055, 0.028, 0.02, 0xff7722,  0.075, 0.04, 0.168, { basic: true });
  part(rig.head, 0.02, 0.018, 0.022, 0xffdd66, -0.075, 0.04, 0.171, { basic: true });
  part(rig.head, 0.02, 0.018, 0.022, 0xffdd66,  0.075, 0.04, 0.171, { basic: true });
  // Maçãs do rosto e focinho achatado
  part(rig.head, 0.36, 0.075, 0.16, C_HI, 0, 0.0, 0.09, mHi);
  part(rig.head, 0.09, 0.09, 0.08, C_HI, 0, 0.02, 0.16, mHi);
  // Boca aberta rugindo e mandíbula pesada
  part(rig.head, 0.18, 0.11, 0.05, 0x160c08, 0, -0.085, 0.148, { basic: true });
  part(rig.head, 0.22, 0.065, 0.18, C_SH, 0, -0.155, 0.05, mSh);
  part(rig.head, 0.11, 0.055, 0.05, C_HI, 0, -0.16, 0.145, mHi);
  // Presas caninas grandes + dentes menores
  for (const side of [-1, 1]) {
    const fUp = new THREE.Mesh(getGargConeGeo('gFangUp', 0.002, 0.016, 0.055, 4), teethMat);
    fUp.position.set(side * 0.062, -0.055, 0.168);
    fUp.rotation.x = Math.PI;
    rig.head.add(fUp);
    const fDn = new THREE.Mesh(getGargConeGeo('gFangDn', 0.002, 0.014, 0.048, 4), teethMat);
    fDn.position.set(side * 0.055, -0.118, 0.166);
    rig.head.add(fDn);
  }
  for (let ti = -1; ti <= 1; ti++) {
    part(rig.head, 0.016, 0.024, 0.016, C_TEETH, ti * 0.026, -0.045, 0.168, mTeeth);
    part(rig.head, 0.015, 0.022, 0.015, C_TEETH, ti * 0.024, -0.122, 0.166, mTeeth);
  }
  // Orelhas grandes pontudas (abertas para os lados como na imagem)
  for (const side of [-1, 1]) {
    const earBase = part(rig.head, 0.16, 0.08, 0.05, C_STONE, side * 0.22, 0.04, -0.01, mStone);
    earBase.rotation.z = side * 0.18;
    earBase.rotation.y = -side * 0.25;
    const earTip = new THREE.Mesh(getGargConeGeo('gEarTip', 0.003, 0.042, 0.18, 4), MT(C_SH, mSh));
    earTip.position.set(side * 0.34, 0.08, -0.04);
    earTip.rotation.z = -side * 1.25;
    earTip.rotation.y = -side * 0.28;
    rig.head.add(earTip);
  }
  // Chifres grossos curvados e segmentados (estilo carneiro/gárgula)
  for (const side of [-1, 1]) {
    const h1 = new THREE.Mesh(getGargConeGeo('gh1', 0.042, 0.056, 0.14, 6), hornMat);
    h1.position.set(side * 0.10, 0.19, 0.02);
    h1.rotation.z = -side * 0.62;
    h1.rotation.x = -0.15;
    rig.head.add(h1);

    const h2 = new THREE.Mesh(getGargConeGeo('gh2', 0.028, 0.042, 0.15, 6), MT(C_HORN_HI, mHorn));
    h2.position.set(side * 0.19, 0.27, -0.04);
    h2.rotation.z = -side * 1.05;
    h2.rotation.x = -0.42;
    rig.head.add(h2);

    const h3 = new THREE.Mesh(getGargConeGeo('gh3', 0.005, 0.028, 0.14, 6), hornMat);
    h3.position.set(side * 0.23, 0.25, -0.14);
    h3.rotation.z = -side * 0.35;
    h3.rotation.x = -0.95;
    rig.head.add(h3);
  }

  // --- ASAS DE PEDRA ENORMES E RASGADAS ---
  const wingMat = MT(C_MEMB, mMemb);
  for (const side of [-1, 1]) {
    const wg = new THREE.Group();
    wg.position.set(side * 0.16, 1.48, -0.15);

    // children[0] = Membrana principal (usada como hitMesh em initEnemyLimbs)
    const mem = new THREE.Mesh(getGargulaWingGeo(side), wingMat);
    wg.add(mem);

    // Armação óssea/rochosa conectando ombro -> ápice -> ponta externa
    addWingBone(wg, 0, 0, side * 0.98, 0.76, 0.036, 0.048, boneMat, 'gwUpper');
    addWingBone(wg, side * 0.98, 0.76, side * 1.88, 0.02, 0.022, 0.036, boneMat, 'gwFore');

    // Garra/esporão curvo no topo do ápice da asa (como na imagem)
    const spur = new THREE.Mesh(getGargConeGeo('gwSpur', 0.004, 0.028, 0.20, 5), hornMat);
    spur.position.set(side * 0.96, 0.87, 0.02);
    spur.rotation.z = side * 0.42;
    spur.rotation.x = 0.25;
    wg.add(spur);

    // 4 falanges irradiando do ápice/antebraço até as pontas inferiores da membrana
    const tipPts = [
      [1.88, 0.02, 1.82, -0.88, 'gwR0'],
      [1.46, 0.44, 1.30, -0.96, 'gwR1'],
      [0.98, 0.76, 0.82, -0.88, 'gwR2'],
      [0.98, 0.76, 0.40, -0.74, 'gwR3']
    ];
    for (const [x0, y0, x1, y1, key] of tipPts) {
      addWingBone(wg, side * x0, y0, side * x1, y1, 0.010, 0.020, boneMat, key);
    }

    root.add(wg);
    if (side < 0) rig.wingL = wg; else rig.wingR = wg;
  }

  // --- BRAÇOS MUSCULOSOS COM GARRAS (compatíveis com armsFwd) ---
  rig.armL = limb(root, 0.17, 0.76, 0.17, C_STONE, -0.44, 1.54, 0, mStone);
  rig.armR = limb(root, 0.17, 0.76, 0.17, C_STONE,  0.44, 1.54, 0, mStone);
  for (const [arm, side] of [[rig.armL, -1], [rig.armR, 1]]) {
    // Deltoide/ombro largo de pedra
    part(arm, 0.24, 0.22, 0.24, C_HI, side * 0.02, -0.06, 0, mHi);
    // Bíceps e antebraço definidos
    part(arm, 0.19, 0.22, 0.19, C_STONE, 0, -0.22, 0.01, mStone);
    part(arm, 0.15, 0.28, 0.16, C_SH, 0, -0.46, 0.02, mSh);
    part(arm, 0.07, 0.24, 0.06, C_HI, side * 0.055, -0.46, 0.04, mHi);
    // Mão larga com 3 garras curvas + polegar
    part(arm, 0.16, 0.11, 0.14, C_STONE, 0, -0.66, 0.03, mStone);
    for (let ci = -1; ci <= 1; ci++) {
      const claw = new THREE.Mesh(getGargConeGeo('gHandClaw', 0.004, 0.018, 0.16, 5), hornMat);
      claw.position.set(ci * 0.046, -0.77, 0.065);
      claw.rotation.x = 0.55;
      arm.add(claw);
    }
    const thumb = new THREE.Mesh(getGargConeGeo('gThumbClaw', 0.004, 0.016, 0.12, 5), hornMat);
    thumb.position.set(-side * 0.08, -0.69, 0.08);
    thumb.rotation.x = 0.65;
    thumb.rotation.z = side * 0.45;
    arm.add(thumb);
  }
  rig.armL.rotation.x = -1.3;
  rig.armR.rotation.x = -1.3;

  // --- PERNAS MUSCULOSAS E PÉS GRANDES COM 3 GARRAS ---
  rig.legL = limb(root, 0.22, 0.88, 0.22, C_STONE, -0.21, 0.88, 0, mStone);
  rig.legR = limb(root, 0.22, 0.88, 0.22, C_STONE,  0.21, 0.88, 0, mStone);
  for (const [leg, side] of [[rig.legL, -1], [rig.legR, 1]]) {
    // Coxa musculosa e sulco lateral
    part(leg, 0.27, 0.34, 0.27, C_HI, 0, -0.17, 0.015, mHi);
    part(leg, 0.08, 0.28, 0.18, C_STONE, side * 0.12, -0.17, 0, mStone);
    // Joelho esculpido
    part(leg, 0.20, 0.13, 0.22, C_HI, 0, -0.39, 0.035, mHi);
    // Panturrilha forte + crista da canela
    part(leg, 0.17, 0.34, 0.18, C_SH, 0, -0.62, -0.01, mSh);
    part(leg, 0.21, 0.20, 0.13, C_STONE, 0, -0.54, -0.075, mStone);
    part(leg, 0.09, 0.26, 0.06, C_HI, 0, -0.62, 0.08, mHi);
    // Pé largo de gárgula com 3 dedos e garras pesadas
    part(leg, 0.27, 0.09, 0.28, C_STONE, 0, -0.835, 0.07, mStone);
    part(leg, 0.10, 0.08, 0.12, C_SH, 0, -0.835, -0.11, mSh);
    for (let fi = -1; fi <= 1; fi++) {
      const toe = part(leg, 0.07, 0.065, 0.13, C_HI, fi * 0.085, -0.845, 0.22, mHi);
      toe.rotation.y = -fi * 0.16;
      const fClaw = new THREE.Mesh(getGargConeGeo('gFootClaw', 0.005, 0.025, 0.17, 5), hornMat);
      fClaw.position.set(fi * 0.10, -0.855, 0.33);
      fClaw.rotation.x = Math.PI * 0.54;
      fClaw.rotation.z = fi * 0.16;
      leg.add(fClaw);
    }
  }

  return rig;
}

BUILD.gargula = buildGargula;
