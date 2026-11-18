'use strict';
/* ============================================================
   HELLSLAYER BETA 1 - parte 2: jogador, armas, HUD, história
   ============================================================ */
(function () {
  const { P, S, WEAPONS, enemies, peasants, scene, camera, renderer, parts, projs, rings, vmScene, vmCam, VMS } = window.__HS;
  const A = window.__HSAPI;
  const { $, rnd, clamp, V3, resolveCircle, burst, spawnRing, spawnProj, hurtPlayer, dmgEnemy, killEnemy, addFaith, findHitPart, findHitPartRay, AMMO_MAX, keys, wcd } = A;
  let mouseL = false, mouseR = false, nolock = false;
  const curW = () => A.curW();

  /* ---------------- 3ª pessoa (Nivaldo + câmera orbital) ---------------- */
  const NIVALDO_3P = BUILD.nivaldo();
  NIVALDO_3P.root.visible = false;
  scene.add(NIVALDO_3P.root);
  if (window.BloodStain) BloodStain.init(NIVALDO_3P, VMS);
  const TP_CAM = {
    active: false,
    userMode: false,
    angle: 0,
    pitch: 0.38,
    dist: 4.2,
    height: 2.3,
    target: new V3(),
    pos: new V3(),
    lookScratch: new V3()
  };
  function isThirdPersonActive() {
    return !P.dead && (TP_CAM.userMode || !!S.glory || (S.cutscene > 0 && (S.csKind === 'door' || S.csKind === 'rip' || S.csKind === 'maximusDeath' || S.csKind === 'maximusIntro' || S.csKind === 'galiusIntro' || S.csKind === 'tomb')));
  }
  function toggleThirdPerson() {
    TP_CAM.userMode = !TP_CAM.userMode;
    if (TP_CAM.userMode) {
      TP_CAM.angle = P.yaw;
      TP_CAM.pitch = clamp(-P.pitch + 0.30, -0.35, 1.10);
    }
  }
  /* ---------------- Glory Kills: corpos/partes que seguem as mãos do Nivaldo ---------------- */
  const sm01 = (x) => { x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); };
  const RIP_T = { grab: 0.60, split: 1.65, tearEnd: 3.0, release: 3.45 };
  const DEC_T = { grab: 0.50, raise: 0.95, throwStart: 1.85, throwEnd: 2.10 };
  const PADRE_T = { snatch: 0.45, raise: 0.88, stab: 1.12, chamber: 1.48, kick: 1.65, end: 2.15 };
  const DEMON_T = { hit1: 0.55, hit2: 1.05, hit3: 1.55, hit4: 2.05, end: 2.75 };
  const WING_T = { grab: 0.42, slam: 0.85, rip: 1.75, stomp: 2.35, throwWings: 2.80, end: 3.30 };
  const TRIDENT_T = { push: 0.28, grab: 0.72, raise: 1.12, impale: 1.48, end: 2.10 };
  const _hL = new V3(), _hR = new V3(), _hM = new V3(), _gp = new V3(), _pa = new V3(), _pb = new V3();
  const GUT_COLS = [0xc4566a, 0xa8384c, 0x8a1c2c, 0xd06a7a];
  const GLORY_BLOOD_MULT = 4;
  function nivaldoHands() {
    const N = NIVALDO_3P;
    if (N.handL && N.handR) {
      _hL.set(0, -0.04, 0); N.handL.localToWorld(_hL);
      _hR.set(0, -0.04, 0); N.handR.localToWorld(_hR);
    } else {
      _hL.set(0, -0.48, 0); N.forearmL.localToWorld(_hL);
      _hR.set(0, -0.48, 0); N.forearmR.localToWorld(_hR);
    }
    _hM.copy(_hL).add(_hR).multiplyScalar(0.5);
  }
  function reviveProp(e) {
    e.g.visible = true;
    if (e.shadow) e.shadow.visible = false;
    scene.add(e.g);
  }
  // direção para cair "para longe" do jogador: +PI/2 se a frente do inimigo olha para longe
  function layAway(e, nx, nz) {
    const ry = e.g.rotation.y;
    return (Math.sin(ry) * nx + Math.cos(ry) * nz) > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  function ragdollBody(e, o) {
    const b = e.g;
    b.position.y = Math.max(b.position.y, getGroundY(b.position.x, b.position.z));
    b.rotation.order = 'YXZ';
    return A.addCorpsePart(b, Object.assign({ floorOff: 0.3, rad: Math.max(0.4, e.r * 0.9), trail: true, lay: true, layZ: 0 }, o));
  }
  function spawnGut(x, y, z, spd) {
    A.evictOldestGib(300);
    const a = rnd(0, Math.PI * 2), s = rnd(0, spd || 1);
    A.pushGib(x + rnd(-0.12, 0.12), y, z + rnd(-0.12, 0.12), Math.cos(a) * s, rnd(-0.6, 1.2), Math.sin(a) * s,
      rnd(-4, 4), rnd(-4, 4), rnd(-4, 4), 0.09, rnd(0.3, 0.65), 0.09, GUT_COLS[(Math.random() * GUT_COLS.length) | 0], true);
  }
  function mkStrandChain(col) {
    const segs = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(BX(1, 1, 1), MT(col, { basic: false }));
      m.visible = false;
      scene.add(m);
      segs.push(m);
    }
    return segs;
  }
  function attachHangingSpine(headGroup, headSize) {
    const s = Math.max(0.55, (headSize ? headSize.y : 0.46) / 0.46);
    const numVerts = 8;
    const segH = 0.095 * s;
    const baseY = -(headSize ? headSize.y * 0.48 : 0.22 * s);
    // Coto sangrento na base do crânio
    const stump = new THREE.Mesh(BX(0.24 * s, 0.08 * s, 0.22 * s), MT(0x7a040a, { basic: false }));
    stump.position.set(0, baseY, 0);
    headGroup.add(stump);

    const joints = [];
    let parent = headGroup;
    for (let i = 0; i < numVerts; i++) {
      const j = new THREE.Group();
      j.position.set(0, i === 0 ? baseY : -segH, i === 0 ? -0.02 * s : 0);
      const taper = 1 - i * 0.055;
      const boneCol = i % 2 === 0 ? 0xe8dcc8 : 0xd8ccb4;
      const vert = new THREE.Mesh(BX(0.13 * s * taper, 0.062 * s, 0.11 * s * taper), MT(boneCol, { basic: false }));
      vert.position.set(0, -segH * 0.45, 0);
      j.add(vert);
      // Processo espinhoso (saliência traseira da vértebra)
      const proc = new THREE.Mesh(BX(0.044 * s * taper, 0.054 * s, 0.062 * s * taper), MT(0xd0c2aa, { basic: false }));
      proc.position.set(0, -segH * 0.45, -0.068 * s * taper);
      j.add(proc);
      // Disco/cartilagem sangrenta entre vértebras
      const disc = new THREE.Mesh(BX(0.082 * s * taper, 0.044 * s, 0.082 * s * taper), MT(0x82060e, { basic: false }));
      disc.position.set(0, -segH * 0.08, 0);
      j.add(disc);
      if (i === 1 || i === 3) {
        const tendon = new THREE.Mesh(BX(0.028 * s, 0.15 * s, 0.028 * s), MT(0x9e121c, { basic: false }));
        tendon.position.set((i === 1 ? -1 : 1) * 0.06 * s, -segH * 0.85, 0.02 * s);
        tendon.rotation.z = (i === 1 ? -0.22 : 0.22);
        j.add(tendon);
      }
      parent.add(j);
      parent = j;
      joints.push(j);
    }
    return { joints, tip: parent };
  }

  function gloryHitRip(gk, e) {
    const body = e.g;
    A.killEnemy(e, gk.nx, gk.nz, { noGore: true, weapon: 'fists' });
    if (window.BloodStain) BloodStain.addBlood(0.32, 'fists', 0.35);
    reviveProp(e);
    const strands = [
      mkStrandChain(0xc8586c), mkStrandChain(0xb04054), mkStrandChain(0xd86e80),
      mkStrandChain(0xa8384c), mkStrandChain(0xc04a60)
    ];
    gk.fx = { kind: 'rip', e, body, halves: null, gutT: 0, snapped: false, strands, done: false };
  }
  function gloryHitDecap(gk, e) {
    let head = null;
    let spine = null;
    const L = e.limbs && e.limbs.head;
    if (L && !L.severed && L.node) {
      head = A.makeNodeProp(L.node);
      spine = attachHangingSpine(head, L.limbSize);
    }
    if (L && !L.severed) A.severLimb(e, 'head', gk.nx, gk.nz, { noGib: true });
    A.killEnemy(e, gk.nx, gk.nz, { noGore: true, weapon: 'fists' });
    if (window.BloodStain) BloodStain.addBlood(0.35, 'fists', 0.35);
    reviveProp(e);
    const c = e.g.position;
    A.bloodSpurt(c.x, c.y + e.h * 0.85, c.z, gk.nx, gk.nz, 9, 22 * GLORY_BLOOD_MULT, 6);
    ragdollBody(e, { vx: gk.nx * 2.6, vy: 2.4, vz: gk.nz * 2.6, rvx: 0, rvz: 0, layX: layAway(e, gk.nx, gk.nz) });
    if (head) scene.add(head);
    gk.fx = {
      kind: 'decap', e, head,
      spineJoints: spine ? spine.joints : null,
      spineTip: spine ? spine.tip : null,
      dripT: 0, done: false, thrown: false, wasNoHead: !head
    };
  }
  function smashHeadFX(e, nx, nz) {
    const c = e.g.position;
    const L = e.limbs && e.limbs.head;
    if (L && !L.severed) A.severLimb(e, 'head', nx, nz, { noGib: true });
    if (e.rig && e.rig.head) e.rig.head.visible = false;
    A.bloodSpurt(c.x, c.y + e.h * 0.8, c.z, nx, nz, 12, 34 * GLORY_BLOOD_MULT, 7);
    A.bloodSpurt(c.x, c.y + e.h * 0.8, c.z, -nx * 0.4, -nz * 0.4, 8, 20 * GLORY_BLOOD_MULT, 6);
    A.burst(c.x, c.y + e.h * 0.8, c.z, 0xe8dcc8, 10, 9, 0.55, 0.16, 20);
    for (let i = 0; i < 7; i++) {
      A.evictOldestGib(300);
      A.pushGib(c.x, c.y + e.h * 0.82, c.z, rnd(-6, 6), rnd(3, 9), rnd(-6, 6), rnd(-12, 12), rnd(-12, 12), rnd(-12, 12),
        rnd(0.1, 0.22), rnd(0.1, 0.22), rnd(0.1, 0.22), i % 2 ? A.GIB_COLS[3] : A.GIB_COLS[0], true);
    }
  }
  function gloryHitHammer(gk, e) {
    const nx = gk.nx, nz = gk.nz;
    smashHeadFX(e, nx, nz);
    A.killEnemy(e, nx, nz, { noGore: true, weapon: 'hammer' });
    if (window.BloodStain) BloodStain.addBlood(0.32, 'hammer', 0.42);
    reviveProp(e);
    const c = e.g.position;
    if (gk.variant === 'side') {
      // pancada de lado: a cabeça explode e o corpo voa em ragdoll
      const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
      ragdollBody(e, {
        vx: rx * 15 + nx * 2, vy: 5.5, vz: rz * 15 + nz * 2,
        rvx: rnd(-9, 9), rvy: rnd(-6, 6), rvz: rnd(-9, 9), hitEnemies: true, layX: layAway(e, rx, rz), rad: Math.max(0.45, e.r)
      });
    } else {
      // pancada de cima pra baixo: a cabeça explode e o corpo desaba em ragdoll
      A.spawnBloodDecal(c.x + nx * 0.3, c.z + nz * 0.3, 2.2);
      A.spawnRing(c.x, c.z, 7, 22, 0, 0xffa040, 'p');
      A.burst(c.x, 0.4, c.z, 0x7a6a5a, 16, 9, 0.7, 0.3, 16, false);
      P.shake = Math.max(P.shake, 1.0);
      S.hitStop = Math.max(S.hitStop || 0, 0.09);
      ragdollBody(e, { vx: nx * 1.0, vy: 0.8, vz: nz * 1.0, rvx: 0, rvz: 0, layX: layAway(e, nx, nz) });
    }
    gk.fx = { kind: 'hammer', e, done: true };
  }
  function gloryHitKick(gk, e) {
    const nx = gk.nx, nz = gk.nz, tx = -nz, tz = nx;
    const c = e.g.position;
    e.g.updateMatrixWorld(true);
    const names = ['head', 'armL', 'armR', 'legL', 'legR', 'wingL', 'wingR'];
    const props = [];
    if (e.limbs) {
      for (const n of names) {
        const L = e.limbs[n];
        if (!L || L.severed || !L.node || !L.node.visible) continue;
        props.push(A.makeNodeProp(L.node));
      }
    }
    // o tronco explode (gore grande); os membros voam longe
    A.killEnemy(e, nx, nz, { weapon: 'kick' });
    if (window.BloodStain) BloodStain.addBlood(0.28, 'kick', 0.42);
    A.burst(c.x, c.y + e.h * 0.55, c.z, 0xffa040, 14, 12, 0.5, 0.2, 10);
    A.bloodSpurt(c.x, c.y + e.h * 0.55, c.z, nx, nz, 16, 40 * GLORY_BLOOD_MULT, 6);
    for (let i = 0; i < 10; i++) {
      A.evictOldestGib(300);
      A.pushGib(c.x, c.y + e.h * 0.55, c.z, nx * rnd(2, 12) + rnd(-5, 5), rnd(3, 11), nz * rnd(2, 12) + rnd(-5, 5),
        rnd(-12, 12), rnd(-12, 12), rnd(-12, 12), rnd(0.18, 0.42), rnd(0.18, 0.36), rnd(0.18, 0.36),
        A.GIB_COLS[(Math.random() * 3) | 0], true);
    }
    for (const g of props) {
      scene.add(g);
      g.rotation.order = 'YXZ';
      const sp = rnd(14, 26), lat = rnd(-6, 6);
      A.addCorpsePart(g, {
        vx: nx * sp + tx * lat, vy: rnd(6, 12), vz: nz * sp + tz * lat,
        rvx: rnd(-14, 14), rvy: rnd(-10, 10), rvz: rnd(-14, 14),
        floorOff: 0.2, rad: 0.3, trail: true, hitEnemies: true
      });
    }
    gk.fx = { kind: 'kick', e, done: true };
  }

  function mkGoldenCrossProp() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
    const v = new THREE.Mesh(BX(0.1, 0.9, 0.1), mat);
    const h = new THREE.Mesh(BX(0.4, 0.1, 0.1), mat);
    h.position.y = 0.3;
    g.add(v, h);
    return g;
  }
  function mkTridentProp(s) {
    s = s || 0.85;
    const g = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x5a3a1c });
    const iron = new THREE.MeshLambertMaterial({ color: 0x909090 });
    const shaft = new THREE.Mesh(BX(0.06 * s, 1.85 * s, 0.06 * s), wood);
    shaft.position.y = 0.325 * s;
    const bar = new THREE.Mesh(BX(0.3 * s, 0.06 * s, 0.05 * s), iron);
    bar.position.y = -0.60 * s;
    g.add(shaft, bar);
    for (let i = -1; i <= 1; i++) {
      const prong = new THREE.Mesh(BX(0.04 * s, 0.3 * s, 0.04 * s), iron);
      prong.position.set(i * 0.12 * s, -0.75 * s, 0);
      g.add(prong);
    }
    return g;
  }
  function spawnMeatPile(x, y, z, r) {
    const pile = new THREE.Group();
    const cols = [0x6e080e, 0x8a0f18, 0x4e0408, 0xa8202c, 0xc4566a];
    const rad = Math.max(0.75, (r || 1.3) * 0.72);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rnd(-0.2, 0.2);
      const dist = i < 4 ? rnd(0, rad * 0.25) : rnd(rad * 0.15, rad * 0.85);
      const sx = rnd(0.28, 0.56), sy = rnd(0.14, 0.34), sz = rnd(0.28, 0.56);
      const m = new THREE.Mesh(BX(sx, sy, sz), new THREE.MeshLambertMaterial({ color: cols[i % cols.length] }));
      m.position.set(Math.cos(a) * dist, sy * 0.45 + (i < 4 ? 0.16 : 0), Math.sin(a) * dist);
      m.rotation.set(rnd(-0.4, 0.4), rnd(0, 6.28), rnd(-0.4, 0.4));
      pile.add(m);
    }
    const boneMat = new THREE.MeshLambertMaterial({ color: 0xe4d8c0 });
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(BX(0.08, 0.38, 0.08), boneMat);
      b.position.set(rnd(-rad * 0.45, rad * 0.45), 0.22, rnd(-rad * 0.45, rad * 0.45));
      b.rotation.set(rnd(-0.9, 0.9), rnd(0, 6.28), rnd(-0.9, 0.9));
      pile.add(b);
    }
    pile.position.set(x, y, z);
    A.addCorpsePart(pile, { vx: 0, vy: 0, vz: 0, floorOff: 0, rad: rad * 0.8, lay: false });
  }

  function releaseRipHalves(fx, yaw) {
    const hs = fx.halves;
    if (!hs) return;
    for (const h of hs) {
      const hp = h.hand === 'L' ? _hL : _hR;
      const ox = hp.x - _hM.x, oz = hp.z - _hM.z, ol = Math.hypot(ox, oz) || 1;
      h.g.rotation.order = 'YXZ';
      A.addCorpsePart(h.g, {
        vx: ox / ol * 3.2, vy: 1.8, vz: oz / ol * 3.2,
        rvx: rnd(-1.5, 1.5), rvy: rnd(-1, 1), rvz: -h.side * rnd(3, 5),
        floorOff: 0.3, rad: 0.45, trail: true, lay: true, layX: 0, layZ: -h.side * Math.PI / 2
      });
    }
    for (const ch of fx.strands) for (const s of ch) scene.remove(s);
    fx.halves = null;
  }

  function updateGloryProps(gk) {
    const fx = gk.fx;
    if (!fx || fx.done) return;
    const e = fx.e, t = gk.t, yaw = P.yaw;
    const fX = -Math.sin(yaw), fZ = -Math.cos(yaw);
    nivaldoHands();
    gk.enemyPos.copy(_hM);
    if (fx.kind === 'rip') {
      const h = e.h;
      if (!fx.halves) {
        const b = fx.body;
        if (t < RIP_T.split) {
          b.rotation.set(0, yaw, 0);
          b.position.set(_hM.x + fX * 0.32, _hM.y - h * 0.52, _hM.z + fZ * 0.32);
          const sw = Math.sin(t * 7) * 0.12;
          if (e.rig.legL) e.rig.legL.rotation.x = 0.25 + sw;
          if (e.rig.legR) e.rig.legR.rotation.x = 0.25 - sw;
          return;
        }
        // rasga ao meio: duas metades
        const hs = A.makeEnemyHalves(e);
        scene.remove(b);
        const latX = Math.cos(yaw), latZ = -Math.sin(yaw);
        const dL = (_hL.x - _hM.x) * latX + (_hL.z - _hM.z) * latZ;
        const dR = (_hR.x - _hM.x) * latX + (_hR.z - _hM.z) * latZ;
        for (const half of hs) {
          // o lado +x do inimigo fica com a mão que estiver mais no lado +lateral
          half.hand = (half.side > 0) === (dL > dR) ? 'L' : 'R';
          half.g.rotation.set(0, yaw, 0);
          scene.add(half.g);
        }
        fx.halves = hs;
        SFX.play('gib'); SFX.play('hit', 'cut');
        P.shake = Math.max(P.shake, 0.7);
        A.bloodSpurt(_hM.x, _hM.y - 0.2, _hM.z, 0, 0, 7, 26 * GLORY_BLOOD_MULT, 4);
        for (let i = 0; i < 8; i++) spawnGut(_hM.x, _hM.y - 0.3, _hM.z, 1.5);
      }
      const hs = fx.halves;
      const stretch = sm01((t - RIP_T.split) / (RIP_T.tearEnd - RIP_T.split));
      for (const half of hs) {
        const hp = half.hand === 'L' ? _hL : _hR;
        const lean = -half.side * (0.10 + 0.40 * stretch) + Math.sin(t * 9 + half.side) * 0.04;
        half.g.rotation.set(0, yaw, lean);
        _gp.set(half.side * e.r * 0.45, h * 0.80, 0).applyEuler(half.g.rotation);
        half.g.position.set(hp.x - _gp.x, hp.y - _gp.y, hp.z - _gp.z);
      }
      // tripas esticadas entre as metades, que arrebentam e caem
      _pa.set(0, h * 0.5, 0); hs[0].g.updateMatrixWorld(true); hs[0].g.localToWorld(_pa);
      _pb.set(0, h * 0.5, 0); hs[1].g.updateMatrixWorld(true); hs[1].g.localToWorld(_pb);
      const sep = _pa.distanceTo(_pb);
      if (!fx.snapped && sep > 1.75) {
        fx.snapped = true;
        for (const ch of fx.strands) for (const s of ch) s.visible = false;
        for (let i = 0; i < 16; i++) spawnGut(_pa.x + (_pb.x - _pa.x) * Math.random(), _pa.y, _pa.z + (_pb.z - _pa.z) * Math.random(), 1.2);
        A.bloodSpurt(_hM.x, _hM.y - 0.3, _hM.z, 0, 0, 5, 18 * GLORY_BLOOD_MULT, 1);
        A.spawnBloodDecal(_hM.x, _hM.z, 1.6);
        SFX.play('gib');
      }
      if (!fx.snapped) {
        for (let i = 0; i < fx.strands.length; i++) {
          const ch = fx.strands[i];
          const nSeg = ch.length;
          const offY = -0.14 - (i % 3) * 0.08;
          const offFwd = (i - 2) * 0.09;
          const sagMax = (0.32 - 0.14 * stretch) + (i % 2) * 0.08;
          const thick = Math.max(0.04, 0.082 - stretch * 0.025);
          for (let k = 0; k < nSeg; k++) {
            const u0 = k / nSeg, u1 = (k + 1) / nSeg;
            const sag0 = 4 * u0 * (1 - u0) * sagMax;
            const sag1 = 4 * u1 * (1 - u1) * sagMax;
            const wig0 = Math.sin(t * 10 + i * 1.3 + u0 * 4) * 0.04 * (1 - stretch * 0.5);
            const wig1 = Math.sin(t * 10 + i * 1.3 + u1 * 4) * 0.04 * (1 - stretch * 0.5);
            const x0 = _pa.x + (_pb.x - _pa.x) * u0 + fX * (offFwd + wig0);
            const y0 = _pa.y + (_pb.y - _pa.y) * u0 + offY - sag0;
            const z0 = _pa.z + (_pb.z - _pa.z) * u0 + fZ * (offFwd + wig0);
            const x1 = _pa.x + (_pb.x - _pa.x) * u1 + fX * (offFwd + wig1);
            const y1 = _pa.y + (_pb.y - _pa.y) * u1 + offY - sag1;
            const z1 = _pa.z + (_pb.z - _pa.z) * u1 + fZ * (offFwd + wig1);
            const s = ch[k];
            s.visible = true;
            s.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
            s.lookAt(x1, y1, z1);
            const segLen = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
            s.scale.set(thick, thick, Math.max(0.04, segLen * 1.06));
          }
        }
      }
      fx.gutT -= 1 / 60;
      if (fx.gutT <= 0) {
        fx.gutT = fx.snapped ? 0.11 : 0.18;
        const gx = (_pa.x + _pb.x) * 0.5, gy = (_pa.y + _pb.y) * 0.5 - 0.1, gz = (_pa.z + _pb.z) * 0.5;
        if (fx.snapped) {
          spawnGut(_pa.x, _pa.y - 0.1, _pa.z, 0.4);
          spawnGut(_pb.x, _pb.y - 0.1, _pb.z, 0.4);
        }
        A.bloodSpurt(gx, gy, gz, rnd(-1, 1), rnd(-1, 1), 1.4, 2 * GLORY_BLOOD_MULT, -0.3);
        A.bloodSpurt(_pa.x, _pa.y - 0.2, _pa.z, rnd(-1, 1), rnd(-1, 1), 1.2, 1 * GLORY_BLOOD_MULT, -0.3);
        A.bloodSpurt(_pb.x, _pb.y - 0.2, _pb.z, rnd(-1, 1), rnd(-1, 1), 1.2, 1 * GLORY_BLOOD_MULT, -0.3);
      }
      if (t >= RIP_T.release) {
        releaseRipHalves(fx, yaw);
        fx.done = true;
      }
    } else if (fx.kind === 'decap') {
      const hd = fx.head;
      if (!hd) { fx.done = true; return; }
      if (!fx.thrown) {
        hd.rotation.set(0, yaw, Math.sin(t * 11) * 0.08);
        hd.position.set(_hM.x + fX * 0.06, _hM.y + 0.12, _hM.z + fZ * 0.06);
        if (fx.spineJoints) {
          const pull = sm01((t - DEC_T.grab) / (DEC_T.raise - DEC_T.grab));
          const swayAmp = 0.08 + 0.07 * pull;
          for (let i = 0; i < fx.spineJoints.length; i++) {
            const j = fx.spineJoints[i];
            j.rotation.x = Math.sin(t * 9.5 - i * 0.45) * swayAmp + 0.04 * pull;
            j.rotation.z = Math.cos(t * 7.2 - i * 0.5) * swayAmp * 0.85;
          }
        }
        fx.dripT -= 1 / 60;
        if (fx.dripT <= 0) {
          fx.dripT = 0.07;
          A.bloodSpurt(hd.position.x, hd.position.y - 0.15, hd.position.z, rnd(-1, 1), rnd(-1, 1), 1.3, 2 * GLORY_BLOOD_MULT, -0.3);
          if (fx.spineTip) {
            _gp.set(0, 0, 0);
            fx.spineTip.updateMatrixWorld(true);
            fx.spineTip.localToWorld(_gp);
            A.bloodSpurt(_gp.x, _gp.y, _gp.z, rnd(-0.8, 0.8), rnd(-0.8, 0.8), 1.1, 2 * GLORY_BLOOD_MULT, -0.4);
          }
        }
        if (t >= DEC_T.throwStart + (DEC_T.throwEnd - DEC_T.throwStart) * 0.45) {
          fx.thrown = true;
          if (fx.spineJoints) {
            for (let i = 0; i < fx.spineJoints.length; i++) {
              fx.spineJoints[i].rotation.set(0.14, 0, (i % 2 ? 0.04 : -0.04));
            }
          }
          hd.rotation.order = 'YXZ';
          A.addCorpsePart(hd, {
            vx: fX * 21, vy: 7, vz: fZ * 21, rvx: rnd(-14, -8), rvy: rnd(-5, 5), rvz: rnd(-6, 6),
            floorOff: 0.25, rad: 0.3, trail: true, hitEnemies: true
          });
          SFX.play('swing');
          fx.done = true;
        }
      }
    } else if (fx.kind === 'padre_cross') {
      const c = e.g.position;
      if (!fx.snatched && t >= PADRE_T.snatch) {
        fx.snatched = true;
        if (e.rig && e.rig.cross) e.rig.cross.visible = false;
        fx.cross = mkGoldenCrossProp();
        scene.add(fx.cross);
        SFX.play('swing');
      }
      if (fx.cross && !fx.stabbed) {
        const flip = sm01((t - PADRE_T.snatch) / (PADRE_T.raise - PADRE_T.snatch));
        fx.cross.position.copy(_hR);
        fx.cross.rotation.set(Math.PI * flip, yaw, 0);
      }
      if (!fx.stabbed && t >= PADRE_T.stab) {
        fx.stabbed = true;
        if (fx.cross) {
          if (e.rig && e.rig.head) {
            e.rig.head.add(fx.cross);
            fx.cross.position.set(0, 0.34, 0.04);
            fx.cross.rotation.set(Math.PI, 0, 0.08);
          } else {
            e.g.add(fx.cross);
            fx.cross.position.set(0, e.h * 0.95, 0.04);
            fx.cross.rotation.set(Math.PI, 0, 0.08);
          }
        }
        A.bloodSpurt(c.x, c.y + e.h * 0.85, c.z, gk.nx, gk.nz, 10, 28 * GLORY_BLOOD_MULT, 6);
        A.burst(c.x, c.y + e.h * 0.88, c.z, 0xe8dcc8, 8, 7, 0.45, 0.14, 16);
        if (window.BloodStain) BloodStain.addBlood(0.28, 'fists', 0.32);
        SFX.play('hit', 'cut'); SFX.play('gib');
        P.shake = Math.max(P.shake, 0.85);
        S.hitStop = Math.max(S.hitStop || 0, 0.05);
      }
      if (fx.stabbed && !fx.kicked) {
        e.g.rotation.z = Math.sin(t * 28) * 0.08;
        e.g.rotation.x = -0.15;
      }
      if (!fx.kicked && t >= PADRE_T.kick) {
        fx.kicked = true;
        e.g.rotation.set(0, e.g.rotation.y, 0);
        A.killEnemy(e, gk.nx, gk.nz, { noGore: true, weapon: 'kick' });
        if (window.BloodStain) BloodStain.addBlood(0.22, 'kick', 0.35);
        reviveProp(e);
        ragdollBody(e, {
          vx: gk.nx * 19, vy: 6.0, vz: gk.nz * 19,
          rvx: rnd(-7, 7), rvy: rnd(-4, 4), rvz: rnd(-7, 7),
          hitEnemies: true, layX: layAway(e, gk.nx, gk.nz), rad: Math.max(0.45, e.r)
        });
        A.bloodSpurt(c.x, c.y + e.h * 0.55, c.z, gk.nx, gk.nz, 14, 30 * GLORY_BLOOD_MULT, 6);
        SFX.play('slam'); SFX.play('hit', 'general');
        P.shake = Math.max(P.shake, 0.95);
        fx.done = true;
      }
      gk.enemyPos.copy(c);
    } else if (fx.kind === 'demon_smash') {
      const c = e.g.position;
      const gy = getGroundY(c.x, c.z);
      if (fx.hits === 0 && t >= DEMON_T.hit1) {
        fx.hits = 1;
        e.g.scale.set(1.08, 0.85, 1.08);
        A.bloodSpurt(c.x, c.y + e.h * 0.65, c.z, gk.nx, gk.nz, 10, 26 * GLORY_BLOOD_MULT, 6);
        A.burst(c.x, c.y + e.h * 0.65, c.z, 0xffa040, 10, 8, 0.4, 0.2, 12);
        if (window.BloodStain) BloodStain.addBlood(0.22, 'hammer', 0.35);
        SFX.play('hammer');
        P.shake = Math.max(P.shake, 0.85);
      } else if (fx.hits === 1 && t >= DEMON_T.hit2) {
        fx.hits = 2;
        smashHeadFX(e, gk.nx, gk.nz);
        e.g.scale.set(1.20, 0.62, 1.20);
        if (window.BloodStain) BloodStain.addBlood(0.25, 'hammer', 0.38);
        SFX.play('hammer'); SFX.play('gib');
        P.shake = Math.max(P.shake, 0.95);
      } else if (fx.hits === 2 && t >= DEMON_T.hit3) {
        fx.hits = 3;
        e.g.scale.set(1.36, 0.40, 1.36);
        A.bloodSpurt(c.x, gy + 0.5, c.z, 0, 0, 11, 32 * GLORY_BLOOD_MULT, 7);
        A.spawnBloodDecal(c.x, c.z, 2.0);
        for (let i = 0; i < 6; i++) spawnGut(c.x, gy + 0.4, c.z, 3.0);
        SFX.play('hammer'); SFX.play('gib');
        P.shake = Math.max(P.shake, 1.05);
      } else if (fx.hits === 3 && t >= DEMON_T.hit4) {
        fx.hits = 4;
        A.killEnemy(e, gk.nx, gk.nz, { noGore: true, weapon: 'hammer' });
        if (window.BloodStain) BloodStain.addBlood(0.45, 'hammer', 0.48);
        spawnMeatPile(c.x, gy, c.z, e.r);
        A.spawnBloodDecal(c.x, c.z, 2.7);
        A.spawnRing(c.x, c.z, 7, 24, 0, 0xff4020, 'p');
        A.bloodSpurt(c.x, gy + 0.3, c.z, 0, 0, 14, 44 * GLORY_BLOOD_MULT, 8);
        for (let i = 0; i < 12; i++) {
          A.evictOldestGib(300);
          A.pushGib(c.x, gy + 0.35, c.z, rnd(-7, 7), rnd(4, 11), rnd(-7, 7), rnd(-12, 12), rnd(-12, 12), rnd(-12, 12),
            rnd(0.16, 0.36), rnd(0.16, 0.32), rnd(0.16, 0.36), A.GIB_COLS[(Math.random() * 3) | 0], true);
        }
        SFX.play('hammer'); SFX.play('gib');
        P.shake = Math.max(P.shake, 1.2);
        S.hitStop = Math.max(S.hitStop || 0, 0.09);
        fx.done = true;
      }
      gk.enemyPos.copy(c);
    } else if (fx.kind === 'wing_rip') {
      if (t < WING_T.grab) {
        const u = sm01(t / WING_T.grab);
        const holdX = _hM.x + fX * 0.25, holdY = _hM.y - 0.35, holdZ = _hM.z + fZ * 0.25;
        e.g.position.set(
          fx.startPos.x + (holdX - fx.startPos.x) * u,
          fx.startPos.y + (holdY - fx.startPos.y) * u,
          fx.startPos.z + (holdZ - fx.startPos.z) * u
        );
        e.g.rotation.set(0.25 * u, yaw, 0);
      } else if (t < WING_T.slam) {
        const u = sm01((t - WING_T.grab) / (WING_T.slam - WING_T.grab));
        const s = u * u;
        const holdX = _hM.x + fX * 0.25, holdY = _hM.y - 0.35, holdZ = _hM.z + fZ * 0.25;
        e.g.position.set(
          holdX + (fx.groundPos.x - holdX) * s,
          holdY + (fx.groundPos.y - holdY) * s,
          holdZ + (fx.groundPos.z - holdZ) * s
        );
        e.g.rotation.set(0.25 + (Math.PI * 0.48 - 0.25) * s, yaw, 0);
      } else if (!fx.stomped) {
        if (!fx.slammed) {
          fx.slammed = true;
          A.burst(fx.groundPos.x, fx.groundPos.y, fx.groundPos.z, 0x7a6a5a, 12, 7, 0.5, 0.2, 12, false);
          A.bloodSpurt(fx.groundPos.x, fx.groundPos.y + 0.2, fx.groundPos.z, 0, 0, 6, 16 * GLORY_BLOOD_MULT, 4);
          SFX.play('slam');
          P.shake = Math.max(P.shake, 0.65);
        }
        e.g.position.copy(fx.groundPos);
        const shakeZ = fx.ripped ? 0 : Math.sin(t * 32) * 0.05;
        e.g.rotation.set(Math.PI * 0.48, yaw, shakeZ);
      }
      if (!fx.ripped && t >= WING_T.rip) {
        fx.ripped = true;
        e.g.updateMatrixWorld(true);
        const lL = e.limbs && e.limbs.wingL, lR = e.limbs && e.limbs.wingR;
        if (lL && !lL.severed && lL.node) {
          fx.wingL = A.makeNodeProp(lL.node);
          scene.add(fx.wingL);
          A.severLimb(e, 'wingL', -gk.nz, gk.nx, { noGib: true });
        }
        if (lR && !lR.severed && lR.node) {
          fx.wingR = A.makeNodeProp(lR.node);
          scene.add(fx.wingR);
          A.severLimb(e, 'wingR', gk.nz, -gk.nx, { noGib: true });
        }
        A.bloodSpurt(fx.groundPos.x, fx.groundPos.y + 0.4, fx.groundPos.z, 0, 0, 10, 30 * GLORY_BLOOD_MULT, 6);
        if (window.BloodStain) BloodStain.addBlood(0.30, 'fists', 0.38);
        SFX.play('gib'); SFX.play('hit', 'cut');
        P.shake = Math.max(P.shake, 0.8);
      }
      if (fx.ripped && !fx.thrown) {
        if (fx.wingL) { fx.wingL.position.copy(_hL); fx.wingL.rotation.set(0.4, yaw + 0.5, 0.6); }
        if (fx.wingR) { fx.wingR.position.copy(_hR); fx.wingR.rotation.set(0.4, yaw - 0.5, -0.6); }
      }
      if (!fx.stomped && t >= WING_T.stomp) {
        fx.stomped = true;
        smashHeadFX(e, gk.nx, gk.nz);
        A.killEnemy(e, gk.nx, gk.nz, { noGore: true, weapon: 'kick' });
        reviveProp(e);
        ragdollBody(e, { vx: 0, vy: 0, vz: 0, layX: Math.PI * 0.5 });
        A.spawnBloodDecal(fx.groundPos.x, fx.groundPos.z, 1.8);
        SFX.play('slam'); SFX.play('gib');
        P.shake = Math.max(P.shake, 1.0);
        S.hitStop = Math.max(S.hitStop || 0, 0.06);
      }
      if (!fx.thrown && t >= WING_T.throwWings) {
        fx.thrown = true;
        const latX = Math.cos(yaw), latZ = -Math.sin(yaw);
        if (fx.wingL) {
          fx.wingL.rotation.order = 'YXZ';
          A.addCorpsePart(fx.wingL, {
            vx: fX * 18 - latX * 7, vy: 7.5, vz: fZ * 18 - latZ * 7,
            rvx: rnd(-12, 12), rvy: rnd(-8, 8), rvz: rnd(-12, 12),
            floorOff: 0.15, rad: 0.25, trail: true, hitEnemies: true
          });
        }
        if (fx.wingR) {
          fx.wingR.rotation.order = 'YXZ';
          A.addCorpsePart(fx.wingR, {
            vx: fX * 18 + latX * 7, vy: 7.5, vz: fZ * 18 + latZ * 7,
            rvx: rnd(-12, 12), rvy: rnd(-8, 8), rvz: rnd(-12, 12),
            floorOff: 0.15, rad: 0.25, trail: true, hitEnemies: true
          });
        }
        SFX.play('swing');
        fx.done = true;
      }
      gk.enemyPos.copy(fx.groundPos);
    } else if (fx.kind === 'trident_impale') {
      if (t < TRIDENT_T.push) {
        const u = sm01(t / TRIDENT_T.push);
        e.g.position.lerpVectors(fx.startPos, fx.pushPos, u);
        if (!fx.pushed && u >= 0.45) {
          fx.pushed = true;
          SFX.play('hit', 'general');
          P.shake = Math.max(P.shake, 0.45);
        }
      } else if (!fx.impaled) {
        e.g.position.copy(fx.pushPos);
      }
      if (!fx.grabbed && t >= TRIDENT_T.grab) {
        fx.grabbed = true;
        if (e.rig && e.rig.pitchfork) e.rig.pitchfork.visible = false;
        fx.trident = mkTridentProp(1.35);
        scene.add(fx.trident);
        SFX.play('swing');
      }
      if (fx.trident && !fx.impaled) {
        fx.trident.position.copy(_hR);
        const flip = sm01((t - TRIDENT_T.grab) / (TRIDENT_T.raise - TRIDENT_T.grab));
        fx.trident.rotation.set(0.35 * (1 - flip), yaw, 0);
      }
      if (!fx.impaled && t >= TRIDENT_T.impale) {
        fx.impaled = true;
        const gy = getGroundY(fx.pushPos.x, fx.pushPos.z);
        A.killEnemy(e, gk.nx, gk.nz, { noGore: true, weapon: 'kick' });
        if (window.BloodStain) BloodStain.addBlood(0.36, 'fists', 0.42);
        reviveProp(e);
        e.g.position.set(fx.pushPos.x, gy, fx.pushPos.z);
        e.g.rotation.set(0.38, yaw, 0);
        if (fx.trident) {
          e.g.add(fx.trident);
          fx.trident.position.set(0, 1.35, 0.14);
          fx.trident.rotation.set(-0.38, 0, 0);
        }
        A.addCorpsePart(e.g, { vx: 0, vy: 0, vz: 0, floorOff: 0, rad: 0.45, lay: false });
        A.bloodSpurt(fx.pushPos.x, gy + 0.9, fx.pushPos.z, 0, 0, 14, 38 * GLORY_BLOOD_MULT, 7);
        A.spawnBloodDecal(fx.pushPos.x, fx.pushPos.z, 1.9);
        SFX.play('hit', 'cut'); SFX.play('gib'); SFX.play('slam');
        P.shake = Math.max(P.shake, 1.0);
        S.hitStop = Math.max(S.hitStop || 0, 0.08);
        fx.done = true;
      }
      gk.enemyPos.copy(fx.pushPos);
    }
  }
  // Termina o glory kill, soltando qualquer parte que o Nivaldo ainda esteja segurando
  function endGlory() {
    const gk = S.glory;
    if (gk && gk.fx && !gk.fx.done) {
      const fx = gk.fx;
      if (fx.kind === 'rip') {
        if (fx.halves) releaseRipHalves(fx, P.yaw);
        else if (fx.body) {
          fx.body.rotation.order = 'YXZ';
          A.addCorpsePart(fx.body, { floorOff: 0.3, rad: 0.45, lay: true, layX: Math.PI / 2, vy: 1 });
        }
        for (const ch of fx.strands) for (const s of ch) scene.remove(s);
      } else if (fx.kind === 'decap' && fx.head && !fx.thrown) {
        fx.head.rotation.order = 'YXZ';
        A.addCorpsePart(fx.head, { vy: 3, floorOff: 0.25, rad: 0.3, trail: true });
      } else {
        if (fx.cross && !fx.stabbed) scene.remove(fx.cross);
        if (fx.trident && !fx.impaled) scene.remove(fx.trident);
        if (fx.wingL && !fx.thrown) A.addCorpsePart(fx.wingL, { vy: 2, floorOff: 0.15, rad: 0.25 });
        if (fx.wingR && !fx.thrown) A.addCorpsePart(fx.wingR, { vy: 2, floorOff: 0.15, rad: 0.25 });
        if (fx.e && !fx.e.dead) A.killEnemy(fx.e, gk.nx, gk.nz, { weapon: 'kick' });
      }
      fx.done = true;
    }
    S.glory = null;
  }

  function slingPullCurve(a) {
    if (a < 0.42) return sm01(a / 0.42);
    if (a < 0.62) return 1 - sm01((a - 0.42) / 0.20) * 1.18;
    return -0.18 * (1 - sm01((a - 0.62) / 0.38));
  }
  function animateSlingParts(sling, pull, showRock) {
    if (!sling) return;
    const m = sling.userData && sling.userData.tipY != null ? sling.userData : (sling.userData && sling.userData.base ? sling.userData.base : null);
    if (!m || m.tipY == null) return;
    const py = m.restY - pull * 0.04;
    const pz = m.restZ + pull * 0.22;
    if (sling.pouch) sling.pouch.position.set(0, py, pz);
    if (sling.rock) {
      sling.rock.visible = !!showRock;
      sling.rock.position.set(0, py, m.rockZ + pull * 0.22);
    }
    const updateBand = (band, tipX) => {
      if (!band) return;
      const dx = -tipX, dy = py - m.tipY, dz = pz;
      const len = Math.hypot(dx, dy, dz);
      band.position.set(tipX * 0.5, (m.tipY + py) * 0.5, pz * 0.5);
      band.rotation.y = Math.atan2(dx, dz);
      band.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz));
      band.scale.z = len / (m.baseLen || 0.125);
    };
    updateBand(sling.bandL, -0.081);
    updateBand(sling.bandR, 0.081);
  }

  const _snapTgt = new V3();
  const _snapHand = new V3();
  const _snapQuat = new THREE.Quaternion();
  function snapLeftHandToShaft(N, weapon, shaftY) {
    if (!N || !weapon || !N.shoulderR || !N.handR || !N.chestGroup) return;
    N.root.updateMatrixWorld(true);
    _snapTgt.set(0, shaftY, 0).applyMatrix4(weapon.matrixWorld);
    _snapHand.set(0, -0.06, 0.02).applyMatrix4(N.handR.matrixWorld);
    _snapTgt.sub(_snapHand);
    N.chestGroup.getWorldQuaternion(_snapQuat);
    _snapTgt.applyQuaternion(_snapQuat.invert());
    N.shoulderR.position.add(_snapTgt);
  }

  function resetNivaldoPose() {
    const N = NIVALDO_3P;
    N.hammer.rotation.set(Math.PI * 0.5, 0, 0);
    N.torsoGroup.position.set(0, 0.98, 0);
    N.torsoGroup.rotation.set(0, 0, 0);
    if (N.chestGroup) N.chestGroup.rotation.set(0, 0, 0);
    N.head.rotation.set(0, 0, 0);
    if (N.shoulderL) { N.shoulderL.position.set(-0.62, 0.36, 0); N.shoulderL.rotation.set(0, 0, 0); }
    if (N.shoulderR) { N.shoulderR.position.set(0.62, 0.36, 0); N.shoulderR.rotation.set(0, 0, 0); }
    N.armL.rotation.set(0, 0, 0);
    N.armR.rotation.set(0, 0, 0);
    if (N.forearmL) N.forearmL.rotation.set(-0.22, 0, 0);
    if (N.forearmR) N.forearmR.rotation.set(-0.22, 0, 0);
    if (N.handL) N.handL.rotation.set(0, 0, 0);
    if (N.handR) N.handR.rotation.set(0, 0, 0);
    N.legL.rotation.set(0, 0, 0);
    N.legR.rotation.set(0, 0, 0);
    if (N.kneeL) N.kneeL.rotation.set(0, 0, 0);
    if (N.kneeR) N.kneeR.rotation.set(0, 0, 0);
    if (N.footL) N.footL.rotation.set(0, 0, 0);
    if (N.footR) N.footR.rotation.set(0, 0, 0);
    N.hammer.visible = false;
    N.heart.visible = false;
    N.heart.scale.set(1, 1, 1);
    N.heart.position.set(0, -0.14, 0.14);
    if (N.cross) N.cross.visible = false;
    if (N.sling) { N.sling.visible = false; animateSlingParts(N.sling, 0, true); }
    if (N.scythe) { N.scythe.visible = false; N.scythe.rotation.set(Math.PI * 0.5, 0, 0); }
    if (N.demo) { N.demo.visible = false; N.demo.rotation.set(Math.PI * 0.5, 0, 0); }
    if (N.papalCross) { N.papalCross.visible = false; N.papalCross.rotation.set(Math.PI * 0.5, 0, 0); }
    if (N.papalCrossL) { N.papalCrossL.visible = false; N.papalCrossL.rotation.set(Math.PI * 0.5, 0, 0); }
    if (N.handRosary) N.handRosary.visible = false;
    const eyeCol = P.faithMode > 0 ? 0xffe060 : 0xf0e6d0;
    if (N.eyeL && N.eyeL.material) N.eyeL.material.color.setHex(eyeCol);
    if (N.eyeR && N.eyeR.material) N.eyeR.material.color.setHex(eyeCol);
  }
  function updateNivaldo3P() {
    const N = NIVALDO_3P;
    const tpActive = isThirdPersonActive();
    if (!tpActive) {
      if (!S.started || P.dead) {
        N.root.visible = false;
        return;
      }
      N.root.visible = true;
      // Desloca o corpo para trás da câmera para que a visão em 1ª pessoa olhe sobre o peitoral, pernas e pés
      const backOff = 0.36;
      N.root.position.set(P.pos.x + Math.sin(P.yaw) * backOff, P.pos.y, P.pos.z + Math.cos(P.yaw) * backOff);
      N.root.rotation.set(0, P.yaw + Math.PI, 0);
      resetNivaldoPose();
      N.head.visible = false;
      N.armL.visible = false;
      N.armR.visible = false;
      if (N.rosary) N.rosary.root.visible = false;
      N.legR.visible = P.kickT <= 0;
      if (!P.onGround) {
        N.legL.rotation.x = -0.22;
        if (N.kneeL) N.kneeL.rotation.x = 0.35;
        N.legR.rotation.x = 0.14;
        if (N.kneeR) N.kneeR.rotation.x = 0.28;
      } else {
        const stride = Math.sin(P.bob) * 0.55 * CAM.bobAmt;
        const kneeL = Math.max(0, -Math.cos(P.bob)) * 0.55 * CAM.bobAmt;
        const kneeR = Math.max(0, Math.cos(P.bob)) * 0.55 * CAM.bobAmt;
        N.legL.rotation.x = stride;
        if (N.kneeL) N.kneeL.rotation.x = kneeL;
        N.legR.rotation.x = -stride;
        if (N.kneeR) N.kneeR.rotation.x = kneeR;
        N.torsoGroup.rotation.y = Math.sin(P.bob) * 0.04 * CAM.bobAmt;
      }
      return;
    }
    N.root.visible = true;
    N.head.visible = true;
    N.armL.visible = true;
    N.armR.visible = true;
    N.legR.visible = true;
    if (N.rosary) N.rosary.root.visible = !!P.hasRosary;
    N.root.position.copy(P.pos);
    N.root.rotation.set(0, P.yaw + Math.PI, 0);
    resetNivaldoPose();

    if (S.glory) {
      const gk = S.glory;
      const p = clamp(gk.t / gk.dur, 0, 1);
      const hitP = gk.hitAt / gk.dur;
      const tt = gk.t;
      if (gk.kind === 'rip') {
        const T = RIP_T;
        if (tt < T.grab) {
          const ease = sm01(tt / T.grab);
          N.torsoGroup.position.y = 0.98 - 0.08 * ease;
          N.torsoGroup.rotation.x = ease * 0.14;
          N.chestGroup.rotation.x = ease * 0.16;
          N.shoulderL.rotation.set(0, 0.25 * ease, 0.06 * ease);
          N.shoulderR.rotation.set(0, -0.25 * ease, -0.06 * ease);
          N.armL.rotation.set(-1.15 * ease, 0, 0.28 * ease);
          N.armR.rotation.set(-1.15 * ease, 0, -0.28 * ease);
          N.forearmL.rotation.x = -0.22 - 0.45 * ease;
          N.forearmR.rotation.x = -0.22 - 0.45 * ease;
          N.legL.rotation.x = -0.32 * ease;
          N.kneeL.rotation.x = 0.36 * ease;
          N.footL.rotation.x = -0.04 * ease;
          N.legR.rotation.x = 0.22 * ease;
          N.kneeR.rotation.x = 0.28 * ease;
          N.footR.rotation.x = -0.18 * ease;
        } else if (tt < T.split) {
          const u = sm01((tt - T.grab) / (T.split - T.grab));
          N.torsoGroup.position.y = 0.90 - 0.04 * u;
          N.torsoGroup.rotation.x = 0.14 - 0.28 * u;
          N.chestGroup.rotation.x = 0.16 - 0.34 * u;
          N.head.rotation.x = -0.28 * u;
          N.shoulderL.rotation.set(0, 0.25 - 0.45 * u, 0.06 - 0.24 * u);
          N.shoulderR.rotation.set(0, -0.25 + 0.45 * u, -0.06 + 0.24 * u);
          N.armL.rotation.set(-1.15 - 1.10 * u, 0, 0.28);
          N.armR.rotation.set(-1.15 - 1.10 * u, 0, -0.28);
          N.forearmL.rotation.x = -0.67 + 0.22 * u;
          N.forearmR.rotation.x = -0.67 + 0.22 * u;
          N.legL.rotation.x = -0.32 - 0.04 * u;
          N.kneeL.rotation.x = 0.36 + 0.06 * u;
          N.footL.rotation.x = -0.04;
          N.legR.rotation.x = 0.22 + 0.02 * u;
          N.kneeR.rotation.x = 0.28 + 0.04 * u;
          N.footR.rotation.x = -0.18;
        } else if (tt < T.release) {
          const u = sm01((tt - T.split) / (T.tearEnd - T.split));
          const vib = Math.sin(tt * 30) * 0.03 * u;
          N.torsoGroup.position.y = 0.86;
          N.torsoGroup.rotation.set(-0.14 - 0.06 * u + vib, vib * 2, 0);
          N.chestGroup.rotation.set(-0.18 - 0.12 * u + vib, 0, 0);
          N.head.rotation.x = -0.34;
          N.shoulderL.rotation.set(0, -0.20 - 0.25 * u, -0.18 - 0.10 * u);
          N.shoulderR.rotation.set(0, 0.20 + 0.25 * u, 0.18 + 0.10 * u);
          N.armL.rotation.set(-2.25 - 0.20 * u, 0, 0.28 - 1.25 * u);
          N.armR.rotation.set(-2.25 - 0.20 * u, 0, -0.28 + 1.25 * u);
          N.forearmL.rotation.set(-0.45 - 0.25 * u, 0, -0.15 * u);
          N.forearmR.rotation.set(-0.45 - 0.25 * u, 0, 0.15 * u);
          N.legL.rotation.x = -0.36;
          N.kneeL.rotation.x = 0.42;
          N.footL.rotation.x = -0.06;
          N.legR.rotation.x = 0.24;
          N.kneeR.rotation.x = 0.32;
          N.footR.rotation.x = -0.20;
        } else {
          const v = sm01((tt - T.release) / (gk.dur - T.release));
          N.torsoGroup.position.y = 0.86 + 0.12 * v;
          N.torsoGroup.rotation.x = -0.20 * (1 - v);
          N.chestGroup.rotation.x = -0.30 * (1 - v);
          N.head.rotation.x = -0.34 * (1 - v);
          N.shoulderL.rotation.set(0, -0.45 * (1 - v), -0.28 * (1 - v));
          N.shoulderR.rotation.set(0, 0.45 * (1 - v), 0.28 * (1 - v));
          N.armL.rotation.set(-2.45 * (1 - v) - 0.25 * v, 0, -0.97 * (1 - v) + 0.22 * v);
          N.armR.rotation.set(-2.45 * (1 - v) - 0.25 * v, 0, 0.97 * (1 - v) - 0.22 * v);
          N.forearmL.rotation.set(-0.70 * (1 - v) - 0.22 * v, 0, -0.15 * (1 - v));
          N.forearmR.rotation.set(-0.70 * (1 - v) - 0.22 * v, 0, 0.15 * (1 - v));
          N.legL.rotation.x = -0.36 * (1 - v);
          N.kneeL.rotation.x = 0.42 * (1 - v);
          N.footL.rotation.x = -0.06 * (1 - v);
          N.legR.rotation.x = 0.24 * (1 - v);
          N.kneeR.rotation.x = 0.32 * (1 - v);
          N.footR.rotation.x = -0.20 * (1 - v);
        }
      } else if (gk.kind === 'decap') {
        const T = DEC_T;
        if (tt < T.grab) {
          const ease = sm01(tt / T.grab);
          N.torsoGroup.position.y = 0.98 - 0.06 * ease;
          N.torsoGroup.rotation.x = ease * 0.12;
          N.chestGroup.rotation.x = ease * 0.14;
          N.shoulderL.rotation.set(0, 0.22 * ease, 0);
          N.shoulderR.rotation.set(0, -0.22 * ease, 0);
          N.armL.rotation.set(-1.55 * ease, 0, 0.32 * ease);
          N.armR.rotation.set(-1.55 * ease, 0, -0.32 * ease);
          N.forearmL.rotation.x = -0.22 - 0.48 * ease;
          N.forearmR.rotation.x = -0.22 - 0.48 * ease;
          N.legL.rotation.x = -0.26 * ease;
          N.kneeL.rotation.x = 0.30 * ease;
          N.legR.rotation.x = 0.20 * ease;
          N.kneeR.rotation.x = 0.24 * ease;
        } else if (tt < T.raise) {
          const u = sm01((tt - T.grab) / (T.raise - T.grab));
          N.torsoGroup.position.y = 0.92 + 0.02 * u;
          N.torsoGroup.rotation.x = 0.12 - 0.24 * u;
          N.chestGroup.rotation.x = 0.14 - 0.30 * u;
          N.head.rotation.x = -0.25 * u;
          N.shoulderL.rotation.set(0, 0.22 - 0.32 * u, -0.22 * u);
          N.shoulderR.rotation.set(0, -0.22 + 0.32 * u, 0.22 * u);
          N.armL.rotation.set(-1.55 - 0.40 * u, 0, 0.32);
          N.armR.rotation.set(-1.55 - 0.40 * u, 0, -0.32);
          N.forearmL.rotation.x = -0.70 + 0.15 * u;
          N.forearmR.rotation.x = -0.70 + 0.15 * u;
          N.legL.rotation.x = -0.26;
          N.kneeL.rotation.x = 0.30;
          N.legR.rotation.x = 0.20;
          N.kneeR.rotation.x = 0.24;
        } else if (tt < T.throwStart) {
          const u = sm01((tt - T.raise) / (T.throwStart - T.raise));
          const vib = Math.sin(tt * 26) * 0.03;
          N.torsoGroup.position.y = 0.94;
          N.torsoGroup.rotation.set(-0.12 - 0.08 * u + vib, 0, 0);
          N.chestGroup.rotation.set(-0.16 - 0.14 * u + vib, 0, 0);
          N.head.rotation.x = -0.28;
          N.shoulderL.rotation.set(0, -0.10 - 0.12 * u, -0.22);
          N.shoulderR.rotation.set(0, 0.10 + 0.12 * u, 0.22);
          N.armL.rotation.set(-1.95 - 0.45 * u, 0, 0.32 - 0.08 * u);
          N.armR.rotation.set(-1.95 - 0.45 * u, 0, -0.32 + 0.08 * u);
          N.forearmL.rotation.x = -0.55 - 0.30 * u;
          N.forearmR.rotation.x = -0.55 - 0.30 * u;
          N.legL.rotation.x = -0.26;
          N.kneeL.rotation.x = 0.30;
          N.legR.rotation.x = 0.20;
          N.kneeR.rotation.x = 0.24;
        } else if (tt < T.throwEnd) {
          const u = sm01((tt - T.throwStart) / (T.throwEnd - T.throwStart));
          N.torsoGroup.position.y = 0.94 - 0.08 * u;
          N.torsoGroup.rotation.x = -0.20 + 0.56 * u;
          N.chestGroup.rotation.x = -0.30 + 0.68 * u;
          N.head.rotation.x = -0.28 + 0.40 * u;
          N.shoulderL.rotation.set(0, -0.22 + 0.52 * u, -0.22 + 0.22 * u);
          N.shoulderR.rotation.set(0, 0.22 - 0.52 * u, 0.22 - 0.22 * u);
          N.armL.rotation.set(-2.40 + 1.55 * u, 0, 0.24 - 0.08 * u);
          N.armR.rotation.set(-2.40 + 1.55 * u, 0, -0.24 + 0.08 * u);
          N.forearmL.rotation.x = -0.85 + 0.70 * u;
          N.forearmR.rotation.x = -0.85 + 0.70 * u;
          N.handL.rotation.x = 0.25 * u;
          N.handR.rotation.x = 0.25 * u;
          N.legL.rotation.x = -0.26 - 0.14 * u;
          N.kneeL.rotation.x = 0.30 + 0.18 * u;
          N.legR.rotation.x = 0.20 + 0.10 * u;
          N.kneeR.rotation.x = 0.24 + 0.08 * u;
        } else {
          const v = sm01((tt - T.throwEnd) / (gk.dur - T.throwEnd));
          N.torsoGroup.position.y = 0.86 + 0.12 * v;
          N.torsoGroup.rotation.x = 0.36 * (1 - v);
          N.chestGroup.rotation.x = 0.38 * (1 - v);
          N.head.rotation.x = 0.12 * (1 - v);
          N.shoulderL.rotation.set(0, 0.30 * (1 - v), 0);
          N.shoulderR.rotation.set(0, -0.30 * (1 - v), 0);
          N.armL.rotation.set(-0.85 * (1 - v) - 0.2 * v, 0, 0.16 * (1 - v) + 0.18 * v);
          N.armR.rotation.set(-0.85 * (1 - v) - 0.2 * v, 0, -0.16 * (1 - v) - 0.18 * v);
          N.forearmL.rotation.x = -0.15 * (1 - v) - 0.22 * v;
          N.forearmR.rotation.x = -0.15 * (1 - v) - 0.22 * v;
          N.handL.rotation.x = 0.25 * (1 - v);
          N.handR.rotation.x = 0.25 * (1 - v);
          N.legL.rotation.x = -0.40 * (1 - v);
          N.kneeL.rotation.x = 0.48 * (1 - v);
          N.legR.rotation.x = 0.30 * (1 - v);
          N.kneeR.rotation.x = 0.32 * (1 - v);
        }
      } else if (gk.kind === 'hammer' && gk.variant === 'side') {
        N.hammer.visible = true;
        N.hammer.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.5);
        const w0 = hitP * 0.70;
        let yaw, chestYaw, lean = 0, elbowR = -0.55, elbowL = -0.85, shR = 0, wristR = 0;
        if (p < w0) {
          const u = sm01(p / w0);
          yaw = 0.55 * u; chestYaw = 0.65 * u; lean = -0.10 * u;
          elbowR = -0.55 - 0.35 * u; shR = 0.28 * u;
          N.armR.rotation.set(-1.15, 0, -0.15 * u);
          N.armL.rotation.set(-0.85, 0, -0.30);
        } else if (p < hitP) {
          const u = sm01((p - w0) / (hitP - w0));
          yaw = 0.55 * (1 - u); chestYaw = 0.65 * (1 - u); lean = -0.10 + 0.16 * u;
          elbowR = -0.90 + 0.65 * u; shR = 0.28 - 0.52 * u; wristR = 0.25 * u;
          N.armR.rotation.set(-1.15, 0, -0.15 + 0.15 * u);
          N.armL.rotation.set(-0.85, 0, -0.30);
        } else if (p < hitP + 0.10) {
          const u = sm01((p - hitP) / 0.10);
          yaw = -0.52 * u; chestYaw = -0.58 * u; lean = 0.06;
          elbowR = -0.25; shR = -0.24 - 0.12 * u; wristR = 0.25;
          N.armR.rotation.set(-1.15, 0, 0);
          N.armL.rotation.set(-0.85, 0, -0.30);
        } else {
          const u = sm01((p - hitP - 0.10) / (1 - hitP - 0.10));
          yaw = -0.52 * (1 - u * 0.75); chestYaw = -0.58 * (1 - u * 0.75); lean = 0.06 * (1 - u);
          elbowR = -0.25 - 0.15 * u; shR = -0.36 * (1 - u); wristR = 0.25 * (1 - u);
          N.armR.rotation.set(-1.15 + 0.65 * u, 0, 0);
          N.armL.rotation.set(-0.85 + 0.55 * u, 0, -0.30);
        }
        N.torsoGroup.position.y = 0.88;
        N.torsoGroup.rotation.set(lean * 0.5, yaw, 0);
        N.chestGroup.rotation.set(lean * 0.5, chestYaw, 0);
        N.shoulderR.rotation.set(0, shR, 0);
        N.forearmR.rotation.x = elbowR;
        N.forearmL.rotation.x = elbowL;
        N.handR.rotation.set(0, 0, wristR);
        N.legL.rotation.x = -0.35;
        N.kneeL.rotation.x = 0.45;
        N.footL.rotation.x = -0.10;
        N.legR.rotation.x = 0.22;
        N.kneeR.rotation.x = 0.32;
        N.footR.rotation.x = -0.16;
      } else if (gk.kind === 'hammer') {
        N.hammer.visible = true;
        const tm = gk.t;
        if (tm < 0.65) {
          const u = sm01(tm / 0.65);
          N.torsoGroup.position.y = 0.98 - 0.08 * u;
          N.torsoGroup.rotation.set(-0.16 * u, 0, 0);
          N.chestGroup.rotation.set(-0.22 * u, 0, 0);
          N.head.rotation.x = -0.15 * u;
          N.shoulderL.rotation.set(0, 0, -0.20 * u);
          N.shoulderR.rotation.set(0, 0, 0.20 * u);
          N.armR.rotation.set(-2.35 * u, 0, -0.10 * u);
          N.armL.rotation.set(-2.15 * u, 0, 0.28 * u);
          N.forearmR.rotation.x = -0.22 - 0.65 * u;
          N.forearmL.rotation.x = -0.22 - 0.65 * u;
          N.legL.rotation.x = -0.32 * u;
          N.kneeL.rotation.x = 0.38 * u;
          N.legR.rotation.x = 0.22 * u;
          N.kneeR.rotation.x = 0.28 * u;
        } else if (tm < 0.85) {
          const tr = Math.sin(tm * 40) * 0.025;
          N.torsoGroup.position.y = 0.90;
          N.torsoGroup.rotation.set(-0.16 + tr, 0, 0);
          N.chestGroup.rotation.set(-0.22 + tr, 0, 0);
          N.head.rotation.x = -0.15;
          N.shoulderL.rotation.set(0, 0, -0.20);
          N.shoulderR.rotation.set(0, 0, 0.20);
          N.armR.rotation.set(-2.35 + tr * 2, 0, -0.10);
          N.armL.rotation.set(-2.15 + tr * 2, 0, 0.28);
          N.forearmR.rotation.x = -0.87;
          N.forearmL.rotation.x = -0.87;
          N.legL.rotation.x = -0.32;
          N.kneeL.rotation.x = 0.38;
          N.legR.rotation.x = 0.22;
          N.kneeR.rotation.x = 0.28;
        } else if (tm < gk.hitAt) {
          const u = (tm - 0.85) / (gk.hitAt - 0.85), s = u * u;
          N.torsoGroup.position.y = 0.90 - 0.06 * s;
          N.torsoGroup.rotation.set(-0.16 + s * 0.38, 0, 0);
          N.chestGroup.rotation.set(-0.22 + s * 0.52, 0, 0);
          N.head.rotation.x = -0.15 + s * 0.30;
          N.shoulderL.rotation.set(0, 0.22 * s, -0.20 * (1 - s));
          N.shoulderR.rotation.set(0, -0.22 * s, 0.20 * (1 - s));
          N.armR.rotation.set(-2.35 + s * 1.65, 0, -0.10 + s * 0.10);
          N.armL.rotation.set(-2.15 + s * 1.35, 0, 0.28 - s * 0.10);
          N.forearmR.rotation.x = -0.87 + 0.70 * s;
          N.forearmL.rotation.x = -0.87 + 0.55 * s;
          N.handR.rotation.x = 0.35 * s;
          N.legL.rotation.x = -0.32 - 0.08 * s;
          N.kneeL.rotation.x = 0.38 + 0.12 * s;
          N.legR.rotation.x = 0.22 + 0.06 * s;
          N.kneeR.rotation.x = 0.28 + 0.08 * s;
        } else {
          const u = sm01((tm - gk.hitAt - 0.35) / (gk.dur - gk.hitAt - 0.35));
          const bounce = Math.max(0, 1 - (tm - gk.hitAt) * 6) * 0.06;
          N.torsoGroup.position.y = 0.84 + 0.14 * u;
          N.torsoGroup.rotation.set(0.22 * (1 - u) + bounce, 0, 0);
          N.chestGroup.rotation.set(0.30 * (1 - u) + bounce, 0, 0);
          N.head.rotation.x = 0.15 * (1 - u);
          N.shoulderL.rotation.set(0, 0.22 * (1 - u), 0);
          N.shoulderR.rotation.set(0, -0.22 * (1 - u), 0);
          N.armR.rotation.set(-0.70 * (1 - u) - 0.25 * u - bounce * 2, 0, 0);
          N.armL.rotation.set(-0.80 * (1 - u) - 0.25 * u, 0, 0.18 * (1 - u));
          N.forearmR.rotation.x = -0.17 * (1 - u) - 0.22 * u;
          N.forearmL.rotation.x = -0.32 * (1 - u) - 0.22 * u;
          N.handR.rotation.x = 0.35 * (1 - u);
          N.legL.rotation.x = -0.40 * (1 - u);
          N.kneeL.rotation.x = 0.50 * (1 - u);
          N.legR.rotation.x = 0.28 * (1 - u);
          N.kneeR.rotation.x = 0.36 * (1 - u);
        }
      } else if (gk.kind === 'kick') {
        if (p < hitP * 0.72) {
          const u = p / (hitP * 0.72);
          const ease = u * u * (3 - 2 * u);
          N.torsoGroup.position.y = 0.98 - 0.06 * ease;
          N.torsoGroup.rotation.set(-0.18 * ease, -0.22 * ease, -0.06 * ease);
          N.chestGroup.rotation.set(-0.18 * ease, -0.22 * ease, -0.06 * ease);
          N.legR.rotation.x = 0.45 * ease;
          N.kneeR.rotation.x = 1.25 * ease;
          N.footR.rotation.x = 0.20 * ease;
          N.legL.rotation.x = -0.22 * ease;
          N.kneeL.rotation.x = 0.32 * ease;
          N.footL.rotation.x = -0.10 * ease;
          N.armL.rotation.set(-0.75 * ease, 0, 0.48 * ease);
          N.armR.rotation.set(0.40 * ease, 0, -0.40 * ease);
          N.forearmL.rotation.x = -0.22 - 0.65 * ease;
          N.forearmR.rotation.x = -0.22 - 0.55 * ease;
        } else if (p < hitP + 0.12) {
          const u = (p - hitP * 0.72) / (hitP * 0.28 + 0.12);
          const snap = Math.min(1, u);
          N.torsoGroup.position.y = 0.92;
          N.torsoGroup.rotation.set(-0.18 + snap * 0.04, -0.22 + snap * 0.40, -0.06);
          N.chestGroup.rotation.set(-0.18 + snap * 0.04, -0.22 + snap * 0.44, -0.06);
          N.legR.rotation.x = 0.45 - snap * 2.10;
          N.kneeR.rotation.x = 1.25 * (1 - snap) + 0.08 * snap;
          N.footR.rotation.x = 0.20 + 0.15 * snap;
          N.legL.rotation.x = -0.22;
          N.kneeL.rotation.x = 0.32;
          N.footL.rotation.x = -0.10;
          N.armL.rotation.set(-0.75 + snap * 0.45, 0, 0.48);
          N.armR.rotation.set(0.40 - snap * 1.0, 0, -0.40);
          N.forearmL.rotation.x = -0.87;
          N.forearmR.rotation.x = -0.77 + 0.25 * snap;
        } else {
          const u = (p - hitP - 0.12) / (1 - hitP - 0.12);
          const rec = Math.max(0, 1 - u * 1.2);
          N.torsoGroup.position.y = 0.98 - 0.06 * rec;
          N.torsoGroup.rotation.set(-0.14 * rec, 0.18 * rec, -0.06 * rec);
          N.chestGroup.rotation.set(-0.14 * rec, 0.22 * rec, -0.06 * rec);
          N.legR.rotation.x = -1.65 * rec;
          N.kneeR.rotation.x = 0.08 * rec;
          N.footR.rotation.x = 0.35 * rec;
          N.legL.rotation.x = -0.22 * rec;
          N.kneeL.rotation.x = 0.32 * rec;
          N.armL.rotation.set(-0.30 * rec, 0, 0.48 * rec);
          N.armR.rotation.set(-0.60 * rec, 0, -0.40 * rec);
          N.forearmL.rotation.x = -0.22 - 0.65 * rec;
          N.forearmR.rotation.x = -0.22 - 0.30 * rec;
        }
      } else if (gk.kind === 'padre_cross') {
        const T = PADRE_T;
        if (tt < T.snatch) {
          const u = sm01(tt / T.snatch);
          N.torsoGroup.rotation.set(0.10 * u, -0.25 * u, 0);
          N.chestGroup.rotation.set(0.12 * u, -0.25 * u, 0);
          N.armR.rotation.set(-1.35 * u, 0, -0.15 * u);
          N.forearmR.rotation.x = -0.35 * u;
          N.armL.rotation.set(-0.65 * u, 0, 0.25 * u);
        } else if (tt < T.raise) {
          const u = sm01((tt - T.snatch) / (T.raise - T.snatch));
          N.torsoGroup.rotation.set(0.10 - 0.26 * u, -0.25 + 0.35 * u, 0);
          N.chestGroup.rotation.set(0.12 - 0.32 * u, -0.25 + 0.35 * u, 0);
          N.armR.rotation.set(-1.35 - 1.15 * u, 0, -0.15 + 0.15 * u);
          N.forearmR.rotation.x = -0.35 - 0.45 * u;
          N.armL.rotation.set(-0.65 - 0.85 * u, 0, 0.25 - 0.10 * u);
        } else if (tt < T.stab) {
          const u = sm01((tt - T.raise) / (T.stab - T.raise));
          const s = u * u;
          N.torsoGroup.position.y = 0.98 - 0.10 * s;
          N.torsoGroup.rotation.set(-0.16 + 0.42 * s, 0.10 - 0.10 * s, 0);
          N.chestGroup.rotation.set(-0.20 + 0.50 * s, 0.10 - 0.10 * s, 0);
          N.armR.rotation.set(-2.50 + 1.55 * s, 0, 0);
          N.forearmR.rotation.x = -0.80 + 0.55 * s;
          N.armL.rotation.set(-1.50 + 0.90 * s, 0, 0.15);
        } else if (tt < T.chamber) {
          const u = sm01((tt - T.stab) / (T.chamber - T.stab));
          N.torsoGroup.position.y = 0.88 + 0.06 * u;
          N.torsoGroup.rotation.set(0.26 * (1 - u) - 0.16 * u, -0.22 * u, 0);
          N.chestGroup.rotation.set(0.30 * (1 - u) - 0.18 * u, -0.22 * u, 0);
          N.legR.rotation.x = 0.48 * u;
          N.kneeR.rotation.x = 1.25 * u;
          N.legL.rotation.x = -0.24 * u;
          N.kneeL.rotation.x = 0.32 * u;
          N.armR.rotation.set(-0.95 + 1.25 * u, 0, -0.35 * u);
          N.armL.rotation.set(-0.60 - 0.20 * u, 0, 0.45 * u);
        } else if (tt < T.kick + 0.14) {
          const u = sm01((tt - T.chamber) / (T.kick - T.chamber + 0.14));
          N.torsoGroup.position.y = 0.94;
          N.torsoGroup.rotation.set(-0.16 + 0.06 * u, -0.22 + 0.40 * u, -0.05);
          N.chestGroup.rotation.set(-0.18 + 0.06 * u, -0.22 + 0.42 * u, -0.05);
          N.legR.rotation.x = 0.48 - 2.15 * u;
          N.kneeR.rotation.x = 1.25 * (1 - u) + 0.08 * u;
          N.footR.rotation.x = 0.30 * u;
          N.legL.rotation.x = -0.24;
          N.kneeL.rotation.x = 0.32;
          N.armR.rotation.set(0.30 - 0.90 * u, 0, -0.35);
          N.armL.rotation.set(-0.80 + 0.40 * u, 0, 0.45);
        } else {
          const v = sm01((tt - T.kick - 0.14) / (T.end - T.kick - 0.14));
          const rec = 1 - v;
          N.torsoGroup.rotation.set(-0.10 * rec, 0.18 * rec, 0);
          N.legR.rotation.x = -1.67 * rec;
          N.kneeR.rotation.x = 0.08 * rec;
          N.armR.rotation.set(-0.60 * rec, 0, -0.35 * rec);
          N.armL.rotation.set(-0.40 * rec, 0, 0.45 * rec);
        }
      } else if (gk.kind === 'demon_smash') {
        N.hammer.visible = true;
        const T = DEMON_T;
        const swings = [
          { t0: 0, t1: T.hit1, side: 1 },
          { t0: T.hit1, t1: T.hit2, side: -1 },
          { t0: T.hit2, t1: T.hit3, side: 1 },
          { t0: T.hit3, t1: T.hit4, side: 0 }
        ];
        let active = null;
        for (const sw of swings) { if (tt < sw.t1) { active = sw; break; } }
        if (active) {
          const u = sm01((tt - active.t0) / (active.t1 - active.t0));
          if (u < 0.6) {
            const w = u / 0.6;
            N.torsoGroup.position.y = 0.98 - 0.08 * w;
            N.torsoGroup.rotation.set(-0.20 * w, active.side * 0.45 * w, 0);
            N.chestGroup.rotation.set(-0.24 * w, active.side * 0.50 * w, 0);
            N.armR.rotation.set(-2.45 * w, 0, -0.15 * w);
            N.armL.rotation.set(-2.25 * w, 0, 0.25 * w);
            N.forearmR.rotation.x = -0.85 * w;
            N.forearmL.rotation.x = -0.85 * w;
          } else {
            const s = (u - 0.6) / 0.4;
            const sq = s * s;
            N.torsoGroup.position.y = 0.90 - 0.10 * sq;
            N.torsoGroup.rotation.set(-0.20 + 0.56 * sq, active.side * (0.45 - 0.90 * sq), 0);
            N.chestGroup.rotation.set(-0.24 + 0.64 * sq, active.side * (0.50 - 1.00 * sq), 0);
            N.armR.rotation.set(-2.45 + 1.80 * sq, 0, 0);
            N.armL.rotation.set(-2.25 + 1.55 * sq, 0, 0.25 * (1 - sq));
            N.forearmR.rotation.x = -0.85 + 0.65 * sq;
            N.forearmL.rotation.x = -0.85 + 0.55 * sq;
          }
          N.legL.rotation.x = -0.34;
          N.kneeL.rotation.x = 0.42;
          N.legR.rotation.x = 0.24;
          N.kneeR.rotation.x = 0.30;
        } else {
          const v = sm01((tt - T.hit4) / (T.end - T.hit4));
          const rec = 1 - v;
          N.torsoGroup.position.y = 0.80 + 0.18 * v;
          N.torsoGroup.rotation.set(0.36 * rec, 0, 0);
          N.chestGroup.rotation.set(0.40 * rec, 0, 0);
          N.armR.rotation.set(-0.65 * rec - 0.25 * v, 0, 0);
          N.armL.rotation.set(-0.70 * rec - 0.25 * v, 0, 0);
        }
      } else if (gk.kind === 'wing_rip') {
        const T = WING_T;
        if (tt < T.grab) {
          const u = sm01(tt / T.grab);
          N.torsoGroup.position.y = 0.98 + 0.04 * u;
          N.torsoGroup.rotation.set(-0.14 * u, 0, 0);
          N.chestGroup.rotation.set(-0.16 * u, 0, 0);
          N.armL.rotation.set(-2.10 * u, 0, 0.25 * u);
          N.armR.rotation.set(-2.10 * u, 0, -0.25 * u);
          N.forearmL.rotation.x = -0.35 * u;
          N.forearmR.rotation.x = -0.35 * u;
        } else if (tt < T.slam) {
          const u = sm01((tt - T.grab) / (T.slam - T.grab));
          const s = u * u;
          N.torsoGroup.position.y = 1.02 - 0.18 * s;
          N.torsoGroup.rotation.set(-0.14 + 0.52 * s, 0, 0);
          N.chestGroup.rotation.set(-0.16 + 0.56 * s, 0, 0);
          N.armL.rotation.set(-2.10 + 1.35 * s, 0, 0.25 - 0.05 * s);
          N.armR.rotation.set(-2.10 + 1.35 * s, 0, -0.25 + 0.05 * s);
          N.forearmL.rotation.x = -0.35 - 0.20 * s;
          N.forearmR.rotation.x = -0.35 - 0.20 * s;
          N.legL.rotation.x = -0.28 * s;
          N.kneeL.rotation.x = 0.36 * s;
        } else if (tt < T.rip) {
          const u = sm01((tt - T.slam) / (T.rip - T.slam));
          const vib = Math.sin(tt * 34) * 0.035;
          N.torsoGroup.position.y = 0.84;
          N.torsoGroup.rotation.set(0.38 - 0.56 * u + vib, 0, 0);
          N.chestGroup.rotation.set(0.40 - 0.62 * u + vib, 0, 0);
          N.legR.rotation.x = -0.92;
          N.kneeR.rotation.x = 1.02;
          N.legL.rotation.x = -0.28;
          N.kneeL.rotation.x = 0.36;
          N.armL.rotation.set(-0.75 - 1.25 * u, 0, 0.20 - 0.72 * u);
          N.armR.rotation.set(-0.75 - 1.25 * u, 0, -0.20 + 0.72 * u);
          N.forearmL.rotation.x = -0.55 - 0.20 * u;
          N.forearmR.rotation.x = -0.55 - 0.20 * u;
        } else if (tt < T.stomp) {
          const u = sm01((tt - T.rip) / (T.stomp - T.rip));
          const stomping = u > 0.68 ? sm01((u - 0.68) / 0.32) : 0;
          const raise = u <= 0.68 ? sm01(u / 0.68) : 1 - stomping;
          N.torsoGroup.position.y = 0.90 + 0.10 * raise - 0.12 * stomping;
          N.torsoGroup.rotation.set(-0.18 + 0.34 * stomping, 0, 0);
          N.legR.rotation.x = -0.92 - 0.58 * raise + 1.25 * stomping;
          N.kneeR.rotation.x = 1.02 + 0.48 * raise - 1.15 * stomping;
          N.armL.rotation.set(-2.00 + 0.55 * stomping, 0, -0.52);
          N.armR.rotation.set(-2.00 + 0.55 * stomping, 0, 0.52);
        } else if (tt < T.throwWings) {
          const u = sm01((tt - T.stomp) / (T.throwWings - T.stomp));
          N.torsoGroup.position.y = 0.88 + 0.08 * u;
          N.torsoGroup.rotation.set(0.16 - 0.30 * (1 - u) + 0.28 * u, 0, 0);
          N.armL.rotation.set(-1.45 + 0.95 * u, 0, -0.52 + 1.10 * u);
          N.armR.rotation.set(-1.45 + 0.95 * u, 0, 0.52 - 1.10 * u);
        } else {
          const v = sm01((tt - T.throwWings) / (T.end - T.throwWings));
          const rec = 1 - v;
          N.torsoGroup.rotation.set(0.14 * rec, 0, 0);
          N.armL.rotation.set(-0.50 * rec, 0, 0.58 * rec);
          N.armR.rotation.set(-0.50 * rec, 0, -0.58 * rec);
        }
      } else if (gk.kind === 'trident_impale') {
        const T = TRIDENT_T;
        if (tt < T.push) {
          const u = sm01(tt / T.push);
          N.torsoGroup.rotation.set(0.22 * u, 0, 0);
          N.chestGroup.rotation.set(0.24 * u, 0, 0);
          N.armL.rotation.set(-1.45 * u, 0, 0.20 * u);
          N.armR.rotation.set(-1.45 * u, 0, -0.20 * u);
          N.forearmL.rotation.x = -0.15;
          N.forearmR.rotation.x = -0.15;
        } else if (tt < T.grab) {
          const u = sm01((tt - T.push) / (T.grab - T.push));
          N.torsoGroup.rotation.set(0.22 - 0.14 * u, -0.28 * u, 0);
          N.armR.rotation.set(-1.45 + 0.20 * u, 0, -0.20);
          N.armL.rotation.set(-1.45 + 0.45 * u, 0, 0.20);
        } else if (tt < T.raise) {
          const u = sm01((tt - T.grab) / (T.raise - T.grab));
          N.torsoGroup.position.y = 0.98 + 0.10 * u;
          N.torsoGroup.rotation.set(0.08 - 0.28 * u, -0.28 * (1 - u), 0);
          N.chestGroup.rotation.set(-0.24 * u, 0, 0);
          N.armR.rotation.set(-1.25 - 1.35 * u, 0, 0);
          N.armL.rotation.set(-1.00 - 1.50 * u, 0, 0.20 * (1 - u));
          N.forearmR.rotation.x = -0.50 * u;
          N.forearmL.rotation.x = -0.50 * u;
        } else if (tt < T.impale) {
          const u = sm01((tt - T.raise) / (T.impale - T.raise));
          const s = u * u;
          N.torsoGroup.position.y = 1.08 - 0.24 * s;
          N.torsoGroup.rotation.set(-0.20 + 0.56 * s, 0, 0);
          N.chestGroup.rotation.set(-0.24 + 0.64 * s, 0, 0);
          N.armR.rotation.set(-2.60 + 1.85 * s, 0, 0);
          N.armL.rotation.set(-2.50 + 1.75 * s, 0, 0);
          N.forearmR.rotation.x = -0.50 + 0.35 * s;
          N.forearmL.rotation.x = -0.50 + 0.35 * s;
          N.legL.rotation.x = -0.35 * s;
          N.kneeL.rotation.x = 0.45 * s;
          N.legR.rotation.x = 0.28 * s;
          N.kneeR.rotation.x = 0.38 * s;
        } else {
          const v = sm01((tt - T.impale) / (T.end - T.impale));
          const rec = 1 - v;
          N.torsoGroup.position.y = 0.84 + 0.14 * v;
          N.torsoGroup.rotation.set(0.36 * rec, 0, 0);
          N.chestGroup.rotation.set(0.40 * rec, 0, 0);
          N.armR.rotation.set(-0.75 * rec, 0, 0);
          N.armL.rotation.set(-0.75 * rec, 0, 0);
          N.legL.rotation.x = -0.35 * rec;
          N.kneeL.rotation.x = 0.45 * rec;
          N.legR.rotation.x = 0.28 * rec;
          N.kneeR.rotation.x = 0.38 * rec;
        }
      }
      if (gk.fx) {
        N.root.updateMatrixWorld(true);
        updateGloryProps(gk);
      }
    } else if (P.kickT > 0) {
      const p = clamp(1 - P.kickT / (P.kickDur || 0.36), 0, 1);
      const s = Math.sin(p * Math.PI);
      const chamber = p < 0.35 ? sm01(p / 0.35) : Math.max(0, 1 - (p - 0.35) / 0.25);
      N.torsoGroup.rotation.set(-0.12 * s, 0.14 * s, -0.04 * s);
      if (N.chestGroup) N.chestGroup.rotation.set(-0.12 * s, 0.16 * s, -0.04 * s);
      N.legR.rotation.x = -1.55 * s;
      if (N.kneeR) N.kneeR.rotation.x = 0.95 * chamber + 0.08 * s;
      if (N.footR) N.footR.rotation.x = 0.28 * s;
      N.legL.rotation.x = 0.16 * s;
      if (N.kneeL) N.kneeL.rotation.x = 0.24 * s;
      N.armL.rotation.set(-0.4 * s, 0, 0.35 * s);
      N.armR.rotation.set(0.35 * s, 0, -0.35 * s);
      if (N.forearmL) N.forearmL.rotation.x = -0.55 * s;
      if (N.forearmR) N.forearmR.rotation.x = -0.55 * s;
    } else if (S.cutscene > 0 && S.csKind === 'maximusIntro') {
      const t = S.csT;
      if (t < 3.4) {
        N.torsoGroup.position.y = 0.96;
        N.torsoGroup.rotation.x = -0.04;
        N.head.rotation.x = -0.18;
        N.armL.rotation.set(-0.25, 0, 0.22);
        N.armR.rotation.set(-0.25, 0, -0.22);
        N.forearmL.rotation.x = -0.45;
        N.forearmR.rotation.x = -0.45;
      } else if (t < 11.6) {
        const sh = sm01((t - 3.4) / 0.5);
        N.torsoGroup.position.y = 0.95;
        N.torsoGroup.rotation.set(0.06 * sh, -0.08 * sh, 0);
        N.head.rotation.set(0.06 * sh, 0.08 * sh, -0.06 * sh);
        N.armL.rotation.set(-0.55 * sh, 0, 0.26);
        N.armR.rotation.set(-0.18 * sh, 0, -0.20);
        N.forearmL.rotation.x = -0.75 * sh;
        N.forearmR.rotation.x = -0.35 * sh;
      } else {
        const rage = sm01((t - 11.6) / 0.45);
        const vib = Math.sin(t * 38) * 0.048 * rage;
        N.torsoGroup.position.y = 0.92;
        N.torsoGroup.rotation.set(-0.14 * rage + vib, 0, 0);
        N.chestGroup.rotation.set(-0.18 * rage + vib, 0, 0);
        N.head.rotation.set(-0.26 * rage, 0, 0);
        N.shoulderL.rotation.set(0, -0.25 * rage, -0.15 * rage);
        N.shoulderR.rotation.set(0, 0.25 * rage, 0.15 * rage);
        N.armL.rotation.set(-0.98 * rage + vib, 0, 0.32);
        N.armR.rotation.set(-0.98 * rage - vib, 0, -0.32);
        N.forearmL.rotation.x = -1.18 * rage;
        N.forearmR.rotation.x = -1.18 * rage;
        N.legL.rotation.x = -0.24 * rage; N.kneeL.rotation.x = 0.28 * rage;
        N.legR.rotation.x = 0.24 * rage; N.kneeR.rotation.x = 0.24 * rage;
      }
    } else if (S.cutscene > 0 && S.csKind === 'galiusIntro') {
      const t = S.csT;
      if (t < 8.0) {
        N.torsoGroup.position.y = 0.96;
        N.head.rotation.x = -0.14;
        N.armL.rotation.set(-0.30, 0, 0.24);
        N.armR.rotation.set(-0.30, 0, -0.24);
        N.forearmL.rotation.x = -0.50;
        N.forearmR.rotation.x = -0.50;
      } else {
        const ready = sm01((t - 8.0) / 0.5);
        N.torsoGroup.position.y = 0.93;
        N.torsoGroup.rotation.x = 0.10 * ready;
        N.head.rotation.x = -0.12 * ready;
        N.armL.rotation.set(-0.85 * ready, 0.25 * ready, 0.28);
        N.armR.rotation.set(-0.85 * ready, -0.25 * ready, -0.28);
        N.forearmL.rotation.x = -1.05 * ready;
        N.forearmR.rotation.x = -1.05 * ready;
        N.legL.rotation.x = -0.22 * ready; N.kneeL.rotation.x = 0.26 * ready;
        N.legR.rotation.x = 0.22 * ready; N.kneeR.rotation.x = 0.22 * ready;
      }
    } else if (S.cutscene > 0 && S.csKind === 'tomb') {
      const t = S.csT;
      if (t < 8.2) {
        const reach = t >= 6.0 ? sm01((t - 6.0) / 1.2) : 0;
        N.torsoGroup.position.y = 0.95;
        N.torsoGroup.rotation.x = 0.08 * (1 - reach);
        N.head.rotation.x = 0.14 * (1 - reach) - 0.15 * reach;
        N.armL.rotation.set(-0.20, 0, 0.18);
        N.armR.rotation.set(-0.20 - 1.15 * reach, 0, -0.18);
        N.forearmR.rotation.x = -0.35 - 0.35 * reach;
      } else {
        N.torsoGroup.position.y = 0.96;
        N.torsoGroup.rotation.x = -0.06;
        N.head.rotation.x = -0.18;
        N.armL.rotation.set(-0.25, 0, 0.20);
        N.armR.rotation.set(-1.75, 0, -0.22);
        N.forearmR.rotation.x = -0.30;
      }
    } else if (S.cutscene > 0 && S.csKind === 'maximusDeath') {
      const t = S.csT;
      if (t < 2.2) {
        const walk = Math.sin(t * 9);
        N.torsoGroup.position.y = 0.98 + Math.abs(walk) * 0.04;
        N.torsoGroup.rotation.x = 0.06;
        N.armL.rotation.set(walk * 0.45, 0, 0.14);
        N.armR.rotation.set(-walk * 0.45, 0, -0.14);
        N.legL.rotation.x = walk * 0.55;
        N.kneeL.rotation.x = Math.max(0.05, -walk * 0.45 + 0.2);
        N.legR.rotation.x = -walk * 0.55;
        N.kneeR.rotation.x = Math.max(0.05, walk * 0.45 + 0.2);
      } else if (t < 7.6) {
        N.torsoGroup.position.y = 0.94;
        N.torsoGroup.rotation.x = 0.14;
        N.head.rotation.x = 0.28;
        N.armL.rotation.set(-0.22, 0, 0.16);
        N.armR.rotation.set(-0.22, 0, -0.16);
      } else if (t < 9.2) {
        // Estende a mão, pega o rosário e aperta na mão
        const reach = sm01((t - 7.6) / 0.7);
        const sq = t >= 8.5 ? Math.sin(t * 28) * 0.03 : 0;
        N.torsoGroup.position.y = 0.92;
        N.torsoGroup.rotation.x = 0.22;
        N.head.rotation.x = 0.26;
        N.armL.rotation.set(-0.22, 0, 0.16);
        N.armR.rotation.set(-0.22 - 1.05 * reach + sq, 0, -0.16 + 0.12 * reach);
        N.forearmR.rotation.x = -0.45 * reach;
        if (N.handRosary && t >= 8.5) N.handRosary.visible = true;
      } else if (t < 10.6) {
        // Enrola o rosário no braço/pulso direito
        const wrap = sm01((t - 9.2) / 0.9);
        N.torsoGroup.position.y = 0.94;
        N.torsoGroup.rotation.x = 0.14 * (1 - wrap);
        N.head.rotation.x = 0.30;
        N.armL.rotation.set(-1.15 * wrap, -0.35 * wrap, 0.25);
        N.armR.rotation.set(-1.05, 0.25 * wrap, -0.15);
        N.forearmL.rotation.x = -0.85 * wrap;
        N.forearmR.rotation.x = -0.95;
        if (N.handRosary) N.handRosary.visible = t < 10.2;
      } else {
        // Se enche de ÓDIO / IRA! Punhos cerrados tremendo
        const rage = sm01((t - 10.6) / 0.5);
        const vib = Math.sin(t * 38) * 0.045 * rage;
        N.torsoGroup.position.y = 0.92;
        N.torsoGroup.rotation.set(-0.14 * rage + vib, 0, 0);
        N.chestGroup.rotation.set(-0.18 * rage + vib, 0, 0);
        N.head.rotation.x = -0.28 * rage;
        N.shoulderL.rotation.set(0, -0.25 * rage, -0.15 * rage);
        N.shoulderR.rotation.set(0, 0.25 * rage, 0.15 * rage);
        N.armL.rotation.set(-0.95 * rage + vib, 0, 0.32);
        N.armR.rotation.set(-0.95 * rage - vib, 0, -0.32);
        N.forearmL.rotation.x = -1.15 * rage;
        N.forearmR.rotation.x = -1.15 * rage;
        N.legL.rotation.x = -0.24 * rage; N.kneeL.rotation.x = 0.28 * rage;
        N.legR.rotation.x = 0.24 * rage; N.kneeR.rotation.x = 0.24 * rage;
      }
    } else if (S.cutscene > 0 && S.csKind === 'door') {
      const t = S.csT;
      if (t < 1.1) {
        const run = Math.sin(t * 18);
        N.torsoGroup.position.y = 0.98 + Math.abs(run) * 0.06;
        N.torsoGroup.rotation.x = 0.20;
        N.chestGroup.rotation.set(0.18, run * 0.12, 0);
        N.head.rotation.x = -0.18;
        N.armL.rotation.set(-0.9 + run * 0.6, 0, 0.22);
        N.armR.rotation.set(-0.9 - run * 0.6, 0, -0.22);
        N.forearmL.rotation.x = -0.75;
        N.forearmR.rotation.x = -0.75;
        N.legL.rotation.x = run * 0.85;
        N.kneeL.rotation.x = Math.max(0.1, -run * 0.75 + 0.35);
        N.legR.rotation.x = -run * 0.85;
        N.kneeR.rotation.x = Math.max(0.1, run * 0.75 + 0.35);
      } else if (!S.csHit) {
        // Socando com MUITA IRA (alternando esquerda e direita violentamente)
        const pt = (t - 1.1) / 0.25;
        const idx = Math.floor(pt);
        const f = pt - idx;
        const punch = Math.sin(Math.min(1, f * 1.45) * Math.PI);
        const isRight = (idx % 2 === 0);
        const twist = (isRight ? 1 : -1) * punch * 0.42;
        N.torsoGroup.position.y = 0.92;
        N.torsoGroup.rotation.set(0.16, twist, 0);
        N.chestGroup.rotation.set(0.18, twist * 0.8, 0);
        N.head.rotation.x = -0.15;
        N.shoulderR.rotation.y = isRight ? -punch * 0.45 : 0.2;
        N.shoulderL.rotation.y = !isRight ? punch * 0.45 : -0.2;
        N.armR.rotation.set(-0.85 - (isRight ? punch * 1.15 : -0.25), 0, -0.22);
        N.armL.rotation.set(-0.85 - (!isRight ? punch * 1.15 : -0.25), 0, 0.22);
        N.forearmR.rotation.x = isRight ? -0.95 + punch * 0.85 : -1.15;
        N.forearmL.rotation.x = !isRight ? -0.95 + punch * 0.85 : -1.15;
        N.legL.rotation.x = -0.35; N.kneeL.rotation.x = 0.42;
        N.legR.rotation.x = 0.28; N.kneeR.rotation.x = 0.22;
      } else {
        const post = clamp((0.65 - S.cutscene) / 0.65, 0, 1);
        N.torsoGroup.rotation.x = -0.14 * (1 - post);
        N.chestGroup.rotation.x = -0.14 * (1 - post);
        N.armL.rotation.set(-1.55 + post * 0.8, 0, 0.35);
        N.armR.rotation.set(-1.55 + post * 0.8, 0, -0.35);
        N.forearmL.rotation.x = -0.45 * (1 - post) - 0.22 * post;
        N.forearmR.rotation.x = -0.45 * (1 - post) - 0.22 * post;
        N.legL.rotation.x = -0.25 * (1 - post);
        N.kneeL.rotation.x = 0.30 * (1 - post);
        N.legR.rotation.x = 0.25 * (1 - post);
        N.kneeR.rotation.x = 0.25 * (1 - post);
      }
    } else if (S.cutscene > 0 && S.csKind === 'rip') {
      const t = S.csT;
      if (t < 0.8) {
        const u = clamp(t / 0.65, 0, 1);
        const e = u * u * (3 - 2 * u);
        N.torsoGroup.position.y = 0.98;
        N.torsoGroup.rotation.set(0.08 * e, -0.06 * e, 0);
        N.chestGroup.rotation.set(0.08 * e, -0.04 * e, 0);
        N.shoulderR.rotation.set(0, -0.35 * e, 0);
        N.armR.rotation.set(-1.92 * e, 0, -0.38 * e);
        N.forearmR.rotation.x = -0.22 - 0.06 * e;
        N.shoulderL.rotation.set(0, 0.35 * e, 0);
        N.armL.rotation.set(-1.86 * e, 0, 0.38 * e);
        N.forearmL.rotation.x = -0.22 - 0.10 * e;
        N.legL.rotation.x = -0.20 * e;
        N.kneeL.rotation.x = 0.24 * e;
        N.legR.rotation.x = 0.16 * e;
        N.kneeR.rotation.x = 0.20 * e;
      } else if (t < 2.0) {
        const p = (t - 0.8) / 1.2;
        const vib = Math.sin(t * 28) * 0.08;
        N.torsoGroup.position.y = 0.98;
        N.torsoGroup.rotation.set(0.08 - p * 0.20 + vib, -0.06, 0);
        N.chestGroup.rotation.set(0.08 - p * 0.22 + vib, -0.04, 0);
        N.shoulderR.rotation.set(0, -0.35 + 0.15 * p, 0.12 * p);
        N.armR.rotation.set(-1.92 + p * 0.28 + vib * 1.4, 0, -0.38 + p * 0.12);
        N.forearmR.rotation.x = -0.28 - 0.32 * p;
        N.shoulderL.rotation.set(0, 0.35 - 0.15 * p, -0.10 * p);
        N.armL.rotation.set(-1.86 + p * 0.26 - vib * 1.1, 0, 0.38 - p * 0.10);
        N.forearmL.rotation.x = -0.32 - 0.28 * p;
        N.legL.rotation.x = -0.20;
        N.kneeL.rotation.x = 0.24;
        N.legR.rotation.x = 0.16;
        N.kneeR.rotation.x = 0.20;
      } else if (t < 3.4) {
        const u = clamp((t - 2.0) / 0.45, 0, 1);
        const raise = u * u * (3 - 2 * u);
        N.heart.visible = true;
        const hp = heartPulse(t * 1.55);
        N.heart.scale.set(1 + hp * 0.18, 1 + hp * 0.12, 1 + hp * 0.20);
        N.torsoGroup.rotation.set(-0.12 + raise * 0.04, 0.06 * raise, 0);
        N.chestGroup.rotation.set(-0.14 + raise * 0.04, 0.08 * raise, 0);
        N.head.rotation.x = -0.22 * raise;
        N.shoulderR.rotation.set(0, -0.20 * (1 - raise), 0.18 * raise);
        N.armR.rotation.set(-1.64 - raise * 0.85, 0, -0.26 + raise * 0.11);
        N.forearmR.rotation.x = -0.60 + raise * 0.15;
        N.shoulderL.rotation.set(0, 0.20 * (1 - raise), 0);
        N.armL.rotation.set(-1.60 + raise * 1.20, 0, 0.28);
        N.forearmL.rotation.x = -0.60 + raise * 0.25;
        N.legL.rotation.x = -0.15;
        N.kneeL.rotation.x = 0.20;
        N.legR.rotation.x = 0.15;
        N.kneeR.rotation.x = 0.20;
      } else if (t < 5.8) {
        if (N.cross) N.cross.visible = true;
        const strikeDur = 0.8;
        const localT = (t - 3.4) % strikeDur;
        const p = localT / strikeDur;
        let armX, torsoX, elbowX = -0.35, armZ = -0.18;
        if (p < 0.55) {
          const u = p / 0.55;
          const e = u * u * (3 - 2 * u);
          armX = -0.75 * (1 - e) - 2.65 * e;
          torsoX = 0.12 * (1 - e) - 0.28 * e;
          elbowX = -0.25 - 0.55 * e;
        } else if (p < 0.84) {
          const u = (p - 0.55) / 0.29;
          const e = u * u;
          armX = -2.65 * (1 - e) - 0.45 * e;
          torsoX = -0.28 * (1 - e) + 0.42 * e;
          elbowX = -0.80 + 0.60 * e;
        } else {
          const u = (p - 0.84) / 0.16;
          armX = -0.45 - u * 0.25;
          torsoX = 0.42 - u * 0.25;
          elbowX = -0.20 - 0.15 * u;
        }
        N.torsoGroup.position.y = 0.92;
        N.torsoGroup.rotation.set(torsoX * 0.45, -0.05, 0);
        N.chestGroup.rotation.set(torsoX * 0.55, -0.08, 0);
        N.head.rotation.x = 0.10;
        N.armR.rotation.set(armX, 0, armZ);
        N.forearmR.rotation.x = elbowX;
        N.armL.rotation.set(-0.95, 0, 0.35);
        N.forearmL.rotation.x = -0.55;
        N.legL.rotation.x = -0.30;
        N.kneeL.rotation.x = 0.38;
        N.legR.rotation.x = 0.24;
        N.kneeR.rotation.x = 0.30;
      } else {
        // Ergue a Cruz Gigante e a espeta no topo do montinho de carne de Galius como uma vela
        if (t < 6.10) {
          const u = clamp((t - 5.8) / 0.30, 0, 1);
          const e = u * u * (3 - 2 * u);
          if (N.cross) N.cross.visible = true;
          N.torsoGroup.position.y = 0.92 + 0.04 * e;
          N.torsoGroup.rotation.set(0.12 - 0.34 * e, -0.05 * (1 - e), 0);
          N.chestGroup.rotation.set(0.14 - 0.38 * e, -0.06 * (1 - e), 0);
          N.head.rotation.set(0.10 - 0.32 * e, 0, 0);
          N.armR.rotation.set(-0.65 - 1.90 * e, 0, -0.18 + 0.06 * e);
          N.forearmR.rotation.x = -0.35 - 0.25 * e;
          N.armL.rotation.set(-0.90 - 1.35 * e, 0, 0.35 - 0.20 * e);
          N.forearmL.rotation.x = -0.50;
          N.legL.rotation.x = -0.26;
          N.kneeL.rotation.x = 0.32;
          N.legR.rotation.x = 0.20;
          N.kneeR.rotation.x = 0.26;
        } else if (t < 6.32) {
          const u = clamp((t - 6.10) / 0.22, 0, 1);
          const e = u * u;
          if (N.cross) N.cross.visible = t < 6.26;
          N.torsoGroup.position.y = 0.96 - 0.08 * e;
          N.torsoGroup.rotation.set(-0.22 + 0.50 * e, 0, 0);
          N.chestGroup.rotation.set(-0.24 + 0.56 * e, 0, 0);
          N.head.rotation.set(-0.22 + 0.36 * e, 0, 0);
          N.armR.rotation.set(-2.55 + 1.80 * e, 0, -0.12);
          N.forearmR.rotation.x = -0.60 + 0.35 * e;
          N.armL.rotation.set(-2.25 + 1.50 * e, 0, 0.15);
          N.forearmL.rotation.x = -0.50 + 0.22 * e;
          N.legL.rotation.x = -0.26 - 0.06 * e;
          N.kneeL.rotation.x = 0.32 + 0.08 * e;
          N.legR.rotation.x = 0.20 + 0.06 * e;
          N.kneeR.rotation.x = 0.26 + 0.06 * e;
        } else {
          const u = clamp((t - 6.32) / 0.78, 0, 1);
          const e = u * u * (3 - 2 * u);
          if (N.cross) N.cross.visible = false;
          N.torsoGroup.position.y = 0.88 + 0.10 * e;
          N.torsoGroup.rotation.set(0.28 * (1 - e), 0, 0);
          N.chestGroup.rotation.set(0.32 * (1 - e), 0, 0);
          N.head.rotation.set(0.14 * (1 - e), 0, 0);
          N.armR.rotation.set(-0.75 * (1 - e), 0, -0.12);
          N.forearmR.rotation.x = -0.25 + 0.03 * e;
          N.armL.rotation.set(-0.75 * (1 - e), 0, 0.15 - 0.03 * e);
          N.forearmL.rotation.x = -0.28 + 0.06 * e;
          N.legL.rotation.x = -0.32 * (1 - e);
          N.kneeL.rotation.x = 0.40 * (1 - e);
          N.legR.rotation.x = 0.26 * (1 - e);
          N.kneeR.rotation.x = 0.32 * (1 - e);
        }
      }
    } else if (TP_CAM.userMode) {
      const hs = Math.hypot(P.vel.x, P.vel.z);
      const moveAmt = clamp(hs / 10.5, 0, 1.2);
      const w = WEAPONS[curW()];
      const wid = w ? w.id : 'fists';
      const sw = P.swingT > 0;
      const a = sw ? clamp(1 - P.swingT / (P.swingDur || 0.3), 0, 1) : 0;
      const s = Math.sin(a * Math.PI);
      const holding = !!(P.grabbed && !P.grabbed.dead);

      N.head.rotation.x = clamp(-P.pitch * 0.35, -0.4, 0.4);
      if (!P.onGround) {
        N.legL.rotation.x = -0.25;
        if (N.kneeL) N.kneeL.rotation.x = 0.42;
        N.legR.rotation.x = 0.18;
        if (N.kneeR) N.kneeR.rotation.x = 0.30;
        N.torsoGroup.rotation.x = P.slamming ? 0.25 : 0.08;
      } else {
        const stride = Math.sin(P.bob) * 0.65 * moveAmt;
        const kneeL = Math.max(0, -Math.cos(P.bob)) * 0.65 * moveAmt;
        const kneeR = Math.max(0, Math.cos(P.bob)) * 0.65 * moveAmt;
        N.legL.rotation.x = stride;
        if (N.kneeL) N.kneeL.rotation.x = kneeL;
        N.legR.rotation.x = -stride;
        if (N.kneeR) N.kneeR.rotation.x = kneeR;
        N.torsoGroup.position.y = 0.98 + Math.abs(Math.sin(P.bob)) * 0.04 * moveAmt;
        N.torsoGroup.rotation.y = Math.sin(P.bob) * 0.06 * moveAmt;
        N.torsoGroup.rotation.x = 0.08 * moveAmt;
      }
      if (P.kickT > 0) {
        const kp = Math.sin(clamp(1 - P.kickT / 0.35, 0, 1) * Math.PI);
        N.legR.rotation.x = -1.35 * kp;
        if (N.kneeR) N.kneeR.rotation.x = 0.25 * kp;
      }
      const breath = moveAmt < 0.05 ? Math.sin(performance.now() * 0.0025) * 0.03 : 0;
      if (N.chestGroup) N.chestGroup.rotation.x = breath;
      const walkSwing = Math.sin(P.bob) * 0.18 * moveAmt;

      switch (wid) {
        case 'fists': {
          // Guarda de boxeador com os dois punhos erguidos
          N.armL.rotation.set(-0.92 - walkSwing, 0.18, 0.22);
          if (N.forearmL) N.forearmL.rotation.x = -1.32;
          N.armR.rotation.set(-0.98 + walkSwing, -0.18, -0.22);
          if (N.forearmR) N.forearmR.rotation.x = -1.32;
          if (sw) {
            const isL = holding || P.hand === 0;
            const arm = isL ? N.armL : N.armR;
            const fore = isL ? N.forearmL : N.forearmR;
            const sh = isL ? N.shoulderL : N.shoulderR;
            const side = isL ? -1 : 1;
            if (P.fistUpper) {
              const u = swing3(a, 0.26, 0.56, 0.25, -1.65);
              N.torsoGroup.rotation.y += swing3(a, 0.26, 0.56, side * 0.22, -side * 0.35);
              N.torsoGroup.rotation.x += swing3(a, 0.26, 0.56, 0.14, -0.12);
              arm.rotation.set(u, -side * 0.15, -side * 0.12);
              if (fore) fore.rotation.x = swing3(a, 0.26, 0.56, -1.4, -0.85);
            } else if (P.swingStep >= 2) {
              N.torsoGroup.rotation.y += swing3(a, 0.18, 0.52, side * 0.25, -side * 0.40);
              arm.rotation.set(-1.25, swing3(a, 0.18, 0.52, side * 0.45, -side * 0.65), -side * 0.35);
              if (fore) fore.rotation.x = -0.95;
            } else {
              N.torsoGroup.rotation.y += -side * s * 0.25;
              if (sh) sh.rotation.y = -side * s * 0.22;
              arm.rotation.set(-0.98 - s * 0.62, -side * 0.12, -side * 0.08);
              if (fore) fore.rotation.x = -1.32 + s * 1.18;
            }
          }
          break;
        }
        case 'hammer': {
          N.hammer.visible = true;
          N.armR.rotation.set(-0.48 - walkSwing, -0.15, -0.24);
          if (N.forearmR) N.forearmR.rotation.x = -0.75;
          N.armL.rotation.set(-0.82 + walkSwing, 0.12, 0.18);
          if (N.forearmL) N.forearmL.rotation.x = -0.85;
          if (sw) {
            N.torsoGroup.rotation.y += swing3(a, 0.24, 0.56, -0.42, 0.58);
            N.chestGroup.rotation.y += swing3(a, 0.24, 0.56, -0.32, 0.45);
            N.torsoGroup.rotation.x += swing3(a, 0.24, 0.56, -0.14, 0.22);
            N.armL.rotation.set(
              swing3(a, 0.24, 0.56, -2.05, -0.75),
              swing3(a, 0.24, 0.56, -0.55, 0.95),
              swing3(a, 0.24, 0.56, 0.35, -0.45)
            );
            if (N.forearmL) N.forearmL.rotation.x = swing3(a, 0.24, 0.56, -1.05, -0.25);
          }
          break;
        }
        case 'sling': {
          if (N.sling) N.sling.visible = true;
          const pull = sw ? slingPullCurve(a) : 0;
          const showRock = P.rocks > 0 && (!sw || a < 0.45 || a > 0.78);
          N.armL.rotation.set(-1.38 + walkSwing * 0.4, 0.08, 0.10);
          if (N.forearmL) N.forearmL.rotation.x = -0.24;
          N.armR.rotation.set(-1.22 - walkSwing * 0.4, -0.48, -0.28);
          if (N.forearmR) N.forearmR.rotation.x = -0.88;
          if (sw) {
            N.torsoGroup.rotation.y += pull * 0.14;
            N.armR.rotation.set(-1.22 + pull * 0.48, -0.48 + pull * 0.22, -0.28 + pull * 0.12);
            if (N.forearmR) N.forearmR.rotation.x = -0.88 - pull * 0.55;
            N.armL.rotation.x = -1.38 + Math.max(0, -pull) * 0.18;
          }
          animateSlingParts(N.sling, pull, showRock);
          break;
        }
        case 'scythe': {
          if (N.scythe) {
            N.scythe.visible = true;
            N.scythe.rotation.set(1.95, -0.70, -0.50);
          }
          // Braços angulados para frente e para dentro em direção ao centro do corpo (empunhadura a duas mãos)
          if (N.shoulderL) { N.shoulderL.position.set(-0.54, 0.36, 0.06); N.shoulderL.rotation.y = 0.32; }
          if (N.shoulderR) { N.shoulderR.position.set(0.54, 0.36, 0.06); N.shoulderR.rotation.y = -0.32; }
          N.armL.rotation.set(-0.52 + walkSwing * 0.35, 0.42, 0.44);
          if (N.forearmL) N.forearmL.rotation.x = -0.78;
          N.armR.rotation.set(-0.78 - walkSwing * 0.35, -0.42, -0.42);
          if (N.forearmR) N.forearmR.rotation.x = -0.92;
          if (sw) {
            if ((P.swingStep || 0) === 0) {
              // Corte horizontal direita -> esquerda com as duas mãos no cabo
              const ty = swing3(a, 0.25, 0.58, -0.52, 0.68);
              N.torsoGroup.rotation.y += ty;
              N.chestGroup.rotation.y += ty * 0.65;
              N.armL.rotation.set(-0.62, swing3(a, 0.25, 0.58, -0.05, 0.85), 0.40);
              N.armR.rotation.set(-0.78, swing3(a, 0.25, 0.58, -0.75, 0.15), -0.38);
              if (N.forearmL) N.forearmL.rotation.x = -0.72;
              if (N.forearmR) N.forearmR.rotation.x = -0.82;
            } else {
              // Corte de cima para baixo igual martelo pesado (cabo para frente e lâmina apontando para frente/baixo)
              if (N.scythe) N.scythe.rotation.set(Math.PI * 0.5, -1.95, 0);
              if (N.shoulderL) { N.shoulderL.position.set(-0.50, 0.36, 0.10); N.shoulderL.rotation.y = 0.28; }
              if (N.shoulderR) { N.shoulderR.position.set(0.50, 0.36, 0.10); N.shoulderR.rotation.y = -0.28; }
              const tx = swing3(a, 0.28, 0.58, -0.24, 0.40);
              N.torsoGroup.rotation.x += tx;
              N.armL.rotation.set(swing3(a, 0.28, 0.58, -2.42, -0.42), 0.35, 0.38);
              N.armR.rotation.set(swing3(a, 0.28, 0.58, -2.35, -0.48), -0.35, -0.38);
              if (N.forearmL) N.forearmL.rotation.x = swing3(a, 0.28, 0.58, -0.80, -0.30);
              if (N.forearmR) N.forearmR.rotation.x = swing3(a, 0.28, 0.58, -0.85, -0.32);
            }
          }
          snapLeftHandToShaft(N, N.scythe, 0.32);
          break;
        }
        case 'demo': {
          if (N.demo) {
            N.demo.visible = true;
            N.demo.rotation.set(1.95, -0.70, -0.50);
          }
          // Braços angulados para frente e para dentro em direção ao centro do corpo (empunhadura a duas mãos)
          if (N.shoulderL) { N.shoulderL.position.set(-0.54, 0.36, 0.06); N.shoulderL.rotation.y = 0.32; }
          if (N.shoulderR) { N.shoulderR.position.set(0.54, 0.36, 0.06); N.shoulderR.rotation.y = -0.32; }
          N.armL.rotation.set(-0.52 + walkSwing * 0.35, 0.42, 0.44);
          if (N.forearmL) N.forearmL.rotation.x = -0.78;
          N.armR.rotation.set(-0.78 - walkSwing * 0.35, -0.42, -0.42);
          if (N.forearmR) N.forearmR.rotation.x = -0.92;
          if (sw) {
            const st = P.swingStep || 0;
            if (st === 0) {
              const ty = swing3(a, 0.30, 0.60, -0.55, 0.70);
              N.torsoGroup.rotation.y += ty;
              N.chestGroup.rotation.y += ty * 0.65;
              N.armL.rotation.set(-0.62, swing3(a, 0.30, 0.60, -0.05, 0.85), 0.40);
              N.armR.rotation.set(-0.78, swing3(a, 0.30, 0.60, -0.75, 0.15), -0.38);
              if (N.forearmL) N.forearmL.rotation.x = -0.72;
              if (N.forearmR) N.forearmR.rotation.x = -0.82;
            } else if (st === 1) {
              const ty = swing3(a, 0.30, 0.60, 0.65, -0.58);
              N.torsoGroup.rotation.y += ty;
              N.chestGroup.rotation.y += ty * 0.65;
              N.armL.rotation.set(-0.62, swing3(a, 0.30, 0.60, 0.75, -0.15), 0.40);
              N.armR.rotation.set(-0.78, swing3(a, 0.30, 0.60, 0.15, -0.75), -0.38);
              if (N.forearmL) N.forearmL.rotation.x = -0.72;
              if (N.forearmR) N.forearmR.rotation.x = -0.82;
            } else {
              if (N.demo) N.demo.rotation.set(Math.PI * 0.5, 0.14, 0);
              if (N.shoulderL) { N.shoulderL.position.set(-0.50, 0.36, 0.10); N.shoulderL.rotation.y = 0.28; }
              if (N.shoulderR) { N.shoulderR.position.set(0.50, 0.36, 0.10); N.shoulderR.rotation.y = -0.28; }
              N.torsoGroup.rotation.x += swing3(a, 0.34, 0.62, -0.26, 0.42);
              N.chestGroup.rotation.x += swing3(a, 0.34, 0.62, -0.20, 0.30);
              N.armL.rotation.set(swing3(a, 0.34, 0.62, -2.50, -0.40), 0.35, 0.38);
              N.armR.rotation.set(swing3(a, 0.34, 0.62, -2.42, -0.45), -0.35, -0.38);
              if (N.forearmL) N.forearmL.rotation.x = swing3(a, 0.34, 0.62, -0.80, -0.30);
              if (N.forearmR) N.forearmR.rotation.x = swing3(a, 0.34, 0.62, -0.85, -0.32);
            }
          }
          snapLeftHandToShaft(N, N.demo, 0.32);
          break;
        }
        case 'cross': {
          // S.cross.hand === 1: lado direito da tela (N.armL); === 0: lado esquerdo da tela (N.armR)
          const useL = S.cross.hand === 1;
          const held = S.cross.state === 'held';
          if (held) {
            if (useL && N.papalCrossL) N.papalCrossL.visible = true;
            if (!useL && N.papalCross) N.papalCross.visible = true;
          }
          const activeArm = useL ? N.armL : N.armR;
          const activeFore = useL ? N.forearmL : N.forearmR;
          const otherArm = useL ? N.armR : N.armL;
          const otherFore = useL ? N.forearmR : N.forearmL;
          const aSide = useL ? 1 : -1;
          const catchRecoil = P.crossCatchT > 0 ? Math.sin((P.crossCatchT / 0.16) * Math.PI) : 0;

          if (held) {
            activeArm.rotation.set(-1.05 + walkSwing * 0.5 + catchRecoil * 0.32, 0, aSide * 0.12);
            if (activeFore) activeFore.rotation.x = -0.65 - catchRecoil * 0.35;
            otherArm.rotation.set(-0.35 - walkSwing, -aSide * 0.10, -aSide * 0.20);
            if (otherFore) otherFore.rotation.x = -0.45;
          } else {
            // Cruz no ar: mão receptora (otherArm) se estende para aparar
            activeArm.rotation.set(-0.55 + walkSwing * 0.4, 0, aSide * 0.18);
            if (activeFore) activeFore.rotation.x = -0.40;
            otherArm.rotation.set(-1.18 - walkSwing * 0.3, -aSide * 0.18, -aSide * 0.12);
            if (otherFore) otherFore.rotation.x = -0.55;
          }
          if (sw) {
            N.torsoGroup.rotation.y += aSide * s * 0.28;
            activeArm.rotation.x = -1.05 - s * 0.65;
            if (activeFore) activeFore.rotation.x = -0.65 + s * 0.55;
          }
          break;
        }
        case 'heart': {
          N.heart.visible = true;
          N.heart.position.set(-0.18, -0.14, 0.16);
          const idleBeat = heartPulse(S.time * 1.35);
          const squeeze = sw ? s * 0.82 : 0;
          const hsx = (1 + idleBeat * 0.13) * (1 - squeeze * 0.24);
          const hsy = (1 + idleBeat * 0.08) * (1 + squeeze * 0.16);
          const hsz = (1 + idleBeat * 0.15) * (1 + squeeze * 0.10);
          N.heart.scale.set(hsx, hsy, hsz);
          N.armR.rotation.set(-1.02, -0.35, -0.34 - squeeze * 0.12);
          if (N.forearmR) N.forearmR.rotation.x = -0.95;
          N.armL.rotation.set(-1.02, 0.35, 0.34 + squeeze * 0.12);
          if (N.forearmL) N.forearmL.rotation.x = -0.95;
          break;
        }
      }
      if (holding) {
        if (N.shoulderR) {
          N.shoulderR.position.set(0.62, 0.36, 0);
          N.shoulderR.rotation.set(0, 0, 0);
        }
        N.armR.rotation.set(-Math.PI * 0.5, 0, 0);
        if (N.forearmR) N.forearmR.rotation.set(0, 0, 0);
        if (N.handR) N.handR.rotation.set(0, 0, 0);
      }
    } else if (P.grabbed && !P.grabbed.dead) {
      if (N.shoulderR) {
        N.shoulderR.position.set(0.62, 0.36, 0);
        N.shoulderR.rotation.set(0, 0, 0);
      }
      N.armR.rotation.set(-Math.PI * 0.5, 0, 0);
      if (N.forearmR) N.forearmR.rotation.set(0, 0, 0);
      if (N.handR) N.handR.rotation.set(0, 0, 0);
    }
  }

  /* ---------------- util ---------------- */
  const ELS = {};
  function el(id) { return ELS[id] || (ELS[id] = $(id)); }
  function setText(id, v) { const e = el(id); if (e && e.__v !== v) { e.__v = v; e.textContent = v; } }
  function setW(id, pct) { const e = el(id); const v = Math.round(pct * 10) / 10; if (e && e.__w !== v) { e.__w = v; e.style.width = v + '%'; } }
  function show(id, on) { const e = el(id); if (e) e.classList.toggle('hidden', !on); }
  const _fwd3Scratch = new V3();
  const _eyePosScratch = new V3();
  function fwd3() {
    const cp = Math.cos(P.pitch);
    return _fwd3Scratch.set(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp);
  }
  function eyePos() { return _eyePosScratch.set(P.pos.x, P.pos.y + P.eye, P.pos.z); }
  const _aimOrigin = new V3(), _aimDir = new V3(), _aimPt = new V3(), _projAimPt = new V3();
  function getAimRay(outOrigin, outDir) {
    if (TP_CAM.userMode && TP_CAM.active) {
      outOrigin.copy(camera.position);
      outDir.copy(TP_CAM.target).sub(camera.position);
      if (outDir.lengthSq() > 1e-8) outDir.normalize();
      else outDir.copy(fwd3());
    } else {
      outOrigin.copy(eyePos());
      outDir.copy(fwd3());
    }
  }
  function getAimDir(outDir) {
    const tgt = outDir || _aimDir;
    if (TP_CAM.userMode && TP_CAM.active) {
      tgt.copy(TP_CAM.target).sub(camera.position);
      if (tgt.lengthSq() > 1e-8) return tgt.normalize();
    }
    return tgt.copy(fwd3());
  }
  function getCrosshairAimPoint(maxDist, outPt) {
    const distLim = maxDist || 90;
    const tgt = outPt || _aimPt;
    getAimRay(_aimOrigin, _aimDir);
    let bestD = distLim;
    let hitFound = false;

    for (const e of enemies) {
      if (!e || e.dead || e.downed || !e.inRender) continue;
      const hit = findHitPartRay(e, _aimOrigin, _aimDir, 0.08, { strict: true, headBias: 0, returnInfo: true });
      if (!hit || hit.dist >= bestD) continue;
      if (TP_CAM.userMode && TP_CAM.active) {
        const fwdDot = (hit.point.x - P.pos.x) * _aimDir.x + (hit.point.y - (P.pos.y + 1.1)) * _aimDir.y + (hit.point.z - P.pos.z) * _aimDir.z;
        if (fwdDot < 0.2) continue;
      }
      bestD = hit.dist;
      tgt.copy(hit.point);
      hitFound = true;
    }

    for (const p of peasants) {
      if (!p || p.dead || !p.inRender) continue;
      const hit = rayHitPeasant(p, _aimOrigin, _aimDir, bestD, true);
      if (!hit || hit.dist >= bestD) continue;
      if (TP_CAM.userMode && TP_CAM.active) {
        const fwdDot = (hit.point.x - P.pos.x) * _aimDir.x + (hit.point.y - (P.pos.y + 1.0)) * _aimDir.y + (hit.point.z - P.pos.z) * _aimDir.z;
        if (fwdDot < 0.2) continue;
      }
      bestD = hit.dist;
      tgt.copy(hit.point);
      hitFound = true;
    }

    const startT = (TP_CAM.userMode && TP_CAM.active)
      ? Math.max(0.5, _aimOrigin.distanceTo(eyePos()) + 0.35)
      : 0.5;
    const step = 0.65;
    let prevT = startT;
    for (let t = startT; t <= bestD; t += step) {
      const rx = _aimOrigin.x + _aimDir.x * t;
      const ry = _aimOrigin.y + _aimDir.y * t;
      const rz = _aimOrigin.z + _aimDir.z * t;
      const gy = A.groundAt(rx, rz, ry, 0.2);
      if (ry <= gy + 0.08 || A.pointInWall(rx, rz)) {
        let lo = prevT, hi = t;
        for (let k = 0; k < 4; k++) {
          const mid = (lo + hi) * 0.5;
          const mx = _aimOrigin.x + _aimDir.x * mid;
          const my = _aimOrigin.y + _aimDir.y * mid;
          const mz = _aimOrigin.z + _aimDir.z * mid;
          if (my <= A.groundAt(mx, mz, my, 0.2) + 0.08 || A.pointInWall(mx, mz)) hi = mid;
          else lo = mid;
        }
        bestD = hi;
        tgt.copy(_aimOrigin).addScaledVector(_aimDir, bestD);
        hitFound = true;
        break;
      }
      prevT = t;
    }

    if (!hitFound) {
      tgt.copy(_aimOrigin).addScaledVector(_aimDir, distLim);
    }
    return tgt;
  }
  function getProjectileSpawn(weaponId, outOrigin, outDir, crossHand) {
    if (TP_CAM.userMode && TP_CAM.active) {
      updateNivaldo3P();
      NIVALDO_3P.root.updateMatrixWorld(true);
      const N = NIVALDO_3P;
      let node = null;
      if (weaponId === 'sling') node = (N.sling && N.sling.pouch) || N.sling || N.handL;
      else if (weaponId === 'hammer') node = N.handL;
      else if (weaponId === 'cross') node = crossHand === 1 ? (N.papalCrossL || N.handL) : (N.papalCross || N.handR);
      else if (weaponId === 'heart') node = N.heart || N.handR;
      else node = N.handL;

      if (node) {
        node.getWorldPosition(outOrigin);
      } else {
        outOrigin.set(P.pos.x, P.pos.y + 1.35, P.pos.z);
      }
      if (A.pointInWall(outOrigin.x, outOrigin.z)) {
        outOrigin.x = P.pos.x;
        outOrigin.z = P.pos.z;
      }

      getAimRay(_aimOrigin, _aimDir);
      getCrosshairAimPoint(90, _projAimPt);
      outDir.copy(_projAimPt).sub(outOrigin);
      if (outDir.lengthSq() < 1e-6 || outDir.dot(_aimDir) < 0.2) {
        outDir.copy(_aimDir);
      } else {
        outDir.normalize();
      }
      return;
    }

    outDir.copy(fwd3());
    outOrigin.copy(eyePos()).addScaledVector(outDir, weaponId === 'cross' ? 1.2 : 0.85);
    outOrigin.y -= 0.15;
  }
  function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

  /* ---------------- mensagens ---------------- */
  const MSG_COLORS = {
    'NIVALDO': '#ffd24a',
    'SÉRGIO MAXIMO': '#ff4545',
    'BAPHOMET': '#d946ef',
    'RÔMULO III': '#66e0ff',
    'SUPER-ANJO': '#93c5fd',
    'GALIUS': '#ff6622'
  };
  function say(text, who, dur) {
    if (!MSG_COLORS[who]) return;
    const whoEl = el('msgWho');
    whoEl.textContent = who + ':';
    whoEl.style.color = MSG_COLORS[who];
    el('msgText').textContent = text;
    show('msg', true);
    S.msgT = dur || 3;
  }
  function baph(text, dur) {
    SFX.play('roar');
    if (text) say(text, 'BAPHOMET', dur || 4);
  }
  const QUIPS = ['O alicerce do inferno tá fofo.', 'Amém… e AMASSOU.', 'Isso aqui é obra de Deus!', 'Vou rebocar essa tua cara!', 'Desceu pelo ralo, capeta.', 'Super-Fé na marreta!', 'Cimento e oração!', 'Me aguarda, Testus.', 'Hoje o inferno ganha uma reforma.', 'Trabalho bem feito.'];
  function quip() {
    if (!SAVE.quips || S.quipCd > 0 || Math.random() > 0.2) return;
    S.quipCd = 12;
    say(QUIPS[Math.floor(Math.random() * QUIPS.length)], 'NIVALDO', 2.2);
  }
  function setObj(text, pos) { S.objText = text; S.objPos = pos || null; }
  function later(sec, fn) { S.tl.push({ t: sec, fn }); }
  S.tl = []; S.objPos = null; S.fade = null; S.hasCross = false; S.hasHeart = false; S.rooms = {};
  function fade(color, inDur, cb, outDur) {
    el('flash').style.background = color;
    S.fade = { t: 0, inD: inDur, outD: outDur || inDur, cb, phase: 0 };
  }

  /* ---------------- pickups ---------------- */
  const pickups = [];
  function mkPickupMesh(k, id) {
    const g = new THREE.Group();
    if (k === 'host') {
      // Potinho de água benta
      part(g, 0.38, 0.44, 0.38, 0xc8f0ff, 0, -0.02, 0, { basic: true, tr: 0.42 });
      part(g, 0.28, 0.30, 0.28, 0x6ad8ff, 0, -0.06, 0, { basic: true });
      part(g, 0.16, 0.16, 0.16, 0xc8f0ff, 0, 0.26, 0, { basic: true, tr: 0.55 });
      part(g, 0.14, 0.11, 0.14, 0x8b5a2b, 0, 0.37, 0);
      part(g, 0.06, 0.22, 0.42, 0xffdf70, 0, -0.02, 0, { basic: true });
      part(g, 0.18, 0.06, 0.42, 0xffdf70, 0, 0.02, 0, { basic: true });
    } else if (k === 'rocks') {
      part(g, 0.3, 0.3, 0.3, 0x8a8a90, -0.2, 0, 0); part(g, 0.28, 0.28, 0.28, 0x7a7a80, 0.18, 0, 0.1); part(g, 0.24, 0.24, 0.24, 0x9a9aa0, 0, 0.2, -0.1);
    } else if (k === 'vial') {
      part(g, 0.3, 0.42, 0.3, 0xcc1020, 0, 0, 0, { basic: true }); part(g, 0.14, 0.2, 0.14, 0x401010, 0, 0.3, 0);
    } else if (k === 'weapon') {
      const s = new THREE.Group();
      if (id === 'sling') {
        part(s, 0.12, 0.7, 0.12, 0x6a4420, 0, 0, 0);
        part(s, 0.16, 0.1, 0.14, 0x523418, 0, 0.35, 0);
        const a = part(s, 0.1, 0.55, 0.1, 0x6a4420, -0.112, 0.601, 0); a.rotation.z = 0.42;
        const b = part(s, 0.1, 0.55, 0.1, 0x6a4420, 0.112, 0.601, 0); b.rotation.z = -0.42;
        part(s, 0.45, 0.03, 0.03, 0xaa5030, 0, 0.83, 0);
      } else if (id === 'scythe') {
        part(s, 0.1, 2.0, 0.1, 0x6a4420, 0, 0, 0);
        part(s, 0.14, 0.16, 0.14, 0x45484e, 0, 0.98, 0);
        let bx = -0.02, by = 1.0;
        [{ l: 0.42, h: 0.15, a: -0.15 }, { l: 0.40, h: 0.13, a: 0.2 }, { l: 0.36, h: 0.10, a: 0.6 }, { l: 0.28, h: 0.06, a: 1.0 }].forEach((seg) => {
          const dx = Math.cos(seg.a), dy = Math.sin(seg.a), step = seg.l - 0.05;
          const m = part(s, seg.l, seg.h, 0.05, 0xc4c8d0, bx - dx * (seg.l * 0.5 - 0.02), by - dy * (seg.l * 0.5 - 0.02), 0);
          m.rotation.z = seg.a;
          bx -= dx * step; by -= dy * step;
        });
      } else {
        part(s, 0.14, 2.0, 0.14, 0x5a3a1c, 0, 0, 0);
        part(s, 0.20, 0.12, 0.20, 0x2a2a30, 0, 0.60, 0);
        part(s, 0.86, 0.56, 0.56, 0x4a4a52, 0, 0.90, 0);
        part(s, 0.90, 0.10, 0.60, 0x2a2a30, 0, 1.20, 0);
        part(s, 0.90, 0.10, 0.60, 0x2a2a30, 0, 0.60, 0);
        part(s, 0.08, 0.46, 0.46, 0x666872, -0.45, 0.90, 0);
        part(s, 0.08, 0.46, 0.46, 0x666872, 0.45, 0.90, 0);
      }
      s.scale.setScalar(1.3); g.add(s);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 12, 8, 1, true), MT(0xffd24a, { basic: true, tr: 0.2, add: true, dbl: true }));
      beam.position.y = 5; g.add(beam);
    }
    return g;
  }
  function spawnPickup(k, x, z, id, y) {
    const g = mkPickupMesh(k, id);
    const y0 = getGroundY(x, z) + (y != null ? y : 0.9);
    g.position.set(x, y0, z);
    const inRender = World.isPosInRender(x, z);
    g.visible = inRender;
    scene.add(g);
    pickups.push({ k, id, g, x, z, y0, savedPos: new V3(x, y0, z), inRender, t: Math.random() * 6, life: k === 'weapon' ? 1e9 : 40 });
  }
  function clearPickups() {
    while (pickups.length) {
      const p = pickups.pop();
      scene.remove(p.g);
    }
  }
  function spawnMapPickups(mapId) {
    clearPickups();
    const list = PICKUPS[mapId] || [];
    for (const p of list) spawnPickup(p.k, p.x, p.z, p.id, p.y);
  }
  function healPlayer(amt, flashStrength = 0.65) {
    const prev = P.hp;
    P.hp = Math.min(P.maxhp, P.hp + amt);
    if (P.hp > prev && flashStrength > 0) {
      P.healFlash = Math.min(1, Math.max(P.healFlash || 0, flashStrength));
    }
    return P.hp - prev;
  }
  function collect(p) {
    if (p.k === 'host') { if (P.hp >= P.maxhp) return false; healPlayer(30, 0.72); SFX.play('pickup'); return true; }
    if (p.k === 'rocks') { if (P.rocks >= AMMO_MAX.rocks) return false; P.rocks = Math.min(AMMO_MAX.rocks, P.rocks + 10); SFX.play('pickup'); return true; }
    if (p.k === 'vial') { if (P.blood >= AMMO_MAX.blood) return false; P.blood = Math.min(AMMO_MAX.blood, P.blood + 25); SFX.play('pickup'); return true; }
    if (p.k === 'weapon') {
      const idx = WEAPONS.findIndex(w => w.id === p.id);
      WEAPONS[idx].owned = true;
      if (p.id === 'sling') P.rocks = Math.max(P.rocks, 25);
      SFX.play('weapon');
      selectWeapon(idx, true);
      const msg = { sling: 'ESTILINGUE encontrado! Pedras são munição. [3]', scythe: 'FOICE encontrada! Acerta vários inimigos. [4]', demo: 'MARTELO DE DEMOLIÇÃO! Duas mãos, dano em área. [5]' }[p.id];
      say(msg, '', 4);
      updateSlots();
      return true;
    }
    return false;
  }
  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      const inR = World.isPosInRender(p.x, p.z);
      if (!inR) {
        if (p.inRender) {
          p.savedPos.copy(p.g.position);
          p.g.visible = false;
          p.inRender = false;
        }
        continue;
      }
      if (!p.inRender) {
        p.g.position.copy(p.savedPos);
        p.g.visible = true;
        p.inRender = true;
      }
      p.t += dt; p.life -= dt;
      p.g.rotation.y += dt * 2;
      p.g.position.y = p.y0 + Math.sin(p.t * 3) * 0.15;
      p.savedPos.copy(p.g.position);
      if (p.life <= 0) { scene.remove(p.g); pickups.splice(i, 1); continue; }
      if (P.dead) continue;
      const r = p.k === 'weapon' ? 2.6 : 1.8;
      if (Math.abs(P.pos.x - p.x) < r && Math.abs(P.pos.z - p.z) < r && dist2(P.pos.x, P.pos.z, p.x, p.z) < r && Math.abs(P.pos.y + 1 - p.y0) < 4) {
        if (collect(p)) { scene.remove(p.g); pickups.splice(i, 1); }
      }
    }
  }

  /* ---------------- armas ---------------- */
  function selectWeapon(i, force) {
    const w = WEAPONS[i];
    if (!w || !w.owned || (i === curW() && !force)) return;
    if (P.dead || (S.cutscene > 0 && !force)) return;
    A.setCurW(i); P.swapT = 1; P.swingT = 0; P.pending = null;
    updateSlots();
  }
  function startSwing(w) { P.swingDur = w.dur; P.swingT = w.dur; }

  function rayHitPeasant(p, eye, f, maxReach, skipLos) {
    const px = p.g.position.x, py = p.g.position.y, pz = p.g.position.z;
    const cx = px - eye.x, cy = (py + p.h * 0.5) - eye.y, cz = pz - eye.z;
    const t = clamp(cx * f.x + cy * f.y + cz * f.z, 0, maxReach);
    const hx = eye.x + f.x * t, hy = eye.y + f.y * t, hz = eye.z + f.z * t;
    if (hy < py - 0.15 || hy > py + p.h + 0.25) return null;
    if (Math.hypot(hx - px, hz - pz) > p.r + 0.28) return null;
    if (!skipLos && !A.los(eye.x, eye.z, hx, hz) && t > 1.2) return null;
    return { dist: t, point: new V3(hx, hy, hz) };
  }

  function meleeAttack(w, silent) {
    const eye = eyePos();
    const rayOrigin = new V3(), rayDir = new V3();
    getAimRay(rayOrigin, rayDir);
    const tp = TP_CAM.userMode && TP_CAM.active;
    const f = rayDir;
    const cand = [];
    if (w.sweep) {
      // Arma grande de varredura (ex: Foice): acerta todos no arco amplo
      for (const e of enemies) {
        if (e.dead || e.downed || !e.inRender) continue;
        const c = new V3(e.g.position.x, e.g.position.y + e.h * 0.5, e.g.position.z);
        const v = c.clone().sub(eye);
        const d = v.length();
        if (Math.hypot(v.x, v.z) - e.r * 0.85 > w.range) continue;
        const vl = Math.hypot(v.x, v.z) || 1, fl = Math.hypot(f.x, f.z) || 1;
        const dot = (v.x * f.x + v.z * f.z) / (vl * fl);
        const cosEff = vl < e.r + 1.8 ? -1 : w.cos - e.r * 0.08;
        if (dot < cosEff) continue;
        if (Math.abs(c.y - eye.y) > e.h * 0.5 + 2.2) continue;
        if (!A.los(eye.x, eye.z, c.x, c.z) && d > e.r + 1.2) continue;
        const hit = findHitPartRay(e, rayOrigin, rayDir, 0.22, { returnInfo: true });
        cand.push({ e, d, v, part: hit.part, hitPos: hit.point });
      }
      for (const p of peasants) {
        if (p.dead || !p.inRender) continue;
        const c = new V3(p.g.position.x, p.g.position.y + p.h * 0.5, p.g.position.z);
        const v = c.clone().sub(eye);
        const d = v.length();
        if (Math.hypot(v.x, v.z) - p.r * 0.85 > w.range) continue;
        const vl = Math.hypot(v.x, v.z) || 1, fl = Math.hypot(f.x, f.z) || 1;
        const dot = (v.x * f.x + v.z * f.z) / (vl * fl);
        const cosEff = vl < p.r + 1.8 ? -1 : w.cos - p.r * 0.08;
        if (dot < cosEff) continue;
        if (Math.abs(c.y - eye.y) > p.h * 0.5 + 2.2) continue;
        if (!A.los(eye.x, eye.z, c.x, c.z) && d > p.r + 1.2) continue;
        cand.push({ peasant: p, d, v, hitPos: c });
      }
      cand.sort((a, b) => a.d - b.d);
    } else {
      // Golpe preciso (punhos, martelo, cruz): só acerta o membro/área sob a mira
      const pad = w.id === 'fists' ? 0.04 : 0.08;
      const maxReach = w.range + 0.2;
      const camReach = tp ? rayOrigin.distanceTo(eye) + maxReach + 2.5 : maxReach;
      for (const e of enemies) {
        if (e.dead || e.downed || !e.inRender) continue;
        const c = new V3(e.g.position.x, e.g.position.y + e.h * 0.5, e.g.position.z);
        const v = c.clone().sub(eye);
        if (v.length() > maxReach + e.r * 2 + e.h * 0.5 + 1.5) continue;
        const hit = findHitPartRay(e, rayOrigin, rayDir, pad, { strict: true, headBias: 0, returnInfo: true });
        if (!hit || hit.dist > camReach) continue;
        if (tp) {
          const fwdDot = (hit.point.x - P.pos.x) * rayDir.x + (hit.point.y - (P.pos.y + 1.1)) * rayDir.y + (hit.point.z - P.pos.z) * rayDir.z;
          if (fwdDot < -0.35) continue;
        }
        const playerDist = eye.distanceTo(hit.point);
        if (playerDist > maxReach) continue;
        if (!A.los(eye.x, eye.z, hit.point.x, hit.point.z) && playerDist > 1.2) continue;
        cand.push({ e, d: playerDist, v, part: hit.part, hitPos: hit.point });
      }
      for (const p of peasants) {
        if (p.dead || !p.inRender) continue;
        const c = new V3(p.g.position.x, p.g.position.y + p.h * 0.5, p.g.position.z);
        const v = c.clone().sub(eye);
        if (v.length() > maxReach + p.r * 2 + p.h * 0.5 + 1.5) continue;
        const hit = rayHitPeasant(p, rayOrigin, rayDir, camReach, tp);
        if (!hit) continue;
        if (tp) {
          const fwdDot = (hit.point.x - P.pos.x) * rayDir.x + (hit.point.y - (P.pos.y + 1.0)) * rayDir.y + (hit.point.z - P.pos.z) * rayDir.z;
          if (fwdDot < -0.35) continue;
        }
        const playerDist = eye.distanceTo(hit.point);
        if (playerDist > maxReach) continue;
        if (tp && !A.los(eye.x, eye.z, hit.point.x, hit.point.z) && playerDist > 1.2) continue;
        cand.push({ peasant: p, d: playerDist, v, hitPos: hit.point });
      }
      cand.sort((a, b) => a.d - b.d);
    }
    const maxHits = w.sweep ? 99 : 1;
    let hits = 0;
    for (const c of cand) {
      if (hits >= maxHits) break;
      const l = Math.hypot(c.v.x, c.v.z) || 1;
      if (c.peasant) {
        const power = w.id === 'hammer' ? 1.45 : w.id === 'scythe' ? 1.35 : w.id === 'cross' ? 1.1 : 1.05;
        A.launchPeasantRagdoll(c.peasant, c.v.x / l, c.v.z / l, power);
        SFX.play(w.hitSfx || (w.id === 'scythe' ? 'cut' : w.id === 'cross' ? 'cross' : 'punch'));
      } else {
        dmgEnemy(c.e, w.dmg, c.v.x / l, c.v.z / l, {
          knock: w.knock,
          hitSfx: w.hitSfx || (w.id === 'scythe' ? 'cut' : w.id === 'cross' ? 'cross' : 'general'),
          part: c.part,
          hitPos: c.hitPos,
          weapon: w.id
        });
      }
      hits++;
    }
    if (hits > 0) {
      P.shake = Math.max(P.shake, 0.12 + (w.dmg > 30 ? 0.12 : 0));
      S.hitStop = 0.035 * (SAVE.hitstop != null ? SAVE.hitstop : 1);
      const burstPos = cand[0].hitPos || eye.clone().addScaledVector(f, Math.min(3, w.range * 0.7));
      burst(burstPos.x, burstPos.y, burstPos.z, 0xffd060, 4, 5, 0.25, 0.12, 8);
    } else if (!silent) SFX.play('swing');
    return hits;
  }

  function demoSlam(w) {
    const f = getAimDir();
    const fl = new V3(f.x, 0, f.z).normalize();
    P.vel.x += fl.x * 11; P.vel.z += fl.z * 11;
    const cx = P.pos.x + fl.x * 3.8, cz = P.pos.z + fl.z * 3.8;
    let hits = 0;
    for (const e of enemies) {
      if (e.dead || e.downed || !e.inRender) continue;
      const ep = e.g.position;
      const d = dist2(cx, cz, ep.x, ep.z);
      if (d > w.aoe + e.r || ep.y > 4.5) continue;
      const l = d || 1;
      dmgEnemy(e, w.dmg * (1 - 0.45 * clamp(d / (w.aoe + e.r), 0, 1)), (ep.x - cx) / l, (ep.z - cz) / l, { knock: 18, stunBonus: 0.45, weapon: w.id });
      hits++;
    }
    for (const p of peasants) {
      if (p.dead || !p.inRender) continue;
      const pp = p.g.position;
      const d = dist2(cx, cz, pp.x, pp.z);
      if (d > w.aoe + p.r || pp.y > 4.5) continue;
      const l = d || 1;
      A.launchPeasantRagdoll(p, (pp.x - cx) / l, (pp.z - cz) / l, 1.8);
      hits++;
    }
    spawnRing(cx, cz, w.aoe + 3.5, 26, 0, 0xffa040, 'p');
    burst(cx, 0.5, cz, 0x7a6a5a, 24, 10, 0.8, 0.35, 16, false);
    burst(cx, 0.8, cz, 0xffc060, 12, 9, 0.4, 0.2, 10);
    P.shake = Math.max(P.shake, 0.75);
    SFX.play('boom');
    S.hitStop = (hits ? 0.075 : 0.025) * (SAVE.hitstop != null ? SAVE.hitstop : 1);
  }

  function throwCross() {
    const c = S.cross;
    c.state = 'out'; c.t = 0;
    if (TP_CAM.userMode && TP_CAM.active) {
      getProjectileSpawn('cross', c.pos, c.dir, c.hand);
    } else {
      c.dir.copy(fwd3());
      const side = c.hand === 1 ? 0.35 : -0.35;
      c.pos.copy(eyePos()).addScaledVector(c.dir, 1.2);
      c.pos.x += Math.cos(P.yaw) * side; c.pos.z += -Math.sin(P.yaw) * side; c.pos.y -= 0.15;
    }
    c.mesh = buildThrownCross();
    if (window.BloodStain) BloodStain.applyToCross(c.mesh);
    c.mesh.position.copy(c.pos);
    scene.add(c.mesh);
    c.hitT = new Map();
    SFX.play('cross');
  }
  function crossRemove() {
    const c = S.cross;
    if (c.mesh) { scene.remove(c.mesh); c.mesh = null; }
    c.state = 'held';
  }
  function updateCross(dt) {
    const c = S.cross;
    if (c.state === 'held') return;
    c.t += dt;
    c.mesh.rotation.y += dt * 22;
    c.mesh.rotation.z = 0.3;
    if (c.mesh.userData && c.mesh.userData.aura) {
      c.mesh.userData.aura.scale.setScalar(1.08 + Math.sin(c.t * 14) * 0.08);
    }
    if (c.state === 'out') {
      c.pos.addScaledVector(c.dir, 52 * dt);
      if (c.t > 0.55 || A.pointInWall(c.pos.x, c.pos.z) || c.pos.y < 0.3 || !World.isPosInRender(c.pos.x, c.pos.z)) {
        c.state = 'back'; burst(c.pos.x, c.pos.y, c.pos.z, 0xffe080, 6, 6, 0.3, 0.14, 6);
      }
    } else {
      const tgt = new V3();
      if (TP_CAM.userMode && TP_CAM.active) {
        NIVALDO_3P.root.updateMatrixWorld(true);
        const recvNode = c.hand === 1 ? NIVALDO_3P.handR : NIVALDO_3P.handL;
        if (recvNode) recvNode.getWorldPosition(tgt);
        else { tgt.copy(eyePos()); tgt.y -= 0.45; }
      } else {
        const catchSide = c.hand === 1 ? -0.35 : 0.35;
        tgt.copy(eyePos()); tgt.y -= 0.45;
        tgt.x += Math.cos(P.yaw) * catchSide; tgt.z += -Math.sin(P.yaw) * catchSide;
      }
      const d = tgt.clone().sub(c.pos);
      const L = d.length();
      if (L < 1.7) { crossRemove(); c.hand ^= 1; P.crossCatchT = 0.16; SFX.play('catchCross'); return; }
      c.pos.addScaledVector(d.normalize(), (55 + c.t * 25) * dt);
    }
    c.mesh.position.copy(c.pos);
    for (const e of enemies) {
      if (e.dead || e.downed || !e.inRender) continue;
      const ec = new V3(e.g.position.x, e.g.position.y + e.h * 0.5, e.g.position.z);
      if (ec.distanceTo(c.pos) < 1.7 + e.r * 0.9) {
        const last = c.hitT.get(e) || -1;
        if (c.t - last > 0.18) {
          c.hitT.set(e, c.t);
          const hitPart = findHitPart(e, c.pos, 0.45);
          dmgEnemy(e, WEAPONS[5].dmg, c.dir.x, c.dir.z, { knock: 2, hitSfx: 'cross', part: hitPart, hitPos: c.pos, weapon: 'cross' });
          if (window.BloodStain) {
            BloodStain.addBlood(0, 'cross', 0.12);
            BloodStain.applyToCross(c.mesh);
          }
        }
      }
    }
    for (const p of peasants) {
      if (p.dead || !p.inRender) continue;
      const pc = new V3(p.g.position.x, p.g.position.y + p.h * 0.5, p.g.position.z);
      if (pc.distanceTo(c.pos) < 1.7 + p.r * 0.9) {
        const last = c.hitT.get(p) || -1;
        if (c.t - last > 0.25) {
          c.hitT.set(p, c.t);
          A.launchPeasantRagdoll(p, c.dir.x, c.dir.z, 1.25);
          SFX.play('cross');
        }
      }
    }
  }

  function hitGrabbedEnemy(w) {
    const e = P.grabbed;
    if (!e || e.dead) return;
    const f = fwd3();
    A.dmgEnemy(e, w.dmg, f.x, f.z, { knock: 0, stunBonus: 0.4, hitSfx: w.sfx || 'punch', part: 'torso' });
    P.shake = Math.max(P.shake, w.id === 'demo' ? 0.45 : 0.18);
    S.style = Math.min(420, S.style + 10);
  }
  function attack(w) {
    const cdMul = P.faithMode > 0 ? 0.7 : 1;
    if (P.grabbed && !P.grabbed.dead) {
      const isMelee = (w.id === 'fists' || w.id === 'hammer' || w.id === 'scythe' || w.id === 'demo');
      if (isMelee) {
        if (w.id === 'fists') {
          const step = P.fistCombo || 0;
          P.hand = 1;
          P.fistUpper = (step === 4);
          P.swingStep = step;
          P.fistCombo = (step + 1) % 5;
          P.fistComboT = 0.9;
          P.swingDur = P.fistUpper ? 0.30 : w.dur;
          P.swingT = P.swingDur;
        } else {
          if (w.id === 'scythe') { P.swingStep = P.scytheStep || 0; P.scytheStep = P.swingStep ^ 1; P.comboResetT = 1.2; }
          if (w.id === 'demo') { P.swingStep = P.demoStep || 0; P.demoStep = (P.swingStep + 1) % 3; P.comboResetT = 1.6; }
          startSwing(w);
        }
        P.pending = { t: w.hitAt, fn: () => hitGrabbedEnemy(w) };
        wcd[w.id] = (w.id === 'fists' && P.fistUpper ? 0.42 : w.cd) * cdMul;
      } else {
        const fw = WEAPONS[0];
        P.hand = 1;
        P.fistUpper = false;
        P.swingStep = 0;
        P.swingDur = fw.dur; P.swingT = fw.dur;
        P.pending = { t: fw.hitAt, fn: () => hitGrabbedEnemy(fw) };
        wcd[w.id] = fw.cd * cdMul;
      }
      return;
    }
    let customCd = null;
    switch (w.id) {
      case 'fists': {
        const step = P.fistCombo || 0;
        P.hand = (step % 2 === 0) ? 1 : 0; // 0: dir, 1: esq, 2: dir, 3: esq, 4: uppercut (dir)
        P.fistUpper = (step === 4);
        P.swingStep = step;
        P.fistCombo = (step + 1) % 5;
        P.fistComboT = 0.9;
        if (P.fistUpper) {
          P.swingDur = 0.30; P.swingT = 0.30;
          P.pending = { t: 0.10, fn: () => meleeAttack({ ...w, dmg: Math.round(w.dmg * 1.65), knock: 11, sfx: 'punch' }) };
          customCd = 0.42;
        } else {
          startSwing(w);
          P.pending = { t: w.hitAt, fn: () => meleeAttack(w) };
        }
        break;
      }
      case 'hammer':
        startSwing(w);
        P.pending = { t: w.hitAt, fn: () => meleeAttack(w) };
        break;
      case 'scythe':
        P.swingStep = P.scytheStep || 0;
        P.scytheStep = P.swingStep ^ 1;
        P.comboResetT = 1.2;
        startSwing(w);
        P.pending = { t: w.hitAt, fn: () => meleeAttack(w) };
        break;
      case 'demo':
        P.swingStep = P.demoStep || 0;
        P.demoStep = (P.swingStep + 1) % 3;
        P.comboResetT = 1.6;
        startSwing(w);
        P.pending = { t: w.hitAt, fn: () => demoSlam(w) };
        break;
      case 'sling': {
        if (P.rocks <= 0) { wcd[w.id] = 0.25; SFX.play('ui'); S.ammoFlash = 0.4; return; }
        P.rocks--; startSwing(w);
        const f = new V3(), o = new V3();
        if (TP_CAM.userMode && TP_CAM.active) {
          getProjectileSpawn('sling', o, f);
        } else {
          f.copy(fwd3()); o.copy(eyePos()).addScaledVector(f, 0.8);
          o.x += Math.cos(P.yaw) * 0.25; o.z += -Math.sin(P.yaw) * 0.25; o.y -= 0.2;
        }
        spawnProj('rock', o, f.clone().multiplyScalar(75), w.dmg, 'p', 0.3, 2, 6);
        SFX.play('sling');
        break;
      }
      case 'cross':
        if (S.cross.state !== 'held') return;
        startSwing(w); throwCross();
        break;
      case 'heart': {
        if (P.blood < 3) { wcd[w.id] = 0.25; SFX.play('ui'); S.ammoFlash = 0.4; return; }
        P.blood -= 3; startSwing(w);
        const f = new V3(), o = new V3();
        getProjectileSpawn('heart', o, f);
        f.x += rnd(-0.015, 0.015); f.y += rnd(-0.015, 0.015); f.z += rnd(-0.015, 0.015); f.normalize();
        spawnProj('blood', o, f.multiplyScalar(62), w.dmg, 'p', 0.4, 1.6, 0);
        SFX.play('blood');
        break;
      }
    }
    wcd[w.id] = (customCd != null ? customCd : w.cd) * cdMul;
  }

  function altAttack() {
    const w = WEAPONS[curW()];
    const cdMul = P.faithMode > 0 ? 0.7 : 1;
    if (wcd.alt > 0 || P.swapT >= 0.45) return;

    if (w.id === 'fists') {
      return;
    }
    if (w.id === 'hammer') {
      wcd.alt = 1.35 * cdMul;
      P.swingDur = 0.35; P.swingT = 0.35;
      const f = new V3(), o = new V3();
      getProjectileSpawn('hammer', o, f);
      spawnProj('brick', o, f.clone().multiplyScalar(54), 44, 'p', 0.38, 2.2, 9);
      SFX.play('brick');
      return;
    }
    if (w.id === 'sling') {
      if (P.rocks < 3) { wcd.alt = 0.3; SFX.play('ui'); S.ammoFlash = 0.4; return; }
      P.rocks -= 3;
      wcd.alt = 0.95 * cdMul;
      P.swingDur = 0.35; P.swingT = 0.35;
      const f = new V3(), o = new V3();
      getProjectileSpawn('sling', o, f);
      spawnProj('boulder', o, f.clone().multiplyScalar(68), 68, 'p', 0.48, 2.4, 5);
      P.shake = Math.max(P.shake, 0.22);
      SFX.play('sling'); SFX.play('hammer');
      return;
    }
    if (w.id === 'scythe') {
      wcd.alt = 1.15 * cdMul;
      P.swingStep = 0;
      P.swingDur = 0.48; P.swingT = 0.48;
      P.pending = { t: 0.16, fn: () => {
        const hits = meleeAttack({ range: 7.2, dmg: 38, cos: -0.35, knock: -10, sweep: true, sfx: 'scythe', id: 'scythe' });
        if (hits > 0 && WEAPONS[6].owned) P.blood = Math.min(AMMO_MAX.blood, P.blood + hits * 8);
      } };
      return;
    }
    if (w.id === 'demo') {
      wcd.alt = 2.0 * cdMul;
      P.swingStep = 2;
      P.swingDur = 0.85; P.swingT = 0.85;
      P.pending = { t: 0.4, fn: () => {
        demoSlam(w);
        const f = getAimDir(), fl = new V3(f.x, 0, f.z).normalize();
        for (let step = 1; step <= 2; step++) {
          const sx = P.pos.x + fl.x * (3.8 + step * 5.2), sz = P.pos.z + fl.z * (3.8 + step * 5.2);
          later(step * 0.12, () => {
            spawnRing(sx, sz, 5.5, 22, 0, 0xff6020, 'p');
            burst(sx, 0.4, sz, 0xffa040, 10, 8, 0.45, 0.22, 12);
            for (const e of enemies) {
              if (!e.dead && !e.downed && e.inRender && dist2(sx, sz, e.g.position.x, e.g.position.z) < 4.8 + e.r) {
                dmgEnemy(e, 65, fl.x, fl.z, { knock: 12, stunBonus: 0.4, weapon: 'demo' });
              }
            }
            for (const p of peasants) {
              if (!p.dead && p.inRender && dist2(sx, sz, p.g.position.x, p.g.position.z) < 4.8 + p.r) {
                A.launchPeasantRagdoll(p, p.g.position.x - sx, p.g.position.z - sz, 1.8);
              }
            }
          });
        }
      } };
      return;
    }
    if (w.id === 'cross') {
      if (S.cross.state === 'out') { S.cross.state = 'back'; wcd.alt = 0.28; return; }
      if (S.cross.state === 'back') return;
      wcd.alt = 0.22;
      P.swingDur = 0.16; P.swingT = 0.16;
      P.pending = { t: 0.05, fn: () => meleeAttack({ range: 5.2, dmg: 26, cos: 0.55, knock: 4, sfx: 'cross', id: 'cross' }) };
      return;
    }
    if (w.id === 'heart') {
      if (P.blood < 15) { wcd.alt = 0.3; SFX.play('ui'); S.ammoFlash = 0.4; return; }
      P.blood -= 15;
      wcd.alt = 0.68 * cdMul;
      P.swingDur = 0.25; P.swingT = 0.25;
      const baseF = new V3(), o = new V3();
      getProjectileSpawn('heart', o, baseF);
      for (let i = 0; i < 6; i++) {
        const f = baseF.clone();
        f.x += rnd(-0.09, 0.09); f.y += rnd(-0.06, 0.06); f.z += rnd(-0.09, 0.09); f.normalize();
        spawnProj('blood', o, f.multiplyScalar(58), 16, 'p', 0.42, 1.3, 0);
      }
      P.shake = Math.max(P.shake, 0.24);
      SFX.play('blood'); SFX.play('heart');
    }
  }
  wcd.alt = 0;

  function updateWeapons(dt) {
    for (const k in wcd) wcd[k] = Math.max(0, wcd[k] - dt);
    if (P.swingT > 0) P.swingT -= dt;
    if (P.crossCatchT > 0) P.crossCatchT = Math.max(0, P.crossCatchT - dt);
    if (P.swingT <= 0) {
      if (P.fistComboT > 0) { P.fistComboT -= dt; if (P.fistComboT <= 0) P.fistCombo = 0; }
      if (P.comboResetT > 0) { P.comboResetT -= dt; if (P.comboResetT <= 0) { P.scytheStep = 0; P.demoStep = 0; } }
    }
    if (P.kickCd > 0) P.kickCd = Math.max(0, P.kickCd - dt);
    if (P.kickT > 0) P.kickT = Math.max(0, P.kickT - dt);
    if (P.swapT > 0) P.swapT = Math.max(0, P.swapT - dt * 5);
    if (P.pending) { P.pending.t -= dt; if (P.pending.t <= 0) { const f = P.pending.fn; P.pending = null; f(); } }
    if (P.kickPending) { P.kickPending.t -= dt; if (P.kickPending.t <= 0) { const f = P.kickPending.fn; P.kickPending = null; f(); } }
    if (P.dead || S.cutscene > 0 || S.glory) return;
    const w = WEAPONS[curW()];
    if (mouseL && wcd[w.id] <= 0 && P.swapT < 0.45) attack(w);
    if (mouseR) altAttack();
  }

  function performKick() {
    const f = getAimDir(), eye = eyePos();
    const fl = Math.hypot(f.x, f.z) || 1;
    const fx = f.x / fl, fz = f.z / fl;
    const range = 4.4;
    let bestEnemy = null, bestScore = -Infinity, bestPos = null;

    for (const e of enemies) {
      if (!e || e.dead || e.downed || e.kicked || !e.inRender) continue;
      const c = new V3(e.g.position.x, e.g.position.y + e.h * 0.5, e.g.position.z);
      const dx = c.x - eye.x, dz = c.z - eye.z;
      const hd = Math.hypot(dx, dz);
      if (hd > range + e.r) continue;
      if (Math.abs(c.y - eye.y) > e.h * 0.65 + 2.2) continue;
      const nx = hd > 0.01 ? dx / hd : fx;
      const nz = hd > 0.01 ? dz / hd : fz;
      const dot = nx * fx + nz * fz;
      if (hd > e.r + 1.5 && dot < 0.32) continue;
      if (!A.los(eye.x, eye.z, c.x, c.z) && hd > e.r + 1.4) continue;
      const score = dot * 2.0 - hd * 0.25;
      if (score > bestScore) { bestScore = score; bestEnemy = e; bestPos = c; }
    }

    if (bestEnemy) {
      const e = bestEnemy;
      const dx = e.g.position.x - P.pos.x, dz = e.g.position.z - P.pos.z;
      const dl = Math.hypot(dx, dz) || 1;
      const nx = dl > 0.05 ? dx / dl : fx;
      const nz = dl > 0.05 ? dz / dl : fz;
      const kickDmg = 28 * (P.faithMode > 0 ? 2 : 1);
      if (!e.T.boss && (e.glory || (e.hp <= 30 && (e.T.mass || 1) <= 1.5))) {
        A.launchKickedEnemy(e, nx, nz);
        if (window.BloodStain) BloodStain.addBlood(0.08, 'kick', 0.18);
        S.style = Math.min(420, S.style + 25);
      } else {
        dmgEnemy(e, kickDmg, nx, nz, {
          knock: 20,
          stunBonus: 0.75,
          hitSfx: 'general',
          part: 'torso',
          hitPos: bestPos,
          weapon: 'kick'
        });
      }
      SFX.play('slam');
      SFX.play('hit', 'general');
      P.shake = Math.max(P.shake, 0.32);
      P.fovKick = Math.max(P.fovKick, 0.28);
      S.hitStop = Math.max(S.hitStop || 0, 0.035 * (SAVE.hitstop != null ? SAVE.hitstop : 1));
      burst(bestPos.x, bestPos.y, bestPos.z, 0xffd060, 8, 7, 0.3, 0.14, 10);
      return;
    }

    let bestPeasant = null, bestPDist = Infinity;
    for (const p of peasants) {
      if (!p || p.dead || !p.inRender) continue;
      const c = new V3(p.g.position.x, p.g.position.y + p.h * 0.5, p.g.position.z);
      const dx = c.x - eye.x, dz = c.z - eye.z;
      const hd = Math.hypot(dx, dz);
      if (hd > range + p.r) continue;
      if (Math.abs(c.y - eye.y) > p.h * 0.65 + 2.0) continue;
      const nx = hd > 0.01 ? dx / hd : fx;
      const nz = hd > 0.01 ? dz / hd : fz;
      const dot = nx * fx + nz * fz;
      if (hd > p.r + 1.4 && dot < 0.32) continue;
      if (hd < bestPDist) { bestPDist = hd; bestPeasant = p; }
    }
    if (bestPeasant) {
      const dx = bestPeasant.g.position.x - P.pos.x, dz = bestPeasant.g.position.z - P.pos.z;
      const dl = Math.hypot(dx, dz) || 1;
      A.launchPeasantRagdoll(bestPeasant, dx / dl, dz / dl, 1.6);
      SFX.play('hit', 'general');
      P.shake = Math.max(P.shake, 0.2);
    }
  }

  function startKick() {
    if (P.dead || S.cutscene > 0 || S.glory || P.kickCd > 0) return;
    const cdMul = P.faithMode > 0 ? 0.7 : 1;
    P.kickDur = 0.36;
    P.kickT = 0.36;
    P.kickCd = 0.55 * cdMul;
    P.kickPending = { t: 0.09, fn: performKick };
    SFX.play('swing');
  }

  function activateFaith() {
    if (P.faith < 100 || P.faithMode > 0 || P.dead) return;
    P.faithMode = 10; S.faithReady = false;
    SFX.play('faith');
    say('SUPER-FÉ! Dano em dobro, vida regenerando!', '', 2.5);
    el('flash').style.background = '#ffe080'; P.flashV = 0.7;
  }

  /* ---------------- viewmodel ---------------- */
  function curve(a, up, down) {
    if (a < 0.35) return up * (a / 0.35);
    if (a < 0.55) return up + (down - up) * ((a - 0.35) / 0.2);
    return down * (1 - (a - 0.55) / 0.45);
  }
  function swing3(a, t1, t2, w, s) {
    if (a < t1) {
      const u = a / t1;
      return w * (u * u);
    }
    if (a < t2) {
      const u = (a - t1) / (t2 - t1);
      return w + (s - w) * Math.sin(u * Math.PI * 0.5);
    }
    const u = (a - t2) / (1 - t2);
    return s * (1 - u * u * (3 - 2 * u));
  }
  const _rosPt = new THREE.Vector3();
  const _rosInv = new THREE.Matrix4();
  const rosaryPhys = {
    t: 0, rx: 0, rz: 0, vx: 0, vz: 0,
    prevYaw: 0, prevFwd: 0, prevSide: 0, prevBobSin: 0,
    histX: [0, 0, 0, 0, 0, 0, 0],
    histZ: [0, 0, 0, 0, 0, 0, 0]
  };
  function updateRosaryPhysics(dt) {
    if (!P.hasRosary || dt <= 0) return;
    const stepDt = Math.min(dt, 0.05);
    rosaryPhys.t += stepDt;
    const f = fwd3();
    const rx = f.z, rz = -f.x;
    const fwdVel = P.vel.x * f.x + P.vel.z * f.z;
    const sideVel = P.vel.x * rx + P.vel.z * rz;
    const accelFwd = (fwdVel - rosaryPhys.prevFwd) / Math.max(0.008, stepDt);
    const accelSide = (sideVel - rosaryPhys.prevSide) / Math.max(0.008, stepDt);
    rosaryPhys.prevFwd = fwdVel;
    rosaryPhys.prevSide = sideVel;

    const dyaw = A.lerpAngle(rosaryPhys.prevYaw, P.yaw, 1) - rosaryPhys.prevYaw;
    rosaryPhys.prevYaw = P.yaw;

    const hs = Math.hypot(P.vel.x, P.vel.z);
    const walkAmt = P.onGround ? Math.min(1, hs / 8.5) : 0.18;
    const bobSin = Math.sin(P.bob);
    const bobImpulse = (bobSin - rosaryPhys.prevBobSin) / Math.max(0.008, stepDt);
    rosaryPhys.prevBobSin = bobSin;

    const walkSwingX = Math.sin(P.bob * 2) * 0.52 * walkAmt;
    const walkSwingZ = bobSin * 0.68 * walkAmt;
    const idleSwayX = Math.sin(rosaryPhys.t * 2.2) * 0.06;
    const idleSwayZ = Math.cos(rosaryPhys.t * 1.7) * 0.05;
    const swingBoost = (S.atkAnim > 0 ? Math.sin(S.atkAnim * Math.PI) * 1.65 : 0);

    const targetRx = clamp(
      -fwdVel * 0.042 - accelFwd * 0.015 - P.vel.y * 0.055 + walkSwingX + idleSwayX + swingBoost,
      -1.35, 1.35
    );
    const targetRz = clamp(
      sideVel * 0.052 + accelSide * 0.015 + (dyaw / Math.max(0.008, stepDt)) * 0.085 + walkSwingZ + idleSwayZ,
      -1.35, 1.35
    );

    // Mola sub-amortecida rápida o bastante para responder a cada passo e balançar ao parar
    const k = 78, dampK = 5.2;
    rosaryPhys.vx += ((targetRx - rosaryPhys.rx) * k - rosaryPhys.vx * dampK) * stepDt;
    rosaryPhys.vz += ((targetRz - rosaryPhys.rz) * k - rosaryPhys.vz * dampK + bobImpulse * 0.45 * walkAmt) * stepDt;
    rosaryPhys.rx = clamp(rosaryPhys.rx + rosaryPhys.vx * stepDt, -1.45, 1.45);
    rosaryPhys.rz = clamp(rosaryPhys.rz + rosaryPhys.vz * stepDt, -1.45, 1.45);

    const follow = Math.min(1, stepDt * 13);
    const nSeg = rosaryPhys.histX.length;
    for (let i = 0; i < nSeg; i++) {
      const px = i === 0 ? rosaryPhys.rx : rosaryPhys.histX[i - 1];
      const pz = i === 0 ? rosaryPhys.rz : rosaryPhys.histZ[i - 1];
      rosaryPhys.histX[i] += (px - rosaryPhys.histX[i]) * follow;
      rosaryPhys.histZ[i] += (pz - rosaryPhys.histZ[i]) * follow;
    }
    const applyChain = (ros) => {
      if (!ros || !ros.segments) return;
      for (let i = 0; i < ros.segments.length; i++) {
        const seg = ros.segments[i];
        const hx = rosaryPhys.histX[i] || 0;
        const hz = rosaryPhys.histZ[i] || 0;
        const prevHx = i > 0 ? (rosaryPhys.histX[i - 1] || 0) : 0;
        const prevHz = i > 0 ? (rosaryPhys.histZ[i - 1] || 0) : 0;
        seg.rotation.x = (i === 0 ? hx * 0.72 : (hx - prevHx) * 2.2 + hx * 0.24);
        seg.rotation.z = (i === 0 ? hz * 0.72 : (hz - prevHz) * 2.2 + hz * 0.24);
        if (i === 0 || i === ros.segments.length - 1) {
          seg.rotation.y = hz * 0.35 + Math.sin(rosaryPhys.t * 2.4 + i) * 0.12;
        }
      }
      // Colisão exclusiva do rosário contra a mão/polegar do Nivaldo para não atravessar os dedos
      if (ros.colliders && ros.colliders.length && ros.root.visible) {
        ros.root.updateMatrixWorld(true);
        _rosInv.copy(ros.root.matrixWorld).invert();
        let hitHand = false;
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < ros.segments.length; i++) {
            const seg = ros.segments[i];
            const tipY = (i === ros.segments.length - 1) ? -0.075 : -0.028;
            _rosPt.set(0, tipY, 0).applyMatrix4(seg.matrixWorld).applyMatrix4(_rosInv);
            for (let c = 0; c < ros.colliders.length; c++) {
              const box = ros.colliders[c];
              const pad = box.pad || 0.015;
              if (_rosPt.y >= box.minY - pad && _rosPt.y <= box.maxY + pad &&
                  _rosPt.z >= box.minZ - pad && _rosPt.z <= box.maxZ + pad &&
                  _rosPt.x > box.minX - pad && _rosPt.x < box.maxX + pad) {
                const pen = _rosPt.x - (box.minX - pad);
                // Empurra o elo para o lado externo (-X) do dedo/punho
                const piv = i === 0 ? seg : ros.segments[i - 1];
                piv.rotation.z -= Math.min(0.65, pen * 9.5);
                if (i === 0) seg.rotation.z -= Math.min(0.45, pen * 6.0);
                hitHand = true;
              }
            }
          }
          if (!hitHand) break;
          ros.root.updateMatrixWorld(true);
        }
        if (hitHand && rosaryPhys.vz > 0) {
          rosaryPhys.vz = -rosaryPhys.vz * 0.28;
        }
      }
    };
    if (NIVALDO_3P && NIVALDO_3P.rosary) applyChain(NIVALDO_3P.rosary);
    if (VMS && VMS._rosaries) {
      for (let i = 0; i < VMS._rosaries.length; i++) {
        const r = VMS._rosaries[i];
        r.root.visible = !!P.hasRosary;
        if (P.hasRosary) applyChain(r);
      }
    }
  }

  function updateVM(dt) {
    updateRosaryPhysics(dt);
    for (const k in VMS) VMS[k].root.visible = false;
    if (!SAVE.showVM || isThirdPersonActive() || S.cutscene > 0) return;
    if (S.glory) {
      const gk = S.glory;
      const p = clamp(gk.t / gk.dur, 0, 1);
      if (gk.kind === 'rip' || gk.kind === 'decap') {
        const vm = VMS.fists;
        vm.root.visible = true;
        [vm.handL, vm.handR].forEach((h, i) => {
          const b = h.userData.base, side = i ? 1 : -1;
          if (gk.kind === 'rip') {
            if (p < 0.45) {
              const u = p / 0.45;
              h.position.set(b.x * (1 - u * 0.55), b.y + u * 0.08, b.z - u * 0.48);
              h.rotation.set(-u * 0.2, -side * u * 0.25, side * u * 0.3);
            } else {
              const u = (p - 0.45) / 0.55;
              const rip = Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5);
              h.position.set(b.x * 0.45 + side * rip * 0.52, b.y + 0.08 - u * 0.12, b.z - 0.48 + rip * 0.22);
              h.rotation.set(-0.2 + rip * 0.35, -side * 0.25 + side * rip * 0.6, side * (0.3 - rip * 0.9));
            }
          } else {
            // decap: agarra a cabeça e arranca pra cima
            if (p < 0.45) {
              const u = p / 0.45;
              h.position.set(b.x * (1 - u * 0.65), b.y + u * 0.14, b.z - u * 0.52);
              h.rotation.set(-u * 0.25, -side * u * 0.35, 0);
            } else {
              const u = (p - 0.45) / 0.55;
              const yank = Math.sin(Math.min(1, u * 1.35) * Math.PI * 0.5);
              h.position.set(b.x * 0.35 + side * yank * 0.08, b.y + 0.14 + yank * 0.36, b.z - 0.52 + yank * 0.35);
              h.rotation.set(-0.25 + yank * 0.65, -side * 0.35, side * yank * 0.25);
            }
          }
        });
      } else if (gk.kind === 'hammer') {
        const vm = VMS.hammer;
        vm.root.visible = true;
        const b = vm.root.userData.base, r = vm.root;
        r.position.copy(b.p); r.rotation.copy(b.r);
        let ang = 0, fwdZ = 0, liftY = 0;
        if (p < 0.38) {
          const u = p / 0.38;
          ang = u * 1.15;
          liftY = u * 0.22;
        } else if (p < 0.58) {
          const u = (p - 0.38) / 0.20;
          ang = 1.15 - u * 2.75;
          liftY = 0.22 - u * 0.25;
          fwdZ = u * 0.36;
        } else {
          const u = (p - 0.58) / 0.42;
          ang = -1.60 * (1 - u);
          liftY = -0.03 * (1 - u);
          fwdZ = 0.36 * (1 - u);
        }
        r.rotation.x += ang;
        r.position.x -= 0.14;
        r.position.y += liftY;
        r.position.z -= fwdZ;
      } else if (gk.kind === 'kick' && VMS.kick) {
        const vm = VMS.kick;
        vm.root.visible = true;
        const b = vm.root.userData.base, r = vm.root;
        r.position.copy(b.p); r.rotation.copy(b.r);
        if (p < 0.32) {
          const u = p / 0.32;
          r.position.y += u * 0.14;
          r.position.z += u * 0.25;
          r.rotation.x += u * 0.35;
        } else if (p < 0.60) {
          const u = (p - 0.32) / 0.28;
          const k = Math.sin(u * Math.PI * 0.5);
          r.position.y += 0.14 + k * 0.22;
          r.position.z += 0.25 - k * 0.72;
          r.rotation.x += 0.35 - k * 0.55;
        } else {
          const u = (p - 0.60) / 0.40;
          r.position.y += 0.36 * (1 - u);
          r.position.z += -0.47 * (1 - u);
          r.rotation.x += -0.20 * (1 - u);
        }
      }
      return;
    }
    if (P.kickT > 0 && VMS.kick) {
      const vm = VMS.kick;
      vm.root.visible = true;
      const b = vm.root.userData.base, r = vm.root;
      r.position.copy(b.p); r.rotation.copy(b.r);
      const p = clamp(1 - P.kickT / (P.kickDur || 0.36), 0, 1);
      if (p < 0.25) {
        const u = p / 0.25;
        r.position.y += u * 0.14;
        r.position.z += u * 0.22;
        r.rotation.x += u * 0.32;
      } else if (p < 0.58) {
        const u = (p - 0.25) / 0.33;
        const k = Math.sin(u * Math.PI * 0.5);
        r.position.y += 0.14 + k * 0.26;
        r.position.z += 0.22 - k * 0.82;
        r.rotation.x += 0.32 - k * 0.58;
      } else {
        const u = (p - 0.58) / 0.42;
        r.position.y += 0.40 * (1 - u);
        r.position.z += -0.60 * (1 - u);
        r.rotation.x += -0.26 * (1 - u);
      }
    }
    const w = WEAPONS[curW()], vm = VMS[w.vm];
    vm.root.visible = !(w.id === 'cross' && S.cross.state !== 'held');
    const vmBobK = SAVE.vmBob != null ? SAVE.vmBob : 1;
    const moveAmt = Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 8) * (P.onGround ? 1 : 0.2) * vmBobK;
    const bx = Math.sin(P.bob) * 0.015 * moveAmt, by = Math.abs(Math.cos(P.bob)) * 0.015 * moveAmt - P.swapT * 0.55;
    const sw = P.swingT > 0, a = sw ? 1 - P.swingT / P.swingDur : 0, s = Math.sin(a * Math.PI);
    const holding = !!(P.grabbed && !P.grabbed.dead);
    if (VMS.fists) {
      VMS.fists.handL.visible = true;
      VMS.fists.handR.visible = true;
    }
    if (holding && VMS.fists) {
      VMS.fists.root.visible = true;
      const hL = VMS.fists.handL, bL = hL.userData.base;
      const ram = P.dashT > 0;
      hL.position.set(
        bL.x + (ram ? 0.22 : 0.02) + bx * -1,
        bL.y + (ram ? 0.14 : 0.10) + by,
        bL.z - (ram ? 0.34 : 0.22)
      );
      hL.rotation.set(ram ? -0.35 : -0.24, ram ? 0.20 : 0.36, -0.22);
      if (w.id !== 'fists') {
        const isPunching = sw && !(w.id === 'hammer' || w.id === 'scythe' || w.id === 'demo');
        VMS.fists.handR.visible = isPunching;
        if (isPunching) {
          const hR = VMS.fists.handR, bR = hR.userData.base;
          hR.position.set(bR.x + bx - s * 0.18, bR.y + by + s * 0.06, bR.z - s * 0.6);
          hR.rotation.set(-s * 0.25, -s * 0.35, 0);
        }
      }
    }
    if (w.id === 'fists') {
      [vm.handL, vm.handR].forEach((h, i) => {
        if (holding && i === 0) return;
        const b = h.userData.base, active = sw && (holding ? i === 1 : P.hand === i);
        const side = i ? 1 : -1;
        if (!active) {
          h.position.set(b.x + bx * side, b.y + by, b.z);
          h.rotation.set(0, 0, 0);
        } else if (P.fistUpper) {
          // 5º golpe: Uppercut (desce e sobe com força)
          h.position.set(
            b.x + bx * side + swing3(a, 0.26, 0.56, side * 0.05, -side * 0.28),
            b.y + by + swing3(a, 0.26, 0.56, -0.26, 0.34),
            b.z + swing3(a, 0.26, 0.56, 0.08, -0.58)
          );
          h.rotation.set(
            swing3(a, 0.26, 0.56, -0.45, 0.65),
            swing3(a, 0.26, 0.56, 0, -side * 0.22),
            swing3(a, 0.26, 0.56, side * 0.15, side * 0.35)
          );
        } else if (P.swingStep >= 2) {
          // 3º e 4º golpes: cruzados/ganchos mais fechados
          h.position.set(
            b.x + bx * side + swing3(a, 0.18, 0.52, side * 0.12, -side * 0.34),
            b.y + by + s * 0.05,
            b.z - s * 0.62
          );
          h.rotation.set(
            -s * 0.22,
            swing3(a, 0.18, 0.52, side * 0.18, -side * 0.55),
            swing3(a, 0.18, 0.52, -side * 0.15, side * 0.65)
          );
        } else {
          // 1º e 2º golpes: diretos rápidos intercalados
          h.position.set(b.x + bx * side - side * s * 0.20, b.y + by + s * 0.07, b.z - s * 0.64);
          h.rotation.set(-s * 0.25, -side * s * 0.35, side * s * 0.22);
        }
      });
      return;
    }
    const b = vm.root.userData.base, r = vm.root;
    r.position.copy(b.p); r.rotation.copy(b.r);
    if (w.id === 'cross') r.scale.x = 1;
    r.position.x += bx; r.position.y += by;
    switch (w.id) {
      case 'hammer':
        // Só balançando da direita pra esquerda
        if (sw) {
          r.position.x += swing3(a, 0.24, 0.56, 0.18, -0.65);
          r.position.y += swing3(a, 0.24, 0.56, 0.08, -0.04);
          r.position.z += swing3(a, 0.24, 0.56, 0.06, -0.24);
          r.rotation.x += swing3(a, 0.24, 0.56, 0.25, -0.45);
          r.rotation.y += swing3(a, 0.24, 0.56, -0.55, 1.25);
          r.rotation.z += swing3(a, 0.24, 0.56, -0.65, 1.15);
        }
        break;
      case 'demo':
        // Combo 3 golpes: direita->esquerda, esquerda->direita, cima->baixo
        if (sw) {
          const st = P.swingStep || 0;
          if (st === 0) {
            r.position.x += swing3(a, 0.30, 0.60, 0.26, -0.64);
            r.position.y += swing3(a, 0.30, 0.60, 0.06, -0.06);
            r.position.z += swing3(a, 0.30, 0.60, 0.06, -0.28);
            r.rotation.x += swing3(a, 0.30, 0.60, 0.20, -0.40);
            r.rotation.y += swing3(a, 0.30, 0.60, -0.60, 1.20);
            r.rotation.z += swing3(a, 0.30, 0.60, -0.80, 1.05);
          } else if (st === 1) {
            r.position.x += swing3(a, 0.30, 0.60, -0.54, 0.34);
            r.position.y += swing3(a, 0.30, 0.60, 0.06, -0.06);
            r.position.z += swing3(a, 0.30, 0.60, 0.06, -0.28);
            r.rotation.x += swing3(a, 0.30, 0.60, 0.20, -0.40);
            r.rotation.y += swing3(a, 0.30, 0.60, 0.95, -0.95);
            r.rotation.z += swing3(a, 0.30, 0.60, 0.95, -0.95);
          } else {
            r.position.x += swing3(a, 0.34, 0.62, -0.22, -0.22);
            r.position.y += swing3(a, 0.34, 0.62, 0.38, -0.16);
            r.position.z += swing3(a, 0.34, 0.62, 0.10, -0.34);
            r.rotation.x += swing3(a, 0.34, 0.62, 1.05, -1.40);
            r.rotation.z += swing3(a, 0.34, 0.62, 0.10, 0.10);
          }
        }
        break;
      case 'scythe':
        // Alterna: direita->esquerda e cima->baixo
        if (sw) {
          if ((P.swingStep || 0) === 0) {
            r.position.x += swing3(a, 0.25, 0.58, 0.24, -0.68);
            r.position.y += swing3(a, 0.25, 0.58, 0.06, -0.05);
            r.position.z += swing3(a, 0.25, 0.58, 0.04, -0.26);
            r.rotation.x += swing3(a, 0.25, 0.58, 0.15, -0.30);
            r.rotation.y += swing3(a, 0.25, 0.58, -0.65, 1.25);
            r.rotation.z += swing3(a, 0.25, 0.58, -0.55, 0.85);
          } else {
            // De cima pra baixo: gira a foice para a lâmina apontar pra frente e cravar com a ponta
            r.position.x += swing3(a, 0.28, 0.58, -0.22, -0.26);
            r.position.y += swing3(a, 0.28, 0.58, 0.34, -0.18);
            r.position.z += swing3(a, 0.28, 0.58, 0.08, -0.34);
            r.rotation.x += swing3(a, 0.28, 0.58, 0.75, -1.35);
            r.rotation.y += swing3(a, 0.28, 0.58, -1.35, -1.35);
            r.rotation.z += swing3(a, 0.28, 0.58, 0.35, 0.35);
          }
        }
        break;
      case 'sling': {
        const pull = sw ? slingPullCurve(a) : 0;
        const showRock = P.rocks > 0 && (!sw || a < 0.45 || a > 0.78);
        animateSlingParts(vm.root, pull, showRock);
        r.position.z += sw ? Math.max(0, -pull) * 0.12 : 0;
        r.rotation.x += sw ? Math.max(0, -pull) * 0.32 : 0;
        break;
      }
      case 'cross': {
        const isLeft = S.cross.hand === 0;
        r.scale.x = isLeft ? -1 : 1;
        r.position.x = (isLeft ? -b.p.x : b.p.x) + bx;
        if (vm.root.aura) {
          const ap = 1 + Math.sin(S.time * 4.5) * 0.06;
          vm.root.aura.scale.setScalar(ap);
        }
        if (P.crossCatchT > 0) {
          const ct = Math.sin((P.crossCatchT / 0.16) * Math.PI);
          r.position.z += ct * 0.14;
          r.rotation.x += ct * 0.24;
        }
        if (sw) { r.position.z -= s * 0.4; r.rotation.x -= s * 0.4; }
        break;
      }
      case 'heart': {
        const idleBeat = heartPulse(S.time * 1.35);
        const squeeze = sw ? s * 0.82 : 0;
        const sx = (1 + idleBeat * 0.13) * (1 - squeeze * 0.24);
        const sy = (1 + idleBeat * 0.08) * (1 + squeeze * 0.16);
        const sz = (1 + idleBeat * 0.15) * (1 + squeeze * 0.10);
        vm.root.heart.scale.set(sx, sy, sz);
        if (vm.root.handL && vm.root.handR) {
          const handGrip = squeeze - idleBeat * 0.06;
          vm.root.handL.position.x = vm.root.handL.userData.base.x + handGrip * 0.045;
          vm.root.handR.position.x = vm.root.handR.userData.base.x - handGrip * 0.045;
          vm.root.handL.rotation.z = -handGrip * 0.22;
          vm.root.handR.rotation.z = handGrip * 0.22;
        }
        r.position.z += sw ? s * 0.06 : 0;
        r.position.y -= (squeeze * 0.02 - idleBeat * 0.004);
        break;
      }
    }
  }

  /* ---------------- HUD: slots / face / radar ---------------- */
  function drawWeaponSlotIcon(canvas, id, active, owned) {
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, 32, 32);
    if (!owned) c.globalAlpha = 0.4;

    // Paleta em vermelho para todos os ícones
    const R_DARK = '#5a0808';
    const R_MID  = '#cc1818';
    const R_BRIGHT = '#ff3838';
    const R_HI   = '#ff8a8a';

    if (id === 'fists') {
      c.fillStyle = R_DARK; c.fillRect(8, 9, 16, 13);
      c.fillStyle = R_MID; c.fillRect(9, 10, 14, 11);
      c.fillStyle = R_HI; c.fillRect(10, 10, 12, 3);
      c.fillStyle = R_DARK;
      c.fillRect(13, 10, 1, 5); c.fillRect(16, 10, 1, 5); c.fillRect(19, 10, 1, 5);
      c.fillStyle = R_BRIGHT; c.fillRect(9, 14, 14, 3);
      c.fillStyle = R_HI; c.fillRect(10, 14, 12, 1);
    } else if (id === 'hammer') {
      c.fillStyle = R_DARK; c.fillRect(14, 11, 4, 17);
      c.fillStyle = R_MID; c.fillRect(15, 11, 2, 16);
      c.fillStyle = R_BRIGHT; c.fillRect(7, 5, 18, 7);
      c.fillStyle = R_HI; c.fillRect(8, 6, 15, 2);
      c.fillStyle = R_DARK; c.fillRect(22, 8, 4, 4); c.fillRect(6, 7, 2, 4);
    } else if (id === 'sling') {
      c.fillStyle = R_MID; c.fillRect(15, 16, 3, 11);
      c.fillRect(10, 10, 3, 7); c.fillRect(19, 10, 3, 7);
      c.fillRect(12, 15, 8, 3);
      c.fillStyle = R_BRIGHT; c.fillRect(11, 6, 2, 5); c.fillRect(19, 6, 2, 5);
      c.fillStyle = R_DARK; c.fillRect(13, 5, 6, 3);
      c.fillStyle = R_HI; c.fillRect(14, 6, 4, 2);
    } else if (id === 'scythe') {
      c.fillStyle = R_DARK; c.fillRect(16, 8, 3, 20);
      c.fillStyle = R_MID; c.fillRect(16, 8, 2, 20);
      c.fillStyle = R_BRIGHT; c.fillRect(7, 4, 13, 4);
      c.fillRect(5, 7, 5, 4); c.fillRect(4, 10, 3, 4);
      c.fillStyle = R_HI; c.fillRect(8, 4, 11, 1);
      c.fillStyle = R_DARK; c.fillRect(4, 12, 2, 2);
    } else if (id === 'demo') {
      c.fillStyle = R_DARK; c.fillRect(14, 12, 4, 16);
      c.fillStyle = R_MID; c.fillRect(15, 12, 2, 16);
      c.fillStyle = R_BRIGHT; c.fillRect(5, 4, 22, 9);
      c.fillStyle = R_HI; c.fillRect(6, 5, 20, 2);
      c.fillStyle = R_DARK; c.fillRect(7, 8, 4, 3); c.fillRect(21, 8, 4, 3);
    } else if (id === 'cross') {
      c.fillStyle = R_MID; c.fillRect(14, 4, 4, 24);
      c.fillRect(7, 9, 18, 4);
      c.fillStyle = R_BRIGHT; c.fillRect(15, 5, 2, 22);
      c.fillRect(8, 10, 16, 2);
      c.fillStyle = R_HI; c.fillRect(15, 5, 1, 20);
      c.fillStyle = R_DARK; c.fillRect(15, 10, 2, 2);
    } else if (id === 'heart') {
      c.fillStyle = R_DARK;
      c.fillRect(8, 8, 7, 7); c.fillRect(17, 8, 7, 7);
      c.fillRect(7, 12, 18, 7); c.fillRect(10, 19, 12, 4); c.fillRect(13, 23, 6, 3);
      c.fillStyle = R_BRIGHT;
      c.fillRect(9, 9, 5, 5); c.fillRect(18, 9, 5, 5);
      c.fillRect(8, 13, 16, 5); c.fillRect(11, 18, 10, 4);
      c.fillStyle = R_HI; c.fillRect(10, 10, 3, 2);
      c.fillStyle = R_MID; c.fillRect(15, 4, 3, 5); c.fillRect(19, 5, 2, 4);
    }

    // Mãozinha segurando o item quando selecionado
    if (active) {
      c.globalAlpha = 1;
      c.fillStyle = '#3a0404';
      c.fillRect(10, 20, 12, 11);
      c.fillRect(8, 22, 3, 5);
      c.fillStyle = '#ff5248';
      c.fillRect(11, 21, 10, 9);
      c.fillRect(9, 23, 2, 3);
      c.fillStyle = '#ffa8a0';
      c.fillRect(12, 21, 8, 2);
      c.fillRect(12, 24, 8, 2);
      c.fillRect(12, 27, 7, 2);
      c.fillStyle = '#8a1010';
      c.fillRect(12, 23, 8, 1);
      c.fillRect(12, 26, 8, 1);
      c.fillRect(11, 21, 1, 8);
    }
    c.globalAlpha = 1;
  }

  function buildSlots() {
    const box = el('slots'); box.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const d = document.createElement('div'); d.className = 'slot'; d.id = 'slot' + i;
      d.innerHTML = '<canvas class="slot-icon" width="32" height="32"></canvas>';
      box.appendChild(d);
    });
  }
  function updateSlots() {
    S.slotsT = 2;
    const box = el('slots');
    if (box) box.classList.remove('faded');
    const ownedIdx = [];
    WEAPONS.forEach((w, i) => { if (w.owned) ownedIdx.push(i); });
    const n = ownedIdx.length;
    const curPos = ownedIdx.indexOf(curW());

    WEAPONS.forEach((w, i) => {
      const d = el('slot' + i);
      if (!d) return;
      const owned = !!w.owned;
      const active = i === curW();
      d.classList.toggle('owned', owned);
      d.classList.toggle('active', active);

      if (!owned || curPos < 0) {
        d.style.opacity = '0';
        d.style.zIndex = '0';
        d.style.transform = 'translateY(-50%) scale(0.55)';
      } else {
        const j = ownedIdx.indexOf(i);
        let dist = j - curPos;
        if (n >= 3) {
          if (dist > n / 2) dist -= n;
          if (dist < -n / 2) dist += n;
        }
        const vis = Math.abs(dist) <= 1;
        const clamped = dist > 1 ? 2 : (dist < -1 ? -2 : dist);
        const y = clamped * 70;
        const sc = dist === 0 ? 1.08 : (vis ? 0.82 : 0.6);
        d.style.opacity = vis ? (dist === 0 ? '1' : '0.62') : '0';
        d.style.zIndex = dist === 0 ? '3' : (vis ? '2' : '1');
        d.style.transform = 'translateY(calc(-50% + ' + y + 'px)) scale(' + sc + ')';
      }

      const ic = d.querySelector('.slot-icon');
      if (ic) drawWeaponSlotIcon(ic, w.id, active, owned);
    });
  }

  let faceKey = '';
  function drawFace() {
    const lvl = P.hp > 133 ? 0 : P.hp > 66 ? 1 : P.hp > 30 ? 2 : 3;
    const stain = window.BloodStain ? BloodStain.getBodyBlood() : 0;
    const stainLvl = stain < 0.12 ? 0 : stain < 0.32 ? 1 : stain < 0.58 ? 2 : stain < 0.82 ? 3 : 4;
    const fm = P.faithMode > 0 ? 1 : 0;
    const fmPulse = fm ? (Math.floor(S.time * 6) % 2) : 0;
    const evil = (S.glory || S.grin > 0) ? 1 : 0;
    const effort = (!evil && (P.swingT > 0 || P.kickT > 0 || P.slamming)) ? 1 : 0;
    const hurt = P.hurtFlash > 0.25 ? 1 : 0;
    let glance = 0;
    if (!evil && !effort && !hurt && !P.dead) {
      const gIdx = Math.floor(S.time / 0.9) % 4;
      glance = gIdx === 1 ? -1 : (gIdx === 3 ? 1 : 0);
    }
    const key = lvl + '' + stainLvl + fm + fmPulse + evil + effort + hurt + glance + (P.dead ? 'd' : '');
    if (key === faceKey) return;
    faceKey = key;

    const c = el('face').getContext('2d');
    c.clearRect(0, 0, 32, 32);

    // Fundo + Auréola Dourada na Super-Fé
    if (fm) {
      c.fillStyle = '#3d2404'; c.fillRect(0, 0, 32, 32);
      c.fillStyle = fmPulse ? '#7a4e08' : '#633e06'; c.fillRect(2, 2, 28, 28);
      c.fillStyle = fmPulse ? '#b87c10' : '#96620c'; c.fillRect(4, 3, 24, 24);
      // Raios da auréola
      c.fillStyle = '#ffd84a';
      c.fillRect(15, 0, 2, 4); c.fillRect(1, 13, 4, 2); c.fillRect(27, 13, 4, 2);
      c.fillRect(4, 3, 2, 2); c.fillRect(26, 3, 2, 2);
      // Anel da auréola atrás da cabeça
      c.fillStyle = fmPulse ? '#fff49c' : '#ffe052';
      c.fillRect(6, 2, 20, 2);
      c.fillRect(4, 4, 3, 14); c.fillRect(25, 4, 3, 14);
      c.fillRect(5, 3, 2, 2); c.fillRect(25, 3, 2, 2);
    } else {
      c.fillStyle = '#240808'; c.fillRect(0, 0, 32, 32);
    }

    // Cauda do Mullet anos 80 atrás do pescoço e ombros
    c.fillStyle = '#160b05';
    c.fillRect(4, 14, 4, 18); c.fillRect(24, 14, 4, 18);
    c.fillRect(3, 21, 5, 11); c.fillRect(24, 21, 5, 11);
    c.fillStyle = '#2e1a0d';
    c.fillRect(5, 18, 2, 13); c.fillRect(25, 18, 2, 13);
    c.fillRect(2, 26, 3, 6); c.fillRect(27, 26, 3, 6);

    // Pescoço / ombros
    c.fillStyle = '#442816'; c.fillRect(10, 27, 12, 5);
    c.fillStyle = '#2e160a'; c.fillRect(6, 29, 20, 3);

    // Cabeça e rosto
    c.fillStyle = '#5a3820';
    c.fillRect(7, 5, 18, 22);
    c.fillRect(6, 9, 20, 14);
    c.fillRect(9, 26, 14, 2);
    // Orelhas
    c.fillStyle = '#4a2c18';
    c.fillRect(4, 12, 2, 7); c.fillRect(26, 12, 2, 7);
    // Cabelo Mullet (topete volumoso + costeletas)
    c.fillStyle = '#1f1008';
    c.fillRect(7, 3, 18, 5);
    c.fillRect(9, 2, 14, 2);
    c.fillRect(6, 5, 2, 10); c.fillRect(24, 5, 2, 10);
    c.fillStyle = '#382112';
    c.fillRect(10, 3, 6, 2); c.fillRect(17, 4, 6, 2);
    // Iluminação da testa
    c.fillStyle = '#6e4628';
    c.fillRect(8, 8, 16, 3);

    // Sobrancelhas (variam por expressão)
    c.fillStyle = '#1a0c06';
    if (evil) {
      // Cara de mau (V bem inclinado)
      c.fillRect(8, 10, 3, 1); c.fillRect(10, 11, 3, 2); c.fillRect(13, 12, 2, 1);
      c.fillRect(21, 10, 3, 1); c.fillRect(19, 11, 3, 2); c.fillRect(17, 12, 2, 1);
    } else if (effort) {
      // Esforço (franzido tenso)
      c.fillRect(8, 11, 6, 2); c.fillRect(18, 11, 6, 2);
      c.fillRect(14, 12, 4, 1);
    } else {
      c.fillRect(8, 11, 6, 1); c.fillRect(9, 12, 5, 1);
      c.fillRect(18, 11, 6, 1); c.fillRect(18, 12, 5, 1);
    }

    // Nariz
    c.fillStyle = '#3c2010';
    c.fillRect(15, 15, 2, 5);
    c.fillRect(14, 19, 4, 2);

    // Boca (variando por estado)
    c.fillStyle = '#1a0806';
    if (evil) {
      // Sorriso maligno estilo Doom
      c.fillRect(9, 22, 14, 4);
      c.fillRect(8, 21, 2, 2); c.fillRect(22, 21, 2, 2);
      c.fillStyle = '#f2e8d0';
      c.fillRect(10, 22, 12, 2);
      c.fillStyle = '#8a1414';
      c.fillRect(10, 24, 12, 1);
    } else if (effort) {
      // Dentes cerrados de esforço
      c.fillRect(10, 22, 12, 3);
      c.fillStyle = '#f0e6d0';
      c.fillRect(11, 23, 10, 1);
      c.fillStyle = '#3a1a10';
      c.fillRect(13, 23, 1, 1); c.fillRect(16, 23, 1, 1); c.fillRect(19, 23, 1, 1);
    } else if (hurt) {
      // Boca aberta de dor
      c.fillRect(11, 22, 10, 4);
      c.fillStyle = '#f0e6d0'; c.fillRect(12, 22, 8, 1);
    } else {
      c.fillRect(11, 23, 10, 2);
      c.fillStyle = '#6e4628'; c.fillRect(12, 23, 8, 1);
    }

    // Ferimentos por HP (lvl)
    c.fillStyle = '#a01010';
    if (lvl >= 1) { c.fillRect(8, 8, 1, 5); c.fillRect(9, 11, 1, 2); }
    if (lvl >= 2) { c.fillRect(22, 7, 2, 6); c.fillRect(16, 25, 4, 2); c.fillRect(7, 16, 2, 4); }
    if (lvl >= 3) { c.fillRect(10, 6, 10, 2); c.fillRect(6, 19, 3, 6); c.fillRect(23, 18, 3, 6); c.fillStyle = '#600808'; c.fillRect(12, 16, 2, 4); }

    // Manchas de sangue
    if (stainLvl >= 1) { c.fillStyle = '#8e0c10'; c.fillRect(8, 17, 3, 2); c.fillRect(20, 9, 2, 2); }
    if (stainLvl >= 2) { c.fillStyle = '#a01014'; c.fillRect(19, 17, 4, 3); c.fillRect(11, 7, 2, 3); c.fillRect(7, 21, 2, 3); }
    if (stainLvl >= 3) { c.fillStyle = '#74080c'; c.fillRect(7, 9, 3, 2); c.fillRect(13, 25, 5, 3); c.fillRect(21, 20, 3, 4); }
    if (stainLvl >= 4) { c.fillStyle = '#5a0408'; c.fillRect(8, 6, 13, 2); c.fillRect(6, 14, 2, 7); c.fillRect(23, 13, 2, 6); c.fillRect(11, 20, 3, 2); }

    // Olhos (sempre limpos de sangue)
    const eyeCol = fm ? '#ffe060' : '#f0e6d0';
    if (effort) {
      // Olhos cerrados / apertados de esforço
      c.fillStyle = '#1a0c06';
      c.fillRect(9, 14, 5, 2); c.fillRect(18, 14, 5, 2);
      c.fillStyle = eyeCol;
      c.fillRect(10, 14, 3, 1); c.fillRect(19, 14, 3, 1);
    } else {
      c.fillStyle = eyeCol;
      if (lvl >= 2 && !evil) {
        c.fillRect(18, 13, 5, 3);
        c.fillStyle = '#1a0c06'; c.fillRect(9, 14, 5, 2);
      } else {
        c.fillRect(9, 13, 5, evil ? 2 : 3);
        c.fillRect(18, 13, 5, evil ? 2 : 3);
      }
      // Pupilas olhando pros lados (glance: -1, 0, +1)
      c.fillStyle = evil ? '#b80000' : '#000';
      const pOff = glance === -1 ? 0 : (glance === 1 ? 3 : 1);
      if (lvl < 2 || evil) c.fillRect(9 + pOff, 13, 2, evil ? 2 : 3);
      c.fillRect(18 + pOff, 13, 2, evil ? 2 : 3);
    }

    if (P.dead) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, 32, 32); }
  }

  const rctx = el('radar').getContext('2d');
  function drawRadar() {
    const c = rctx, R = 60, range = 46, sc = (R - 4) / range;
    c.clearRect(0, 0, 120, 120);
    c.strokeStyle = 'rgba(255,160,60,.25)'; c.lineWidth = 1;
    c.beginPath(); c.arc(R, R, (R - 4) / 2, 0, 6.3); c.stroke();
    c.beginPath(); c.moveTo(R, 4); c.lineTo(R, 116); c.moveTo(4, R); c.lineTo(116, R); c.stroke();
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    const proj = (wx, wz) => {
      const dx = wx - P.pos.x, dz = wz - P.pos.z;
      return [dx * cy - dz * sy, -(dx * (-sy) + dz * (-cy))];
    };
    for (const e of enemies) {
      if (e.dead || !e.inRender) continue;
      const q = proj(e.g.position.x, e.g.position.z);
      const px = q[0], py = q[1];
      if (Math.hypot(px, py) > range) continue;
      c.fillStyle = e.T.boss ? '#ff8a00' : (e.aggro ? '#ff2a2a' : '#a02020');
      const sz = e.T.boss ? 6 : 3;
      c.fillRect(R + px * sc - sz / 2, R + py * sc - sz / 2, sz, sz);
    }
    for (const p of peasants) {
      if (p.dead || !p.inRender) continue;
      const q = proj(p.g.position.x, p.g.position.z);
      if (Math.hypot(q[0], q[1]) > range) continue;
      c.fillStyle = p.beingChased ? '#90ff50' : '#30e870';
      c.fillRect(R + q[0] * sc - 2, R + q[1] * sc - 2, 4, 4);
    }
    for (const p of pickups) {
      if (p.k !== 'weapon' || !p.inRender) continue;
      const q = proj(p.x, p.z);
      if (Math.hypot(q[0], q[1]) > range) continue;
      c.fillStyle = '#ffd24a'; c.fillRect(R + q[0] * sc - 2, R + q[1] * sc - 2, 4, 4);
    }
    if (S.objPos) {
      const q = proj(S.objPos.x, S.objPos.z);
      let d = Math.hypot(q[0], q[1]), k = 1;
      if (d > range) k = range / d;
      const ox = R + q[0] * k * sc, oy = R + q[1] * k * sc;
      c.fillStyle = '#ffee40'; c.beginPath(); c.moveTo(ox, oy - 5); c.lineTo(ox + 4, oy); c.lineTo(ox, oy + 5); c.lineTo(ox - 4, oy); c.closePath(); c.fill();
    }
    c.fillStyle = '#6ad0ff'; c.beginPath(); c.moveTo(R, R - 5); c.lineTo(R + 4, R + 4); c.lineTo(R - 4, R + 4); c.closePath(); c.fill();
  }

  function rankOf(v) {
    if (v > 300) return 'SUPER-FÉ!!';
    if (v > 220) return 'SANTO MARRETEIRO';
    if (v > 140) return 'EXORCISTA DE OBRA';
    if (v > 75) return 'OPERÁRIO DA FÉ';
    if (v > 20) return 'PECADOR';
    return '—';
  }

  const navScene = new THREE.Scene();
  const navCam = new THREE.PerspectiveCamera(38, innerWidth / Math.max(1, innerHeight), 0.1, 20);
  navCam.position.set(0, 0, 5);
  navScene.add(new THREE.AmbientLight(0x402020, 0.65));
  const _navKey = new THREE.DirectionalLight(0xffffff, 1.35);
  _navKey.position.set(-2.5, 4, 3.5);
  navScene.add(_navKey);
  const _navFill = new THREE.DirectionalLight(0xffccaa, 0.55);
  _navFill.position.set(3, -3, 2);
  navScene.add(_navFill);

  const navArrowPivot = new THREE.Group();
  navArrowPivot.position.set(0, 1.32, 0);
  navArrowPivot.rotation.x = 0.08;
  navArrowPivot.scale.setScalar(0.38);
  navArrowPivot.visible = false;
  navScene.add(navArrowPivot);

  const navArrowSpin = new THREE.Group();
  navArrowPivot.add(navArrowSpin);

  // Seta estilo Crazy Taxi: bloco 3D espesso, pontudo e flat-shaded
  const _arrowShape = new THREE.Shape();
  _arrowShape.moveTo(0, 0.85);
  _arrowShape.lineTo(0.62, 0.08);
  _arrowShape.lineTo(0.24, 0.08);
  _arrowShape.lineTo(0.24, -0.78);
  _arrowShape.lineTo(0.14, -0.88);
  _arrowShape.lineTo(-0.14, -0.88);
  _arrowShape.lineTo(-0.24, -0.78);
  _arrowShape.lineTo(-0.24, 0.08);
  _arrowShape.lineTo(-0.62, 0.08);
  _arrowShape.closePath();

  const _arrowCoreGeo = new THREE.ExtrudeGeometry(_arrowShape, {
    depth: 0.36,
    bevelEnabled: false
  });
  _arrowCoreGeo.center();
  // Deita no plano XZ apontando para -Z (para dentro da tela)
  _arrowCoreGeo.rotateX(-Math.PI / 2);

  const _navColRed = new THREE.Color(0xff1e1e);
  const _navEmRed = new THREE.Color(0x3a0000);
  const _navColYellow = new THREE.Color(0xffe01a);
  const _navEmYellow = new THREE.Color(0x4a3800);

  const navArrowMat = new THREE.MeshPhongMaterial({
    color: _navColRed.clone(),
    emissive: _navEmRed.clone(),
    specular: 0x333333,
    shininess: 18,
    flatShading: true
  });
  const _navCoreMesh = new THREE.Mesh(_arrowCoreGeo, navArrowMat);
  navArrowSpin.add(_navCoreMesh);

  let _navAngle = 0;
  function updateNavArrow(dt) {
    if (!S.started || P.dead || S.ended || S.cutscene > 0) {
      navArrowPivot.visible = false;
      return;
    }
    if (S.boss && enemies.includes(S.boss) && !S.boss.dead) {
      navArrowPivot.visible = false;
      return;
    }
    let aliveCount = 0;
    let hasBoss = false;
    let nearestDistSq = Infinity;
    let tx = 0, tz = 0;
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.T && e.T.boss) { hasBoss = true; break; }
      aliveCount++;
      const ex = e.inRender ? e.g.position.x : e.savedPos.x;
      const ez = e.inRender ? e.g.position.z : e.savedPos.z;
      const dx = ex - P.pos.x, dz = ez - P.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < nearestDistSq) {
        nearestDistSq = d2;
        tx = ex;
        tz = ez;
      }
    }
    if (hasBoss) {
      navArrowPivot.visible = false;
      return;
    }
    let hasTarget = false;
    let isObjective = false;
    if (aliveCount > 0 && aliveCount < 10) {
      hasTarget = true;
    } else if (aliveCount === 0) {
      const dest = S.objPos || (World.exitGate ? { x: World.exitGate.x, z: World.exitGate.z } : null);
      if (dest) {
        tx = dest.x;
        tz = dest.z;
        hasTarget = true;
        isObjective = true;
      }
    }
    if (!hasTarget) {
      navArrowPivot.visible = false;
      return;
    }
    navArrowPivot.visible = true;
    const dx = tx - P.pos.x, dz = tz - P.pos.z;
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    const px = dx * cy - dz * sy;
    const py = -(dx * (-sy) + dz * (-cy));
    const targetAngle = -Math.atan2(px, -py);
    let diff = targetAngle - _navAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    _navAngle += diff * Math.min(1, (dt || 0.016) * 14);
    navArrowSpin.rotation.y = _navAngle;
    navArrowPivot.position.y = 1.32 + Math.sin(S.time * 4) * 0.02;

    if (isObjective) {
      const k = 0.5 + 0.5 * Math.sin(S.time * 3.6);
      navArrowMat.color.copy(_navColRed).lerp(_navColYellow, k);
      navArrowMat.emissive.copy(_navEmRed).lerp(_navEmYellow, k);
    } else {
      navArrowMat.color.copy(_navColRed);
      navArrowMat.emissive.copy(_navEmRed);
    }
  }

  function updateHUD(dt) {
    const hideCrosshair = !!S.glory || S.cutscene > 0;
    show('crosshair', !hideCrosshair && !P.dead && S.started && !S.paused);
    const w = WEAPONS[curW()];
    setText('hpNum', Math.ceil(P.hp));
    el('hpNum').style.color = P.hp < 50 ? '#ff3030' : '#ff5a4a';
    setText('armorNum', Math.ceil(P.armor || 0));
    setW('faithFill', P.faith);
    const faithKeyName = formatKeyName((SAVE.binds && SAVE.binds.faith) || DEFAULT_BINDS.faith);
    setText('faithTxt', P.faithMode > 0 ? 'SUPER-FÉ!' : (P.faith >= 100 ? '[' + faithKeyName + '] PRONTA' : Math.floor(P.faith) + '%'));
    setW('dashFill', (1 - clamp(P.dashCd / 1.1, 0, 1)) * 100);
    setText('weaponName', w.name);
    let am = '∞', al = 'ESQ: COMBO 5 SOCOS';
    if (w.id === 'hammer') { al = 'DIR: ARREMESSAR TIJOLO'; }
    else if (w.id === 'sling') { am = P.rocks; al = 'PEDRAS · DIR: PEDRADA (3)'; }
    else if (w.id === 'scythe') { al = 'DIR: CEIFA PUXÃO (+SANGUE)'; }
    else if (w.id === 'demo') { al = 'DIR: ONDA SÍSMICA'; }
    else if (w.id === 'cross') { am = S.cross.state === 'held' ? 'PRONTA' : 'NO AR'; al = 'DIR: GOLPE / RECALL'; }
    else if (w.id === 'heart') { am = Math.floor(P.blood); al = 'SANGUE · DIR: RAJADA (15)'; }
    setText('ammoNum', am); setText('ammoLabel', al);
    el('ammoNum').style.fontSize = (typeof am === 'string' && am.length > 2) ? '24px' : '38px';
    el('ammoNum').style.color = S.ammoFlash > 0 ? '#ff3030' : '#ffd24a';
    setText('killCount', S.kills);
    const m = Math.floor(S.time / 60), sec = Math.floor(S.time % 60);
    setText('timeCount', String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0'));
    setText('styleRank', rankOf(S.style));
    setW('styleFill', clamp(S.style / 300, 0, 1) * 100);
    updateNavArrow(dt);
    // chefe
    const b = S.boss;
    const bossOn = !!(b && enemies.includes(b) && !b.dead && !b.galiusIntro && !b.maximusIntro && !(S.cutscene > 0 && (S.csKind === 'maximusIntro' || S.csKind === 'galiusIntro')));
    el('hud').classList.toggle('boss-active', bossOn);
    if (bossOn) {
      show('bossbar', true);
      setText('bossName', b.T.name);
      setW('bossFill', clamp(b.hp / b.maxhp, 0, 1) * 100);
    } else show('bossbar', false);
    // overlays
    const flashK = SAVE.screenFlash != null ? SAVE.screenFlash : 1;
    const hpRatio = clamp(P.hp / P.maxhp, 0, 1);
    const missing = 1 - hpRatio;
    const critPulse = P.hp < 50 && !P.dead ? Math.sin(S.time * 6) * 0.08 * ((50 - P.hp) / 50) : 0;
    const low = P.dead ? 0.85 : (missing > 0 ? Math.pow(missing, 1.25) * 0.78 + critPulse : 0);
    el('damage').style.opacity = clamp(low + P.hurtFlash * flashK, 0, 1);
    el('healFlash').style.opacity = clamp((P.healFlash || 0) * flashK, 0, 1);
    el('faithTint').style.opacity = P.faithMode > 0 ? (0.7 + Math.sin(S.time * 10) * 0.15) * flashK : 0;
    if (S.slotsT > 0) S.slotsT = Math.max(0, S.slotsT - dt);
    el('slots').classList.toggle('faded', !(S.slotsT > 0));
    el('hitmarker').classList.toggle('on', !!SAVE.showHitmarker && S.hitMark > 0);
    if (S.msgT <= 0) show('msg', false);
    if (S.baphT <= 0) show('baph', false);
    if (S.prompt) {
      show('prompt', true);
      setText('prompt', S.prompt);
      el('prompt').classList.toggle('glory-prompt', !!S.gloryPrompt);
    } else {
      show('prompt', false);
      el('prompt').classList.remove('glory-prompt');
    }
    show('faceWrap', SAVE.showFace !== false);
    el('faceWrap').classList.toggle('faith-active', P.faithMode > 0);
    show('radar', SAVE.showRadar !== false);
    show('styleBox', SAVE.showStyle !== false);
    if (SAVE.showFace !== false) drawFace();
    if (SAVE.showRadar !== false) drawRadar();
    A.updatePeasantLabels();
  }

  /* ---------------- salas / história ---------------- */
  const ROOMS = {
    a1: { name: 'EP. 1 · ÁREA 1 · BAIRRO ALTO', obj: 'Elimine todos os demônios do Bairro Alto', track: 'ep1_a1',
      onClear() {
        unlockExitGate(); SFX.play('gate');
        say('Bairro Alto purificado! Atravesse o Portão de Saída!', 'NIVALDO', 4.5);
        setObj('Atravesse o Portão de Saída para os Campos da Perdição', { x: World.exitGate.x, z: World.exitGate.z });
        S.stage = 'a1done';
      } },
    a2: { name: 'EP. 1 · ÁREA 2 · CAMPOS DA PERDIÇÃO', obj: 'Limpe os campos e celeiros em chamas', track: 'ep1_a2',
      onClear() {
        unlockExitGate(); SFX.play('gate');
        say('Campos purificados! O Portão para o Subúrbio Exterior está aberto!', 'NIVALDO', 4.5);
        setObj('Atravesse o Portão de Saída para o Subúrbio Exterior', { x: World.exitGate.x, z: World.exitGate.z });
        S.stage = 'a2done';
      } },
    a3: { name: 'EP. 1 · ÁREA 3 · SUBÚRBIO EXTERIOR', obj: 'Elimine os demônios e guardas do Subúrbio', track: 'ep1_a3',
      onClear() {
        unlockExitGate(); SFX.play('gate');
        say('Episódio 1 concluído! Atravesse o Portão rumo à Cidade Baixa!', 'NIVALDO', 4.5);
        setObj('Atravesse o Portão de Saída para os Casarões dos Super-Ricos', { x: World.exitGate.x, z: World.exitGate.z });
        S.stage = 'a3done';
      } },
    a4: { name: 'EP. 2 · ÁREA 4 · CASARÕES DOS SUPER-RICOS', obj: 'Elimine os demônios das mansões em chamas', track: 'ep2_a1',
      onClear() {
        unlockExitGate(); SFX.play('gate');
        say('Mansões purificadas! O Portão para a Avenida do Horror se abriu!', 'NIVALDO', 4.5);
        setObj('Atravesse o Portão de Saída para a Avenida do Horror', { x: World.exitGate.x, z: World.exitGate.z });
        S.stage = 'a4done';
      } },
    a5: { name: 'EP. 2 · ÁREA 5 · AVENIDA DO HORROR', obj: 'Rompa os ninhos infernais rumo à Ultra-Igreja', track: 'ep2_a2',
      onClear() {
        unlockExitGate(); SFX.play('gate');
        say('Episódio 2 concluído! A Ultra-Igreja aguarda além do Portão!', 'NIVALDO', 4.5);
        setObj('Atravesse o Portão de Saída para os Portões da Ultra-Igreja', { x: World.exitGate.x, z: World.exitGate.z });
        S.stage = 'a5done';
      } },
    a6_gate: { name: 'EP. 3 · ÁREA 6 · PORTÕES DA ULTRA-IGREJA', obj: 'Elimine todos os inimigos nos portões', track: 'ep3_gate', onClear: spawnMaximus },
    a6_maximus: { name: 'EP. 3 · ÁREA 6 · PORTÕES DA ULTRA-IGREJA', obj: 'Derrote SÉRGIO MAXIMO, Líder da Super-Guarda Real', track: 'ep3_maximus', noCount: true, onClear: maximusDead },
    a6_nave: { name: 'EP. 3 · ÁREA 6 · A ULTRA-IGREJA', obj: 'Esmigalhe os demônios da Ultra-Igreja', track: 'ep3_nave', onClear: galiusEvent },
    a6_galius1: { name: 'EP. 3 · ÁREA 6 · A ULTRA-IGREJA', obj: 'Enfrente Galius, o Super-Ateu!', track: 'ep3_galius', noCount: true, noClear: true },
    a6_crypt1: { name: 'EP. 3 · CATACUMBAS · ENTRADA', obj: 'Elimine os endemoniados das catacumbas', track: 'ep3_crypt',
      onClear() { openGate('g_c1'); SFX.play('gate'); setObj('Avance para o Salão dos Mortos', { x: 58, z: -14 }); } },
    a6_crypt2: { name: 'EP. 3 · CATACUMBAS · SALÃO DOS MORTOS', obj: 'Elimine os guardiões do Salão dos Mortos', track: 'ep3_crypt',
      onClear() { openGate('g_c2'); SFX.play('gate'); setObj('Avance para a Galeria dos Ossos', { x: 58, z: -76 }); } },
    a6_crypt3: { name: 'EP. 3 · CATACUMBAS · GALERIA DOS OSSOS', obj: 'Elimine os horrores da Galeria dos Ossos', track: 'ep3_crypt',
      onClear() { openGate('g_c3'); SFX.play('gate'); setObj('Chegue à Câmara Sacra', { x: -4, z: -86 }); } },
    a6_galius2: { name: 'EP. 3 · ÁREA 6 · A ULTRA-IGREJA', obj: 'Derrote Galius com a Sacra Cruz Papal', track: 'ep3_galius', noCount: true, noClear: true }
  };
  for (const id in ROOMS) S.rooms[id] = { spawned: false, cleared: false };

  function startRoom(id, silent) {
    const r = S.rooms[id];
    r.spawned = true; r.cleared = false;
    if (ROOMS[id] && ROOMS[id].track && SFX.setTrack) SFX.setTrack(ROOMS[id].track);
    const list = SPAWNS[id] || [];
    const spawnMul = A.getDifficulty().spawnMul;
    const bosses = [];
    const regulars = [];
    for (const sp of list) {
      const T = A.ETYPES[sp[0]];
      if (T && T.boss) bosses.push(sp);
      else regulars.push(sp);
    }
    const toSpawn = [];
    for (const sp of bosses) toSpawn.push({ sp, copyIdx: 0 });
    if (regulars.length > 0) {
      let acc = 0;
      for (let i = 0; i < regulars.length; i++) {
        acc += spawnMul;
        const count = Math.floor(acc + 1e-9);
        acc -= count;
        for (let k = 0; k < count; k++) {
          toSpawn.push({ sp: regulars[i], copyIdx: k });
        }
      }
      if (toSpawn.length === bosses.length) {
        toSpawn.push({ sp: regulars[0], copyIdx: 0 });
      }
    }
    const tmpPos = new V3();
    for (let i = 0; i < toSpawn.length; i++) {
      const { sp, copyIdx } = toSpawn[i];
      let sx = sp[1], sz = sp[2];
      if (copyIdx > 0) {
        const T = A.ETYPES[sp[0]];
        const ang = copyIdx * 2.39996 + i * 0.7;
        const rad = 1.5 + 0.35 * ((copyIdx - 1) % 3);
        tmpPos.set(sx + Math.cos(ang) * rad, 0, sz + Math.sin(ang) * rad);
        resolveCircle(tmpPos, Math.max(0.8, (T && T.r) || 0.8));
        sx = tmpPos.x;
        sz = tmpPos.z;
      }
      const e = A.spawnEnemy(sp[0], sx, sz, id, sp[3]);
      if (e.T.boss) S.boss = e;
      if (!ROOMS[id].noCount) S.levelTotal = (S.levelTotal || 0) + 1;
    }
    S.objRoom = id;
    if (!silent) setObj(ROOMS[id].obj, null);
    else setObj(ROOMS[id].obj, S.objPos);
  }
  function loadMap(mapId, opts) {
    opts = opts || {};
    releaseGrab();
    for (const e of enemies.slice()) A.removeEnemy(e);
    A.clearProjs(); A.clearParts();
    S.boss = null;
    S.galiusCrossPlanted = false; S.galiusMeatPos = null;
    if (S.corpse) { scene.remove(S.corpse); S.corpse = null; }
    if (S.maximusSpirit) { scene.remove(S.maximusSpirit); S.maximusSpirit = null; }
    S.maximusRig = null; S.maximusCorpse = null;
    for (const id in S.rooms) S.rooms[id] = { spawned: false, cleared: false };
    const sx = opts.x != null ? opts.x : 0;
    const sz = opts.z != null ? opts.z : 10;
    World.viewerX = sx;
    World.viewerZ = sz;
    buildMap(mapId);
    World.updateChunks(sx, sz, true);
    spawnMapPickups(mapId);
    A.spawnMapPeasants(mapId);
    if (!opts.keepPlayer) {
      P.hasRosary = false; P.maxhp = 200;
      P.hp = P.maxhp; P.faith = 0; P.faithMode = 0; P.rocks = 0; P.blood = 0;
      WEAPONS.forEach((w, i) => w.owned = i < 2);
      updateSlots(); selectWeapon(0, true);
    }
    S.levelKills = 0;
    S.levelTotal = 0;
    S.levelTime = 0;
    S.levelPeakStyle = 0;
    P.pos.set(sx, getGroundY(sx, sz), sz); P.vel.set(0, 0, 0); P.yaw = opts.yaw || 0; P.pitch = 0;
    resetCamera();
    const firstRoom = opts.room || (mapId === 'a6_crypt' ? 'a6_crypt1' : mapId);
    if (ROOMS[firstRoom]) startRoom(firstRoom);
    A.syncRenderDistanceEntities();
    setCheckpoint(sx, sz, P.yaw);
  }
  let pendingNextMap = null;
  function showLevelComplete(fromMap, nextMap, nextLabel) {
    S.intermission = true;
    pendingNextMap = nextMap;
    if (document.exitPointerLock) document.exitPointerLock();
    SFX.play('boom');
    setTimeout(() => SFX.play('portal'), 180);
    const total = Math.max(1, S.levelTotal || 1);
    const kills = Math.min(total, S.levelKills || 0);
    const kPct = Math.round((kills / total) * 100);
    const peak = Math.max(S.levelPeakStyle || 0, S.style || 0);
    const sPct = Math.min(100, Math.round((peak / 240) * 100));
    const t = S.levelTime || 0;
    const m = Math.floor(t / 60), sec = Math.floor(t % 60);
    const rk = rankOf(peak);
    const rInfo = ROOMS[fromMap];
    setText('lcEyebrow', 'NÍVEL CONCLUÍDO');
    setText('lcTitle', rInfo ? rInfo.name : fromMap.toUpperCase());
    setText('lcKills', kills + ' / ' + total + ' (' + kPct + '%)');
    setText('lcStyle', sPct + '%');
    setText('lcTime', String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0'));
    setText('lcRank', rk);
    setText('lcNextBtn', '▶ AVANÇAR PARA ' + nextLabel + ' [ESPAÇO]');
    show('levelComplete', true);
  }
  function finishLevelComplete(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    if (!S.intermission || !pendingNextMap) return;
    const next = pendingNextMap;
    pendingNextMap = null;
    S.intermission = false;
    S.paused = false;
    show('pause', false);
    show('levelComplete', false);
    if (!nolock) requestLock();
    fade('#000', 0.25, () => {
      loadMap(next, { keepPlayer: true });
      const rInfo = ROOMS[next];
      if (rInfo) say(rInfo.name + ' — ' + rInfo.obj, 'NIVALDO', 4.5);
    }, 0.4);
  }
  if (el('lcNextBtn')) el('lcNextBtn').addEventListener('click', finishLevelComplete);
  function setCheckpoint(x, z, yaw) {
    S.checkpoint = { x, z, yaw: yaw || 0 };
    if (S.started && !S.ended) {
      SAVE.savedGame = {
        x, z, yaw: yaw || 0,
        stage: S.stage,
        objRoom: S.objRoom || 'a1',
        areaLabel: (S.objRoom && ROOMS[S.objRoom]) ? ROOMS[S.objRoom].name : 'EP. 1 · ÁREA 1 · BAIRRO ALTO',
        kills: S.kills,
        time: S.time,
        hp: Math.max(80, Math.round(P.hp)),
        maxhp: P.maxhp || 200,
        hasRosary: !!P.hasRosary,
        faith: Math.round(P.faith),
        rocks: P.rocks,
        blood: P.blood,
        curW: curW(),
        owned: WEAPONS.map(w => !!w.owned),
        cleared: Object.keys(S.rooms).filter(k => S.rooms[k].cleared),
        difficulty: S.difficulty,
        ts: Date.now()
      };
      writeSave();
    }
  }

  function checkRooms() {
    for (const id in S.rooms) {
      const r = S.rooms[id];
      if (!r.spawned || r.cleared || ROOMS[id].noClear) continue;
      const alive = A.aliveInRoom(id);
      if (alive === 0) {
        r.cleared = true;
        ROOMS[id].onClear();
      } else if (alive <= 3 && S.objRoom === id) {
        let nearest = null, bestD = 1e9;
        for (const e of enemies) {
          if (e.room === id && !e.dead) {
            e.aggro = true;
            const ex = e.savedPos ? e.savedPos.x : e.g.position.x;
            const ez = e.savedPos ? e.savedPos.z : e.g.position.z;
            const d = dist2(P.pos.x, P.pos.z, ex, ez);
            if (d < bestD) { bestD = d; nearest = { x: ex, z: ez }; }
          }
        }
        if (nearest) S.objPos = { x: nearest.x, z: nearest.z };
      }
    }
  }

  function setCinemaUI(active, mainTitle, subTitle, variant) {
    const hud = el('hud');
    const bars = el('cinemaBars');
    const card = el('bossTitleCard');
    if (hud) hud.classList.toggle('cinema', !!active);
    if (bars) bars.classList.toggle('on', !!active);
    if (card) {
      card.classList.toggle('galius', variant === 'galius');
      if (active && mainTitle) {
        setText('bossTitleMain', mainTitle);
        setText('bossTitleSub', subTitle || '');
        card.classList.add('on');
      } else {
        card.classList.remove('on');
      }
    }
  }

  function captureCutsceneCamStart() {
    const f = fwd3();
    S.csCamStart = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      tx: camera.position.x + f.x * 8,
      ty: camera.position.y + f.y * 8,
      tz: camera.position.z + f.z * 8
    };
  }

  function spawnMaximus() {
    startRoom('a6_maximus');
    const m = S.boss;
    // Posiciona Nivaldo numa distância limpa no pátio olhando para onde Máximo vai cair
    const dToM = dist2(P.pos.x, P.pos.z, 0, -148);
    if (dToM < 8.5 || P.pos.z < -150) {
      P.pos.x = clamp(P.pos.x, -5.5, 5.5);
      P.pos.z = -134.5;
      P.pos.y = A.groundAt(P.pos.x, P.pos.z, 4, P.r);
    }
    P.vel.set(0, 0, 0);
    P.yaw = Math.atan2(-(0 - P.pos.x), -(-148 - P.pos.z));
    P.pitch = 0;

    captureCutsceneCamStart();
    S.cutscene = 14.5;
    S.csKind = 'maximusIntro';
    S.csT = 0;
    S.csMaxStep = 0;
    S.cinemaBoss = m;
    setCinemaUI(true);
    if (m) {
      const gy = A.groundAt(0, -148, 4, m.r);
      m.g.position.set(0, gy + 36, -148);
      m.savedPos.copy(m.g.position);
      m.fallVel = -4;
      m.yaw = 0;
      m.savedYaw = 0;
      m.g.rotation.y = 0;
      m.aggro = false;
      m.maximusIntro = 'fall';
      m.maximusIntroT = 0;
      if (m.rig && m.rig.sword) m.rig.sword.visible = false;
      m.onMaximusReady = null;
      m.onMaximusDone = null;
    }
    setObj(ROOMS.a6_maximus.obj, { x: 0, z: -148 });
    setCheckpoint(0, -108, 0);
  }

  function maximusDead() {
    S.boss = null;
    S.stage = 'door';
    SFX.play('boom');
    const mc = S.maximusCorpse;
    let mx = 0, mz = -148;
    if (mc && mc.g) {
      mx = clamp(mc.g.position.x, -10, 10);
      mz = clamp(mc.g.position.z, -156, -132);
      const gy = A.groundAt(mx, mz, 4, 1.4);
      mc.g.position.set(mx, gy + 0.42, mz);
      mc.g.rotation.set(-Math.PI / 2, mc.yaw || 0, 0);
      if (mc.shadow) mc.shadow.visible = false;
      if (mc.rig && mc.rig.helmetGroup) mc.rig.helmetGroup.visible = false;
      if (mc.rig && mc.rig.flameHead) mc.rig.flameHead.visible = true;
      if (mc.rig && mc.rig.flames) mc.rig.flames.forEach(fm => fm.visible = false);
      if (mc.rig && mc.rig.sword) mc.rig.sword.visible = false;
      if (mc.rig && mc.rig.rosaryProp) mc.rig.rosaryProp.visible = true;
      S.corpse = mc.g;
      S.maximusRig = mc.rig;
    } else {
      const rig = BUILD.maximus();
      const gy = A.groundAt(mx, mz, 4, 1.4);
      rig.root.position.set(mx, gy + 0.42, mz);
      rig.root.rotation.set(-Math.PI / 2, 0, 0);
      if (rig.helmetGroup) rig.helmetGroup.visible = false;
      if (rig.flameHead) rig.flameHead.visible = true;
      if (rig.flames) rig.flames.forEach(fm => fm.visible = false);
      if (rig.sword) rig.sword.visible = false;
      if (rig.rosaryProp) rig.rosaryProp.visible = true;
      scene.add(rig.root);
      S.corpse = rig.root;
      S.maximusRig = rig;
    }
    S.maximusCorpse = null;
    S.maximusPos = { x: mx, y: A.groundAt(mx, mz, 4, 1.4), z: mz };

    // Espírito vermelho que sai do peito de Maximus
    const spirit = new THREE.Group();
    const spMat = new THREE.MeshBasicMaterial({ color: 0xff1e2d, transparent: true, opacity: 0.85, depthWrite: false });
    const spBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.45), spMat);
    const spHead = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), spMat);
    spHead.position.y = 1.0;
    spirit.add(spBody, spHead);
    spirit.position.set(mx, S.maximusPos.y + 0.8, mz);
    spirit.visible = false;
    scene.add(spirit);
    S.maximusSpirit = spirit;
    S.maximusSpiritMat = spMat;

    P.vel.set(0, 0, 0);
    P.pos.set(clamp(mx, -8, 8), A.groundAt(mx, mz + 5.2, 4, 0.6), mz + 5.2);
    P.yaw = 0; P.pitch = 0;
    captureCutsceneCamStart();
    setCinemaUI(true);
    S.cutscene = 13.5;
    S.csKind = 'maximusDeath';
    S.csT = 0;
    S.csMaxSaid = false;
    S.csMaxSaid2 = false;
    S.csRosaryGiven = false;
    S.csRageSaid = false;
    TP_CAM.angle = 0.72;
  }

  function updateCutscene(dt) {
    if (S.cutscene <= 0) return;
    S.cutscene -= dt; S.csT += dt;
    if (S.csKind === 'maximusPhaseTrans') {
      P.vel.set(0, 0, 0);
      if (S.cutscene <= 0.35) setCinemaUI(false);
      if (S.cutscene <= 0) {
        setCinemaUI(false);
        S.cinemaBoss = null;
        S.csCamStart = null;
      }
    } else if (S.csKind === 'maximusDeath') {
      updateRosaryPhysics(dt);
      const mp = S.maximusPos || { x: 0, y: 0, z: -148 };
      const standZ = mp.z + 2.4;
      const dx = mp.x - P.pos.x, dz = mp.z - P.pos.z;
      P.yaw = A.lerpAngle(P.yaw, Math.atan2(-dx, -dz), Math.min(1, dt * 8));
      P.pitch += (0 - P.pitch) * Math.min(1, dt * 8);
      if (S.csT < 2.2) {
        const u = clamp(S.csT / 2.2, 0, 1);
        P.pos.x += (mp.x - P.pos.x) * Math.min(1, dt * 3.0);
        P.pos.z = mp.z + 5.2 - u * 2.8;
        P.pos.y = A.groundAt(P.pos.x, P.pos.z, 4, 0.6);
      } else {
        P.pos.x = mp.x;
        P.pos.z = standZ;
        P.pos.y = A.groundAt(P.pos.x, P.pos.z, 4, 0.6);
      }
      if (S.csT >= 1.8 && S.csT < 5.2 && S.maximusSpirit) {
        S.maximusSpirit.visible = true;
        const st = (S.csT - 1.8) / 3.4;
        S.maximusSpirit.position.set(mp.x + Math.sin(S.csT * 5) * 0.25, mp.y + 0.8 + st * 4.8, mp.z);
        S.maximusSpirit.rotation.y += dt * 2.4;
        if (S.maximusSpiritMat) S.maximusSpiritMat.opacity = st < 0.2 ? st * 4 : Math.max(0, (1 - st) * 1.1);
        if (Math.random() < dt * 10) burst(S.maximusSpirit.position.x, S.maximusSpirit.position.y, S.maximusSpirit.position.z, 0xff2230, 2, 3, 0.4, 0.14, 6);
      } else if (S.maximusSpirit && S.csT >= 5.2) {
        S.maximusSpirit.visible = false;
      }
      if (S.csT >= 3.6 && !S.csMaxSaid) {
        S.csMaxSaid = true;
        say('"Nivaldo... me perdoe... o mal de Satã me cegou..."', 'SÉRGIO MAXIMO', 2.8);
      }
      if (S.csT >= 6.2 && !S.csMaxSaid2) {
        S.csMaxSaid2 = true;
        say('"Ó Guerreiro Sagrado... pegue meu rosário... e destrua todo o Mal..."', 'SÉRGIO MAXIMO', 3.4);
      }
      if (S.maximusRig && S.maximusRig.armL && S.csT >= 7.2) {
        const offer = clamp((S.csT - 7.2) / 0.8, 0, 1);
        S.maximusRig.armL.rotation.x = -1.25 * offer;
      }
      if (S.csT >= 8.5 && S.maximusRig && S.maximusRig.rosaryProp && S.maximusRig.rosaryProp.visible) {
        S.maximusRig.rosaryProp.visible = false;
        SFX.play('pickup');
      }
      if (S.csT >= 10.2 && !S.csRosaryGiven) {
        S.csRosaryGiven = true;
        P.hasRosary = true;
        P.maxhp = 300;
        P.hp = 300;
        SFX.play('cross');
        burst(P.pos.x, P.pos.y + 1.8, P.pos.z, 0xffe066, 28, 10, 0.8, 0.28, 12);
      }
      if (S.csT >= 10.65 && !S.csRageSaid) {
        S.csRageSaid = true;
        SFX.play('roar');
        P.shake = Math.max(P.shake, 0.9);
        burst(P.pos.x, P.pos.y + 1.5, P.pos.z, 0xff2818, 24, 9, 0.6, 0.24, 10);
        say('ELES VÃO PAGAR POR ISSO... MALDITO INFERNO! EU VOU DESTRUIR TODOS VOCÊS!', 'NIVALDO', 3.2);
      }
      if (S.csT >= 10.7 && S.csT < 13.5) {
        P.shake = Math.max(P.shake, 0.34);
      }
      if (S.cutscene <= 0) {
        if (S.maximusSpirit) { scene.remove(S.maximusSpirit); S.maximusSpirit = null; }
        if (S.corpse) { scene.remove(S.corpse); S.corpse = null; }
        S.maximusRig = null;
        // Transiciona direto para Nivaldo socando a porta com MUITA IRA!
        S.csKind = 'door';
        S.cutscene = 4.5;
        S.csT = 0;
        S.csHit = false;
        S.csPunchIdx = -1;
        setObj('Arrombe a porta da Ultra-Igreja', { x: 0, z: -169 });
      }
    } else if (S.csKind === 'door') {
      updateRosaryPhysics(dt);
      P.yaw = A.lerpAngle(P.yaw, 0, Math.min(1, dt * 10));
      P.pitch += (0 - P.pitch) * Math.min(1, dt * 8);
      if (S.csT < 1.1) {
        P.pos.x += (0 - P.pos.x) * Math.min(1, dt * 5);
        P.pos.z += (-164.6 - P.pos.z) * Math.min(1, dt * 4.0);
        P.pos.y = A.groundAt(P.pos.x, P.pos.z, 4, 0.6);
      } else if (!S.csHit) {
        P.pos.x = 0;
        P.pos.z = -164.6;
        P.pos.y = A.groundAt(0, -164.6, 4, 0.6);
        const pt = (S.csT - 1.1) / 0.25;
        const idx = Math.floor(pt);
        const f = pt - idx;
        if (idx > (S.csPunchIdx == null ? -1 : S.csPunchIdx) && f >= 0.30 && idx < 10) {
          S.csPunchIdx = idx;
          SFX.play('slam');
          SFX.play('boom');
          P.shake = 1.55;
          burst((idx % 2 === 0 ? 0.6 : -0.6), 3.0, -168.4, 0xffaa40, 18, 12, 0.55, 0.25, 11);
          burst((idx % 2 === 0 ? 0.6 : -0.6), 3.0, -168.4, 0x6a5a4a, 14, 9, 0.65, 0.30, 11, false);
        }
        if (S.csT >= 3.65) {
          S.csHit = true;
          S.cutscene = 0.85;
          P.vel.set(0, 0, 2);
          openGate('door'); SFX.play('door'); SFX.play('boom'); SFX.play('slam');
          P.shake = 2.0;
          burst(0, 5, -169, 0x6a5a4a, 50, 18, 1.4, 0.55, 16, false);
          burst(0, 5, -169, 0xffa040, 26, 15, 0.8, 0.30, 12);
          say('ABRAM CAMINHO! A ULTRA-IGREJA VAI CAIR HOJE!', 'NIVALDO', 3.2);
          setObj('Entre na Ultra-Igreja', { x: 0, z: -176 });
        }
      } else {
        P.vel.x *= 0.85; P.vel.z *= 0.85;
        if (S.cutscene <= 0.35) setCinemaUI(false);
      }
      if (S.cutscene <= 0) setCinemaUI(false);
    } else if (S.csKind === 'rip') {
      P.vel.set(0, 0, 0);
      if (S.ripStandPos) {
        P.pos.lerp(S.ripStandPos, Math.min(1, dt * 12));
      }
      if (S.ripYaw != null) {
        P.yaw = A.lerpAngle(P.yaw, S.ripYaw, Math.min(1, dt * 12));
      }
      if (S.ripTarget && !S.ripTarget.dead) {
        const g = S.ripTarget;
        g.g.position.y += ((P.pos.y - 2.3) - g.g.position.y) * Math.min(1, dt * 10);
        if (S.ripTargetYaw != null) {
          g.yaw = A.lerpAngle(g.yaw, S.ripTargetYaw, Math.min(1, dt * 12));
          g.savedYaw = g.yaw;
          g.g.rotation.y = g.yaw;
        }
        if (g.ripRecoil > 0) {
          g.ripRecoil = Math.max(0, g.ripRecoil - dt * 3.2);
          const dir = g.ripHitDir || 1;
          const r = g.ripRecoil;
          g.g.rotation.z = dir * r * 0.34;
          g.g.rotation.x = r * 0.24;
          g.g.scale.set(1 + r * 0.14, 1 - r * 0.16, 1 + r * 0.14);
        } else {
          const def = g.ripDeform || 0;
          g.g.rotation.z = def === 1 ? 0.12 : def >= 2 ? -0.18 : 0;
          g.g.rotation.x = def * 0.10;
          g.g.scale.set(1 + def * 0.05, 1 - def * 0.06, 1 + def * 0.05);
        }
        if (g.danglingEyes) {
          for (let i = 0; i < g.danglingEyes.length; i++) {
            const de = g.danglingEyes[i];
            de.pivot.rotation.z = Math.sin(S.csT * 12 + de.phase) * (0.2 + (g.ripRecoil || 0) * 0.5);
          }
        }
        if (g.gutsList) {
          for (let i = 0; i < g.gutsList.length; i++) {
            const gl = g.gutsList[i];
            gl.pivot.rotation.z = Math.sin(S.csT * 9 + gl.phase) * (0.15 + (g.ripRecoil || 0) * 0.4);
          }
        }
      }
      P.pitch += (0 - P.pitch) * Math.min(1, dt * 8);
      if (S.csT >= 7.26 && !S.galiusCrossPlanted) plantGaliusCross();
      if (S.cutscene <= 0) {
        S.ripTarget = null;
        S.ripStandPos = null;
        S.ripTargetYaw = null;
      }
    } else if (S.csKind === 'tomb') {
      P.vel.set(0, 0, 0);
      const dx = -4 - P.pos.x, dz = -86 - P.pos.z;
      P.yaw = A.lerpAngle(P.yaw, Math.atan2(-dx, -dz), Math.min(1, dt * 6));
      P.pitch += (0 - P.pitch) * Math.min(1, dt * 6);
      if (S.cutscene <= 0.45) setCinemaUI(false);
      if (S.cutscene <= 0) {
        setCinemaUI(false);
        S.csCamStart = null;
      }
    } else if (S.csKind === 'maximusIntro' || S.csKind === 'galiusIntro') {
      P.vel.set(0, 0, 0);
      if (S.csKind === 'maximusIntro') {
        const b = S.cinemaBoss;
        const bx = b ? b.g.position.x : 0;
        const bz = b ? b.g.position.z : -148;
        P.yaw = A.lerpAngle(P.yaw, Math.atan2(-(bx - P.pos.x), -(bz - P.pos.z)), Math.min(1, dt * 8));
        P.pitch += (0 - P.pitch) * Math.min(1, dt * 8);
        if (S.csT >= 3.5 && (S.csMaxStep || 0) < 1) {
          S.csMaxStep = 1;
          say('Serjão? O que aconteceu com você, meu amigo?', 'NIVALDO', 3.4);
        }
        if (S.csT >= 6.9 && (S.csMaxStep || 0) < 2) {
          S.csMaxStep = 2;
          say('Não sou mais o antigo Serjão...', 'SÉRGIO MAXIMO', 2.2);
        }
        if (S.csT >= 8.9 && (S.csMaxStep || 0) < 3) {
          S.csMaxStep = 3;
          setCinemaUI(true, 'SÉRGIO MAXIMO', 'LÍDER DA SUPER-GUARDA REAL · DISCÍPULO DE SATÃ', 'maximus');
          say('Sou Sérgio Máximo, o Líder da Super-Guarda Real... DISCÍPULO DE SATÃ!', 'SÉRGIO MAXIMO', 3.4);
          SFX.play('roar');
          P.shake = Math.max(P.shake, 0.85);
          spawnRing(bx, bz, 12, 22, 0, 0xff2222, 'e');
        }
        if (S.csT >= 11.6 && (S.csMaxStep || 0) < 4) {
          S.csMaxStep = 4;
          SFX.play('roar');
          P.shake = Math.max(P.shake, 0.95);
          burst(P.pos.x, P.pos.y + 1.4, P.pos.z, 0xff2818, 26, 9, 0.65, 0.25, 10);
          say('TRAIDOR DESGRAÇADO! EU VOU TE MOER NA PORRADA!', 'NIVALDO', 3.0);
        }
      } else if (S.csKind === 'galiusIntro') {
        const b = S.cinemaBoss;
        const bx = b ? b.g.position.x : 0;
        const bz = b ? b.g.position.z : -148;
        P.yaw = A.lerpAngle(P.yaw, Math.atan2(-(bx - P.pos.x), -(bz - P.pos.z)), Math.min(1, dt * 8));
        P.pitch += (0 - P.pitch) * Math.min(1, dt * 8);
        if (S.csT >= 8.0 && (S.csGalStep || 0) < 1) {
          S.csGalStep = 1;
          say('Mais um boneco de Satã pra virar entulho. Vem pra cima, lata velha!', 'NIVALDO', 3.2);
        }
      }
      if (S.cutscene <= 0.55) {
        const card = el('bossTitleCard');
        if (card) card.classList.remove('on');
      }
      if (S.cutscene <= 0.35) {
        setCinemaUI(false);
      }
      if (S.cutscene <= 0) {
        setCinemaUI(false);
        const b = S.cinemaBoss;
        if (b && b.maximusIntro) {
          b.maximusIntro = null;
          if (b.rig && b.rig.sword) b.rig.sword.visible = true;
          if (b.rig && b.rig.shield) b.rig.shield.visible = true;
          b.aggro = true;
          if (b.onMaximusDone) { b.onMaximusDone(); b.onMaximusDone = null; }
        }
        if (b && b.galiusIntro) {
          b.galiusIntro = null;
          if (World.breakWall) { World.breakWall.visible = false; World.breakWall.userData.col.active = false; }
          if (World.altarCross) World.altarCross.visible = false;
          if (b.rig && b.rig.weapon) b.rig.weapon.visible = true;
          b.aggro = true;
          if (b.onGaliusGrab) { b.onGaliusGrab(); b.onGaliusGrab = null; }
        }
        S.cinemaBoss = null;
        S.csCamStart = null;
      }
    }
  }

  function galiusEvent() {
    S.stage = 'galius1';
    startRoom('a6_galius1');
    const g = S.boss;
    const startGaliusBossfight = () => {
      say('Galius arrancou a Cruz Dourada do altar!', 'NIVALDO', 4);
      setObj(ROOMS.a6_galius1.obj);
      SFX.setIntensity(1);
      later(15, () => {
        if (S.stage !== 'galius1' || !S.boss || S.boss.dead || S.boss.downed || S.rip) return;
        openAltar();
        SFX.play('gate');
        burst(0, 1.2, -142, 0x6a5a5a, 32, 10, 1.1, 0.4, 14, false);
        P.shake = Math.max(P.shake, 0.9);
        setObj('Galius é forte demais! Desça pela ESCADARIA NO ALTAR!', { x: World.hatch.x, z: World.hatch.z });
        say('O altar se abriu no meio! Desça pela ESCADARIA ou continue lutando!', 'NIVALDO', 4.5);
      });
    };
    if (g) {
      captureCutsceneCamStart();
      S.cutscene = 11.2;
      S.csKind = 'galiusIntro';
      S.csT = 0;
      S.csGalStep = 0;
      S.cinemaBoss = g;
      setCinemaUI(true);
      g.g.position.set(0, 0, -158);
      g.savedPos.set(0, 0, -158);
      g.fallVel = 0;
      g.kv.set(0, 0, 0);
      g.yaw = 0;
      g.savedYaw = 0;
      g.g.rotation.y = 0;
      g.aggro = false;
      g.galiusIntro = 'burst';
      g.galiusIntroT = 0;
      g._burstedWall = false;
      g._grabbedCross = false;
      if (g.rig && g.rig.weapon) g.rig.weapon.visible = false;
      g.onGaliusBurst = () => {
        baph('JAMAIS PODERÁ DERROTAR MINHA CRIAÇÃO SUPREMA: GALIUS, O SUPER-ATEU!', 3.8);
        if (P.pos.z < -128) {
          P.vel.z += 20; P.vel.y = 6; P.onGround = false;
        }
      };
      g.onGaliusRoar = () => {
        setCinemaUI(true, 'GALIUS', 'O SUPER-ATEU', 'galius');
        baph('DESISTA, NIVALDO! VOCÊ NÃO TEM CHANCE CONTRA A CIÊNCIA PROFANA!', 3.4);
      };
      g.onGaliusGrab = startGaliusBossfight;
    } else {
      const bw = World.breakWall;
      if (bw) { bw.visible = false; bw.userData.col.active = false; }
      startGaliusBossfight();
    }
    setObj('Algo está vindo pelo altar...');
    setCheckpoint(0, -24, 0);
    SFX.setIntensity(0.7);
  }

  function goCrypt() {
    S.stage = 'crypt';
    fade('#000', 0.5, () => {
      loadMap('a6_crypt', { keepPlayer: true, x: 0, z: -4, room: 'a6_crypt1' });
      S.rooms.a6_galius1.cleared = true;
      say('Catacumbas… o Super-Papa Rômulo III está enterrado por aqui.', 'NIVALDO', 4);
      SFX.setIntensity(0.4);
    });
  }

  function tombSequence() {
    captureCutsceneCamStart();
    setCinemaUI(true);
    S.cutscene = 12.0; S.csKind = 'tomb'; S.csT = 0;
    later(0.5, () => { say('Super-Papa Rômulo III… permita que eu empunhe sua relíquia sagrada.', 'NIVALDO', 3.5); });
    later(4.2, () => { SFX.play('ghost'); say('Leve-a, filho. Que a Super-Fé guie seu braço contra as trevas.', 'RÔMULO III', 3.8); });
    later(8.2, () => {
      WEAPONS[5].owned = true; S.hasCross = true; World.crossPickup.visible = false;
      SFX.play('weapon'); updateSlots();
      say('A SACRA CRUZ PAPAL É MINHA! VAMOS ACABAR COM ESSA ABERRAÇÃO!', 'NIVALDO', 3.2);
      selectWeapon(5, true);
      P.shake = 1.2; SFX.play('boom');
      burst(-4, 8, -86, 0x6a5a4a, 40, 14, 1.4, 0.6, 14, false);
    });
    later(11.2, () => {
      fade('#fff', 0.5, () => {
        loadMap('a6_nave', { keepPlayer: true, x: 0, z: -24, room: 'a6_galius2' });
        if (World.breakWall) { World.breakWall.visible = false; World.breakWall.userData.col.active = false; }
        if (World.altarCross) World.altarCross.visible = false;
        closeAltarInstant();
        S.stage = 'galius2';
        S.cutscene = 0;
        setCinemaUI(false);
        baph('IMPOSSÍVEL!! ESSA RELÍQUIA… MATE-O, GALIUS!!', 5);
        SFX.setIntensity(1);
      });
    });
  }

  function registerSolidPropBox(x, z, halfX, halfZ, yMax, walkable) {
    const col = {
      x1: x - halfX,
      z1: z - halfZ,
      x2: x + halfX,
      z2: z + halfZ,
      yMax,
      walkable: !!walkable,
      active: true,
      _dyn: true
    };
    World.colliders.push(col);
    if (World.dynamicColliders) World.dynamicColliders.push(col);
    return col;
  }

  function spawnGaliusMeatPile(x, y, z) {
    S.galiusMeatPos = { x, y, z };
    const pile = new THREE.Group();
    pile.position.set(x, y, z);

    const mMeat1 = psx(new THREE.MeshLambertMaterial({ color: 0x6b0b14, emissive: 0x180204 }));
    const mMeat2 = psx(new THREE.MeshLambertMaterial({ color: 0x8f121e, emissive: 0x220306 }));
    const mVisc  = psx(new THREE.MeshLambertMaterial({ color: 0x42050b, emissive: 0x100102 }));
    const mBone  = psx(new THREE.MeshLambertMaterial({ color: 0xd6ccb8 }));
    const mPool  = psx(new THREE.MeshLambertMaterial({ color: 0x54040a, emissive: 0x140102 }));

    const addBlob = (geo, mat, px, py, pz, rx, ry, rz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      pile.add(m);
    };

    // Poça de sangue espessa na base
    addBlob(new THREE.CylinderGeometry(2.6, 2.8, 0.08, 10), mPool, 0, 0.04, 0, 0, 0.3, 0);

    // Base larga do montinho de carne
    addBlob(new THREE.DodecahedronGeometry(1.75, 0), mMeat1, 0, 0.45, 0, 0.2, 0.5, 0.1);
    addBlob(new THREE.BoxGeometry(2.6, 0.75, 2.2), mVisc, 0.15, 0.38, -0.1, 0.05, 0.42, -0.06);
    addBlob(new THREE.DodecahedronGeometry(1.15, 0), mMeat2, -0.95, 0.52, 0.65, 0.5, 1.1, 0.3);
    addBlob(new THREE.DodecahedronGeometry(1.05, 0), mMeat1, 0.95, 0.48, -0.55, 0.3, 0.8, -0.4);
    addBlob(new THREE.DodecahedronGeometry(0.95, 0), mVisc, 0.85, 0.44, 0.80, -0.4, 0.2, 0.5);
    addBlob(new THREE.DodecahedronGeometry(0.90, 0), mMeat2, -0.80, 0.46, -0.85, 0.7, -0.5, 0.2);

    // Camada superior (topo do monte onde a cruz vai ser espetada)
    addBlob(new THREE.DodecahedronGeometry(1.05, 0), mMeat2, 0, 0.95, 0, 0.4, 0.9, -0.2);
    addBlob(new THREE.BoxGeometry(1.3, 0.65, 1.1), mMeat1, -0.15, 1.05, 0.12, 0.2, -0.3, 0.15);
    addBlob(new THREE.DodecahedronGeometry(0.62, 0), mVisc, 0.35, 1.18, -0.20, 0.8, 0.4, 0.3);

    // Pedaços de ossos esmagados saindo da carne
    addBlob(new THREE.BoxGeometry(0.22, 0.95, 0.22), mBone, -0.75, 0.82, 0.45, 0.65, 0.3, 0.55);
    addBlob(new THREE.BoxGeometry(0.18, 0.80, 0.18), mBone, 0.82, 0.76, -0.32, -0.55, 0.2, -0.60);
    addBlob(new THREE.BoxGeometry(0.20, 0.70, 0.20), mBone, 0.25, 0.92, 0.78, 0.80, -0.4, 0.25);

    (World.group || scene).add(pile);

    // Colisor sólido para o montinho de carne (pode bloquear ou servir de degrau)
    registerSolidPropBox(x, z, 2.05, 2.05, y + 1.45, true);
  }

  function plantGaliusCross() {
    S.galiusCrossPlanted = true;
    const N = NIVALDO_3P;
    const pos = S.galiusMeatPos || { x: P.pos.x, y: P.pos.y, z: P.pos.z };
    if (N && N.cross) {
      const prop = new THREE.Group();
      const mesh = N.cross.clone();
      mesh.visible = true;
      mesh.position.set(0, 1.13, 0);
      mesh.rotation.set(0, 0, 0);
      prop.add(mesh);
      prop.position.set(pos.x, pos.y + 0.65, pos.z);
      prop.rotation.set(0.04, S.ripYaw || 0, 0.05);
      (World.group || scene).add(prop);
    }

    // Colisor sólido alto para a cruz espetada no topo
    registerSolidPropBox(pos.x, pos.z, 0.60, 0.60, pos.y + 9.0, false);

    SFX.play('slam');
    SFX.play('gib');
    SFX.play('clang');
    P.shake = Math.max(P.shake, 1.15);
    burst(pos.x, pos.y + 1.5, pos.z, 0xb01020, 38, 12, 1.1, 0.35, 14);
    burst(pos.x, pos.y + 1.6, pos.z, 0xffd060, 20, 10, 0.7, 0.25, 10);
  }

  function ripSequence(g) {
    setCinemaUI(true);
    S.cutscene = 9.0; S.csKind = 'rip'; S.csT = 0; S.rip = true; S.galiusCrossPlanted = false; S.galiusMeatPos = null;
    P.vel.set(0, 0, 0);
    const gp = g.g.position;
    let dx = gp.x - P.pos.x, dz = gp.z - P.pos.z;
    let d = Math.hypot(dx, dz);
    if (d < 0.05) { dx = 0; dz = -1; d = 1; }
    const nx = dx / d, nz = dz / d;
    const standDist = 1.52;
    const standPos = new V3(gp.x - nx * standDist, P.pos.y, gp.z - nz * standDist);
    resolveCircle(standPos, P.r, standPos.y);
    standPos.y = Math.max(standPos.y, A.groundAt(standPos.x, standPos.z, standPos.y, P.r));
    S.ripTarget = g;
    S.ripStandPos = standPos;
    S.ripYaw = Math.atan2(-nx, -nz);
    S.ripTargetYaw = Math.atan2(-nx, -nz);
    TP_CAM.angle = S.ripYaw + 0.58;
    say('Nivaldo enfia a mão no peito de Galius…', '', 2.2);
    SFX.play('heart');
    later(1.0, () => {
      SFX.play('heart');
      SFX.play('gore', 'gush');
      P.shake = 0.8;
      burst(gp.x - nx * 0.7, P.pos.y + 2.0, gp.z - nz * 0.7, 0xc01020, 18, 8, 0.8, 0.25, 10);
    });
    later(2.0, () => {
      SFX.play('gore', 'explode');
      burst(gp.x - nx * 0.7, P.pos.y + 2.1, gp.z - nz * 0.7, 0xc01020, 45, 12, 1.2, 0.35, 14);
      WEAPONS[6].owned = true; P.blood = 100; S.hasHeart = true;
      SFX.play('weapon'); updateSlots(); selectWeapon(6, true);
      say('CORAÇÃO ATEU adquirido! [7] · Atira sangue, recarrega com a chacina!', '', 4.5);
      if (g.rig.heart) g.rig.heart.visible = false;
      if (A.deformGaliusHit) A.deformGaliusHit(g, 0);
    });
    later(3.4, () => {
      say('Nivaldo arranca a Cruz Gigante de Galius e o esmaga com ela!', '', 3);
      if (g.rig.weapon) g.rig.weapon.visible = false;
      const stepBack = new V3(gp.x - nx * 3.1, P.pos.y, gp.z - nz * 3.1);
      resolveCircle(stepBack, P.r, stepBack.y);
      stepBack.y = Math.max(stepBack.y, A.groundAt(stepBack.x, stepBack.z, stepBack.y, P.r));
      S.ripStandPos = stepBack;
      if (WEAPONS[5].owned) selectWeapon(5, true);
    });
    later(4.02, () => {
      SFX.play('cross'); SFX.play('hit', 'cross'); P.shake = 0.9;
      if (A.deformGaliusHit) A.deformGaliusHit(g, 1, 1);
      burst(gp.x - nx * 0.5, P.pos.y + 2.0, gp.z - nz * 0.5, 0xffd060, 22, 10, 0.7, 0.25, 10);
      burst(gp.x - nx * 0.5, P.pos.y + 2.0, gp.z - nz * 0.5, 0xb01020, 24, 10, 0.9, 0.3, 12);
    });
    later(4.82, () => {
      SFX.play('cross'); SFX.play('gib'); P.shake = 1.1;
      if (A.deformGaliusHit) A.deformGaliusHit(g, 2, -1);
      burst(gp.x - nx * 0.5, P.pos.y + 1.9, gp.z - nz * 0.5, 0xffd060, 26, 12, 0.8, 0.25, 12);
      burst(gp.x - nx * 0.5, P.pos.y + 1.9, gp.z - nz * 0.5, 0xb01020, 32, 12, 1.1, 0.35, 14);
    });
    later(5.62, () => {
      const p = g.g.position;
      const gy = A.groundAt(p.x, p.z, P.pos.y, 1.0);
      if (A.spawnGore) A.spawnGore(p.x, gy, p.z, 5.5, 0, 0, true);
      burst(p.x, gy + 1.2, p.z, 0xb01020, 70, 16, 1.5, 0.5, 18);
      burst(p.x, gy + 1.2, p.z, 0xffd060, 36, 14, 0.9, 0.3, 12);
      P.shake = 1.5; SFX.play('boom'); SFX.play('gib'); SFX.play('cross');
      A.removeEnemy(g); S.boss = null; S.rooms.a6_galius1.cleared = true; S.rooms.a6_galius2.cleared = true;
      spawnGaliusMeatPile(p.x, gy, p.z);
      SFX.setIntensity(0.3);
    });
    later(6.4, () => {
      World.portal.g.visible = true; World.portal.active = true; SFX.play('portal');
      say('DESCANSE NO INFERNO, SUPER-ATEU!', 'NIVALDO', 2.4);
      setObj('Entre no portal', { x: World.portal.x, z: World.portal.z });
      S.stage = 'portal'; S.rip = false;
    });
    later(8.5, () => {
      setCinemaUI(false);
      say('Existe um caminho mais fundo… um portal se abriu no altar.', 'SUPER-ANJO', 5);
    });
  }

  /* ---------------- persistência & configurações ---------------- */
  const SAVE_KEY = 'hellslayer_save_v1';
  const DEFAULT_BINDS = {
    forward: 'KeyW',
    back: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    dash: 'ShiftLeft',
    slam: 'ControlLeft',
    use: 'KeyE',
    glory: 'KeyF',
    kick: 'KeyQ',
    faith: 'KeyV',
    respawn: 'KeyR',
    mute: 'KeyM'
  };
  const QUALITY_PRESETS = {
    batata: {
      label: 'BATATA',
      resH: 120,
      renderDist: 3,
      fogScale: 0.65,
      ssaoQuality: 'off',
      lightingQuality: 'min',
      worldDetail: 'min',
      blobShadows: false,
      psxJitter: 'extreme',
      texFilter: 'nearest',
      pixelatedCanvas: true,
      goreQuality: 'min',
      particleScale: 0.2,
      goreDur: 2,
      dismember: false,
      bleedJoints: false,
      gibDrips: false
    },
    muito_baixo: {
      label: 'MUITO BAIXO',
      resH: 160,
      renderDist: 5,
      fogScale: 0.75,
      ssaoQuality: 'off',
      lightingQuality: 'low',
      worldDetail: 'low',
      blobShadows: false,
      psxJitter: 'normal',
      texFilter: 'nearest',
      pixelatedCanvas: true,
      goreQuality: 'very_low',
      particleScale: 0.4,
      goreDur: 5,
      dismember: true,
      bleedJoints: false,
      gibDrips: false
    },
    baixo: {
      label: 'BAIXO',
      resH: 216,
      renderDist: 6,
      fogScale: 0.85,
      ssaoQuality: 'off',
      lightingQuality: 'med',
      worldDetail: 'low',
      blobShadows: true,
      psxJitter: 'normal',
      texFilter: 'nearest',
      pixelatedCanvas: true,
      goreQuality: 'low',
      particleScale: 0.6,
      goreDur: 10,
      dismember: true,
      bleedJoints: false,
      gibDrips: false
    },
    medio: {
      label: 'MÉDIO',
      resH: 270,
      renderDist: 8,
      fogScale: 1.0,
      ssaoQuality: 'low',
      lightingQuality: 'med',
      worldDetail: 'med',
      blobShadows: true,
      psxJitter: 'normal',
      texFilter: 'nearest',
      pixelatedCanvas: true,
      goreQuality: 'med',
      particleScale: 0.85,
      goreDur: 15,
      dismember: true,
      bleedJoints: true,
      gibDrips: false
    },
    alto: {
      label: 'ALTO',
      resH: 360,
      renderDist: 10,
      fogScale: 1.0,
      ssaoQuality: 'high',
      lightingQuality: 'high',
      worldDetail: 'high',
      blobShadows: true,
      psxJitter: 'normal',
      texFilter: 'nearest',
      pixelatedCanvas: true,
      goreQuality: 'high',
      particleScale: 1.0,
      goreDur: 20,
      dismember: true,
      bleedJoints: true,
      gibDrips: true
    },
    muito_alto: {
      label: 'MUITO ALTO',
      resH: 540,
      renderDist: 13,
      fogScale: 1.25,
      ssaoQuality: 'high',
      lightingQuality: 'high',
      worldDetail: 'high',
      blobShadows: true,
      psxJitter: 'soft',
      texFilter: 'nearest',
      pixelatedCanvas: true,
      goreQuality: 'very_high',
      particleScale: 1.4,
      goreDur: 40,
      dismember: true,
      bleedJoints: true,
      gibDrips: true
    },
    ultra: {
      label: 'ULTRA',
      resH: 720,
      renderDist: 16,
      fogScale: 1.5,
      ssaoQuality: 'ultra',
      lightingQuality: 'ultra',
      worldDetail: 'ultra',
      blobShadows: true,
      psxJitter: 'soft',
      texFilter: 'nearest',
      pixelatedCanvas: true,
      goreQuality: 'ultra',
      particleScale: 2.0,
      goreDur: 61,
      dismember: true,
      bleedJoints: true,
      gibDrips: true
    }
  };
  const PRESET_KEYS = [
    'resH', 'renderDist', 'fogScale', 'ssaoQuality', 'lightingQuality',
    'worldDetail', 'blobShadows', 'psxJitter', 'texFilter', 'pixelatedCanvas',
    'goreQuality', 'particleScale', 'goreDur', 'dismember', 'bleedJoints', 'gibDrips'
  ];
  const SETTINGS_DEFAULTS = Object.assign({
    qualityPreset: 'alto',
    fov: 75,
    fpsCap: 0,
    goreVol: 0.55,
    bob: 1.0,
    roll: 1.0,
    shake: 1.0,
    hitstop: 1.0,
    vmBob: 1.0,
    screenFlash: 1.0,
    showVM: true,
    showRadar: true,
    showFace: true,
    showStyle: true,
    quips: true,
    peasantLabels: true,
    showFps: false,
    sens: 1.0,
    invertY: false,
    rawInput: true,
    chStyle: 'cross',
    chColor: '#ffd24a',
    chSize: 1.0,
    showHitmarker: true,
    vol: 0.55,
    musicVol: 0.50,
    screams: true,
    muted: false,
    binds: Object.assign({}, DEFAULT_BINDS)
  }, QUALITY_PRESETS.alto);
  delete SETTINGS_DEFAULTS.label;

  const SAVE = Object.assign({}, SETTINGS_DEFAULTS, {
    bestTime: null,
    bestKills: 0,
    bestRank: '—',
    ch2Unlocked: false
  });
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.assign(SAVE, parsed);
      SAVE.binds = Object.assign({}, DEFAULT_BINDS, parsed && parsed.binds ? parsed.binds : {});
      if (parsed && parsed.binds && !parsed.binds.kick && parsed.binds.faith === 'KeyQ') {
        SAVE.binds.kick = 'KeyQ';
        SAVE.binds.faith = DEFAULT_BINDS.faith;
      }
    }
  } catch (e) {}
  SAVE.renderDist = clamp(parseInt(SAVE.renderDist, 10) || 10, 2, 16);
  SAVE.resH = clamp(parseInt(SAVE.resH, 10) || 360, 120, 1080);
  SAVE.fogScale = clamp(parseFloat(SAVE.fogScale) || 1.0, 0.5, 1.8);
  SAVE.fov = clamp(parseInt(SAVE.fov, 10) || 75, 60, 110);
  SAVE.fpsCap = parseInt(SAVE.fpsCap, 10) || 0;
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {}
  }
  function refreshRecordUI() {
    const box = el('bestRecord');
    if (!box) return;
    if (SAVE.bestTime != null) {
      const m = Math.floor(SAVE.bestTime / 60), s = Math.floor(SAVE.bestTime % 60);
      box.innerHTML = '🏆 RECORDE CAP. 1 — TEMPO: <b>' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '</b> · CHACINA: <b>' + SAVE.bestKills + '</b> · RANK: <b>' + SAVE.bestRank + '</b>';
    } else {
      box.textContent = '';
    }
  }

  function endGame() {
    if (S.ended) return;
    S.ended = true; S.stage = 'end';
    SFX.play('portal');
    const rk = rankOf(S.style);
    if (SAVE.bestTime == null || S.time < SAVE.bestTime) SAVE.bestTime = S.time;
    if (S.kills > SAVE.bestKills) SAVE.bestKills = S.kills;
    SAVE.bestRank = rk;
    SAVE.ch2Unlocked = true;
    writeSave();
    refreshRecordUI();
    const m = Math.floor(S.time / 60), sec = Math.floor(S.time % 60);
    el('endStats').innerHTML = 'O portal leva a outra região do Inferno… uma floresta?<br><br>CHACINA: <b>' + S.kills + '</b> · TEMPO: <b>' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0') + '</b> · RANK FINAL: <b>' + rk + '</b>';
    show('end', true);
    if (document.exitPointerLock) document.exitPointerLock();
  }

  function findGloryTarget() {
    const f = getAimDir();
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || e.dead || !e.inRender || !e.glory || e.kicked) continue;
      const ep = e.g.position;
      const dx = ep.x - P.pos.x, dz = ep.z - P.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > e.r + 4.4 || Math.abs(ep.y - P.pos.y) > 3.5) continue;
      const nx = d > 0.01 ? dx / d : f.x;
      const nz = d > 0.01 ? dz / d : f.z;
      const dot = nx * f.x + nz * f.z;
      if (dot < -0.15 && d > e.r + 1.8) continue;
      const score = dot * 2.0 - d * 0.25;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  function isSmallEnemy(e) {
    return !!(e && e.T && !e.T.boss && e.r <= 0.8);
  }
  function findGrabTarget() {
    const f = getAimDir();
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || e.dead || e.downed || e.kicked || e.glory || e.grabbed || !e.inRender || !isSmallEnemy(e)) continue;
      const ep = e.g.position;
      const dx = ep.x - P.pos.x, dz = ep.z - P.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > e.r + 3.8 || Math.abs(ep.y - P.pos.y) > 3.5) continue;
      const nx = d > 0.01 ? dx / d : f.x;
      const nz = d > 0.01 ? dz / d : f.z;
      const dot = nx * f.x + nz * f.z;
      if (dot < 0.25 && d > e.r + 1.8) continue;
      const score = dot * 2.0 - d * 0.25;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }
  function startGrab(e) {
    if (!e || e.dead || P.grabbed || S.glory) return;
    P.grabbed = e;
    P.grabT = 0;
    P.ramHitSet = null;
    e.grabbed = true;
    e.state = 'move';
    e.stun = 0;
    e.aggro = true;
    e.aggroOnPlayer = true;
    if (e.shadow) e.shadow.visible = false;
    SFX.play('punch');
    P.shake = Math.max(P.shake, 0.16);
  }
  function releaseGrab() {
    const e = P.grabbed;
    P.grabbed = null;
    P.ramHitSet = null;
    if (e) {
      e.grabbed = false;
      e.g.rotation.set(0, e.yaw || 0, 0);
      if (e.shadow) e.shadow.visible = true;
    }
  }
  function updateGrabbedEnemy(dt) {
    const e = P.grabbed;
    if (!e) return;
    if (e.dead || !e.g) { releaseGrab(); return; }
    P.grabT += dt;
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    const fx = -sy, fz = -cy, rx = cy, rz = -sy;
    if (P.dashT > 0) {
      const dfx = P.dashDir.x, dfz = P.dashDir.z;
      const ramDist = 0.95 + e.r * 0.35;
      e.g.position.set(
        P.pos.x + dfx * ramDist,
        P.pos.y + 1.637 - e.h * 0.60,
        P.pos.z + dfz * ramDist
      );
      e.yaw = Math.atan2(dfx, dfz);
      e.g.rotation.set(0.35, e.yaw, 0);
      if (!P.ramHitSet) P.ramHitSet = new Set();
      for (let i = 0; i < enemies.length; i++) {
        const o = enemies[i];
        if (!o || o === e || o.dead || o.downed || o.kicked || o.grabbed || !o.inRender || P.ramHitSet.has(o)) continue;
        const ox = o.g.position.x - e.g.position.x, oz = o.g.position.z - e.g.position.z;
        const md = e.r + o.r + 1.0;
        if (Math.hypot(ox, oz) < md && Math.abs(o.g.position.y - e.g.position.y) < Math.max(e.h, o.h) + 1.4) {
          P.ramHitSet.add(o);
          A.dmgEnemy(o, 55, dfx, dfz, { knock: 18, stunBonus: 0.7, hitSfx: 'slam', part: 'torso' });
          A.dmgEnemy(e, 22, dfx, dfz, { knock: 0, hitSfx: 'slam', part: 'torso' });
          SFX.play('slam');
          A.burst(e.g.position.x, e.g.position.y + e.h * 0.5, e.g.position.z, 0xb01010, 12, 8, 0.45, 0.22, 12);
          P.shake = Math.max(P.shake, 0.48);
          S.hitStop = 0.035 * (SAVE.hitstop != null ? SAVE.hitstop : 1);
          S.style = Math.min(420, S.style + 25);
          if (e.dead) { releaseGrab(); return; }
        }
      }
    } else {
      P.ramHitSet = null;
      const holdDist = 0.85 + e.r * 0.35;
      const sideOff = -0.76;
      const bob = Math.sin(P.grabT * 9) * 0.03;
      e.g.position.set(
        P.pos.x + fx * holdDist + rx * sideOff,
        P.pos.y + 1.637 - e.h * 0.60 + bob,
        P.pos.z + fz * holdDist + rz * sideOff
      );
      e.yaw = wrapAngle(P.yaw + Math.PI);
      e.g.rotation.set(0, e.yaw, Math.sin(P.grabT * 11) * 0.08);
      const R = e.rig;
      if (R) {
        const flail = Math.sin(P.grabT * 18);
        if (R.armL) R.armL.rotation.x = -0.9 + flail * 0.55;
        if (R.armR) R.armR.rotation.x = -0.9 - flail * 0.55;
        if (R.legL) R.legL.rotation.x = flail * 0.45;
        if (R.legR) R.legR.rotation.x = -flail * 0.45;
      }
    }
  }

  function startGloryKill(e) {
    if (!e || e.dead || S.glory) return;
    releaseGrab();
    const headGone = e.limbs && e.limbs.head && e.limbs.head.severed;
    let kind;
    if (e.type === 'padre' && !headGone) {
      kind = 'padre_cross';
    } else if (e.type === 'demonio') {
      kind = 'demon_smash';
    } else if ((e.type === 'gargula' || e.type === 'diabrete') && !e.wingsLost) {
      kind = 'wing_rip';
    } else if (e.type === 'campones' && e.rig && e.rig.pitchfork) {
      kind = 'trident_impale';
    } else {
      const pool = headGone ? ['rip', 'kick'] : ['rip', 'decap', 'hammer', 'kick'];
      kind = pool[(Math.random() * pool.length) | 0];
    }
    const ep = e.g.position;
    let dx = ep.x - P.pos.x, dz = ep.z - P.pos.z;
    let d = Math.hypot(dx, dz);
    if (d < 0.05) { dx = -Math.sin(P.yaw); dz = -Math.cos(P.yaw); d = 1; }
    const nx = dx / d, nz = dz / d;
    const standDist = e.r + (kind === 'kick' ? 1.55 : (kind === 'hammer' || kind === 'demon_smash' ? 1.05 : 1.35));
    const targetPos = new V3(ep.x - nx * standDist, P.pos.y, ep.z - nz * standDist);
    resolveCircle(targetPos, P.r, targetPos.y);
    const gy = A.groundAt(targetPos.x, targetPos.z, targetPos.y, P.r);
    targetPos.y = kind === 'wing_rip' ? gy : Math.max(targetPos.y, gy);
    const targetYaw = Math.atan2(-nx, -nz);
    const aimY = ep.y + e.h * (kind === 'kick' ? 0.45 : 0.68);
    const horz = Math.max(0.5, Math.hypot(ep.x - targetPos.x, ep.z - targetPos.z));
    const targetPitch = clamp(Math.atan2(aimY - (targetPos.y + P.eye), horz), -1.1, 0.8);
    const gdur = kind === 'rip' ? RIP_T.release + 0.55
      : (kind === 'decap' ? 2.75
        : (kind === 'hammer' ? 2.2
          : (kind === 'padre_cross' ? PADRE_T.end
            : (kind === 'demon_smash' ? DEMON_T.end
              : (kind === 'wing_rip' ? WING_T.end
                : (kind === 'trident_impale' ? TRIDENT_T.end : 1.55))))));
    const hitAt = kind === 'kick' ? 0.55
      : (kind === 'decap' ? DEC_T.grab
        : (kind === 'hammer' ? 0.95
          : (kind === 'padre_cross' ? PADRE_T.stab
            : (kind === 'demon_smash' ? DEMON_T.hit1
              : (kind === 'wing_rip' ? WING_T.rip
                : (kind === 'trident_impale' ? TRIDENT_T.impale : RIP_T.grab))))));
    let fx = null;
    if (kind === 'padre_cross') {
      e.g.rotation.y = targetYaw + Math.PI;
      fx = { kind, e, snatched: false, stabbed: false, kicked: false, cross: null, done: false };
    } else if (kind === 'demon_smash') {
      fx = { kind, e, hits: 0, done: false };
    } else if (kind === 'wing_rip') {
      const gx = targetPos.x + nx * 1.15, gz = targetPos.z + nz * 1.15;
      const gGround = getGroundY(gx, gz);
      fx = { kind, e, startPos: ep.clone(), groundPos: new V3(gx, gGround + 0.22, gz), slammed: false, ripped: false, stomped: false, thrown: false, wingL: null, wingR: null, done: false };
    } else if (kind === 'trident_impale') {
      e.g.rotation.y = targetYaw + Math.PI;
      const pushPos = new V3(ep.x + nx * 0.75, ep.y, ep.z + nz * 0.75);
      resolveCircle(pushPos, e.r, pushPos.y);
      pushPos.y = getGroundY(pushPos.x, pushPos.z);
      fx = { kind, e, startPos: ep.clone(), pushPos, pushed: false, grabbed: false, impaled: false, trident: null, done: false };
    }
    P.invuln = Math.max(P.invuln || 0, gdur + 0.4);
    P.vel.set(0, 0, 0);
    P.pending = null;
    TP_CAM.angle = targetYaw + 0.58;
    TP_CAM.pitch = 0.38;
    S.glory = {
      e, kind, t: 0,
      dur: gdur,
      hitAt,
      variant: kind === 'hammer' ? (Math.random() < 0.5 ? 'down' : 'side') : null,
      fx,
      hit: false,
      nx, nz,
      enemyPos: ep.clone(),
      startPos: P.pos.clone(),
      targetPos,
      startYaw: P.yaw,
      targetYaw,
      startPitch: P.pitch,
      targetPitch
    };
    SFX.play('swing');
  }

  function updateGloryKill(dt) {
    const gk = S.glory;
    if (!gk) return;
    const e = gk.e;
    if (!e || (e.dead && !gk.hit)) {
      endGlory();
      return;
    }
    gk.t += dt;
    const lungeP = clamp(gk.t / 0.18, 0, 1);
    const smooth = lungeP * lungeP * (3 - 2 * lungeP);
    P.pos.lerpVectors(gk.startPos, gk.targetPos, smooth);
    P.yaw = wrapAngle(A.lerpAngle(gk.startYaw, gk.targetYaw, smooth));
    P.pitch = gk.startPitch + (gk.targetPitch - gk.startPitch) * smooth;
    if (!gk.hit && e && !e.dead) {
      gk.enemyPos.copy(e.g.position);
    }
    if (!gk.hit && gk.t >= gk.hitAt) {
      gk.hit = true;
      S.hitStop = 0.045 * (SAVE.hitstop != null ? SAVE.hitstop : 1);
      P.shake = Math.max(P.shake, 0.78);
      P.fovKick = Math.max(P.fovKick, 0.72);
      if (gk.kind === 'rip') {
        gloryHitRip(gk, e);
        SFX.play('hit', 'cut');
      } else if (gk.kind === 'decap') {
        gloryHitDecap(gk, e);
        SFX.play('gib'); SFX.play('hit', 'cut');
      } else if (gk.kind === 'hammer') {
        gloryHitHammer(gk, e);
        SFX.play('hammer'); SFX.play('gib');
      } else if (gk.kind === 'kick') {
        gloryHitKick(gk, e);
        SFX.play('slam'); SFX.play('hit', 'general');
      }
      healPlayer(20, 0.60);
      if (P.faithMode <= 0) addFaith(6);
      S.style = Math.min(420, S.style + 35);
      el('flash').style.background = '#ff2818';
      P.flashV = 0.28;
    }
    if (gk.t >= gk.dur) {
      endGlory();
    }
  }

  function updateEvents(dt) {
    S.prompt = '';
    S.gloryPrompt = false;
    if (S.ended || S.intermission) return;
    const px = P.pos.x, pz = P.pos.z;

    // Portão de Saída em Destaque (a1..a5)
    const eg = World.exitGate;
    if (eg && !S.fade) {
      const dEg = dist2(px, pz, eg.x, eg.z);
      if (dEg < eg.r) {
        if (!eg.unlocked) {
          S.prompt = 'PORTÃO TRANCADO — ELIMINE TODOS OS DEMÔNIOS DA ÁREA';
        } else {
          S.prompt = '[E] ATRAVESSAR PORTÃO — ' + eg.nextLabel;
          if (P.wantUse || dEg < 3.4) {
            showLevelComplete(World.currentMap, eg.nextMap, eg.nextLabel);
            return;
          }
        }
      }
    }

    // Transição Portões da Ultra-Igreja -> Nave da Ultra-Igreja
    if (World.currentMap === 'a6_gate' && S.stage === 'door' && S.cutscene <= 0 && pz < -167 && !S.fade) {
      fade('#000', 0.45, () => {
        loadMap('a6_nave', { keepPlayer: true, x: 0, z: -8 });
        say('Tomada por demônios, padres e gárgulas. Que Deus me perdoe a bagunça.', 'NIVALDO', 4);
      });
      return;
    }

    // Gatilhos das Catacumbas (a6_crypt)
    if (World.currentMap === 'a6_crypt' && S.stage === 'crypt') {
      if (px >= 36 && px <= 80 && pz >= -42 && pz <= 6 && !S.rooms.a6_crypt2.spawned) {
        startRoom('a6_crypt2'); setCheckpoint(40, -14, -Math.PI / 2);
      } else if (px >= 38 && px <= 78 && pz >= -108 && pz <= -64 && !S.rooms.a6_crypt3.spawned) {
        startRoom('a6_crypt3'); setCheckpoint(58, -66, 0);
      }
    }

    // Descendo ao Horror (a4 / a5): gritos distantes e fúria crescente
    if ((S.objRoom === 'a4' || S.objRoom === 'a5') && S.rooms[S.objRoom] && S.rooms[S.objRoom].spawned && !S.rooms[S.objRoom].cleared) {
      if (P.faith < 100 && !P.faithMode) addFaith(1.4 * dt);
      S.distantScreamT = (S.distantScreamT || 6) - dt;
      if (S.distantScreamT <= 0) {
        S.distantScreamT = 12 + Math.random() * 8;
        SFX.play('scream', 0.65 + Math.random() * 0.55);
      }
    }

    // Escadaria no Altar -> Catacumbas
    if (World.currentMap === 'a6_nave' && S.stage === 'galius1' && World.hatch && World.hatch.active &&
        px > -3.2 && px < 3.2 && pz < -138.5 && pz > -149.5 && P.pos.y < 1.2 && !S.fade) goCrypt();

    // Túmulo de Rômulo III
    if (World.currentMap === 'a6_crypt' && S.stage === 'crypt' && S.rooms.a6_crypt3.cleared && !S.hasCross && S.cutscene <= 0) {
      const d = dist2(px, pz, -4, -86);
      if (d < 12) {
        S.prompt = '[E] PEDIR PERMISSÃO AO FANTASMA DE RÔMULO III';
        if (P.wantUse) tombSequence();
      }
    }
    // Galius derrubado
    const b = S.boss;
    if (b && b.T.model === 'galius' && b.downed && !S.rip && S.cutscene <= 0) {
      const d = dist2(px, pz, b.g.position.x, b.g.position.z);
      if (d < b.r + 7) {
        S.prompt = '[E] ARRANCAR O CORAÇÃO ATEU';
        if (P.wantUse) ripSequence(b);
      }
    }
    // Glory Kill em inimigos agonizando ou Agarrar inimigo pequeno
    if (!S.glory && S.cutscene <= 0 && !P.dead) {
      const gt = findGloryTarget();
      if (gt) {
        const gKey = formatKeyName((SAVE.binds && SAVE.binds.glory) || DEFAULT_BINDS.glory);
        S.prompt = '[' + gKey + '] GLORY KILL';
        S.gloryPrompt = true;
        if (P.wantGlory) startGloryKill(gt);
      } else if (!P.grabbed) {
        const grabTgt = findGrabTarget();
        if (grabTgt) {
          const gKey = formatKeyName((SAVE.binds && SAVE.binds.glory) || DEFAULT_BINDS.glory);
          S.prompt = '[' + gKey + '] AGARRAR INIMIGO';
          if (P.wantGlory) startGrab(grabTgt);
        }
      }
    }
    // portal final
    if (World.portal && World.portal.active && dist2(px, pz, World.portal.x, World.portal.z) < World.portal.r + 0.6) endGame();
    P.wantUse = false;
    P.wantGlory = false;
  }

  /* ---------------- jogador ---------------- */
  function die() {
    if (P.dead) return;
    P.dead = true; mouseL = false; mouseR = false;
    releaseGrab();
    endGlory(); P.wantGlory = false;
    SFX.play('roar');
    show('death', true);
    if (document.exitPointerLock) document.exitPointerLock();
  }
  function respawn() {
    show('death', false);
    if (window.BloodStain) BloodStain.reset();
    P.dead = false; P.hp = P.maxhp; P.vel.set(0, 0, 0); P.faithMode = 0; P.hurtFlash = 0; P.healFlash = 0;
    releaseGrab();
    endGlory(); P.wantGlory = false; P.invuln = 0;
    P.slamming = false; P.slamCd = 0; P.slamJumpT = 0; P.slamJumpBufT = 0; P.wasJumpDown = false;
    P.pos.set(S.checkpoint.x, getGroundY(S.checkpoint.x, S.checkpoint.z), S.checkpoint.z); P.yaw = S.checkpoint.yaw; P.pitch = 0;
    resetCamera();
    World.updateChunks(P.pos.x, P.pos.z, true);
    A.clearProjs(); A.clearParts();
    A.spawnMapPeasants(World.currentMap);
    for (const id in S.rooms) {
      const r = S.rooms[id];
      if (r.spawned && !r.cleared) { A.clearRoomEnemies(id); startRoom(id, true); }
    }
    A.syncRenderDistanceEntities();
    if (S.cross.state !== 'held') crossRemove();
    S.cutscene = 0; S.rip = false; S.ripTarget = null; S.ripStandPos = null;
    S.cinemaBoss = null; S.csCamStart = null; setCinemaUI(false);
    TP_CAM.active = false; NIVALDO_3P.root.visible = false;
    if (S.corpse) { scene.remove(S.corpse); S.corpse = null; }
    if (S.maximusSpirit) { scene.remove(S.maximusSpirit); S.maximusSpirit = null; }
    S.maximusRig = null; S.maximusCorpse = null;
    S.boss = enemies.find(e => e.T.boss) || null;
    requestLock();
  }

  function doGroundSlam() {
    SFX.play('slam');
    P.shake = Math.max(P.shake, 0.85);
    S.hitStop = 0.055 * (SAVE.hitstop != null ? SAVE.hitstop : 1);
    spawnRing(P.pos.x, P.pos.z, 7.5, 26, 0, 0xffaa30, 'p');
    burst(P.pos.x, P.pos.y + 0.3, P.pos.z, 0x8a725a, 24, 11, 0.7, 0.32, 16, false);
    burst(P.pos.x, P.pos.y + 0.5, P.pos.z, 0xffd060, 10, 9, 0.4, 0.2, 10);
    for (const e of enemies) {
      if (e.dead || e.downed || !e.inRender) continue;
      const ep = e.g.position;
      const d = dist2(P.pos.x, P.pos.z, ep.x, ep.z);
      if (d < 6.8 + e.r && Math.abs(ep.y - P.pos.y) < 4.5) {
        const l = d || 1;
        dmgEnemy(e, 48, (ep.x - P.pos.x) / l, (ep.z - P.pos.z) / l, { knock: 16, stunBonus: 0.6 });
      }
    }
  }

  function bindDown(act) {
    const code = (SAVE.binds && SAVE.binds[act]) || DEFAULT_BINDS[act];
    return !!keys[code];
  }

  function updatePlayer(dt) {
    if (P.invuln > 0) P.invuln = Math.max(0, P.invuln - dt);
    if (S.glory) {
      if (mouseGuard.pendingX !== 0 || mouseGuard.pendingY !== 0) {
        const k = 0.0022 * SAVE.sens;
        const inv = SAVE.invertY ? -1 : 1;
        TP_CAM.angle = wrapAngle(TP_CAM.angle - mouseGuard.pendingX * k);
        TP_CAM.pitch = clamp(TP_CAM.pitch + mouseGuard.pendingY * k * inv, -0.35, 1.25);
        mouseGuard.pendingX = 0;
        mouseGuard.pendingY = 0;
      }
      P.vel.set(0, 0, 0);
      return;
    }
    const input = !P.dead && S.cutscene <= 0;
    const inv = SAVE.invertY ? -1 : 1;
    if (input) {
      if (TP_CAM.userMode) {
        if (mouseGuard.pendingX !== 0 || mouseGuard.pendingY !== 0) {
          const k = 0.0022 * SAVE.sens;
          TP_CAM.angle = wrapAngle(TP_CAM.angle - mouseGuard.pendingX * k);
          TP_CAM.pitch = clamp(TP_CAM.pitch + mouseGuard.pendingY * k * inv, -0.45, 1.15);
          mouseGuard.pendingX = 0;
          mouseGuard.pendingY = 0;
        }
        const look = 2.2 * dt * SAVE.sens;
        if (keys.ArrowLeft) TP_CAM.angle = wrapAngle(TP_CAM.angle + look);
        if (keys.ArrowRight) TP_CAM.angle = wrapAngle(TP_CAM.angle - look);
        if (keys.ArrowUp) TP_CAM.pitch = clamp(TP_CAM.pitch - look * inv, -0.45, 1.15);
        if (keys.ArrowDown) TP_CAM.pitch = clamp(TP_CAM.pitch + look * inv, -0.45, 1.15);
        P.pitch = clamp(-TP_CAM.pitch, -1.45, 1.45);
      } else {
        if (mouseGuard.pendingX !== 0 || mouseGuard.pendingY !== 0) {
          const k = 0.0022 * SAVE.sens;
          P.yaw = wrapAngle(P.yaw - mouseGuard.pendingX * k);
          P.pitch = clamp(P.pitch - mouseGuard.pendingY * k * inv, -1.45, 1.45);
          mouseGuard.pendingX = 0;
          mouseGuard.pendingY = 0;
        }
        const look = 2.2 * dt * SAVE.sens;
        if (keys.ArrowLeft) P.yaw = wrapAngle(P.yaw + look);
        if (keys.ArrowRight) P.yaw = wrapAngle(P.yaw - look);
        if (keys.ArrowUp) P.pitch = clamp(P.pitch + look * inv, -1.45, 1.45);
        if (keys.ArrowDown) P.pitch = clamp(P.pitch - look * inv, -1.45, 1.45);
      }
    } else {
      mouseGuard.pendingX = 0;
      mouseGuard.pendingY = 0;
    }
    const f = input ? ((bindDown('forward') ? 1 : 0) - (bindDown('back') ? 1 : 0)) : 0;
    const s = input ? ((bindDown('right') ? 1 : 0) - (bindDown('left') ? 1 : 0)) : 0;
    const moveYaw = TP_CAM.userMode ? TP_CAM.angle : P.yaw;
    const sy = Math.sin(moveYaw), cy = Math.cos(moveYaw);
    let wx = -sy * f + cy * s, wz = -cy * f - sy * s;
    if (TP_CAM.userMode && input && (f !== 0 || s !== 0 || P.dashT > 0 || P.swingT > 0 || P.kickT > 0 || mouseL || mouseR)) {
      P.yaw = wrapAngle(A.lerpAngle(P.yaw, TP_CAM.angle, Math.min(1, dt * 16)));
    }
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const spd = P.faithMode > 0 ? 12.5 : 10.5;
    if (P.dashT > 0) {
      P.dashT -= dt;
      P.vel.x = P.dashDir.x * 30; P.vel.z = P.dashDir.z * 30;
    } else if (S.cutscene <= 0 || S.csKind !== 'door') {
      const k = Math.min(1, dt * (P.onGround ? 12 : 3.2));
      P.vel.x += (wx * spd - P.vel.x) * k;
      P.vel.z += (wz * spd - P.vel.z) * k;
    }
    P.dashCd = Math.max(0, P.dashCd - dt);
    if (input && P.wantDash && P.dashCd <= 0) {
      let dx = wx, dz = wz;
      if (Math.hypot(dx, dz) < 0.1) { dx = -sy; dz = -cy; }
      const l = Math.hypot(dx, dz); P.dashDir.set(dx / l, 0, dz / l);
      P.dashT = 0.18; P.dashCd = 1.1; P.fovKick = 1; SFX.play('dash');
    }
    P.wantDash = false;

    // Coyote time + Jump buffer + Ground Slam (450 kg) + Ultrakill Slam Jump
    P.slamCd = Math.max(0, (P.slamCd || 0) - dt);
    P.slamJumpT = Math.max(0, (P.slamJumpT || 0) - dt);
    const jumpDown = input && bindDown('jump');
    const jumpJustPressed = jumpDown && !P.wasJumpDown;
    P.wasJumpDown = jumpDown;

    P.coyoteT = P.onGround ? 0.12 : Math.max(0, (P.coyoteT || 0) - dt);
    if (jumpDown) P.jumpBufT = 0.12;
    else P.jumpBufT = Math.max(0, (P.jumpBufT || 0) - dt);
    if (jumpJustPressed) P.slamJumpBufT = 0.14;
    else P.slamJumpBufT = Math.max(0, (P.slamJumpBufT || 0) - dt);

    const wasOnGround = P.onGround;
    if (input && P.jumpBufT > 0 && P.coyoteT > 0) {
      const superJump = P.slamJumpT > 0 && P.slamJumpBufT > 0;
      P.vel.y = superJump ? 18.5 : 10.5;
      P.onGround = false; P.coyoteT = 0; P.jumpBufT = 0; P.slamming = false;
      if (superJump) {
        P.slamJumpT = 0;
        P.slamJumpBufT = 0;
        P.fovKick = Math.max(P.fovKick, 0.85);
        burst(P.pos.x, P.pos.y + 0.2, P.pos.z, 0xd8c8a8, 10, 7, 0.4, 0.22, 10, false);
      }
      SFX.play('jump');
    }
    const curGy = A.groundAt(P.pos.x, P.pos.z, P.pos.y, P.r);
    if (input && !P.onGround && P.pos.y > curGy + 0.7 && !P.slamming && P.slamCd <= 0 && (bindDown('slam') || keys.ControlRight || keys.KeyC)) {
      P.slamming = true;
      P.slamCd = 1.0;
      P.vel.y = -38;
      P.fovKick = Math.max(P.fovKick, 0.6);
    }

    const prevY = P.pos.y;
    P.vel.y -= 30 * dt;
    P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; P.pos.y += P.vel.y * dt;
    resolveCircle(P.pos, P.r, P.pos.y);

    // Cair em cima de qualquer inimigo machuca/mata (stomp dobra o dano base da queda)
    if (P.vel.y < -2.0 && !P.dead) {
      const yMin = Math.min(prevY, P.pos.y);
      const yMax = Math.max(prevY, P.pos.y);
      const fallSpd = Math.max(0, -P.vel.y);
      const baseFallDmg = Math.round(Math.max(45, Math.min(150, fallSpd * 4.2)));
      const fallDmg = P.slamming ? baseFallDmg * 2 : baseFallDmg;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.dead || e.downed || !e.inRender || e.crushCd > 0) continue;
        const ep = e.g.position;
        const eh = e.h || 2.6;
        const dx = ep.x - P.pos.x, dz = ep.z - P.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < P.r + e.r + 0.25 && yMin <= ep.y + eh + 0.75 && yMax >= ep.y + eh * 0.45) {
          e.crushCd = 0.35;
          const l = d || 1;
          const kx = d > 0.05 ? dx / l : -sy;
          const kz = d > 0.05 ? dz / l : -cy;
          dmgEnemy(e, fallDmg, kx, kz, { knock: P.slamming ? 14 : 7, stunBonus: P.slamming ? 0.6 : 0.3, part: 'torso' });
          burst(ep.x, ep.y + eh * 0.75, ep.z, 0xb01010, P.slamming ? 18 : 10, 8, 0.5, 0.25, 14);
          S.style = Math.min(420, S.style + (P.slamming ? 25 : 15));
          P.shake = Math.max(P.shake, P.slamming ? 0.5 : 0.25);
          if (P.slamming) {
            S.hitStop = 0.04 * (SAVE.hitstop != null ? SAVE.hitstop : 1);
            SFX.play('slam');
          } else {
            P.vel.y = 7.5;
            P.onGround = false;
          }
        }
      }
    }

    const gy = A.groundAt(P.pos.x, P.pos.z, P.pos.y, P.r);
    if (P.pos.y <= gy) {
      if (P.slamming) { P.slamming = false; P.landImpact = 1.0; P.slamJumpT = 0.16; doGroundSlam(); }
      else if (!P.onGround && P.vel.y < -4) {
        P.landImpact = Math.min(1, -P.vel.y / 22);
        if (P.vel.y < -12) P.shake = Math.max(P.shake, 0.18);
      }
      P.pos.y = gy; P.vel.y = 0; P.onGround = true;
    } else if (wasOnGround && P.vel.y <= 0 && P.pos.y - gy < 0.45) {
      P.pos.y = gy; P.vel.y = 0; P.onGround = true;
    } else if (P.pos.y > gy + 0.02) P.onGround = false;

    const hs = Math.hypot(P.vel.x, P.vel.z);
    if (P.onGround && hs > 1) {
      P.bob += dt * hs * 1.15;
      const stepIdx = Math.floor((P.bob + Math.PI * 0.25) / Math.PI);
      if (stepIdx !== P.lastStep) {
        P.lastStep = stepIdx;
        if (hs > 2.2 && P.dashT <= 0) {
          P.shake = Math.max(P.shake, 0.30);
          CAM.landVel -= 1.05;
          SFX.play('step');
        }
      }
    }
    if (P.faithMode > 0) {
      P.faithMode -= dt; P.faith = Math.max(0, P.faithMode * 10);
      P.hp = Math.min(P.maxhp, P.hp + 4 * dt);
      if (P.faithMode <= 0) { P.faithMode = 0; P.faith = 0; say('A Super-Fé se acalma…', '', 1.5); }
    }
    if (P.hurtFlash > 0) P.hurtFlash = Math.max(0, P.hurtFlash - dt * 1.4);
    if (P.healFlash > 0) P.healFlash = Math.max(0, P.healFlash - dt * 1.8);
    if (P.flashV > 0) {
      P.flashV = Math.max(0, P.flashV - dt * 2);
      const fk = SAVE.screenFlash != null ? SAVE.screenFlash : 1;
      el('flash').style.opacity = P.flashV * fk;
    }
  }

  /* ---------------- câmera / ambiente ---------------- */
  const envTarget = { fog: new THREE.Color(), amb: new THREE.Color(), sun: new THREE.Color() };
  function getFogTargets(envName) {
    const E = ENV[envName] || ENV.hell;
    const rChunks = World.renderChunks || 8;
    const fogK = SAVE.fogScale != null ? SAVE.fogScale : 1.0;
    const maxUnits = rChunks * World.CHUNK_SIZE;
    const baseFar = envName === 'hell'
      ? maxUnits * 1.05
      : Math.min(E.far * Math.max(0.85, rChunks / 8), maxUnits * 1.05);
    const far = Math.max(32, baseFar * fogK);
    const near = Math.min(E.near * fogK, far * 0.18);
    return { E, near, far };
  }
  function wrapAngle(a) {
    a = (a + Math.PI) % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a - Math.PI;
  }
  function damp(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  function dampAngle(cur, target, rate, dt) {
    return wrapAngle(A.lerpAngle(cur, target, 1 - Math.exp(-rate * dt)));
  }

  const mouseGuard = { warmup: 0, lockAt: 0, pendingX: 0, pendingY: 0 };
  const CAM = {
    x: 0, y: 3.10, z: 6, yaw: 0, pitch: 0, roll: 0, fov: 75,
    bobAmt: 0, landDip: 0, landVel: 0, shakePhase: 0, init: false
  };
  function resetCamera() {
    const baseFov = SAVE.fov || 75;
    CAM.x = P.pos.x;
    CAM.y = P.pos.y + P.eye;
    CAM.z = P.pos.z;
    CAM.yaw = wrapAngle(P.yaw);
    CAM.pitch = clamp(P.pitch, -1.45, 1.45);
    CAM.roll = 0;
    CAM.fov = baseFov + (P.faithMode > 0 ? 6 : 0);
    CAM.bobAmt = 0;
    CAM.landDip = 0;
    CAM.landVel = 0;
    CAM.init = true;
    P.lastStep = Math.floor((P.bob + Math.PI * 0.25) / Math.PI);
    mouseGuard.pendingX = 0;
    mouseGuard.pendingY = 0;
  }

  function applyLightingProfile(dt, isTitle) {
    const lq = SAVE.lightingQuality || 'high';
    if (lq === 'min') {
      A.plight.visible = false;
      A.sun.visible = false;
    } else if (lq === 'low') {
      A.plight.visible = false;
      A.sun.visible = true;
    } else {
      A.plight.visible = true;
      A.sun.visible = true;
      A.plight.distance = lq === 'ultra' ? 38 : (lq === 'high' ? 28 : 20);
      if (isTitle) {
        A.plight.position.set(camera.position.x, camera.position.y + 1.5, camera.position.z);
        A.plight.color.setHex(0xffa860);
        A.plight.intensity = (lq === 'ultra' ? 1.45 : 1.25) + (lq === 'med' ? 0 : Math.sin(titleTime * 13) * 0.12);
      } else {
        A.plight.position.set(camera.position.x, camera.position.y + 0.5, camera.position.z);
        A.plight.color.setHex(P.faithMode > 0 ? 0xffd860 : 0xffc080);
        const baseI = P.faithMode > 0 ? 1.7 : (lq === 'ultra' ? 1.25 : 1.0);
        A.plight.intensity = baseI + (lq === 'med' ? 0 : Math.sin(S.time * 17) * 0.06);
      }
    }
  }

  function updateCamera(dt) {
    if (!CAM.init) resetCamera();

    // Suavização exponencial independente de FPS para rotação e altura
    CAM.yaw = dampAngle(CAM.yaw, P.yaw, 42, dt);
    CAM.pitch = damp(CAM.pitch, P.pitch, 42, dt);
    CAM.x = P.pos.x;
    CAM.z = P.pos.z;
    CAM.y = damp(CAM.y, P.pos.y + P.eye, 26, dt);

    const bobK = SAVE.bob != null ? SAVE.bob : 1.0;
    const rollK = SAVE.roll != null ? SAVE.roll : 1.0;
    const shakeK = SAVE.shake != null ? SAVE.shake : 1.0;

    // Mola sutil de impacto ao aterrissar
    if (P.landImpact > 0) {
      CAM.landVel -= P.landImpact * 4.2 * bobK;
      P.landImpact = 0;
    }
    CAM.landVel += (-CAM.landDip * 180 - CAM.landVel * 22) * dt;
    CAM.landDip = clamp(CAM.landDip + CAM.landVel * dt, -0.45, 0.12);

    // Tremor harmônico suave (substitui ruído aleatório seco)
    if (S.shakeBig) { P.shake = Math.max(P.shake, S.shakeBig * 0.9); S.shakeBig = 0; }
    P.shake = Math.max(0, P.shake - dt * 2.4);
    const sh = P.shake * P.shake * 0.34 * shakeK;
    CAM.shakePhase += dt * 48;
    const sx = (Math.sin(CAM.shakePhase) * 0.65 + Math.sin(CAM.shakePhase * 1.73) * 0.35) * sh;
    const sy = (Math.cos(CAM.shakePhase * 1.27) * 0.65 + Math.sin(CAM.shakePhase * 2.11) * 0.35) * sh;
    const sr = Math.sin(CAM.shakePhase * 1.41) * sh * 0.16;

    // Balanço de caminhada com entrada/saída suave
    const hs = Math.hypot(P.vel.x, P.vel.z);
    const targetBob = Math.min(1, hs / 8) * (P.onGround ? 1 : 0);
    CAM.bobAmt = damp(CAM.bobAmt, targetBob, 10, dt);
    const bobY = Math.sin(P.bob * 2) * 0.05 * CAM.bobAmt * bobK;
    const bobX = Math.cos(P.bob) * 0.03 * CAM.bobAmt * bobK;

    // Inclinação lateral (strafe) suavizada
    const strafe = (!P.dead && S.cutscene <= 0) ? ((bindDown('right') ? 1 : 0) - (bindDown('left') ? 1 : 0)) : 0;
    const targetRoll = -strafe * 0.022 * rollK + (P.dead ? 0.6 : 0);
    CAM.roll = damp(CAM.roll, targetRoll, 14, dt);

    const cinemaBossCam = S.cutscene > 0 && (S.csKind === 'maximusIntro' || S.csKind === 'galiusIntro' || S.csKind === 'maximusPhaseTrans' || S.csKind === 'maximusDeath' || S.csKind === 'door' || S.csKind === 'tomb');
    const tpActive = !cinemaBossCam && isThirdPersonActive();
    updateNivaldo3P();
    if (cinemaBossCam) {
      const b = S.cinemaBoss;
      const smooth = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
      const arrive = smooth(S.csT / 0.55);
      const ret = S.cutscene < 0.45 ? smooth((0.45 - S.cutscene) / 0.45) : 0;
      const cPos = new V3();
      const cLook = new V3();
      let shakeMult = 0.7;
      if (S.csKind === 'maximusIntro') {
        const gy = b ? A.groundAt(b.g.position.x, b.g.position.z, 4, b.r) : 0;
        const bx = b ? b.g.position.x : 0;
        const bz = b ? b.g.position.z : -148;
        const by = b ? b.g.position.y : gy;
        const t = S.csT;
        const pfx = -Math.sin(P.yaw), pfz = -Math.cos(P.yaw);
        const prx = Math.cos(P.yaw), prz = -Math.sin(P.yaw);
        if (t < 3.4) {
          const push = smooth((t - 0.8) / 2.6);
          cPos.set(bx + 4.4 - push * 1.6, gy + 4.2 - push * 1.0, bz + 13.5 - push * 3.8);
          cLook.set(bx, clamp(by + 2.3, gy + 2.3, gy + 18), bz);
          shakeMult = 1.2;
        } else if (t < 6.8) {
          const u = smooth((t - 3.4) / 3.4);
          cPos.set(P.pos.x + pfx * (3.1 - u * 0.4) + prx * 1.35, P.pos.y + 2.1, P.pos.z + pfz * (3.1 - u * 0.4) + prz * 1.35);
          cLook.set(P.pos.x, P.pos.y + 2.05, P.pos.z);
        } else if (t < 11.6) {
          const u = smooth((t - 6.8) / 4.2);
          cPos.set(bx - 3.0 + u * 1.2, gy + 2.3 + u * 0.6, bz + 8.6 - u * 2.2);
          cLook.set(bx, gy + 2.4, bz);
          shakeMult = t >= 8.9 ? 1.15 : 0.6;
        } else {
          const u = smooth((t - 11.6) / 2.2);
          cPos.set(P.pos.x + pfx * (2.8 - u * 0.7) - prx * 1.1, P.pos.y + 1.65 + u * 0.35, P.pos.z + pfz * (2.8 - u * 0.7) - prz * 1.1);
          cLook.set(P.pos.x, P.pos.y + 2.1, P.pos.z);
          shakeMult = 1.5;
        }
      } else if (S.csKind === 'maximusPhaseTrans') {
        const bx = b ? b.g.position.x : 0;
        const bz = b ? b.g.position.z : -148;
        const by = b ? b.g.position.y : 0;
        const push = smooth(S.csT / 4.2);
        const yaw = b ? b.yaw : 0;
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const rx = fz, rz = -fx;
        const dist = 7.4 - push * 2.6;
        cPos.set(bx + fx * dist + rx * (2.4 - push * 1.2), by + 2.1 + push * 0.9, bz + fz * dist + rz * (2.4 - push * 1.2));
        cLook.set(bx, by + 2.4 + push * 0.7, bz);
        shakeMult = 1.1;
      } else if (S.csKind === 'maximusDeath') {
        const mp = S.maximusPos || { x: 0, y: 0, z: -148 };
        const t = S.csT;
        if (t < 2.2) {
          cPos.set(mp.x + 5.0, mp.y + 2.6, mp.z + 4.8);
          cLook.set((P.pos.x + mp.x) * 0.5, mp.y + 1.2, (P.pos.z + mp.z) * 0.5);
        } else if (t < 7.2) {
          const u = smooth((t - 2.2) / 4.0);
          cPos.set(mp.x - 3.8 + u * 0.8, mp.y + 2.1 + u * 0.9, mp.z + 2.9);
          cLook.set(mp.x, mp.y + 0.9 + u * 1.0, mp.z);
        } else if (t < 10.5) {
          const u = smooth((t - 7.2) / 2.2);
          cPos.set(mp.x + 2.5 - u * 0.6, mp.y + 2.1, mp.z + 1.7);
          cLook.set(P.pos.x, P.pos.y + 1.6, P.pos.z - 0.6);
        } else {
          const u = smooth((t - 10.5) / 2.2);
          cPos.set(P.pos.x + 2.7 - u * 1.0, P.pos.y + 1.6 + u * 0.5, P.pos.z - 2.7 + u * 0.6);
          cLook.set(P.pos.x, P.pos.y + 2.1, P.pos.z);
          shakeMult = 1.6;
        }
      } else if (S.csKind === 'door') {
        const u = smooth(S.csT / 1.4);
        cPos.set(4.4 - u * 1.2, 2.2, -160.0 - u * 2.4);
        cLook.set(0, 2.3, -167.2);
        shakeMult = 2.4;
      } else if (S.csKind === 'tomb') {
        const u = smooth(S.csT / 9.5);
        const ang = -0.5 + u * 1.2;
        cPos.set(-4 + Math.sin(ang) * 5.2, 2.6 + u * 1.0, -86 + Math.cos(ang) * 5.2);
        cLook.set((P.pos.x - 4) * 0.5, 2.2, (P.pos.z - 86) * 0.5);
        shakeMult = 0.6;
      } else {
        const t = S.csT;
        const bx = b ? b.g.position.x : 0;
        const bz = b ? b.g.position.z : -148.2;
        const by = b ? b.g.position.y : 1.85;
        if (t < 8.0) {
          const roarPush = (b && b.galiusIntro === 'roar') ? smooth((b.galiusIntroT || 0) / 0.65) : 0;
          cPos.set(-4.8 + roarPush * 2.5, 5.2 - roarPush * 0.6, -128.0 - roarPush * 6.5);
          cLook.set(bx, clamp(by + 3.4, 4.4, 7.2) + roarPush * 0.6, Math.max(-150, bz));
        } else {
          const pfx = -Math.sin(P.yaw), pfz = -Math.cos(P.yaw);
          const prx = Math.cos(P.yaw), prz = -Math.sin(P.yaw);
          const u = smooth((t - 8.0) / 2.4);
          cPos.set(P.pos.x + pfx * (3.0 - u * 0.5) + prx * 1.2, P.pos.y + 1.8 + u * 0.3, P.pos.z + pfz * (3.0 - u * 0.5) + prz * 1.2);
          cLook.set(P.pos.x, P.pos.y + 2.05, P.pos.z);
        }
      }
      if (S.csCamStart && arrive < 1) {
        const st = S.csCamStart;
        cPos.lerpVectors(new V3(st.x, st.y, st.z), cPos, arrive);
        cLook.lerpVectors(new V3(st.tx, st.ty, st.tz), cLook, arrive);
      }
      if (S.csKind === 'maximusPhaseTrans' && ret > 0) {
        const f = fwd3();
        const pEye = new V3(P.pos.x, P.pos.y + P.eye, P.pos.z);
        const pLook = new V3(P.pos.x + f.x * 8, P.pos.y + P.eye + f.y * 8, P.pos.z + f.z * 8);
        cPos.lerp(pEye, ret);
        cLook.lerp(pLook, ret);
      } else if (S.csKind !== 'maximusDeath' && S.csKind !== 'door' && S.csKind !== 'maximusPhaseTrans' && ret > 0) {
        const f = fwd3();
        const pEye = new V3(P.pos.x, P.pos.y + P.eye, P.pos.z);
        const pLook = new V3(P.pos.x + f.x * 8, P.pos.y + P.eye + f.y * 8, P.pos.z + f.z * 8);
        cPos.lerp(pEye, ret);
        cLook.lerp(pLook, ret);
      }
      camera.position.set(cPos.x + sx * shakeMult, cPos.y + sy * shakeMult, cPos.z);
      camera.lookAt(cLook);
    } else if (tpActive) {
      TP_CAM.active = true;
      let dist = 4.2, heightOff = 1.9;
      TP_CAM.target.set(P.pos.x, P.pos.y + 1.80, P.pos.z);
      if (S.glory) {
        dist = S.glory.kind === 'kick' ? 4.4 : (S.glory.kind === 'rip' || S.glory.kind === 'demon_smash' ? 4.9 : 4.2);
        if (S.glory.hit && (S.glory.kind === 'rip' || S.glory.kind === 'decap')) { TP_CAM.target.y += 0.4; }
        if (S.glory.enemyPos) {
          TP_CAM.target.lerp(TP_CAM.lookScratch.set(S.glory.enemyPos.x, P.pos.y + 1.75, S.glory.enemyPos.z), 0.35);
        }
        const horizDist = Math.cos(TP_CAM.pitch) * dist;
        const desiredX = TP_CAM.target.x + Math.sin(TP_CAM.angle) * horizDist;
        const desiredZ = TP_CAM.target.z + Math.cos(TP_CAM.angle) * horizDist;
        const desiredY = TP_CAM.target.y + Math.sin(TP_CAM.pitch) * dist;
        TP_CAM.pos.set(desiredX, desiredY, desiredZ);
      } else if (TP_CAM.userMode) {
        const shoulderDist = 4.8;
        const shoulderRight = 1.15;
        const fx = -Math.sin(TP_CAM.angle);
        const fz = -Math.cos(TP_CAM.angle);
        const rx = Math.cos(TP_CAM.angle);
        const rz = -Math.sin(TP_CAM.angle);
        const horizDist = Math.cos(TP_CAM.pitch) * shoulderDist;
        const camOffY = Math.sin(TP_CAM.pitch) * shoulderDist;
        TP_CAM.target.set(
          P.pos.x + rx * shoulderRight,
          P.pos.y + 2.25 + CAM.landDip * bobK * 0.5,
          P.pos.z + rz * shoulderRight
        );
        TP_CAM.pos.set(
          TP_CAM.target.x - fx * horizDist,
          TP_CAM.target.y + camOffY,
          TP_CAM.target.z - fz * horizDist
        );
      } else {
        const camYaw = P.yaw + 0.58;
        TP_CAM.angle = wrapAngle(A.lerpAngle(TP_CAM.angle, camYaw, Math.min(1, dt * 10)));
        if (S.csKind === 'maximusDeath') {
          dist = 5.6;
          heightOff = 2.2;
          const mp = S.maximusPos || { x: 0, y: 0, z: -148 };
          TP_CAM.target.set((P.pos.x + mp.x) * 0.5, P.pos.y + 1.4, (P.pos.z + mp.z) * 0.5);
        } else if (S.csKind === 'door') {
          dist = 5.4;
          heightOff = 2.15;
          TP_CAM.target.set(P.pos.x - Math.sin(P.yaw) * 0.65, P.pos.y + 1.70, P.pos.z - Math.cos(P.yaw) * 0.65);
        } else if (S.csKind === 'rip') {
          const crossPhase = S.csT >= 3.4 ? clamp((S.csT - 3.4) / 0.5, 0, 1) : 0;
          dist = 5.2 + crossPhase * 4.8;
          heightOff = 2.1 + crossPhase * 1.3;
          if (S.ripTarget && !S.ripTarget.dead) {
            const gp = S.ripTarget.g.position;
            TP_CAM.target.set((P.pos.x + gp.x) * 0.5, P.pos.y + 1.85 + crossPhase * 1.1, (P.pos.z + gp.z) * 0.5);
          }
        }
        const desiredX = TP_CAM.target.x + Math.sin(TP_CAM.angle) * dist;
        const desiredZ = TP_CAM.target.z + Math.cos(TP_CAM.angle) * dist;
        const desiredY = TP_CAM.target.y + heightOff;
        TP_CAM.pos.set(desiredX, desiredY, desiredZ);
      }
      resolveCircle(TP_CAM.pos, 0.5, TP_CAM.pos.y);
      const gy = A.groundAt(TP_CAM.pos.x, TP_CAM.pos.z, TP_CAM.pos.y, 0.4);
      TP_CAM.pos.y = Math.max(TP_CAM.pos.y, gy + 0.55);
      TP_CAM.pos.x += sx * 0.7;
      TP_CAM.pos.y += sy * 0.7;
      camera.position.copy(TP_CAM.pos);
      camera.lookAt(TP_CAM.target);
    } else {
      if (TP_CAM.active) {
        TP_CAM.active = false;
        CAM.x = P.pos.x;
        CAM.z = P.pos.z;
        CAM.y = P.pos.y + P.eye;
        CAM.yaw = wrapAngle(P.yaw);
        CAM.pitch = clamp(P.pitch, -1.45, 1.45);
      }
      const cy = Math.cos(CAM.yaw), syaw = Math.sin(CAM.yaw);
      const camFwd = P.dead ? 0 : 0.18;
      const baseY = P.dead ? P.pos.y + 0.6 : CAM.y + CAM.landDip * bobK + bobY;
      camera.position.set(
        CAM.x - syaw * camFwd + cy * (bobX + sx),
        baseY + sy,
        CAM.z - cy * camFwd - syaw * (bobX + sx)
      );
      camera.rotation.set(CAM.pitch, CAM.yaw, CAM.roll + sr);
    }

    P.fovKick = Math.max(0, P.fovKick - dt * 3.5);
    const baseFov = SAVE.fov || 75;
    const targetFov = baseFov + P.fovKick * 14 + (P.faithMode > 0 ? 6 : 0);
    CAM.fov = damp(CAM.fov, targetFov, 14, dt);
    const { E, near, far } = getFogTargets(envAt(P.pos.x, P.pos.z));
    const camFar = Math.max(90, far * 1.35);
    if (Math.abs(camera.fov - CAM.fov) > 0.03 || Math.abs(camera.far - camFar) > 0.5) {
      camera.fov = CAM.fov;
      camera.far = camFar;
      camera.updateProjectionMatrix();
      A.sky.scale.setScalar((camFar * 0.88) / 400);
    }
    A.sky.position.copy(camera.position);
    applyLightingProfile(dt, false);
    // ambiente + fog ajustado à render distance
    const k = Math.min(1, dt * 2.5);
    envTarget.fog.setHex(E.fog); envTarget.amb.setHex(E.amb); envTarget.sun.setHex(E.dir);
    scene.fog.color.lerp(envTarget.fog, k);
    scene.fog.near += (near - scene.fog.near) * k; scene.fog.far += (far - scene.fog.far) * k;
    const lq = SAVE.lightingQuality || 'high';
    const ambBoost = lq === 'min' ? 1.35 : (lq === 'low' ? 1.12 : 1.0);
    A.amb.color.lerp(envTarget.amb, k); A.amb.intensity += (E.ambI * ambBoost - A.amb.intensity) * k;
    A.sun.color.lerp(envTarget.sun, k); A.sun.intensity += (E.dirI - A.sun.intensity) * k;
    // relâmpago (apenas iluminação alta ou ultra)
    if (lq === 'high' || lq === 'ultra') {
      S.lightT = (S.lightT || rnd(8, 18)) - dt;
      if (S.lightT <= 0 && P.pos.x < 200 && P.pos.z > -216) {
        S.lightT = rnd(10, 22); S.lightning = 0.18; SFX.play('thunder');
      }
      if (S.lightning > 0) {
        S.lightning -= dt;
        const flashK = SAVE.screenFlash != null ? SAVE.screenFlash : 1;
        A.amb.intensity += 1.6 * flashK * (S.lightning > 0.09 ? 1 : 0.5);
      }
    } else {
      S.lightning = 0;
    }
    A.renderer.setClearColor(scene.fog.color);
  }

  const LOW_HP_HEARTBEAT_THRESHOLD = 50;
  function updateLowLifeHeartbeat(dt) {
    if (!S.started || P.dead || P.hp <= 0 || P.hp >= LOW_HP_HEARTBEAT_THRESHOLD || S.cutscene > 0) {
      S.heartbeatT = 0;
      return;
    }
    const t = clamp(1 - P.hp / LOW_HP_HEARTBEAT_THRESHOLD, 0, 1);
    const interval = 1.05 - t * 0.73;
    const vol = 0.55 + t * 0.45;
    S.heartbeatT = (S.heartbeatT || 0) - dt;
    if (S.heartbeatT <= 0) {
      SFX.play('lowlifeHeartbeat', vol);
      S.heartbeatT = interval;
    }
  }

  /* ---------------- tick principal ---------------- */
  function tick(dt) {
    if (S.hitStop > 0) { S.hitStop -= dt; dt *= 0.05; }
    S.time += dt;
    S.levelTime = (S.levelTime || 0) + dt;
    S.quipCd -= dt; S.msgT -= dt; S.baphT -= dt;
    if (S.hitMark > 0) S.hitMark -= dt;
    if (S.ammoFlash > 0) S.ammoFlash -= dt;
    if (S.grin > 0) S.grin -= dt;
    S.style = Math.max(0, S.style - dt * (4 + S.style * 0.04));
    S.levelPeakStyle = Math.max(S.levelPeakStyle || 0, S.style);
    if (P.faith < 100) S.faithReady = false;
    // timeline
    for (let i = S.tl.length - 1; i >= 0; i--) { S.tl[i].t -= dt; if (S.tl[i].t <= 0) { const f = S.tl[i].fn; S.tl.splice(i, 1); f(); } }
    // fade
    if (S.fade) {
      const F = S.fade; F.t += dt;
      if (F.phase === 0) {
        el('flash').style.opacity = Math.min(1, F.t / F.inD);
        if (F.t >= F.inD) { F.phase = 1; F.t = 0; F.cb && F.cb(); }
      } else {
        el('flash').style.opacity = Math.max(0, 1 - F.t / F.outD);
        if (F.t >= F.outD) { S.fade = null; el('flash').style.opacity = 0; }
      }
    }
    if (S.fall) {
      S.fall.vy -= 60 * dt; S.fall.m.position.y = Math.max(2, S.fall.m.position.y + S.fall.vy * dt);
    }
    if (S.boss && S.boss.state === 'phaseTrans' && S.cutscene <= 0 && !S.boss._transCamDone) {
      S.boss._transCamDone = true;
      captureCutsceneCamStart();
      S.cutscene = 5.2;
      S.csKind = 'maximusPhaseTrans';
      S.csT = 0;
      S.cinemaBoss = S.boss;
      setCinemaUI(true);
    }
    updateCutscene(dt);
    updateGloryKill(dt);
    updatePlayer(dt);
    World.updateChunks(P.pos.x, P.pos.z, false);
    updateWeapons(dt);
    updateCross(dt);
    for (let i = enemies.length - 1; i >= 0; i--) { if (enemies[i]) A.updateEnemy(enemies[i], dt); }
    updateGrabbedEnemy(dt);
    for (let i = peasants.length - 1; i >= 0; i--) { if (peasants[i]) A.updatePeasant(peasants[i], dt); }
    A.updateProjs(dt); A.flushGloryQueue(); A.updateRings(dt); A.updateParts(dt);
    updatePickups(dt);
    updateWorld(S.time, dt);
    S.checkT = (S.checkT || 0) - dt;
    if (S.checkT <= 0) { S.checkT = 0.25; checkRooms(); }
    updateEvents(dt);
    // música: intensidade pela quantidade de inimigos agressivos
    let ag = 0; for (const e of enemies) if (e.aggro && e.inRender) ag++;
    if (S.stage !== 'galius1' && S.stage !== 'galius2') SFX.setIntensity(Math.min(1, ag / 10));
    updateCamera(dt);
    if (window.BloodStain) {
      const moveAmt = Math.hypot(P.vel.x, P.vel.z) + (P.dashT > 0 ? 12 : 0) + (P.swingT > 0 ? 6 : 0) + (P.kickT > 0 ? 6 : 0);
      BloodStain.update(dt, moveAmt);
      const b = BloodStain.getBodyBlood();
      if (b > 0.35 && !P.dead && Math.random() < dt * b * 2.0) {
        if (window.RealBlood && RealBlood.emitDrop) {
          const f = fwd3();
          RealBlood.emitDrop(P.pos.x + f.x * 0.4 + rnd(-0.2, 0.2), P.pos.y + 0.35, P.pos.z + f.z * 0.4 + rnd(-0.2, 0.2), rnd(-0.4, 0.4), -1.2, rnd(-0.4, 0.4), 0.10);
        }
      }
    }
    updateVM(dt);
    updateLowLifeHeartbeat(dt);
    updateHUD(dt);
  }
  /* ---------------- cena viva da tela de título (flyby + caos) ---------------- */
  const TITLE_SHOTS = [
    {
      label: 'ÀS MARGENS DO INFERNO · ZONA DEVASTADA',
      dur: 9.5,
      from: new V3(-18, 8.5, 4),
      to:   new V3(16, 6.2, -56),
      lookFrom: new V3(-4, 2.2, -26),
      lookTo:   new V3(-6, 2.0, -48)
    },
    {
      label: 'DESCENDO AO HORROR · PRAÇA PROFANADA',
      dur: 9.5,
      from: new V3(-26, 9.5, -92),
      to:   new V3(24, 7.5, -148),
      lookFrom: new V3(0, 2.8, -118),
      lookTo:   new V3(-4, 2.4, -128)
    },
    {
      label: 'PORTÕES DA ULTRA-IGREJA · GUARDA REAL',
      dur: 8.5,
      from: new V3(-28, 10.5, -172),
      to:   new V3(26, 12.0, -184),
      lookFrom: new V3(0, 4.5, -202),
      lookTo:   new V3(0, 6.5, -208)
    },
    {
      label: 'ULTRA-IGREJA · NAVE CORROMPIDA',
      dur: 9.5,
      from: new V3(-12, 8.0, -226),
      to:   new V3(12, 6.5, -278),
      lookFrom: new V3(2, 3.2, -258),
      lookTo:   new V3(0, 5.5, -294)
    },
    {
      label: 'CATACUMBAS · SALÃO DOS MORTOS',
      dur: 8.5,
      from: new V3(286, 4.8, -48),
      to:   new V3(314, 4.4, -76),
      lookFrom: new V3(302, 2.0, -64),
      lookTo:   new V3(296, 2.0, -66)
    }
  ];

  const TITLE_SPAWNS = [
    // Bairro Alto
    ['campones', -8, -18], ['campones', 8, -22], ['campones', -12, -36], ['campones', 12, -40],
    ['guarda', -2, -28], ['guarda', 6, -46], ['demonio', -4, -42],
    ['diabrete', -10, -26, 4.0], ['diabrete', 10, -34, 4.2], ['gargula', 0, -50, 5.0],
    // Cidade Baixa
    ['guarda', -12, -110], ['guarda', 14, -116], ['guarda', -8, -132],
    ['demonio', -16, -122], ['demonio', 16, -128], ['padre', -6, -106], ['padre', 8, -136],
    ['gargula', -10, -118, 5.2], ['gargula', 12, -124, 5.0], ['diabrete', 0, -112, 4.2],
    // Portões da Ultra-Igreja
    ['maximus', 0, -195], ['guarda', -10, -190], ['guarda', 10, -190], ['demonio', -16, -196], ['demonio', 16, -196],
    ['gargula', -12, -186, 5.5], ['gargula', 12, -186, 5.5],
    // Nave da Ultra-Igreja
    ['demonio', -6, -248], ['demonio', 6, -256], ['padre', -10, -266], ['padre', 10, -268],
    ['guarda', -4, -260], ['guarda', 4, -244], ['gargula', -8, -254, 5.5], ['gargula', 8, -264, 5.5],
    ['diabrete', 0, -250, 4.0], ['diabrete', 0, -272, 4.2],
    // Catacumbas
    ['padre', 294, -56], ['padre', 306, -68], ['guarda', 298, -62], ['guarda', 304, -58],
    ['campones', 292, -66], ['campones', 308, -60], ['diabrete', 300, -64, 3.6]
  ];

  let titleTime = 0, titleShotIdx = 0, titleShotT = 0;
  const titleLook = new V3();

  function initTitleShowcase() {
    clearTitleShowcase();
    if (SFX.setTrack) SFX.setTrack('title');
    World.updateChunks(TITLE_SHOTS[0].from.x, TITLE_SHOTS[0].from.z, true);
    A.spawnMapPeasants('a1');
    for (const sp of TITLE_SPAWNS) {
      const e = A.spawnEnemy(sp[0], sp[1], sp[2], 'title_demo', sp[3]);
      e.homeX = sp[1];
      e.homeZ = sp[2];
      e.wanderAng = rnd(0, Math.PI * 2);
      e.wanderT = rnd(0.5, 2.5);
      e.chaosCd = rnd(0.4, 2.4);
    }
  }

  function clearTitleShowcase() {
    A.clearRoomEnemies('title_demo');
    A.clearProjs();
    A.clearParts();
  }

  function updateTitleEnemy(e, dt) {
    const T = e.T, R = e.rig, pos = e.g.position;
    const inR = World.isPosInRender(e.savedPos.x, e.savedPos.z);
    if (!inR) {
      if (e.inRender) {
        e.savedPos.copy(pos);
        e.savedYaw = e.yaw;
        if (e.flashing) {
          e.flashing = false;
          e.g.traverse(o => { if (o.isMesh && o.userData.om) o.material = o.userData.om; });
        }
        e.g.visible = false;
        e.inRender = false;
      }
      return;
    }
    if (!e.inRender) {
      pos.copy(e.savedPos);
      e.yaw = e.savedYaw;
      e.g.rotation.y = e.savedYaw;
      e.g.visible = true;
      e.inRender = true;
    }

    e.anim += dt * 1.15;
    if (e.flash > 0) {
      e.flash -= dt;
      if (!e.flashing) { e.flashing = true; e.g.traverse(o => { if (o.isMesh) o.material = MT(0xffffff, { basic: true }); }); }
    } else if (e.flashing) {
      e.flashing = false;
      e.g.traverse(o => { if (o.isMesh && o.userData.om) o.material = o.userData.om; });
    }
    if (e.recover > 0) e.recover -= dt;

    // Encontra outro inimigo próximo para brigar e gerar caos
    let rival = null, bestD = 26;
    for (let i = 0; i < enemies.length; i++) {
      const o = enemies[i];
      if (o === e || o.room !== 'title_demo' || !o.inRender) continue;
      const d = dist2(pos.x, pos.z, o.g.position.x, o.g.position.z);
      if (d < bestD) { bestD = d; rival = o; }
    }

    e.wanderT -= dt;
    if (e.wanderT <= 0) {
      e.wanderT = rnd(1.1, 2.8);
      if (rival && Math.random() < 0.72) {
        e.wanderAng = Math.atan2(rival.g.position.x - pos.x, rival.g.position.z - pos.z) + rnd(-0.45, 0.45);
      } else {
        e.wanderAng = Math.atan2(e.homeX - pos.x, e.homeZ - pos.z) + rnd(-0.9, 0.9);
      }
    }

    // Mantém perto da área de origem
    const homeDist = dist2(pos.x, pos.z, e.homeX, e.homeZ);
    if (homeDist > 14) {
      e.wanderAng = Math.atan2(e.homeX - pos.x, e.homeZ - pos.z);
    }

    const spd = (e.state === 'charge' ? 14 : T.speed * 0.85);
    const vx = Math.sin(e.wanderAng) * spd;
    const vz = Math.cos(e.wanderAng) * spd;
    pos.x += vx * dt + e.kv.x * dt;
    pos.z += vz * dt + e.kv.z * dt;
    e.kv.multiplyScalar(Math.max(0, 1 - dt * 5));
    resolveCircle(pos, e.r);

    if (T.flying) {
      pos.y = (T.hover || 3.8) + Math.sin(e.anim * 2.6 + e.homeX) * 0.65;
    }
    e.yaw = A.lerpAngle(e.yaw, e.wanderAng, Math.min(1, dt * 7));
    e.g.rotation.y = e.yaw;
    e.savedPos.copy(pos);
    e.savedYaw = e.yaw;

    // Ações de caos (ataques, bolas de fogo, ondas de choque, sangue e faíscas)
    e.chaosCd -= dt;
    if (e.chaosCd <= 0 && rival) {
      const camD = dist2(pos.x, pos.z, camera.position.x, camera.position.z);
      if (camD < 65) {
        if (T.ranged) {
          e.chaosCd = rnd(1.4, 2.8);
          e.recover = 0.35;
          const o = new V3(pos.x, pos.y + e.h * 0.7, pos.z);
          const tgt = new V3(rival.g.position.x, rival.g.position.y + rival.h * 0.5, rival.g.position.z);
          const dir = tgt.sub(o).normalize();
          spawnProj(T.ranged.proj, o, dir.multiplyScalar(T.ranged.speed), 0, 'title', 0.4, 2.2, 0);
        } else if (T.boss || T.model === 'demonio') {
          e.chaosCd = rnd(2.0, 3.8);
          e.recover = 0.4;
          spawnRing(pos.x, pos.z, T.boss ? 16 : 9, 18, 0, T.boss ? 0xff3a10 : 0xff7a20, 'title');
          burst(pos.x, pos.y + 0.6, pos.z, 0xffaa30, 12, 8, 0.55, 0.25, 14);
          if (bestD < 7) {
            rival.flash = 0.1;
            const dx = rival.g.position.x - pos.x, dz = rival.g.position.z - pos.z, l = Math.hypot(dx, dz) || 1;
            rival.kv.x += (dx / l) * 9; rival.kv.z += (dz / l) * 9;
            burst(rival.g.position.x, rival.g.position.y + 1.1, rival.g.position.z, 0xb01020, 10, 7, 0.6, 0.22, 16);
          }
        } else if (bestD < 4.5) {
          e.chaosCd = rnd(0.9, 1.9);
          e.recover = 0.35;
          rival.flash = 0.08;
          const dx = rival.g.position.x - pos.x, dz = rival.g.position.z - pos.z, l = Math.hypot(dx, dz) || 1;
          rival.kv.x += (dx / l) * 6; rival.kv.z += (dz / l) * 6;
          burst(rival.g.position.x, rival.g.position.y + 1.0, rival.g.position.z, 0xb01020, 8, 6, 0.5, 0.2, 15);
          burst(rival.g.position.x, rival.g.position.y + 1.2, rival.g.position.z, 0xffcc40, 3, 5, 0.35, 0.14, 10);
        } else {
          e.chaosCd = rnd(0.8, 1.6);
        }
      } else {
        e.chaosCd = rnd(1.2, 2.5);
      }
    }

    // Animação dos membros
    const sw = Math.sin(e.anim * T.speed * 2.2) * 0.7;
    const strikeT = e.recover > 0 ? e.recover / 0.35 : 0;
    if (R.legL) { R.legL.rotation.x = sw; R.legR.rotation.x = -sw; }
    if (R.legL && R.armL && !R.book) {
      const base = T.armsFwd ? -1.3 : 0;
      R.armL.rotation.x = base - sw * 0.6;
      R.armR.rotation.x = base + sw * 0.6 - strikeT * 2.2;
    }
    if (R.book) {
      R.book.position.y = 1.55 + Math.sin(e.anim * 3) * 0.08;
      R.armL.rotation.x = -1.2 - strikeT * 1.1;
      R.armR.rotation.x = -1.2 - strikeT * 1.1;
    }
    if (R.wingL) {
      const f = Math.sin(e.anim * (T.model === 'diabrete' ? 18 : 12)) * 0.7;
      R.wingL.rotation.z = f; R.wingR.rotation.z = -f;
    }
  }

  function tickTitle(dt) {
    titleTime += dt;
    titleShotT += dt;
    const shot = TITLE_SHOTS[titleShotIdx];
    if (titleShotT >= shot.dur) {
      titleShotT = 0;
      titleShotIdx = (titleShotIdx + 1) % TITLE_SHOTS.length;
    }
    const cur = TITLE_SHOTS[titleShotIdx];
    const u = clamp(titleShotT / cur.dur, 0, 1);
    const s = u * u * (3 - 2 * u); // smoothstep

    camera.position.lerpVectors(cur.from, cur.to, s);
    camera.position.y += Math.sin(titleTime * 1.6) * 0.28;
    titleLook.lerpVectors(cur.lookFrom, cur.lookTo, s);
    titleLook.y += Math.cos(titleTime * 1.2) * 0.2;
    camera.lookAt(titleLook);
    if (Math.abs(camera.fov - 72) > 0.1) { camera.fov = 72; camera.updateProjectionMatrix(); }
    World.updateChunks(camera.position.x, camera.position.z, false);

    const tagEl = el('titleCamLabel');
    if (tagEl && tagEl.__v !== cur.label) { tagEl.__v = cur.label; tagEl.textContent = cur.label; }

    const { E, near, far } = getFogTargets(envAt(camera.position.x, camera.position.z));
    const camFar = Math.max(90, far * 1.35);
    if (Math.abs(camera.far - camFar) > 0.5) {
      camera.far = camFar;
      camera.updateProjectionMatrix();
      A.sky.scale.setScalar((camFar * 0.88) / 400);
    }
    A.sky.position.copy(camera.position);
    applyLightingProfile(dt, true);

    const k = Math.min(1, dt * 3.5);
    const lq = SAVE.lightingQuality || 'high';
    const ambBoost = lq === 'min' ? 1.35 : (lq === 'low' ? 1.12 : 1.0);
    envTarget.fog.setHex(E.fog); envTarget.amb.setHex(E.amb); envTarget.sun.setHex(E.dir);
    scene.fog.color.lerp(envTarget.fog, k);
    scene.fog.near += (near - scene.fog.near) * k; scene.fog.far += (far - scene.fog.far) * k;
    A.amb.color.lerp(envTarget.amb, k); A.amb.intensity += (E.ambI * ambBoost - A.amb.intensity) * k;
    A.sun.color.lerp(envTarget.sun, k); A.sun.intensity += (E.dirI - A.sun.intensity) * k;
    A.renderer.setClearColor(scene.fog.color);

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i] && enemies[i].room === 'title_demo') updateTitleEnemy(enemies[i], dt);
    }
    for (let i = peasants.length - 1; i >= 0; i--) {
      if (peasants[i]) A.updatePeasant(peasants[i], dt);
    }
    // Atualiza projéteis de demonstração
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i];
      p.life -= dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += dt * 6; p.m.rotation.y += dt * 7;
      let hit = p.life <= 0 || p.m.position.y < 0.2 || A.pointInWall(p.m.position.x, p.m.position.z) || !World.isPosInRender(p.m.position.x, p.m.position.z);
      if (!hit) {
        for (const e of enemies) {
          if (e.room === 'title_demo' && e.inRender && dist2(p.m.position.x, p.m.position.z, e.g.position.x, e.g.position.z) < e.r + 0.45) {
            e.flash = 0.08;
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        burst(p.m.position.x, p.m.position.y, p.m.position.z, p.kind === 'fire' ? 0xff7a10 : 0xcc44ff, 7, 6, 0.4, 0.18, 12);
        scene.remove(p.m);
        projs.splice(i, 1);
      }
    }
    A.updateRings(dt);
    A.updateParts(dt);
    updatePickups(dt);
    updateWorld(titleTime, dt);
  }

  function render() {
    const r = A.renderer;
    A.renderScene();
    if (S.started && SAVE.showVM !== false) {
      r.clearDepth();
      vmCam.position.set(0, 0, 0);
      r.render(vmScene, vmCam);
    }
    if (S.started && navArrowPivot.visible) {
      const aspect = innerWidth / Math.max(1, innerHeight);
      if (Math.abs(navCam.aspect - aspect) > 1e-4) {
        navCam.aspect = aspect;
        navCam.updateProjectionMatrix();
      }
      r.clearDepth();
      r.render(navScene, navCam);
    }
  }

  let last = performance.now(), fpsAcc = 0, fpsFrames = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const cap = SAVE.fpsCap || 0;
    if (cap > 0) {
      const minInterval = 1000 / cap;
      if (now - last < minInterval - 1.2) return;
    }
    const rawDt = (now - last) / 1000;
    const dt = Math.min(0.05, rawDt);
    last = now;
    if (SAVE.showFps) {
      fpsAcc += rawDt;
      fpsFrames++;
      if (fpsAcc >= 0.35) {
        const curFps = Math.round(fpsFrames / fpsAcc);
        fpsAcc = 0; fpsFrames = 0;
        const pInfo = QUALITY_PRESETS[SAVE.qualityPreset];
        const pLbl = pInfo ? pInfo.label : 'PERSONALIZADO';
        setText('fpsCounter', curFps + ' FPS · ' + (SAVE.resH || 360) + 'p · ' + pLbl);
      }
    }
    if (!S.started) tickTitle(dt);
    else if (!S.paused && !S.ended && !S.intermission) tick(dt);
    render();
  }

  /* ---------------- entrada ---------------- */
  function lockReservedKeys() {
    if (!navigator.keyboard || !navigator.keyboard.lock || !document.fullscreenElement) return;
    try {
      const p = navigator.keyboard.lock(['KeyW', 'KeyT', 'KeyN', 'KeyR', 'KeyS', 'KeyA', 'KeyD', 'Tab']);
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  function requestLock() {
    if (nolock) return;
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      try {
        const fs = document.documentElement.requestFullscreen();
        if (fs && fs.then) fs.then(lockReservedKeys).catch(() => {});
      } catch (e) {}
    } else {
      lockReservedKeys();
    }
    const useRaw = SAVE.rawInput !== false;
    try {
      const p = useRaw
        ? renderer.domElement.requestPointerLock({ unadjustedMovement: true })
        : renderer.domElement.requestPointerLock();
      if (p && p.catch) {
        p.catch(() => {
          try {
            const p2 = renderer.domElement.requestPointerLock();
            if (p2 && p2.catch) p2.catch(() => {});
          } catch (e) {}
        });
      }
    } catch (e) {
      try {
        const p2 = renderer.domElement.requestPointerLock();
        if (p2 && p2.catch) p2.catch(() => {});
      } catch (e2) {}
    }
  }
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) lockReservedKeys();
    else if (navigator.keyboard && navigator.keyboard.unlock) {
      try { navigator.keyboard.unlock(); } catch (e) {}
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (!(window.electronAPI && window.electronAPI.isElectron) && S.started && !S.ended) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  function pause(on) {
    if (S.ended || P.dead || S.intermission) return;
    S.paused = on; show('pause', on);
    mouseL = false; mouseR = false;
    mouseGuard.pendingX = 0; mouseGuard.pendingY = 0;
  }
  document.addEventListener('pointerlockchange', () => {
    const wasLocked = P.locked;
    P.locked = document.pointerLockElement === renderer.domElement;
    mouseGuard.pendingX = 0;
    mouseGuard.pendingY = 0;
    if (P.locked && !wasLocked) {
      mouseGuard.warmup = 2;
      mouseGuard.lockAt = performance.now();
    }
    if (!P.locked && S.started && !P.dead && !S.ended && !S.intermission && !nolock) pause(true);
  });
  document.addEventListener('mousemove', (e) => {
    if (!((P.locked || nolock) && S.started && !S.paused && !P.dead && S.cutscene <= 0)) return;
    const mx = e.movementX || 0, my = e.movementY || 0;
    if (P.locked) {
      if (mouseGuard.warmup > 0) { mouseGuard.warmup--; return; }
      if (performance.now() - mouseGuard.lockAt < 45 && Math.hypot(mx, my) > 80) return;
    }
    // Filtra saltos espúrios do Pointer Lock (bug comum no Windows/Chromium que gira 180°)
    if (Math.abs(mx) > 260 || Math.abs(my) > 260 || Math.hypot(mx, my) > 320) return;
    mouseGuard.pendingX += mx;
    mouseGuard.pendingY += my;
  });
  renderer.domElement.addEventListener('click', () => {
    if (S.started && !S.paused && !P.dead && !P.locked && !nolock) requestLock();
  });
  document.addEventListener('mousedown', (e) => {
    if (!S.started || S.paused) return;
    if (e.button === 0) mouseL = true;
    if (e.button === 2) mouseR = true;
  });
  document.addEventListener('mouseup', (e) => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
    if (!S.started || S.paused || P.dead) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    let i = curW();
    for (let n = 0; n < WEAPONS.length; n++) {
      i = (i + dir + WEAPONS.length) % WEAPONS.length;
      if (WEAPONS[i].owned) { selectWeapon(i); break; }
    }
  }, { passive: false });
  function shouldBlockBrowserShortcut(e) {
    const t = e.target;
    const tag = t && t.tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'submit'].includes(t.type))) return false;
    if (e.altKey && (e.code === 'F4' || e.code === 'Tab')) return false;
    if (e.ctrlKey || e.metaKey || e.altKey) return true;
    if (/^F([1-9]|1[0-2])$/.test(e.code)) return true;
    if (e.code === 'Tab' || e.code === 'ContextMenu' || e.code === 'Backspace' || e.code === 'PageUp' || e.code === 'PageDown' || e.code === 'Home' || e.code === 'End') return true;
    if (S.started && !S.paused && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight')) return true;
    return false;
  }
  let rebindAction = null;
  document.addEventListener('keydown', (e) => {
    if (rebindAction) {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        setBindKey(rebindAction, e.code);
      }
      rebindAction = null;
      renderKeybindsTable();
      return;
    }
    if (shouldBlockBrowserShortcut(e)) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    const isOptOpen = el('optionsModal') && !el('optionsModal').classList.contains('hidden');
    if (e.code === 'Escape' && isOptOpen) {
      e.preventDefault();
      closeOptions(false);
      return;
    }
    if (!S.started) {
      if (e.code === 'Escape') closeAllTitleModals();
      return;
    }
    const binds = SAVE.binds || DEFAULT_BINDS;
    if (e.code === (binds.mute || 'KeyM')) {
      const m = SFX.toggleMute();
      SAVE.muted = m;
      writeSave();
    }
    if (S.intermission) {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); finishLevelComplete(); }
      return;
    }
    if (e.code === (binds.respawn || 'KeyR') && P.dead) respawn();
    if (S.paused) {
      if (e.code === 'Escape' && !isOptOpen) { pause(false); requestLock(); }
      return;
    }
    if (e.code === (binds.dash || 'ShiftLeft') || (binds.dash === 'ShiftLeft' && e.code === 'ShiftRight')) P.wantDash = true;
    if (e.code === (binds.use || 'KeyE')) P.wantUse = true;
    if (e.code === (binds.glory || 'KeyF')) P.wantGlory = true;
    if (e.code === (binds.kick || 'KeyQ')) startKick();
    if (e.code === (binds.faith || 'KeyV')) activateFaith();
    if (e.code.startsWith('Digit')) { const n = parseInt(e.code.slice(5), 10) - 1; if (n >= 0 && n < WEAPONS.length) selectWeapon(n); }
    if (e.code === 'F1') { e.preventDefault(); WEAPONS.forEach(w => w.owned = true); P.rocks = 80; P.blood = 100; P.hp = P.maxhp; P.faith = 100; updateSlots(); say('[DEV] Arsenal completo', '', 2); }
    if (e.code === 'F2') { e.preventDefault(); P.god = !P.god; say('[DEV] Modo deus: ' + (P.god ? 'ON' : 'OFF'), '', 2); }
    if (e.code === 'F3') { e.preventDefault(); devClear(); }
    if (e.code === 'F5') { e.preventDefault(); toggleThirdPerson(); }
  });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    mouseL = false; mouseR = false;
    mouseGuard.pendingX = 0; mouseGuard.pendingY = 0;
  });

  function devClear() {
    for (const e of enemies.slice()) {
      if (S.objRoom && e.room !== S.objRoom) continue;
      if (e.T.immortal) continue;
      if (e.T.model === 'galius') { dmgEnemy(e, 1e5, 0, 0, {}); dmgEnemy(e, 1e5, 0, 0, {}); continue; }
      killEnemy(e);
    }
  }

  /* ---------------- início e carregamento ---------------- */
  function startGame(opts) {
    if (S.started) return;
    opts = opts || {};
    nolock = !!opts.nolock;
    clearTitleShowcase();
    closeAllTitleModals();
    SFX.init();
    if (window.BloodStain) BloodStain.reset();
    show('title', false); show('hud', true);
    S.started = true; S.paused = false;
    requestLock();

    const sv = opts.resumeSave;
    const diffMax = A.DIFFICULTIES.length - 1;
    if (opts.difficulty != null) S.difficulty = clamp(parseInt(opts.difficulty, 10) || 0, 0, diffMax);
    else if (sv && sv.difficulty != null) S.difficulty = clamp(parseInt(sv.difficulty, 10) || 0, 0, diffMax);
    else S.difficulty = 2;
    if (sv) {
      if (Array.isArray(sv.owned)) {
        sv.owned.forEach((own, idx) => { if (WEAPONS[idx]) WEAPONS[idx].owned = !!own; });
      }
      const postMaximus = !!(sv.hasRosary || sv.stage === 'door' || sv.stage === 'galius1' || (sv.objRoom && (sv.objRoom.startsWith('a6_nave') || sv.objRoom.startsWith('a6_crypt') || sv.objRoom.startsWith('a6_galius'))));
      P.hasRosary = postMaximus;
      P.maxhp = postMaximus ? 300 : (sv.maxhp || 200);
      P.hp = sv.hp || P.maxhp;
      P.faith = sv.faith || 0;
      P.rocks = sv.rocks || 0;
      P.blood = sv.blood || 0;
      S.kills = sv.kills || 0;
      S.time = sv.time || 0;
      S.stage = sv.stage || 'a1';
      const roomToStart = (sv.objRoom && ROOMS[sv.objRoom]) ? sv.objRoom : 'a1';
      let mapToLoad = roomToStart;
      if (roomToStart.startsWith('a6_crypt')) mapToLoad = 'a6_crypt';
      else if (roomToStart === 'a6_nave' || roomToStart === 'a6_galius1' || roomToStart === 'a6_galius2') mapToLoad = 'a6_nave';
      loadMap(mapToLoad, {
        keepPlayer: true,
        x: sv.x != null ? sv.x : 0,
        z: sv.z != null ? sv.z : 10,
        yaw: sv.yaw || 0,
        room: roomToStart
      });
      if (Array.isArray(sv.cleared)) {
        sv.cleared.forEach(rid => {
          if (S.rooms[rid]) { S.rooms[rid].spawned = true; S.rooms[rid].cleared = true; }
          if (rid === 'a6_crypt1') openGate('g_c1');
          if (rid === 'a6_crypt2') openGate('g_c2');
          if (rid === 'a6_crypt3') openGate('g_c3');
        });
      }
      if (sv.stage === 'door') openGate('door');
      if (sv.stage === 'galius1') {
        if (World.breakWall) { World.breakWall.visible = false; World.breakWall.userData.col.active = false; }
        if (World.altarCross) World.altarCross.visible = false;
        openAltar(true);
      }
      updateSlots();
      if (sv.curW != null && WEAPONS[sv.curW] && WEAPONS[sv.curW].owned) selectWeapon(sv.curW, true);
      if (opts.episodeIntro) {
        say(opts.episodeIntro, 'NIVALDO', 4.5);
      } else {
        say('JOGO CARREGADO — ' + (ROOMS[roomToStart] ? ROOMS[roomToStart].name : 'CAPÍTULO 1'), 'NIVALDO', 4);
      }
      return;
    }

    loadMap('a1', { keepPlayer: false, x: 0, z: 10, yaw: 0, room: 'a1' });
    say('ANO 666 D.S.C. — O Portal Maligno engoliu a cidade. Hora de trabalhar.', 'NIVALDO', 5);
  }

  function syncPickupsRenderState() {
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      const inR = World.isPosInRender(p.x, p.z);
      if (inR && !p.inRender) p.g.position.copy(p.savedPos);
      else if (!inR && p.inRender) p.savedPos.copy(p.g.position);
      p.inRender = inR;
      p.g.visible = inR;
    }
  }

  function applyRenderDistanceChange(val) {
    SAVE.renderDist = clamp(parseInt(val, 10) || 10, 2, 16);
    A.setRenderDistance(SAVE.renderDist);
    syncPickupsRenderState();
    const vx = S.started ? P.pos.x : camera.position.x;
    const vz = S.started ? P.pos.z : camera.position.z;
    const { near, far } = getFogTargets(envAt(vx, vz));
    scene.fog.near = near;
    scene.fog.far = far;
    SAVE.qualityPreset = detectMatchingPreset(SAVE);
    syncSettingsUI();
    writeSave();
  }

  function detectMatchingPreset(cfg) {
    for (const pid of Object.keys(QUALITY_PRESETS)) {
      const p = QUALITY_PRESETS[pid];
      let match = true;
      for (const k of PRESET_KEYS) {
        if (typeof p[k] === 'number') {
          if (Math.abs((Number(cfg[k]) || 0) - p[k]) > 0.01) { match = false; break; }
        } else if (cfg[k] !== p[k]) {
          match = false; break;
        }
      }
      if (match) return pid;
    }
    return 'custom';
  }

  function applyCrosshairStyle(cfg) {
    const style = cfg.chStyle || 'cross';
    const col = cfg.chColor || '#ffd24a';
    const sz = clamp(parseFloat(cfg.chSize) || 1.0, 0.5, 2.0);
    ['crosshair', 'crosshairPreview'].forEach(id => {
      const node = el(id);
      if (!node) return;
      node.className = 'ch-' + style;
      node.style.setProperty('--ch-color', col);
      node.style.setProperty('--ch-scale', String(sz));
    });
  }

  function applySettingsToEngine(cfg) {
    cfg = cfg || SAVE;
    // Vídeo & Qualidade
    A.setInternalHeight(cfg.resH || 360);
    A.setRenderDistance(clamp(parseInt(cfg.renderDist, 10) || 10, 2, 16));
    syncPickupsRenderState();
    A.setSSAO(cfg.ssaoQuality || 'high');
    if (World.setWorldDetail) World.setWorldDetail(cfg.worldDetail || 'high');
    A.setBlobShadows(cfg.blobShadows !== false);
    A.setPsxJitter(cfg.psxJitter || 'normal');
    if (window.TX && TX.setFilter) TX.setFilter(cfg.texFilter || 'nearest');
    A.setPixelatedCanvas(cfg.pixelatedCanvas !== false);
    A.setBloodMode(cfg.bloodMode === 'realistic' ? 'realistic' : 'simple');

    // Gore & Partículas
    A.setGoreQuality(cfg.goreQuality || 'high');
    A.setParticleScale(cfg.particleScale != null ? cfg.particleScale : 1.0);
    A.setGoreImpact(cfg.goreVol != null ? cfg.goreVol : 0.55);
    A.setGoreDuration(cfg.goreDur != null ? cfg.goreDur : 20);
    A.setDismember(cfg.dismember !== false);
    A.setBleedJoints(cfg.bleedJoints !== false);
    A.setGibDrips(cfg.gibDrips !== false);

    // HUD & Jogabilidade
    A.setPeasantLabels(cfg.peasantLabels !== false);
    show('fpsCounter', !!cfg.showFps);
    show('radar', cfg.showRadar !== false);
    show('face', cfg.showFace !== false);
    show('styleBox', cfg.showStyle !== false);
    applyCrosshairStyle(cfg);

    // Áudio
    SFX.setVolume(cfg.vol != null ? cfg.vol : 0.55);
    if (SFX.setMusicVolume) SFX.setMusicVolume(cfg.musicVol != null ? cfg.musicVol : 0.50);
    SFX.setGoreVolume(cfg.goreVol != null ? cfg.goreVol : 0.55);
    if (SFX.setScreams) SFX.setScreams(cfg.screams !== false);
    if (SFX.setMuted) SFX.setMuted(!!cfg.muted);

    // Atualiza fog imediatamente
    const vx = S.started ? P.pos.x : camera.position.x;
    const vz = S.started ? P.pos.z : camera.position.z;
    const { near, far } = getFogTargets(envAt(vx, vz));
    scene.fog.near = near;
    scene.fog.far = far;
  }

  function applyPreset(presetId, targetCfg) {
    const p = QUALITY_PRESETS[presetId];
    if (!p) return;
    const dst = targetCfg || SAVE;
    for (const k of PRESET_KEYS) dst[k] = p[k];
    dst.qualityPreset = presetId;
    applySettingsToEngine(dst);
    syncSettingsUI(dst);
    if (dst === SAVE) writeSave();
  }

  // coleciona pickups do mapa e inicia vitrine 3D da tela de título
  SAVE.qualityPreset = detectMatchingPreset(SAVE);
  applySettingsToEngine(SAVE);
  spawnMapPickups('a1');
  buildSlots(); updateSlots();
  A.bind({ die, say, quip, spawnPickup });
  P.wantDash = false; P.wantUse = false;
  initTitleShowcase();
  refreshRecordUI();

  function formatGoreDur(v) {
    const n = Number(v);
    return (!Number.isFinite(n) || n >= 61 || n <= 0) ? 'Infinito' : Math.round(n) + 's';
  }
  function formatKeyName(code) {
    if (!code) return '—';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    const map = {
      Space: 'ESPAÇO',
      ShiftLeft: 'SHIFT ESQ.',
      ShiftRight: 'SHIFT DIR.',
      ControlLeft: 'CTRL ESQ.',
      ControlRight: 'CTRL DIR.',
      AltLeft: 'ALT ESQ.',
      AltRight: 'ALT DIR.',
      Tab: 'TAB',
      Enter: 'ENTER',
      Backspace: 'BACKSPACE',
      ArrowUp: 'SETA ↑',
      ArrowDown: 'SETA ↓',
      ArrowLeft: 'SETA ←',
      ArrowRight: 'SETA →'
    };
    return map[code] || code.toUpperCase();
  }

  const BIND_ACTIONS = [
    { id: 'forward', label: 'Mover para Frente' },
    { id: 'back',    label: 'Mover para Trás' },
    { id: 'left',    label: 'Estrafar à Esquerda' },
    { id: 'right',   label: 'Estrafar à Direita' },
    { id: 'jump',    label: 'Pular' },
    { id: 'dash',    label: 'Dash (Esquiva Rápida)' },
    { id: 'slam',    label: 'Enterrada no Ar (450 kg)' },
    { id: 'use',     label: 'Interagir / Usar Portão' },
    { id: 'glory',   label: 'Glory Kill (Finalização)' },
    { id: 'kick',    label: 'Chute (Empurrar / Lançar Inimigo)' },
    { id: 'faith',   label: 'Ativar Super-Fé' },
    { id: 'respawn', label: 'Renascer ao Morrer' },
    { id: 'mute',    label: 'Alternar Mudo' }
  ];

  function renderKeybindsTable(cfg) {
    const box = el('valveBindsList');
    if (!box) return;
    const src = (cfg && cfg.binds) || SAVE.binds || DEFAULT_BINDS;
    box.innerHTML = '';
    BIND_ACTIONS.forEach(act => {
      const row = document.createElement('div');
      const waiting = rebindAction === act.id;
      row.className = 'valve-bind-row' + (waiting ? ' waiting' : '');
      const kName = waiting ? 'PRESSIONE UMA TECLA…' : formatKeyName(src[act.id] || DEFAULT_BINDS[act.id]);
      row.innerHTML =
        '<span class="valve-bind-action">' + act.label + '</span>' +
        '<span class="valve-bind-key">' + kName + '</span>';
      row.addEventListener('click', () => {
        rebindAction = waiting ? null : act.id;
        renderKeybindsTable(cfg);
      });
      box.appendChild(row);
    });
  }

  function setBindKey(actionId, keyCode) {
    if (!SAVE.binds) SAVE.binds = Object.assign({}, DEFAULT_BINDS);
    SAVE.binds[actionId] = keyCode;
    markOptionsDirty();
    writeSave();
  }

  function syncPresetChips(activePreset) {
    const pInfo = QUALITY_PRESETS[activePreset];
    const badge = el('presetActiveBadge');
    if (badge) {
      badge.textContent = pInfo ? pInfo.label : 'PERSONALIZADO';
      badge.classList.toggle('custom', !pInfo);
    }
    document.querySelectorAll('#modalPresetStrip .preset-chip, #pausePresetStrip .preset-chip').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === activePreset);
    });
  }

  function syncSettingsUI(cfg) {
    cfg = cfg || SAVE;
    const activePreset = detectMatchingPreset(cfg);
    cfg.qualityPreset = activePreset;
    syncPresetChips(activePreset);

    const setVal = (id, v) => { const e = el(id); if (e) e.value = String(v); };
    const setChk = (id, v) => { const e = el(id); if (e) e.checked = !!v; };
    const setLbl = (id, v) => { const e = el(id); if (e) e.textContent = v; };

    // Aba 1: Vídeo & Qualidade
    setVal('optQualityPreset', activePreset);
    setVal('optResH', cfg.resH || 360);
    setVal('optRenderDist', cfg.renderDist || 10);
    setLbl('optRenderDistVal', (cfg.renderDist || 10) + ' ch');
    setVal('optFogScale', cfg.fogScale != null ? cfg.fogScale : 1.0);
    setLbl('optFogScaleVal', Math.round((cfg.fogScale != null ? cfg.fogScale : 1.0) * 100) + '%');
    setVal('optSsaoQuality', cfg.ssaoQuality || 'high');
    setVal('optLighting', cfg.lightingQuality || 'high');
    setVal('optWorldDetail', cfg.worldDetail || 'high');
    setChk('optBlobShadows', cfg.blobShadows !== false);
    setVal('optPsxJitter', cfg.psxJitter || 'normal');
    setVal('optTexFilter', cfg.texFilter || 'nearest');
    setChk('optPixelatedCanvas', cfg.pixelatedCanvas !== false);
    setVal('optBloodMode', cfg.bloodMode === 'realistic' ? 'realistic' : 'simple');
    setVal('optFov', cfg.fov || 75);
    setLbl('optFovVal', Math.round(cfg.fov || 75) + '°');
    setVal('optFpsCap', cfg.fpsCap || 0);

    // Aba 2: Sangue & Efeitos
    setVal('optGoreQuality', cfg.goreQuality || 'high');
    setVal('optParticleScale', cfg.particleScale != null ? cfg.particleScale : 1.0);
    setLbl('optParticleScaleVal', Math.round((cfg.particleScale != null ? cfg.particleScale : 1.0) * 100) + '%');
    setVal('optGoreImpact', cfg.goreVol != null ? cfg.goreVol : 0.55);
    setLbl('optGoreImpactVal', Math.round((cfg.goreVol != null ? cfg.goreVol : 0.55) * 100) + '%');
    setVal('optGoreDur', cfg.goreDur != null ? cfg.goreDur : 20);
    setLbl('optGoreDurVal', formatGoreDur(cfg.goreDur));
    setChk('optDismember', cfg.dismember !== false);
    setChk('optBleedJoints', cfg.bleedJoints !== false);
    setChk('optGibDrips', cfg.gibDrips !== false);

    // Aba 3: Jogabilidade & HUD
    setVal('optBob', cfg.bob != null ? cfg.bob : 1.0);
    setLbl('optBobVal', Math.round((cfg.bob != null ? cfg.bob : 1.0) * 100) + '%');
    setVal('optRoll', cfg.roll != null ? cfg.roll : 1.0);
    setLbl('optRollVal', Math.round((cfg.roll != null ? cfg.roll : 1.0) * 100) + '%');
    setVal('optShake', cfg.shake != null ? cfg.shake : 1.0);
    setLbl('optShakeVal', Math.round((cfg.shake != null ? cfg.shake : 1.0) * 100) + '%');
    setVal('optHitstop', cfg.hitstop != null ? cfg.hitstop : 1.0);
    setLbl('optHitstopVal', Math.round((cfg.hitstop != null ? cfg.hitstop : 1.0) * 100) + '%');
    setVal('optVmBob', cfg.vmBob != null ? cfg.vmBob : 1.0);
    setLbl('optVmBobVal', Math.round((cfg.vmBob != null ? cfg.vmBob : 1.0) * 100) + '%');
    setVal('optScreenFlash', cfg.screenFlash != null ? cfg.screenFlash : 1.0);
    setLbl('optScreenFlashVal', Math.round((cfg.screenFlash != null ? cfg.screenFlash : 1.0) * 100) + '%');
    setChk('optShowVM', cfg.showVM !== false);
    setChk('optShowRadar', cfg.showRadar !== false);
    setChk('optShowFace', cfg.showFace !== false);
    setChk('optShowStyle', cfg.showStyle !== false);
    setChk('optQuips', cfg.quips !== false);
    setChk('optPeasantLabels', cfg.peasantLabels !== false);
    setChk('optShowFps', !!cfg.showFps);

    // Aba 4: Mouse & Mira
    setVal('optSens', cfg.sens != null ? cfg.sens : 1.0);
    setLbl('optSensVal', Number(cfg.sens != null ? cfg.sens : 1.0).toFixed(2) + 'x');
    setChk('optInvertY', !!cfg.invertY);
    setChk('optRawInput', cfg.rawInput !== false);
    setVal('optChStyle', cfg.chStyle || 'cross');
    setVal('optChColor', cfg.chColor || '#ffd24a');
    setVal('optChSize', cfg.chSize != null ? cfg.chSize : 1.0);
    setLbl('optChSizeVal', Number(cfg.chSize != null ? cfg.chSize : 1.0).toFixed(1) + 'x');
    setChk('optShowHitmarker', cfg.showHitmarker !== false);
    applyCrosshairStyle(cfg);

    // Aba 5: Áudio
    setVal('optVol', cfg.vol != null ? cfg.vol : 0.55);
    setLbl('optVolVal', Math.round((cfg.vol != null ? cfg.vol : 0.55) * 100) + '%');
    setVal('optMusicVol', cfg.musicVol != null ? cfg.musicVol : 0.50);
    setLbl('optMusicVolVal', Math.round((cfg.musicVol != null ? cfg.musicVol : 0.50) * 100) + '%');
    setVal('optGoreVol', cfg.goreVol != null ? cfg.goreVol : 0.55);
    setLbl('optGoreVolVal', Math.round((cfg.goreVol != null ? cfg.goreVol : 0.55) * 100) + '%');
    setChk('optScreams', cfg.screams !== false);
    setChk('optMuted', !!cfg.muted);

    // Aba 6: Teclado
    renderKeybindsTable(cfg);

    if (el('continueBtn')) {
      el('continueBtn').classList.toggle('disabled-look', !SAVE.savedGame);
    }
  }

  let optionsSnapshot = null;
  function cloneSettingsSnapshot(src) {
    const snap = {};
    for (const k of Object.keys(SETTINGS_DEFAULTS)) {
      if (k === 'binds') snap.binds = Object.assign({}, src.binds || DEFAULT_BINDS);
      else snap[k] = src[k];
    }
    return snap;
  }
  function markOptionsDirty() {
    if (el('optApplyBtn')) el('optApplyBtn').disabled = false;
  }
  function openOptions() {
    optionsSnapshot = cloneSettingsSnapshot(SAVE);
    rebindAction = null;
    syncSettingsUI(SAVE);
    if (el('optApplyBtn')) el('optApplyBtn').disabled = true;
    show('optionsModal', true);
  }
  function closeOptions(commit) {
    rebindAction = null;
    if (!commit && optionsSnapshot) {
      Object.assign(SAVE, optionsSnapshot);
      SAVE.binds = Object.assign({}, DEFAULT_BINDS, optionsSnapshot.binds || {});
      applySettingsToEngine(SAVE);
      syncSettingsUI(SAVE);
    }
    writeSave();
    optionsSnapshot = null;
    show('optionsModal', false);
  }
  function applyOptions() {
    optionsSnapshot = cloneSettingsSnapshot(SAVE);
    writeSave();
    if (el('optApplyBtn')) el('optApplyBtn').disabled = true;
  }
  function resetOptionsToDefaults() {
    Object.assign(SAVE, SETTINGS_DEFAULTS);
    SAVE.binds = Object.assign({}, DEFAULT_BINDS);
    applySettingsToEngine(SAVE);
    syncSettingsUI(SAVE);
    markOptionsDirty();
    writeSave();
  }

  // Abas do diálogo de configurações
  document.querySelectorAll('#optionsModal .valve-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      rebindAction = null;
      document.querySelectorAll('#optionsModal .valve-tab').forEach(t => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('#optionsModal .valve-pane').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-pane') === target);
      });
      try { SFX.init(); SFX.play('ui'); } catch (e) {}
    });
  });

  // Botões de Preset rápido (no Modal e no Menu de Pausa)
  document.querySelectorAll('#modalPresetStrip .preset-chip, #pausePresetStrip .preset-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = btn.getAttribute('data-preset');
      if (!pid || !QUALITY_PRESETS[pid]) return;
      applyPreset(pid, SAVE);
      markOptionsDirty();
      try { SFX.init(); SFX.play('ui'); } catch (err) {}
    });
  });

  // Helper para vincular controles individuais
  function bindOpt(id, evt, handler) {
    const node = el(id);
    if (!node) return;
    node.addEventListener(evt, (e) => {
      handler(e.target);
      SAVE.qualityPreset = detectMatchingPreset(SAVE);
      applySettingsToEngine(SAVE);
      syncSettingsUI(SAVE);
      markOptionsDirty();
      writeSave();
    });
  }

  if (el('optQualityPreset')) {
    el('optQualityPreset').addEventListener('change', (e) => {
      const v = e.target.value;
      if (QUALITY_PRESETS[v]) {
        applyPreset(v, SAVE);
        markOptionsDirty();
      }
    });
  }

  // Controles de Vídeo & Qualidade
  bindOpt('optResH', 'change', t => { SAVE.resH = parseInt(t.value, 10) || 360; });
  bindOpt('optRenderDist', 'input', t => { SAVE.renderDist = clamp(parseInt(t.value, 10) || 10, 2, 16); });
  bindOpt('optFogScale', 'input', t => { SAVE.fogScale = clamp(parseFloat(t.value) || 1.0, 0.5, 1.8); });
  bindOpt('optSsaoQuality', 'change', t => { SAVE.ssaoQuality = t.value; });
  bindOpt('optLighting', 'change', t => { SAVE.lightingQuality = t.value; });
  bindOpt('optWorldDetail', 'change', t => { SAVE.worldDetail = t.value; });
  bindOpt('optBlobShadows', 'change', t => { SAVE.blobShadows = !!t.checked; });
  bindOpt('optPsxJitter', 'change', t => { SAVE.psxJitter = t.value; });
  bindOpt('optTexFilter', 'change', t => { SAVE.texFilter = t.value; });
  bindOpt('optPixelatedCanvas', 'change', t => { SAVE.pixelatedCanvas = !!t.checked; });
  bindOpt('optBloodMode', 'change', t => { SAVE.bloodMode = t.value === 'realistic' ? 'realistic' : 'simple'; });  bindOpt('optFov', 'input', t => { SAVE.fov = clamp(parseInt(t.value, 10) || 75, 60, 110); });
  bindOpt('optFpsCap', 'change', t => { SAVE.fpsCap = parseInt(t.value, 10) || 0; });

  if (el('optFullscreenBtn')) {
    el('optFullscreenBtn').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // Controles de Sangue & Efeitos
  bindOpt('optGoreQuality', 'change', t => { SAVE.goreQuality = t.value; });
  bindOpt('optParticleScale', 'input', t => { SAVE.particleScale = clamp(parseFloat(t.value) || 1.0, 0.15, 2.2); });
  bindOpt('optGoreImpact', 'input', t => { SAVE.goreVol = clamp(parseFloat(t.value), 0, 1); SFX.init(); });
  bindOpt('optGoreDur', 'input', t => { SAVE.goreDur = parseInt(t.value, 10) || 20; });
  bindOpt('optDismember', 'change', t => { SAVE.dismember = !!t.checked; });
  bindOpt('optBleedJoints', 'change', t => { SAVE.bleedJoints = !!t.checked; });
  bindOpt('optGibDrips', 'change', t => { SAVE.gibDrips = !!t.checked; });

  // Controles de Jogabilidade & HUD
  bindOpt('optBob', 'input', t => { SAVE.bob = parseFloat(t.value); });
  bindOpt('optRoll', 'input', t => { SAVE.roll = parseFloat(t.value); });
  bindOpt('optShake', 'input', t => { SAVE.shake = parseFloat(t.value); });
  bindOpt('optHitstop', 'input', t => { SAVE.hitstop = parseFloat(t.value); });
  bindOpt('optVmBob', 'input', t => { SAVE.vmBob = parseFloat(t.value); });
  bindOpt('optScreenFlash', 'input', t => { SAVE.screenFlash = parseFloat(t.value); });
  bindOpt('optShowVM', 'change', t => { SAVE.showVM = !!t.checked; });
  bindOpt('optShowRadar', 'change', t => { SAVE.showRadar = !!t.checked; });
  bindOpt('optShowFace', 'change', t => { SAVE.showFace = !!t.checked; });
  bindOpt('optShowStyle', 'change', t => { SAVE.showStyle = !!t.checked; });
  bindOpt('optQuips', 'change', t => { SAVE.quips = !!t.checked; });
  bindOpt('optPeasantLabels', 'change', t => { SAVE.peasantLabels = !!t.checked; });
  bindOpt('optShowFps', 'change', t => { SAVE.showFps = !!t.checked; });

  // Controles de Mouse & Mira
  bindOpt('optSens', 'input', t => { SAVE.sens = parseFloat(t.value) || 1.0; });
  bindOpt('optInvertY', 'change', t => { SAVE.invertY = !!t.checked; });
  bindOpt('optRawInput', 'change', t => { SAVE.rawInput = !!t.checked; });
  bindOpt('optChStyle', 'change', t => { SAVE.chStyle = t.value; });
  bindOpt('optChColor', 'change', t => { SAVE.chColor = t.value; });
  bindOpt('optChSize', 'input', t => { SAVE.chSize = parseFloat(t.value) || 1.0; });
  bindOpt('optShowHitmarker', 'change', t => { SAVE.showHitmarker = !!t.checked; });

  // Controles de Áudio
  bindOpt('optVol', 'input', t => { SAVE.vol = parseFloat(t.value); SFX.init(); });
  bindOpt('optMusicVol', 'input', t => { SAVE.musicVol = parseFloat(t.value); SFX.init(); });
  bindOpt('optGoreVol', 'input', t => { SAVE.goreVol = parseFloat(t.value); SFX.init(); });
  bindOpt('optScreams', 'change', t => { SAVE.screams = !!t.checked; });
  bindOpt('optMuted', 'change', t => { SAVE.muted = !!t.checked; SFX.init(); });

  // Botões do rodapé do Modal de Configurações
  if (el('optCloseX')) el('optCloseX').addEventListener('click', () => closeOptions(false));
  if (el('optCancelBtn')) el('optCancelBtn').addEventListener('click', () => closeOptions(false));
  if (el('optOkBtn')) el('optOkBtn').addEventListener('click', () => closeOptions(true));
  if (el('optApplyBtn')) el('optApplyBtn').addEventListener('click', () => applyOptions());
  if (el('optDefaultsBtn')) el('optDefaultsBtn').addEventListener('click', () => resetOptionsToDefaults());
  if (el('optionsModal')) {
    el('optionsModal').addEventListener('click', (e) => {
      if (e.target.id === 'optionsModal') closeOptions(false);
    });
  }

  syncSettingsUI(SAVE);

  let pendingDifficulty = 2;

  function closeAllTitleModals() {
    ['titleDifficultyModal', 'titleChapterModal', 'titleEpisodeModal', 'titleLoadModal', 'titleExitModal'].forEach(id => {
      if (el(id)) show(id, false);
    });
    if (el('optionsModal') && !el('optionsModal').classList.contains('hidden')) {
      closeOptions(true);
    }
  }

  function populateDifficulties() {
    const list = el('difficultyList');
    if (!list) return;
    list.innerHTML = '';
    const fmtMul = (n) => Number(n.toFixed(2)) + 'x';
    A.DIFFICULTIES.forEach(d => {
      const item = document.createElement('div');
      item.className = 'save-slot-item' + (d.id === 5 ? ' diff-hellslayer' : '');
      item.innerHTML =
        '<div>' +
          '<div class="save-slot-title">' + d.label + '</div>' +
          '<div class="save-slot-meta">' + d.desc + '</div>' +
        '</div>' +
        '<div class="save-slot-badge">' + fmtMul(d.spawnMul) + ' INIMIGOS · ' + fmtMul(d.dmgMul) + ' DANO</div>';
      item.addEventListener('click', () => {
        pendingDifficulty = d.id;
        closeAllTitleModals();
        show('titleChapterModal', true);
      });
      list.appendChild(item);
    });
  }

  const EPISODES = [
    {
      title: 'ÀS MARGENS DO INFERNO',
      badge: 'ÁREAS 1–3',
      desc: 'Bairro Alto, Campos da Perdição e Subúrbio Exterior. Recupere seu estilingue na casinha, pegue a foice nos celeiros e abra caminho até a cidade.',
      preview: { map: 'a1', pos: [-14, 6.5, 10], look: [-4, 2.2, -32], env: 'hell' },
      data: null
    },
    {
      title: 'DESCENDO AO HORROR',
      badge: 'ÁREAS 4–5',
      desc: 'Casarões dos Super-Ricos e Avenida do Horror. Ninhos de demônios maiores, super-gárgulas, padres e o Martelo de Demolição.',
      intro: 'ÁREAS 4-5 — DESCENDO AO HORROR. A fúria de Nivaldo aumenta a cada segundo…',
      preview: { map: 'a4', pos: [-14, 8.5, 8], look: [0, 6, -50], env: 'hell' },
      data: { x: 0, z: 10, yaw: 0, stage: 'a3done', objRoom: 'a4', hp: 200, rocks: 35, owned: [true, true, true, true, false, false, false], cleared: ['a1', 'a2', 'a3'] }
    },
    {
      title: 'A ULTRA-IGREJA',
      badge: 'ÁREA 6',
      desc: 'Enfrente Sérgio Maximo no pátio, invada a mega-estrutura, desça às catacumbas e encare Galius, o Super-Ateu criado por Baphomet.',
      intro: 'ÁREA 6 — A ULTRA-IGREJA. Sérgio Maximo guarda os portões da Mega-Estrutura.',
      preview: { map: 'a6_gate', pos: [0, 9.5, -18], look: [0, 22, -165], env: 'hell' },
      data: { x: 0, z: 10, yaw: 0, stage: 'a5done', objRoom: 'a6_gate', hp: 200, rocks: 50, owned: [true, true, true, true, true, false, false], cleared: ['a1', 'a2', 'a3', 'a4', 'a5'] }
    }
  ];

  // Aplica texturas procedurais do jogo nas janelas de menu
  try {
    const rootStyle = document.documentElement.style;
    ['stone', 'church', 'brick'].forEach(name => {
      const tex = TX.get(name);
      if (tex && tex.image && tex.image.toDataURL) {
        rootStyle.setProperty('--tex-' + name, 'url("' + tex.image.toDataURL() + '")');
      }
    });
  } catch (e) {}

  let episodePreviews = null;
  function captureEpisodePreviews() {
    if (episodePreviews) return episodePreviews;
    episodePreviews = [];
    try {
      const savedPos = camera.position.clone();
      const savedQuat = camera.quaternion.clone();
      const savedFov = camera.fov;
      const savedSky = A.sky.position.clone();
      const savedPlight = A.plight.position.clone();
      const savedFogCol = scene.fog.color.getHex();
      const savedFogNear = scene.fog.near;
      const savedFogFar = scene.fog.far;
      const savedAmbCol = A.amb.color.getHex();
      const savedAmbI = A.amb.intensity;
      const savedSunCol = A.sun.color.getHex();
      const savedSunI = A.sun.intensity;
      const savedRenderChunks = World.renderChunks;

      const c = document.createElement('canvas');
      c.width = 192;
      c.height = 108;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;

      World.renderChunks = 16;
      EPISODES.forEach((ep, i) => {
        const pv = ep.preview;
        if (pv.map && World.currentMap !== pv.map) buildMap(pv.map);
        World.updateChunks(pv.pos[0], pv.pos[2], true);
        const E = ENV[pv.env] || ENV.hell;
        camera.position.set(pv.pos[0], pv.pos[1], pv.pos[2]);
        camera.lookAt(pv.look[0], pv.look[1], pv.look[2]);
        camera.fov = 68;
        camera.updateProjectionMatrix();
        A.sky.position.copy(camera.position);
        A.plight.position.set(camera.position.x, camera.position.y + 2, camera.position.z);
        scene.fog.color.setHex(E.fog);
        scene.fog.near = E.near;
        scene.fog.far = E.far;
        A.amb.color.setHex(E.amb); A.amb.intensity = E.ambI;
        A.sun.color.setHex(E.dir); A.sun.intensity = E.dirI;
        A.renderer.setClearColor(scene.fog.color);
        A.renderer.render(scene, camera);
        g.clearRect(0, 0, c.width, c.height);
        g.drawImage(A.renderer.domElement, 0, 0, c.width, c.height);
        episodePreviews[i] = c.toDataURL('image/png');
      });
      World.renderChunks = savedRenderChunks;
      if (World.currentMap !== 'a1') buildMap('a1');
      World.updateChunks(savedPos.x, savedPos.z, true);
      A.syncRenderDistanceEntities();

      camera.position.copy(savedPos);
      camera.quaternion.copy(savedQuat);
      camera.fov = savedFov;
      camera.updateProjectionMatrix();
      A.sky.position.copy(savedSky);
      A.plight.position.copy(savedPlight);
      scene.fog.color.setHex(savedFogCol);
      scene.fog.near = savedFogNear;
      scene.fog.far = savedFogFar;
      A.amb.color.setHex(savedAmbCol); A.amb.intensity = savedAmbI;
      A.sun.color.setHex(savedSunCol); A.sun.intensity = savedSunI;
      A.renderer.setClearColor(scene.fog.color);
    } catch (e) {}
    return episodePreviews;
  }

  function populateEpisodes() {
    const list = el('episodeList');
    if (!list) return;
    const thumbs = captureEpisodePreviews();
    list.innerHTML = '';
    EPISODES.forEach((ep, idx) => {
      const item = document.createElement('div');
      item.className = 'episode-item';
      const thumbSrc = (thumbs && thumbs[idx]) ? thumbs[idx] : '';
      item.innerHTML =
        '<img class="episode-thumb" alt="' + ep.title + '" src="' + thumbSrc + '">' +
        '<div class="episode-info">' +
          '<div class="episode-head">' +
            '<div class="save-slot-title">EPISÓDIO ' + (idx + 1) + ' · ' + ep.title + '</div>' +
            '<div class="save-slot-badge">' + ep.badge + '</div>' +
          '</div>' +
          '<div class="episode-desc">' + ep.desc + '</div>' +
        '</div>';
      item.addEventListener('click', () => {
        if (!ep.data) startGame({ difficulty: pendingDifficulty });
        else startGame({ resumeSave: ep.data, episodeIntro: ep.intro, difficulty: pendingDifficulty });
      });
      list.appendChild(item);
    });
  }

  const STAGE_PRESETS = [
    {
      title: 'Área 1 · Bairro Alto (Início)',
      meta: 'Ep. 1 · Casa de Nivaldo e Vizinhança',
      badge: 'ÁREA 1',
      data: { x: 0, z: 10, yaw: 0, stage: 'a1', objRoom: 'a1', hp: 200, rocks: 0, owned: [true, true, false, false, false, false, false], cleared: [] }
    },
    {
      title: 'Área 2 · Campos da Perdição',
      meta: 'Ep. 1 · Plantações, Celeiros e a Foice',
      badge: 'ÁREA 2',
      data: { x: 0, z: 10, yaw: 0, stage: 'a1done', objRoom: 'a2', hp: 200, rocks: 20, owned: [true, true, true, false, false, false, false], cleared: ['a1'] }
    },
    {
      title: 'Área 3 · Subúrbio Exterior',
      meta: 'Ep. 1 · Estrada da Cidade e Guardas',
      badge: 'ÁREA 3',
      data: { x: 0, z: 10, yaw: 0, stage: 'a2done', objRoom: 'a3', hp: 200, rocks: 30, owned: [true, true, true, true, false, false, false], cleared: ['a1', 'a2'] }
    },
    {
      title: 'Área 4 · Casarões dos Super-Ricos',
      meta: 'Ep. 2 · Mansões em Chamas e Martelo de Demolição',
      badge: 'ÁREA 4',
      data: { x: 0, z: 10, yaw: 0, stage: 'a3done', objRoom: 'a4', hp: 200, rocks: 35, owned: [true, true, true, true, false, false, false], cleared: ['a1', 'a2', 'a3'] }
    },
    {
      title: 'Área 5 · Avenida do Horror',
      meta: 'Ep. 2 · Ninhos Infernais rumo à Ultra-Igreja',
      badge: 'ÁREA 5',
      data: { x: 0, z: 10, yaw: 0, stage: 'a4done', objRoom: 'a5', hp: 200, rocks: 45, owned: [true, true, true, true, true, false, false], cleared: ['a1', 'a2', 'a3', 'a4'] }
    },
    {
      title: 'Área 6 · Portões da Ultra-Igreja (Sérgio Maximo)',
      meta: 'Ep. 3 · Confronto contra o Líder da Guarda Real',
      badge: 'ÁREA 6',
      data: { x: 0, z: 10, yaw: 0, stage: 'a5done', objRoom: 'a6_gate', hp: 200, rocks: 50, owned: [true, true, true, true, true, false, false], cleared: ['a1', 'a2', 'a3', 'a4', 'a5'] }
    },
    {
      title: 'Área 6 · Nave da Ultra-Igreja',
      meta: 'Ep. 3 · Interior da Mega-Estrutura',
      badge: 'NAVE',
      data: { x: 0, z: -8, yaw: 0, stage: 'door', objRoom: 'a6_nave', hp: 200, rocks: 60, owned: [true, true, true, true, true, false, false], cleared: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6_gate'] }
    },
    {
      title: 'Área 6 · Catacumbas de Rômulo III',
      meta: 'Ep. 3 · Subsolo em busca da Sacra Cruz Papal',
      badge: 'CRIPTA',
      data: { x: 0, z: -4, yaw: 0, stage: 'crypt', objRoom: 'a6_crypt1', hp: 200, rocks: 60, owned: [true, true, true, true, true, false, false], cleared: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6_gate', 'a6_nave', 'a6_galius1'] }
    }
  ];

  function populateSaveSlots() {
    const list = el('saveSlotsList');
    if (!list) return;
    list.innerHTML = '';

    // Slot 1: Checkpoint salvo automaticamente
    const autoSlot = document.createElement('div');
    if (SAVE.savedGame) {
      const sv = SAVE.savedGame;
      const m = Math.floor((sv.time || 0) / 60), s = Math.floor((sv.time || 0) % 60);
      const diffIdx = clamp(sv.difficulty != null ? parseInt(sv.difficulty, 10) : 2, 0, A.DIFFICULTIES.length - 1);
      const diffTxt = A.DIFFICULTIES[diffIdx] ? ' · ' + A.DIFFICULTIES[diffIdx].short : '';
      autoSlot.className = 'save-slot-item';
      autoSlot.innerHTML =
        '<div><div class="save-slot-title">Último Checkpoint Salvo</div>' +
        '<div class="save-slot-meta">' + (sv.areaLabel || 'Capítulo 1') + diffTxt + ' · Tempo ' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ' · Chacina ' + (sv.kills || 0) + '</div></div>' +
        '<div class="save-slot-badge">CONTINUAR</div>';
      autoSlot.addEventListener('click', () => startGame({ resumeSave: sv }));
    } else {
      autoSlot.className = 'save-slot-item empty';
      autoSlot.innerHTML =
        '<div><div class="save-slot-title">Nenhum Checkpoint Salvo</div>' +
        '<div class="save-slot-meta">Inicie uma partida para gravar o progresso automaticamente.</div></div>' +
        '<div class="save-slot-badge">VAZIO</div>';
    }
    list.appendChild(autoSlot);

    // Seletores de capítulos/zonas
    STAGE_PRESETS.forEach(p => {
      const item = document.createElement('div');
      item.className = 'save-slot-item';
      item.innerHTML =
        '<div><div class="save-slot-title">' + p.title + '</div>' +
        '<div class="save-slot-meta">' + p.meta + '</div></div>' +
        '<div class="save-slot-badge">' + p.badge + '</div>';
      item.addEventListener('click', () => startGame({ resumeSave: p.data }));
      list.appendChild(item);
    });
  }

  document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      try { SFX.init(); SFX.play('ui'); } catch (e) {}
    });
  });

  el('startBtn').addEventListener('click', () => {
    closeAllTitleModals();
    populateDifficulties();
    show('titleDifficultyModal', true);
  });
  if (el('closeDifficultyBtn')) el('closeDifficultyBtn').addEventListener('click', closeAllTitleModals);
  if (el('chapter1Card')) {
    el('chapter1Card').addEventListener('click', () => {
      closeAllTitleModals();
      populateEpisodes();
      show('titleEpisodeModal', true);
    });
  }
  if (el('closeChapterBtn')) {
    el('closeChapterBtn').addEventListener('click', () => {
      closeAllTitleModals();
      populateDifficulties();
      show('titleDifficultyModal', true);
    });
  }
  if (el('backToChaptersBtn')) {
    el('backToChaptersBtn').addEventListener('click', () => {
      closeAllTitleModals();
      show('titleChapterModal', true);
    });
  }
  if (el('continueBtn')) {
    el('continueBtn').addEventListener('click', () => {
      if (SAVE.savedGame) startGame({ resumeSave: SAVE.savedGame });
      else startGame();
    });
  }
  if (el('loadBtn')) {
    el('loadBtn').addEventListener('click', () => {
      closeAllTitleModals();
      populateSaveSlots();
      show('titleLoadModal', true);
    });
  }
  if (el('settingsBtn')) {
    el('settingsBtn').addEventListener('click', () => {
      closeAllTitleModals();
      openOptions();
    });
  }
  if (el('pauseSettingsBtn')) {
    el('pauseSettingsBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      openOptions();
    });
  }
  if (el('pauseMainMenuBtn')) {
    el('pauseMainMenuBtn').addEventListener('click', () => {
      location.reload();
    });
  }
  if (el('pauseExitBtn')) {
    el('pauseExitBtn').addEventListener('click', () => {
      if (window.electronAPI && window.electronAPI.quit) {
        window.electronAPI.quit();
        return;
      }
      window.close();
      location.reload();
    });
  }
  if (el('exitBtn')) {
    el('exitBtn').addEventListener('click', () => {
      closeAllTitleModals();
      show('titleExitModal', true);
    });
  }
  if (el('closeLoadBtn')) el('closeLoadBtn').addEventListener('click', closeAllTitleModals);
  if (el('cancelExitBtn')) el('cancelExitBtn').addEventListener('click', closeAllTitleModals);
  if (el('confirmExitBtn')) {
    el('confirmExitBtn').addEventListener('click', () => {
      if (window.electronAPI && window.electronAPI.quit) {
        window.electronAPI.quit();
        return;
      }
      window.close();
      closeAllTitleModals();
      el('titleCamLabel').textContent = 'SESSÃO ENCERRADA · FECHE A ABA OU CLIQUE EM NOVO JOGO';
    });
  }
  ['titleDifficultyModal', 'titleChapterModal', 'titleEpisodeModal', 'titleLoadModal', 'titleExitModal'].forEach(id => {
    if (el(id)) el(id).addEventListener('click', (e) => { if (e.target.id === id) closeAllTitleModals(); });
  });

  el('resumeBtn').addEventListener('click', () => { pause(false); requestLock(); });
  el('respawnBtn').addEventListener('click', () => respawn());
  el('againBtn').addEventListener('click', () => location.reload());
  el('pause').addEventListener('click', (e) => { if (e.target.id === 'pause') { pause(false); requestLock(); } });

  window.__game = { start: startGame, tick, tickTitle, render, P, S, WEAPONS, enemies, peasants, World, ROOMS, startRoom, devClear, pickups, say, selectWeapon, attack, altAttack, respawn, SAVE, QUALITY_PRESETS, applyPreset, applySettingsToEngine, applyRenderDistanceChange, setMouse: (v) => { mouseL = v; }, get curW() { return curW(); } };
  if (location.search.includes('autostart')) startGame({ nolock: true });
  requestAnimationFrame(frame);
})();
