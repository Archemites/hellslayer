'use strict';

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
