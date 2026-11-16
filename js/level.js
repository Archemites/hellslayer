'use strict';
/* ============================================================
   HELLSLAYER - construção dos mapas separados (Beta 1+)
   Convenção: "frente" = -Z.  hall(x1,z1,x2,z2): x1<x2, z1<z2
   ============================================================ */
const World = {
  scene: null, group: null, currentMap: 'a1',
  colliders: [], triggers: [], gates: {}, flames: [], anim: [], meshes: [],
  exitGate: null, breakWall: null, hatch: null, altar: null, portal: null,
  altarCross: null, ghost: null, crossPickup: null, doorMesh: null, skyPortal: null,
  addTrigger(t) {
    World.triggers.push(Object.assign({ active: true, once: true, triggered: false }, t));
  }
};
window.CHAPTERS = window.CHAPTERS || {};

const ENV = {
  hell:   { fog: 0x2a0a08, near: 6,  far: 115, amb: 0x8a5a50, ambI: 1.15, dir: 0xff6a40, dirI: 0.7 },
  church: { fog: 0x160a18, near: 5,  far: 90,  amb: 0x84609a, ambI: 1.4,  dir: 0xaa5080, dirI: 0.5 },
  crypt:  { fog: 0x050c0a, near: 2,  far: 52,  amb: 0x4a7060, ambI: 1.0,  dir: 0x40a080, dirI: 0.35 }
};
function envAt(x, z) {
  if (World.currentMap === 'a6_crypt') return 'crypt';
  if (World.currentMap === 'a6_nave') return 'church';
  return 'hell';
}

function addW(obj) {
  (World.group || World.scene).add(obj);
  return obj;
}

function tiledBox(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
  return g;
}

function wbox(x1, z1, x2, z2, h, tex, o) {
  o = o || {};
  const y0 = o.y0 || 0, tile = o.tile || 4;
  const w = Math.abs(x2 - x1), d = Math.abs(z2 - z1);
  const m = new THREE.Mesh(tiledBox(w, h, d, tile), o.mat || TX.mat(tex));
  m.position.set((x1 + x2) / 2, y0 + h / 2, (z1 + z2) / 2);
  addW(m);
  let col = null;
  if (o.collide !== false) {
    const walkable = o.walkable != null ? o.walkable : (y0 + h <= 2.2);
    col = {
      x1: Math.min(x1, x2), z1: Math.min(z1, z2),
      x2: Math.max(x1, x2), z2: Math.max(z1, z2),
      y0, yMax: y0 + h, walkable, active: true
    };
    World.colliders.push(col);
  }
  m.userData.col = col;
  return m;
}

function wfloor(x1, z1, x2, z2, tex, y, tile) {
  tile = tile || 4;
  const yPos = y || 0;
  const w = x2 - x1, d = z2 - z1;
  const segX = Math.max(1, Math.min(32, Math.round(Math.abs(w) / 12)));
  const segZ = Math.max(1, Math.min(32, Math.round(Math.abs(d) / 12)));
  const g = new THREE.PlaneGeometry(w, d, segX, segZ);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
  g.rotateX(-Math.PI / 2);
  const polyOffset = yPos < 0 ? 2 : (yPos > 0 ? -2 : 0);
  const m = new THREE.Mesh(g, TX.mat(tex, polyOffset));
  m.position.set((x1 + x2) / 2, yPos, (z1 + z2) / 2);
  if (yPos < 0) m.renderOrder = -1;
  else if (yPos > 0) m.renderOrder = 1;
  return addW(m);
}
function wceil(x1, z1, x2, z2, tex, y, tile) {
  tile = tile || 4;
  const w = x2 - x1, d = z2 - z1;
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, TX.mat(tex));
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  return addW(m);
}

function hall(x1, z1, x2, z2, o) {
  const h = o.h || 5, t = o.t || 1, tex = o.wall || 'brick', skip = o.skip || [], ops = o.openings || [];
  const hts = o.heights || {};
  const sides = {
    n: { ax: 'x', f: z1, a: x1 - t / 2, b: x2 + t / 2 },
    s: { ax: 'x', f: z2, a: x1 - t / 2, b: x2 + t / 2 },
    w: { ax: 'z', f: x1, a: z1 + t / 2, b: z2 - t / 2 },
    e: { ax: 'z', f: x2, a: z1 + t / 2, b: z2 - t / 2 }
  };
  for (const k of ['n', 's', 'w', 'e']) {
    if (skip.includes(k)) continue;
    const S = sides[k], H = hts[k] || h;
    const list = ops.filter(p => p.side === k).map(p => ({ a: p.c - p.w / 2, b: p.c + p.w / 2, oh: p.oh || H })).sort((p, q) => p.a - q.a);
    const seg = (sa, sb, y0, hh, collide) => {
      if (sb - sa < 0.01) return;
      if (S.ax === 'x') wbox(sa, S.f - t / 2, sb, S.f + t / 2, hh, tex, { y0, collide });
      else wbox(S.f - t / 2, sa, S.f + t / 2, sb, hh, tex, { y0, collide });
    };
    let cur = S.a;
    for (const p of list) {
      if (p.a > cur) seg(cur, p.a, 0, H, true);
      if (p.oh < H) seg(p.a, p.b, p.oh, H - p.oh, false);
      cur = p.b;
    }
    if (cur < S.b) seg(cur, S.b, 0, H, true);
  }
  if (o.ceil) wceil(x1, z1, x2, z2, o.ceil, h, 8);
  if (o.roof) {
    const w = x2 - x1, d = z2 - z1, m = Math.max(w, d);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(m * 0.78, o.roofH || 3, 4), TX.mat('roof'));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w / m, 1, d / m);
    roof.position.set((x1 + x2) / 2, h + (o.roofH || 3) / 2, (z1 + z2) / 2);
    addW(roof);
    if (o.burn) flame((x1 + x2) / 2, h + (o.roofH || 3) - 0.2, (z1 + z2) / 2, 2.2);
  }
}

function house(cx, cz, w, d, face, o) {
  o = o || {};
  const doorC = (face === 'e' || face === 'w') ? cz : cx;
  const big = (o.h || 4.5) > 5;
  hall(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, {
    h: o.h || 4.5, t: 0.7, wall: o.wall || 'brick', roof: true, burn: o.burn, roofH: big ? 4 : 3,
    openings: [{ side: face, c: doorC, w: big ? 4 : 3, oh: big ? 5 : 3.4 }]
  });
  wfloor(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, o.floor || 'wood', 0.04, 4);
}

function flame(x, y, z, s, cols) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  cols = cols || [0xff5a10, 0xffc030];
  const a = new THREE.Mesh(new THREE.ConeGeometry(0.35 * s, 1.3 * s, 4), MT(cols[0], { basic: true }));
  a.position.y = 0.65 * s;
  const b = new THREE.Mesh(new THREE.ConeGeometry(0.2 * s, 0.9 * s, 4), MT(cols[1], { basic: true }));
  b.position.y = 0.45 * s;
  g.add(a); g.add(b);
  addW(g);
  World.flames.push({ g, ph: Math.random() * 10 });
  return g;
}

function deadTree(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  part(g, 0.5, 5, 0.5, 0x2a1c12, 0, 2.5, 0);
  const b1 = part(g, 0.25, 2.2, 0.25, 0x2a1c12, 0.8, 4.0, 0); b1.rotation.z = -0.9;
  const b2 = part(g, 0.25, 1.8, 0.25, 0x2a1c12, -0.7, 3.4, 0.2); b2.rotation.z = 0.9;
  const b3 = part(g, 0.2, 1.4, 0.2, 0x2a1c12, 0.1, 4.6, -0.6); b3.rotation.x = 0.8;
  addW(g);
  World.colliders.push({ x1: x - 0.4, z1: z - 0.4, x2: x + 0.4, z2: z + 0.4, active: true });
}
function crate(x, z, s) {
  wbox(x - s / 2, z - s / 2, x + s / 2, z + s / 2, s, 'wood', { tile: s });
}
function hay(x, z) {
  wbox(x - 1, z - 1, x + 1, z + 1, 1.6, 'hay', { tile: 2 });
}
function lamp(x, z, cols) {
  wbox(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 4, 'stone', { tile: 2 });
  flame(x, 4, z, 0.8, cols);
}
function barrelFire(x, z) {
  wbox(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 1.1, 'brick', { tile: 1 });
  flame(x, 1.1, z, 1.1);
}
function scarecrow(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  part(g, 0.12, 3, 0.12, 0x5a3a1c, 0, 1.5, 0);
  part(g, 2.2, 0.1, 0.1, 0x5a3a1c, 0, 2.3, 0);
  part(g, 0.5, 0.5, 0.5, 0x8a7020, 0, 3.1, 0);
  part(g, 0.1, 0.08, 0.02, 0xff2200, -0.1, 3.15, 0.26, { basic: true });
  part(g, 0.1, 0.08, 0.02, 0xff2200, 0.1, 3.15, 0.26, { basic: true });
  part(g, 0.9, 1.0, 0.3, 0x4a3a2a, 0, 2.0, 0);
  addW(g);
}
function fountain(cx, cz) {
  wbox(cx - 3.2, cz - 3.2, cx + 3.2, cz + 3.2, 1.2, 'stone', { tile: 2 });
  wbox(cx - 0.6, cz - 0.6, cx + 0.6, cz + 0.6, 5, 'stone', { tile: 2, collide: false });
  const sg = new THREE.Group(); sg.position.set(cx, 5, cz);
  part(sg, 1.2, 1.6, 0.8, 0x6a6a7a, 0, 0.8, 0); part(sg, 0.6, 0.6, 0.6, 0x6a6a7a, 0, 1.9, 0);
  part(sg, 2.4, 0.2, 0.2, 0x6a6a7a, 0, 1.3, 0);
  addW(sg);
}

function makeGate(id, cx, cz, w, axis, h, style) {
  const t = 1.2;
  const col = {
    x1: axis === 'x' ? cx - w / 2 : cx - t / 2, x2: axis === 'x' ? cx + w / 2 : cx + t / 2,
    z1: axis === 'x' ? cz - t / 2 : cz - w / 2, z2: axis === 'x' ? cz + t / 2 : cz + w / 2, active: true
  };
  World.colliders.push(col);
  const grp = new THREE.Group();
  grp.position.set(cx, 0, cz);
  if (style === 'barrier') {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MT(0xff2200, { basic: true, tr: 0.35, add: true, dbl: true }));
    pl.position.y = h / 2;
    grp.add(pl);
    const n = Math.floor(w / 1.2);
    for (let i = 0; i <= n; i++) {
      part(grp, 0.18, h, 0.18, 0x300808, -w / 2 + (i * w) / n, h / 2, 0, { em: 0x400000 });
    }
    part(grp, w, 0.3, 0.3, 0x300808, 0, h - 0.15, 0, { em: 0x400000 });
    if (axis === 'z') grp.rotation.y = Math.PI / 2;
  } else {
    const dm = new THREE.Mesh(tiledBox(w, h, 1.0, 4), TX.mat('door'));
    dm.position.y = h / 2;
    grp.add(dm);
    part(grp, 1.2, h, 0.1, 0xc9a227, 0, h / 2, 0.55);
    part(grp, w, 1.2, 0.1, 0xc9a227, 0, h * 0.7, 0.55);
    World.doorMesh = dm;
  }
  addW(grp);
  World.gates[id] = { col, grp, style, open: false, t: 0, h, axis };
}
function openGate(id) {
  const g = World.gates[id];
  if (!g || g.open) return;
  g.open = true; g.col.active = false; g.t = 0;
}
function closeGateInstant(id) {
  const g = World.gates[id];
  if (!g) return;
  g.open = false; g.col.active = true; g.t = 0;
  g.grp.scale.set(1, 1, 1); g.grp.rotation.x = 0; g.grp.visible = true;
}

/* ---------------- Portão de Saída em Destaque (Intermission Doom-style) ---------------- */
function makeExitGate(cx, cz, nextMap, nextLabel) {
  const grp = new THREE.Group();
  grp.position.set(cx, 0, cz);
  const w = 9.5, h = 8.5;
  // Pilares monumentais dourados/negros
  part(grp, 1.8, h + 1.5, 1.8, 0x221010, -w / 2 - 0.6, (h + 1.5) / 2, 0);
  part(grp, 1.8, h + 1.5, 1.8, 0x221010,  w / 2 + 0.6, (h + 1.5) / 2, 0);
  part(grp, 2.0, 0.5, 2.0, 0xd4a017, -w / 2 - 0.6, h + 1.5, 0, { em: 0x5a3800 });
  part(grp, 2.0, 0.5, 2.0, 0xd4a017,  w / 2 + 0.6, h + 1.5, 0, { em: 0x5a3800 });
  part(grp, w + 3.2, 1.4, 2.0, 0x2a1212, 0, h + 0.6, 0);
  part(grp, w + 1.6, 0.4, 2.2, 0xd4a017, 0, h + 1.4, 0, { em: 0x6a4200 });
  flame(cx - w / 2 - 0.6, h + 1.8, cz, 1.5, [0xffa020, 0xfff080]);
  flame(cx + w / 2 + 0.6, h + 1.8, cz, 1.5, [0xffa020, 0xfff080]);

  // Feixe vertical visível de longe
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 2.4, 55, 8, 1, true),
    MT(0xff3010, { basic: true, tr: 0.22, add: true, dbl: true, nofog: true })
  );
  beam.position.y = 27.5;
  grp.add(beam);

  // Barreira vermelha (trancado) e vórtice dourado/esmeralda (destrancado)
  const lockPl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MT(0xff2200, { basic: true, tr: 0.45, add: true, dbl: true }));
  lockPl.position.y = h / 2;
  grp.add(lockPl);

  const openPl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MT(0x30ff90, { basic: true, tr: 0.55, add: true, dbl: true }));
  openPl.position.y = h / 2;
  openPl.visible = false;
  grp.add(openPl);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.28, 5, 14), MT(0xffd24a, { basic: true }));
  ring.position.y = h / 2;
  ring.visible = false;
  grp.add(ring);

  addW(grp);
  const col = { x1: cx - w / 2 - 1, z1: cz - 1.2, x2: cx + w / 2 + 1, z2: cz + 1.2, active: true };
  World.colliders.push(col);
  World.exitGate = { x: cx, z: cz, r: 7.5, unlocked: false, nextMap, nextLabel, grp, lockPl, openPl, beam, ring, col };
}
function unlockExitGate() {
  const eg = World.exitGate;
  if (!eg || eg.unlocked) return;
  eg.unlocked = true;
  if (eg.col) eg.col.active = false;
  eg.lockPl.visible = false;
  eg.openPl.visible = true;
  eg.ring.visible = true;
  eg.beam.material.color.setHex(0x40ff90);
  eg.beam.material.opacity = 0.35;
}

function addSkyPortal(x, y, z) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(68, 5, 6, 18), MT(0xff3010, { basic: true, nofog: true }));
  ring.position.set(x, y, z); ring.rotation.x = 1.15;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(65, 18), MT(0x701000, { basic: true, tr: 0.7, add: true, dbl: true, nofog: true }));
  disc.position.copy(ring.position); disc.rotation.x = 1.15;
  addW(ring); addW(disc);
  World.skyPortal = ring;
}

/* ============================================================
   MAPA A1: EP. 1 · ÁREA 1 — BAIRRO ALTO (L-loop não-linear, ~195x180)
   ============================================================ */
function buildMapA1() {
  wfloor(-120, -200, 200, 60, 'hellfloor', -0.25, 16);
  // 1. Bairro Sul (Spawn + Casa de Nivaldo) — saída apenas pelo Leste!
  wfloor(-45, -55, 45, 20, 'dirt', 0, 8);
  hall(-45, -55, 45, 20, { h: 7, t: 2, wall: 'brick', skip: ['e'] });
  house(-24, -4, 11, 10, 'e', { burn: true });
  wbox(-29, -9, -27, -6.5, 1, 'wood', { tile: 2 });
  wbox(-25, -2, -23, -0.2, 1.1, 'wood', { tile: 2 });
  house(20, -10, 10, 9, 'w');
  house(-26, -34, 11, 10, 'e', { burn: true });
  house(16, -38, 10, 9, 's');

  // 2. Beco dos Lavradores (Ala Leste: x 45..140, z -55..20)
  wfloor(45, -55, 140, 20, 'dirt', 0, 8);
  wfloor(82, -48, 132, 12, 'crops', 0.04, 6);
  hall(45, -55, 140, 20, { h: 7, t: 2, wall: 'brick', skip: ['w', 'n'] });
  wbox(44, -20, 46, 20, 7, 'brick'); // parede divisória sul deixando passagem em z=-55..-20
  house(68, -4, 12, 10, 'n', { burn: true });
  house(114, -18, 12, 11, 'w');
  house(116, -42, 11, 9, 'w', { burn: true });
  scarecrow(96, -26);

  // 3. Praça do Poço (Ala Nordeste: x 45..140, z -150..-55)
  wfloor(45, -150, 140, -55, 'dirt', 0, 8);
  wfloor(74, -120, 112, -84, 'cobble', 0.02, 5);
  hall(45, -150, 140, -55, { h: 7.5, t: 2, wall: 'brick', skip: ['s', 'w'] });
  fountain(93, -102);
  house(122, -78, 14, 14, 'w', { burn: true, h: 6 });
  house(120, -128, 14, 12, 'w');
  house(64, -132, 12, 11, 's', { burn: true });
  house(66, -72, 10, 10, 'e');

  // 4. Largo do Portão (Ala Noroeste: x -45..45, z -150..-55)
  wfloor(-45, -150, 45, -55, 'dirt', 0, 8);
  wfloor(-28, -145, 2, -95, 'cobble', 0.02, 5);
  hall(-45, -150, 45, -55, { h: 8, t: 2, wall: 'brick', skip: ['e'] });
  house(-28, -82, 12, 11, 'e', { burn: true });
  house(22, -88, 12, 11, 'w');
  house(24, -126, 12, 12, 'w', { burn: true });
  makeExitGate(-15, -142, 'a2', 'CAMPOS DA PERDIÇÃO');

  // Props espalhados
  [[88, -8], [104, -36], [126, -6], [56, -98], [76, -138], [-10, -110]].forEach(p => hay(p[0], p[1]));
  [[-6, -22], [12, -24], [62, -32], [96, -72], [80, -118], [-34, -114], [10, -118], [36, -68]].forEach(p => deadTree(p[0], p[1]));
  [[4, -14], [58, -16], [96, -42], [108, -96], [62, -108], [-12, -74], [-22, -124], [12, -134]].forEach(p => barrelFire(p[0], p[1]));
  [[-8, 4], [8, 4], [52, -36], [84, -76], [106, -122], [-4, -102], [-28, -130]].forEach(p => crate(p[0], p[1], 1.6));
  addSkyPortal(40, 140, -110);
}

/* ============================================================
   MAPA A2: EP. 1 · ÁREA 2 — CAMPOS DA PERDIÇÃO (Ramificado O/L/N, ~260x200)
   ============================================================ */
function buildMapA2() {
  wfloor(-180, -220, 180, 60, 'hellfloor', -0.25, 16);
  // 1. Encruzilhada Central
  wfloor(-45, -80, 45, 20, 'dirt', 0, 8);
  wfloor(-38, -70, -12, -18, 'crops', 0.04, 6);
  wfloor(12, -70, 38, -18, 'crops', 0.04, 6);
  hall(-45, -80, 45, 20, { h: 7, t: 2, wall: 'brick', skip: ['w', 'e'], openings: [{ side: 'n', c: 0, w: 14 }] });
  house(-26, -44, 11, 10, 'e', { burn: true });
  house(26, -46, 11, 10, 'w');

  // 2. Ala Oeste — Moinho & Celeiro Velho (x -135..-45, z -120..0)
  wfloor(-135, -120, -45, 0, 'dirt', 0, 8);
  wfloor(-125, -108, -62, -20, 'crops', 0.04, 6);
  hall(-135, -120, -45, 0, { h: 7, t: 2, wall: 'brick', skip: ['e'], openings: [{ side: 'n', c: -80, w: 14 }] });
  house(-104, -36, 15, 14, 'e', { burn: true, h: 6.5 });
  house(-98, -90, 14, 12, 's');
  house(-64, -74, 11, 10, 'w', { burn: true });
  scarecrow(-82, -56); scarecrow(-116, -66);

  // 3. Ala Leste — Plantações & Celeiro Leste (Foice) (x 45..135, z -120..0)
  wfloor(45, -120, 135, 0, 'dirt', 0, 8);
  wfloor(58, -108, 125, -18, 'crops', 0.04, 6);
  hall(45, -120, 135, 0, { h: 7, t: 2, wall: 'brick', skip: ['w'], openings: [{ side: 'n', c: 82, w: 14 }] });
  house(106, -58, 16, 16, 'w', { burn: true, h: 6.5 }); // Celeiro da Foice
  house(72, -28, 12, 10, 's');
  house(88, -96, 13, 11, 'w', { burn: true });
  scarecrow(74, -64); scarecrow(118, -92);

  // 4. Colina Norte — Estrada dos Corvos (x -105..105, z -185..-80)
  wfloor(-105, -185, 105, -80, 'dirt', 0, 8);
  wfloor(-14, -185, 14, -80, 'cobble', 0.02, 5);
  hall(-105, -185, 105, -80, { h: 8, t: 2, wall: 'stone', skip: ['s'], openings: [] });
  house(-72, -138, 14, 12, 'e', { burn: true, h: 6 });
  house(72, -138, 14, 12, 'w', { burn: true, h: 6 });
  house(-32, -156, 11, 10, 'e');
  house(32, -156, 11, 10, 'w');
  makeExitGate(0, -177, 'a3', 'SUBÚRBIO EXTERIOR');

  [[-22, -26], [22, -26], [-72, -32], [-112, -74], [64, -46], [94, -36], [-48, -120], [48, -120], [0, -126]].forEach(p => hay(p[0], p[1]));
  [[-6, -18], [8, -56], [-56, -54], [-118, -14], [60, -82], [122, -22], [-18, -110], [18, -144], [-58, -166], [58, -166]].forEach(p => deadTree(p[0], p[1]));
  [[0, -10], [-60, -18], [-90, -64], [60, -18], [90, -62], [-20, -128], [20, -128], [0, -158]].forEach(p => barrelFire(p[0], p[1]));
  addSkyPortal(0, 150, -110);
}

/* ============================================================
   MAPA A3: EP. 1 · ÁREA 3 — SUBÚRBIO EXTERIOR (Cidade fortificada, ~260x200)
   ============================================================ */
function buildMapA3() {
  wfloor(-180, -230, 180, 60, 'hellfloor', -0.25, 16);
  // 1. Mercado em Ruínas
  wfloor(-45, -75, 45, 20, 'dirt', 0, 8);
  wfloor(-12, -75, 12, 20, 'cobble', 0.02, 5);
  hall(-45, -75, 45, 20, { h: 8, t: 2, wall: 'brick', skip: ['w', 'e'], openings: [{ side: 'n', c: 0, w: 14 }] });
  house(-28, -22, 12, 10, 'e', { burn: true });
  house(28, -26, 12, 10, 'w');

  // 2. Ala Oeste — Vila Incendiada (x -130..-45, z -130..-15)
  wfloor(-130, -130, -45, -15, 'dirt', 0, 8);
  hall(-130, -130, -45, -15, { h: 8, t: 2, wall: 'brick', skip: ['e'], openings: [{ side: 'n', c: -82, w: 14 }] });
  house(-98, -42, 14, 12, 'e', { burn: true });
  house(-104, -88, 14, 14, 'e', { burn: true, h: 6 });
  house(-66, -106, 12, 10, 's');

  // 3. Ala Leste — Quartel dos Guardas (x 45..130, z -130..-15)
  wfloor(45, -130, 130, -15, 'cobble', 0, 6);
  hall(45, -130, 130, -15, { h: 8.5, t: 2, wall: 'stone', skip: ['w'], openings: [{ side: 'n', c: 82, w: 14 }] });
  house(98, -44, 15, 13, 'w', { wall: 'stone', h: 6.5 });
  house(102, -92, 16, 14, 'w', { wall: 'stone', h: 6.5, burn: true });
  house(68, -108, 12, 10, 's', { wall: 'stone', h: 6 });

  // 4. Bastião Norte (x -105..105, z -195..-115)
  wfloor(-105, -195, 105, -115, 'cobble', 0, 6);
  hall(-105, -195, 105, -115, { h: 9, t: 2, wall: 'stone', skip: ['s'] });
  house(-66, -154, 15, 14, 'e', { wall: 'stone', h: 7, burn: true });
  house(66, -154, 15, 14, 'w', { wall: 'stone', h: 7, burn: true });
  wbox(-24, -148, -18, -142, 5, 'stone', { tile: 2 });
  wbox(18, -148, 24, -142, 5, 'stone', { tile: 2 });
  makeExitGate(0, -187, 'a4', 'CASARÕES DOS SUPER-RICOS');

  [[-12, -16], [12, -16], [-12, -52], [12, -52], [62, -46], [62, -88], [-22, -135], [22, -135], [-22, -170], [22, -170]].forEach(p => lamp(p[0], p[1]));
  [[-6, -34], [6, -34], [-80, -64], [80, -64], [0, -156], [-42, -168], [42, -168]].forEach(p => barrelFire(p[0], p[1]));
  [[-10, -62], [10, -62], [-76, -34], [78, -34], [-14, -138], [14, -138]].forEach(p => crate(p[0], p[1], 1.7));
  addSkyPortal(0, 150, -120);
}

/* ============================================================
   MAPA A4: EP. 2 · ÁREA 4 — CASARÕES DOS SUPER-RICOS (~280x210)
   ============================================================ */
function buildMapA4() {
  wfloor(-200, -240, 200, 60, 'hellfloor', -0.25, 16);
  // 1. Praça da Fonte
  wfloor(-55, -90, 55, 20, 'cobble', 0, 6);
  hall(-55, -90, 55, 20, { h: 9, t: 2, wall: 'stone', skip: ['w', 'e'], openings: [{ side: 'n', c: 0, w: 16 }] });
  fountain(0, -34);
  house(-36, -18, 16, 14, 'e', { wall: 'stone', h: 7, floor: 'marble', burn: true });
  house(36, -18, 16, 14, 'w', { wall: 'stone', h: 7, floor: 'marble', burn: true });

  // 2. Ala Oeste — Mansão do Duque (Martelo de Demolição) (x -140..-55, z -140..-20)
  wfloor(-140, -140, -55, -20, 'cobble', 0, 6);
  hall(-140, -140, -55, -20, { h: 9, t: 2, wall: 'stone', skip: ['e'], openings: [{ side: 'n', c: -92, w: 14 }] });
  house(-112, -80, 24, 24, 'e', { wall: 'stone', h: 8, floor: 'marble', burn: true }); // Mansão do Martelo
  house(-80, -38, 16, 14, 's', { wall: 'stone', h: 7, floor: 'marble' });
  house(-82, -120, 16, 14, 'n', { wall: 'stone', h: 7, floor: 'marble', burn: true });

  // 3. Ala Leste — Jardins & Vilas em Chamas (x 55..140, z -140..-20)
  wfloor(55, -140, 140, -20, 'cobble', 0, 6);
  hall(55, -140, 140, -20, { h: 9, t: 2, wall: 'stone', skip: ['w'], openings: [{ side: 'n', c: 92, w: 14 }] });
  house(112, -80, 22, 22, 'w', { wall: 'stone', h: 8, floor: 'marble', burn: true });
  house(80, -38, 16, 14, 's', { wall: 'stone', h: 7, floor: 'marble', burn: true });
  house(82, -120, 16, 14, 'n', { wall: 'stone', h: 7, floor: 'marble' });
  fountain(78, -80);

  // 4. Terraço Nobre (x -110..110, z -200..-130)
  wfloor(-110, -200, 110, -130, 'cobble', 0, 6);
  hall(-110, -200, 110, -130, { h: 9.5, t: 2, wall: 'stone', skip: ['s'] });
  house(-68, -166, 18, 16, 'e', { wall: 'stone', h: 7.5, floor: 'marble', burn: true });
  house(68, -166, 18, 16, 'w', { wall: 'stone', h: 7.5, floor: 'marble', burn: true });
  makeExitGate(0, -192, 'a5', 'AVENIDA DO HORROR');

  [[-16, -12], [16, -12], [-16, -58], [16, -58], [-74, -64], [-74, -98], [74, -64], [74, -98], [-22, -150], [22, -150]].forEach(p => lamp(p[0], p[1]));
  [[-26, -34], [26, -34], [-90, -80], [98, -80], [0, -162], [-36, -176], [36, -176]].forEach(p => barrelFire(p[0], p[1]));
  [[-10, -70], [10, -70], [-66, -48], [66, -48], [0, -142]].forEach(p => crate(p[0], p[1], 1.7));
  addSkyPortal(0, 150, -130);
}

/* ============================================================
   MAPA A5: EP. 2 · ÁREA 5 — AVENIDA DO HORROR (~280x220)
   ============================================================ */
function buildMapA5() {
  wfloor(-200, -250, 200, 60, 'hellfloor', -0.25, 16);
  // 1. Avenida Destruída
  wfloor(-48, -90, 48, 20, 'cobble', 0, 6);
  hall(-48, -90, 48, 20, { h: 9, t: 2, wall: 'stone', skip: ['w', 'e'], openings: [{ side: 'n', c: 0, w: 14 }] });
  // Obelisco central
  wbox(-2.5, -42.5, 2.5, -37.5, 1.4, 'stone', { tile: 2 });
  wbox(-1.1, -41.1, 1.1, -38.9, 12, 'church', { y0: 1.4, tile: 2 });
  flame(0, 13.4, -40, 1.7);

  // 2. Ala Oeste — Beco das Gárgulas (x -140..-48, z -145..-25)
  wfloor(-140, -145, -48, -25, 'cobble', 0, 6);
  hall(-140, -145, -48, -25, { h: 9.5, t: 2, wall: 'stone', skip: ['e'], openings: [{ side: 'n', c: -92, w: 14 }] });
  house(-110, -60, 18, 16, 'e', { wall: 'stone', h: 8, floor: 'marble', burn: true });
  house(-112, -112, 18, 16, 'e', { wall: 'stone', h: 8, floor: 'marble', burn: true });
  house(-70, -86, 14, 14, 'w', { wall: 'stone', h: 7, floor: 'marble' });

  // 3. Ala Leste — Ninho dos Padres (x 48..140, z -145..-25)
  wfloor(48, -145, 140, -25, 'cobble', 0, 6);
  hall(48, -145, 140, -25, { h: 9.5, t: 2, wall: 'stone', skip: ['w'], openings: [{ side: 'n', c: 92, w: 14 }] });
  house(110, -60, 18, 16, 'w', { wall: 'church', h: 8.5, floor: 'marble', burn: true });
  house(112, -112, 18, 16, 'w', { wall: 'church', h: 8.5, floor: 'marble', burn: true });
  house(70, -86, 14, 14, 'e', { wall: 'stone', h: 7, floor: 'marble' });

  // 4. Esplanada da Ultra-Igreja (x -110..110, z -210..-135)
  wfloor(-110, -210, 110, -135, 'cobble', 0, 6);
  hall(-110, -210, 110, -135, { h: 10, t: 2, wall: 'stone', skip: ['s'] });
  [-152, -178].forEach(z => [-20, 20].forEach(x => {
    wbox(x - 1, z - 1, x + 1, z + 1, 9, 'church', { tile: 2 });
    flame(x, 9, z, 1.3);
  }));
  house(-72, -172, 16, 16, 'e', { wall: 'church', h: 8, floor: 'marble', burn: true });
  house(72, -172, 16, 16, 'w', { wall: 'church', h: 8, floor: 'marble', burn: true });
  makeExitGate(0, -202, 'a6_gate', 'PORTÕES DA ULTRA-IGREJA');

  [[-14, -18], [14, -18], [-14, -64], [14, -64], [-86, -48], [86, -48], [-32, -162], [32, -162]].forEach(p => lamp(p[0], p[1]));
  [[-26, -40], [26, -40], [-88, -86], [88, -86], [0, -166], [-44, -188], [44, -188]].forEach(p => barrelFire(p[0], p[1]));
  addSkyPortal(0, 155, -140);
}

/* ============================================================
   MAPA A6_GATE: EP. 3 · ÁREA 6 — PORTÕES DA ULTRA-IGREJA (~230x185)
   ============================================================ */
function buildMapA6Gate() {
  wfloor(-180, -220, 180, 60, 'hellfloor', -0.25, 16);
  // Pátio Principal
  wfloor(-55, -170, 55, 20, 'cobble', 0, 6);
  hall(-55, -170, 55, 20, { h: 9.5, t: 2, wall: 'stone', skip: ['w', 'e'], heights: { n: 26 }, openings: [{ side: 'n', c: 0, w: 12, oh: 12 }] });
  makeGate('door', 0, -169, 12, 'x', 12, 'door');

  // Claustro Oeste & Claustro Leste (alas laterais)
  wfloor(-118, -125, -55, -25, 'cobble', 0, 6);
  hall(-118, -125, -55, -25, { h: 9.5, t: 2, wall: 'church', skip: ['e'] });
  house(-92, -75, 16, 18, 'e', { wall: 'church', h: 8, floor: 'marble', burn: true });

  wfloor(55, -125, 118, -25, 'cobble', 0, 6);
  hall(55, -125, 118, -25, { h: 9.5, t: 2, wall: 'church', skip: ['w'] });
  house(92, -75, 16, 18, 'w', { wall: 'church', h: 8, floor: 'marble', burn: true });

  // Colunata & Pira central
  [-28, -56, -84, -112, -140].forEach(z => [-18, 18].forEach(x => {
    wbox(x - 1.1, z - 1.1, x + 1.1, z + 1.1, 10, 'church', { tile: 2 });
    flame(x, 10, z, 1.3);
  }));
  wbox(-2.8, -77.8, 2.8, -72.2, 1.2, 'church', { tile: 2 });
  flame(0, 1.2, -75, 2.0);

  // Mega-Estrutura da Ultra-Igreja
  wbox(-30, -173, 30, -167, 16, 'church', { y0: 26, tile: 4, collide: false });
  wbox(-55, -173, -34, -167, 74, 'church', { tile: 4, collide: false });
  wbox(34, -173, 55, -167, 74, 'church', { tile: 4, collide: false });
  wbox(-50, -172, -38, -168, 16, 'church', { y0: 74, tile: 3, collide: false });
  wbox(38, -172, 50, -168, 16, 'church', { y0: 74, tile: 3, collide: false });
  [-44, 44].forEach(tx => {
    const spire = new THREE.Mesh(new THREE.ConeGeometry(5, 18, 4), TX.mat('roof'));
    spire.rotation.y = Math.PI / 4;
    spire.position.set(tx, 98, -170);
    addW(spire);
    flame(tx, 74.5, -166.5, 2.4);
  });
  const topCross = new THREE.Group(); topCross.position.set(0, 42, -168);
  part(topCross, 1.8, 22, 1.8, 0xd4a017, 0, 11, 0, { em: 0x5a2800 });
  part(topCross, 11, 1.8, 1.8, 0xd4a017, 0, 15, 0, { em: 0x5a2800 });
  addW(topCross);
  const rose = new THREE.Mesh(new THREE.CircleGeometry(5.2, 12), MT(0xff3a10, { basic: true }));
  rose.position.set(0, 20, -168.7);
  addW(rose);

  [[-36, -148], [36, -148], [-36, -102], [36, -102]].forEach(p => deadTree(p[0], p[1]));
  addSkyPortal(0, 150, -100);
}

/* ============================================================
   MAPA A6_NAVE: EP. 3 · ÁREA 6 — NAVE DA ULTRA-IGREJA (Em cruz, com transeptos)
   ============================================================ */
function openAltar(instant) {
  const a = World.altar;
  if (!a) return;
  a.open = true;
  if (instant) a.t = 1;
  const s = a.t * a.t * (3 - 2 * a.t);
  const slide = s * 3.4;
  a.leftGrp.position.x = -slide;
  a.rightGrp.position.x = slide;
  a.colL.x1 = -7.0 - slide; a.colL.x2 = -slide; a.colL.walkable = false;
  a.colR.x1 = slide; a.colR.x2 = 7.0 + slide; a.colR.walkable = false;
  if (World.hatch) { World.hatch.active = true; World.hatch.g.visible = true; }
}
function closeAltarInstant() {
  const a = World.altar;
  if (!a) return;
  a.open = false; a.t = 0;
  a.leftGrp.position.x = 0;
  a.rightGrp.position.x = 0;
  a.colL.x1 = -7.0; a.colL.x2 = 0; a.colL.walkable = true;
  a.colR.x1 = 0; a.colR.x2 = 7.0; a.colR.walkable = true;
  if (World.hatch) { World.hatch.active = false; World.hatch.g.visible = false; }
}

function buildMapA6Nave() {
  // Nave principal (x: -28..28, z: -150..0)
  wfloor(-28, -136, 28, 0, 'marble', 0, 8);
  wfloor(-28, -150, -3, -136, 'marble', 0, 8);
  wfloor(3, -150, 28, -136, 'marble', 0, 8);
  wfloor(-3, -150, 3, -148.5, 'marble', 0, 8);
  hall(-28, -150, 28, 0, {
    h: 19, t: 2, wall: 'church', ceil: 'dark',
    openings: [{ side: 'w', c: -102, w: 20 }, { side: 'w', c: -60, w: 22 }, { side: 'e', c: -60, w: 22 }]
  });

  // Transepto Oeste & Transepto Leste (catedral em formato de cruz)
  wfloor(-66, -78, -28, -42, 'marble', 0, 8);
  hall(-66, -78, -28, -42, { h: 17, t: 2, wall: 'church', skip: ['e'], ceil: 'dark' });
  wfloor(28, -78, 66, -42, 'marble', 0, 8);
  hall(28, -78, 66, -42, { h: 17, t: 2, wall: 'church', skip: ['w'], ceil: 'dark' });

  // Pilares & Bancos
  [-22, -40, -58, -78, -98, -118, -134].forEach(z => [-15, 15].forEach(x => wbox(x - 0.9, z - 0.9, x + 0.9, z + 0.9, 19, 'church', { tile: 3 })));
  for (let z = -18; z > -130; z -= 7) {
    wbox(-9.5, z - 0.5, -3.5, z + 0.5, 0.9, 'wood', { tile: 2, collide: false });
    wbox(3.5, z - 0.5, 9.5, z + 0.5, 0.9, 'wood', { tile: 2, collide: false });
  }

  // Escadaria subterrânea oculta sob o centro do altar (x: -3..3, z: -148.5..-136)
  wbox(-3.4, -148.6, -3.0, -136.0, 4.2, 'crypt', { y0: -4.2, tile: 2, collide: false });
  wbox(3.0, -148.6, 3.4, -136.0, 4.2, 'crypt', { y0: -4.2, tile: 2, collide: false });
  wbox(-3.4, -148.9, 3.4, -148.5, 4.2, 'crypt', { y0: -4.2, tile: 2, collide: false });
  for (let i = 0; i < 10; i++) {
    const z1 = -136.0 - (i + 1) * 1.0, z2 = -136.0 - i * 1.0;
    const yTop = -(i + 1) * 0.32;
    wbox(-3.0, z1, 3.0, z2, 1.2, i % 2 === 0 ? 'marble' : 'stone', { y0: yTop - 1.2, tile: 2, walkable: true });
  }
  wbox(-3.0, -148.5, 3.0, -146.0, 1.2, 'bonefloor', { y0: -3.4 - 1.2, tile: 2, walkable: true });
  const cryptDoor = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), MT(0x051812, { basic: true }));
  cryptDoor.position.set(0, -1.8, -148.42);
  addW(cryptDoor);
  const cryptGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.8), MT(0x30ffc0, { basic: true, tr: 0.38, add: true }));
  cryptGlow.position.set(0, -1.8, -148.38);
  addW(cryptGlow);
  flame(-2.2, -1.9, -147.6, 0.75, [0x40ffd0, 0xc0fff0]);
  flame(2.2, -1.9, -147.6, 0.75, [0x40ffd0, 0xc0fff0]);

  // Altar bipartido
  const mkAltarHalf = (side) => {
    const g = new THREE.Group();
    const b1 = new THREE.Mesh(tiledBox(7.0, 0.45, 12.8, 3), TX.mat('marble'));
    b1.position.set(side * 3.5, 0.225, -142.2); g.add(b1);
    const b2 = new THREE.Mesh(tiledBox(6.0, 1.1, 10.6, 3), TX.mat('marble'));
    b2.position.set(side * 3.0, 1.0, -142.5); g.add(b2);
    const b3 = new THREE.Mesh(tiledBox(6.3, 0.26, 11.2, 3), TX.mat('marble'));
    b3.position.set(side * 3.15, 1.68, -142.5); g.add(b3);
    part(g, 0.32, 1.42, 11.25, 0xd4a017, side * 0.16, 1.13, -142.5, { em: 0x3a2800 });
    part(g, 5.8, 0.22, 0.14, 0xd4a017, side * 3.0, 1.15, -137.15, { em: 0x3a2800 });
    part(g, 0.5, 0.9, 0.5, 0xd4a017, side * 4.6, 2.25, -142.5, { em: 0x3a2800 });
    addW(g);
    return g;
  };
  const leftGrp = mkAltarHalf(-1);
  const rightGrp = mkAltarHalf(1);
  const colL = { x1: -7.0, z1: -148.6, x2: 0, z2: -135.8, y0: 0, yMax: 1.85, walkable: true, active: true };
  const colR = { x1: 0, z1: -148.6, x2: 7.0, z2: -135.8, y0: 0, yMax: 1.85, walkable: true, active: true };
  World.colliders.push(colL, colR);
  World.altar = {
    leftGrp, rightGrp, colL, colR, open: false, t: 0,
    pit: { x1: -2.9, x2: 2.9, z1: -148.6, z2: -135.8 }
  };

  // Super-Cruz Dourada decorativa atrás do altar
  const ac = new THREE.Group(); ac.position.set(0, 0, -146.5);
  part(ac, 1.3, 15, 1.3, 0xd4a017, 0, 8.5, 0, { em: 0x4a3400 });
  part(ac, 7, 1.3, 1.3, 0xd4a017, 0, 12, 0, { em: 0x4a3400 });
  addW(ac); World.altarCross = ac;
  const cols = [0xcc2020, 0x8a30cc, 0xd0a020, 0x2050d0];
  [-24, -44, -84, -104, -124].forEach((z, i) => {
    [-1, 1].forEach(side => {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(4, 8), MT(cols[(i + (side > 0 ? 1 : 0)) % 4], { basic: true, tr: 0.85 }));
      gl.position.set(side * 26.9, 10, z);
      gl.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      addW(gl);
    });
  });
  [[-24, -10], [24, -10], [-60, -60], [60, -60], [-24, -140], [24, -140]].forEach(p => {
    wbox(p[0] - 0.5, p[1] - 0.5, p[0] + 0.5, p[1] + 0.5, 1.3, 'church', { tile: 1 });
    flame(p[0], 1.3, p[1], 1.1, [0x8a30ff, 0xffa0ff]);
  });

  // parede que Galius vai explodir
  World.breakWall = wbox(-29, -112, -27, -92, 19, 'church', { tile: 3 });
  wfloor(-64, -118, -28, -86, 'hellfloor', 0.02, 6);
  wceil(-64, -118, -28, -86, 'dark', 19, 8);
  hall(-64, -118, -29, -86, { h: 19, t: 2, wall: 'crypt', skip: ['e'] });

  const hatchBeam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 12, 11.5), MT(0x40ffd0, { basic: true, tr: 0.16, add: true, dbl: true }));
  hatchBeam.position.set(0, 4.5, -142.2);
  const hg = new THREE.Group(); hg.add(hatchBeam);
  hg.visible = false; addW(hg);
  World.hatch = { g: hg, x: 0, z: -140, r: 3.2, active: false };

  const pg = new THREE.Group(); pg.position.set(0, 0, -130);
  const pc = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 9, 8, 1, true), MT(0x30ff70, { basic: true, tr: 0.45, add: true, dbl: true }));
  pc.position.y = 4.5;
  const pr = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.35, 5, 12), MT(0x90ffb0, { basic: true }));
  pr.position.y = 4.5; pr.rotation.x = 0;
  pg.add(pc); pg.add(pr);
  pg.visible = false; addW(pg);
  World.portal = { g: pg, ring: pr, x: 0, z: -130, r: 3, active: false };
}

/* ============================================================
   MAPA A6_CRYPT: EP. 3 · ÁREA 6 — CATACUMBAS DE ROMULUS III (Labirinto L->N->O)
   ============================================================ */
function buildMapA6Crypt() {
  const fl = (x1, z1, x2, z2) => wfloor(x1, z1, x2, z2, 'bonefloor', 0, 8);
  const gc = [0x40ffd0, 0xc0fff0];
  // 1. Sala A: Entrada (x -14..14, z -28..0) -> saída Leste (z -18..-10)
  fl(-14, -28, 14, 0);
  hall(-14, -28, 14, 0, { h: 6.5, t: 1, wall: 'crypt', ceil: 'dark', openings: [{ side: 'e', c: -14, w: 6 }] });
  // Corredor 1 (Leste: x 14..36, z -17..-11)
  fl(14, -17, 36, -11); wceil(14, -17, 36, -11, 'dark', 6.5, 8);
  wbox(14, -18, 36, -17, 6.5, 'crypt'); wbox(14, -11, 36, -10, 6.5, 'crypt');
  makeGate('g_c1', 14, -14, 6, 'z', 6.5, 'barrier');

  // 2. Sala B: Salão dos Mortos (x 36..80, z -42..6) -> saída Norte (x 58)
  fl(36, -42, 80, 6);
  hall(36, -42, 80, 6, { h: 7.5, t: 1, wall: 'crypt', ceil: 'dark', openings: [{ side: 'w', c: -14, w: 6 }, { side: 'n', c: 58, w: 6 }] });
  [[46, -4], [70, -4], [46, -32], [70, -32]].forEach(p => wbox(p[0] - 1, p[1] - 1, p[0] + 1, p[1] + 1, 7.5, 'crypt', { tile: 2 }));
  [[52, -18], [64, -18]].forEach(p => wbox(p[0] - 1, p[1] - 2.5, p[0] + 1, p[1] + 2.5, 1.2, 'stone', { tile: 2 }));
  [[40, 2], [76, 2], [40, -38], [76, -38]].forEach(p => { wbox(p[0] - 0.4, p[1] - 0.4, p[0] + 0.4, p[1] + 0.4, 1.2, 'crypt', { tile: 1 }); flame(p[0], 1.2, p[1], 0.9, gc); });
  makeGate('g_c2', 58, -42, 6, 'x', 7.5, 'barrier');

  // Corredor 2 (Norte: x 55..61, z -64..-42)
  fl(55, -64, 61, -42); wceil(55, -64, 61, -42, 'dark', 6.5, 8);
  wbox(54, -64, 55, -42, 6.5, 'crypt'); wbox(61, -64, 62, -42, 6.5, 'crypt');

  // 3. Sala C: Galeria dos Ossos (x 38..78, z -108..-64) -> saída Oeste (z -86)
  fl(38, -108, 78, -64);
  hall(38, -108, 78, -64, { h: 8, t: 1, wall: 'crypt', ceil: 'dark', openings: [{ side: 's', c: 58, w: 6 }, { side: 'w', c: -86, w: 6 }] });
  [[48, -74], [68, -74], [48, -98], [68, -98]].forEach(p => wbox(p[0] - 1, p[1] - 1, p[0] + 1, p[1] + 1, 8, 'crypt', { tile: 2 }));
  [[42, -68], [74, -68], [42, -104], [74, -104]].forEach(p => { wbox(p[0] - 0.4, p[1] - 0.4, p[0] + 0.4, p[1] + 0.4, 1.3, 'crypt', { tile: 1 }); flame(p[0], 1.3, p[1], 0.95, gc); });
  makeGate('g_c3', 38, -86, 6, 'z', 8, 'barrier');

  // Corredor 3 (Oeste: x 16..38, z -89..-83)
  fl(16, -89, 38, -83); wceil(16, -89, 38, -83, 'dark', 6.5, 8);
  wbox(16, -90, 38, -89, 6.5, 'crypt'); wbox(16, -83, 38, -82, 6.5, 'crypt');

  // 4. Câmara Sacra de Romulus III (x -22..16, z -106..-66)
  fl(-22, -106, 16, -66);
  hall(-22, -106, 16, -66, { h: 9.5, t: 1, wall: 'crypt', ceil: 'dark', openings: [{ side: 'e', c: -86, w: 6 }] });
  wbox(-8, -90, 0, -82, 1.4, 'marble', { tile: 3 });
  wbox(-7, -89, -1, -83, 0.6, 'stone', { tile: 2, y0: 1.4, collide: false });
  [[-18, -70], [12, -70], [-18, -102], [12, -102]].forEach(p => { wbox(p[0] - 0.5, p[1] - 0.5, p[0] + 0.5, p[1] + 0.5, 1.6, 'crypt', { tile: 1 }); flame(p[0], 1.6, p[1], 1.0, gc); });
  const cg = buildThrownCross(); cg.position.set(-4, 3.0, -86); cg.scale.set(0.7, 0.7, 0.7);
  addW(cg); World.crossPickup = cg;
  const gh = new THREE.Group(); gh.position.set(-12, 2.6, -86);
  gh.rotation.y = Math.PI / 2;
  const gm = { basic: true, tr: 0.45, add: true };
  part(gh, 1.2, 1.8, 0.7, 0x80c8ff, 0, 0, 0, gm);
  part(gh, 0.8, 0.8, 0.8, 0xb0e0ff, 0, 1.4, 0, gm);
  part(gh, 0.9, 0.4, 0.9, 0xffe080, 0, 1.95, 0, gm);
  part(gh, 0.9, 0.1, 0.1, 0x000000, 0, 1.45, 0.41, { basic: true });
  part(gh, 0.3, 1.0, 0.3, 0x80c8ff, -0.75, -0.1, 0, gm);
  part(gh, 0.3, 1.0, 0.3, 0x80c8ff, 0.75, -0.1, 0, gm);
  addW(gh); World.ghost = gh;
}

/* ============ SPAWNS & PICKUPS POR MAPA ============ */
const SPAWNS = {
  a1: [
    // Bairro Sul
    ['campones', -8, -16], ['campones', 12, -14], ['campones', -30, -14], ['campones', 20, -28], ['campones', -10, -40],
    ['diabrete', 0, -26, 3], ['diabrete', -18, -44, 3.5],
    // Beco dos Lavradores (Leste)
    ['campones', 62, -16], ['campones', 88, -10], ['campones', 112, -28], ['campones', 96, -42], ['campones', 126, -12],
    ['diabrete', 76, -24, 3], ['diabrete', 116, -34, 3.5], ['diabrete', 92, -6, 3],
    // Praça do Poço (Nordeste)
    ['campones', 74, -84], ['campones', 110, -84], ['campones', 92, -122], ['campones', 62, -112],
    ['diabrete', 92, -92, 3.5], ['diabrete', 118, -110, 3], ['gargula', 92, -108, 4],
    // Largo do Portão (Noroeste)
    ['campones', 12, -96], ['campones', -22, -108], ['diabrete', 0, -118, 3.5],
    ['guarda', -15, -126], ['guarda', 10, -130], ['guarda', -28, -132]
  ],
  a2: [
    // Encruzilhada Central
    ['campones', -12, -18], ['campones', 14, -22], ['campones', 0, -48], ['diabrete', -16, -54, 3], ['diabrete', 16, -54, 3],
    // Ala Oeste
    ['campones', -66, -34], ['campones', -88, -50], ['campones', -112, -70], ['campones', -78, -96],
    ['diabrete', -94, -36, 3.5], ['diabrete', -68, -64, 3], ['gargula', -96, -68, 4.5], ['guarda', -106, -98],
    // Ala Leste (Celeiro da Foice)
    ['campones', 68, -42], ['campones', 92, -56], ['campones', 114, -80], ['campones', 78, -98],
    ['diabrete', 90, -34, 3], ['diabrete', 112, -48, 3.5], ['gargula', 96, -72, 4.5], ['guarda', 96, -104],
    // Colina Norte
    ['campones', -40, -128], ['campones', 40, -128], ['diabrete', -22, -148, 3.5], ['diabrete', 22, -148, 3.5],
    ['gargula', 0, -138, 5], ['gargula', -54, -158, 4.5], ['gargula', 54, -158, 4.5],
    ['guarda', -12, -160], ['guarda', 12, -160], ['guarda', 0, -168]
  ],
  a3: [
    // Mercado em Ruínas
    ['campones', -14, -22], ['campones', 14, -22], ['diabrete', 0, -42, 3], ['guarda', -12, -58], ['guarda', 12, -58],
    // Ala Oeste (Vila Incendiada)
    ['campones', -72, -44], ['campones', -96, -66], ['campones', -78, -98],
    ['diabrete', -88, -48, 3.5], ['diabrete', -108, -82, 3], ['guarda', -84, -112], ['gargula', -90, -74, 4.5],
    // Ala Leste (Quartel dos Guardas)
    ['guarda', 68, -42], ['guarda', 92, -62], ['guarda', 104, -88], ['guarda', 76, -108],
    ['diabrete', 82, -46, 3], ['gargula', 96, -72, 4.5], ['campones', 66, -78],
    // Bastião Norte
    ['guarda', -32, -140], ['guarda', 32, -140], ['guarda', -14, -168], ['guarda', 14, -168],
    ['diabrete', -50, -156, 3.5], ['diabrete', 50, -156, 3.5],
    ['gargula', 0, -146, 5], ['gargula', -40, -172, 4.5], ['gargula', 40, -172, 4.5],
    ['demonio', -18, -176], ['demonio', 18, -176]
  ],
  a4: [
    // Praça da Fonte
    ['campones', -18, -22], ['campones', 18, -22], ['guarda', -22, -50], ['guarda', 22, -50], ['gargula', 0, -44, 4.5],
    // Ala Oeste (Mansão do Duque)
    ['guarda', -76, -54], ['guarda', -94, -104], ['demonio', -102, -74], ['demonio', -84, -88], ['demonio', -110, -118],
    ['gargula', -88, -62, 4.5], ['gargula', -104, -96, 4.5], ['diabrete', -72, -114, 3],
    // Ala Leste (Vilas & Jardins)
    ['guarda', 76, -54], ['guarda', 94, -104], ['demonio', 102, -74], ['demonio', 84, -88], ['demonio', 110, -118],
    ['gargula', 88, -62, 4.5], ['gargula', 104, -96, 4.5], ['padre', 96, -116],
    // Terraço Nobre
    ['demonio', -36, -156], ['demonio', 36, -156], ['demonio', 0, -174],
    ['guarda', -20, -168], ['guarda', 20, -168], ['padre', -48, -180], ['padre', 48, -180],
    ['gargula', 0, -152, 5], ['gargula', -50, -166, 4.5], ['gargula', 50, -166, 4.5]
  ],
  a5: [
    // Avenida Destruída
    ['diabrete', -12, -24, 3], ['diabrete', 12, -24, 3], ['guarda', -18, -56], ['guarda', 18, -56], ['demonio', 0, -64],
    // Ala Oeste (Beco das Gárgulas)
    ['gargula', -76, -56, 4.5], ['gargula', -104, -82, 5], ['gargula', -88, -116, 4.5],
    ['demonio', -96, -64], ['demonio', -96, -108], ['guarda', -72, -96], ['diabrete', -114, -90, 3.5],
    // Ala Leste (Ninho dos Padres)
    ['padre', 78, -58], ['padre', 104, -86], ['padre', 92, -118],
    ['demonio', 96, -64], ['demonio', 96, -108], ['guarda', 72, -96], ['gargula', 88, -96, 4.5],
    // Esplanada da Ultra-Igreja
    ['demonio', -38, -164], ['demonio', 38, -164], ['demonio', 0, -184],
    ['padre', -26, -186], ['padre', 26, -186], ['guarda', -54, -184], ['guarda', 54, -184],
    ['gargula', -18, -168, 5], ['gargula', 18, -168, 5]
  ],
  a6_gate: [
    // Pátio + Claustros + Maximus
    ['guarda', -16, -34], ['guarda', 16, -34], ['padre', -26, -62], ['padre', 26, -62],
    ['demonio', -84, -70], ['padre', -76, -92], ['gargula', -86, -80, 5],
    ['demonio', 84, -70], ['padre', 76, -92], ['gargula', 86, -80, 5],
    ['guarda', -18, -118], ['guarda', 18, -118], ['gargula', 0, -110, 5],
    ['maximus', 0, -148]
  ],
  a6_nave: [
    ['demonio', -10, -28], ['demonio', 10, -32], ['diabrete', -6, -24, 3], ['diabrete', 6, -24, 3],
    ['demonio', -46, -60], ['gargula', -50, -56, 5], ['padre', -54, -66],
    ['demonio', 46, -60], ['gargula', 50, -56, 5], ['padre', 54, -66],
    ['demonio', 0, -92], ['gargula', -14, -84, 5], ['gargula', 14, -84, 5],
    ['padre', -16, -118], ['padre', 16, -118], ['padre', -12, -132], ['padre', 12, -132]
  ],
  a6_galius1: [['galius1', -48, -102]],
  a6_crypt1: [
    ['diabrete', -6, -10, 3], ['diabrete', 6, -14, 3], ['diabrete', 0, -22, 3],
    ['campones', -8, -18], ['campones', 8, -8], ['campones', 0, -12]
  ],
  a6_crypt2: [
    ['padre', 48, -6], ['padre', 68, -6], ['padre', 58, -34],
    ['guarda', 46, -20], ['guarda', 70, -20], ['guarda', 58, -14],
    ['campones', 52, -28], ['campones', 64, -28]
  ],
  a6_crypt3: [
    ['demonio', 48, -76], ['demonio', 68, -76],
    ['padre', 48, -96], ['padre', 68, -96],
    ['gargula', 58, -84, 4], ['diabrete', 52, -70, 3], ['diabrete', 64, -70, 3]
  ],
  a6_galius2: [['galius2', 0, -96]]
};

const PICKUPS = {
  a1: [
    { k: 'weapon', id: 'sling', x: -24, z: -1, y: 1.9 },
    { k: 'host', x: -24, z: -5 }, { k: 'host', x: 20, z: -10 }, { k: 'host', x: 114, z: -18 },
    { k: 'host', x: 93, z: -102 }, { k: 'host', x: -28, z: -82 }, { k: 'host', x: 24, z: -126 },
    { k: 'rocks', x: -22, z: -2 }, { k: 'rocks', x: 68, z: -16 }, { k: 'rocks', x: 92, z: -72 }, { k: 'rocks', x: 0, z: -112 }
  ],
  a2: [
    { k: 'weapon', id: 'scythe', x: 106, z: -58, y: 1.2 },
    { k: 'host', x: -26, z: -44 }, { k: 'host', x: -104, z: -36 }, { k: 'host', x: 106, z: -58 },
    { k: 'host', x: -72, z: -138 }, { k: 'host', x: 72, z: -138 }, { k: 'host', x: 0, z: -116 },
    { k: 'rocks', x: 0, z: -26 }, { k: 'rocks', x: -82, z: -56 }, { k: 'rocks', x: 74, z: -64 }, { k: 'rocks', x: 0, z: -152 }
  ],
  a3: [
    { k: 'host', x: -28, z: -22 }, { k: 'host', x: -98, z: -42 }, { k: 'host', x: 98, z: -44 },
    { k: 'host', x: -66, z: -154 }, { k: 'host', x: 66, z: -154 }, { k: 'host', x: 0, z: -140 },
    { k: 'rocks', x: 0, z: -34 }, { k: 'rocks', x: -80, z: -76 }, { k: 'rocks', x: 80, z: -76 }, { k: 'rocks', x: 0, z: -164 }
  ],
  a4: [
    { k: 'weapon', id: 'demo', x: -112, z: -80, y: 1.2 },
    { k: 'host', x: -36, z: -18 }, { k: 'host', x: 36, z: -18 }, { k: 'host', x: -112, z: -80 },
    { k: 'host', x: 112, z: -80 }, { k: 'host', x: -68, z: -166 }, { k: 'host', x: 68, z: -166 },
    { k: 'rocks', x: 0, z: -18 }, { k: 'rocks', x: -76, z: -80 }, { k: 'rocks', x: 78, z: -80 }, { k: 'rocks', x: 0, z: -156 }
  ],
  a5: [
    { k: 'host', x: -110, z: -60 }, { k: 'host', x: 110, z: -60 }, { k: 'host', x: -112, z: -112 },
    { k: 'host', x: 112, z: -112 }, { k: 'host', x: -72, z: -172 }, { k: 'host', x: 72, z: -172 },
    { k: 'rocks', x: 0, z: -22 }, { k: 'rocks', x: -86, z: -86 }, { k: 'rocks', x: 86, z: -86 }, { k: 'rocks', x: 0, z: -172 }
  ],
  a6_gate: [
    { k: 'host', x: -92, z: -75 }, { k: 'host', x: 92, z: -75 }, { k: 'host', x: -34, z: -134 }, { k: 'host', x: 34, z: -134 },
    { k: 'rocks', x: 0, z: -48 }, { k: 'rocks', x: -72, z: -75 }, { k: 'rocks', x: 72, z: -75 }, { k: 'rocks', x: 0, z: -116 }
  ],
  a6_nave: [
    { k: 'host', x: -20, z: -20 }, { k: 'host', x: 20, z: -20 }, { k: 'host', x: -56, z: -60 },
    { k: 'host', x: 56, z: -60 }, { k: 'host', x: -20, z: -132 }, { k: 'host', x: 20, z: -132 },
    { k: 'rocks', x: 0, z: -46 }, { k: 'rocks', x: -46, z: -60 }, { k: 'rocks', x: 46, z: -60 }, { k: 'rocks', x: 0, z: -102 }
  ],
  a6_crypt: [
    { k: 'host', x: -8, z: -14 }, { k: 'host', x: 58, z: -18 }, { k: 'host', x: 58, z: -86 }, { k: 'host', x: 8, z: -86 },
    { k: 'rocks', x: 26, z: -14 }, { k: 'rocks', x: 58, z: -52 }, { k: 'rocks', x: 26, z: -86 }
  ]
};

const MAP_BUILDERS = {
  a1: buildMapA1,
  a2: buildMapA2,
  a3: buildMapA3,
  a4: buildMapA4,
  a5: buildMapA5,
  a6_gate: buildMapA6Gate,
  a6_nave: buildMapA6Nave,
  a6_crypt: buildMapA6Crypt
};

function buildMap(mapId) {
  if (!World.scene) return;
  if (!World.group) {
    World.group = new THREE.Group();
    World.scene.add(World.group);
  }
  while (World.group.children.length) World.group.remove(World.group.children[0]);
  World.colliders.length = 0;
  World.triggers.length = 0;
  World.flames.length = 0;
  World.gates = {};
  World.exitGate = null;
  World.breakWall = null;
  World.hatch = null;
  World.altar = null;
  World.portal = null;
  World.altarCross = null;
  World.ghost = null;
  World.crossPickup = null;
  World.doorMesh = null;
  World.skyPortal = null;

  World.currentMap = MAP_BUILDERS[mapId] ? mapId : 'a1';
  MAP_BUILDERS[World.currentMap]();
}

function buildWorld(scene) {
  World.scene = scene;
  buildMap('a1');
}

window.CHAPTERS.ch1 = {
  id: 'ch1',
  title: 'CAPÍTULO 1 — NOS PORTÕES DO INFERNO',
  startPos: { x: 0, y: 0, z: 10, yaw: 0 },
  spawns: SPAWNS,
  pickups: PICKUPS,
  build: buildWorld
};

function updateWorld(t, dt) {
  for (const f of World.flames) {
    const k = 1 + Math.sin(t * 14 + f.ph) * 0.18 + Math.sin(t * 23 + f.ph * 2) * 0.1;
    f.g.scale.set(k, 0.9 + (k - 1) * 2.2, k);
    f.g.rotation.y += dt * 2;
  }
  for (const id in World.gates) {
    const g = World.gates[id];
    if (g.open && g.t < 1) {
      g.t = Math.min(1, g.t + dt * (g.style === 'door' ? 0.6 : 1.2));
      if (g.style === 'barrier') g.grp.scale.y = Math.max(0.001, 1 - g.t);
      else g.grp.rotation.x = -g.t * g.t * (Math.PI / 2) * 0.98;
      if (g.t >= 1 && g.style === 'barrier') g.grp.visible = false;
    } else if (!g.open && g.style === 'barrier') {
      g.grp.children[0].material.opacity = 0.3 + Math.sin(t * 5) * 0.08;
    }
  }
  if (World.exitGate) {
    const eg = World.exitGate;
    if (!eg.unlocked) {
      eg.lockPl.material.opacity = 0.35 + Math.sin(t * 6) * 0.12;
    } else {
      eg.openPl.material.opacity = 0.45 + Math.sin(t * 8) * 0.15;
      eg.ring.rotation.z += dt * 2.8;
      const sc = 1 + Math.sin(t * 5) * 0.08;
      eg.ring.scale.set(sc, sc, 1);
    }
  }
  if (World.altar && World.altar.open && World.altar.t < 1) {
    const a = World.altar;
    a.t = Math.min(1, a.t + dt * 0.65);
    const s = a.t * a.t * (3 - 2 * a.t);
    const slide = s * 3.4;
    a.leftGrp.position.x = -slide;
    a.rightGrp.position.x = slide;
    a.colL.x1 = -7.0 - slide; a.colL.x2 = -slide;
    a.colR.x1 = slide; a.colR.x2 = 7.0 + slide;
  }
  if (World.portal && World.portal.active) { World.portal.g.rotation.y += dt * 2; World.portal.ring.rotation.z += dt * 3; }
  if (World.ghost) World.ghost.position.y = 2.6 + Math.sin(t * 1.5) * 0.3;
  if (World.crossPickup && World.crossPickup.visible) { World.crossPickup.rotation.y += dt * 2; World.crossPickup.position.y = 3.0 + Math.sin(t * 2) * 0.2; }
  if (World.skyPortal) World.skyPortal.rotation.z += dt * 0.15;
}
