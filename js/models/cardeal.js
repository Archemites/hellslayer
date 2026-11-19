'use strict';

/* ============================================================
   HELLSLAYER — Modelo 3D: Super-Cardeal (Conselho dos 12)
   Inspirado na referência visual: batina longa carmesim com
   botões frontais, mozetta com cruzes douradas nos ombros,
   estola bordada com franjas douradas, colar com crucifixo,
   punhos brancos, solidéu vermelho e semblante idoso austero.
   ============================================================ */

function buildCardeal(opts) {
  opts = opts || {};
  const root = new THREE.Group();
  const rig = { root, h: 2.48 };

  const isLeader = !!opts.leader;

  // Paleta carmesim cardinalícia + ouro envelhecido + pele idosa
  const C_CRIMSON      = isLeader ? 0x99151b : 0x861318;
  const C_CRIMSON_HI   = isLeader ? 0xb31e24 : 0x9e1a20;
  const C_CRIMSON_DARK = 0x560a0e;
  const C_CRIMSON_DEEP = 0x3b0609;
  const C_SASH         = 0x6b0c11;
  const C_BUTTON       = 0xb8242a;
  const C_GOLD         = 0xcba142;
  const C_GOLD_HI      = 0xefd276;
  const C_GOLD_DARK    = 0x7e5e1c;
  const C_CUFF         = 0xe8e0d2;
  const C_SKIN         = 0xb4947c;
  const C_SKIN_HI      = 0xc9ab93;
  const C_SKIN_SH      = 0x7d604d;
  const C_SKIN_DEEP    = 0x5c4335;
  const C_HAIR         = opts.hairColor || 0x8c8780;
  const C_SHOE         = 0x151313;

  const mCrimson     = MT(C_CRIMSON);
  const mCrimsonDark = MT(C_CRIMSON_DARK);
  const mCrimsonHi   = MT(C_CRIMSON_HI);

  // --- BATINA PRINCIPAL (túnica longa até os pés) ---
  const robeGeo = _geo['cardealRobe'] || (_geo['cardealRobe'] = new THREE.CylinderGeometry(0.28, 0.56, 1.58, 10));
  const robe = new THREE.Mesh(robeGeo, mCrimson);
  robe.position.y = 0.87;
  root.add(robe);
  rig.torso = robe;

  const garb = new THREE.Group();
  root.add(garb);

  // Pregas verticais da batina (drapeado solene)
  const foldAngles = [0.24, -0.24, 0.72, -0.72, 1.38, -1.38, 2.15, -2.15, 2.82, -2.82];
  for (let i = 0; i < foldAngles.length; i++) {
    const ang = foldAngles[i];
    const r = 0.41;
    const f = part(
      garb,
      0.068,
      1.46,
      0.055,
      i % 2 === 0 ? C_CRIMSON_DARK : C_CRIMSON_HI,
      Math.sin(ang) * r,
      0.86,
      Math.cos(ang) * r
    );
    f.rotation.y = ang;
    f.rotation.x = -0.13 * Math.cos(ang);
    f.rotation.z = 0.13 * Math.sin(ang);
  }

  // Barra inferior levemente mais escura (peso do tecido)
  const hemGeo = _geo['cardealHem'] || (_geo['cardealHem'] = new THREE.CylinderGeometry(0.54, 0.57, 0.10, 10));
  const hem = new THREE.Mesh(hemGeo, mCrimsonDark);
  hem.position.y = 0.12;
  garb.add(hem);

  // Sapatos escuros aparecendo sob a batina
  for (const side of [-1, 1]) {
    part(garb, 0.14, 0.10, 0.24, C_SHOE, side * 0.14, 0.05, 0.10);
    part(garb, 0.13, 0.06, 0.10, 0x242020, side * 0.14, 0.06, 0.21);
  }

  // Fileira vertical central de botões carmesins na frente da batina
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const by = 1.18 - t * 0.98;
    const bz = 0.34 + t * 0.175;
    part(garb, 0.028, 0.028, 0.022, C_BUTTON, 0, by, bz);
  }
  // Faixa de costura central dos botões
  const placket = part(garb, 0.052, 1.06, 0.02, C_CRIMSON_DARK, 0, 0.70, 0.425);
  placket.rotation.x = -0.17;

  // --- FAIXA NA CINTURA (FASCIA) ---
  const sashGeo = _geo['cardealSash'] || (_geo['cardealSash'] = new THREE.CylinderGeometry(0.325, 0.345, 0.18, 10));
  const sash = new THREE.Mesh(sashGeo, MT(C_SASH));
  sash.position.y = 1.28;
  garb.add(sash);
  // Vincos sutis da faixa
  part(garb, 0.52, 0.022, 0.36, C_CRIMSON_DEEP, 0, 1.33, 0.16);
  part(garb, 0.52, 0.022, 0.36, C_CRIMSON_DEEP, 0, 1.23, 0.17);

  // --- TORSO SUPERIOR + MOZETTA (CAPA DE OMBROS) ---
  const upperGeo = _geo['cardealUpper'] || (_geo['cardealUpper'] = new THREE.CylinderGeometry(0.24, 0.32, 0.44, 10));
  const upper = new THREE.Mesh(upperGeo, mCrimson);
  upper.position.y = 1.56;
  garb.add(upper);

  // Mozetta ampla sobre os ombros e peito superior
  const mozGeo = _geo['cardealMoz'] || (_geo['cardealMoz'] = new THREE.CylinderGeometry(0.23, 0.58, 0.46, 12));
  const moz = new THREE.Mesh(mozGeo, mCrimsonHi);
  moz.position.y = 1.60;
  moz.scale.set(1.18, 1.0, 0.82);
  garb.add(moz);

  // Borda dourada na bainha da mozetta
  const mozRimGeo = _geo['cardealMozRim'] || (_geo['cardealMozRim'] = new THREE.CylinderGeometry(0.575, 0.59, 0.032, 12));
  const mozRim = new THREE.Mesh(mozRimGeo, MT(C_GOLD, { em: 0x241800 }));
  mozRim.position.y = 1.38;
  mozRim.scale.set(1.18, 1.0, 0.82);
  garb.add(mozRim);

  // Dois medalhões circulares com cruzes douradas bordadas na frente da mozetta (como na foto)
  for (const side of [-1, 1]) {
    const mx = side * 0.29;
    const my = 1.52;
    const mz = 0.35;
    const med = new THREE.Group();
    med.position.set(mx, my, mz);
    med.rotation.y = side * 0.34;
    med.rotation.x = -0.30;
    garb.add(med);

    // Aro circular dourado
    const ringGeo = _geo['cardealMedRing'] || (_geo['cardealMedRing'] = new THREE.TorusGeometry(0.085, 0.011, 5, 12));
    const ring = new THREE.Mesh(ringGeo, MT(C_GOLD, { em: 0x241800 }));
    med.add(ring);
    // Cruz bordada dentro do medalhão
    part(med, 0.022, 0.14, 0.014, C_GOLD_HI, 0, 0, 0.004, { em: 0x2a1c00 });
    part(med, 0.14, 0.022, 0.014, C_GOLD_HI, 0, 0, 0.004, { em: 0x2a1c00 });
  }

  // --- ESTOLA LONGA VERMELHA E DOURADA (DOIS PAINÉIS FRONTAIS COM FRANJAS) ---
  for (const side of [-1, 1]) {
    const sx = side * 0.145;
    const stole = new THREE.Group();
    stole.position.set(sx, 0.90, 0.385);
    stole.rotation.x = -0.155;
    stole.rotation.z = -side * 0.02;
    garb.add(stole);

    // Painel vermelho da estola
    part(stole, 0.135, 0.96, 0.026, C_CRIMSON_DARK, 0, 0, 0);
    // Bordas douradas laterais
    part(stole, 0.018, 0.96, 0.032, C_GOLD, -0.062, 0, 0.004, { em: 0x221600 });
    part(stole, 0.018, 0.96, 0.032, C_GOLD, 0.062, 0, 0.004, { em: 0x221600 });
    // Arabescos/cruzes douradas ao longo da estola
    for (let ci = 0; ci < 3; ci++) {
      const cy = 0.28 - ci * 0.28;
      part(stole, 0.018, 0.10, 0.034, C_GOLD_HI, 0, cy, 0.006, { em: 0x261a00 });
      part(stole, 0.075, 0.018, 0.034, C_GOLD_HI, 0, cy + 0.01, 0.006, { em: 0x261a00 });
    }
    // Barra e franjas douradas na ponta inferior da estola
    part(stole, 0.142, 0.028, 0.034, C_GOLD, 0, -0.475, 0.004, { em: 0x221600 });
    for (let fi = -2; fi <= 2; fi++) {
      part(stole, 0.015, 0.07, 0.022, C_GOLD_HI, fi * 0.026, -0.52, 0.004, { em: 0x201500 });
    }
  }

  // --- GOLA CLERICAL + CORRENTE DOURADA + CRUCIFIXO PEITORAL ---
  part(garb, 0.24, 0.09, 0.24, C_CRIMSON_DARK, 0, 1.84, 0);
  part(garb, 0.19, 0.035, 0.22, C_CUFF, 0, 1.87, 0.015); // colarinho branco discreto
  part(garb, 0.14, 0.14, 0.14, C_SKIN_SH, 0, 1.92, 0.01);

  // Corrente dourada em V sobre a mozetta
  const chL = part(garb, 0.020, 0.34, 0.020, C_GOLD_HI, -0.075, 1.69, 0.28, { em: 0x352500 });
  chL.rotation.z = 0.38;
  chL.rotation.x = -0.34;
  const chR = part(garb, 0.020, 0.34, 0.020, C_GOLD_HI, 0.075, 1.69, 0.28, { em: 0x352500 });
  chR.rotation.z = -0.38;
  chR.rotation.x = -0.34;

  // Crucifixo dourado grande no centro do peito
  const crossG = new THREE.Group();
  crossG.position.set(0, 1.49, 0.365);
  crossG.rotation.x = -0.22;
  garb.add(crossG);
  part(crossG, 0.034, 0.22, 0.026, C_GOLD_HI, 0, 0, 0, { em: 0x453000 });
  part(crossG, 0.145, 0.032, 0.026, C_GOLD_HI, 0, 0.042, 0, { em: 0x453000 });
  part(crossG, 0.016, 0.17, 0.032, C_GOLD_DARK, 0, 0, 0.004);
  part(crossG, 0.105, 0.016, 0.032, C_GOLD_DARK, 0, 0.042, 0.004);

  // --- CABEÇA (ROSTO IDOSO AUSTERO + SOLIDÉU VERMELHO) ---
  const head = new THREE.Group();
  head.position.set(0, 1.97, 0.02);
  root.add(head);
  rig.head = head;

  // Crânio / rosto base alongado
  part(head, 0.27, 0.34, 0.28, C_SKIN, 0, 0.17, 0);
  // Testa marcada e maçãs do rosto salientes
  part(head, 0.25, 0.10, 0.04, C_SKIN_HI, 0, 0.26, 0.135);
  part(head, 0.08, 0.07, 0.05, C_SKIN_HI, -0.09, 0.14, 0.132);
  part(head, 0.08, 0.07, 0.05, C_SKIN_HI, 0.09, 0.14, 0.132);
  // Covas das bochechas (aspecto idoso/severo)
  part(head, 0.06, 0.09, 0.03, C_SKIN_SH, -0.085, 0.08, 0.132);
  part(head, 0.06, 0.09, 0.03, C_SKIN_SH, 0.085, 0.08, 0.132);
  // Queixo firme
  part(head, 0.14, 0.07, 0.06, C_SKIN_SH, 0, 0.01, 0.12);
  // Orelhas
  part(head, 0.045, 0.10, 0.055, C_SKIN_SH, -0.15, 0.16, -0.01);
  part(head, 0.045, 0.10, 0.055, C_SKIN_SH, 0.15, 0.16, -0.01);

  // Olheiras fundas, olhos severos e sobrancelhas grisalhas franzidas
  part(head, 0.075, 0.048, 0.035, C_SKIN_DEEP, -0.062, 0.195, 0.134);
  part(head, 0.075, 0.048, 0.035, C_SKIN_DEEP, 0.062, 0.195, 0.134);
  part(head, 0.042, 0.022, 0.022, 0xd8d2c8, -0.062, 0.197, 0.146);
  part(head, 0.042, 0.022, 0.022, 0xd8d2c8, 0.062, 0.197, 0.146);
  part(head, 0.020, 0.020, 0.026, 0x1a1412, -0.062, 0.197, 0.150);
  part(head, 0.020, 0.020, 0.026, 0x1a1412, 0.062, 0.197, 0.150);

  const browL = part(head, 0.088, 0.024, 0.034, C_HAIR, -0.065, 0.228, 0.145);
  browL.rotation.z = -0.16;
  const browR = part(head, 0.088, 0.024, 0.034, C_HAIR, 0.065, 0.228, 0.145);
  browR.rotation.z = 0.16;

  // Nariz pronunciado
  part(head, 0.048, 0.095, 0.072, C_SKIN_HI, 0, 0.155, 0.155);
  part(head, 0.056, 0.032, 0.052, C_SKIN_SH, 0, 0.112, 0.162);

  // Boca séria fechada + sulcos nasolabiais
  part(head, 0.10, 0.018, 0.026, C_SKIN_DEEP, 0, 0.065, 0.142);

  // Cabelos grisalhos curtos nas têmporas e nuca
  part(head, 0.035, 0.12, 0.20, C_HAIR, -0.142, 0.22, -0.02);
  part(head, 0.035, 0.12, 0.20, C_HAIR, 0.142, 0.22, -0.02);
  part(head, 0.27, 0.16, 0.05, C_HAIR, 0, 0.21, -0.138);

  // SOLIDÉU (ZUCCHETTO) VERMELHO CARMESIM no topo da cabeça
  const zuccGeo = _geo['cardealZucc'] || (_geo['cardealZucc'] = new THREE.SphereGeometry(0.155, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.48));
  const zucc = new THREE.Mesh(zuccGeo, mCrimsonHi);
  zucc.position.set(0, 0.295, -0.01);
  zucc.scale.set(1.0, 0.72, 1.05);
  head.add(zucc);

  // --- BRAÇOS COM MANGAS VERMELHAS, PUNHOS BRANCOS E MÃOS ---
  function makeArm(side) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.44, 1.66, 0.0);
    root.add(sh);

    // Manga superior
    part(sh, 0.18, 0.42, 0.19, C_CRIMSON, 0, -0.19, 0);
    // Antebraço articulado
    const fore = new THREE.Group();
    fore.position.set(0, -0.39, 0);
    sh.add(fore);

    part(fore, 0.155, 0.34, 0.165, C_CRIMSON_DARK, 0, -0.15, 0);
    // Punho branco aparecendo na ponta da manga (como na foto!)
    part(fore, 0.125, 0.055, 0.135, C_CUFF, 0, -0.33, 0);
    // Mão idosa
    part(fore, 0.095, 0.125, 0.068, C_SKIN, 0, -0.405, 0.01);
    part(fore, 0.088, 0.065, 0.048, C_SKIN_SH, 0, -0.47, 0.015);

    sh.userData.forearm = fore;
    return sh;
  }

  rig.armL = makeArm(-1);
  rig.armR = makeArm(1);
  rig.forearmL = rig.armL.userData.forearm;
  rig.forearmR = rig.armR.userData.forearm;

  // Postura solene padrão (braços levemente à frente)
  rig.armL.rotation.set(-0.22, 0, 0.14);
  rig.forearmL.rotation.set(-0.55, 0, -0.28);
  rig.armR.rotation.set(-0.22, 0, -0.14);
  rig.forearmR.rotation.set(-0.55, 0, 0.28);

  return rig;
}

BUILD.cardeal = buildCardeal;
