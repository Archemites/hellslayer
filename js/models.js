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

const SKIN_N = 0x8b5a3c;
const SKIN_HI = 0xa36e4b;
const SKIN_SH = 0x6c422a;

function buildRosary(scale, opts) {
  const s = scale || 1;
  opts = opts || {};
  const ps = s * (opts.pendantScale || 1);
  const root = new THREE.Group();
  const segments = [];

  // Paleta toda dourada (contas polidas, elos em ouro antigo, relevo brilhante)
  const GOLD_BEAD = 0xf4c542;
  const GOLD_MID = 0xd4a017;
  const GOLD_CHAIN = 0x9e720a;
  const GOLD_CORPUS = 0xffe27a;
  const GOLD_RECESS = 0x6e4a04;

  const beadGeo = new THREE.SphereGeometry(0.022 * s, 7, 6);
  const pBeadGeo = opts.pendantScale ? new THREE.SphereGeometry(0.025 * ps, 7, 6) : beadGeo;
  const linkGeo = new THREE.CylinderGeometry(0.0048 * s, 0.0048 * s, 1, 5);
  const beadMat = MT(GOLD_BEAD, { em: 0x3a2800 });
  const linkMat = MT(GOLD_CHAIN, { em: 0x160e00 });

  const addBead = (parent, x, y, z, rScale, geo) => {
    const m = new THREE.Mesh(geo || beadGeo, beadMat);
    m.position.set(x, y, z);
    if (rScale && rScale !== 1) m.scale.setScalar(rScale);
    parent.add(m);
    return m;
  };

  const addLink = (parent, x1, y1, z1, x2, y2, z2) => {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.001) return null;
    const m = new THREE.Mesh(linkGeo, linkMat);
    m.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5, (z1 + z2) * 0.5);
    m.scale.set(1, len, 1);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    parent.add(m);
    return m;
  };

  let medalAnchor;
  if (opts.hanging) {
    // Laço pendente vertical (como na mão de Maximus / Nivaldo na cutscene)
    const loopPts = [];
    const nLoop = 18;
    const w = 0.13 * s, h = 0.20 * s;
    for (let i = 0; i < nLoop; i++) {
      const ang = (i / nLoop) * Math.PI * 2 - Math.PI / 2;
      const pinch = 0.72 + 0.28 * Math.sin((ang + Math.PI / 2) * 0.5);
      const px = Math.cos(ang) * w * pinch;
      const py = -h * (1 + Math.sin(ang));
      loopPts.push([px, py, Math.sin(ang * 2) * 0.008 * s]);
    }
    for (let i = 0; i < nLoop; i++) {
      const p = loopPts[i], q = loopPts[(i + 1) % nLoop];
      addBead(root, p[0], p[1], p[2], 0.92);
      addLink(root, p[0], p[1], p[2], q[0], q[1], q[2]);
    }
    medalAnchor = new THREE.Group();
    medalAnchor.position.set(0, -h * 2.02, 0);
    root.add(medalAnchor);
  } else if (opts.vm) {
    // Pulseira de contas ao redor do punho em 1ª pessoa (eixo Z = antebraço, -Y = gravidade)
    const beadCount = 16;
    const rx = (opts.rx || 0.175) * s, ry = (opts.ry || 0.165) * s;
    const pts = [];
    for (let i = 0; i < beadCount; i++) {
      const ang = (i / beadCount) * Math.PI * 2;
      pts.push([Math.cos(ang) * rx, Math.sin(ang) * ry, 0]);
    }
    for (let i = 0; i < beadCount; i++) {
      const p = pts[i], q = pts[(i + 1) % beadCount];
      addBead(root, p[0], p[1], p[2], 0.95);
      addLink(root, p[0], p[1], p[2], q[0], q[1], q[2]);
    }
    medalAnchor = new THREE.Group();
    if (opts.medalPos) {
      medalAnchor.position.set(opts.medalPos[0], opts.medalPos[1], opts.medalPos[2]);
      addLink(root, -rx * 0.72, ry * 0.69, 0, opts.medalPos[0], opts.medalPos[1] + 0.01 * ps, opts.medalPos[2]);
    } else {
      medalAnchor.position.set(-rx * 0.96, ry * 0.72, -0.03 * s);
    }
    root.add(medalAnchor);
  } else {
    // Pulseira de contas ao redor do punho em 3ª pessoa (eixo Y = antebraço, -Y = gravidade)
    const beadCount = 14;
    const rx = (opts.rx || 0.205) * s, rz = (opts.rz || 0.205) * s;
    const pts = [];
    for (let i = 0; i < beadCount; i++) {
      const ang = (i / beadCount) * Math.PI * 2;
      pts.push([Math.cos(ang) * rx, 0, Math.sin(ang) * rz]);
    }
    for (let i = 0; i < beadCount; i++) {
      const p = pts[i], q = pts[(i + 1) % beadCount];
      addBead(root, p[0], p[1], p[2], 1.0);
      addLink(root, p[0], p[1], p[2], q[0], q[1], q[2]);
    }
    medalAnchor = new THREE.Group();
    medalAnchor.position.set(rx * 0.92, -0.025 * s, 0.03 * s);
    root.add(medalAnchor);
  }

  // Medalha central oval dourada (como na referência)
  const medalPiv = new THREE.Group();
  medalAnchor.add(medalPiv);
  addLink(medalPiv, 0, 0.02 * ps, 0, 0, -0.015 * ps, 0);
  const medalGeo = new THREE.CylinderGeometry(0.034 * ps, 0.034 * ps, 0.015 * ps, 10);
  const medalRim = new THREE.Mesh(medalGeo, MT(GOLD_MID, { em: 0x2e1f00 }));
  medalRim.rotation.x = Math.PI / 2;
  medalRim.scale.set(0.78, 1, 1.18);
  medalRim.position.set(0, -0.042 * ps, 0);
  medalPiv.add(medalRim);

  const medalInner = new THREE.Mesh(medalGeo, MT(GOLD_RECESS, { em: 0x140b00 }));
  medalInner.rotation.x = Math.PI / 2;
  medalInner.scale.set(0.58, 1.12, 0.90);
  medalInner.position.set(0, -0.042 * ps, 0);
  medalPiv.add(medalInner);

  // Relevo dourado central da medalha
  part(medalPiv, 0.012 * ps, 0.032 * ps, 0.018 * ps, GOLD_CORPUS, 0, -0.042 * ps, 0, { em: 0x3a2800 });
  part(medalPiv, 0.022 * ps, 0.010 * ps, 0.018 * ps, GOLD_CORPUS, 0, -0.036 * ps, 0, { em: 0x3a2800 });
  segments.push(medalPiv);

  // Cadeia pendente articulada: 1 conta - elo longo - 3 contas - 1 conta + crucifixo
  let parent = medalPiv;
  const linkSteps = [
    { link: 0.032, bead: true, y0: -0.072 },
    { link: 0.042, bead: true, y0: -0.020 },
    { link: 0.026, bead: true, y0: -0.020 },
    { link: 0.026, bead: true, y0: -0.020 },
    { link: 0.038, bead: true, y0: -0.020 }
  ];
  for (let i = 0; i < linkSteps.length; i++) {
    const st = linkSteps[i];
    const piv = new THREE.Group();
    piv.position.set(0, st.y0 * ps, 0);
    parent.add(piv);
    const lLen = st.link * ps;
    addLink(piv, 0, 0, 0, 0, -lLen, 0);
    if (st.bead) addBead(piv, 0, -lLen - 0.018 * ps, 0, 1.0, pBeadGeo);
    piv._nextY = -lLen - 0.036 * ps;
    segments.push(piv);
    parent = piv;
  }

  // Crucifixo dourado detalhado na ponta (com pontas alargadas e Cristo em relevo)
  const crossPiv = new THREE.Group();
  crossPiv.position.set(0, (parent._nextY || -0.055 * ps), 0);
  parent.add(crossPiv);
  addLink(crossPiv, 0, 0.012 * ps, 0, 0, -0.026 * ps, 0);
  // Argola superior
  part(crossPiv, 0.018 * ps, 0.018 * ps, 0.014 * ps, GOLD_CHAIN, 0, -0.026 * ps, 0, { em: 0x1a1000 });
  // Haste vertical + remates escalonados (topo e base)
  part(crossPiv, 0.026 * ps, 0.170 * ps, 0.020 * ps, GOLD_BEAD, 0, -0.114 * ps, 0, { em: 0x3d2a00 });
  part(crossPiv, 0.036 * ps, 0.016 * ps, 0.024 * ps, GOLD_MID, 0, -0.036 * ps, 0, { em: 0x2e1f00 });
  part(crossPiv, 0.038 * ps, 0.018 * ps, 0.024 * ps, GOLD_MID, 0, -0.194 * ps, 0, { em: 0x2e1f00 });
  // Travessa horizontal + pontas alargadas
  part(crossPiv, 0.118 * ps, 0.026 * ps, 0.020 * ps, GOLD_BEAD, 0, -0.072 * ps, 0, { em: 0x3d2a00 });
  part(crossPiv, 0.016 * ps, 0.036 * ps, 0.024 * ps, GOLD_MID, -0.058 * ps, -0.072 * ps, 0, { em: 0x2e1f00 });
  part(crossPiv, 0.016 * ps, 0.036 * ps, 0.024 * ps, GOLD_MID, 0.058 * ps, -0.072 * ps, 0, { em: 0x2e1f00 });
  // Figura de Cristo (Corpus) em ouro claro em relevo
  part(crossPiv, 0.016 * ps, 0.018 * ps, 0.030 * ps, GOLD_CORPUS, 0, -0.055 * ps, 0, { em: 0x4a3200 });
  part(crossPiv, 0.086 * ps, 0.012 * ps, 0.028 * ps, GOLD_CORPUS, 0, -0.072 * ps, 0, { em: 0x4a3200 });
  part(crossPiv, 0.015 * ps, 0.090 * ps, 0.028 * ps, GOLD_CORPUS, 0, -0.116 * ps, 0, { em: 0x4a3200 });
  segments.push(crossPiv);

  return { root, segments, cross: crossPiv };
}

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
  part(head, 0.20, 0.032, 0.05, 0x2a1410, 0, 0.045, 0.252); // boca séria fechada
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
  const rosaryProp = buildRosary(0.88, { hanging: true });
  rosaryProp.root.position.set(0, -0.86, 0.14);
  rosaryProp.root.visible = false;
  rig.armL.add(rosaryProp.root);
  rig.rosaryProp = rosaryProp.root;

  return rig;
}

function buildCampones() {
  const s = 0.85;
  const root = new THREE.Group();
  const rig = { root, h: 2.35 * s };

  // Paleta baseada na referência do aldeão zumbi (pele pálida/cadavérica, camisa bege ensanguentada, colete marrom, calça rasgada, botas diferentes)
  const SKIN_BASE = 0x8c7765;
  const SKIN_SH   = 0x675446;
  const SKIN_DARK = 0x4b3b30;
  const SKIN_HI   = 0x9e8976;
  const SHIRT_BASE = 0xb5a692;
  const SHIRT_SH   = 0x8f806d;
  const SHIRT_DIRT = 0x6f6150;
  const VEST_BASE  = 0x4d3423;
  const VEST_DARK  = 0x362316;
  const VEST_EDGE  = 0x60432e;
  const PANTS_BASE = 0x3a322d;
  const PANTS_WORN = 0x4c423a;
  const PANTS_DARK = 0x26201c;
  const BOOT_L_BASE = 0x6b3b22;
  const BOOT_L_HI   = 0x7e482b;
  const BOOT_R_BASE = 0x4d433a;
  const BOOT_R_HI   = 0x5d5146;
  const SOLE_COL    = 0x1e1612;
  const HAIR_BASE   = 0x241a14;
  const HAIR_DARK   = 0x160f0b;
  const BLOOD_1     = 0x6e0b0d;
  const BLOOD_2     = 0x4a0708;
  const BLOOD_3     = 0x8a1214;

  // Pernas: calça marrom-acinzentada rasgada nos joelhos/coxas + botas pesadas assimétricas
  const mkLeg = (side) => {
    const l = limb(root, 0.28 * s, 0.95 * s, 0.30 * s, PANTS_BASE, side * 0.19 * s, 0.95 * s, 0);
    // Coxa e tecido amassado
    part(l, 0.30 * s, 0.36 * s, 0.32 * s, PANTS_BASE, 0, -0.18 * s, 0);
    part(l, 0.14 * s, 0.18 * s, 0.33 * s, PANTS_WORN, side * 0.06 * s, -0.16 * s, 0.005 * s);
    part(l, 0.12 * s, 0.14 * s, 0.33 * s, PANTS_DARK, -side * 0.07 * s, -0.28 * s, 0.005 * s);

    // Rasgos na calça expondo carne pálida e sangue (como na foto)
    if (side < 0) {
      // Perna esquerda: rasgo grande na coxa/joelho
      part(l, 0.13 * s, 0.16 * s, 0.03 * s, SKIN_SH, -0.02 * s, -0.36 * s, 0.155 * s);
      part(l, 0.09 * s, 0.11 * s, 0.035 * s, BLOOD_1, -0.01 * s, -0.37 * s, 0.158 * s);
      part(l, 0.14 * s, 0.12 * s, 0.03 * s, BLOOD_2, 0.04 * s, -0.22 * s, 0.158 * s);
    } else {
      // Perna direita: rasgo lateral no joelho e mancha de sangue
      part(l, 0.12 * s, 0.15 * s, 0.03 * s, SKIN_SH, 0.03 * s, -0.40 * s, 0.155 * s);
      part(l, 0.08 * s, 0.10 * s, 0.035 * s, BLOOD_1, 0.02 * s, -0.41 * s, 0.158 * s);
      part(l, 0.11 * s, 0.14 * s, 0.03 * s, BLOOD_2, -0.04 * s, -0.20 * s, 0.158 * s);
    }

    // Boca da calça dobrada/amassada acima da bota
    part(l, 0.31 * s, 0.14 * s, 0.33 * s, PANTS_WORN, 0, -0.50 * s, 0);
    part(l, 0.29 * s, 0.06 * s, 0.31 * s, PANTS_DARK, 0, -0.56 * s, 0);

    // Bota pesada (esquerda marrom-avermelhada, direita cinza-marrom enlameada)
    const bBase = side < 0 ? BOOT_L_BASE : BOOT_R_BASE;
    const bHi   = side < 0 ? BOOT_L_HI : BOOT_R_HI;
    part(l, 0.29 * s, 0.30 * s, 0.31 * s, bBase, 0, -0.73 * s, 0);
    part(l, 0.30 * s, 0.06 * s, 0.32 * s, bHi, 0, -0.60 * s, 0); // borda do cano
    part(l, 0.28 * s, 0.14 * s, 0.38 * s, bBase, 0, -0.84 * s, 0.04 * s); // peito do pé/biqueira
    part(l, 0.26 * s, 0.08 * s, 0.12 * s, bHi, 0, -0.85 * s, 0.18 * s); // bico da bota
    part(l, 0.29 * s, 0.05 * s, 0.40 * s, SOLE_COL, 0, -0.925 * s, 0.04 * s); // sola
    return l;
  };
  rig.legL = mkLeg(-1);
  rig.legR = mkLeg(1);

  // Tronco: camisa bege/suja aberta no colarinho e ensanguentada + colete marrom aberto
  rig.torso = part(root, 0.76 * s, 0.92 * s, 0.42 * s, SHIRT_BASE, 0, 1.40 * s, 0);
  const T = rig.torso;

  // Abertura em V no peito mostrando pescoço/peito cadavérico e sangue
  part(T, 0.22 * s, 0.24 * s, 0.04 * s, SKIN_SH, 0, 0.34 * s, 0.20 * s);
  part(T, 0.14 * s, 0.16 * s, 0.045 * s, BLOOD_1, 0, 0.31 * s, 0.202 * s);
  // Gola aberta da camisa
  part(T, 0.12 * s, 0.14 * s, 0.08 * s, SHIRT_SH, -0.14 * s, 0.39 * s, 0.19 * s);
  part(T, 0.12 * s, 0.14 * s, 0.08 * s, SHIRT_SH, 0.14 * s, 0.39 * s, 0.19 * s);
  // Carcela de botões no centro
  part(T, 0.06 * s, 0.68 * s, 0.025 * s, SHIRT_SH, 0, -0.10 * s, 0.208 * s);
  for (let i = 0; i < 4; i++) {
    part(T, 0.025 * s, 0.025 * s, 0.03 * s, 0x2c241d, 0, (0.14 - i * 0.14) * s, 0.212 * s);
  }

  // Manchas de sangue pesadas na frente da camisa (como na referência)
  part(T, 0.28 * s, 0.34 * s, 0.025 * s, BLOOD_1, -0.06 * s, 0.02 * s, 0.212 * s);
  part(T, 0.18 * s, 0.22 * s, 0.03 * s, BLOOD_2, -0.04 * s, -0.04 * s, 0.214 * s);
  part(T, 0.16 * s, 0.20 * s, 0.025 * s, BLOOD_3, 0.07 * s, 0.12 * s, 0.212 * s);
  part(T, 0.20 * s, 0.18 * s, 0.025 * s, BLOOD_1, 0.04 * s, -0.24 * s, 0.212 * s);
  part(T, 0.34 * s, 0.20 * s, 0.025 * s, SHIRT_DIRT, 0.02 * s, -0.34 * s, 0.208 * s);

  // Barra da camisa rasgada/irregular pendendo abaixo da cintura
  part(T, 0.24 * s, 0.14 * s, 0.04 * s, SHIRT_BASE, -0.15 * s, -0.49 * s, 0.19 * s);
  part(T, 0.18 * s, 0.10 * s, 0.04 * s, BLOOD_1, -0.12 * s, -0.48 * s, 0.195 * s);
  part(T, 0.22 * s, 0.11 * s, 0.04 * s, SHIRT_SH, 0.14 * s, -0.47 * s, 0.19 * s);
  part(T, 0.72 * s, 0.10 * s, 0.06 * s, SHIRT_DIRT, 0, -0.47 * s, -0.18 * s);

  // Colete rústico marrom aberto (abas frontais + costas + ombros)
  part(T, 0.25 * s, 0.88 * s, 0.08 * s, VEST_BASE, -0.26 * s, 0.02 * s, 0.19 * s);
  part(T, 0.25 * s, 0.88 * s, 0.08 * s, VEST_BASE, 0.26 * s, 0.02 * s, 0.19 * s);
  part(T, 0.05 * s, 0.84 * s, 0.09 * s, VEST_EDGE, -0.15 * s, 0.02 * s, 0.195 * s);
  part(T, 0.05 * s, 0.84 * s, 0.09 * s, VEST_EDGE, 0.15 * s, 0.02 * s, 0.195 * s);
  // Laterais e costas do colete
  part(T, 0.80 * s, 0.86 * s, 0.10 * s, VEST_DARK, 0, 0.03 * s, -0.19 * s);
  part(T, 0.06 * s, 0.84 * s, 0.44 * s, VEST_BASE, -0.37 * s, 0.03 * s, 0);
  part(T, 0.06 * s, 0.84 * s, 0.44 * s, VEST_BASE, 0.37 * s, 0.03 * s, 0);
  // Pontas inferiores do colete
  part(T, 0.20 * s, 0.10 * s, 0.07 * s, VEST_DARK, -0.26 * s, -0.45 * s, 0.185 * s);
  part(T, 0.20 * s, 0.10 * s, 0.07 * s, VEST_DARK, 0.26 * s, -0.45 * s, 0.185 * s);

  // Cabeça: rosto cadavérico, olhos brancos fundos, boca aberta gritando com dentes e barba/cabelo despenteado
  rig.head = part(root, 0.44 * s, 0.48 * s, 0.44 * s, SKIN_BASE, 0, 2.10 * s, 0);
  const H = rig.head;

  // Pescoço fino e ensanguentado
  part(H, 0.22 * s, 0.16 * s, 0.22 * s, SKIN_SH, 0, -0.26 * s, 0);
  part(H, 0.14 * s, 0.12 * s, 0.23 * s, BLOOD_2, 0, -0.25 * s, 0.01 * s);

  // Arcada supraciliar marcada + maçãs do rosto fundas + nariz fino
  part(H, 0.42 * s, 0.07 * s, 0.06 * s, SKIN_SH, 0, 0.10 * s, 0.21 * s);
  part(H, 0.10 * s, 0.12 * s, 0.05 * s, SKIN_DARK, -0.16 * s, -0.02 * s, 0.205 * s);
  part(H, 0.10 * s, 0.12 * s, 0.05 * s, SKIN_DARK, 0.16 * s, -0.02 * s, 0.205 * s);
  part(H, 0.07 * s, 0.10 * s, 0.06 * s, SKIN_HI, 0, 0.01 * s, 0.23 * s);

  // Órbitas fundas escuras + olhos branco-leitosos de morto-vivo
  part(H, 0.13 * s, 0.08 * s, 0.03 * s, 0x1e1210, -0.10 * s, 0.05 * s, 0.215 * s);
  part(H, 0.13 * s, 0.08 * s, 0.03 * s, 0x1e1210, 0.10 * s, 0.05 * s, 0.215 * s);
  part(H, 0.06 * s, 0.045 * s, 0.02 * s, 0xdcd6c8, -0.10 * s, 0.05 * s, 0.226 * s, { basic: true });
  part(H, 0.06 * s, 0.045 * s, 0.02 * s, 0xdcd6c8, 0.10 * s, 0.05 * s, 0.226 * s, { basic: true });

  // Boca aberta gritando com dentes podres e sangue no queixo
  part(H, 0.18 * s, 0.13 * s, 0.04 * s, 0x180506, 0, -0.10 * s, 0.214 * s, { basic: true });
  part(H, 0.13 * s, 0.028 * s, 0.03 * s, 0xc8bc98, 0, -0.055 * s, 0.224 * s); // dentes superiores
  part(H, 0.12 * s, 0.025 * s, 0.03 * s, 0xb8ac88, 0, -0.145 * s, 0.224 * s); // dentes inferiores
  part(H, 0.14 * s, 0.06 * s, 0.03 * s, BLOOD_1, 0, -0.19 * s, 0.218 * s);

  // Bigode e cavanhaque despenteados ao redor da boca
  part(H, 0.20 * s, 0.035 * s, 0.04 * s, HAIR_BASE, 0, -0.035 * s, 0.22 * s);
  part(H, 0.05 * s, 0.14 * s, 0.04 * s, HAIR_BASE, -0.11 * s, -0.12 * s, 0.218 * s);
  part(H, 0.05 * s, 0.14 * s, 0.04 * s, HAIR_BASE, 0.11 * s, -0.12 * s, 0.218 * s);
  part(H, 0.16 * s, 0.09 * s, 0.06 * s, HAIR_BASE, 0, -0.22 * s, 0.20 * s);
  part(H, 0.09 * s, 0.07 * s, 0.05 * s, HAIR_DARK, 0, -0.26 * s, 0.19 * s);

  // Cabelo ralo/despenteado no topo, têmporas e nuca
  part(H, 0.46 * s, 0.10 * s, 0.46 * s, HAIR_BASE, 0, 0.23 * s, -0.01 * s);
  part(H, 0.18 * s, 0.09 * s, 0.08 * s, HAIR_DARK, -0.15 * s, 0.19 * s, 0.20 * s);
  part(H, 0.16 * s, 0.08 * s, 0.08 * s, HAIR_BASE, 0.16 * s, 0.18 * s, 0.20 * s);
  part(H, 0.06 * s, 0.26 * s, 0.36 * s, HAIR_BASE, -0.23 * s, 0.08 * s, -0.02 * s);
  part(H, 0.06 * s, 0.26 * s, 0.36 * s, HAIR_BASE, 0.23 * s, 0.08 * s, -0.02 * s);
  part(H, 0.44 * s, 0.32 * s, 0.06 * s, HAIR_DARK, 0, 0.06 * s, -0.23 * s);

  // Braços: mangas da camisa arregaçadas + antebraços expostos e ensanguentados
  const mkArm = (side) => {
    const a = limb(root, 0.21 * s, 0.90 * s, 0.21 * s, SKIN_BASE, side * 0.51 * s, 1.80 * s, 0);
    // Manga da camisa até o meio do braço
    part(a, 0.25 * s, 0.42 * s, 0.25 * s, SHIRT_BASE, 0, -0.21 * s, 0);
    part(a, 0.26 * s, 0.07 * s, 0.26 * s, SHIRT_SH, 0, -0.41 * s, 0); // dobra arregaçada
    part(a, 0.14 * s, 0.20 * s, 0.26 * s, BLOOD_1, side * 0.03 * s, -0.24 * s, 0.01 * s);
    // Antebraço exposto com manchas de sangue e mãos cadavéricas
    part(a, 0.19 * s, 0.24 * s, 0.19 * s, SKIN_SH, 0, -0.60 * s, 0);
    part(a, 0.12 * s, 0.22 * s, 0.20 * s, BLOOD_1, 0, -0.64 * s, 0.015 * s);
    part(a, 0.18 * s, 0.14 * s, 0.20 * s, BLOOD_2, 0, -0.83 * s, 0.01 * s);
    return a;
  };
  rig.armL = mkArm(-1);
  rig.armR = mkArm(1);
  rig.armL.rotation.x = -1.3;
  rig.armR.rotation.x = -1.3;

  // Forcado opcional (40% de chance, preservando variedade original)
  if (Math.random() < 0.4) {
    rig.pitchfork = new THREE.Group();
    part(rig.pitchfork, 0.06 * s, 1.45 * s, 0.06 * s, 0x5a3a1c, 0, -1.325 * s, 0);
    part(rig.pitchfork, 0.3 * s, 0.06 * s, 0.05 * s, 0x909090, 0, -2.05 * s, 0);
    for (let i = -1; i <= 1; i++) part(rig.pitchfork, 0.04 * s, 0.3 * s, 0.04 * s, 0x909090, i * 0.12 * s, -2.2 * s, 0);
    rig.armR.add(rig.pitchfork);
  }

  return rig;
}

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

function buildGuarda() {
  const s = 0.95;
  const root = new THREE.Group();
  const rig = { root, h: 2.35 * s };

  // Paleta baseada na referência do cavaleiro templário zumbi
  const ARMOR_BASE   = 0x5c5b5e;
  const ARMOR_HI     = 0x7c7b80;
  const ARMOR_DARK   = 0x38373a;
  const ARMOR_RUST   = 0x4b3830;
  const MAIL_BASE    = 0x34312f;
  const MAIL_HI      = 0x4d4843;
  const SURCOAT_BASE = 0x6b1416;
  const SURCOAT_DARK = 0x440b0d;
  const SURCOAT_EDGE = 0x821e20;
  const CROSS_COL    = 0xc9beab;
  const CROSS_STAIN  = 0x947e6d;
  const LEATHER      = 0x362419;
  const BUCKLE       = 0x786e62;
  const SKIN_BASE    = 0x6b5d53;
  const SKIN_SH      = 0x4b3f38;
  const SKIN_DARK    = 0x2f2621;
  const EYE_COL      = 0xe8e4d8;
  const BLOOD_1      = 0x6e0b0d;
  const BLOOD_2      = 0x4a0708;
  const BLOOD_3      = 0x8a1214;

  // Pernas: cota de malha na coxa, joelheira pontuda (poleyn), greva e sabaton (bota blindada)
  const mkLeg = (side) => {
    const l = limb(root, 0.28 * s, 0.95 * s, 0.30 * s, MAIL_BASE, side * 0.20 * s, 0.95 * s, 0);
    // Coxa em cota de malha com desgaste e sangue
    part(l, 0.30 * s, 0.34 * s, 0.32 * s, MAIL_BASE, 0, -0.17 * s, 0);
    part(l, 0.16 * s, 0.20 * s, 0.33 * s, MAIL_HI, side * 0.05 * s, -0.18 * s, 0.005 * s);
    part(l, 0.14 * s, 0.18 * s, 0.33 * s, BLOOD_2, -side * 0.04 * s, -0.24 * s, 0.008 * s);

    // Joelheira (poleyn) articulada com crista central e aba lateral
    part(l, 0.31 * s, 0.16 * s, 0.34 * s, ARMOR_BASE, 0, -0.40 * s, 0.015 * s);
    part(l, 0.18 * s, 0.18 * s, 0.08 * s, ARMOR_HI, 0, -0.40 * s, 0.18 * s);
    part(l, 0.06 * s, 0.20 * s, 0.06 * s, ARMOR_HI, 0, -0.40 * s, 0.21 * s); // ponta/crista do joelho
    part(l, 0.08 * s, 0.12 * s, 0.14 * s, ARMOR_DARK, side * 0.16 * s, -0.40 * s, 0.04 * s); // aba lateral
    part(l, 0.12 * s, 0.10 * s, 0.03 * s, BLOOD_1, side * 0.03 * s, -0.41 * s, 0.215 * s);

    // Greva (caneleira de aço com crista frontal e manchas de sangue)
    part(l, 0.28 * s, 0.34 * s, 0.30 * s, ARMOR_BASE, 0, -0.64 * s, 0);
    part(l, 0.08 * s, 0.32 * s, 0.05 * s, ARMOR_HI, 0, -0.64 * s, 0.15 * s);
    part(l, 0.29 * s, 0.06 * s, 0.31 * s, ARMOR_DARK, 0, -0.52 * s, 0);
    part(l, 0.14 * s, 0.18 * s, 0.03 * s, BLOOD_1, -side * 0.04 * s, -0.66 * s, 0.155 * s);
    part(l, 0.10 * s, 0.14 * s, 0.31 * s, ARMOR_RUST, side * 0.08 * s, -0.68 * s, -0.02 * s);

    // Sabaton (bota de placas articuladas)
    part(l, 0.29 * s, 0.12 * s, 0.34 * s, ARMOR_DARK, 0, -0.84 * s, 0.02 * s);
    part(l, 0.27 * s, 0.10 * s, 0.38 * s, ARMOR_BASE, 0, -0.88 * s, 0.05 * s);
    part(l, 0.25 * s, 0.07 * s, 0.14 * s, ARMOR_HI, 0, -0.89 * s, 0.18 * s); // bico articulado
    part(l, 0.22 * s, 0.05 * s, 0.06 * s, BLOOD_2, 0, -0.88 * s, 0.22 * s);
    part(l, 0.29 * s, 0.045 * s, 0.40 * s, 0x1b1715, 0, -0.93 * s, 0.05 * s); // sola
    return l;
  };
  rig.legL = mkLeg(-1);
  rig.legR = mkLeg(1);

  // Tronco (Mesh principal para compatibilidade com boundingBox de desmembramento)
  rig.torso = part(root, 0.78 * s, 0.92 * s, 0.44 * s, ARMOR_DARK, 0, 1.40 * s, 0);
  const T = rig.torso;

  // Peitoral de aço por baixo + gorjal no colarinho
  part(T, 0.80 * s, 0.32 * s, 0.46 * s, ARMOR_BASE, 0, 0.26 * s, 0);
  part(T, 0.56 * s, 0.12 * s, 0.46 * s, ARMOR_HI, 0, 0.42 * s, 0.01 * s); // gorjal
  // Fivelas nos ombros segurando a sobreveste
  part(T, 0.08 * s, 0.10 * s, 0.06 * s, LEATHER, -0.22 * s, 0.40 * s, 0.22 * s);
  part(T, 0.08 * s, 0.10 * s, 0.06 * s, LEATHER, 0.22 * s, 0.40 * s, 0.22 * s);
  part(T, 0.05 * s, 0.05 * s, 0.07 * s, BUCKLE, -0.22 * s, 0.40 * s, 0.225 * s);
  part(T, 0.05 * s, 0.05 * s, 0.07 * s, BUCKLE, 0.22 * s, 0.40 * s, 0.225 * s);

  // Sobreveste (tabard) vermelho-sangue rasgada na frente e nas costas
  part(T, 0.62 * s, 0.86 * s, 0.04 * s, SURCOAT_BASE, 0, -0.02 * s, 0.225 * s);
  part(T, 0.64 * s, 0.86 * s, 0.04 * s, SURCOAT_DARK, 0, -0.02 * s, -0.225 * s);
  part(T, 0.22 * s, 0.34 * s, 0.045 * s, BLOOD_2, -0.16 * s, -0.10 * s, 0.230 * s);
  part(T, 0.20 * s, 0.28 * s, 0.045 * s, BLOOD_1, 0.18 * s, 0.08 * s, 0.230 * s);

  // Cruz Templária (Cross Pattée) branca gasta/manchada no peito
  part(T, 0.12 * s, 0.48 * s, 0.03 * s, CROSS_COL, 0, 0.07 * s, 0.242 * s); // haste vertical
  part(T, 0.40 * s, 0.12 * s, 0.03 * s, CROSS_COL, 0, 0.12 * s, 0.242 * s); // haste horizontal
  // Pontas alargadas da cruz (estilo templário)
  part(T, 0.18 * s, 0.06 * s, 0.03 * s, CROSS_COL, 0, 0.30 * s, 0.242 * s);
  part(T, 0.18 * s, 0.06 * s, 0.03 * s, CROSS_COL, 0, -0.16 * s, 0.242 * s);
  part(T, 0.06 * s, 0.18 * s, 0.03 * s, CROSS_COL, -0.19 * s, 0.12 * s, 0.242 * s);
  part(T, 0.06 * s, 0.18 * s, 0.03 * s, CROSS_COL, 0.19 * s, 0.12 * s, 0.242 * s);
  // Manchas de sujeira e sangue sobre a cruz
  part(T, 0.10 * s, 0.14 * s, 0.032 * s, CROSS_STAIN, 0.02 * s, -0.04 * s, 0.244 * s);
  part(T, 0.08 * s, 0.10 * s, 0.033 * s, BLOOD_1, -0.04 * s, 0.14 * s, 0.245 * s);

  // Cinto de couro na cintura com fivela metálica
  part(T, 0.84 * s, 0.10 * s, 0.48 * s, LEATHER, 0, -0.36 * s, 0);
  part(T, 0.12 * s, 0.12 * s, 0.04 * s, BUCKLE, 0, -0.36 * s, 0.245 * s);
  part(T, 0.06 * s, 0.06 * s, 0.045 * s, LEATHER, 0, -0.36 * s, 0.248 * s);
  // Correia diagonal auxiliar abaixo do cinto
  const strap = part(T, 0.36 * s, 0.06 * s, 0.04 * s, LEATHER, -0.16 * s, -0.45 * s, 0.242 * s);
  strap.rotation.z = 0.22;

  // Escarcelas (tassets) de aço segmentadas nos quadris + saia de malha + farrapos vermelhos
  for (const side of [-1, 1]) {
    // 3 placas segmentadas de aço em cada quadril
    for (let i = 0; i < 3; i++) {
      const py = (-0.50 - i * 0.11) * s;
      const pw = (0.24 - i * 0.015) * s;
      const plate = part(T, pw, 0.10 * s, 0.38 * s, i % 2 === 0 ? ARMOR_BASE : ARMOR_HI, side * (0.31 + i * 0.02) * s, py, 0.02 * s);
      plate.rotation.z = side * -0.16;
      if (i === 1) {
        part(T, 0.08 * s, 0.08 * s, 0.03 * s, BLOOD_1, side * 0.33 * s, py, 0.215 * s);
      }
    }
    // Abas frontais rasgadas da sobreveste
    part(T, 0.22 * s, 0.36 * s, 0.035 * s, SURCOAT_BASE, side * 0.15 * s, -0.62 * s, 0.21 * s);
    part(T, 0.12 * s, 0.22 * s, 0.035 * s, SURCOAT_EDGE, side * 0.18 * s, -0.84 * s, 0.20 * s);
    part(T, 0.14 * s, 0.18 * s, 0.04 * s, BLOOD_2, side * 0.12 * s, -0.70 * s, 0.215 * s);
  }
  // Cota de malha visível no centro abaixo do rasgo da sobreveste e atrás
  part(T, 0.44 * s, 0.34 * s, 0.04 * s, MAIL_BASE, 0, -0.60 * s, 0.17 * s);
  part(T, 0.26 * s, 0.16 * s, 0.04 * s, MAIL_HI, 0, -0.72 * s, 0.172 * s);
  part(T, 0.62 * s, 0.42 * s, 0.04 * s, SURCOAT_DARK, 0, -0.64 * s, -0.215 * s);

  // Cabeça: rosto cadavérico dentro de elmo medieval aberto com crista e sangue
  rig.head = part(root, 0.42 * s, 0.46 * s, 0.42 * s, SKIN_BASE, 0, 2.10 * s, 0);
  const H = rig.head;

  // Pescoço protegido por malha e sangue
  part(H, 0.26 * s, 0.16 * s, 0.26 * s, MAIL_BASE, 0, -0.25 * s, 0);
  part(H, 0.14 * s, 0.12 * s, 0.27 * s, BLOOD_2, 0, -0.25 * s, 0.01 * s);

  // Traços faciais cadavéricos (arcada, maçãs fundas, nariz)
  part(H, 0.38 * s, 0.06 * s, 0.05 * s, SKIN_SH, 0, 0.09 * s, 0.20 * s);
  part(H, 0.09 * s, 0.12 * s, 0.05 * s, SKIN_DARK, -0.14 * s, -0.02 * s, 0.195 * s);
  part(H, 0.09 * s, 0.12 * s, 0.05 * s, SKIN_DARK, 0.14 * s, -0.02 * s, 0.195 * s);
  part(H, 0.065 * s, 0.09 * s, 0.06 * s, SKIN_BASE, 0, 0.01 * s, 0.22 * s);

  // Órbitas fundas + olhos branco-pálidos brilhantes
  part(H, 0.12 * s, 0.075 * s, 0.03 * s, 0x160d0b, -0.095 * s, 0.045 * s, 0.205 * s);
  part(H, 0.12 * s, 0.075 * s, 0.03 * s, 0x160d0b, 0.095 * s, 0.045 * s, 0.205 * s);
  part(H, 0.055 * s, 0.04 * s, 0.02 * s, EYE_COL, -0.095 * s, 0.045 * s, 0.216 * s, { basic: true });
  part(H, 0.055 * s, 0.04 * s, 0.02 * s, EYE_COL, 0.095 * s, 0.045 * s, 0.216 * s, { basic: true });

  // Boca aberta rosnando com presas/dentes e sangue no queixo
  part(H, 0.18 * s, 0.13 * s, 0.04 * s, 0x160405, 0, -0.10 * s, 0.205 * s, { basic: true });
  part(H, 0.14 * s, 0.026 * s, 0.03 * s, 0xd0c6a8, 0, -0.055 * s, 0.215 * s);
  part(H, 0.13 * s, 0.024 * s, 0.03 * s, 0xbdb396, 0, -0.145 * s, 0.215 * s);
  part(H, 0.16 * s, 0.08 * s, 0.035 * s, BLOOD_1, 0, -0.19 * s, 0.208 * s);

  // Elmo medieval aberto (sallet/cervelliere com crista central e protetores laterais)
  part(H, 0.50 * s, 0.22 * s, 0.50 * s, ARMOR_BASE, 0, 0.18 * s, -0.01 * s); // domo principal
  part(H, 0.42 * s, 0.10 * s, 0.44 * s, ARMOR_HI, 0, 0.29 * s, -0.01 * s); // topo arredondado
  part(H, 0.08 * s, 0.08 * s, 0.54 * s, ARMOR_HI, 0, 0.34 * s, -0.01 * s); // crista central
  part(H, 0.52 * s, 0.06 * s, 0.12 * s, ARMOR_DARK, 0, 0.11 * s, 0.21 * s); // aba frontal
  // Protetores laterais de bochecha e nuca
  part(H, 0.07 * s, 0.34 * s, 0.38 * s, ARMOR_BASE, -0.23 * s, 0.01 * s, -0.03 * s);
  part(H, 0.07 * s, 0.34 * s, 0.38 * s, ARMOR_BASE, 0.23 * s, 0.01 * s, -0.03 * s);
  part(H, 0.50 * s, 0.34 * s, 0.08 * s, ARMOR_DARK, 0, 0.01 * s, -0.23 * s);
  // Manchas de sangue no elmo
  part(H, 0.14 * s, 0.10 * s, 0.03 * s, BLOOD_1, 0.10 * s, 0.22 * s, 0.24 * s);
  part(H, 0.10 * s, 0.12 * s, 0.03 * s, BLOOD_2, -0.12 * s, 0.15 * s, 0.24 * s);

  // Braços: ombreiras (pauldrons) em camadas, cota de malha, farrapos e manoplas
  const mkArm = (side) => {
    const a = limb(root, 0.22 * s, 0.90 * s, 0.22 * s, MAIL_BASE, side * 0.54 * s, 1.80 * s, 0);
    // Ombreira (pauldron) em 3 placas sobrepostas
    part(a, 0.34 * s, 0.14 * s, 0.36 * s, ARMOR_HI, side * 0.04 * s, -0.02 * s, 0);
    part(a, 0.32 * s, 0.11 * s, 0.33 * s, ARMOR_BASE, side * 0.05 * s, -0.12 * s, 0);
    part(a, 0.28 * s, 0.09 * s, 0.30 * s, ARMOR_DARK, side * 0.04 * s, -0.20 * s, 0);
    part(a, 0.14 * s, 0.10 * s, 0.04 * s, BLOOD_1, side * 0.06 * s, -0.06 * s, 0.175 * s);

    // Mangas de cota de malha + farrapo vermelho pendendo no cotovelo
    part(a, 0.23 * s, 0.24 * s, 0.23 * s, MAIL_BASE, 0, -0.34 * s, 0);
    part(a, 0.08 * s, 0.18 * s, 0.14 * s, SURCOAT_DARK, -side * 0.10 * s, -0.44 * s, -0.02 * s);

    // Cotoveleira (couter) e antebraço blindado (vambrace)
    part(a, 0.26 * s, 0.12 * s, 0.26 * s, ARMOR_HI, 0, -0.49 * s, -0.01 * s);
    part(a, 0.23 * s, 0.24 * s, 0.23 * s, ARMOR_BASE, 0, -0.65 * s, 0);
    part(a, 0.10 * s, 0.20 * s, 0.04 * s, BLOOD_1, 0, -0.65 * s, 0.118 * s);

    // Manopla blindada (gauntlet)
    part(a, 0.24 * s, 0.18 * s, 0.24 * s, ARMOR_DARK, 0, -0.84 * s, 0);
    part(a, 0.20 * s, 0.08 * s, 0.20 * s, ARMOR_HI, 0, -0.80 * s, 0.02 * s);
    part(a, 0.14 * s, 0.08 * s, 0.04 * s, BLOOD_2, 0, -0.89 * s, 0.11 * s);
    return a;
  };
  rig.armL = mkArm(-1);
  rig.armR = mkArm(1);

  // Espada templária gasta e ensanguentada na mão direita
  rig.sword = new THREE.Group();
  part(rig.sword, 0.10 * s, 0.16 * s, 0.10 * s, LEATHER, 0, -0.88 * s, 0);
  part(rig.sword, 0.14 * s, 0.06 * s, 0.13 * s, ARMOR_DARK, 0, -0.78 * s, 0); // pomo
  part(rig.sword, 0.42 * s, 0.065 * s, 0.10 * s, ARMOR_HI, 0, -0.96 * s, 0); // guarda-mão
  part(rig.sword, 0.08 * s, 1.22 * s, 0.03 * s, 0xb4b8c0, 0, -1.58 * s, 0); // lâmina
  part(rig.sword, 0.06 * s, 0.46 * s, 0.034 * s, BLOOD_1, 0, -1.90 * s, 0); // sangue na ponta
  rig.armR.add(rig.sword);

  return rig;
}

const BUILD = {
  nivaldo: buildNivaldo,
  campones: buildCampones,
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
  guarda: buildGuarda,
  demonio() {
    return humanoid({ skin: 0xa01818, cloth: 0x701010, legs: 0x601010, scale: 1.45, wide: 1.45, horns: true, tail: true, eyes: 0xffee00, armsFwd: false });
  },
  gargula: buildGargula,
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
      const ros = buildRosary((w / 0.25) * 0.82, { vm: true, rx: 0.155, ry: 0.148, pendantScale: 0.48 });
      ros.root.position.set(0, 0, wz - 0.075);
      ros.root.visible = false;
      ros.colliders = [
        { minX: -w * 0.56, maxX: w * 0.56, minY: -h * 0.56, maxY: h * 0.56, minZ: -0.22, maxZ: 0.25, pad: 0.018 }
      ];
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
      // Rosário enrolado no pulso direito, com colisão própria na mão/polegar para ficar ao lado do dedo!
      if (side === 1) {
        const ros = buildRosary(0.84, {
          vm: true,
          rx: 0.175,
          ry: 0.155,
          pendantScale: 0.46,
          medalPos: [-0.228, 0.110, -0.095]
        });
        ros.root.position.set(0, 0.0, 0.025);
        ros.root.visible = false;
        // Colisores em espaço local de ros.root (polegar + punho)
        ros.colliders = [
          { minX: -0.214, maxX: -0.095, minY: -0.030, maxY: 0.110, minZ: -0.175, maxZ: 0.025, pad: 0.016 },
          { minX: -0.155, maxX: 0.155, minY: -0.130, maxY: 0.150, minZ: -0.225, maxZ: 0.055, pad: 0.018 }
        ];
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
  // 3 - Estilingue
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
    bandL.rotation.order = 'YXZ';
    bandL.rotation.set(0.16, 0.736, 0);
    const bandR = part(root, 0.014, 0.014, 0.125, 0xaa5030, 0.041, 0.28, 0.045);
    bandR.rotation.order = 'YXZ';
    bandR.rotation.set(0.16, -0.736, 0);
    const pouch = part(root, 0.06, 0.05, 0.02, 0x4a2816, 0, 0.27, 0.095);
    root.bandL = bandL;
    root.bandR = bandR;
    root.pouch = pouch;
    root.rock = part(root, 0.065, 0.065, 0.065, 0x8a8a90, 0, 0.27, 0.065);
    addGrip(root, 0, -0.10, 0);
    addArm(root, 0, -0.11, 0.32, { w: 0.21, h: 0.20 });
    root.position.set(0.32, -0.38, -0.65); root.rotation.set(-0.15, 0, 0);
    root.userData.base = { p: root.position.clone(), r: root.rotation.clone(), tipY: 0.30, restY: 0.27, restZ: 0.095, rockZ: 0.065, baseLen: 0.125 };
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
    addArm(root, -0.19, 0.14, 0.25, { w: 0.19, h: 0.19, len: 0.50, rot: [0.22, -0.65, 0], noRosary: true });
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
  // 6 - Sacra Cruz Papal (Cruz dos Apóstolos)
  {
    const root = new THREE.Group();
    const crossMesh = buildPapalCrossMesh({ auraScale: 1.0 });
    root.add(crossMesh);
    root.aura = crossMesh.userData.aura;
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

// Geometria compartilhada da Sacra-Cruz Papal (Cruz dos Apóstolos com Rubi Central e Aura Azul Clara)
function buildPapalCrossMesh(opts) {
  opts = opts || {};
  const g = new THREE.Group();

  const GOLD_RIM = 0xdcb43c;
  const GOLD_MID = 0xb88f24;
  const BRASS_DARK = 0x5c4614;
  const BRONZE_RELIEF = 0xe8c860;
  const RUBY_COL = 0xd90b24;
  const RUBY_HI = 0xff3b5c;

  const mRim = MT(GOLD_RIM, { em: 0x3f2e04 });
  const mMid = MT(GOLD_MID, { em: 0x2e2002 });
  const mDark = MT(BRASS_DARK, { em: 0x181002 });
  const mRelief = MT(BRONZE_RELIEF, { em: 0x483506 });
  const mRuby = MT(RUBY_COL, { em: 0x7a0014 });
  const mRubyCore = MT(RUBY_HI, { basic: true });

  const CY = 0.34; // centro do cruzamento

  // 1. Braços da cruz com moldura dourada em relevo e canal interno escuro
  part(g, 0.072, 0.56, 0.032, GOLD_RIM, 0, 0.21, 0, { em: 0x3f2e04 });
  part(g, 0.048, 0.52, 0.038, BRASS_DARK, 0, 0.21, 0, { em: 0x181002 });
  part(g, 0.35, 0.072, 0.032, GOLD_RIM, 0, CY, 0, { em: 0x3f2e04 });
  part(g, 0.31, 0.048, 0.038, BRASS_DARK, 0, CY, 0, { em: 0x181002 });

  // Cabo inferior (empunhadura) e base/pedestal em leque (como na imagem)
  part(g, 0.062, 0.14, 0.040, GOLD_MID, 0, -0.09, 0, { em: 0x2e2002 });
  const baseGeo = new THREE.CylinderGeometry(0.024, 0.064, 0.078, 8);
  const baseMesh = new THREE.Mesh(baseGeo, mMid);
  baseMesh.position.set(0, -0.195, 0);
  g.add(baseMesh);
  const baseRim = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 0.014, 8), mRim);
  baseRim.position.set(0, -0.232, 0);
  g.add(baseRim);
  // Painéis escuros decorativos no pedestal
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 + Math.PI / 4;
    const panel = new THREE.Mesh(BX(0.018, 0.042, 0.008), mDark);
    panel.position.set(Math.sin(ang) * 0.042, -0.198, Math.cos(ang) * 0.042);
    panel.rotation.y = ang;
    panel.rotation.x = -0.35;
    g.add(panel);
  }

  // 2. Quatro extremidades trevoladas (Cruz dos Apóstolos: 3 lóbulos x 4 pontas = 12 Apóstolos)
  const lobeRimGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.034, 10);
  const lobeDarkGeo = new THREE.CylinderGeometry(0.027, 0.027, 0.040, 10);
  const headGeo = new THREE.SphereGeometry(0.0085, 6, 5);
  const bodyGeo = new THREE.BoxGeometry(0.017, 0.016, 0.008);

  const addTrefoilEnd = (cx, cy, dx, dy) => {
    const px = -dy, py = dx; // vetor perpendicular
    const lobes = [
      [cx + dx * 0.034, cy + dy * 0.034], // lóbulo externo
      [cx + px * 0.030, cy + py * 0.030], // lóbulo lateral 1
      [cx - px * 0.030, cy - py * 0.030]  // lóbulo lateral 2
    ];
    for (const [lx, ly] of lobes) {
      const rim = new THREE.Mesh(lobeRimGeo, mRim);
      rim.rotation.x = Math.PI * 0.5;
      rim.position.set(lx, ly, 0);
      g.add(rim);

      const dark = new THREE.Mesh(lobeDarkGeo, mDark);
      dark.rotation.x = Math.PI * 0.5;
      dark.position.set(lx, ly, 0);
      g.add(dark);

      // Relevo do Apóstolo (frente e verso)
      for (const sz of [1, -1]) {
        const hd = new THREE.Mesh(headGeo, mRelief);
        hd.position.set(lx, ly + 0.007, sz * 0.021);
        g.add(hd);
        const bd = new THREE.Mesh(bodyGeo, mRelief);
        bd.position.set(lx, ly - 0.007, sz * 0.020);
        g.add(bd);
      }
    }
  };

  addTrefoilEnd(0, 0.495, 0, 1);    // Topo
  addTrefoilEnd(-0.175, CY, -1, 0);  // Esquerda
  addTrefoilEnd(0.175, CY, 1, 0);    // Direita
  addTrefoilEnd(0, -0.025, 0, -1);  // Base da cruz

  // 3. Auréola / Anel ornamental central atrás do cruzamento + 4 esferas diagonais
  const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.010, 6, 16), mRim);
  ringOuter.position.set(0, CY, 0);
  g.add(ringOuter);
  const ringInner = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 5, 16), mDark);
  ringInner.position.set(0, CY, 0);
  g.add(ringInner);
  const knobGeo = new THREE.SphereGeometry(0.013, 6, 5);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const knob = new THREE.Mesh(knobGeo, mRim);
      knob.position.set(sx * 0.068, CY + sy * 0.068, 0);
      g.add(knob);
    }
  }

  // 4. Cruz interna em relevo + placa INRI
  part(g, 0.022, 0.25, 0.044, BRONZE_RELIEF, 0, CY - 0.02, 0, { em: 0x483506 });
  part(g, 0.19, 0.022, 0.044, BRONZE_RELIEF, 0, CY, 0, { em: 0x483506 });
  part(g, 0.038, 0.022, 0.048, GOLD_RIM, 0, CY + 0.084, 0, { em: 0x3f2e04 });

  // 5. Grande Rubi Vermelho no meio da cruz com engaste dourado
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.068, 0.056, 8), mRim);
  bezel.rotation.x = Math.PI * 0.5;
  bezel.position.set(0, CY, 0);
  g.add(bezel);

  const ruby = new THREE.Mesh(new THREE.OctahedronGeometry(0.054, 0), mRuby);
  ruby.scale.set(1.0, 1.16, 0.96);
  ruby.position.set(0, CY, 0);
  g.add(ruby);

  const rubyCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), mRubyCore);
  rubyCore.scale.set(1.0, 1.14, 0.98);
  rubyCore.position.set(0, CY, 0);
  rubyCore.userData.noSplat = true;
  g.add(rubyCore);

  const rubyGleam = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.062, 0),
    MT(RUBY_HI, { basic: true, tr: 0.32, add: true, nofog: true })
  );
  rubyGleam.scale.set(1.0, 1.16, 0.96);
  rubyGleam.position.set(0, CY, 0);
  rubyGleam.userData.noSplat = true;
  g.add(rubyGleam);

  // 6. Aura Azul Clara Divina
  const auraScale = opts.auraScale != null ? opts.auraScale : 1.0;
  const aura = new THREE.Group();
  aura.position.set(0, CY, 0);
  aura.scale.setScalar(auraScale);

  const mkAuraMesh = (geo, col, tr, rx, ry, rz, px, py, pz) => {
    const m = new THREE.Mesh(geo, MT(col, { basic: true, tr, add: true, dbl: true, nofog: true }));
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.position.set(px || 0, py || 0, pz || 0);
    m.userData.noSplat = true;
    aura.add(m);
    return m;
  };

  // Halo radial azul claro
  mkAuraMesh(new THREE.CircleGeometry(0.17, 20), 0x8ee2ff, 0.30, 0, 0, 0, 0, 0, 0);
  mkAuraMesh(new THREE.CircleGeometry(0.28, 24), 0x55c4ff, 0.16, 0, 0, 0, 0, 0, 0);
  // Silhueta luminosa ao redor da cruz
  mkAuraMesh(BX(0.11, 0.66, 0.065), 0x74d4ff, 0.15, 0, 0, 0, 0, -0.12, 0);
  mkAuraMesh(BX(0.42, 0.11, 0.065), 0x74d4ff, 0.15, 0, 0, 0, 0, 0, 0);
  // 4 raios diagonais divinos
  for (const ang of [Math.PI * 0.25, -Math.PI * 0.25]) {
    mkAuraMesh(new THREE.PlaneGeometry(0.032, 0.44), 0xaef0ff, 0.20, 0, 0, ang, 0, 0, 0);
  }

  g.add(aura);
  g.userData.aura = aura;
  return g;
}

// Sacra Cruz arremessada (mundo)
function buildThrownCross() {
  const g = new THREE.Group();
  const inner = buildPapalCrossMesh({ auraScale: 1.08 });
  inner.position.y = -0.14;
  inner.scale.setScalar(2.45);
  g.add(inner);
  g.userData.aura = inner.userData.aura;
  return g;
}

// Pulso biológico em dois tempos (sístole "lub" + diástole "dub")
function heartPulse(t) {
  const ph = ((t % 1) + 1) % 1;
  const lub = ph < 0.22 ? Math.pow(Math.sin((ph / 0.22) * Math.PI), 1.4) : 0;
  const dub = (ph > 0.26 && ph < 0.44) ? 0.65 * Math.pow(Math.sin(((ph - 0.26) / 0.18) * Math.PI), 1.7) : 0;
  return Math.max(lub, dub);
}
