'use strict';

function getDiabreteWingGeo(side) {
  const k = 'diabWing_' + side;
  if (_geo[k]) return _geo[k];
  const s = new THREE.Shape();
  // Silhueta de asa de morcego estendida para +X (side > 0) ou -X (side < 0)
  // Pivô (0, 0) no encaixe dorsal; borda superior sobe até o "pulso" e desce até a ponta externa;
  // borda inferior tem 4 pontas recortadas entre os dedos da asa.
  const pts = [
    [0.00,  0.04],
    [0.36,  0.18],
    [0.74,  0.22],
    [1.16,  0.10],
    [1.18, -0.58],
    [0.98, -0.34],
    [0.84, -0.66],
    [0.64, -0.40],
    [0.48, -0.64],
    [0.28, -0.38],
    [0.14, -0.50],
    [0.02, -0.24]
  ];
  s.moveTo(pts[0][0] * side, pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    s.lineTo(pts[i][0] * side, pts[i][1]);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.018,
    bevelEnabled: false,
    curveSegments: 1
  });
  geo.translate(0, 0, -0.009);
  geo.computeBoundingBox();
  return (_geo[k] = geo);
}

function getDiabreteConeGeo(k, rTop, rBot, h, segs) {
  return _geo[k] || (_geo[k] = new THREE.CylinderGeometry(rTop, rBot, h, segs || 6));
}

function buildDiabrete() {
  const root = new THREE.Group();
  const rig = { root, h: 1.55 };

  // Paleta vermelho bem saturado
  const mSkin   = { em: 0x380205 };
  const mMuscle = { em: 0x450408 };
  const mDark   = { em: 0x200103 };
  const mWing   = { em: 0x330206 };
  const mHorn   = { em: 0x080102 };
  const mTeeth  = { em: 0x221c14 };

  const C_SKIN   = 0xe6121a;
  const C_MUSCLE = 0xff1c24;
  const C_DARK   = 0x99060c;
  const C_WING   = 0xc40814;
  const C_HORN   = 0x1a0406;
  const C_TEETH  = 0xf0e6d2;

  // --- TORSO (esguio, tórax em V, cintura fina, pelve estreita) ---
  rig.torso = part(root, 0.34, 0.48, 0.22, C_SKIN, 0, 0.88, 0, mSkin);
  // Peitoral musculoso dividido
  part(rig.torso, 0.16, 0.16, 0.08, C_MUSCLE, -0.09, 0.12, 0.10, mMuscle);
  part(rig.torso, 0.16, 0.16, 0.08, C_MUSCLE,  0.09, 0.12, 0.10, mMuscle);
  // Clavículas / trapézio superior
  part(rig.torso, 0.42, 0.08, 0.20, C_MUSCLE, 0, 0.20, 0.01, mMuscle);
  // Abdômen fino e gomos
  part(rig.torso, 0.22, 0.18, 0.18, C_DARK, 0, -0.08, 0.01, mDark);
  part(rig.torso, 0.16, 0.06, 0.04, C_MUSCLE, 0, -0.02, 0.10, mMuscle);
  part(rig.torso, 0.14, 0.06, 0.04, C_MUSCLE, 0, -0.10, 0.09, mMuscle);
  // Pelve estreita
  part(rig.torso, 0.26, 0.12, 0.20, C_SKIN, 0, -0.22, 0, mSkin);
  // Pescoço musculoso
  part(rig.torso, 0.13, 0.12, 0.13, C_DARK, 0, 0.27, 0.01, mDark);

  // --- CABEÇA DIABÓLICA ---
  rig.head = part(root, 0.24, 0.28, 0.26, C_SKIN, 0, 1.25, 0.03, mSkin);
  // Arcada supraciliar franzida e maçãs do rosto
  const browL = part(rig.head, 0.12, 0.05, 0.07, C_MUSCLE, -0.06, 0.06, 0.12, mMuscle);
  const browR = part(rig.head, 0.12, 0.05, 0.07, C_MUSCLE,  0.06, 0.06, 0.12, mMuscle);
  browL.rotation.z = -0.22; browR.rotation.z = 0.22;
  part(rig.head, 0.26, 0.06, 0.12, C_MUSCLE, 0, 0.01, 0.08, mMuscle);
  // Olhos vermelhos/laranja incandescentes
  part(rig.head, 0.06, 0.035, 0.02, 0xff2a00, -0.065, 0.03, 0.135, { basic: true });
  part(rig.head, 0.06, 0.035, 0.02, 0xff2a00,  0.065, 0.03, 0.135, { basic: true });
  part(rig.head, 0.025, 0.02, 0.022, 0xffcc22, -0.065, 0.03, 0.138, { basic: true });
  part(rig.head, 0.025, 0.02, 0.022, 0xffcc22,  0.065, 0.03, 0.138, { basic: true });
  // Boca aberta esganiçada e mandíbula com presas
  part(rig.head, 0.16, 0.08, 0.04, 0x160002, 0, -0.065, 0.125, { basic: true });
  part(rig.head, 0.18, 0.05, 0.16, C_DARK, 0, -0.12, 0.04, mDark);
  for (let ti = -2; ti <= 2; ti++) {
    const tx = ti * 0.03;
    part(rig.head, 0.016, 0.032, 0.016, C_TEETH, tx, -0.04, 0.142, mTeeth);
    part(rig.head, 0.016, 0.028, 0.016, C_TEETH, tx, -0.09, 0.142, mTeeth);
  }
  // Orelhas pontudas de morcego
  const earL = part(rig.head, 0.16, 0.05, 0.04, C_SKIN, -0.17, 0.04, -0.01, mSkin);
  const earR = part(rig.head, 0.16, 0.05, 0.04, C_SKIN,  0.17, 0.04, -0.01, mSkin);
  earL.rotation.z = -0.35; earL.rotation.y = 0.25;
  earR.rotation.z =  0.35; earR.rotation.y = -0.25;
  // Chifres grandes curvados em lira (3 segmentos por chifre)
  const hornMat = MT(C_HORN, mHorn);
  for (const side of [-1, 1]) {
    const h1 = new THREE.Mesh(getDiabreteConeGeo('dh1', 0.034, 0.048, 0.14, 6), hornMat);
    h1.position.set(side * 0.09, 0.17, -0.01);
    h1.rotation.z = -side * 0.55;
    rig.head.add(h1);

    const h2 = new THREE.Mesh(getDiabreteConeGeo('dh2', 0.022, 0.034, 0.15, 6), hornMat);
    h2.position.set(side * 0.16, 0.27, -0.01);
    h2.rotation.z = -side * 0.10;
    h2.rotation.x = 0.18;
    rig.head.add(h2);

    const h3 = new THREE.Mesh(getDiabreteConeGeo('dh3', 0.004, 0.022, 0.14, 6), hornMat);
    h3.position.set(side * 0.14, 0.39, 0.02);
    h3.rotation.z = side * 0.38;
    h3.rotation.x = 0.32;
    rig.head.add(h3);
  }

  // --- ASAS DE MORCEGO GRANDES E RASGADAS ---
  const wingMat = MT(C_WING, mWing);
  const boneMat = MT(C_DARK, mDark);
  const clawMat = MT(C_HORN, mHorn);

  for (const side of [-1, 1]) {
    const wg = new THREE.Group();
    wg.position.set(side * 0.14, 1.06, -0.10);

    // children[0] = Membrana principal (usada como hitMesh em initEnemyLimbs)
    const mem = new THREE.Mesh(getDiabreteWingGeo(side), wingMat);
    wg.add(mem);

    // Osso superior do braço da asa (ombro -> cotovelo/pulso -> ponta)
    const uBone = new THREE.Mesh(getDiabreteConeGeo('dwU', 0.026, 0.034, 0.78, 5), boneMat);
    uBone.position.set(side * 0.37, 0.13, 0);
    uBone.rotation.z = -side * 1.33;
    wg.add(uBone);

    const fBone = new THREE.Mesh(getDiabreteConeGeo('dwF', 0.016, 0.026, 0.46, 5), boneMat);
    fBone.position.set(side * 0.95, 0.16, 0);
    fBone.rotation.z = -side * 1.85;
    wg.add(fBone);

    // Esporão/garra no topo da dobra da asa
    const spur = new THREE.Mesh(getDiabreteConeGeo('dwSpur', 0.003, 0.018, 0.13, 5), clawMat);
    spur.position.set(side * 0.74, 0.27, 0.02);
    spur.rotation.z = -side * 0.35;
    spur.rotation.x = 0.3;
    wg.add(spur);

    // 4 falanges/dedos irradiando do pulso até as pontas inferiores da membrana
    const ribs = [
      [1.16, -0.24, 0.05, 0.68],
      [0.80, -0.22, 0.18, 0.88],
      [0.61, -0.21, -0.28, 0.88],
      [0.44, -0.14, -0.62, 0.80]
    ];
    for (let ri = 0; ri < ribs.length; ri++) {
      const [rx, ry, rz, len] = ribs[ri];
      const rib = new THREE.Mesh(getDiabreteConeGeo('dwR' + ri, 0.008, 0.015, len, 5), boneMat);
      rib.position.set(side * rx, ry, 0);
      rib.rotation.z = side * rz;
      wg.add(rib);
    }

    root.add(wg);
    if (side < 0) rig.wingL = wg; else rig.wingR = wg;
  }

  // --- BRAÇOS COM GARRAS LONGAS ---
  rig.armL = limb(root, 0.10, 0.46, 0.10, C_SKIN, -0.24, 1.07, 0, mSkin);
  rig.armR = limb(root, 0.10, 0.46, 0.10, C_SKIN,  0.24, 1.07, 0, mSkin);
  for (const [arm, side] of [[rig.armL, -1], [rig.armR, 1]]) {
    // Ombro/bíceps musculoso
    part(arm, 0.13, 0.14, 0.13, C_MUSCLE, side * 0.01, -0.06, 0, mMuscle);
    // Antebraço mais fino
    part(arm, 0.08, 0.20, 0.08, C_DARK, 0, -0.34, 0.02, mDark);
    // 3 garras longas na mão
    for (let ci = -1; ci <= 1; ci++) {
      const claw = new THREE.Mesh(getDiabreteConeGeo('dClawH', 0.003, 0.013, 0.13, 5), clawMat);
      claw.position.set(ci * 0.028, -0.49, 0.05);
      claw.rotation.x = 0.55;
      arm.add(claw);
    }
  }

  // --- PERNAS MUSCULOSAS, JOELHOS MARCADOS E PÉS COM GARRAS ---
  rig.legL = limb(root, 0.12, 0.56, 0.12, C_SKIN, -0.11, 0.62, 0, mSkin);
  rig.legR = limb(root, 0.12, 0.56, 0.12, C_SKIN,  0.11, 0.62, 0, mSkin);
  for (const leg of [rig.legL, rig.legR]) {
    // Coxa musculosa
    part(leg, 0.15, 0.24, 0.15, C_MUSCLE, 0, -0.12, 0.01, mMuscle);
    // Joelho protuberante
    part(leg, 0.13, 0.10, 0.14, C_MUSCLE, 0, -0.26, 0.03, mMuscle);
    // Canela fina e alongada
    part(leg, 0.09, 0.26, 0.09, C_DARK, 0, -0.42, -0.01, mDark);
    // Pé grande com 3 garras voltadas para a frente
    part(leg, 0.13, 0.06, 0.18, C_SKIN, 0, -0.55, 0.05, mSkin);
    for (let fi = -1; fi <= 1; fi++) {
      const fClaw = new THREE.Mesh(getDiabreteConeGeo('dClawF', 0.004, 0.016, 0.12, 5), clawMat);
      fClaw.position.set(fi * 0.04, -0.56, 0.17);
      fClaw.rotation.x = Math.PI * 0.52;
      leg.add(fClaw);
    }
  }

  // --- CAUDA LONGA COM PONTA EM SETA ---
  const tail1 = part(rig.torso, 0.045, 0.34, 0.045, C_DARK, 0, -0.34, -0.12, mDark);
  tail1.rotation.x = -0.22;
  const tail2 = part(rig.torso, 0.035, 0.32, 0.035, C_SKIN, 0, -0.62, -0.17, mSkin);
  tail2.rotation.x = -0.05;
  const tailTip = new THREE.Mesh(getDiabreteConeGeo('dTailTip', 0.002, 0.055, 0.14, 4), MT(C_MUSCLE, mMuscle));
  tailTip.position.set(0, -0.82, -0.17);
  tailTip.rotation.x = Math.PI;
  tailTip.scale.set(1.2, 1, 0.45);
  rig.torso.add(tailTip);

  return rig;
}

BUILD.diabrete = buildDiabrete;
