'use strict';

function getDemonioConeGeo(k, rTop, rBot, h, segs) {
  return _geo[k] || (_geo[k] = new THREE.CylinderGeometry(rTop, rBot, h, segs || 6));
}

function buildDemonio() {
  const s = 1.95, w = 1.32;
  const root = new THREE.Group();
  const rig = { root, h: 2.45 * s };

  const C_SKIN   = 0x9e1c18;
  const C_MUSCLE = 0xb82820;
  const C_DARK   = 0x610d0c;
  const C_SCAR   = 0x420707;
  const C_RUNE   = 0xff6b1a;
  const C_EYE    = 0xff3b00;
  const C_PUPIL  = 0xffcc22;
  const C_HORN   = 0x261d1c;
  const C_HORNT  = 0x140e0e;
  const C_EMBER  = 0xff7a18;
  const C_FLAME  = 0xffc832;
  const C_CLAW   = 0x1a0f0e;

  const mSkin   = { em: 0x1a0303 };
  const mMuscle = { em: 0x240504 };
  const mDark   = { em: 0x100202 };
  const mScar   = { em: 0x080101 };
  const mHorn   = { em: 0x0a0404 };
  const mClaw   = { em: 0x060202 };
  const hornMat  = MT(C_HORN, mHorn);
  const hornTMat = MT(C_HORNT, mHorn);
  const clawMat  = MT(C_CLAW, mClaw);

  // --- PERNAS MUSCULOSAS ARTICULADAS (100% na carne, sem grevas/botas) ---
  const mkLeg = (side) => {
    const leg = limb(root, 0.34 * s * w, 0.52 * s, 0.36 * s, C_SKIN, side * 0.23 * s * w, 0.98 * s, 0, mSkin);
    // Quadríceps volumoso e sulco lateral
    part(leg, 0.38 * s * w, 0.42 * s, 0.40 * s, C_MUSCLE, side * 0.02 * s, -0.22 * s, 0.03 * s, mMuscle);
    part(leg, 0.14 * s * w, 0.36 * s, 0.10 * s, C_DARK, side * 0.18 * s, -0.22 * s, 0.02 * s, mDark);
    // Cicatrizes e runas brilhantes na coxa
    const sc = part(leg, 0.16 * s, 0.025 * s, 0.02 * s, C_SCAR, side * 0.02 * s, -0.18 * s, 0.235 * s, mScar);
    sc.rotation.z = side * 0.45;
    const rn = part(leg, 0.028 * s, 0.14 * s, 0.02 * s, C_RUNE, side * 0.05 * s, -0.28 * s, 0.235 * s, { basic: true });
    rn.rotation.z = -side * 0.22;
    part(leg, 0.09 * s, 0.024 * s, 0.02 * s, C_RUNE, side * 0.05 * s, -0.25 * s, 0.235 * s, { basic: true });
    // Junta do joelho -> joelho marcado + panturrilha + pé com garras
    const kn = limb(leg, 0.28 * s * w, 0.50 * s, 0.30 * s, C_SKIN, 0, -0.49 * s, 0, mSkin);
    leg.userData.subMesh = kn.userData.mesh;
    part(kn, 0.28 * s * w, 0.14 * s, 0.32 * s, C_MUSCLE, 0, 0, 0.04 * s, mMuscle);
    part(kn, 0.24 * s * w, 0.34 * s, 0.26 * s, C_DARK, 0, -0.23 * s, -0.01 * s, mDark);
    part(kn, 0.26 * s * w, 0.22 * s, 0.20 * s, C_MUSCLE, 0, -0.17 * s, -0.08 * s, mMuscle);
    // Pé demoníaco nu com 3 garras
    part(kn, 0.28 * s * w, 0.10 * s, 0.42 * s, C_SKIN, 0, -0.45 * s, 0.08 * s, mSkin);
    for (let fi = -1; fi <= 1; fi++) {
      const fClaw = new THREE.Mesh(getDemonioConeGeo('dmFClaw', 0.008 * s, 0.028 * s, 0.16 * s, 5), clawMat);
      fClaw.position.set(fi * 0.09 * s, -0.46 * s, 0.33 * s);
      fClaw.rotation.x = Math.PI * 0.52;
      kn.add(fClaw);
    }
    return { leg, knee: kn };
  };
  const legLObj = mkLeg(-1), legRObj = mkLeg(1);
  rig.legL = legLObj.leg; rig.kneeL = legLObj.knee;
  rig.legR = legRObj.leg; rig.kneeR = legRObj.knee;

  // --- TORSO NU E HIPER-MUSCULOSO (sem armadura, sem cinto) ---
  rig.torso = part(root, 0.86 * s * w, 0.98 * s, 0.44 * s, C_SKIN, 0, 1.48 * s, 0, mSkin);
  // Trapézio largo e pescoço grosso
  part(rig.torso, 0.68 * s * w, 0.18 * s, 0.36 * s, C_MUSCLE, 0, 0.46 * s, -0.02 * s, mMuscle);
  part(rig.torso, 0.34 * s, 0.22 * s, 0.32 * s, C_DARK, 0, 0.54 * s, 0.01 * s, mDark);
  // Peitorais maciços divididos por sulco esternal
  part(rig.torso, 0.38 * s * w, 0.30 * s, 0.16 * s, C_MUSCLE, -0.22 * s * w, 0.24 * s, 0.20 * s, mMuscle);
  part(rig.torso, 0.38 * s * w, 0.30 * s, 0.16 * s, C_MUSCLE,  0.22 * s * w, 0.24 * s, 0.20 * s, mMuscle);
  part(rig.torso, 0.06 * s, 0.30 * s, 0.06 * s, C_DARK, 0, 0.24 * s, 0.22 * s, mDark);
  // Abdômen trincado (6 gomos) e cintura estreita
  part(rig.torso, 0.62 * s * w, 0.42 * s, 0.38 * s, C_DARK, 0, -0.18 * s, 0, mDark);
  for (let row = 0; row < 3; row++) {
    const ay = (0.01 - row * 0.12) * s;
    part(rig.torso, 0.16 * s * w, 0.09 * s, 0.08 * s, C_MUSCLE, -0.10 * s * w, ay, 0.20 * s, mMuscle);
    part(rig.torso, 0.16 * s * w, 0.09 * s, 0.08 * s, C_MUSCLE,  0.10 * s * w, ay, 0.20 * s, mMuscle);
  }
  // Pelve musculosa nua
  part(rig.torso, 0.72 * s * w, 0.22 * s, 0.40 * s, C_SKIN, 0, -0.44 * s, 0, mSkin);
  // Costas: dorsais largos + vértebras salientes
  part(rig.torso, 0.40 * s * w, 0.48 * s, 0.14 * s, C_MUSCLE, -0.22 * s * w, 0.16 * s, -0.19 * s, mMuscle);
  part(rig.torso, 0.40 * s * w, 0.48 * s, 0.14 * s, C_MUSCLE,  0.22 * s * w, 0.16 * s, -0.19 * s, mMuscle);
  for (let vi = 0; vi < 5; vi++) {
    part(rig.torso, 0.08 * s, 0.08 * s, 0.09 * s, C_DARK, 0, (0.34 - vi * 0.15) * s, -0.24 * s, mDark);
  }
  // Cicatrizes e runas flamejantes gravadas na carne do peito e abdômen
  const cScar1 = part(rig.torso, 0.32 * s, 0.026 * s, 0.02 * s, C_SCAR, -0.18 * s, 0.26 * s, 0.285 * s, mScar);
  cScar1.rotation.z = 0.52;
  const cScar2 = part(rig.torso, 0.28 * s, 0.026 * s, 0.02 * s, C_SCAR, 0.16 * s, 0.22 * s, 0.285 * s, mScar);
  cScar2.rotation.z = -0.44;
  const rChest = part(rig.torso, 0.026 * s, 0.16 * s, 0.02 * s, C_RUNE, 0.0, 0.26 * s, 0.255 * s, { basic: true });
  rChest.rotation.z = 0.15;
  part(rig.torso, 0.11 * s, 0.024 * s, 0.02 * s, C_RUNE, -0.16 * s, 0.18 * s, 0.285 * s, { basic: true });
  part(rig.torso, 0.024 * s, 0.11 * s, 0.02 * s, C_RUNE, -0.16 * s, 0.18 * s, 0.285 * s, { basic: true });
  part(rig.torso, 0.022 * s, 0.10 * s, 0.02 * s, C_RUNE, -0.10 * s, -0.04 * s, 0.245 * s, { basic: true });
  part(rig.torso, 0.022 * s, 0.10 * s, 0.02 * s, C_RUNE,  0.10 * s, -0.12 * s, 0.245 * s, { basic: true });

  // --- RABO ARTICULADO QUE MEXE (4 segmentos encadeados + ponta em seta) ---
  rig.tail = new THREE.Group();
  rig.tail.position.set(0, -0.38 * s, -0.22 * s);
  rig.torso.add(rig.tail);
  rig.tailSegs = [];
  let tailParent = rig.tail;
  const segLens = [0.42 * s, 0.38 * s, 0.34 * s, 0.28 * s];
  const segRads = [0.095 * s, 0.072 * s, 0.052 * s, 0.036 * s];
  for (let ti = 0; ti < 4; ti++) {
    const seg = new THREE.Group();
    if (ti > 0) seg.position.set(0, 0, -segLens[ti - 1] * 0.92);
    seg.rotation.x = ti === 0 ? -0.32 : (ti === 1 ? 0.18 : 0.24);
    const len = segLens[ti], rad = segRads[ti];
    const tGeo = getDemonioConeGeo('dmTail' + ti, rad * 0.78, rad, len, 6);
    const tMesh = new THREE.Mesh(tGeo, MT(ti % 2 === 0 ? C_SKIN : C_DARK, ti % 2 === 0 ? mSkin : mDark));
    tMesh.rotation.x = Math.PI * 0.5;
    tMesh.position.z = -len * 0.5;
    seg.add(tMesh);
    // Crista dorsal carnuda no segmento
    part(seg, rad * 0.45, rad * 0.7, len * 0.5, C_DARK, 0, rad * 0.75, -len * 0.5, mDark);
    if (ti === 3) {
      // Ponta em seta demoníaca com veio rúnico
      const tip = new THREE.Mesh(getDemonioConeGeo('dmTailTip', 0.004 * s, 0.085 * s, 0.26 * s, 4), MT(C_DARK, mDark));
      tip.rotation.x = -Math.PI * 0.5;
      tip.scale.set(1.4, 1, 0.35);
      tip.position.set(0, 0, -len - 0.08 * s);
      seg.add(tip);
      part(seg, 0.022 * s, 0.022 * s, 0.14 * s, C_RUNE, 0, 0.02 * s, -len - 0.04 * s, { basic: true });
    }
    tailParent.add(seg);
    rig.tailSegs.push(seg);
    tailParent = seg;
  }

  // --- BRAÇOS MACIÇOS ARTICULADOS E PUNHOS COM GARRAS (sem ombreiras) ---
  const mkArm = (side) => {
    const arm = limb(root, 0.25 * s * w, 0.48 * s, 0.25 * s, C_SKIN, side * 0.59 * s * w, 1.88 * s, 0, mSkin);
    // Deltoide nu volumoso
    part(arm, 0.34 * s * w, 0.28 * s, 0.32 * s, C_MUSCLE, side * 0.04 * s, -0.06 * s, 0, mMuscle);
    // Bíceps / tríceps
    part(arm, 0.28 * s * w, 0.32 * s, 0.28 * s, C_MUSCLE, 0, -0.30 * s, 0.02 * s, mMuscle);
    // Junta do cotovelo -> antebraço grosso + punho com garras
    const fore = limb(arm, 0.23 * s * w, 0.50 * s, 0.23 * s, C_SKIN, 0, -0.44 * s, 0, mSkin);
    arm.userData.subMesh = fore.userData.mesh;
    part(fore, 0.24 * s * w, 0.38 * s, 0.24 * s, C_DARK, 0, -0.18 * s, 0.01 * s, mDark);
    const aRune = part(fore, 0.024 * s, 0.16 * s, 0.02 * s, C_RUNE, side * 0.125 * s, -0.16 * s, 0.05 * s, { basic: true });
    aRune.rotation.z = side * 0.2;
    // Punho cerrado com garras
    part(fore, 0.26 * s * w, 0.20 * s, 0.26 * s, C_SKIN, 0, -0.44 * s, 0.02 * s, mSkin);
    for (let ci = -1; ci <= 1; ci++) {
      const claw = new THREE.Mesh(getDemonioConeGeo('dmHClaw', 0.006 * s, 0.022 * s, 0.14 * s, 5), clawMat);
      claw.position.set(ci * 0.075 * s, -0.57 * s, 0.08 * s);
      claw.rotation.x = 0.45;
      fore.add(claw);
    }
    // Brasas / fogo sutil no punho direito (referência à foto)
    if (side > 0) {
      for (let ei = 0; ei < 4; ei++) {
        const ang = (ei / 4) * Math.PI * 2;
        const em = part(fore, 0.05 * s, 0.13 * s, 0.05 * s, ei % 2 === 0 ? C_EMBER : C_FLAME,
          Math.cos(ang) * 0.14 * s, -0.42 * s + (ei % 2) * 0.06 * s, Math.sin(ang) * 0.14 * s, { basic: true });
        em.rotation.z = Math.cos(ang) * 0.35;
      }
    }
    return { arm, forearm: fore };
  };
  const armLObj = mkArm(-1), armRObj = mkArm(1);
  rig.armL = armLObj.arm; rig.forearmL = armLObj.forearm;
  rig.armR = armRObj.arm; rig.forearmR = armRObj.forearm;

  // --- CABEÇA DEMONÍACA + COROA DE CHIFRES RAMIFICADOS COM FOGO ---
  rig.head = part(root, 0.46 * s, 0.50 * s, 0.46 * s, C_SKIN, 0, 2.20 * s, 0.04 * s, mSkin);
  // Arcada supraciliar franzida (olhar ameaçador), maçãs do rosto e mandíbula forte
  const browL = part(rig.head, 0.22 * s, 0.08 * s, 0.12 * s, C_MUSCLE, -0.11 * s, 0.11 * s, 0.21 * s, mMuscle);
  const browR = part(rig.head, 0.22 * s, 0.08 * s, 0.12 * s, C_MUSCLE,  0.11 * s, 0.11 * s, 0.21 * s, mMuscle);
  browL.rotation.z = -0.26;
  browR.rotation.z =  0.26;
  part(rig.head, 0.48 * s, 0.10 * s, 0.22 * s, C_MUSCLE, 0, 0.01 * s, 0.14 * s, mMuscle);
  part(rig.head, 0.40 * s, 0.16 * s, 0.36 * s, C_DARK, 0, -0.17 * s, 0.07 * s, mDark);
  // Olhos vermelhos/laranja incandescentes
  part(rig.head, 0.10 * s, 0.055 * s, 0.03 * s, C_EYE, -0.11 * s, 0.05 * s, 0.235 * s, { basic: true });
  part(rig.head, 0.10 * s, 0.055 * s, 0.03 * s, C_EYE,  0.11 * s, 0.05 * s, 0.235 * s, { basic: true });
  part(rig.head, 0.045 * s, 0.035 * s, 0.032 * s, C_PUPIL, -0.11 * s, 0.05 * s, 0.240 * s, { basic: true });
  part(rig.head, 0.045 * s, 0.035 * s, 0.032 * s, C_PUPIL,  0.11 * s, 0.05 * s, 0.240 * s, { basic: true });
  // Boca fechada/rosnando com presas visíveis
  part(rig.head, 0.24 * s, 0.055 * s, 0.04 * s, 0x160002, 0, -0.13 * s, 0.235 * s, { basic: true });
  for (const tx of [-0.08, -0.03, 0.03, 0.08]) {
    part(rig.head, 0.022 * s, 0.036 * s, 0.02 * s, 0xe8dcc8, tx * s, -0.115 * s, 0.245 * s, { basic: true });
  }
  // Orelhas pontudas varridas para trás
  const earL = part(rig.head, 0.22 * s, 0.07 * s, 0.06 * s, C_SKIN, -0.28 * s, 0.05 * s, -0.02 * s, mSkin);
  const earR = part(rig.head, 0.22 * s, 0.07 * s, 0.06 * s, C_SKIN,  0.28 * s, 0.05 * s, -0.02 * s, mSkin);
  earL.rotation.set(0, 0.35, -0.35);
  earR.rotation.set(0, -0.35, 0.35);

  // Coroa de chifres grandes e ramificados (3 segmentos principais + galho interno + espora + fogo)
  for (const side of [-1, 1]) {
    // Base do chifre principal saindo para fora e para trás
    const h1 = new THREE.Mesh(getDemonioConeGeo('dmH1', 0.062 * s, 0.088 * s, 0.28 * s, 6), hornMat);
    h1.position.set(side * 0.20 * s, 0.24 * s, -0.02 * s);
    h1.rotation.set(-0.20, 0, -side * 0.85);
    rig.head.add(h1);

    // Segmento médio curvando para cima
    const h2 = new THREE.Mesh(getDemonioConeGeo('dmH2', 0.042 * s, 0.062 * s, 0.32 * s, 6), hornMat);
    h2.position.set(side * 0.40 * s, 0.38 * s, -0.08 * s);
    h2.rotation.set(0.12, 0, -side * 0.38);
    rig.head.add(h2);

    // Ponta superior afilada voltada para cima/dentro
    const h3 = new THREE.Mesh(getDemonioConeGeo('dmH3', 0.008 * s, 0.042 * s, 0.28 * s, 6), hornTMat);
    h3.position.set(side * 0.44 * s, 0.62 * s, -0.04 * s);
    h3.rotation.set(0.24, 0, side * 0.22);
    rig.head.add(h3);

    // Galho secundário interno (forma a coroa dupla da foto)
    const hb1 = new THREE.Mesh(getDemonioConeGeo('dmHb1', 0.032 * s, 0.048 * s, 0.26 * s, 6), hornMat);
    hb1.position.set(side * 0.22 * s, 0.40 * s, -0.03 * s);
    hb1.rotation.set(0.10, 0, -side * 0.15);
    rig.head.add(hb1);

    const hb2 = new THREE.Mesh(getDemonioConeGeo('dmHb2', 0.006 * s, 0.032 * s, 0.22 * s, 6), hornTMat);
    hb2.position.set(side * 0.19 * s, 0.60 * s, 0.01 * s);
    hb2.rotation.set(0.22, 0, side * 0.30);
    rig.head.add(hb2);

    // Espora lateral menor
    const hs = new THREE.Mesh(getDemonioConeGeo('dmHs', 0.005 * s, 0.030 * s, 0.16 * s, 5), hornTMat);
    hs.position.set(side * 0.34 * s, 0.22 * s, -0.05 * s);
    hs.rotation.z = -side * 1.15;
    rig.head.add(hs);

    // Línguas de fogo / brasas entre os chifres
    const f1 = part(rig.head, 0.05 * s, 0.16 * s, 0.04 * s, C_EMBER, side * 0.28 * s, 0.44 * s, -0.04 * s, { basic: true });
    f1.rotation.z = -side * 0.22;
    const f2 = part(rig.head, 0.035 * s, 0.14 * s, 0.035 * s, C_FLAME, side * 0.15 * s, 0.48 * s, -0.02 * s, { basic: true });
    f2.rotation.z = side * 0.18;
  }

  return rig;
}

BUILD.demonio = buildDemonio;
