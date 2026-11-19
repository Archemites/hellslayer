'use strict';

function getPadreTatterGeo(k, w, h, d) {
  if (_geo[k]) return _geo[k];
  const s = new THREE.Shape();
  s.moveTo(-w * 0.5, 0);
  s.lineTo(w * 0.5, 0);
  s.lineTo(w * 0.14, -h * 0.62);
  s.lineTo(0, -h);
  s.lineTo(-w * 0.22, -h * 0.55);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d || 0.018, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -(d || 0.018) * 0.5);
  geo.computeBoundingBox();
  return (_geo[k] = geo);
}

function buildPadre() {
  const root = new THREE.Group();
  const rig = { root, h: 2.5 };

  // Paleta inspirada no Padre Sombrio: batina escura desgastada, estola carmesim/ouro, pele pálida, olhos roxos
  const C_ROBE       = 0x1e1815;
  const C_ROBE_DARK  = 0x120e0c;
  const C_ROBE_FOLD  = 0x2b221d;
  const C_BLOOD_HEM  = 0x5c1114;
  const C_STOLE      = 0x6e1418;
  const C_STOLE_DARK = 0x450a0d;
  const C_GOLD       = 0xb8923a;
  const C_GOLD_HI    = 0xd9b65b;
  const C_GOLD_DARK  = 0x785a1c;
  const C_ROPE       = 0x856a48;
  const C_ROPE_DARK  = 0x59452c;
  const C_SKIN       = 0x8e7c6d;
  const C_SKIN_SH    = 0x5c4d42;
  const C_SKIN_HI    = 0xa89685;
  const C_BOOT       = 0x362419;
  const C_BOOT_SOLE  = 0x1a100b;
  const C_EYE_GLOW   = 0xb833ff;
  const C_EYE_CORE   = 0xf0b8ff;

  const mRobe     = MT(C_ROBE);
  const mRobeDark = MT(C_ROBE_DARK);
  const mBloodHem = MT(C_BLOOD_HEM);

  // --- TORSO / BATINA PRINCIPAL (mesh centralizado para hitbox e corte) ---
  const robeGeo = _geo['padreRobe'] || (_geo['padreRobe'] = new THREE.CylinderGeometry(0.28, 0.52, 1.62, 8));
  const robe = new THREE.Mesh(robeGeo, mRobe);
  robe.position.y = 1.02;
  root.add(robe);
  rig.torso = robe;

  // Grupo de detalhes da vestimenta preso ao root (evita escala dupla no bisect)
  const garb = new THREE.Group();
  root.add(garb);

  // Pregas verticais da batina (frente, costas e laterais)
  const foldAngles = [0.22, -0.22, 0.68, -0.68, 2.75, -2.75, 1.55, -1.55];
  for (let i = 0; i < foldAngles.length; i++) {
    const ang = foldAngles[i];
    const r = 0.39;
    const f = part(garb, 0.075, 1.48, 0.06, i % 2 === 0 ? C_ROBE_FOLD : C_ROBE_DARK,
      Math.sin(ang) * r, 0.98, Math.cos(ang) * r);
    f.rotation.y = ang;
    f.rotation.x = -0.11 * Math.cos(ang);
    f.rotation.z = 0.11 * Math.sin(ang);
  }

  // Barra rasgada / farrapos na base da batina (com manchas de sangue na frente)
  const tatterGeo = getPadreTatterGeo('padreHemTatter', 0.20, 0.30, 0.022);
  const nTatters = 14;
  for (let i = 0; i < nTatters; i++) {
    const ang = (i / nTatters) * Math.PI * 2;
    const r = 0.50 + (i % 2) * 0.025;
    const isFrontBlood = (Math.cos(ang) > 0.35 && i % 3 !== 0) || i === 1;
    const tMesh = new THREE.Mesh(tatterGeo, isFrontBlood ? mBloodHem : (i % 2 === 0 ? mRobe : mRobeDark));
    tMesh.position.set(Math.sin(ang) * r, 0.25, Math.cos(ang) * r);
    tMesh.rotation.y = ang;
    tMesh.rotation.x = -0.14;
    tMesh.scale.set(0.9 + (i % 3) * 0.18, 0.78 + ((i * 7) % 4) * 0.14, 1);
    garb.add(tMesh);
  }

  // Botas de couro gastas sob a batina
  for (const side of [-1, 1]) {
    part(garb, 0.15, 0.16, 0.24, C_BOOT, side * 0.15, 0.10, 0.05);
    part(garb, 0.16, 0.05, 0.28, C_BOOT_SOLE, side * 0.15, 0.025, 0.06);
    part(garb, 0.14, 0.08, 0.12, C_BOOT, side * 0.15, 0.11, 0.15);
  }

  // Murça / ombreiras em camadas rasgadas sobre os ombros
  part(garb, 0.68, 0.14, 0.38, C_ROBE_DARK, 0, 1.78, -0.01);
  for (const side of [-1, 1]) {
    const shPad = part(garb, 0.24, 0.09, 0.34, C_ROBE_FOLD, side * 0.30, 1.79, 0);
    shPad.rotation.z = -side * 0.22;
  }

  // Gola alta escura e pescoço ossudo
  part(garb, 0.24, 0.10, 0.24, C_ROBE_DARK, 0, 1.85, 0);
  part(garb, 0.15, 0.16, 0.15, C_SKIN_SH, 0, 1.91, 0.01);

  // --- ESTOLA CARMESIM E DOURADA (dois painéis frontais + cruzes bordadas) ---
  for (const side of [-1, 1]) {
    const sx = side * 0.155;
    // Parte superior (sobre o peito inclinado)
    const stTop = part(garb, 0.13, 0.66, 0.032, C_STOLE, sx, 1.50, 0.225);
    stTop.rotation.x = -0.14;
    stTop.rotation.z = -side * 0.05;
    // Borda dourada lateral da estola superior
    const bL = part(garb, 0.016, 0.65, 0.036, C_GOLD_DARK, sx - 0.058, 1.50, 0.227);
    const bR = part(garb, 0.016, 0.65, 0.036, C_GOLD_DARK, sx + 0.058, 1.50, 0.227);
    bL.rotation.x = -0.14; bL.rotation.z = -side * 0.05;
    bR.rotation.x = -0.14; bR.rotation.z = -side * 0.05;

    // Parte inferior (abaixo do cinturão de corda)
    const stBot = part(garb, 0.14, 0.56, 0.032, C_STOLE, sx * 1.12, 0.92, 0.315);
    stBot.rotation.x = -0.12;
    part(garb, 0.016, 0.55, 0.036, C_GOLD_DARK, sx * 1.12 - 0.062, 0.92, 0.317).rotation.x = -0.12;
    part(garb, 0.016, 0.55, 0.036, C_GOLD_DARK, sx * 1.12 + 0.062, 0.92, 0.317).rotation.x = -0.12;

    // Cruz bordada dourada na ponta inferior da estola
    part(garb, 0.022, 0.14, 0.016, C_GOLD, sx * 1.12, 0.78, 0.345).rotation.x = -0.12;
    part(garb, 0.085, 0.022, 0.016, C_GOLD, sx * 1.12, 0.81, 0.341).rotation.x = -0.12;

    // Franja rasgada na ponta da estola
    for (let fi = -1; fi <= 1; fi++) {
      part(garb, 0.024, 0.07, 0.02, C_STOLE_DARK, sx * 1.12 + fi * 0.045, 0.61, 0.348);
    }
  }

  // --- CÍNGULO DE CORDA NA CINTURA + ROSÁRIO DE CORDA PENDENTE ---
  const belt = new THREE.Mesh(
    _geo['padreBelt'] || (_geo['padreBelt'] = new THREE.CylinderGeometry(0.325, 0.345, 0.085, 8)),
    MT(C_ROPE)
  );
  belt.position.y = 1.21;
  garb.add(belt);
  part(garb, 0.34, 0.025, 0.34, C_ROPE_DARK, 0, 1.21, 0);
  // Nó frontal da corda
  part(garb, 0.11, 0.09, 0.08, C_ROPE, 0, 1.20, 0.31);
  part(garb, 0.07, 0.05, 0.09, C_ROPE_DARK, 0, 1.20, 0.32);
  // Ponta curta da corda com nó
  part(garb, 0.034, 0.34, 0.034, C_ROPE, -0.035, 1.01, 0.34);
  part(garb, 0.058, 0.058, 0.058, C_ROPE_DARK, -0.035, 0.83, 0.35);
  // Ponta longa da corda com pequena cruz dourada na ponta
  part(garb, 0.032, 0.52, 0.032, C_ROPE, 0.035, 0.92, 0.35);
  part(garb, 0.048, 0.048, 0.048, C_ROPE_DARK, 0.035, 0.72, 0.36);
  part(garb, 0.022, 0.11, 0.018, C_GOLD, 0.035, 0.61, 0.365);
  part(garb, 0.075, 0.022, 0.018, C_GOLD, 0.035, 0.635, 0.365);

  // --- COLAR E CRUZ PEITORAL ORNAMENTADA (rig.cross — arrancada na Glory Kill) ---
  for (const side of [-1, 1]) {
    const cord = part(garb, 0.02, 0.24, 0.02, C_GOLD_DARK, side * 0.055, 1.72, 0.21);
    cord.rotation.z = side * 0.42;
    cord.rotation.x = -0.25;
  }
  rig.cross = new THREE.Group();
  rig.cross.position.set(0, 1.54, 0.265);
  part(rig.cross, 0.044, 0.28, 0.026, C_GOLD, 0, 0, 0);
  part(rig.cross, 0.19, 0.044, 0.026, C_GOLD, 0, 0.045, 0);
  // Pontas alargadas e relevo central da cruz peitoral
  part(rig.cross, 0.068, 0.035, 0.03, C_GOLD_DARK, 0, 0.135, 0);
  part(rig.cross, 0.068, 0.035, 0.03, C_GOLD_DARK, 0, -0.135, 0);
  part(rig.cross, 0.035, 0.068, 0.03, C_GOLD_DARK, -0.09, 0.045, 0);
  part(rig.cross, 0.035, 0.068, 0.03, C_GOLD_DARK,  0.09, 0.045, 0);
  part(rig.cross, 0.055, 0.055, 0.034, C_GOLD_HI, 0, 0.045, 0.004);
  root.add(rig.cross);

  // --- CABEÇA ESQUÁLIDA, CAPUZ PONTUDO E OLHOS ROXOS BRILHANTES ---
  rig.head = part(root, 0.26, 0.33, 0.26, C_SKIN, 0, 2.09, 0.02);
  // Maçãs do rosto salientes e bochechas encovadas
  part(rig.head, 0.27, 0.055, 0.12, C_SKIN_HI, 0, 0.005, 0.075);
  part(rig.head, 0.21, 0.09, 0.12, C_SKIN_SH, 0, -0.07, 0.055);
  // Nariz fino e queixo marcado
  part(rig.head, 0.045, 0.09, 0.06, C_SKIN_HI, 0, -0.005, 0.145);
  part(rig.head, 0.12, 0.06, 0.08, C_SKIN_HI, 0, -0.135, 0.095);
  // Boca severa
  part(rig.head, 0.10, 0.022, 0.02, C_SKIN_SH, 0, -0.09, 0.132);
  // Arcada supraciliar franzida e órbitas profundas
  const browL = part(rig.head, 0.11, 0.048, 0.075, C_SKIN_SH, -0.06, 0.072, 0.125);
  const browR = part(rig.head, 0.11, 0.048, 0.075, C_SKIN_SH,  0.06, 0.072, 0.125);
  browL.rotation.z = -0.18; browR.rotation.z = 0.18;
  part(rig.head, 0.20, 0.055, 0.03, 0x0b0610, 0, 0.042, 0.125);

  // Olhos brilhantes em roxo (brilho intenso + núcleo claro)
  part(rig.head, 0.062, 0.034, 0.02, C_EYE_GLOW, -0.058, 0.042, 0.138, { basic: true });
  part(rig.head, 0.062, 0.034, 0.02, C_EYE_GLOW,  0.058, 0.042, 0.138, { basic: true });
  part(rig.head, 0.026, 0.020, 0.022, C_EYE_CORE, -0.058, 0.042, 0.141, { basic: true });
  part(rig.head, 0.026, 0.020, 0.022, C_EYE_CORE,  0.058, 0.042, 0.141, { basic: true });

  // Capuz pontudo envolvendo o rosto
  part(rig.head, 0.36, 0.38, 0.34, C_ROBE_DARK, 0, 0.03, -0.065);
  part(rig.head, 0.39, 0.12, 0.38, C_ROBE, 0, 0.16, -0.02);
  // Abas laterais do capuz
  for (const side of [-1, 1]) {
    const flap = part(rig.head, 0.075, 0.38, 0.28, C_ROBE, side * 0.165, 0.01, 0.02);
    flap.rotation.z = -side * 0.16;
  }
  // Ponta superior do capuz
  const hoodPeak = new THREE.Mesh(
    _geo['padreHoodPeak'] || (_geo['padreHoodPeak'] = new THREE.ConeGeometry(0.21, 0.22, 4)),
    mRobe
  );
  hoodPeak.position.set(0, 0.27, -0.02);
  hoodPeak.rotation.y = Math.PI * 0.25;
  rig.head.add(hoodPeak);

  // --- BRAÇOS ARTICULADOS COM MANGAS LARGAS RASGADAS E MÃOS OSSUDAS ---
  const sleeveTatterGeo = getPadreTatterGeo('padreSleeveTatter', 0.14, 0.28, 0.018);
  for (const side of [-1, 1]) {
    const arm = limb(root, 0.14, 0.38, 0.14, C_ROBE, side * 0.40, 1.76, 0);
    part(arm, 0.22, 0.24, 0.24, C_ROBE_DARK, 0, -0.22, -0.03);
    // Junta do cotovelo -> punho largo da manga + antebraço pálido + mão ossuda
    const fore = limb(arm, 0.11, 0.36, 0.11, C_ROBE_DARK, 0, -0.36, 0);
    arm.userData.subMesh = fore.userData.mesh;
    part(fore, 0.24, 0.22, 0.28, C_ROBE_DARK, 0, -0.02, -0.05);
    for (let ti = 0; ti < 3; ti++) {
      const st = new THREE.Mesh(sleeveTatterGeo, ti === 1 ? mBloodHem : mRobe);
      st.position.set(0, -0.10, -0.02 - ti * 0.08);
      st.rotation.y = Math.PI * 0.5;
      st.scale.set(0.85 + ti * 0.12, 0.8 + (ti % 2) * 0.35, 1);
      fore.add(st);
    }
    part(fore, 0.095, 0.26, 0.095, C_SKIN, 0, -0.22, 0);
    part(fore, 0.11, 0.12, 0.075, C_SKIN_HI, 0, -0.38, 0.01);
    for (let fi = -1; fi <= 1; fi++) {
      part(fore, 0.022, 0.10, 0.022, C_SKIN_SH, fi * 0.032, -0.47, 0.015);
    }
    arm.rotation.x = -1.2;
    fore.rotation.x = -0.45;
    if (side < 0) { rig.armL = arm; rig.forearmL = fore; }
    else { rig.armR = arm; rig.forearmR = fore; }
  }

  // --- GRIMÓRIO FLUTUANTE (rig.book — usado na animação de conjuração) ---
  rig.book = part(root, 0.44, 0.065, 0.34, 0x1e1118, 0, 1.55, 0.6);
  part(rig.book, 0.38, 0.072, 0.28, 0x9922ee, 0, 0.006, 0, { basic: true });
  part(rig.book, 0.46, 0.02, 0.06, C_GOLD_DARK, 0, 0.03, 0.14);
  part(rig.book, 0.46, 0.02, 0.06, C_GOLD_DARK, 0, 0.03, -0.14);

  return rig;
}

BUILD.padre = buildPadre;
