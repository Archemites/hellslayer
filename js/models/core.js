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
  const legUpper = 0.48 * s, legLower = 0.47 * s;
  rig.legL = limb(root, 0.3 * s * w, legUpper, 0.32 * s, o.legs, -0.2 * s * w, 0.95 * s, 0);
  rig.kneeL = limb(rig.legL, 0.28 * s * w, legLower, 0.3 * s, o.legs, 0, -legUpper, 0);
  rig.legL.userData.subMesh = rig.kneeL.userData.mesh;
  rig.legR = limb(root, 0.3 * s * w, legUpper, 0.32 * s, o.legs, 0.2 * s * w, 0.95 * s, 0);
  rig.kneeR = limb(rig.legR, 0.28 * s * w, legLower, 0.3 * s, o.legs, 0, -legUpper, 0);
  rig.legR.userData.subMesh = rig.kneeR.userData.mesh;
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
  const armUpper = 0.45 * s, armLower = 0.45 * s;
  rig.armL = limb(root, 0.22 * s * w, armUpper, 0.22 * s, o.skin, -0.55 * s * w, 1.8 * s, 0);
  rig.forearmL = limb(rig.armL, 0.2 * s * w, armLower, 0.2 * s, o.skin, 0, -armUpper, 0);
  rig.armL.userData.subMesh = rig.forearmL.userData.mesh;
  rig.armR = limb(root, 0.22 * s * w, armUpper, 0.22 * s, o.skin, 0.55 * s * w, 1.8 * s, 0);
  rig.forearmR = limb(rig.armR, 0.2 * s * w, armLower, 0.2 * s, o.skin, 0, -armUpper, 0);
  rig.armR.userData.subMesh = rig.forearmR.userData.mesh;
  if (o.armsFwd) {
    rig.armL.rotation.x = -1.3; rig.armR.rotation.x = -1.3;
    rig.forearmL.rotation.x = -0.35; rig.forearmR.rotation.x = -0.35;
  }
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
    part(rig.sword, 0.1 * s, 0.14 * s, 0.1 * s, 0x3a2a1a, 0, -0.43 * s, 0);
    part(rig.sword, 0.13 * s, 0.05 * s, 0.12 * s, 0x887020, 0, -0.35 * s, 0);
    part(rig.sword, 0.4 * s, 0.07 * s, 0.1 * s, 0x887020, 0, -0.50 * s, 0);
    part(rig.sword, 0.08 * s, 1.2 * s * sl, 0.03 * s, 0xc0c4cc, 0, -(0.50 + 0.6 * sl) * s, 0, {});
    rig.forearmR.add(rig.sword);
  }
  if (o.pitchfork) {
    rig.pitchfork = new THREE.Group();
    part(rig.pitchfork, 0.06 * s, 1.45 * s, 0.06 * s, 0x5a3a1c, 0, -0.875 * s, 0);
    part(rig.pitchfork, 0.3 * s, 0.06 * s, 0.05 * s, 0x909090, 0, -1.60 * s, 0);
    for (let i = -1; i <= 1; i++) part(rig.pitchfork, 0.04 * s, 0.3 * s, 0.04 * s, 0x909090, i * 0.12 * s, -1.75 * s, 0);
    rig.forearmR.add(rig.pitchfork);
  }
  if (o.shield) {
    rig.shield = new THREE.Group();
    part(rig.shield, 0.1 * s, 1.5 * s, 1.0 * s, o.shield, 0.0, -0.25 * s, 0.1 * s);
    part(rig.shield, 0.12 * s, 0.3 * s, 0.3 * s, 0xc9a227, 0.0, -0.25 * s, 0.1 * s);
    rig.forearmL.add(rig.shield);
  }
  if (o.goldCross) {
    // Super-Cruz Dourada usada como clava
    part(rig.forearmR, 0.1 * s, 0.1 * s, 0.1 * s, 0x5a3820, 0, -0.45 * s, 0);
    rig.weapon = new THREE.Group();
    part(rig.weapon, 0.28 * s, 3.4 * s, 0.28 * s, 0xd4a017, 0, -1.95 * s, 0, { em: 0x3a2800 });
    part(rig.weapon, 1.5 * s, 0.28 * s, 0.28 * s, 0xd4a017, 0, -2.85 * s, 0, { em: 0x3a2800 });
    rig.forearmR.add(rig.weapon);
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

const SKIN_N = 0x2b170e;
const SKIN_HI = 0x3d2215;
const SKIN_SH = 0x1b0d07;

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

// Pulso biológico em dois tempos (sístole "lub" + diástole "dub")
function heartPulse(t) {
  const ph = ((t % 1) + 1) % 1;
  const lub = ph < 0.22 ? Math.pow(Math.sin((ph / 0.22) * Math.PI), 1.4) : 0;
  const dub = (ph > 0.26 && ph < 0.44) ? 0.65 * Math.pow(Math.sin(((ph - 0.26) / 0.18) * Math.PI), 1.7) : 0;
  return Math.max(lub, dub);
}

const BUILD = {};
