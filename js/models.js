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

let _bioHeartVentricleGeo = null;
function getBioHeartVentricleGeo() {
  if (_bioHeartVentricleGeo) return _bioHeartVentricleGeo;
  const geo = new THREE.SphereGeometry(0.068, 12, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const ny = y / 0.068; // -1 (ápice) a +1 (base)
    const taper = ny < 0 ? (1 + ny * 0.58) : (1 - Math.max(0, ny - 0.5) * 0.24);
    x *= taper;
    z *= taper * 0.80;
    y *= 1.28;
    // Inclinação anatômica do ápice para a esquerda e frente
    x += (1 - ny) * 0.011;
    z += (1 - ny) * 0.005;
    // Sulco interventricular diagonal na face anterior
    if (z > 0) {
      const groove = Math.exp(-Math.pow((x - y * 0.22) / 0.017, 2));
      z -= groove * 0.0065;
    }
    // Irregularidade muscular orgânica sutil
    const bump = 1 + 0.04 * Math.sin(x * 85 + y * 60) * Math.cos(z * 75);
    pos.setXYZ(i, x * bump, y * bump, z * bump);
  }
  geo.computeVertexNormals();
  _bioHeartVentricleGeo = geo;
  return geo;
}

function bioHeart(scale) {
  const s = scale || 1;
  const g = new THREE.Group();
  const root = new THREE.Group();
  root.scale.setScalar(s);
  g.add(root);

  const mMuscle = MT(0x9e1220, { em: 0x3a040a });
  const mAtrium = MT(0x6e0b18, { em: 0x220206 });
  const mAorta  = MT(0xb81d2a, { em: 0x320508 });
  const mVein   = MT(0x4c1024, { em: 0x16030a });
  const mSulcus = MT(0x5a1418, { em: 0x180204 });
  const mCorArt = MT(0xc81c2c, { em: 0x44060c });
  const mCorVen = MT(0x340818, { em: 0x100206 });

  // Massa ventricular principal (esculpida com ápice inclinado)
  const vent = new THREE.Mesh(getBioHeartVentricleGeo(), mMuscle);
  root.add(vent);

  // Aurículas / átrios superiores
  const aurGeo = _geo['bioAur'] || (_geo['bioAur'] = new THREE.SphereGeometry(0.030, 8, 6));
  const aurL = new THREE.Mesh(aurGeo, mAtrium);
  aurL.position.set(-0.036, 0.050, -0.004);
  aurL.scale.set(1.12, 0.85, 0.92);
  aurL.rotation.z = 0.28;
  root.add(aurL);

  const aurR = new THREE.Mesh(aurGeo, mAtrium);
  aurR.position.set(0.034, 0.054, 0.004);
  aurR.scale.set(1.05, 0.88, 0.90);
  aurR.rotation.z = -0.24;
  root.add(aurR);

  // Sulco coronariano entre átrios e ventrículos
  const sulcGeo = _geo['bioSulc'] || (_geo['bioSulc'] = new THREE.TorusGeometry(0.044, 0.0075, 5, 10));
  const sulc = new THREE.Mesh(sulcGeo, mSulcus);
  sulc.position.set(0, 0.038, 0);
  sulc.rotation.x = Math.PI * 0.5;
  sulc.scale.set(1.10, 0.84, 1.0);
  root.add(sulc);

  // Arco da Aorta (tronco arterial curvo no topo)
  const archGeo = _geo['bioArch'] || (_geo['bioArch'] = new THREE.TorusGeometry(0.025, 0.0115, 6, 8, Math.PI * 0.95));
  const arch = new THREE.Mesh(archGeo, mAorta);
  arch.position.set(-0.004, 0.068, -0.002);
  arch.rotation.y = 0.25;
  root.add(arch);

  // 3 ramificações arteriais no topo do arco aórtico
  const brGeo = _geo['bioBr'] || (_geo['bioBr'] = new THREE.CylinderGeometry(0.0048, 0.006, 0.024, 6));
  const brOffsets = [[-0.016, 0.096, 0.002, 0.28], [0.001, 0.100, -0.002, 0.02], [0.017, 0.095, -0.006, -0.24]];
  for (let i = 0; i < brOffsets.length; i++) {
    const b = new THREE.Mesh(brGeo, mAorta);
    b.position.set(brOffsets[i][0], brOffsets[i][1], brOffsets[i][2]);
    b.rotation.z = brOffsets[i][3];
    root.add(b);
  }

  // Tronco Pulmonar (saindo na frente-esquerda)
  const pulGeo = _geo['bioPul'] || (_geo['bioPul'] = new THREE.CylinderGeometry(0.0095, 0.0115, 0.044, 7));
  const pul = new THREE.Mesh(pulGeo, mVein);
  pul.position.set(-0.013, 0.064, 0.019);
  pul.rotation.set(-0.22, 0, 0.34);
  root.add(pul);

  // Veia Cava Superior (lado direito)
  const svcGeo = _geo['bioSvc'] || (_geo['bioSvc'] = new THREE.CylinderGeometry(0.010, 0.0115, 0.050, 7));
  const svc = new THREE.Mesh(svcGeo, mVein);
  svc.position.set(0.036, 0.068, -0.012);
  svc.rotation.z = -0.14;
  root.add(svc);

  // Vasos coronarianos percorrendo a superfície dos ventrículos
  const cvGeo = _geo['bioCv'] || (_geo['bioCv'] = new THREE.CylinderGeometry(0.0022, 0.0036, 0.072, 5));
  const vessels = [
    { x: 0.002, y: 0.002, z: 0.052, rx: 0.16, rz: -0.24, mat: mCorArt },
    { x: 0.012, y: -0.012, z: 0.049, rx: 0.24, rz: -0.58, mat: mCorVen },
    { x: -0.026, y: 0.006, z: 0.046, rx: 0.18, rz: 0.32, mat: mCorVen },
    { x: 0.034, y: 0.004, z: 0.036, rx: 0.14, rz: -0.45, mat: mCorArt }
  ];
  for (let i = 0; i < vessels.length; i++) {
    const v = vessels[i];
    const vm = new THREE.Mesh(cvGeo, v.mat);
    vm.position.set(v.x, v.y, v.z);
    vm.rotation.set(v.rx, 0, v.rz);
    root.add(vm);
  }

  return g;
}

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
    rig.sword = new THREE.Group();
    part(rig.sword, 0.1 * s, 0.14 * s, 0.1 * s, 0x3a2a1a, 0, -0.88 * s, 0);
    part(rig.sword, 0.13 * s, 0.05 * s, 0.12 * s, 0x887020, 0, -0.80 * s, 0);
    part(rig.sword, 0.4 * s, 0.07 * s, 0.1 * s, 0x887020, 0, -0.95 * s, 0);
    part(rig.sword, 0.08 * s, 1.2 * s * sl, 0.03 * s, 0xc0c4cc, 0, -(0.95 + 0.6 * sl) * s, 0, {});
    rig.armR.add(rig.sword);
  }
  if (o.pitchfork) {
    rig.pitchfork = new THREE.Group();
    part(rig.pitchfork, 0.06 * s, 1.45 * s, 0.06 * s, 0x5a3a1c, 0, -1.325 * s, 0);
    part(rig.pitchfork, 0.3 * s, 0.06 * s, 0.05 * s, 0x909090, 0, -2.05 * s, 0);
    for (let i = -1; i <= 1; i++) part(rig.pitchfork, 0.04 * s, 0.3 * s, 0.04 * s, 0x909090, i * 0.12 * s, -2.2 * s, 0);
    rig.armR.add(rig.pitchfork);
  }
  if (o.shield) {
    rig.shield = new THREE.Group();
    part(rig.shield, 0.1 * s, 1.5 * s, 1.0 * s, o.shield, 0.0, -0.7 * s, 0.1 * s);
    part(rig.shield, 0.12 * s, 0.3 * s, 0.3 * s, 0xc9a227, 0.0, -0.7 * s, 0.1 * s);
    rig.armL.add(rig.shield);
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
    rig.heart = bioHeart(1.7 * s);
    rig.heart.position.set(0, 0.12 * s, 0.25 * s);
    rig.torso.add(rig.heart);
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
  rig.cross = new THREE.Group();
  rig.cross.position.set(0.9, 1.4, 0.2);
  part(rig.cross, 0.1, 0.9, 0.1, 0xc9a227, 0, 0, 0);
  part(rig.cross, 0.4, 0.1, 0.1, 0xc9a227, 0, 0.3, 0);
  root.add(rig.cross);
  return rig;
}

const SKIN_N = 0x5a3820;
const SKIN_HI = 0x6d462a;
const SKIN_SH = 0x462a16;

function buildRosary(scale) {
  const s = scale || 1;
  const root = new THREE.Group();
  const segments = [];
  // Pulseira de contas ao redor do pulso
  const beadCount = 12;
  const rx = 0.20 * s, rz = 0.20 * s;
  for (let i = 0; i < beadCount; i++) {
    const ang = (i / beadCount) * Math.PI * 2;
    const col = (i % 3 === 0) ? 0xd4a017 : 0x5c1018;
    const b = part(root, 0.044 * s, 0.044 * s, 0.044 * s, col, Math.cos(ang) * rx, 0, Math.sin(ang) * rz, { em: i % 3 === 0 ? 0x3a2400 : 0x1a0204 });
    b.rotation.y = ang;
  }
  // Cadeia pendente articulada (5 elos + crucifixo na ponta)
  let parent = root;
  const stepY = -0.072 * s;
  for (let i = 0; i < 5; i++) {
    const piv = new THREE.Group();
    piv.position.set(i === 0 ? rx * 0.85 : 0, i === 0 ? -0.02 * s : stepY, 0);
    parent.add(piv);
    part(piv, 0.016 * s, 0.042 * s, 0.016 * s, 0xb8860b, 0, -0.021 * s, 0, { em: 0x2a1a00 });
    const col = (i === 4) ? 0xd4a017 : 0x701420;
    part(piv, 0.046 * s, 0.046 * s, 0.046 * s, col, 0, -0.052 * s, 0, { em: 0x240808 });
    segments.push(piv);
    parent = piv;
  }
  // Crucifixo sagrado na ponta
  const crossPiv = new THREE.Group();
  crossPiv.position.set(0, -0.075 * s, 0);
  parent.add(crossPiv);
  part(crossPiv, 0.032 * s, 0.16 * s, 0.024 * s, 0xe8b828, 0, -0.07 * s, 0, { em: 0x4a3000 });
  part(crossPiv, 0.11 * s, 0.032 * s, 0.024 * s, 0xe8b828, 0, -0.04 * s, 0, { em: 0x4a3000 });
  part(crossPiv, 0.036 * s, 0.036 * s, 0.030 * s, 0xfff0a0, 0, -0.04 * s, 0, { basic: true });
  segments.push(crossPiv);
  return { root, segments, cross: crossPiv };
}

function buildNivaldo() {
  const root = new THREE.Group();
  const scale = 1.28;
  root.scale.setScalar(scale);
  const rig = { root, h: 2.48 * scale };

  // Helper de spike (cone piramidal metálico) para as pulseiras
  const spikeGeo = new THREE.ConeGeometry(0.038, 0.115, 4);
  function addWristSpikes(parent, yPos, radius) {
    part(parent, 0.36, 0.15, 0.36, 0x161214, 0, yPos, 0);
    part(parent, 0.37, 0.03, 0.37, 0x3a3e46, 0, yPos + 0.055, 0);
    part(parent, 0.37, 0.03, 0.37, 0x3a3e46, 0, yPos - 0.055, 0);
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
    // Spikes diagonais extras para visual agressivo
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

  // JUNTAS 1 e 2: Pernas articuladas (quadril -> joelho -> tornozelo/bota) — Calça Preta + Botas de Metal
  const mkLeg = (side) => {
    const l = limb(root, 0.46, 0.48, 0.48, 0x0f0f14, side * 0.30, 0.98, 0);
    // Coxa musculosa com calça preta e dobra/costura sutil
    part(l, 0.48, 0.42, 0.50, 0x121218, 0, -0.22, 0.01);
    part(l, 0.10, 0.38, 0.52, 0x1a1a22, side * 0.16, -0.22, 0.01);

    // Joelho / Canela (joint filho)
    const knee = new THREE.Group();
    knee.position.set(0, -0.46, 0);
    l.add(knee);
    // Preenchimento articular do joelho (calça preta, evita vão ao dobrar)
    part(knee, 0.42, 0.16, 0.44, 0x0f0f14, 0, 0, 0);
    // Joelheira metálica blindada com rebite
    part(knee, 0.46, 0.20, 0.13, 0x5c6472, 0, -0.02, 0.23);
    part(knee, 0.34, 0.12, 0.06, 0x8892a4, 0, -0.02, 0.28);
    // Parte superior da canela (calça preta entrando no cano da bota)
    part(knee, 0.45, 0.14, 0.47, 0x111117, 0, -0.09, 0.01);
    // Cano metálico da bota (greva de aço com fivelas e placa frontal)
    part(knee, 0.50, 0.28, 0.52, 0x48505c, 0, -0.26, 0.02);
    part(knee, 0.38, 0.26, 0.10, 0x747e8e, 0, -0.26, 0.25);
    part(knee, 0.52, 0.05, 0.54, 0x2a2f38, 0, -0.15, 0.02);
    part(knee, 0.52, 0.04, 0.54, 0x1c1e24, 0, -0.27, 0.02);
    part(knee, 0.08, 0.06, 0.08, 0xb8c2d0, side * 0.24, -0.27, 0.10);

    // Tornozelo / Bota de Metal (joint neto)
    const foot = new THREE.Group();
    foot.position.set(0, -0.38, 0);
    knee.add(foot);
    // Articulação metálica do tornozelo
    part(foot, 0.44, 0.12, 0.46, 0x3c424d, 0, 0, 0.02);
    // Corpo principal da bota de metal
    part(foot, 0.52, 0.22, 0.60, 0x545d6b, 0, -0.01, 0.06);
    // Placa peito-do-pé + biqueira de aço polido reforçada
    part(foot, 0.44, 0.10, 0.30, 0x7a8494, 0, 0.06, 0.12);
    part(foot, 0.50, 0.16, 0.20, 0x8e98a8, 0, -0.02, 0.31);
    part(foot, 0.38, 0.08, 0.08, 0xb4becd, 0, 0.03, 0.38);
    // Sola pesada de metal escuro e calcanhar reforçado
    part(foot, 0.54, 0.07, 0.64, 0x20242c, 0, -0.12, 0.06);
    part(foot, 0.48, 0.12, 0.16, 0x6a7382, 0, -0.04, -0.22);
    return { leg: l, knee, foot };
  };
  const legL = mkLeg(-1), legR = mkLeg(1);
  rig.legL = legL.leg; rig.kneeL = legL.knee; rig.footL = legL.foot;
  rig.legR = legR.leg; rig.kneeR = legR.knee; rig.footR = legR.foot;

  // JUNTA 3: Cintura / Quadril (calça preta + cinto com tachas + fivela de caveira)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.98, 0);
  root.add(torsoGroup);
  rig.torsoGroup = torsoGroup;

  // Quadril da calça preta e cinto de couro preto com tachas metálicas
  part(torsoGroup, 0.98, 0.22, 0.58, 0x101015, 0, 0.10, 0);
  part(torsoGroup, 1.04, 0.14, 0.62, 0x0b0b0e, 0, 0.06, 0);
  for (const sx of [-0.38, -0.24, 0.24, 0.38]) {
    part(torsoGroup, 0.05, 0.05, 0.04, 0x9aa4b4, sx, 0.06, 0.31);
  }
  // Fivela de Caveira (placa metálica + crânio 3D detalhado)
  part(torsoGroup, 0.28, 0.20, 0.05, 0x424854, 0, 0.06, 0.31);
  part(torsoGroup, 0.24, 0.16, 0.04, 0x7e8796, 0, 0.06, 0.325);
  // Crânio da caveira (osso claro / prata fosca)
  part(torsoGroup, 0.15, 0.11, 0.06, 0xe2dcd0, 0, 0.085, 0.345);
  part(torsoGroup, 0.17, 0.06, 0.055, 0xd4cebf, 0, 0.065, 0.345);
  // Órbitas oculares e cavidade nasal
  part(torsoGroup, 0.042, 0.042, 0.03, 0x0e0a0c, -0.038, 0.078, 0.368, { basic: true });
  part(torsoGroup, 0.042, 0.042, 0.03, 0x0e0a0c, 0.038, 0.078, 0.368, { basic: true });
  part(torsoGroup, 0.028, 0.032, 0.03, 0x120c0e, 0, 0.048, 0.368, { basic: true });
  // Maxilar e dentes da caveira
  part(torsoGroup, 0.11, 0.045, 0.05, 0xcac3b4, 0, 0.015, 0.345);
  for (let tx = -0.036; tx <= 0.037; tx += 0.024) {
    part(torsoGroup, 0.016, 0.028, 0.025, 0xf4efe4, tx, 0.018, 0.365);
  }

  // Abdômen trincado (6-pack) + oblíquos
  rig.torso = part(torsoGroup, 0.96, 0.44, 0.56, SKIN_N, 0, 0.38, 0);
  for (let row = 0; row < 3; row++) {
    const ay = 0.46 - row * 0.12;
    part(torsoGroup, 0.18, 0.09, 0.06, SKIN_HI, -0.12, ay, 0.29);
    part(torsoGroup, 0.18, 0.09, 0.06, SKIN_HI, 0.12, ay, 0.29);
  }
  part(torsoGroup, 0.04, 0.38, 0.05, SKIN_SH, 0, 0.34, 0.295);

  // JUNTA 4: Meio do Peito / Coluna Torácica (pivô no plexo solar para arquear/torcer o tronco)
  const chestGroup = new THREE.Group();
  chestGroup.position.set(0, 0.52, 0);
  torsoGroup.add(chestGroup);
  rig.chestGroup = chestGroup;

  // Caixa torácica / dorsais imensas (silhueta larga em V)
  part(chestGroup, 1.38, 0.50, 0.68, SKIN_N, 0, 0.22, 0);
  // Peitorais enormes definidos
  part(chestGroup, 0.56, 0.34, 0.16, SKIN_HI, -0.32, 0.24, 0.30);
  part(chestGroup, 0.56, 0.34, 0.16, SKIN_HI, 0.32, 0.24, 0.30);
  part(chestGroup, 0.05, 0.32, 0.14, SKIN_SH, 0, 0.24, 0.32);
  // Costas / dorsais saltadas
  part(chestGroup, 1.30, 0.44, 0.14, SKIN_SH, 0, 0.22, -0.32);

  // TRAPÉZIO IMENSO (sobe dos ombros até a base da cabeça, estilo Space Marine)
  const trapL = part(chestGroup, 0.56, 0.34, 0.54, SKIN_N, -0.34, 0.50, -0.02);
  trapL.rotation.z = 0.28;
  const trapR = part(chestGroup, 0.56, 0.34, 0.54, SKIN_N, 0.34, 0.50, -0.02);
  trapR.rotation.z = -0.28;
  part(chestGroup, 0.64, 0.26, 0.50, SKIN_HI, 0, 0.50, -0.04);
  // Pescoço de touro curto e grosso
  part(chestGroup, 0.42, 0.18, 0.42, SKIN_SH, 0, 0.60, 0.02);

  // Pequena placa peitoral estilo He-Man + arnês em X + Cruz de Jesus no meio
  const strapL = part(chestGroup, 0.11, 0.78, 0.72, 0x24160e, -0.24, 0.18, 0);
  strapL.rotation.z = -0.48;
  const strapR = part(chestGroup, 0.11, 0.78, 0.72, 0x24160e, 0.24, 0.18, 0);
  strapR.rotation.z = 0.48;
  // Placa peitoral compacta central
  part(chestGroup, 0.44, 0.38, 0.10, 0x383e48, 0, 0.22, 0.36);
  part(chestGroup, 0.36, 0.30, 0.04, 0x22262e, 0, 0.22, 0.40);
  // Cruz de Jesus dourada no centro da placa
  part(chestGroup, 0.075, 0.26, 0.05, 0xd4a017, 0, 0.21, 0.425, { em: 0x4a3200 });
  part(chestGroup, 0.19, 0.065, 0.05, 0xd4a017, 0, 0.25, 0.425, { em: 0x4a3200 });

  // JUNTA 5: Cabeça (pivô na base do pescoço para expressividade) com rosto de FÚRIA extrema
  const head = new THREE.Group();
  head.position.set(0, 0.64, 0.02);
  chestGroup.add(head);
  rig.head = head;

  part(head, 0.48, 0.48, 0.48, SKIN_N, 0, 0.18, 0);
  // Mandíbula quadrada e pesada
  part(head, 0.50, 0.16, 0.49, SKIN_SH, 0, 0.02, 0.02);
  // Mullet irado dos anos 80 (volume no topo/franja + costeletas + cascata atrás)
  const HAIR_BASE = 0x1a0e07;
  const HAIR_HI = 0x2f1b0e;
  const HAIR_SH = 0x110904;
  // Topo volumoso e repicado
  part(head, 0.52, 0.14, 0.52, HAIR_BASE, 0, 0.42, -0.02);
  part(head, 0.44, 0.10, 0.42, HAIR_HI, 0, 0.48, -0.01);
  // Topete / franja jogada para trás estilo 80s
  const crestL = part(head, 0.22, 0.09, 0.22, HAIR_HI, -0.10, 0.47, 0.14);
  crestL.rotation.x = -0.22; crestL.rotation.z = 0.12;
  const crestR = part(head, 0.22, 0.09, 0.22, HAIR_BASE, 0.10, 0.47, 0.14);
  crestR.rotation.x = -0.22; crestR.rotation.z = -0.12;
  // Costeletas marcadas nas laterais do rosto
  part(head, 0.08, 0.24, 0.14, HAIR_BASE, -0.24, 0.24, 0.08);
  part(head, 0.08, 0.24, 0.14, HAIR_BASE, 0.24, 0.24, 0.08);
  // Parte de trás do mullet (camadas longas descendo pela nuca e ombros)
  const mulletTop = part(head, 0.54, 0.34, 0.16, HAIR_BASE, 0, 0.22, -0.26);
  mulletTop.rotation.x = 0.12;
  const mulletMid = part(head, 0.62, 0.38, 0.14, HAIR_SH, 0, -0.04, -0.32);
  mulletMid.rotation.x = 0.22;
  const mulletLow = part(head, 0.68, 0.30, 0.11, HAIR_BASE, 0, -0.26, -0.38);
  mulletLow.rotation.x = 0.28;
  // Mechas laterais e pontas repicadas do mullet
  for (const sx of [-1, 1]) {
    const sideLock = part(head, 0.16, 0.46, 0.14, HAIR_HI, sx * 0.26, 0.04, -0.24);
    sideLock.rotation.z = -sx * 0.14;
    sideLock.rotation.x = 0.18;
    const tipLock = part(head, 0.14, 0.22, 0.09, HAIR_HI, sx * 0.24, -0.30, -0.40);
    tipLock.rotation.z = -sx * 0.20;
    tipLock.rotation.x = 0.30;
  }
  const centerTip = part(head, 0.24, 0.18, 0.09, HAIR_HI, 0, -0.36, -0.42);
  centerTip.rotation.x = 0.32;
  // Orelhas
  part(head, 0.06, 0.14, 0.10, SKIN_SH, -0.26, 0.18, 0);
  part(head, 0.06, 0.14, 0.10, SKIN_SH, 0.26, 0.18, 0);
  // Sobrancelhas grossas muito franzidas em V (fúria!)
  const browL = part(head, 0.17, 0.055, 0.06, 0x140804, -0.11, 0.28, 0.245);
  browL.rotation.z = -0.34;
  const browR = part(head, 0.17, 0.055, 0.06, 0x140804, 0.11, 0.28, 0.245);
  browR.rotation.z = 0.34;
  // Ruga de raiva entre as sobrancelhas
  part(head, 0.04, 0.08, 0.03, SKIN_SH, 0, 0.26, 0.248);
  // Olhos semicerrados pela fúria (brilham dourado no Modo Super-Fé)
  rig.eyeL = part(head, 0.10, 0.048, 0.02, 0xf0e6d0, -0.11, 0.215, 0.245, { basic: true });
  rig.eyeR = part(head, 0.10, 0.048, 0.02, 0xf0e6d0, 0.11, 0.215, 0.245, { basic: true });
  part(head, 0.045, 0.042, 0.025, 0x100808, -0.105, 0.215, 0.252, { basic: true });
  part(head, 0.045, 0.042, 0.025, 0x100808, 0.105, 0.215, 0.252, { basic: true });
  // Nariz largo
  part(head, 0.09, 0.10, 0.07, SKIN_SH, 0, 0.15, 0.255);
  // Boca aberta rosnando com dentes cerrados!
  part(head, 0.24, 0.095, 0.04, 0x1c0204, 0, 0.04, 0.245, { basic: true });
  part(head, 0.20, 0.028, 0.045, 0xf2ece0, 0, 0.068, 0.248, { basic: true });
  part(head, 0.20, 0.025, 0.045, 0xe8e0d0, 0, 0.014, 0.248, { basic: true });

  // JUNTAS 6..11: Clavícula/Ombro -> Braço -> Cotovelo/Antebraço -> Punho/Mão (silhueta Space Marine, pulseiras de spike)
  const mkArm = (side) => {
    // Articulação de ombro/clavícula (permite encolher/projetar o ombro)
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.62, 0.36, 0);
    chestGroup.add(shoulder);
    // Ponte muscular entre peito/trapézio e deltoide (evita vão ao mover o ombro)
    part(shoulder, 0.26, 0.28, 0.34, SKIN_N, side * 0.08, -0.04, 0);

    // Braço superior (upper arm)
    const arm = limb(shoulder, 0.36, 0.48, 0.36, SKIN_N, side * 0.24, 0, 0);
    // Deltoide gigante (dá a largura de ombro de Space Marine)
    part(arm, 0.44, 0.34, 0.44, SKIN_HI, side * 0.02, -0.10, 0);
    part(arm, 0.40, 0.26, 0.40, SKIN_N, 0, -0.32, 0.01);

    // Cotovelo / Antebraço (joint filho)
    const forearm = new THREE.Group();
    forearm.position.set(0, -0.46, 0);
    arm.add(forearm);
    // Preenchimento articular do cotovelo (evita vão em flexões profundas)
    part(forearm, 0.30, 0.16, 0.30, SKIN_N, 0, 0, 0);
    // Antebraço grosso + destaque muscular
    part(forearm, 0.34, 0.44, 0.34, SKIN_N, 0, -0.22, 0);
    part(forearm, 0.22, 0.36, 0.36, SKIN_HI, 0, -0.20, 0.02);
    // Pulseira de spike pesada
    addWristSpikes(forearm, -0.36, 0.21);

    // Punho / Mão (joint neto)
    const hand = new THREE.Group();
    hand.position.set(0, -0.44, 0);
    forearm.add(hand);
    // Punho cerrado enorme
    part(hand, 0.33, 0.23, 0.33, SKIN_N, 0, -0.06, 0);
    part(hand, 0.34, 0.07, 0.34, SKIN_SH, 0, -0.08, 0.02);
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

  // Prop 3D: Martelo de Obras na mão direita (anexado ao punho direito)
  const hammer = new THREE.Group();
  hammer.position.set(0, -0.08, 0.06);
  hammer.rotation.x = Math.PI * 0.5;
  part(hammer, 0.08, 0.76, 0.08, 0x6a4420, 0, 0.24, 0);
  part(hammer, 0.18, 0.22, 0.40, 0x70747c, 0, 0.64, 0);
  part(hammer, 0.20, 0.24, 0.10, 0x45484e, 0, 0.64, -0.21);
  hammer.visible = false;
  rig.handR.add(hammer);
  rig.hammer = hammer;

  // Prop 3D: Coração Ateu na mão direita (visível ao arrancar de Galius)
  const heart = bioHeart(2.2);
  heart.position.set(0, -0.14, 0.14);
  heart.visible = false;
  rig.handR.add(heart);
  rig.heart = heart;

  // Prop 3D: Super-Cruz Dourada gigante do Galius na mão direita (visível ao golpear Galius)
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

  // Prop 3D: Rosário sagrado no pulso direito (visível após derrotar Maximus)
  const rosary = buildRosary(0.95);
  rosary.root.position.set(0, -0.34, 0);
  rosary.root.visible = false;
  rig.forearmR.add(rosary.root);
  rig.rosary = rosary;

  // Prop 3D: Rosário segurado/apertado na mão direita durante a cutscene
  const handRosary = buildRosary(0.78);
  handRosary.root.position.set(0, -0.06, 0.08);
  handRosary.root.visible = false;
  rig.handR.add(handRosary.root);
  rig.handRosary = handRosary.root;

  return rig;
}

function buildGalius() {
  const s = 2.9, w = 1.3;
  const root = new THREE.Group();
  const rig = { root, h: 2.35 * s };
  const SKIN_G = 0xd6dce2, SKIN_SH = 0xb4bcc6, FLESH_G = 0x721820, RAGS_G = 0x262830, BONE_G = 0xb8ae9a, CHAIN_G = 0x42444e;

  // Pernas pálidas, inchadas e deformadas com trapos escuros e ossos expostos
  rig.legL = limb(root, 0.36 * s * w, 0.95 * s, 0.38 * s, SKIN_G, -0.22 * s * w, 0.95 * s, 0);
  rig.legR = limb(root, 0.32 * s * w, 0.95 * s, 0.34 * s, SKIN_G, 0.22 * s * w, 0.95 * s, 0);
  part(rig.legL, 0.42 * s * w, 0.34 * s, 0.44 * s, RAGS_G, 0, -0.52 * s, 0);
  part(rig.legR, 0.38 * s * w, 0.40 * s, 0.40 * s, RAGS_G, 0, -0.46 * s, 0);
  // Nódulos de carne e estilhaços de osso nos joelhos
  const kBoneL = part(rig.legL, 0.10 * s, 0.22 * s, 0.10 * s, BONE_G, -0.05 * s, -0.36 * s, 0.20 * s);
  kBoneL.rotation.x = 0.6;
  part(rig.legR, 0.16 * s, 0.18 * s, 0.16 * s, FLESH_G, 0.08 * s, -0.34 * s, 0.15 * s);

  // Torso branco-cadavérico inchado e assimétrico com cavidade aberta no peito
  rig.torso = part(root, 0.88 * s * w, 0.96 * s, 0.48 * s, SKIN_G, 0, 1.40 * s, 0);
  // Massa tumoral assimétrica no ombro/peito esquerdo e carne viva exposta
  part(rig.torso, 0.42 * s, 0.44 * s, 0.44 * s, SKIN_SH, -0.36 * s, 0.28 * s, 0.02 * s);
  part(rig.torso, 0.28 * s, 0.28 * s, 0.28 * s, FLESH_G, -0.44 * s, 0.36 * s, 0.08 * s);
  part(rig.torso, 0.34 * s, 0.24 * s, 0.30 * s, SKIN_SH, 0.32 * s, -0.18 * s, 0.12 * s);
  // Cavidade torácica aberta com costelas quebradas ao redor do Coração Ateu
  part(rig.torso, 0.54 * s, 0.54 * s, 0.09 * s, 0x220408, 0, 0.12 * s, 0.22 * s);
  for (let i = -1; i <= 1; i += 2) {
    const r1 = part(rig.torso, 0.20 * s, 0.06 * s, 0.07 * s, BONE_G, i * 0.22 * s, 0.24 * s, 0.25 * s);
    r1.rotation.z = i * 0.18;
    const r2 = part(rig.torso, 0.18 * s, 0.06 * s, 0.07 * s, BONE_G, i * 0.23 * s, 0.09 * s, 0.25 * s);
    r2.rotation.z = i * -0.10;
    const r3 = part(rig.torso, 0.15 * s, 0.055 * s, 0.07 * s, BONE_G, i * 0.19 * s, -0.05 * s, 0.25 * s);
    r3.rotation.z = i * -0.22;
  }
  // Coração Ateu biológico encravado no peito
  rig.heart = bioHeart(2.0 * s);
  rig.heart.position.set(0, 0.12 * s, 0.25 * s);
  rig.torso.add(rig.heart);

  // Correntes enferrujadas e trapos rasgados na cintura
  part(root, 0.94 * s * w, 0.08 * s, 0.52 * s, CHAIN_G, 0, 1.54 * s, 0);
  part(root, 0.96 * s * w, 0.12 * s, 0.54 * s, RAGS_G, 0, 1.02 * s, 0);
  part(root, 0.94 * s * w, 0.08 * s, 0.52 * s, CHAIN_G, 0, 1.22 * s, 0);

  // Vértebras tortas e estilhaços de osso rasgando as costas (sem asas de demônio)
  for (let i = 0; i < 5; i++) {
    const sp = part(rig.torso, 0.10 * s, 0.24 * s, 0.12 * s, BONE_G, (i % 2 === 0 ? -0.04 : 0.05) * s, (0.38 - i * 0.18) * s, -0.27 * s);
    sp.rotation.x = -0.45 - (i % 2) * 0.25;
    sp.rotation.z = (i % 2 === 0 ? 0.15 : -0.18);
  }
  const backShard = part(rig.torso, 0.12 * s, 0.42 * s, 0.12 * s, BONE_G, -0.28 * s, 0.32 * s, -0.24 * s);
  backShard.rotation.set(-0.5, 0, 0.38);

  // Cabeça humanoide pálida, sem alma e deformada: órbitas ocas negras e mandíbula escancarada
  rig.head = part(root, 0.46 * s, 0.52 * s, 0.46 * s, SKIN_G, 0, 2.12 * s, 0.03 * s);
  // Crânio calvo com protuberância óssea assimétrica e carne exposta na têmpora
  part(rig.head, 0.18 * s, 0.18 * s, 0.18 * s, FLESH_G, -0.20 * s, 0.18 * s, -0.04 * s);
  const skullBone = part(rig.head, 0.08 * s, 0.20 * s, 0.08 * s, BONE_G, -0.18 * s, 0.26 * s, 0.04 * s);
  skullBone.rotation.z = 0.45;
  // Órbitas oculares ocas e fundas com minúsculos pontos sem vida
  part(rig.head, 0.13 * s, 0.11 * s, 0.03 * s, 0x050508, -0.11 * s, 0.06 * s, 0.232 * s, { basic: true });
  part(rig.head, 0.13 * s, 0.11 * s, 0.03 * s, 0x050508, 0.11 * s, 0.06 * s, 0.232 * s, { basic: true });
  part(rig.head, 0.035 * s, 0.035 * s, 0.035 * s, 0xd82028, -0.11 * s, 0.06 * s, 0.242 * s, { basic: true });
  part(rig.head, 0.035 * s, 0.035 * s, 0.035 * s, 0xd82028, 0.11 * s, 0.06 * s, 0.242 * s, { basic: true });
  // Mandíbula deslocada e escancarada com dentes irregulares
  part(rig.head, 0.26 * s, 0.15 * s, 0.05 * s, 0x160204, 0, -0.12 * s, 0.235 * s, { basic: true });
  for (const fx of [-0.09, -0.04, 0.01, 0.06, 0.10]) {
    part(rig.head, 0.028 * s, 0.05 * s, 0.03 * s, BONE_G, fx * s, -0.07 * s, 0.242 * s, { basic: true });
  }
  for (const fx of [-0.07, -0.01, 0.05]) {
    part(rig.head, 0.028 * s, 0.045 * s, 0.03 * s, BONE_G, fx * s, -0.17 * s, 0.242 * s, { basic: true });
  }

  // Braços assimétricos de aberração: esquerdo inchado com garras; direito esquelético segurando a cruz
  rig.armL = limb(root, 0.30 * s * w, 0.96 * s, 0.30 * s, SKIN_G, -0.62 * s * w, 1.84 * s, 0);
  part(rig.armL, 0.36 * s * w, 0.38 * s, 0.36 * s, FLESH_G, -0.04 * s, -0.34 * s, 0);
  for (let c = -1; c <= 1; c++) {
    part(rig.armL, 0.05 * s, 0.24 * s, 0.05 * s, BONE_G, c * 0.09 * s, -1.04 * s, 0.06 * s);
  }

  rig.armR = limb(root, 0.22 * s * w, 0.90 * s, 0.22 * s, SKIN_G, 0.58 * s * w, 1.80 * s, 0);
  part(rig.armR, 0.26 * s * w, 0.16 * s, 0.26 * s, CHAIN_G, 0, -0.70 * s, 0);

  // Super-Cruz Dourada gigante (segurada na horizontal em duas mãos, como martelo de obra)
  part(rig.armR, 0.12 * s, 0.14 * s, 0.12 * s, 0x5a3820, 0, -0.92 * s, 0);
  rig.weapon = new THREE.Group();
  rig.weapon.position.set(0, -0.92 * s, 0.08 * s);
  part(rig.weapon, 0.28 * s, 3.4 * s, 0.28 * s, 0xd4a017, 0, -0.75 * s, 0, { em: 0x3a2800 });
  part(rig.weapon, 1.5 * s, 0.28 * s, 0.28 * s, 0xd4a017, 0, -1.65 * s, 0, { em: 0x3a2800 });
  part(rig.weapon, 0.34 * s, 0.34 * s, 0.34 * s, 0xfff0a0, 0, -1.65 * s, 0, { basic: true });
  rig.weapon.rotation.z = -1.21;
  rig.armR.add(rig.weapon);
  rig.armL.rotation.set(-1.12, 0, 0.52);
  rig.armR.rotation.set(-1.12, 0, -0.36);

  return rig;
}

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

  // Pernas esguias blindadas (grevas escuras + joelheiras pontudas + solas carmesim)
  const mkLeg = (side) => {
    const l = limb(root, 0.28, 0.98, 0.28, ARMOR_DARK, side * 0.20, 1.02, 0);
    // Coxote segmentado
    part(l, 0.30, 0.42, 0.32, ARMOR_MID, 0, -0.22, 0);
    part(l, 0.22, 0.36, 0.06, ARMOR_HI, 0, -0.22, 0.16);
    // Joelheira pontuda
    const knee = part(l, 0.26, 0.18, 0.12, ARMOR_HI, 0, -0.48, 0.16);
    knee.rotation.x = -0.25;
    part(l, 0.08, 0.14, 0.08, ARMOR_HI, side * 0.14, -0.46, 0.06);
    // Greva esguia
    part(l, 0.26, 0.44, 0.28, ARMOR_DARK, 0, -0.74, 0);
    part(l, 0.16, 0.38, 0.06, ARMOR_HI, 0, -0.74, 0.14);
    // Sabaton pontudo + detalhe carmesim na sola
    part(l, 0.24, 0.12, 0.38, ARMOR_MID, 0, -0.95, 0.07);
    part(l, 0.25, 0.03, 0.40, 0xaa141c, 0, -1.01, 0.07, { em: 0x3a0408 });
    return l;
  };
  rig.legL = mkLeg(-1);
  rig.legR = mkLeg(1);

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

  // Braços com ombreiras pontudas (spiked pauldrons), manoplas com garras e correntes
  const mkArm = (side) => {
    const a = limb(root, 0.24, 0.86, 0.24, ARMOR_DARK, side * 0.44, 1.84, 0);
    // Ombreira angular pontuda estilo cavaleiro sombrio
    const pauldron = part(a, 0.38, 0.22, 0.38, ARMOR_MID, side * 0.06, -0.02, 0);
    pauldron.rotation.z = side * -0.26;
    const spike = part(a, 0.22, 0.10, 0.24, ARMOR_HI, side * 0.24, 0.08, 0);
    spike.rotation.z = side * -0.45;
    // Braçadeira pontuda no cotovelo/antebraço
    part(a, 0.26, 0.38, 0.26, ARMOR_MID, 0, -0.52, 0);
    const elbowSpike = part(a, 0.08, 0.22, 0.10, ARMOR_HI, side * 0.12, -0.42, -0.12);
    elbowSpike.rotation.x = -0.45;
    // Manopla com garras
    part(a, 0.22, 0.18, 0.22, ARMOR_HI, 0, -0.78, 0.02);
    // Correntes penduradas no pulso
    part(a, 0.03, 0.22, 0.03, CHAIN_COL, side * 0.12, -0.82, 0.04);
    return a;
  };
  rig.armL = mkArm(-1);
  rig.armR = mkArm(1);

  // Espada Flamberge detalhada na mão direita
  const swordObj = buildMaximusSword();
  swordObj.root.position.set(0, -0.86, 0.08);
  swordObj.root.rotation.x = Math.PI * 0.48;
  rig.armR.add(swordObj.root);
  rig.sword = swordObj.root;
  rig.swordGlowMats = swordObj.glowMats;

  // Prop do rosário na mão esquerda (visível apenas na cutscene de morte ao entregar para Nivaldo)
  const rosaryProp = buildRosary(0.75);
  rosaryProp.root.position.set(0, -0.86, 0.12);
  rosaryProp.root.visible = false;
  rig.armL.add(rosaryProp.root);
  rig.rosaryProp = rosaryProp.root;

  return rig;
}

const BUILD = {
  nivaldo: buildNivaldo,
  campones() {
    return humanoid({ skin: 0x6d7f5d, cloth: 0x5a3d22, legs: 0x3b2a1a, scale: 0.85, armsFwd: true, eyes: 0xff2200, pitchfork: Math.random() < 0.4 });
  },
  camponesVivo(v) {
    const skins = [0xdba882, 0xc68e68, 0xe0b494, 0x9c6a48];
    const cloths = [0x4e6b48, 0x8c6239, 0x4a6478, 0xa87c38, 0x7a4838];
    const legsCols = [0x3b2e22, 0x2e343b, 0x423224, 0x362a1e];
    const idx = (v != null ? v : Math.floor(Math.random() * 12));
    const s = 0.86;
    const rig = humanoid({
      skin: skins[idx % skins.length],
      cloth: cloths[idx % cloths.length],
      legs: legsCols[idx % legsCols.length],
      scale: s,
      armsFwd: false,
      eyes: null
    });
    if (idx % 2 === 0) {
      part(rig.head, 0.72 * s, 0.06 * s, 0.72 * s, 0xd4b254, 0, 0.22 * s, 0);
      part(rig.head, 0.46 * s, 0.16 * s, 0.46 * s, 0xc4a042, 0, 0.31 * s, 0);
      part(rig.head, 0.48 * s, 0.04 * s, 0.48 * s, 0x6a3818, 0, 0.25 * s, 0);
    } else {
      part(rig.head, 0.48 * s, 0.16 * s, 0.48 * s, 0x4a321e, 0, 0.22 * s, -0.02 * s);
    }
    return rig;
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
  maximus: buildMaximus,
  galius: buildGalius
};

/* ---------------- viewmodels (armas na mão) ---------------- */
function buildViewmodels() {
  const VM = {};
  Object.defineProperty(VM, '_rosaries', { value: [], enumerable: false });

  const vmSpikeGeo = new THREE.ConeGeometry(0.024, 0.088, 4);

  function addArm(parent, x, y, z, o) {
    o = o || {};
    const w = o.w || 0.25, h = o.h || 0.23, len = o.len || 0.56;
    const g = new THREE.Group();
    g.userData.isArm = true;
    g.position.set(x, y, z);
    if (o.rot) g.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
    // Antebraço grosso e super bombado
    part(g, w, h, len, SKIN_N, 0, 0, 0);
    // Cristas musculares superiores (highlight) e tendão lateral
    part(g, w * 0.68, 0.042, len * 0.84, SKIN_HI, 0, h * 0.5 + 0.01, -len * 0.04);
    part(g, 0.035, h * 0.58, len * 0.76, SKIN_SH, -w * 0.48, 0, -len * 0.03);
    part(g, 0.035, h * 0.58, len * 0.76, SKIN_SH, w * 0.48, 0, -len * 0.03);
    // Bíceps nu e massivo atrás (sem manga de camisa)
    part(g, w * 1.24, h * 1.22, len * 0.56, SKIN_N, 0, 0.01, len * 0.44);
    part(g, w * 0.90, 0.04, len * 0.42, SKIN_HI, 0, h * 0.61 + 0.01, len * 0.44);
    // Pulseira de spike pesada POR CIMA do antebraço e dos músculos
    const wz = -len * 0.42;
    part(g, w * 1.22, h * 1.24, 0.12, 0x161214, 0, 0, wz);
    part(g, w * 1.25, h * 1.27, 0.022, 0x3a3e46, 0, 0, wz - 0.052);
    part(g, w * 1.25, h * 1.27, 0.022, 0x3a3e46, 0, 0, wz + 0.052);
    // Spikes no topo e nas laterais bem acima da pulseira
    const topY = h * 0.62 + 0.042;
    for (let sx = -1; sx <= 1; sx++) {
      const sp = new THREE.Mesh(vmSpikeGeo, MT(0xd0d6e0));
      sp.position.set(sx * w * 0.36, topY, wz);
      g.add(sp);
    }
    const sideX = w * 0.61 + 0.042;
    for (let sd = -1; sd <= 1; sd += 2) {
      const sp = new THREE.Mesh(vmSpikeGeo, MT(0xc0c6d0));
      sp.position.set(sd * sideX, 0, wz);
      sp.rotation.z = -sd * Math.PI / 2;
      g.add(sp);
    }
    // Rosário sagrado no pulso direito (1ª pessoa, visível após derrotar Maximus)
    if (!o.noRosary) {
      const ros = buildRosary((w / 0.25) * 0.76);
      ros.root.rotation.x = Math.PI / 2;
      ros.root.position.set(0, 0.02, wz - 0.075);
      ros.root.visible = false;
      g.add(ros.root);
      VM._rosaries.push(ros);
    }
    // Cicatriz de batalha opcional
    if (o.scar) {
      const sc = part(g, 0.028, 0.018, 0.20, 0x7c3428, -w * 0.18, h * 0.5 + 0.032, -len * 0.08);
      sc.rotation.y = 0.22;
      part(g, 0.06, 0.018, 0.014, 0x3a1810, -w * 0.16, h * 0.5 + 0.034, -len * 0.12);
      part(g, 0.06, 0.018, 0.014, 0x3a1810, -w * 0.20, h * 0.5 + 0.034, -len * 0.04);
    }
    parent.add(g);
    return g;
  }

  function addGrip(parent, x, y, z, o) {
    o = o || {};
    const s = o.scale || 1;
    const g = new THREE.Group();
    g.userData.isArm = true;
    g.position.set(x, y, z);
    part(g, 0.21 * s, 0.21 * s, 0.21 * s, SKIN_N, 0, 0, 0);
    // Nós dos dedos cerrados e calos
    part(g, 0.22 * s, 0.055 * s, 0.09 * s, SKIN_HI, 0, 0.085 * s, -0.05 * s);
    part(g, 0.19 * s, 0.08 * s, 0.06 * s, SKIN_SH, 0, -0.04 * s, -0.105 * s);
    part(g, 0.075 * s, 0.085 * s, 0.13 * s, SKIN_N, -0.11 * s, 0.03 * s, -0.03 * s);
    parent.add(g);
    return g;
  }

  // 1 - Punhos (muito bombados, sem manga, com pulseiras de spike)
  {
    const root = new THREE.Group();
    const mk = (side) => {
      const g = new THREE.Group();
      addArm(g, 0, -0.01, 0.34, { w: 0.27, h: 0.25, len: 0.58, scar: side === 1, noRosary: true });
      // Punho massivo estilo Space Marine
      part(g, 0.29, 0.26, 0.26, SKIN_N, 0, 0.01, -0.06);
      part(g, 0.27, 0.13, 0.09, SKIN_SH, 0, -0.06, -0.185);
      part(g, 0.295, 0.065, 0.11, SKIN_HI, 0, 0.12, -0.11);
      // 4 nós dos dedos marcados (calejados/manchados)
      for (let k = -1.5; k <= 1.5; k += 1) {
        part(g, 0.055, 0.048, 0.055, 0x5c2c1c, k * 0.065, 0.138, -0.14);
      }
      // Faixa/atadura de combate escura nos nós
      part(g, 0.304, 0.09, 0.12, 0x1e1614, 0, 0.02, -0.04);
      // Polegar grosso
      part(g, 0.11, 0.12, 0.18, SKIN_N, -side * 0.155, 0.04, -0.05);
      part(g, 0.095, 0.06, 0.08, SKIN_HI, -side * 0.155, 0.07, -0.11);
      // Rosário enrolado na mão/pulso direito (bem visível na câmera em 1ª pessoa!)
      if (side === 1) {
        const ros = buildRosary(0.76);
        ros.root.rotation.set(Math.PI / 2, 0, 0.22);
        ros.root.position.set(-0.02, 0.06, -0.01);
        ros.root.visible = false;
        g.add(ros.root);
        VM._rosaries.push(ros);
      }
      g.position.set(side * 0.48, -0.36, -0.60);
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
    addArm(root, -0.19, 0.12, 0.25, { w: 0.19, h: 0.19, len: 0.50, rot: [0.22, -0.65, 0], noRosary: true });
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
  // 7 - Coração Ateu (seguro e apertado com as duas mãos)
  {
    const root = new THREE.Group();
    root.heart = bioHeart(0.95);
    root.heart.position.y = 0.085; root.add(root.heart);

    const mkHeartHand = (side) => {
      const hg = new THREE.Group();
      // Palma lateral envolvendo o coração
      part(hg, 0.075, 0.14, 0.18, SKIN_N, side * 0.095, 0.06, 0);
      // Dedos curvados na frente/lateral
      part(hg, 0.06, 0.12, 0.055, SKIN_SH, side * 0.068, 0.075, -0.092);
      // Polegar por cima
      part(hg, 0.055, 0.055, 0.11, SKIN_HI, side * 0.085, 0.135, -0.01);
      // Antebraço vindo do lado correspondente
      addArm(hg, side * 0.17, -0.08, 0.30, { w: 0.19, h: 0.18, len: 0.50, rot: [0.16, side * 0.42, 0], scar: side === 1, noRosary: side !== 1 });
      hg.userData.base = hg.position.clone();
      root.add(hg);
      return hg;
    };
    root.handL = mkHeartHand(-1);
    root.handR = mkHeartHand(1);

    root.position.set(0, -0.35, -0.72); root.rotation.set(-0.22, 0, 0);
    root.userData.base = { p: root.position.clone(), r: root.rotation.clone() };
    VM.heart = { root };
  }
  // Bota de chute (Glory Kill) — Calça Preta + Bota de Metal
  {
    const root = new THREE.Group();
    // Perna da calça preta
    part(root, 0.24, 0.24, 0.72, 0x101015, 0, -0.02, 0.28);
    part(root, 0.06, 0.25, 0.68, 0x1a1a22, 0.10, -0.02, 0.28);
    // Cano metálico da bota com tira e fivela
    part(root, 0.24, 0.24, 0.24, 0x48505c, 0, -0.01, -0.14);
    part(root, 0.25, 0.25, 0.045, 0x1c1e24, 0, -0.01, -0.09);
    part(root, 0.16, 0.05, 0.18, 0x747e8e, 0, 0.11, -0.14);
    // Corpo da bota de metal e biqueira de aço polido
    part(root, 0.25, 0.34, 0.16, 0x545d6b, 0, 0.08, -0.26);
    part(root, 0.24, 0.19, 0.15, 0x8e98a8, 0, 0.20, -0.27);
    part(root, 0.18, 0.08, 0.06, 0xb4becd, 0, 0.25, -0.32);
    // Sola pesada de metal escuro
    part(root, 0.26, 0.37, 0.06, 0x1c2026, 0, 0.07, -0.35);
    root.position.set(0.08, -0.68, -0.58); root.rotation.set(0.2, 0, 0);
    root.userData.base = { p: root.position.clone(), r: root.rotation.clone() };
    VM.kick = { root };
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

// Pulso biológico em dois tempos (sístole "lub" + diástole "dub")
function heartPulse(t) {
  const ph = ((t % 1) + 1) % 1;
  const lub = ph < 0.22 ? Math.pow(Math.sin((ph / 0.22) * Math.PI), 1.4) : 0;
  const dub = (ph > 0.26 && ph < 0.44) ? 0.65 * Math.pow(Math.sin(((ph - 0.26) / 0.18) * Math.PI), 1.7) : 0;
  return Math.max(lub, dub);
}
