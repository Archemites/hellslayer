'use strict';

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
