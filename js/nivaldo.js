'use strict';
/* ============================================================
   HELLSLAYER - Nivaldo Cruz (modelo da arte de referência)
   Peito nu musculoso, mullet cacheado + barba, corrente de ouro
   com cruz, munhequeiras de couro com spikes, cinto com fivela de
   latão, bolsas de ferramentas, calça cargo marrom e coturnos.

   Mantém EXATAMENTE a mesma hierarquia/posições de juntas do
   buildNivaldo clássico (legL/kneeL/footL, torsoGroup, chestGroup,
   head, shoulderX/armX/forearmX/handX + props), então todas as
   animações de game2.js continuam funcionando sem alteração.

   BUILD.nivaldo        -> este modelo
   BUILD.nivaldoClassic -> o modelo antigo de caixas
   ============================================================ */
(function () {
  const V3 = THREE.Vector3;

  /* ---------------- RNG determinístico ---------------- */
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return (h % 2147483646) + 1;
  }
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  /* ---------------- Texturas procedurais (PS1, 128px) ---------------- */
  const texCache = {};
  let texFilter = THREE.NearestFilter;
  let bloodLvl = 0.25;

  function speck(g, r, S, n, cols, smin, smax) {
    for (let i = 0; i < n; i++) {
      const s = smin + Math.floor(r() * (smax - smin + 1));
      g.fillStyle = pick(r, cols);
      g.fillRect(Math.floor(r() * S), Math.floor(r() * S), s, s);
    }
  }
  function blotch(g, r, x, y, rad, col, alpha) {
    g.globalAlpha = alpha;
    g.fillStyle = col;
    const n = 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = r() * rad * 0.7;
      const rr = rad * (0.4 + r() * 0.6);
      g.beginPath();
      g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  // Sangue: manchas + escorridos verticais com gota na ponta
  function bloodLayer(g, r, S, lvl, cols, mult) {
    if (lvl <= 0) return;
    const m = mult || 1;
    const nSmear = Math.round(lvl * 9 * m);
    for (let i = 0; i < nSmear; i++) blotch(g, r, r() * S, r() * S, 3 + r() * 9, pick(r, cols), 0.5 + r() * 0.3);
    const nDrip = Math.round(lvl * 20 * m);
    for (let i = 0; i < nDrip; i++) {
      const x = Math.floor(r() * S), y0 = Math.floor(r() * S * 0.75);
      const len = 5 + Math.floor(r() * S * 0.32), w = 1 + Math.floor(r() * 3);
      g.globalAlpha = 0.75 + r() * 0.25;
      g.fillStyle = pick(r, cols);
      g.fillRect(x, y0, w, len);
      g.fillRect(x - 1, y0 + len - 1, w + 2, 2);
      if (r() < 0.5) g.fillRect(x + w, y0 + Math.floor(len * 0.4), 1, Math.floor(len * 0.35));
    }
    g.globalAlpha = 1;
    speck(g, r, S, Math.round(lvl * 140 * m), cols, 1, 2);
  }

  const MAKERS = {
    // Pele marrom com pintas escuras (como na arte) — cor base no tom "highlight"
    skin(g, S, r, lvl) {
      g.fillStyle = '#8c5b3b'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 70; i++) blotch(g, r, r() * S, r() * S, 4 + r() * 12, pick(r, ['#7a4c30', '#9a6644', '#83543a', '#704628']), 0.28);
      speck(g, r, S, S * S * 0.06, ['#5e3824', '#6a4029', '#553220'], 1, 1);
      speck(g, r, S, S * S * 0.012, ['#4a2a18', '#3e2414'], 1, 2);
      speck(g, r, S, S * S * 0.02, ['#a7744f', '#b07c56'], 1, 1);
      bloodLayer(g, r, S, lvl, ['#7a0a0e', '#5e0609', '#8e1014', '#4a0406']);
    },
    // Calça cargo: marrom escuro com pintas claras/avermelhadas + manchas secas
    pants(g, S, r, lvl) {
      g.fillStyle = '#3f281b'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 90; i++) blotch(g, r, r() * S, r() * S, 2 + r() * 6, pick(r, ['#573824', '#4c2e1e', '#5c3020']), 0.7);
      speck(g, r, S, S * S * 0.05, ['#7c5538', '#6e4a30', '#86603e'], 1, 2);
      speck(g, r, S, S * S * 0.04, ['#26170f', '#2e1c12'], 1, 1);
      g.globalAlpha = 0.07; g.fillStyle = '#000';
      for (let y = 0; y < S; y += 2) g.fillRect(0, y, S, 1);
      g.globalAlpha = 1;
      for (let i = 0; i < 6; i++) blotch(g, r, r() * S, r() * S, 5 + r() * 10, '#4a1410', 0.45);
      bloodLayer(g, r, S, lvl, ['#5a0a0a', '#6e0c0e', '#3e0606'], 0.9);
    },
    // Couro caramelo dos coturnos e das bolsas
    leather(g, S, r, lvl) {
      g.fillStyle = '#8b5a35'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 60; i++) blotch(g, r, r() * S, r() * S, 3 + r() * 9, pick(r, ['#6e4426', '#a06a40', '#7a4c2c', '#94603a']), 0.5);
      g.strokeStyle = '#5a361e'; g.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const x = r() * S, y = r() * S, a = r() * Math.PI, l = 3 + r() * 9;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      speck(g, r, S, S * S * 0.03, ['#5e3a20', '#b07c50', '#4a2c16'], 1, 1);
      for (let i = 0; i < 4; i++) blotch(g, r, r() * S, r() * S, 6 + r() * 10, '#4a3020', 0.4);
      bloodLayer(g, r, S, lvl, ['#6a1612', '#7e1a14', '#4e0e0a'], 0.8);
    },
    // Couro escuro do cinto e das munhequeiras
    darkLeather(g, S, r) {
      g.fillStyle = '#2b1d15'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 50; i++) blotch(g, r, r() * S, r() * S, 3 + r() * 8, pick(r, ['#3a281c', '#1e140e', '#33231a']), 0.6);
      g.strokeStyle = '#4a3424'; g.lineWidth = 1;
      for (let i = 0; i < 30; i++) {
        const x = r() * S, y = r() * S, a = r() * Math.PI, l = 2 + r() * 7;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      speck(g, r, S, S * S * 0.03, ['#4e3828', '#140c08'], 1, 1);
    },
    // Cabelo/barba: textura em tons de cinza (a cor vem do material / cores de vértice)
    hair(g, S, r) {
      g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, S, S);
      speck(g, r, S, S * S * 0.18, ['#ffffff', '#8a8a8a', '#6a6a6a', '#d8d8d8'], 1, 2);
      g.strokeStyle = '#5a5a5a'; g.lineWidth = 1;
      for (let i = 0; i < 90; i++) {
        g.beginPath();
        g.arc(r() * S, r() * S, 1.5 + r() * 3, r() * 6, r() * 6 + 3.5);
        g.stroke();
      }
    }
  };
  const BLOOD_TEX = { skin: true, pants: true, leather: true };

  function tex(name) {
    const lvl = BLOOD_TEX[name] ? bloodLvl : 0;
    const key = name + '@' + lvl;
    if (texCache[key]) return texCache[key];
    const S = 128;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    MAKERS[name](g, S, rng(hashStr(name)), lvl);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = texFilter;
    t.generateMipmaps = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (texCache[key] = t);
  }

  // Respeita a opção de filtragem de textura do menu de opções
  if (window.TX && TX.setFilter) {
    const origSetFilter = TX.setFilter;
    TX.setFilter = function (mode) {
      origSetFilter(mode);
      const f = mode === 'linear' ? THREE.LinearFilter : THREE.NearestFilter;
      if (f === texFilter) return;
      texFilter = f;
      for (const k in texCache) { const t = texCache[k]; t.magFilter = t.minFilter = f; t.needsUpdate = true; }
    };
  }

  /* ---------------- Materiais ---------------- */
  const matCache = {};
  // Material texturizado: cor do material = multiplicador de tom (sombra/realce)
  function TM(texName, mul, o) {
    o = o || {};
    const lvl = BLOOD_TEX[texName] ? bloodLvl : 0;
    const key = texName + '@' + lvl + '|' + mul + '|' + (o.vc ? 'v' : '') + '|' + (o.em || 0);
    if (matCache[key]) return matCache[key];
    const m = new THREE.MeshLambertMaterial({ color: mul, map: tex(texName), vertexColors: !!o.vc, emissive: o.em || 0x000000 });
    psx(m);
    return (matCache[key] = m);
  }
  // Material liso com cores de vértice (peças mescladas: spikes, corrente, cadarços)
  function VM(em) {
    const key = 'vc|' + (em || 0);
    if (matCache[key]) return matCache[key];
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, emissive: em || 0x000000 });
    psx(m);
    return (matCache[key] = m);
  }

  /* ---------------- Geometrias ---------------- */
  const geoCache = {};
  const k3 = (v) => v.toFixed(3);
  function sphereGeo(rx, ry, rz, ws, hs) {
    ws = ws || 10; hs = hs || 7;
    const key = 's' + k3(rx) + k3(ry) + k3(rz) + ws + hs;
    if (geoCache[key]) return geoCache[key];
    const g = new THREE.SphereGeometry(1, ws, hs);
    g.scale(rx, ry, rz);
    return (geoCache[key] = g);
  }
  function cylGeo(rt, rb, h, seg, zs) {
    seg = seg || 10; zs = zs || 1;
    const key = 'c' + k3(rt) + k3(rb) + k3(h) + seg + k3(zs);
    if (geoCache[key]) return geoCache[key];
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    if (zs !== 1) g.scale(1, 1, zs);
    return (geoCache[key] = g);
  }
  function place(m, parent, x, y, z, rot) {
    m.position.set(x || 0, y || 0, z || 0);
    if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    parent.add(m);
    return m;
  }
  // Músculo / volume arredondado (elipsoide low-poly com Gouraud, bem PS1)
  function blob(parent, rx, ry, rz, mat, x, y, z, rot, seg) {
    const m = new THREE.Mesh(sphereGeo(rx, ry, rz, seg, seg ? Math.max(5, Math.round(seg * 0.7)) : 7), mat);
    m.userData.roundSplat = 'sphere';
    return place(m, parent, x, y, z, rot);
  }
  function cyl(parent, rt, rb, h, mat, x, y, z, rot, seg, zs) {
    const m = new THREE.Mesh(cylGeo(rt, rb, h, seg, zs), mat);
    m.userData.roundSplat = 'cyl';
    return place(m, parent, x, y, z, rot);
  }
  function box(parent, w, h, d, mat, x, y, z, rot) {
    return place(new THREE.Mesh(BX(w, h, d), mat), parent, x, y, z, rot);
  }

  /* ---------------- Mesclador (1 draw call para muitas peças) ---------------- */
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3(), _s = new V3(), _c = new THREE.Color();
  function Acc() { this.parts = []; }
  Acc.prototype.add = function (geo, x, y, z, rot, color, scl) {
    const m = new THREE.Matrix4();
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(scl ? scl[0] : 1, scl ? scl[1] : 1, scl ? scl[2] : 1);
    m.compose(_p, _q, _s);
    this.parts.push({ geo, m, color });
    return this;
  };
  Acc.prototype.addMatrix = function (geo, m, color) { this.parts.push({ geo, m, color }); return this; };
  // Segmento cilíndrico entre dois pontos (veias, cadarços, elos)
  Acc.prototype.seg = function (a, b, r, color, seg) {
    const d = new V3().subVectors(b, a), len = d.length();
    if (len < 1e-4) return this;
    const g = cylGeo(r, r, 1, seg || 4);
    const m = new THREE.Matrix4();
    _q.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
    _p.addVectors(a, b).multiplyScalar(0.5);
    _s.set(1, len, 1);
    m.compose(_p, _q, _s);
    return this.addMatrix(g, m, color);
  };
  Acc.prototype.build = function (mat) {
    let total = 0;
    const list = this.parts.map((p) => {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      g.applyMatrix4(p.m);
      total += g.attributes.position.count;
      return { g, c: _c.setHex(p.color).clone() };
    });
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
    const uv = new Float32Array(total * 2), col = new Float32Array(total * 3);
    let o = 0;
    for (const { g, c } of list) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      for (let i = 0; i < n; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
      o += n;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingSphere();
    out.computeBoundingBox();
    const mesh = new THREE.Mesh(out, mat);
    mesh.userData.noSplat = true; // sem manchas 3D flutuando em volta de peças mescladas
    return mesh;
  };

  /* ============================================================
     BUILDER
     ============================================================ */
  function buildNivaldoRef(opts) {
    opts = opts || {};
    bloodLvl = Math.round(THREE.MathUtils.clamp(opts.blood == null ? 0.25 : opts.blood, 0, 1) * 4) / 4;

    const root = new THREE.Group();
    const scale = 1.28;
    root.scale.setScalar(scale);
    const rig = { root, h: 2.48 * scale };

    const M = {
      skin: TM('skin', 0xd2d2d2),
      skinHi: TM('skin', 0xffffff),
      skinSh: TM('skin', 0xa2a2a2),
      skinVC: TM('skin', 0xffffff, { vc: true }),
      pants: TM('pants', 0xffffff),
      pantsDk: TM('pants', 0xa6a6a6),
      boot: TM('leather', 0xffffff),
      bootDk: TM('leather', 0x9a9a9a),
      pouch: TM('leather', 0xf0dcc4),
      pouchDk: TM('leather', 0xb8a690),
      belt: TM('darkLeather', 0xffffff),
      cuff: TM('darkLeather', 0xd6d6d6),
      hairVC: TM('hair', 0xffffff, { vc: true }),
      beard: TM('hair', 0x24170e),
      brow: TM('hair', 0x1a100a),
      sole: MT(0x22170f),
      welt: MT(0x4e3220),
      brass: MT(0xa8843e, { em: 0x1a1000 }),
      gold: MT(0xe8b830, { em: 0x3a2800 }),
      goldDk: MT(0xa87a12, { em: 0x201400 }),
      steel: MT(0xaab0b8),
      steelDk: MT(0x5a5e66),
      wood: MT(0x5e3c22),
      lip: MT(0x4e2a22),
      socket: MT(0x2a170e),
      mouth: MT(0x1a0a08, { basic: true }),
      eyeW: MT(0xf0e6d0, { basic: true }),
      pupil: MT(0x100808, { basic: true }),
      vc: VM(),
      vcGold: VM(0x2a1c00)
    };
    const ironCone = new THREE.ConeGeometry(0.026, 0.1, 5);
    const studGeo = new THREE.SphereGeometry(0.012, 4, 3);

    /* ---------- JUNTAS 1-2: pernas (calça cargo + coturno) ---------- */
    const mkLeg = (s) => {
      const leg = new THREE.Group();
      leg.position.set(s * 0.30, 0.98, 0);
      root.add(leg);
      // Coxa larga da calça cargo
      blob(leg, 0.28, 0.17, 0.29, M.pants, 0, -0.03, 0);
      cyl(leg, 0.27, 0.235, 0.46, M.pants, 0, -0.23, 0, null, 10);
      // Vincos do tecido
      cyl(leg, 0.266, 0.266, 0.026, M.pantsDk, 0, -0.16, 0, [0.12, 0, s * 0.1], 10);
      cyl(leg, 0.25, 0.25, 0.024, M.pantsDk, 0, -0.37, 0, [-0.1, 0, -s * 0.12], 10);
      // Bolso cargo lateral com aba e botão
      box(leg, 0.07, 0.24, 0.25, M.pantsDk, s * 0.235, -0.28, 0.0);
      box(leg, 0.08, 0.065, 0.27, M.pants, s * 0.24, -0.15, 0.0);
      box(leg, 0.02, 0.028, 0.028, M.welt, s * 0.283, -0.165, 0.0);
      // Costura lateral
      box(leg, 0.012, 0.42, 0.02, M.pantsDk, s * 0.262, -0.22, -0.13);

      // Joelho / canela
      const knee = new THREE.Group();
      knee.position.set(0, -0.46, 0);
      leg.add(knee);
      blob(knee, 0.235, 0.11, 0.245, M.pants, 0, 0, 0.0);
      cyl(knee, 0.235, 0.25, 0.18, M.pants, 0, -0.09, 0, null, 10);
      cyl(knee, 0.255, 0.255, 0.028, M.pantsDk, 0, -0.11, 0, [0.15, 0, s * 0.1], 10);
      // Tecido embolado por cima do cano do coturno
      cyl(knee, 0.258, 0.222, 0.075, M.pantsDk, 0, -0.195, 0, null, 10);
      // Cano do coturno
      cyl(knee, 0.215, 0.215, 0.035, M.bootDk, 0, -0.218, 0, null, 12);
      cyl(knee, 0.205, 0.19, 0.17, M.boot, 0, -0.30, 0, null, 12);
      box(knee, 0.08, 0.17, 0.03, M.bootDk, 0, -0.30, 0.19);
      const lace = new Acc();
      for (let k = 0; k < 5; k++) {
        const y = -0.238 - k * 0.034;
        lace.add(BX(0.085, 0.012, 0.012), 0, y, 0.207, [0, 0, 0.55], 0x4a2e18);
        lace.add(BX(0.085, 0.012, 0.012), 0, y, 0.209, [0, 0, -0.55], 0x55361c);
        lace.add(BX(0.016, 0.016, 0.02), -0.047, y, 0.2, null, 0x8a8a86);
        lace.add(BX(0.016, 0.016, 0.02), 0.047, y, 0.2, null, 0x8a8a86);
      }
      knee.add(lace.build(M.vc));

      // Tornozelo / pé (coturno)
      const foot = new THREE.Group();
      foot.position.set(0, -0.38, 0);
      knee.add(foot);
      cyl(foot, 0.192, 0.2, 0.1, M.boot, 0, -0.005, 0, null, 12);
      box(foot, 0.33, 0.12, 0.36, M.boot, 0, -0.05, 0.08);
      blob(foot, 0.165, 0.08, 0.14, M.boot, 0, -0.045, 0.25);
      box(foot, 0.31, 0.11, 0.16, M.boot, 0, -0.055, -0.12);
      box(foot, 0.1, 0.03, 0.2, M.bootDk, 0, 0.02, 0.17, [0.42, 0, 0]);
      const fl = new Acc();
      for (let k = 0; k < 3; k++) {
        const z = 0.1 + k * 0.05, y = 0.035 - k * 0.022;
        fl.add(BX(0.09, 0.012, 0.012), 0, y + 0.012, z, [0.42, 0, 0.5], 0x4a2e18);
        fl.add(BX(0.09, 0.012, 0.012), 0, y + 0.014, z, [0.42, 0, -0.5], 0x55361c);
      }
      foot.add(fl.build(M.vc));
      // Sola de borracha grossa + vira costurada
      box(foot, 0.36, 0.05, 0.62, M.sole, 0, -0.115, 0.08);
      box(foot, 0.366, 0.014, 0.6, M.welt, 0, -0.088, 0.08);
      box(foot, 0.37, 0.022, 0.12, M.sole, 0, -0.128, -0.17);
      return { leg, knee, foot };
    };
    const legL = mkLeg(-1), legR = mkLeg(1);
    rig.legL = legL.leg; rig.kneeL = legL.knee; rig.footL = legL.foot;
    rig.legR = legR.leg; rig.kneeR = legR.knee; rig.footR = legR.foot;

    /* ---------- JUNTA 3: quadril / cintura ---------- */
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.98, 0);
    root.add(torsoGroup);
    rig.torsoGroup = torsoGroup;

    // Quadril da calça + gancho
    cyl(torsoGroup, 0.47, 0.5, 0.26, M.pants, 0, 0.02, 0, null, 14, 0.62);
    blob(torsoGroup, 0.44, 0.2, 0.25, M.pants, 0, -0.03, -0.07);
    blob(torsoGroup, 0.26, 0.14, 0.22, M.pants, 0, -0.1, 0.03);
    box(torsoGroup, 0.03, 0.2, 0.02, M.pantsDk, 0.02, -0.04, 0.3);
    // Cós aparecendo acima do cinto
    cyl(torsoGroup, 0.47, 0.49, 0.04, M.pantsDk, 0, 0.198, 0, null, 14, 0.62);
    // Cinto de couro grosso
    cyl(torsoGroup, 0.505, 0.505, 0.11, M.belt, 0, 0.13, 0, null, 16, 0.645);
    const BELT_RX = 0.505, BELT_RZ = 0.326;
    for (const a of [-2.5, -1.25, -0.55, 0.55, 1.25, 2.5, Math.PI]) {
      box(torsoGroup, 0.035, 0.135, 0.02, M.pantsDk, Math.sin(a) * BELT_RX, 0.13, Math.cos(a) * BELT_RZ, [0, a, 0]);
    }
    // Fivela quadrada de latão
    box(torsoGroup, 0.17, 0.13, 0.022, M.brass, 0, 0.13, 0.334);
    box(torsoGroup, 0.112, 0.074, 0.026, M.belt, 0, 0.13, 0.336);
    box(torsoGroup, 0.014, 0.08, 0.012, M.brass, 0.0, 0.13, 0.352);
    box(torsoGroup, 0.1, 0.085, 0.02, M.belt, 0.13, 0.13, 0.328, [0, 0.3, 0]);
    const stud = new Acc();
    for (const a of [-1.9, -1.6, 1.6, 1.9]) stud.add(studGeo, Math.sin(a) * (BELT_RX + 0.004), 0.13, Math.cos(a) * (BELT_RZ + 0.004), null, 0xb09a6a);
    torsoGroup.add(stud.build(M.vc));

    // Bolsas de ferramentas penduradas no cinto
    const mkPouch = (a, w, h, d) => {
      const g = new THREE.Group();
      g.position.set(Math.sin(a) * (BELT_RX + 0.01), 0.13, Math.cos(a) * (BELT_RZ + 0.01));
      g.rotation.y = a;
      torsoGroup.add(g);
      box(g, w * 0.4, 0.15, 0.02, M.pouchDk, 0, 0.0, 0.01); // alça passando pelo cinto
      box(g, w, h, d, M.pouch, 0, -0.06 - h / 2, d / 2 + 0.01);
      box(g, w + 0.012, 0.018, d + 0.012, M.pouchDk, 0, -0.06, d / 2 + 0.01);
      box(g, w + 0.008, h * 0.92, 0.012, M.pouchDk, 0, -0.06 - h / 2, d + 0.016);
      box(g, w * 0.88, h * 0.8, 0.012, M.pouch, 0, -0.06 - h / 2, d + 0.022);
      return g;
    };
    // Bolsa grande com 3 facas/espátulas (lado esquerdo de quem olha de frente)
    const pouchA = mkPouch(-0.92, 0.2, 0.22, 0.1);
    for (let i = -1; i <= 1; i++) {
      const kn = new THREE.Group();
      kn.position.set(i * 0.058, -0.06, 0.06);
      kn.rotation.z = i * 0.08;
      pouchA.add(kn);
      box(kn, 0.042, 0.16, 0.018, M.steelDk, 0, 0.08, 0);
      box(kn, 0.032, 0.022, 0.02, M.steel, 0, 0.165, 0);
      box(kn, 0.05, 0.02, 0.024, M.steel, 0, 0.01, 0);
      const rv = new Acc();
      rv.add(studGeo, 0, 0.06, 0.01, null, 0xd0d0d0).add(studGeo, 0, 0.12, 0.01, null, 0xd0d0d0);
      kn.add(rv.build(M.vc));
    }
    // Bolsa estreita com cabo de ferramenta (lado direito de quem olha)
    const pouchB = mkPouch(0.98, 0.13, 0.27, 0.09);
    box(pouchB, 0.045, 0.12, 0.045, M.wood, 0.0, 0.0, 0.05);
    box(pouchB, 0.055, 0.02, 0.055, M.steel, 0.0, -0.055, 0.05);

    // Abdômen trincado (oito gomos) + oblíquos + "V"
    rig.torso = blob(torsoGroup, 0.44, 0.26, 0.28, M.skin, 0, 0.36, 0, null, 12);
    blob(torsoGroup, 0.4, 0.2, 0.2, M.skinSh, 0, 0.3, -0.12);
    const absRows = [[0.5, 0.232, 0.08], [0.405, 0.27, 0.088], [0.31, 0.27, 0.088], [0.222, 0.235, 0.075]];
    for (const [y, z, rx] of absRows) {
      blob(torsoGroup, rx, 0.052, 0.045, M.skinHi, -0.088, y, z, null, 8);
      blob(torsoGroup, rx, 0.052, 0.045, M.skinHi, 0.088, y, z, null, 8);
    }
    box(torsoGroup, 0.024, 0.34, 0.03, M.skinSh, 0, 0.37, 0.272);
    box(torsoGroup, 0.03, 0.02, 0.02, M.socket, 0, 0.258, 0.27);
    for (const s of [-1, 1]) {
      blob(torsoGroup, 0.11, 0.17, 0.16, M.skin, s * 0.33, 0.3, 0.1, [0, 0, s * 0.15]);
      blob(torsoGroup, 0.035, 0.12, 0.04, M.skinHi, s * 0.19, 0.21, 0.215, [0, 0, -s * 0.5], 6);
    }

    /* ---------- JUNTA 4: peito / tórax ---------- */
    const chestGroup = new THREE.Group();
    chestGroup.position.set(0, 0.52, 0);
    torsoGroup.add(chestGroup);
    rig.chestGroup = chestGroup;

    blob(chestGroup, 0.6, 0.33, 0.34, M.skin, 0, 0.22, -0.01, null, 14);
    // Dorsais enormes (silhueta em V)
    for (const s of [-1, 1]) {
      blob(chestGroup, 0.22, 0.3, 0.26, M.skin, s * 0.42, 0.14, -0.1, [0, 0, s * 0.3]);
      // Peitorais
      blob(chestGroup, 0.27, 0.165, 0.11, M.skinHi, s * 0.27, 0.3, 0.27, [0, s * 0.15, s * 0.08], 12);
      blob(chestGroup, 0.24, 0.045, 0.07, M.skinSh, s * 0.27, 0.16, 0.27, [0, s * 0.15, s * 0.06], 8);
      box(chestGroup, 0.026, 0.026, 0.012, M.socket, s * 0.31, 0.22, 0.366);
      // Serrátil
      for (let k = 0; k < 3; k++) blob(chestGroup, 0.05, 0.028, 0.06, M.skinHi, s * 0.5, 0.06 + k * 0.065, 0.17, [0, 0, -s * 0.5], 6);
      // Trapézio gigante subindo até a nuca
      blob(chestGroup, 0.26, 0.15, 0.22, M.skin, s * 0.25, 0.53, -0.06, [0, 0, -s * 0.45]);
      // Clavícula
      box(chestGroup, 0.3, 0.032, 0.05, M.skinHi, s * 0.29, 0.47, 0.22, [0, s * 0.35, -s * 0.12]);
    }
    box(chestGroup, 0.03, 0.24, 0.03, M.skinSh, 0, 0.3, 0.32);
    blob(chestGroup, 0.3, 0.14, 0.22, M.skin, 0, 0.55, -0.08);
    blob(chestGroup, 0.52, 0.28, 0.16, M.skinSh, 0, 0.3, -0.22);
    box(chestGroup, 0.03, 0.42, 0.03, M.socket, 0, 0.24, -0.36);
    // Pescoço de touro
    cyl(chestGroup, 0.165, 0.19, 0.2, M.skin, 0, 0.6, 0.0, null, 10);
    blob(chestGroup, 0.03, 0.1, 0.03, M.skinHi, -0.09, 0.6, 0.15, [0.3, 0, -0.4], 6);
    blob(chestGroup, 0.03, 0.1, 0.03, M.skinHi, 0.09, 0.6, 0.15, [0.3, 0, 0.4], 6);

    // Corrente de ouro + cruz
    const chainPts = [
      [0, 0.635, -0.165], [0.15, 0.63, -0.1], [0.2, 0.6, 0.04], [0.19, 0.55, 0.17],
      [0.14, 0.48, 0.285], [0.07, 0.43, 0.335], [0, 0.415, 0.35],
      [-0.07, 0.43, 0.335], [-0.14, 0.48, 0.285], [-0.19, 0.55, 0.17], [-0.2, 0.6, 0.04], [-0.15, 0.63, -0.1]
    ].map((p) => new V3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(chainPts, true);
    const chain = new Acc();
    const NL = 70, linkGeo = BX(0.016, 0.009, 0.028);
    for (let i = 0; i < NL; i++) {
      const t = i / NL;
      const p = curve.getPointAt(t), tg = curve.getTangentAt(t);
      const m = new THREE.Matrix4().lookAt(new V3(0, 0, 0), tg, new V3(0, 1, 0));
      if (i % 2) m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
      m.setPosition(p);
      chain.addMatrix(linkGeo, m, i % 2 ? 0xd8a828 : 0xf0c040);
    }
    chestGroup.add(chain.build(M.vcGold));
    const pend = new THREE.Group();
    pend.position.set(0, 0.405, 0.345);
    pend.rotation.x = -0.15;
    chestGroup.add(pend);
    box(pend, 0.022, 0.03, 0.014, M.goldDk, 0, -0.012, 0);
    box(pend, 0.04, 0.2, 0.02, M.gold, 0, -0.125, 0);
    box(pend, 0.11, 0.04, 0.02, M.gold, 0, -0.075, 0);
    box(pend, 0.016, 0.15, 0.024, M.goldDk, 0, -0.13, 0.002);
    box(pend, 0.08, 0.016, 0.024, M.goldDk, 0, -0.075, 0.002);
    for (const [x, y] of [[0, -0.035], [0, -0.225], [-0.055, -0.075], [0.055, -0.075]]) box(pend, 0.03, 0.03, 0.022, M.gold, x, y, 0);
    rig.pendant = pend;

    /* ---------- JUNTA 5: cabeça ---------- */
    const head = new THREE.Group();
    head.position.set(0, 0.64, 0.02);
    chestGroup.add(head);
    rig.head = head;

    blob(head, 0.215, 0.235, 0.235, M.skin, 0, 0.24, -0.01, null, 12);
    box(head, 0.36, 0.17, 0.32, M.skin, 0, 0.08, 0.04);
    box(head, 0.34, 0.06, 0.07, M.skinSh, 0, 0.278, 0.188);
    // Rugas da testa franzida
    box(head, 0.18, 0.01, 0.012, M.skinSh, 0, 0.33, 0.207);
    box(head, 0.14, 0.01, 0.012, M.skinSh, 0, 0.355, 0.196);
    // Maçãs do rosto
    blob(head, 0.06, 0.04, 0.04, M.skinHi, -0.12, 0.18, 0.185, null, 6);
    blob(head, 0.06, 0.04, 0.04, M.skinHi, 0.12, 0.18, 0.185, null, 6);
    // Olhos semicerrados de fúria (brilham dourado no Modo Super-Fé)
    for (const s of [-1, 1]) {
      box(head, 0.1, 0.05, 0.02, M.socket, s * 0.085, 0.236, 0.214);
      const ew = box(head, 0.072, 0.026, 0.012, M.eyeW, s * 0.085, 0.232, 0.222);
      if (s < 0) rig.eyeL = ew; else rig.eyeR = ew;
      box(head, 0.028, 0.026, 0.012, M.pupil, s * 0.08, 0.232, 0.227);
      // Sobrancelhas grossas em V
      box(head, 0.13, 0.04, 0.045, M.brow, s * 0.088, 0.276, 0.225, [0, 0, s * 0.3]);
    }
    box(head, 0.012, 0.05, 0.012, M.skinSh, -0.016, 0.27, 0.227);
    box(head, 0.012, 0.05, 0.012, M.skinSh, 0.016, 0.27, 0.227);
    // Nariz largo
    box(head, 0.05, 0.09, 0.05, M.skin, 0, 0.21, 0.222);
    blob(head, 0.045, 0.035, 0.035, M.skinHi, 0, 0.158, 0.243, null, 6);
    blob(head, 0.03, 0.028, 0.028, M.skin, -0.042, 0.152, 0.228, null, 6);
    blob(head, 0.03, 0.028, 0.028, M.skin, 0.042, 0.152, 0.228, null, 6);
    box(head, 0.022, 0.012, 0.012, M.socket, -0.025, 0.128, 0.245);
    box(head, 0.022, 0.012, 0.012, M.socket, 0.025, 0.128, 0.245);
    // Focinho/boca fechada, séria
    box(head, 0.2, 0.12, 0.05, M.skin, 0, 0.1, 0.21);
    box(head, 0.11, 0.012, 0.01, M.mouth, 0, 0.085, 0.237);
    box(head, 0.09, 0.02, 0.02, M.lip, 0, 0.068, 0.232);
    // Orelhas
    box(head, 0.04, 0.1, 0.07, M.skinSh, -0.215, 0.2, -0.05);
    box(head, 0.04, 0.1, 0.07, M.skinSh, 0.215, 0.2, -0.05);
    // Barba cheia aparada + bigode
    box(head, 0.17, 0.035, 0.04, M.beard, 0, 0.108, 0.24);
    box(head, 0.03, 0.065, 0.035, M.beard, -0.08, 0.078, 0.226);
    box(head, 0.03, 0.065, 0.035, M.beard, 0.08, 0.078, 0.226);
    box(head, 0.2, 0.12, 0.08, M.beard, 0, 0.0, 0.2);
    box(head, 0.26, 0.06, 0.16, M.beard, 0, -0.04, 0.13);
    for (const s of [-1, 1]) {
      box(head, 0.06, 0.18, 0.26, M.beard, s * 0.185, 0.08, 0.06, [0, s * 0.18, 0]);
      box(head, 0.12, 0.06, 0.05, M.beard, s * 0.12, 0.04, 0.198, [0, -s * 0.35, s * 0.25]);
      box(head, 0.05, 0.14, 0.08, M.beard, s * 0.205, 0.215, 0.015);
    }
    // Mullet cacheado (centenas de cachos mesclados em 1 malha)
    const HC = [0x24170e, 0x1a110a, 0x2e1e12, 0x140c07, 0x332216];
    const R = rng(4242);
    const hair = new Acc();
    const icos = [0.05, 0.06, 0.07, 0.08].map((r) => new THREE.IcosahedronGeometry(r, 0));
    const rnd3 = () => [R() * 6, R() * 6, R() * 6];
    let placed = 0;
    for (let i = 0; i < 400 && placed < 95; i++) {
      const u = R() * 2 - 1, th = R() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
      const dx = rr * Math.cos(th), dy = u, dz = rr * Math.sin(th);
      const sm = (v) => v * v * (3 - 2 * v);
      const req = dz > 0
        ? 0.05 + (0.5 - 0.05) * sm(Math.min(1, dz / 0.75))
        : 0.05 + (-0.6 - 0.05) * sm(Math.min(1, -dz / 0.6));
      if (dy < req) continue;
      const k = 1 + R() * 0.08;
      const sz = 0.9 + R() * 0.25;
      hair.add(pick(R, icos), dx * 0.235 * k, 0.26 + dy * 0.25 * k, -0.015 + dz * 0.25 * k, rnd3(), pick(R, HC), [sz, sz, sz]);
      placed++;
    }
    // Cachos longos caindo até os ombros/trapézio
    const nLocks = 15;
    for (let k = 0; k < nLocks; k++) {
      const a = -1.6 + (k / (nLocks - 1)) * 3.2 + (R() - 0.5) * 0.1;
      const ox = Math.sin(a), oz = -Math.cos(a);
      let x = ox * 0.21, z = -0.015 + oz * 0.22, y = 0.18 + R() * 0.05;
      const back = Math.cos(a);
      const segs = 3 + Math.round(back * 2 + R() * 1.2);
      let sc = 1.0 + R() * 0.15;
      for (let j = 0; j < segs; j++) {
        hair.add(icos[1], x, y, z, rnd3(), pick(R, HC), [sc, sc * 1.1, sc]);
        y -= 0.062 + R() * 0.012;
        const ph = j * 1.9 + k * 0.7;
        x += ox * 0.012 + Math.cos(ph) * 0.018;
        z += oz * 0.014 + Math.sin(ph) * 0.018;
        sc *= 0.95;
      }
    }
    // Cachinhos da barba quebrando a silhueta quadrada
    for (let i = 0; i < 34; i++) {
      const s = R() < 0.5 ? -1 : 1, t = R();
      const x = s * (0.05 + t * 0.15), y = -0.06 + R() * 0.18, z = 0.23 - t * 0.17 + (R() - 0.5) * 0.02;
      hair.add(icos[0], x, y, z, rnd3(), pick(R, HC), [0.55, 0.55, 0.55]);
    }
    const hairMesh = hair.build(M.hairVC);
    head.add(hairMesh);
    rig.hair = hairMesh;

    /* ---------- JUNTAS 6..11: ombro -> braço -> antebraço -> mão ---------- */
    const mkArm = (s) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.62, 0.36, 0);
      chestGroup.add(shoulder);
      blob(shoulder, 0.2, 0.2, 0.24, M.skin, s * 0.06, -0.02, 0);

      const arm = new THREE.Group();
      arm.position.set(s * 0.24, 0, 0);
      shoulder.add(arm);
      // Deltoide gigante (3 cabeças)
      blob(arm, 0.25, 0.25, 0.27, M.skinHi, s * 0.02, -0.06, 0, null, 12);
      blob(arm, 0.13, 0.18, 0.12, M.skin, -s * 0.04, -0.1, 0.15, [0, 0, s * 0.2]);
      blob(arm, 0.13, 0.18, 0.12, M.skin, -s * 0.02, -0.1, -0.15, [0, 0, s * 0.2]);
      // Bíceps / tríceps / braquial
      cyl(arm, 0.165, 0.15, 0.44, M.skin, 0, -0.24, 0, null, 10);
      blob(arm, 0.14, 0.19, 0.15, M.skinHi, 0, -0.28, 0.08, null, 10);
      blob(arm, 0.15, 0.21, 0.14, M.skin, s * 0.01, -0.25, -0.08);
      blob(arm, 0.08, 0.12, 0.1, M.skinSh, s * 0.12, -0.33, 0.02, null, 6);
      const va = new Acc();
      const VC = 0xc8c8c8;
      const vein = (acc, pts, r) => { for (let i = 0; i < pts.length - 1; i++) acc.seg(new V3(...pts[i]), new V3(...pts[i + 1]), r, VC); };
      vein(va, [[s * 0.07, -0.12, 0.2], [s * 0.05, -0.22, 0.222], [s * 0.07, -0.32, 0.222], [s * 0.05, -0.42, 0.18]], 0.009);
      vein(va, [[s * 0.05, -0.22, 0.222], [-s * 0.03, -0.3, 0.226], [-s * 0.06, -0.38, 0.2]], 0.007);
      vein(va, [[s * 0.15, -0.2, 0.06], [s * 0.16, -0.3, 0.05], [s * 0.14, -0.4, 0.07]], 0.007);
      arm.add(va.build(M.skinVC));

      const forearm = new THREE.Group();
      forearm.position.set(0, -0.46, 0);
      arm.add(forearm);
      blob(forearm, 0.15, 0.12, 0.15, M.skin, 0, 0, 0);
      blob(forearm, 0.17, 0.2, 0.165, M.skinHi, 0, -0.13, 0.01, null, 10);
      cyl(forearm, 0.16, 0.12, 0.4, M.skin, 0, -0.22, 0, null, 10);
      const vf = new Acc();
      vein(vf, [[s * 0.02, -0.05, 0.155], [s * 0.05, -0.15, 0.17], [s * 0.03, -0.25, 0.142], [0, -0.3, 0.128]], 0.008);
      vein(vf, [[s * 0.05, -0.15, 0.17], [s * 0.1, -0.22, 0.12], [s * 0.11, -0.29, 0.07]], 0.007);
      vein(vf, [[-s * 0.06, -0.06, 0.15], [-s * 0.08, -0.17, 0.14], [-s * 0.06, -0.27, 0.11]], 0.006);
      forearm.add(vf.build(M.skinVC));
      // Munhequeira de couro com spikes
      cyl(forearm, 0.158, 0.158, 0.15, M.cuff, 0, -0.355, 0, null, 12);
      cyl(forearm, 0.163, 0.163, 0.016, M.belt, 0, -0.29, 0, null, 12);
      cyl(forearm, 0.163, 0.163, 0.016, M.belt, 0, -0.42, 0, null, 12);
      const sp = new Acc();
      for (let ring = 0; ring < 2; ring++) {
        const y = ring ? -0.39 : -0.322, n = 7;
        for (let i = 0; i < n; i++) {
          const a = (i + ring * 0.5) / n * Math.PI * 2;
          const dir = new V3(Math.cos(a), 0, Math.sin(a));
          const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir);
          const m = new THREE.Matrix4().compose(new V3(dir.x * 0.2, y, dir.z * 0.2), q, new V3(1, 1, 1));
          sp.addMatrix(ironCone, m, i % 2 ? 0xc8ccd2 : 0xb0b6be);
          sp.add(studGeo, dir.x * 0.159, y, dir.z * 0.159, null, 0x6a6e74, [1.6, 1.6, 1.6]);
        }
      }
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        sp.add(studGeo, Math.cos(a) * 0.164, -0.29, Math.sin(a) * 0.164, null, 0x9a9ea4);
        sp.add(studGeo, Math.cos(a) * 0.164, -0.42, Math.sin(a) * 0.164, null, 0x9a9ea4);
      }
      forearm.add(sp.build(M.vc));

      // Punho cerrado (nós dos dedos alinhados frente-trás, polegar por cima)
      const hand = new THREE.Group();
      hand.position.set(0, -0.44, 0);
      forearm.add(hand);
      cyl(hand, 0.115, 0.12, 0.06, M.skin, 0, -0.015, 0, null, 10);
      box(hand, 0.15, 0.2, 0.25, M.skin, 0, -0.12, 0.01);
      box(hand, 0.03, 0.16, 0.22, M.skinHi, s * 0.075, -0.11, 0.01);
      for (let k = 0; k < 4; k++) {
        const z = -0.087 + k * 0.058;
        box(hand, 0.16, 0.075, 0.056, M.skin, -s * 0.005, -0.245, z);
        blob(hand, 0.04, 0.035, 0.03, M.skinHi, s * 0.062, -0.225, z, null, 6);
        box(hand, 0.05, 0.07, 0.052, M.skinSh, -s * 0.07, -0.19, z);
      }
      box(hand, 0.065, 0.13, 0.065, M.skin, -s * 0.04, -0.17, 0.15, [0.5, 0, 0]);
      return { shoulder, arm, forearm, hand };
    };
    const L = mkArm(-1), Rr = mkArm(1);
    rig.shoulderL = L.shoulder; rig.armL = L.arm; rig.forearmL = L.forearm; rig.handL = L.hand;
    rig.shoulderR = Rr.shoulder; rig.armR = Rr.arm; rig.forearmR = Rr.forearm; rig.handR = Rr.hand;

    /* ---------- Props (mesmos encaixes do modelo clássico) ---------- */
    const hammer = new THREE.Group();
    hammer.position.set(0, -0.08, 0.06);
    hammer.rotation.x = Math.PI * 0.5;
    part(hammer, 0.08, 0.76, 0.08, 0x6a4420, 0, 0.24, 0);
    part(hammer, 0.18, 0.22, 0.4, 0x70747c, 0, 0.64, 0);
    part(hammer, 0.2, 0.24, 0.1, 0x45484e, 0, 0.64, -0.21);
    hammer.visible = false;
    rig.handR.add(hammer);
    rig.hammer = hammer;

    const heart = bioHeart(2.2);
    heart.position.set(0, -0.14, 0.14);
    heart.visible = false;
    rig.handR.add(heart);
    rig.heart = heart;

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

    const rosary = buildRosary(0.96);
    rosary.root.position.set(0, -0.425, 0);
    rosary.root.visible = false;
    rig.forearmR.add(rosary.root);
    rig.rosary = rosary;

    const handRosary = buildRosary(0.85, { hanging: true });
    handRosary.root.position.set(0, -0.06, 0.09);
    handRosary.root.visible = false;
    rig.handR.add(handRosary.root);
    rig.handRosary = handRosary.root;

    return rig;
  }

  window.buildNivaldoRef = buildNivaldoRef;
  if (typeof BUILD !== 'undefined') {
    BUILD.nivaldoClassic = buildNivaldo;
    BUILD.nivaldo = buildNivaldoRef;
  }
})();
