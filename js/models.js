'use strict';
/* ============================================================
   HELLSLAYER - modelos "porquinhos" feitos só de caixas
   ============================================================ */
const _geo = {}, _mat = {};
function BX(w, h, d) {
  const k = w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3);
  return _geo[k] || (_geo[k] = new THREE.BoxGeometry(w, h, d));
}
function MT(color, o) {
  o = o || {};
  const k = color + '|' + (o.basic ? 'b' : 'l') + (o.em || '') + (o.tr || '') + (o.add ? 'a' : '') + (o.dbl ? 'd' : '') + (o.nofog ? 'n' : '');
  if (_mat[k]) return _mat[k];
  let m;
  if (o.basic) {
    m = new THREE.MeshBasicMaterial({
      color, transparent: !!o.tr, opacity: o.tr || 1,
      blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !o.tr, side: o.dbl ? THREE.DoubleSide : THREE.FrontSide,
      fog: !o.nofog
    });
  } else {
    m = new THREE.MeshLambertMaterial({ color, emissive: o.em || 0x000000 });
  }
  psx(m);
  return (_mat[k] = m);
}
function part(parent, w, h, d, color, x, y, z, o) {
  const m = new THREE.Mesh(BX(w, h, d), MT(color, o));
  m.position.set(x || 0, y || 0, z || 0);
  parent.add(m);
  return m;
}
// Membro com pivô na articulação (pendura para -y)
function limb(parent, w, h, d, color, jx, jy, jz, o) {
  const p = new THREE.Group();
  p.position.set(jx, jy, jz);
  const m = new THREE.Mesh(BX(w, h, d), MT(color, o));
  m.position.y = -h / 2;
  p.add(m);
  parent.add(p);
  p.userData.mesh = m;
  return p;
}
const EYE = (c) => ({ basic: true, nofog: false });

/* ---------------- humanoide genérico ---------------- */
function humanoid(o) {
  const s = o.scale || 1, w = o.wide || 1;
  const root = new THREE.Group();
  const rig = { root, h: 2.35 * s };
  rig.legL = limb(root, 0.3 * s * w, 0.95 * s, 0.32 * s, o.legs, -0.2 * s * w, 0.95 * s, 0);
  rig.legR = limb(root, 0.3 * s * w, 0.95 * s, 0.32 * s, o.legs, 0.2 * s * w, 0.95 * s, 0);
  rig.torso = part(root, 0.8 * s * w, 0.92 * s, 0.44 * s, o.cloth, 0, 1.4 * s, 0);
  rig.head = part(root, 0.44 * s, 0.46 * s, 0.44 * s, o.skin, 0, 2.1 * s, 0);
  if (o.eyes != null) {
    part(rig.head, 0.1 * s, 0.06 * s, 0.02 * s, o.eyes, -0.1 * s, 0.04 * s, 0.225 * s, { basic: true });
    part(rig.head, 0.1 * s, 0.06 * s, 0.02 * s, o.eyes, 0.1 * s, 0.04 * s, 0.225 * s, { basic: true });
  } else {
    part(rig.head, 0.1 * s, 0.08 * s, 0.02 * s, 0x000000, -0.1 * s, 0.04 * s, 0.225 * s, { basic: true });
    part(rig.head, 0.1 * s, 0.08 * s, 0.02 * s, 0x000000, 0.1 * s, 0.04 * s, 0.225 * s, { basic: true });
  }
  part(rig.head, 0.2 * s, 0.05 * s, 0.02 * s, 0x200000, 0, -0.1 * s, 0.225 * s, { basic: true });
  rig.armL = limb(root, 0.22 * s * w, 0.9 * s, 0.22 * s, o.skin, -0.55 * s * w, 1.8 * s, 0);
  rig.armR = limb(root, 0.22 * s * w, 0.9 * s, 0.22 * s, o.skin, 0.55 * s * w, 1.8 * s, 0);
  if (o.armsFwd) { rig.armL.rotation.x = -1.3; rig.armR.rotation.x = -1.3; }
  if (o.horns) {
    const hc = o.hornColor || 0xd8d0b0;
    const hl = part(rig.head, 0.07 * s, 0.3 * s, 0.07 * s, hc, -0.17 * s, 0.35 * s, 0, {});
    const hr = part(rig.head, 0.07 * s, 0.3 * s, 0.07 * s, hc, 0.17 * s, 0.35 * s, 0, {});
    hl.rotation.z = 0.35; hr.rotation.z = -0.35;
  }
  if (o.helmet) part(rig.head, 0.5 * s, 0.28 * s, 0.5 * s, o.helmet, 0, 0.17 * s, 0);
  if (o.shoulders) {
    part(root, 0.34 * s, 0.2 * s, 0.4 * s, o.shoulders, -0.62 * s * w, 1.86 * s, 0);
    part(root, 0.34 * s, 0.2 * s, 0.4 * s, o.shoulders, 0.62 * s * w, 1.86 * s, 0);
  }
  if (o.wings) {
    const wc = o.wingColor || 0x401010;
    rig.wingL = new THREE.Group(); rig.wingL.position.set(-0.2 * s, 1.75 * s, -0.25 * s);
    rig.wingR = new THREE.Group(); rig.wingR.position.set(0.2 * s, 1.75 * s, -0.25 * s);
    part(rig.wingL, 1.3 * s, 0.9 * s, 0.04 * s, wc, -0.65 * s, 0.1 * s, 0, { dbl: true });
    part(rig.wingR, 1.3 * s, 0.9 * s, 0.04 * s, wc, 0.65 * s, 0.1 * s, 0, { dbl: true });
    root.add(rig.wingL); root.add(rig.wingR);
  }
  if (o.tail) {
    part(root, 0.14 * s, 0.14 * s, 0.6 * s, o.skin, 0, 0.95 * s, -0.5 * s);
    part(root, 0.1 * s, 0.1 * s, 0.5 * s, o.skin, 0, 0.9 * s, -1.0 * s);
    part(root, 0.18 * s, 0.18 * s, 0.18 * s, 0xaa0000, 0, 0.88 * s, -1.35 * s);
  }
  if (o.cape) part(root, 0.95 * s, 1.5 * s, 0.06 * s, o.cape, 0, 1.3 * s, -0.28 * s);
  if (o.sword) {
    const sl = o.swordLen || 1;
    part(rig.armR, 0.1 * s, 0.14 * s, 0.1 * s, 0x3a2a1a, 0, -0.88 * s, 0);
    part(rig.armR, 0.13 * s, 0.05 * s, 0.12 * s, 0x887020, 0, -0.80 * s, 0);
    part(rig.armR, 0.4 * s, 0.07 * s, 0.1 * s, 0x887020, 0, -0.95 * s, 0);
    part(rig.armR, 0.08 * s, 1.2 * s * sl, 0.03 * s, 0xc0c4cc, 0, -(0.95 + 0.6 * sl) * s, 0, {});
  }
  if (o.pitchfork) {
    part(rig.armR, 0.06 * s, 1.45 * s, 0.06 * s, 0x5a3a1c, 0, -1.325 * s, 0);
    part(rig.armR, 0.3 * s, 0.06 * s, 0.05 * s, 0x909090, 0, -2.05 * s, 0);
    for (let i = -1; i <= 1; i++) part(rig.armR, 0.04 * s, 0.3 * s, 0.04 * s, 0x909090, i * 0.12 * s, -2.2 * s, 0);
  }
  if (o.shield) {
    part(rig.armL, 0.1 * s, 1.5 * s, 1.0 * s, o.shield, 0.0, -0.7 * s, 0.1 * s);
    part(rig.armL, 0.12 * s, 0.3 * s, 0.3 * s, 0xc9a227, 0.0, -0.7 * s, 0.1 * s);
  }
  if (o.goldCross) {
    // Super-Cruz Dourada usada como clava
    part(rig.armR, 0.1 * s, 0.1 * s, 0.1 * s, 0x5a3820, 0, -0.9 * s, 0);
    rig.weapon = new THREE.Group();
    part(rig.weapon, 0.28 * s, 3.4 * s, 0.28 * s, 0xd4a017, 0, -2.4 * s, 0, { em: 0x3a2800 });
    part(rig.weapon, 1.5 * s, 0.28 * s, 0.28 * s, 0xd4a017, 0, -3.3 * s, 0, { em: 0x3a2800 });
    rig.armR.add(rig.weapon);
  }
  if (o.heart) {
    rig.heart = part(rig.torso, 0.28 * s, 0.28 * s, 0.12 * s, 0xff2030, 0, 0.12 * s, 0.24 * s, { basic: true });
    part(rig.torso, 0.5 * s, 0.5 * s, 0.05 * s, 0x2a0408, 0, 0.12 * s, 0.22 * s, {});
  }
  if (o.chains) {
    part(root, 0.9 * s * w, 0.08 * s, 0.5 * s, 0x555560, 0, 1.55 * s, 0);
    part(root, 0.9 * s * w, 0.08 * s, 0.5 * s, 0x555560, 0, 1.25 * s, 0);
  }
  return rig;
}

function buildDiabrete() {
  const root = new THREE.Group();
  const rig = { root, h: 1.3 };
  rig.torso = part(root, 0.45, 0.55, 0.35, 0xc02020, 0, 0.45, 0);
  rig.head = part(root, 0.4, 0.38, 0.38, 0xd03030, 0, 0.95, 0);
  part(rig.head, 0.1, 0.07, 0.02, 0xffee00, -0.1, 0.04, 0.195, { basic: true });
  part(rig.head, 0.1, 0.07, 0.02, 0xffee00, 0.1, 0.04, 0.195, { basic: true });
  part(rig.head, 0.2, 0.05, 0.02, 0x200000, 0, -0.1, 0.195, { basic: true });
  const hl = part(rig.head, 0.06, 0.22, 0.06, 0x301010, -0.14, 0.28, 0);
  const hr = part(rig.head, 0.06, 0.22, 0.06, 0x301010, 0.14, 0.28, 0);
  hl.rotation.z = 0.3; hr.rotation.z = -0.3;
  rig.wingL = new THREE.Group(); rig.wingL.position.set(-0.15, 0.6, -0.2);
  rig.wingR = new THREE.Group(); rig.wingR.position.set(0.15, 0.6, -0.2);
  part(rig.wingL, 0.8, 0.5, 0.03, 0x501010, -0.4, 0.1, 0, { dbl: true });
  part(rig.wingR, 0.8, 0.5, 0.03, 0x501010, 0.4, 0.1, 0, { dbl: true });
  root.add(rig.wingL); root.add(rig.wingR);
  rig.armL = limb(root, 0.12, 0.45, 0.12, 0xc02020, -0.3, 0.65, 0);
  rig.armR = limb(root, 0.12, 0.45, 0.12, 0xc02020, 0.3, 0.65, 0);
  part(root, 0.08, 0.08, 0.5, 0xc02020, 0, 0.2, -0.35);
  part(root, 0.14, 0.14, 0.14, 0xff4400, 0, 0.2, -0.65, { basic: true });
  return rig;
}

function buildPadre() {
  const root = new THREE.Group();
  const rig = { root, h: 2.5 };
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.8, 1.9, 6), MT(0x14101c));
  robe.position.y = 0.95; root.add(robe); rig.torso = robe;
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.12, 6), MT(0x6a1a8a));
  sash.position.y = 1.1; root.add(sash);
  rig.head = part(root, 0.42, 0.44, 0.42, 0xb8a898, 0, 2.15, 0);
  part(rig.head, 0.54, 0.5, 0.5, 0x0c0810, 0, 0.08, -0.06);
  part(rig.head, 0.1, 0.06, 0.02, 0xcc44ff, -0.1, 0.02, 0.215, { basic: true });
  part(rig.head, 0.1, 0.06, 0.02, 0xcc44ff, 0.1, 0.02, 0.215, { basic: true });
  rig.armL = limb(root, 0.2, 0.8, 0.2, 0x14101c, -0.5, 1.75, 0);
  rig.armR = limb(root, 0.2, 0.8, 0.2, 0x14101c, 0.5, 1.75, 0);
  rig.armL.rotation.x = -1.2; rig.armR.rotation.x = -1.2;
  rig.book = part(root, 0.5, 0.06, 0.4, 0xaa22dd, 0, 1.55, 0.6, { basic: true });
  part(root, 0.1, 0.9, 0.1, 0xc9a227, 0.9, 1.4, 0.2);
  part(root, 0.4, 0.1, 0.1, 0xc9a227, 0.9, 1.7, 0.2);
  return rig;
}

const BUILD = {
  campones() {
    return humanoid({ skin: 0x6d7f5d, cloth: 0x5a3d22, legs: 0x3b2a1a, scale: 0.85, armsFwd: true, eyes: 0xff2200, pitchfork: Math.random() < 0.4 });
  },
  guarda() {
    return humanoid({ skin: 0x8a3a3a, cloth: 0x80808f, legs: 0x55556a, scale: 0.95, eyes: 0xff4400, helmet: 0x777788, shoulders: 0x9a9aaa, sword: true });
  },
  demonio() {
    return humanoid({ skin: 0xa01818, cloth: 0x701010, legs: 0x601010, scale: 1.45, wide: 1.45, horns: true, tail: true, eyes: 0xffee00, armsFwd: false });
  },
  gargula() {
    const r = humanoid({ skin: 0x6e6e78, cloth: 0x5e5e68, legs: 0x505058, scale: 0.9, horns: true, wings: true, wingColor: 0x3c3c46, eyes: 0xff6600, armsFwd: true });
    r.h = 2.0; return r;
  },
  diabrete: buildDiabrete,
  padre: buildPadre,
  maximus() {
    return humanoid({ skin: 0x703030, cloth: 0x1c1c26, legs: 0x15151c, scale: 1.8, wide: 1.2, eyes: 0xff2200, helmet: 0x2a2a38, shoulders: 0xc9a227, cape: 0x6a0a0a, sword: true, swordLen: 1.6, shield: 0x2a2a38, horns: true, hornColor: 0xc9a227 });
  },
  galius() {
    return humanoid({ skin: 0x9aa4b4, cloth: 0x7a8494, legs: 0x606a7a, scale: 2.9, wide: 1.3, eyes: null, goldCross: true, heart: true, chains: true });
  }
};

/* ---------------- viewmodels (armas na mão) ---------------- */
const SKIN_N = 0x5a3820;
const SKIN_HI = 0x6d462a;
const SKIN_SH = 0x462a16;
function buildViewmodels() {
  const VM = {};

  function addArm(parent, x, y, z, o) {
    o = o || {};
    const w = o.w || 0.22, h = o.h || 0.21, len = o.len || 0.54;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (o.rot) g.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
    // Antebraço grosso e musculoso
    part(g, w, h, len, SKIN_N, 0, 0, 0);
    // Crista muscular superior (highlight) e tendão lateral
    part(g, w * 0.62, 0.035, len * 0.82, SKIN_HI, 0, h * 0.5 + 0.008, -len * 0.04);
    part(g, 0.03, h * 0.52, len * 0.72, SKIN_SH, -w * 0.48, 0, -len * 0.03);
    // Bíceps / ombro mais largo atrás
    part(g, w * 1.18, h * 1.16, len * 0.52, 0x52321c, 0, -0.01, len * 0.46);
    // Manga arregaçada da camisa de obra
    part(g, w * 1.25, h * 1.23, 0.09, 0x3b2a1e, 0, -0.01, len * 0.30);
    part(g, w * 1.28, h * 1.26, 0.025, 0x261a12, 0, -0.01, len * 0.25);
    // Munhequeira de couro pesada com rebite de ferro
    part(g, w * 1.08, h * 1.08, 0.09, 0x2c1b10, 0, 0, -len * 0.42);
    part(g, w * 1.12, 0.032, 0.035, 0x626772, 0, h * 0.42, -len * 0.42);
    part(g, 0.03, 0.03, 0.03, 0x9096a2, -w * 0.32, h * 0.54, -len * 0.42);
    part(g, 0.03, 0.03, 0.03, 0x9096a2, w * 0.32, h * 0.54, -len * 0.42);
    // Cicatriz de batalha opcional
    if (o.scar) {
      const sc = part(g, 0.025, 0.016, 0.18, 0x7c3428, -w * 0.18, h * 0.5 + 0.024, -len * 0.08);
      sc.rotation.y = 0.22;
      part(g, 0.055, 0.016, 0.014, 0x3a1810, -w * 0.16, h * 0.5 + 0.026, -len * 0.12);
      part(g, 0.055, 0.016, 0.014, 0x3a1810, -w * 0.20, h * 0.5 + 0.026, -len * 0.04);
    }
    parent.add(g);
    return g;
  }

  function addGrip(parent, x, y, z, o) {
    o = o || {};
    const s = o.scale || 1;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    part(g, 0.21 * s, 0.21 * s, 0.21 * s, SKIN_N, 0, 0, 0);
    // Nós dos dedos cerrados e calos
    part(g, 0.22 * s, 0.055 * s, 0.09 * s, SKIN_HI, 0, 0.085 * s, -0.05 * s);
    part(g, 0.19 * s, 0.08 * s, 0.06 * s, SKIN_SH, 0, -0.04 * s, -0.105 * s);
    part(g, 0.075 * s, 0.085 * s, 0.13 * s, SKIN_N, -0.11 * s, 0.03 * s, -0.03 * s);
    parent.add(g);
    return g;
  }

  // 1 - Punhos
  {
    const root = new THREE.Group();
    const mk = (side) => {
      const g = new THREE.Group();
      addArm(g, 0, -0.01, 0.34, { w: 0.22, h: 0.21, len: 0.56, scar: side === 1 });
      // Punho massivo
      part(g, 0.24, 0.22, 0.23, SKIN_N, 0, 0.01, -0.06);
      part(g, 0.225, 0.11, 0.08, SKIN_SH, 0, -0.05, -0.17);
      part(g, 0.245, 0.055, 0.10, SKIN_HI, 0, 0.10, -0.10);
      // 4 nós dos dedos marcados (calejados/manchados)
      for (let k = -1.5; k <= 1.5; k += 1) {
        part(g, 0.046, 0.04, 0.05, 0x5c2c1c, k * 0.055, 0.115, -0.13);
      }
      // Faixa/atadura de combate nos nós
      part(g, 0.252, 0.08, 0.11, 0x2c1d14, 0, 0.02, -0.04);
      // Polegar grosso
      part(g, 0.09, 0.10, 0.16, SKIN_N, -side * 0.13, 0.035, -0.05);
      part(g, 0.08, 0.05, 0.07, SKIN_HI, -side * 0.13, 0.06, -0.10);
      g.position.set(side * 0.46, -0.35, -0.60);
      g.userData.base = g.position.clone();
      root.add(g);
      return g;
    };
    VM.fists = { root, handL: mk(-1), handR: mk(1) };
  }
  // 2 - Martelo de Obras
  {
    const root = new THREE.Group();
    part(root, 0.06, 0.62, 0.06, 0x6a4420, 0, 0.12, 0);
    part(root, 0.075, 0.04, 0.075, 0x4a2e16, 0, -0.20, 0);
    part(root, 0.09, 0.05, 0.09, 0x45484e, 0, 0.36, 0);
    part(root, 0.12, 0.15, 0.30, 0x70747c, 0, 0.45, 0);
    part(root, 0.065, 0.025, 0.065, 0x45484e, 0, 0.525, 0);
    part(root, 0.135, 0.165, 0.07, 0x45484e, 0, 0.45, -0.17);
    const claw = part(root, 0.10, 0.08, 0.09, 0x555860, 0, 0.46, 0.18);
    claw.rotation.x = 0.25;
    addGrip(root, 0, -0.10, 0);
    addArm(root, 0, -0.11, 0.32, { scar: true });
    root.position.set(0.42, -0.45, -0.7); root.rotation.set(-0.3, 0, -0.1);
    root.userData.base = { p: root.position.clone(), r: root.rotation.clone() };
    VM.hammer = { root };
  }
  // 3 - Funda
  {
    const root = new THREE.Group();
    part(root, 0.055, 0.28, 0.055, 0x6a4420, 0, -0.02, 0);
    part(root, 0.07, 0.035, 0.07, 0x4a2e16, 0, -0.16, 0);
    part(root, 0.08, 0.05, 0.06, 0x523418, 0, 0.12, 0);
    const a = part(root, 0.04, 0.20, 0.04, 0x6a4420, -0.041, 0.211, 0); a.rotation.z = 0.42;
    const b = part(root, 0.04, 0.20, 0.04, 0x6a4420, 0.041, 0.211, 0); b.rotation.z = -0.42;
    part(root, 0.05, 0.03, 0.05, 0x4a2e16, -0.081, 0.30, 0);
    part(root, 0.05, 0.03, 0.05, 0x4a2e16, 0.081, 0.30, 0);
    const bandL = part(root, 0.014, 0.014, 0.125, 0xaa5030, -0.041, 0.28, 0.045);
    bandL.rotation.set(0.16, 0.736, 0);
    const bandR = part(root, 0.014, 0.014, 0.125, 0xaa5030, 0.041, 0.28, 0.045);
    bandR.rotation.set(0.16, -0.736, 0);
    part(root, 0.06, 0.05, 0.02, 0x4a2816, 0, 0.27, 0.095);
    root.rock = part(root, 0.065, 0.065, 0.065, 0x8a8a90, 0, 0.27, 0.065);
    addGrip(root, 0, -0.10, 0);
    addArm(root, 0, -0.11, 0.32, { w: 0.21, h: 0.20 });
    root.position.set(0.32, -0.38, -0.65); root.rotation.set(-0.15, 0, 0);
    root.userData.base = { p: root.position.clone(), r: root.rotation.clone() };
    VM.sling = { root };
  }
  // 4 - Foice
  {
    const root = new THREE.Group();
    part(root, 0.05, 1.04, 0.05, 0x6a4420, 0, 0.32, 0);
    part(root, 0.065, 0.04, 0.065, 0x3a3c42, 0, -0.21, 0);
    part(root, 0.075, 0.08, 0.075, 0x45484e, 0, 0.83, 0);
    let bx = -0.01, by = 0.84;
    [
      { l: 0.18, h: 0.075, a: -0.15 },
      { l: 0.18, h: 0.068, a: 0.15 },
      { l: 0.17, h: 0.058, a: 0.48 },
      { l: 0.15, h: 0.045, a: 0.82 },
      { l: 0.12, h: 0.028, a: 1.15 }
    ].forEach((s) => {
      const dx = Math.cos(s.a), dy = Math.sin(s.a), step = s.l - 0.02;
      const m = part(root, s.l, s.h, 0.028, 0x8e939e, bx - dx * (s.l * 0.5 - 0.01), by - dy * (s.l * 0.5 - 0.01), 0);
      m.rotation.z = s.a;
      bx -= dx * step; by -= dy * step;
    });
    addGrip(root, 0, -0.08, 0);
    addArm(root, 0, -0.09, 0.32, { scar: true });
    addGrip(root, 0, 0.24, 0, { scale: 0.94 });
    addArm(root, -0.19, 0.14, 0.25, { w: 0.19, h: 0.19, len: 0.50, rot: [0.22, -0.65, 0] });
    root.position.set(0.42, -0.5, -0.8); root.rotation.set(-0.1, -0.2, -0.35);
    root.userData.base = { p: root.position.clone(), r: root.rotation.clone() };
    VM.scythe = { root };
  }
  // 5 - Martelo de Demolição
  {
    const root = new THREE.Group();
    part(root, 0.075, 1.12, 0.075, 0x5a3a1c, 0, 0.24, 0);
    part(root, 0.095, 0.045, 0.095, 0x3a2410, 0, -0.32, 0);
    part(root, 0.11, 0.06, 0.11, 0x2a2a30, 0, 0.61, 0);
    part(root, 0.38, 0.26, 0.28, 0x4a4a52, 0, 0.78, 0);
    part(root, 0.40, 0.05, 0.30, 0x2a2a30, 0, 0.93, 0);
    part(root, 0.40, 0.05, 0.30, 0x2a2a30, 0, 0.63, 0);
    part(root, 0.04, 0.22, 0.24, 0x666872, -0.20, 0.78, 0);
    part(root, 0.04, 0.22, 0.24, 0x666872, 0.20, 0.78, 0);
    addGrip(root, 0, -0.10, 0);
    addArm(root, 0, -0.11, 0.32, { scar: true });
    addGrip(root, 0, 0.22, 0, { scale: 0.94 });
    addArm(root, -0.19, 0.12, 0.25, { w: 0.19, h: 0.19, len: 0.50, rot: [0.22, -0.65, 0] });
    root.position.set(0.32, -0.5, -0.9); root.rotation.set(-0.2, 0, -0.1);
    root.userData.base = { p: root.position.clone(), r: root.rotation.clone() };
    VM.demo = { root };
  }
  // 6 - Sacra Cruz Papal
  {
    const root = new THREE.Group();
    part(root, 0.065, 0.68, 0.04, 0xd4a017, 0, 0.14, 0, { em: 0x4a3400 });
    part(root, 0.09, 0.05, 0.06, 0xb8860b, 0, -0.21, 0, { em: 0x3a2800 });
    part(root, 0.12, 0.035, 0.07, 0xb8860b, 0, 0.01, 0, { em: 0x3a2800 });
    part(root, 0.34, 0.065, 0.04, 0xd4a017, 0, 0.34, 0, { em: 0x4a3400 });
    part(root, 0.095, 0.045, 0.05, 0xd4a017, 0, 0.48, 0, { em: 0x4a3400 });
    part(root, 0.045, 0.095, 0.05, 0xd4a017, -0.17, 0.34, 0, { em: 0x4a3400 });
    part(root, 0.045, 0.095, 0.05, 0xd4a017, 0.17, 0.34, 0, { em: 0x4a3400 });
    part(root, 0.095, 0.095, 0.055, 0xfff0a0, 0, 0.34, 0, { basic: true });
    addGrip(root, 0, -0.10, 0);
    addArm(root, 0, -0.11, 0.32, { w: 0.21, h: 0.20 });
    root.position.set(0.37, -0.42, -0.7); root.rotation.set(-0.2, 0, 0);
    root.userData.base = { p: root.position.clone(), r: root.rotation.clone() };
    VM.cross = { root };
  }
  // 7 - Coração Ateu
  {
    const root = new THREE.Group();
    root.heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 0), MT(0xd01828, { basic: true }));
    root.heart.position.y = 0.085; root.add(root.heart);
    const v1 = part(root.heart, 0.032, 0.08, 0.032, 0x701018, 0.035, 0.085, 0, { basic: true });
    v1.rotation.z = -0.2;
    const v2 = part(root.heart, 0.028, 0.07, 0.028, 0x701018, -0.035, 0.08, 0.025, { basic: true });
    v2.rotation.z = 0.25;
    part(root.heart, 0.024, 0.06, 0.024, 0x580a12, 0, 0.08, -0.035, { basic: true });
    part(root, 0.22, 0.10, 0.22, SKIN_N, 0, -0.04, 0);
    part(root, 0.07, 0.075, 0.13, SKIN_N, -0.125, 0.0, -0.02);
    part(root, 0.18, 0.07, 0.06, SKIN_SH, 0, -0.005, -0.115);
    addArm(root, 0, -0.065, 0.32, { w: 0.20, h: 0.18, len: 0.52 });
    root.position.set(0.32, -0.38, -0.75); root.rotation.set(-0.35, 0, 0);
    root.userData.base = { p: root.position.clone(), r: root.rotation.clone() };
    VM.heart = { root };
  }
  return VM;
}

// Sacra Cruz arremessada (mundo)
function buildThrownCross() {
  const g = new THREE.Group();
  part(g, 0.28, 1.6, 0.16, 0xd4a017, 0, 0, 0, { em: 0x6a4800 });
  part(g, 1.1, 0.28, 0.16, 0xd4a017, 0, 0.38, 0, { em: 0x6a4800 });
  part(g, 0.38, 0.16, 0.20, 0xd4a017, 0, 0.80, 0, { em: 0x6a4800 });
  part(g, 0.38, 0.16, 0.20, 0xd4a017, 0, -0.80, 0, { em: 0x6a4800 });
  part(g, 0.16, 0.38, 0.20, 0xd4a017, -0.55, 0.38, 0, { em: 0x6a4800 });
  part(g, 0.16, 0.38, 0.20, 0xd4a017, 0.55, 0.38, 0, { em: 0x6a4800 });
  part(g, 0.38, 0.38, 0.24, 0xfff0a0, 0, 0.38, 0, { basic: true });
  return g;
}
