'use strict';

/* ============================================================
   HELLSLAYER — Cutscene Inicial (Cap. 1 · Ep. 1 · Área 1)
   Ato 1: O Conselho dos 12 Super-Cardeais convoca Nivaldo.
   Ato 2: Dia bonito num campo verdejante fora do Inferno;
          colossal janela do Portal do Inferno mostrando a
          cidade muito lá embaixo no Inferno; zoom out subindo,
          Nivaldo aperta a cruz ("Que o Super-Senhor esteja
          comigo") e mergulha com os braços pra frente igual
          o Superman!
   Ato 3: Direto no mapa real atual (Área 1)! Nivaldo em queda
          livre com braços e pernas abertos tentando frear a
          queda, cai exatamente onde spawna, pousa igual o
          Homem de Ferro, levanta, diz "Vamos ver do que esses
          demônios são feitos" e saca o martelinho, entrando
          direto na ação em 1ª pessoa.
   ============================================================ */

(function () {
  const V3 = THREE.Vector3;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(x) { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); }
  function easeOutCubic(x) { const c = clamp(x, 0, 1); return 1 - Math.pow(1 - c, 3); }
  function easeInQuad(x) { const c = clamp(x, 0, 1); return c * c; }

  const ACT2_TIME = 25.0;
  const ACT3_TIME = 42.2;
  const TOTAL_DUR = 56.8;

  let active = false;
  let t = 0;
  let scene = null;       // cena dedicada para Atos 1 e 2
  let worldScene = null;  // cena real do mapa atual (usada no Ato 3!)
  let act1Group = null;
  let act2Group = null;
  let act3WorldGroup = null;
  let curAct = 0;
  let callbacks = null;
  let fired = {};

  // Ponto de spawn real do jogador no mapa a1
  let spawnX = 0, spawnY = 0, spawnZ = 10, playerEye = 2.08;
  let savedWorldFogNear = null;
  let savedWorldFogFar = null;

  // Atores e referências dinâmicas
  let cardinals = [];
  let nivaldo1 = null;
  let nivaldo2 = null;
  let nivaldo3 = null;
  let crossGlowMesh = null;
  let crossGlowLight = null;
  let portalGroup = null;
  let portalRings = [];
  let portalDebris = [];
  let tunnelWallTex = null;
  let skyPortalRings = [];
  let candles = [];
  let fires = [];
  let clouds = [];
  let dustParticles = [];
  let embers = [];
  let faithSparks = [];
  let windStreaks = [];
  let impactRing = null;
  let impactCrater = null;
  let impactChunks = [];
  let hammerSpark = null;
  let councilLight = null;
  let savedCamFov = 75;
  let savedCamFar = 300;
  let skipGrace = 0;

  let ownedGeos = [];
  let ownedMats = [];
  function mkGeo(g) { ownedGeos.push(g); return g; }
  function mkMat(m) {
    if (typeof psx === 'function') psx(m);
    ownedMats.push(m);
    return m;
  }
  function addBox(parent, w, h, d, color, x, y, z, opts) {
    opts = opts || {};
    const m = new THREE.Mesh(BX(w, h, d), MT(color, opts));
    m.position.set(x || 0, y || 0, z || 0);
    parent.add(m);
    return m;
  }

  function hideNivaldoWeapons(rig) {
    const keys = ['hammer', 'heart', 'cross', 'sling', 'scythe', 'demo', 'papalCross', 'papalCrossL', 'rosary', 'handRosary'];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (rig[k]) {
        if (rig[k].root) rig[k].root.visible = false;
        else rig[k].visible = false;
      }
    }
  }

  /* ------------------------------------------------------------
     ATO 1: Basílica do Conselho dos 12 Super-Cardeais
     ------------------------------------------------------------ */
  function buildAct1() {
    const g = new THREE.Group();

    g.add(new THREE.AmbientLight(0x3a2424, 1.05));
    g.add(new THREE.HemisphereLight(0xffcfa0, 0x1a080a, 0.65));

    councilLight = new THREE.PointLight(0xffb866, 2.2, 42);
    councilLight.position.set(0, 12.5, -6.5);
    g.add(councilLight);

    const nivLight = new THREE.PointLight(0xffdca0, 1.5, 22);
    nivLight.position.set(0, 7.5, 5.0);
    g.add(nivLight);

    const vitralLight = new THREE.PointLight(0xd91e28, 2.0, 38);
    vitralLight.position.set(0, 9.0, -17.0);
    g.add(vitralLight);

    addBox(g, 44, 0.6, 44, 0x171214, 0, -0.3, -4);
    for (let ix = -4; ix <= 4; ix++) {
      for (let iz = -5; iz <= 3; iz++) {
        if ((ix + iz) % 2 === 0) addBox(g, 3.6, 0.02, 3.6, 0x20191c, ix * 3.8, 0.01, iz * 3.8);
      }
    }

    addBox(g, 3.6, 0.04, 24, 0x6e0e14, 0, 0.025, 0.5);
    addBox(g, 0.22, 0.05, 24, 0xcba142, -1.72, 0.03, 0.5, { em: 0x241800 });
    addBox(g, 0.22, 0.05, 24, 0xcba142, 1.72, 0.03, 0.5, { em: 0x241800 });

    const ringGeo = mkGeo(new THREE.RingGeometry(2.1, 2.45, 24));
    const ringMat = mkMat(new THREE.MeshBasicMaterial({ color: 0xcba142, side: THREE.DoubleSide }));
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.055, 3.6);
    g.add(ringMesh);

    addBox(g, 42, 22, 1.2, 0x1a1316, 0, 11, -19.5);
    addBox(g, 1.2, 22, 42, 0x161013, -20.5, 11, -2);
    addBox(g, 1.2, 22, 42, 0x161013, 20.5, 11, -2);
    addBox(g, 42, 1.0, 42, 0x0e090c, 0, 21.5, -2);

    const colPositions = [
      [-14, -15], [-14, -7], [-14, 1], [-14, 9],
      [14, -15], [14, -7], [14, 1], [14, 9],
      [-7.5, -17.8], [7.5, -17.8]
    ];
    for (let i = 0; i < colPositions.length; i++) {
      const [cx, cz] = colPositions[i];
      addBox(g, 1.5, 21, 1.5, 0x271f23, cx, 10.5, cz);
      addBox(g, 2.1, 1.1, 2.1, 0x34292e, cx, 0.55, cz);
      addBox(g, 2.0, 0.9, 2.0, 0x34292e, cx, 19.8, cz);
      addBox(g, 1.65, 0.25, 1.65, 0x9b7930, cx, 1.2, cz);
    }

    const vitralXs = [-11, 0, 11];
    for (let i = 0; i < vitralXs.length; i++) {
      const vx = vitralXs[i];
      const vh = i === 1 ? 11.5 : 9.2;
      const vw = i === 1 ? 4.4 : 3.2;
      addBox(g, vw + 0.6, vh + 0.6, 0.45, 0x110c0e, vx, 10.5, -18.7);
      addBox(g, vw, vh, 0.25, i === 1 ? 0x99121a : 0x700c14, vx, 10.5, -18.55, { basic: true });
      addBox(g, vw * 0.65, vh * 0.72, 0.12, i === 1 ? 0xe03228 : 0xb32020, vx, 10.7, -18.42, { basic: true });
      addBox(g, 0.16, vh, 0.3, 0x140d10, vx, 10.5, -18.35);
      addBox(g, vw, 0.16, 0.3, 0x140d10, vx, 12.2, -18.35);
      addBox(g, vw, 0.16, 0.3, 0x140d10, vx, 8.8, -18.35);

      const beamGeo = mkGeo(new THREE.CylinderGeometry(vw * 0.32, vw * 0.72, 19, 6, 1, true));
      const beamMat = mkMat(new THREE.MeshBasicMaterial({
        color: i === 1 ? 0xff7040 : 0xff3b28,
        transparent: true,
        opacity: i === 1 ? 0.085 : 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(vx * 0.85, 7.2, -11.8);
      beam.rotation.x = 0.52;
      g.add(beam);
    }

    addBox(g, 0.62, 6.2, 0.36, 0xcba142, 0, 12.4, -17.6, { em: 0x3a2600 });
    addBox(g, 3.6, 0.62, 0.36, 0xcba142, 0, 13.7, -17.6, { em: 0x3a2600 });

    cardinals = [];
    candles = [];
    const totalCardinals = 12;
    const radius = 10.8;
    const centerZ = 1.6;
    const hairPalette = [0x8e8880, 0xb5afa6, 0x736e68, 0xd0cac0, 0x625d58, 0xa8a298];

    const daisGeo = mkGeo(new THREE.CylinderGeometry(radius + 2.2, radius + 2.8, 0.65, 24, 1, false, Math.PI * 0.56, Math.PI * 0.88));
    const daisMat = mkMat(new THREE.MeshLambertMaterial({ color: 0x221a1e }));
    const dais = new THREE.Mesh(daisGeo, daisMat);
    dais.position.set(0, 0.32, centerZ);
    g.add(dais);

    for (let i = 0; i < totalCardinals; i++) {
      const u = i / (totalCardinals - 1);
      const ang = lerp(-1.26, 1.26, u);
      const cx = Math.sin(ang) * radius;
      const cz = centerZ - Math.cos(ang) * radius;
      const centerFactor = 1 - Math.abs(u - 0.5) * 2;
      const elev = 0.85 + Math.pow(centerFactor, 1.3) * 1.15;
      const isLeader = (i === 5 || i === 6);

      const seat = new THREE.Group();
      seat.position.set(cx, 0, cz);
      seat.rotation.y = Math.atan2(0 - cx, 3.6 - cz);
      g.add(seat);

      addBox(seat, 1.75, elev, 1.65, 0x261d22, 0, elev * 0.5, 0);
      addBox(seat, 1.85, 0.12, 1.75, 0x9b7930, 0, elev + 0.04, 0);
      addBox(seat, 1.45, 3.1, 0.24, 0x2c1518, 0, elev + 1.55, -0.68);
      addBox(seat, 1.15, 2.55, 0.14, 0x5c0c12, 0, elev + 1.48, -0.54);
      addBox(seat, 0.14, 0.45, 0.12, 0xcba142, 0, elev + 3.25, -0.68, { em: 0x241800 });
      addBox(seat, 0.34, 0.10, 0.12, 0xcba142, 0, elev + 3.33, -0.68, { em: 0x241800 });
      addBox(seat, 1.55, 0.55, 0.22, 0x2d2126, 0, elev + 0.28, 0.78);
      addBox(seat, 1.62, 0.08, 0.30, 0xcba142, 0, elev + 0.58, 0.78);

      if (i % 2 === 0 || i === 11) {
        const cSide = i < 6 ? -0.92 : 0.92;
        addBox(seat, 0.14, 1.25, 0.14, 0x8f6e28, cSide, elev + 0.62, 0.72);
        addBox(seat, 0.08, 0.36, 0.08, 0xefe7d6, cSide, elev + 1.42, 0.72);
        const flame = addBox(seat, 0.09, 0.20, 0.09, 0xffaa22, cSide, elev + 1.70, 0.72, { basic: true });
        candles.push({ mesh: flame, baseY: elev + 1.70, phase: i * 1.7 });
      }

      const rig = BUILD.cardeal({
        leader: isLeader,
        hairColor: hairPalette[i % hairPalette.length]
      });
      rig.root.position.set(0, elev + 0.08, 0.02);
      const sc = isLeader ? 1.07 : (0.96 + (i % 3) * 0.03);
      rig.root.scale.setScalar(sc);
      seat.add(rig.root);

      cardinals.push({ rig, seat, idx: i, isLeader, phase: i * 0.93 });
    }

    nivaldo1 = BUILD.nivaldo();
    hideNivaldoWeapons(nivaldo1);
    nivaldo1.root.position.set(0, 0.04, 3.6);
    nivaldo1.root.rotation.y = Math.PI;
    g.add(nivaldo1.root);

    dustParticles = [];
    for (let i = 0; i < 48; i++) {
      const p = addBox(
        g,
        0.055, 0.055, 0.055,
        i % 3 === 0 ? 0xffd27a : 0xffe6b3,
        (Math.random() - 0.5) * 20,
        1.2 + Math.random() * 12,
        -14 + Math.random() * 20,
        { basic: true, tr: 0.48 }
      );
      dustParticles.push({
        mesh: p,
        bx: p.position.x,
        by: p.position.y,
        bz: p.position.z,
        spd: 0.25 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2
      });
    }

    return g;
  }

  /* ------------------------------------------------------------
     ATO 2: Mundo fora do Inferno em um ENTARDECER cinematográfico
            (céu gradiente, nuvens volumétricas, terreno irregular,
            bosques de árvores variadas, pedras e cerca) + Janela
            Colossal do Portal mostrando a cidade muito lá embaixo
            no Inferno + Mergulho Superman!
     ------------------------------------------------------------ */
  function createSunHaloTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    gr.addColorStop(0.0, 'rgba(255, 242, 175, 0.95)');
    gr.addColorStop(0.28, 'rgba(255, 175, 85, 0.55)');
    gr.addColorStop(0.62, 'rgba(255, 110, 48, 0.18)');
    gr.addColorStop(1.0, 'rgba(255, 80, 30, 0.0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  function createTunnelWallTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    // Fundo rocha vulcânica escura
    ctx.fillStyle = '#1b0d0c';
    ctx.fillRect(0, 0, 256, 256);
    // Manchas irregulares de pedra/terra queimada
    for (let i = 0; i < 180; i++) {
      const x = (i * 73) % 256;
      const y = (i * 137) % 256;
      const w = 14 + (i % 26);
      const h = 10 + ((i * 3) % 22);
      ctx.fillStyle = i % 3 === 0 ? '#2b1613' : (i % 3 === 1 ? '#120808' : '#3a1d17');
      ctx.fillRect(x, y, w, h);
    }
    // Veios de magma / fissuras infernais correndo ao longo do túnel
    for (let i = 0; i < 18; i++) {
      const x0 = (i * 41) % 256;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 72, 16, 0.78)' : 'rgba(255, 155, 36, 0.65)';
      ctx.lineWidth = i % 3 === 0 ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      for (let y = 0; y <= 256; y += 32) {
        ctx.lineTo(x0 + Math.sin(y * 0.05 + i) * 14, y);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 4);
    tex.needsUpdate = true;
    return tex;
  }

  function createSunsetSkyTexture() {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 256;
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0.00, '#7c2814'); // zênite laranja-queimado de fim de tarde
    gr.addColorStop(0.18, '#b84218'); // laranja escuro quente
    gr.addColorStop(0.32, '#e2641e'); // laranja vivo do entardecer
    gr.addColorStop(0.43, '#f78d2c'); // laranja dourado acima do horizonte
    gr.addColorStop(0.50, '#ffbf58'); // horizonte solar ardente (equador da cúpula)
    gr.addColorStop(0.58, '#e67832'); // névoa laranja quente na linha do horizonte
    gr.addColorStop(1.00, '#8c3b1c'); // abaixo do horizonte
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  function buildAct2() {
    const g = new THREE.Group();

    // Iluminação quente de ENTARDECER (Golden Hour)
    g.add(new THREE.AmbientLight(0x8a543c, 0.90));
    g.add(new THREE.HemisphereLight(0xffaa58, 0x2c3b1e, 1.08));

    const sunLight = new THREE.DirectionalLight(0xff9438, 1.75);
    sunLight.position.set(110, 38, -55);
    g.add(sunLight);

    // Contra-luz suave quente do céu oposto ao pôr-do-sol
    const skyFill = new THREE.DirectionalLight(0xe89460, 0.38);
    skyFill.position.set(-70, 60, 80);
    g.add(skyFill);

    // --- CÚPULA DE CÉU DE ENTARDECER ---
    const skyTex = createSunsetSkyTexture();
    const skyGeo = mkGeo(new THREE.SphereGeometry(390, 20, 14));
    const skyMat = mkMat(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    skyDome.position.y = 24;
    g.add(skyDome);

    // Sol grande e baixo de entardecer + halo radial macio
    const sunPos = new V3(145, 62, -165);
    const sunGeo = mkGeo(new THREE.SphereGeometry(12, 16, 12));
    const sunMat = mkMat(new THREE.MeshBasicMaterial({ color: 0xffe89c, fog: false }));
    const sunDisc = new THREE.Mesh(sunGeo, sunMat);
    sunDisc.position.copy(sunPos);
    g.add(sunDisc);

    const haloTex = createSunHaloTexture();
    const haloGeo = mkGeo(new THREE.PlaneGeometry(115, 115));
    const haloMat = mkMat(new THREE.MeshBasicMaterial({
      map: haloTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    }));
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(sunPos).add(new V3(-4, -1, 6));
    halo.lookAt(0, 32, 10);
    g.add(halo);

    // --- NUVENS VOLUMÉTRICAS DE ENTARDECER (topo dourado, base laranja-terracota) ---
    clouds = [];
    const puffGeo = mkGeo(new THREE.DodecahedronGeometry(1, 1));
    const cloudTopMat = mkMat(new THREE.MeshBasicMaterial({ color: 0xffdfa0, fog: false }));
    const cloudMidMat = mkMat(new THREE.MeshBasicMaterial({ color: 0xf7944d, fog: false }));
    const cloudBotMat = mkMat(new THREE.MeshBasicMaterial({ color: 0xc45630, fog: false }));

    const cloudSpecs = [
      [-115, 76, -65, 13], [88, 72, -48, 15], [-38, 86, -110, 16],
      [125, 68, -110, 14], [-145, 84, 15, 15], [58, 92, 22, 13],
      [-62, 88, 48, 14], [25, 96, -165, 17], [-95, 70, -145, 12],
      [14, 78, -28, 11], [115, 86, 40, 14], [-18, 94, 72, 13]
    ];
    for (let i = 0; i < cloudSpecs.length; i++) {
      const [cx, cy, cz, cs] = cloudSpecs[i];
      const cg = new THREE.Group();
      cg.position.set(cx, cy, cz);
      const puffs = [
        [0, 0, 0, cs * 1.15, cs * 0.40, cs * 0.65, cloudMidMat],
        [-cs * 0.72, -cs * 0.08, cs * 0.1, cs * 0.85, cs * 0.34, cs * 0.55, cloudBotMat],
        [cs * 0.78, -cs * 0.06, -cs * 0.08, cs * 0.90, cs * 0.34, cs * 0.56, cloudBotMat],
        [-cs * 0.28, cs * 0.24, -cs * 0.05, cs * 0.78, cs * 0.36, cs * 0.52, cloudTopMat],
        [cs * 0.32, cs * 0.22, cs * 0.08, cs * 0.70, cs * 0.32, cs * 0.48, cloudTopMat],
        [0, -cs * 0.18, 0, cs * 1.25, cs * 0.22, cs * 0.62, cloudBotMat]
      ];
      for (let pi = 0; pi < puffs.length; pi++) {
        const [px, py, pz, sx, sy, sz, pm] = puffs[pi];
        const m = new THREE.Mesh(puffGeo, pm);
        m.position.set(px, py, pz);
        m.scale.set(sx, sy, sz);
        cg.add(m);
      }
      g.add(cg);
      clouds.push({ group: cg, spd: 0.55 + (i % 4) * 0.28 });
    }

    // --- TERRENO IRREGULAR NATURAL DE CAMPO (colinas, vales, barranco e estradinha) ---
    function fieldHeight(x, z) {
      // Ondulações naturais multi-oitava
      let h = 26.0
        + Math.sin(x * 0.028 + 0.4) * Math.cos(z * 0.024 - 0.3) * 7.8
        + Math.sin(x * 0.065 - z * 0.045) * 2.4
        + Math.cos(x * 0.12 + z * 0.11) * 0.65;

      // Colinas mais altas nas laterais e atrás para dar profundidade de mundo real
      const sideLift = Math.pow(Math.max(0, (Math.abs(x) - 24) / 85), 1.6) * 20.0;
      const backLift = Math.pow(Math.max(0, (z - 32) / 95), 1.5) * 16.0;
      h += sideLift + backLift;

      // Aplainamento suave ao longo da estradinha e no promontório onde Nivaldo está (0, 26.15, 0)
      const dPath = Math.abs(x - Math.sin(z * 0.055) * 3.2);
      if (z > -3.5 && z < 55) {
        const pathBlend = clamp(1 - dPath / 7.5, 0, 1);
        const smoothPath = pathBlend * pathBlend * (3 - 2 * pathBlend);
        h = lerp(h, 26.15 + Math.max(0, z - 8) * 0.05, smoothPath * 0.85);
      }
      const dHero = Math.hypot(x, z - 0.5);
      if (dHero < 10) {
        const hb = clamp(1 - dHero / 10, 0, 1);
        h = lerp(h, 26.15, hb * hb * (3 - 2 * hb));
      }

      // Queda escarpada/barranco natural à frente de Nivaldo (z < -2.6) rumo ao abismo do Portal
      const edgeZ = -2.4 - Math.sin(x * 0.09) * 2.2 - Math.cos(x * 0.21) * 0.9;
      if (z < edgeZ) {
        const drop = edgeZ - z;
        h -= Math.pow(drop, 1.38) * 1.45;
      }
      return h;
    }

    const terrW = 320, terrD = 175, segX = 64, segZ = 40;
    const terrGeo = mkGeo(new THREE.PlaneGeometry(terrW, terrD, segX, segZ));
    terrGeo.rotateX(-Math.PI / 2);
    const tPos = terrGeo.attributes.position;
    const tCols = new Float32Array(tPos.count * 3);
    const colTmp = new THREE.Color();

    for (let i = 0; i < tPos.count; i++) {
      const vx = tPos.getX(i);
      const vz = tPos.getZ(i) + 64; // cobre z de -23.5 até +151.5
      const vy = fieldHeight(vx, vz);
      tPos.setXYZ(i, vx, vy, vz);

      // Coloração orgânica de entardecer (grama verde-oliva/dourada, terra na estrada e barranco)
      const dPath = Math.abs(vx - Math.sin(vz * 0.055) * 3.2);
      const edgeZ = -2.4 - Math.sin(vx * 0.09) * 2.2 - Math.cos(vx * 0.21) * 0.9;
      if (vz < edgeZ - 0.8) {
        // Barranco de terra/rocha natural
        colTmp.setHex(vy < 12 ? 0x453024 : 0x6b4b34);
      } else if (vz > -2.5 && vz < 58 && dPath < 2.3) {
        // Estradinha de terra batida sinuosa
        colTmp.setHex(0xa87e50);
      } else {
        // Gramado irregular aquecido pela luz dourada do pôr-do-sol
        const n = Math.sin(vx * 0.14 + vz * 0.11) * 0.5 + 0.5;
        if (vy > 36) colTmp.setHex(n > 0.5 ? 0x496d28 : 0x5c7c2c);
        else colTmp.setHex(n > 0.55 ? 0x5d852b : (n > 0.25 ? 0x4b7424 : 0x6e8c30));
      }
      tCols[i * 3] = colTmp.r;
      tCols[i * 3 + 1] = colTmp.g;
      tCols[i * 3 + 2] = colTmp.b;
    }
    terrGeo.setAttribute('color', new THREE.BufferAttribute(tCols, 3));
    terrGeo.computeVertexNormals();
    const terrMat = mkMat(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const terrMesh = new THREE.Mesh(terrGeo, terrMat);
    g.add(terrMesh);

    // Silhuetas de cadeias de montanhas distantes no horizonte (sensação de mundo amplo)
    const mtnGeo = mkGeo(new THREE.ConeGeometry(1, 1, 6));
    const mtnMatFar = mkMat(new THREE.MeshLambertMaterial({ color: 0x734232 }));
    const mtnMatMid = mkMat(new THREE.MeshLambertMaterial({ color: 0x47453a }));
    const mtnSpecs = [
      [-155, 18, -55, 58, 68, mtnMatFar], [165, 18, -60, 62, 74, mtnMatFar],
      [-190, 22, 10, 65, 62, mtnMatMid], [195, 22, 15, 68, 65, mtnMatMid],
      [-120, 26, 125, 72, 58, mtnMatFar], [130, 26, 130, 76, 62, mtnMatFar],
      [0, 28, 155, 95, 52, mtnMatFar]
    ];
    for (let i = 0; i < mtnSpecs.length; i++) {
      const [mx, my, mz, mr, mh, mm] = mtnSpecs[i];
      const m = new THREE.Mesh(mtnGeo, mm);
      m.position.set(mx, my + mh * 0.45, mz);
      m.scale.set(mr, mh, mr * 0.8);
      m.rotation.y = i * 1.1;
      g.add(m);
    }

    // --- ÁRVORES VARIADAS, ARBUSTOS, PEDRAS E CERCAS SOBRE O TERRENO IRREGULAR ---
    let seed = 7777;
    function srand() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }

    const trunkGeo = mkGeo(new THREE.CylinderGeometry(0.22, 0.38, 1, 6));
    const pineConeGeo = mkGeo(new THREE.ConeGeometry(1, 1, 7));
    const canopyGeo = mkGeo(new THREE.DodecahedronGeometry(1, 1));
    const rockGeo = mkGeo(new THREE.DodecahedronGeometry(1, 0));

    const trunkMat = mkMat(new THREE.MeshLambertMaterial({ color: 0x543620 }));
    const pineMats = [
      mkMat(new THREE.MeshLambertMaterial({ color: 0x264c20 })),
      mkMat(new THREE.MeshLambertMaterial({ color: 0x335c24 })),
      mkMat(new THREE.MeshLambertMaterial({ color: 0x3e6828 }))
    ];
    const oakMats = [
      mkMat(new THREE.MeshLambertMaterial({ color: 0x3f6e24 })),
      mkMat(new THREE.MeshLambertMaterial({ color: 0x588228 })),
      mkMat(new THREE.MeshLambertMaterial({ color: 0x7a8828 })), // folhagem dourada pelo sol!
      mkMat(new THREE.MeshLambertMaterial({ color: 0xa86426 }))  // árvore de entardecer/outono!
    ];
    const rockMat = mkMat(new THREE.MeshLambertMaterial({ color: 0x6b6058 }));

    function placeTree(tx, tz, scale, isPine) {
      const ty = fieldHeight(tx, tz);
      const tg = new THREE.Group();
      tg.position.set(tx, ty - 0.15, tz);
      tg.rotation.y = srand() * Math.PI * 2;
      g.add(tg);

      if (isPine) {
        const th = 3.2 * scale;
        const tr = new THREE.Mesh(trunkGeo, trunkMat);
        tr.scale.set(scale, th, scale);
        tr.position.y = th * 0.5;
        tg.add(tr);

        const pm = pineMats[Math.floor(srand() * pineMats.length)];
        for (let k = 0; k < 3; k++) {
          const c = new THREE.Mesh(pineConeGeo, pm);
          const cr = (2.1 - k * 0.46) * scale;
          const ch = (3.1 - k * 0.35) * scale;
          c.scale.set(cr, ch, cr);
          c.position.y = th * 0.65 + k * 1.45 * scale + ch * 0.3;
          tg.add(c);
        }
      } else {
        const th = 3.4 * scale;
        const tr = new THREE.Mesh(trunkGeo, trunkMat);
        tr.scale.set(scale * 1.1, th, scale * 1.1);
        tr.position.y = th * 0.5;
        tr.rotation.z = (srand() - 0.5) * 0.14;
        tg.add(tr);

        const om = oakMats[Math.floor(srand() * oakMats.length)];
        const blobs = [
          [0, th + 1.3 * scale, 0, 2.2, 1.65, 2.1],
          [-1.15 * scale, th + 0.9 * scale, 0.5 * scale, 1.5, 1.25, 1.45],
          [1.2 * scale, th + 1.0 * scale, -0.4 * scale, 1.6, 1.3, 1.5],
          [0.2 * scale, th + 2.3 * scale, 0.2 * scale, 1.4, 1.1, 1.35]
        ];
        for (let bi = 0; bi < blobs.length; bi++) {
          const [bx, by, bz, sx, sy, sz] = blobs[bi];
          const b = new THREE.Mesh(canopyGeo, om);
          b.position.set(bx, by, bz);
          b.scale.set(sx * scale, sy * scale, sz * scale);
          tg.add(b);
        }
      }
    }

    // 48 árvores distribuídas naturalmente pelas colinas (sem obstruir a visão de Nivaldo nem o portal!)
    for (let i = 0; i < 48; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const tx = side * (11 + srand() * 98);
      const tz = -1.5 + srand() * 78;
      const dPath = Math.abs(tx - Math.sin(tz * 0.055) * 3.2);
      if (dPath < 6.5) continue;
      if (Math.hypot(tx, tz) < 11.5) continue;
      placeTree(tx, tz, 0.85 + srand() * 0.8, srand() < 0.48);
    }
    // Árvores extras atrás no horizonte da colina
    for (let i = 0; i < 16; i++) {
      const tx = (srand() - 0.5) * 140;
      const tz = 48 + srand() * 55;
      placeTree(tx, tz, 1.0 + srand() * 0.85, srand() < 0.55);
    }

    // Arbustos e rochas irregulares acompanhando o terreno
    for (let i = 0; i < 34; i++) {
      const rx = (srand() - 0.5) * 78;
      const rz = -2.2 + srand() * 44;
      const dPath = Math.abs(rx - Math.sin(rz * 0.055) * 3.2);
      if (dPath < 3.4 || Math.hypot(rx, rz) < 4.5) continue;
      const ry = fieldHeight(rx, rz);
      if (i % 3 === 0) {
        const rk = new THREE.Mesh(rockGeo, rockMat);
        const rs = 0.45 + srand() * 1.1;
        rk.position.set(rx, ry + rs * 0.25, rz);
        rk.scale.set(rs * 1.3, rs * 0.72, rs);
        rk.rotation.set(srand(), srand(), srand());
        g.add(rk);
      } else {
        const bs = new THREE.Mesh(canopyGeo, oakMats[i % 2]);
        const sc = 0.55 + srand() * 0.85;
        bs.position.set(rx, ry + sc * 0.4, rz);
        bs.scale.set(sc * 1.25, sc * 0.75, sc * 1.15);
        g.add(bs);
      }
    }

    // Cerca rústica de madeira acompanhando o relevo irregular do campo
    for (const side of [-1, 1]) {
      let prevX = null, prevY = null, prevZ = null;
      for (let fi = 0; fi < 9; fi++) {
        const fx = side * (7.2 + fi * 4.5);
        const fz = 1.8 + Math.sin(fi * 0.6) * 1.4;
        const fy = fieldHeight(fx, fz);
        addBox(g, 0.24, 1.55, 0.24, 0x613f24, fx, fy + 0.68, fz);
        if (prevX !== null) {
          const mx = (prevX + fx) * 0.5;
          const my = (prevY + fy) * 0.5;
          const mz = (prevZ + fz) * 0.5;
          const len = Math.hypot(fx - prevX, fz - prevZ);
          const yaw = Math.atan2(fz - prevZ, fx - prevX);
          const pitch = Math.atan2(fy - prevY, len);
          for (const hOff of [0.55, 1.05]) {
            const rail = addBox(g, len, 0.13, 0.12, 0x754d2d, mx, my + hOff, mz);
            rail.rotation.y = -yaw;
            rail.rotation.z = side > 0 ? pitch : -pitch;
          }
        }
        prevX = fx; prevY = fy; prevZ = fz;
      }
    }

    // Tufos de grama e flores campestres sobre o terreno real
    const flowerCols = [0xffd84d, 0xfff5e0, 0xff7b6b, 0xffaa33];
    for (let i = 0; i < 60; i++) {
      const fx = (srand() - 0.5) * 48;
      const fz = -1.8 + srand() * 34;
      const dPath = Math.abs(fx - Math.sin(fz * 0.055) * 3.2);
      if (dPath < 2.6) continue;
      const fy = fieldHeight(fx, fz);
      addBox(g, 0.34, 0.30, 0.34, 0x487624, fx, fy + 0.12, fz);
      if (i % 2 === 0) {
        addBox(g, 0.17, 0.15, 0.17, flowerCols[i % flowerCols.length], fx, fy + 0.30, fz, { basic: true });
      }
    }

    // Pequena capela / casinha rural distante na colina para reforçar o "mundo real"
    const farmX = -46, farmZ = 34;
    const farmY = fieldHeight(farmX, farmZ);
    const farm = new THREE.Group();
    farm.position.set(farmX, farmY - 0.4, farmZ);
    farm.rotation.y = 0.42;
    g.add(farm);
    addBox(farm, 8.5, 4.8, 11, 0xd8cbb8, 0, 2.4, 0);
    addBox(farm, 9.4, 1.8, 11.8, 0x7a3424, 0, 5.4, 0);
    addBox(farm, 1.4, 1.6, 0.2, 0xffc666, -2.0, 2.5, 5.55, { basic: true });
    addBox(farm, 1.4, 1.6, 0.2, 0xffc666, 2.0, 2.5, 5.55, { basic: true });
    addBox(farm, 0.35, 2.6, 0.35, 0xcba142, 0, 7.6, 4.8, { em: 0x241600 });
    addBox(farm, 1.5, 0.35, 0.35, 0xcba142, 0, 8.2, 4.8, { em: 0x241600 });

    // --- MONTANHA DE TERRA E GRAMA POR CIMA + TÚNEL INFERNAL ESCAVADO NO MEIO ---
    // Boca do túnel centrada em (0, 20, -44), raio interno R = 25m
    const TUN_X = 0, TUN_Y = 20, TUN_Z = -44, TUN_R = 25;

    // 1) Parede frontal orgânica de terra/rocha/grama com a boca do túnel rasgada no meio
    const faceGeo = mkGeo(new THREE.RingGeometry(TUN_R, 145, 36, 4));
    const fPos = faceGeo.attributes.position;
    const fCols = new Float32Array(fPos.count * 3);
    const fColTmp = new THREE.Color();
    for (let i = 0; i < fPos.count; i++) {
      let fx = fPos.getX(i);
      let fy = fPos.getY(i);
      const r = Math.hypot(fx, fy);
      const ang = Math.atan2(fy, fx);
      // Borda da boca irregular (rocha rasgada natural, não círculo perfeito!)
      const mouthNoise = Math.sin(ang * 5) * 1.6 + Math.cos(ang * 9 + 1.2) * 0.9;
      const outerNoise = Math.sin(ang * 4 + 0.5) * 8.0 + Math.cos(ang * 7) * 4.5;
      const rFactor = clamp((r - TUN_R) / 120, 0, 1);
      const nr = r + lerp(mouthNoise, outerNoise, rFactor);
      fx = Math.cos(ang) * nr;
      fy = Math.sin(ang) * nr;
      // Limita o topo da montanha para formar uma silhueta natural de morro (sem parede infinita)
      const maxTop = 34 + Math.sin(fx * 0.045) * 8.5 + Math.cos(fx * 0.09) * 4.0 - Math.abs(fx) * 0.14;
      if (fy > maxTop) fy = maxTop;
      // Relevo Z na encosta (mais recuada no topo e bordas)
      const fz = -Math.max(0, (r - TUN_R) * 0.18) + Math.sin(fx * 0.07 + fy * 0.08) * 3.5;
      fPos.setXYZ(i, fx, fy, fz);

      // Cor: pedra queimada perto da boca -> terra marrom -> grama verde-dourada no topo/laterais!
      const worldY = TUN_Y + fy;
      if (r < TUN_R + 4.5) {
        fColTmp.setHex(0x2b1512); // rocha chamuscada na boca do túnel
      } else if (r < TUN_R + 12) {
        fColTmp.setHex(0x5c3e2b); // barranco de terra e pedra
      } else if (worldY > 36 || (Math.abs(fx) > 36 && worldY > 24)) {
        fColTmp.setHex(Math.sin(fx * 0.12 + fy * 0.1) > 0 ? 0x587f29 : 0x486d23); // grama!
      } else {
        fColTmp.setHex(0x634530); // encosta de terra
      }
      fCols[i * 3] = fColTmp.r;
      fCols[i * 3 + 1] = fColTmp.g;
      fCols[i * 3 + 2] = fColTmp.b;
    }
    faceGeo.setAttribute('color', new THREE.BufferAttribute(fCols, 3));
    faceGeo.computeVertexNormals();
    const faceMat = mkMat(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.set(TUN_X, TUN_Y, TUN_Z);
    g.add(faceMesh);

    // 2) Morro / Teto de GRAMA E TERRA cobrindo POR CIMA de todo o túnel (de z = -42 até z = -185!)
    function ridgeHeight(x, z) {
      // Arco natural passando por cima da boca do túnel (y ~ 52 no topo) e descendo para os lados e para trás
      const dx = x / 52;
      const arch = Math.max(0, 1 - dx * dx * 0.55);
      const backDrop = clamp((-z - 42) / 140, 0, 1);
      let h = 34 + arch * 20 - backDrop * 12
        + Math.sin(x * 0.045 + 0.5) * 6.5
        + Math.cos(z * 0.055) * 4.5
        + Math.sin(x * 0.11 - z * 0.09) * 1.8;
      // Garante que nunca afunde dentro da boca do túnel (x perto de 0, z perto de -44..-130)
      if (Math.abs(x) < 34 && z > -150) {
        const minClear = TUN_Y + TUN_R + 3.5;
        if (h < minClear) h = minClear;
      }
      return h;
    }

    const capW = 280, capD = 145;
    const capGeo = mkGeo(new THREE.PlaneGeometry(capW, capD, 44, 24));
    capGeo.rotateX(-Math.PI / 2);
    const cPos = capGeo.attributes.position;
    const cCols = new Float32Array(cPos.count * 3);
    for (let i = 0; i < cPos.count; i++) {
      const vx = cPos.getX(i);
      const vz = cPos.getZ(i) - 114; // cobre z de -41.5 até -186.5
      const vy = ridgeHeight(vx, vz);
      cPos.setXYZ(i, vx, vy, vz);
      const n = Math.sin(vx * 0.13 + vz * 0.11) * 0.5 + 0.5;
      fColTmp.setHex(n > 0.55 ? 0x5c842a : (n > 0.25 ? 0x497124 : 0x6e8b30));
      cCols[i * 3] = fColTmp.r;
      cCols[i * 3 + 1] = fColTmp.g;
      cCols[i * 3 + 2] = fColTmp.b;
    }
    capGeo.setAttribute('color', new THREE.BufferAttribute(cCols, 3));
    capGeo.computeVertexNormals();
    const capMat = mkMat(new THREE.MeshLambertMaterial({ vertexColors: true }));
    g.add(new THREE.Mesh(capGeo, capMat));

    // Árvores e pedras crescendo EM CIMA do morro de grama por cima do túnel!
    for (let i = 0; i < 36; i++) {
      const rx = (srand() - 0.5) * 170;
      const rz = -46 - srand() * 88;
      const ry = ridgeHeight(rx, rz);
      const sc = 1.0 + srand() * 0.9;
      const tg = new THREE.Group();
      tg.position.set(rx, ry - 0.2, rz);
      tg.rotation.y = srand() * Math.PI * 2;
      g.add(tg);
      if (srand() < 0.55) {
        const th = 3.2 * sc;
        const tr = new THREE.Mesh(trunkGeo, trunkMat);
        tr.scale.set(sc, th, sc); tr.position.y = th * 0.5; tg.add(tr);
        const pm = pineMats[Math.floor(srand() * pineMats.length)];
        for (let k = 0; k < 3; k++) {
          const c = new THREE.Mesh(pineConeGeo, pm);
          const cr = (2.1 - k * 0.45) * sc, ch = (3.1 - k * 0.35) * sc;
          c.scale.set(cr, ch, cr); c.position.y = th * 0.65 + k * 1.45 * sc + ch * 0.3; tg.add(c);
        }
      } else {
        const th = 3.4 * sc;
        const tr = new THREE.Mesh(trunkGeo, trunkMat);
        tr.scale.set(sc * 1.1, th, sc * 1.1); tr.position.y = th * 0.5; tg.add(tr);
        const om = oakMats[Math.floor(srand() * oakMats.length)];
        const b = new THREE.Mesh(canopyGeo, om);
        b.position.set(0, th + 1.4 * sc, 0); b.scale.set(2.3 * sc, 1.7 * sc, 2.2 * sc); tg.add(b);
      }
    }

    // 3) O TÚNEL INFERNAL PROPRIAMENTE DITO (escavado sob a montanha de terra e grama!)
    portalGroup = new THREE.Group();
    portalGroup.position.set(TUN_X, TUN_Y, TUN_Z);
    g.add(portalGroup);

    // Parede interna do túnel (cilindro profundo descendo inclinado para dentro do Inferno)
    tunnelWallTex = createTunnelWallTexture();
    const tunGeo = mkGeo(new THREE.CylinderGeometry(TUN_R + 0.5, TUN_R + 14, 130, 28, 8, true));
    tunGeo.rotateX(Math.PI / 2); // eixo ao longo de Z
    const tunMat = mkMat(new THREE.MeshBasicMaterial({
      map: tunnelWallTex,
      side: THREE.BackSide,
      fog: false
    }));
    const tunMesh = new THREE.Mesh(tunGeo, tunMat);
    tunMesh.position.set(0, -10, -64);
    tunMesh.rotation.x = -0.15; // inclinado descendo rumo ao Inferno!
    portalGroup.add(tunMesh);

    // Moldura rochosa + fissuras de magma agarradas na boca do túnel (integrada à pedra, NÃO um bambolê!)
    portalRings = [];
    portalDebris = [];
    for (let i = 0; i < 32; i++) {
      const ang = (i / 32) * Math.PI * 2;
      const mouthNoise = Math.sin(ang * 5) * 1.4 + Math.cos(ang * 9 + 1.2) * 0.8;
      const rad = TUN_R + mouthNoise + 0.6;
      const rk = new THREE.Mesh(rockGeo, i % 4 === 0 ? mkMat(new THREE.MeshBasicMaterial({ color: 0x8f1a0c, fog: false })) : rockMat);
      const rs = 2.4 + (i % 4) * 1.1;
      rk.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad, (i % 3 - 1) * 2.2);
      rk.scale.set(rs * 1.1, rs * 0.9, rs * 1.4);
      rk.rotation.set(i * 0.7, i * 1.1, ang);
      portalGroup.add(rk);
    }

    // Anéis sutis de energia/calor dentro do túnel (profundidade, não flutuando fora!)
    const innerGlowSpecs = [
      { z: -10, r: TUN_R - 0.6, col: 0xff4810, spd: 0.45 },
      { z: -36, r: TUN_R + 2.2, col: 0xd91810, spd: -0.65 },
      { z: -68, r: TUN_R + 5.5, col: 0xff6a18, spd: 0.85 }
    ];
    for (let i = 0; i < innerGlowSpecs.length; i++) {
      const ig = innerGlowSpecs[i];
      const rGeo = mkGeo(new THREE.TorusGeometry(ig.r, 0.55, 6, 28));
      const rMat = mkMat(new THREE.MeshBasicMaterial({
        color: ig.col,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        fog: false
      }));
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.set(0, -i * 3.8, ig.z);
      portalGroup.add(rMesh);
      portalRings.push({ mesh: rMesh, spd: ig.spd });
    }

    // 4) CÂMARA ABISSAL FECHADA NO FUNDO DO TÚNEL: a Cidade Natal muito lá embaixo no Inferno!
    // (Cúpula fechada escura-carmesim impede qualquer vazamento ou quadrado preto fora do túnel!)
    const hellChamberGeo = mkGeo(new THREE.SphereGeometry(120, 20, 14));
    const hellChamberMat = mkMat(new THREE.MeshBasicMaterial({ color: 0x240505, side: THREE.BackSide, fog: false }));
    const hellChamber = new THREE.Mesh(hellChamberGeo, hellChamberMat);
    hellChamber.position.set(0, -18, -210);
    g.add(hellChamber);

    const HELL_Y = -68;
    const hellFloorGeo = mkGeo(new THREE.CircleGeometry(108, 24));
    const hellFloorMat = mkMat(new THREE.MeshBasicMaterial({ color: 0x1a0808, side: THREE.DoubleSide, fog: false }));
    const hellFloor = new THREE.Mesh(hellFloorGeo, hellFloorMat);
    hellFloor.rotation.x = -Math.PI / 2;
    hellFloor.position.set(0, HELL_Y, -205);
    g.add(hellFloor);

    // Rios de lava e ruas em chamas visíveis no fundo do túnel
    addBox(g, 11, 0.3, 150, 0xff3b0a, -22, HELL_Y + 0.2, -205, { basic: true, nofog: true });
    addBox(g, 9, 0.3, 150, 0xff5a12, 24, HELL_Y + 0.2, -205, { basic: true, nofog: true });
    addBox(g, 140, 0.3, 9, 0xe0260a, 0, HELL_Y + 0.2, -195, { basic: true, nofog: true });

    fires = [];
    const houseColors = [0x4c342e, 0x3a2824, 0x563c34, 0x30201d, 0x452e28];
    const roofColors = [0x632018, 0x4a1813, 0x351716, 0x73281b];
    for (let i = 0; i < 64; i++) {
      const hx = (srand() - 0.5) * 110;
      const hz = -155 - srand() * 95;
      const hw = 4.0 + srand() * 5.8;
      const hd = 4.0 + srand() * 5.8;
      const hh = 4.2 + srand() * 8.5;
      const house = new THREE.Group();
      house.position.set(hx, HELL_Y, hz);
      house.rotation.y = (srand() - 0.5) * 0.4;
      g.add(house);

      addBox(house, hw, hh, hd, houseColors[i % houseColors.length], 0, hh * 0.5, 0, { basic: true, nofog: true });
      addBox(house, hw + 0.6, 1.0, hd + 0.6, roofColors[i % roofColors.length], 0, hh + 0.5, 0, { basic: true, nofog: true });
      if (srand() < 0.72) {
        const wCol = srand() < 0.65 ? 0xff5a18 : 0xffaa33;
        addBox(house, 0.9, 1.1, 0.2, wCol, -hw * 0.24, hh * 0.55, hd * 0.5 + 0.1, { basic: true, nofog: true });
        addBox(house, 0.9, 1.1, 0.2, wCol, hw * 0.24, hh * 0.55, hd * 0.5 + 0.1, { basic: true, nofog: true });
      }
      if (srand() < 0.38) {
        const fh = 4.0 + srand() * 7.5;
        const fm = addBox(g, 2.4, fh, 2.4, 0xff4d0c, hx, HELL_Y + hh + fh * 0.45, hz, { basic: true, tr: 0.82, nofog: true });
        const fc = addBox(g, 1.3, fh * 0.65, 1.3, 0xffcc33, hx, HELL_Y + hh + fh * 0.35, hz, { basic: true, nofog: true });
        fires.push({ outer: fm, core: fc, phase: srand() * 6.28 });
      }
    }

    // --- NIVALDO NA COLINA DO CAMPO OLHANDO PARA O PORTAL ---
    nivaldo2 = BUILD.nivaldo();
    hideNivaldoWeapons(nivaldo2);
    nivaldo2.root.position.set(0, 26.18, -0.4);
    nivaldo2.root.rotation.y = Math.PI;
    g.add(nivaldo2.root);

    const cgGeo = mkGeo(new THREE.SphereGeometry(0.24, 10, 8));
    const cgMat = mkMat(new THREE.MeshBasicMaterial({
      color: 0xffe466,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    crossGlowMesh = new THREE.Mesh(cgGeo, cgMat);
    crossGlowMesh.position.set(0, 0.22, 0.44);
    nivaldo2.chestGroup.add(crossGlowMesh);

    crossGlowLight = new THREE.PointLight(0xffd84a, 0, 8);
    crossGlowLight.position.set(0, 0.22, 0.55);
    nivaldo2.chestGroup.add(crossGlowLight);

    faithSparks = [];
    for (let i = 0; i < 22; i++) {
      const sp = addBox(g, 0.055, 0.055, 0.055, i % 2 === 0 ? 0xffe466 : 0xffffff, 0, 27.6, -0.4, { basic: true });
      sp.visible = false;
      faithSparks.push({ mesh: sp, ang: (i / 22) * Math.PI * 2, rad: 0.15 + (i % 4) * 0.12, phase: (i / 22) });
    }

    // Brasas escapando apenas perto da boca do portal
    embers = [];
    for (let i = 0; i < 45; i++) {
      const em = addBox(
        g,
        0.18, 0.18, 0.18,
        i % 3 === 0 ? 0xffaa22 : 0xff3b10,
        (Math.random() - 0.5) * 75,
        -15 + Math.random() * 65,
        -95 + Math.random() * 45,
        { basic: true, nofog: true }
      );
      embers.push({ mesh: em, vx: (Math.random() - 0.5) * 2.2, vy: 2.0 + Math.random() * 4.0, vz: 1.5 + Math.random() * 2.5 });
    }

    return g;
  }

  /* ------------------------------------------------------------
     ATO 3: ADICIONADO DIRETO AO MAPA REAL ATUAL (worldScene)!
            Queda Livre com braços/pernas abertos -> Pouso
            Homem de Ferro exatamente no ponto de spawn ->
            "Vamos ver do que esses demônios são feitos" ->
            Saca o Martelinho -> Câmera encaixa na 1ª pessoa!
     ------------------------------------------------------------ */
  function buildAct3Overlay() {
    const g = new THREE.Group();

    // Portal gigante rasgado lá no alto no céu do mapa real (a1)!
    const skyPortal = new THREE.Group();
    skyPortal.position.set(spawnX, spawnY + 118, spawnZ - 2);
    skyPortal.rotation.x = Math.PI / 2;
    g.add(skyPortal);

    const skyCoreGeo = mkGeo(new THREE.CircleGeometry(30, 28));
    const skyCoreMat = mkMat(new THREE.MeshBasicMaterial({
      color: 0xffaa58, // céu dourado de entardecer brilhando lá em cima através da janela!
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      fog: false
    }));
    skyPortal.add(new THREE.Mesh(skyCoreGeo, skyCoreMat));

    skyPortalRings = [];
    const skySpecs = [
      { r: 36, tube: 2.3, col: 0x3b0408, spd: 0.35 },
      { r: 33, tube: 1.6, col: 0xe01c10, spd: -0.65 },
      { r: 29.5, tube: 1.1, col: 0xff6818, spd: 1.05 }
    ];
    for (let i = 0; i < skySpecs.length; i++) {
      const ss = skySpecs[i];
      const rGeo = mkGeo(new THREE.TorusGeometry(ss.r, ss.tube, 7, 28));
      const rMat = mkMat(new THREE.MeshBasicMaterial({ color: ss.col, fog: false }));
      const rMesh = new THREE.Mesh(rGeo, rMat);
      skyPortal.add(rMesh);
      skyPortalRings.push({ mesh: rMesh, spd: ss.spd });
    }

    // Luz suave destacando Nivaldo no ponto de spawn
    const heroLight = new THREE.PointLight(0xffbb77, 1.8, 22);
    heroLight.position.set(spawnX + 2.0, spawnY + 4.5, spawnZ - 4.0);
    g.add(heroLight);

    // Cratera e onda de choque exatamente no ponto de spawn do player!
    const craterGeo = mkGeo(new THREE.RingGeometry(0.35, 3.4, 14));
    const craterMat = mkMat(new THREE.MeshBasicMaterial({ color: 0x0d0605, side: THREE.DoubleSide }));
    impactCrater = new THREE.Mesh(craterGeo, craterMat);
    impactCrater.rotation.x = -Math.PI / 2;
    impactCrater.position.set(spawnX, spawnY + 0.08, spawnZ);
    impactCrater.visible = false;
    g.add(impactCrater);

    const shockGeo = mkGeo(new THREE.RingGeometry(0.6, 1.45, 24));
    const shockMat = mkMat(new THREE.MeshBasicMaterial({
      color: 0xff8833,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    impactRing = new THREE.Mesh(shockGeo, shockMat);
    impactRing.rotation.x = -Math.PI / 2;
    impactRing.position.set(spawnX, spawnY + 0.14, spawnZ);
    impactRing.visible = false;
    g.add(impactRing);

    impactChunks = [];
    for (let i = 0; i < 26; i++) {
      const ang = (i / 26) * Math.PI * 2 + (i % 3) * 0.11;
      const spd = 4.2 + (i % 5) * 2.0;
      const sz = 0.14 + (i % 4) * 0.075;
      const m = addBox(g, sz, sz * 0.75, sz * 1.1, i % 4 === 0 ? 0xff6a1a : 0x3b2822, spawnX, spawnY + 0.2, spawnZ, i % 4 === 0 ? { basic: true } : {});
      m.visible = false;
      impactChunks.push({
        mesh: m,
        vx: Math.cos(ang) * spd,
        vy: 5.2 + (i % 6) * 2.1,
        vz: Math.sin(ang) * spd,
        rx: (i % 2 ? 1 : -1) * 5.5,
        rz: (i % 3 ? 1 : -1) * 4.5
      });
    }

    // Linhas de vento passando durante a queda livre
    windStreaks = [];
    for (let i = 0; i < 40; i++) {
      const ws = addBox(
        g,
        0.06, 2.8 + (i % 4) * 1.1, 0.06,
        i % 3 === 0 ? 0xff8844 : 0xe0b8a8,
        spawnX + (Math.random() - 0.5) * 16,
        spawnY + Math.random() * 115,
        spawnZ + (Math.random() - 0.5) * 16,
        { basic: true, tr: 0.42 }
      );
      windStreaks.push({ mesh: ws, spd: 54 + Math.random() * 36 });
    }

    // Nivaldo caindo direto no ponto de spawn, virado para -Z (direção inicial P.yaw = 0!)
    nivaldo3 = BUILD.nivaldo();
    hideNivaldoWeapons(nivaldo3);
    nivaldo3.root.position.set(spawnX, spawnY + 108, spawnZ);
    nivaldo3.root.rotation.y = Math.PI;
    g.add(nivaldo3.root);

    const hsGeo = mkGeo(new THREE.SphereGeometry(0.28, 8, 6));
    const hsMat = mkMat(new THREE.MeshBasicMaterial({
      color: 0xffe070,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    hammerSpark = new THREE.Mesh(hsGeo, hsMat);
    hammerSpark.position.set(0, -0.15, 0.35);
    if (nivaldo3.handL) nivaldo3.handL.add(hammerSpark);

    return g;
  }

  function restoreWorldFog() {
    if (worldScene && worldScene.fog && savedWorldFogNear != null) {
      worldScene.fog.near = savedWorldFogNear;
      worldScene.fog.far = savedWorldFogFar;
      savedWorldFogNear = null;
      savedWorldFogFar = null;
    }
  }

  function setAct(num) {
    if (curAct === num) return;
    curAct = num;
    if (act1Group) act1Group.visible = (num === 1);
    if (act2Group) act2Group.visible = (num === 2);

    if (num === 1) {
      scene.background = new THREE.Color(0x10080a);
      scene.fog = new THREE.Fog(0x14080b, 14, 46);
    } else if (num === 2) {
      // Entardecer laranja dourado no mundo fora do Inferno!
      scene.background = new THREE.Color(0xe87b35);
      scene.fog = new THREE.Fog(0xe6803c, 105, 360);
    } else if (num === 3 && worldScene) {
      if (!act3WorldGroup) {
        act3WorldGroup = buildAct3Overlay();
        worldScene.add(act3WorldGroup);
      }
      if (worldScene.fog && savedWorldFogNear == null) {
        savedWorldFogNear = worldScene.fog.near;
        savedWorldFogFar = worldScene.fog.far;
        worldScene.fog.near = 55;
        worldScene.fog.far = 260;
      }
    }
  }

  function setFlashOverlay(color, alpha) {
    const f = document.getElementById('flash');
    if (!f) return;
    f.style.background = color;
    f.style.opacity = String(clamp(alpha, 0, 1));
  }

  function fireOnce(key, fn) {
    if (fired[key]) return;
    fired[key] = true;
    fn();
  }

  function start(opts) {
    stop(true);
    callbacks = opts || {};
    active = true;
    t = 0;
    curAct = 0;
    fired = {};
    skipGrace = 0.55;

    worldScene = callbacks.worldScene || null;
    if (callbacks.spawnPos) {
      spawnX = callbacks.spawnPos.x;
      spawnY = callbacks.spawnPos.y;
      spawnZ = callbacks.spawnPos.z;
    } else {
      spawnX = 0; spawnY = 0; spawnZ = 10;
    }
    playerEye = callbacks.playerEye || 2.08;

    scene = new THREE.Scene();
    act1Group = buildAct1();
    act2Group = buildAct2();
    scene.add(act1Group);
    scene.add(act2Group);
    setAct(1);

    if (callbacks.camera) {
      savedCamFov = callbacks.camera.fov;
      savedCamFar = callbacks.camera.far;
      callbacks.camera.far = 480;
      callbacks.camera.updateProjectionMatrix();
    }

    if (callbacks.setCinemaUI) callbacks.setCinemaUI(true);
    const skipHint = document.getElementById('cinemaSkipHint');
    if (skipHint) skipHint.classList.add('on');
    setFlashOverlay('#000', 1);
  }

  function stop(silent) {
    if (!active && !scene && !act3WorldGroup) return;
    active = false;

    const skipHint = document.getElementById('cinemaSkipHint');
    if (skipHint) skipHint.classList.remove('on');
    setFlashOverlay('#000', 0);

    if (act3WorldGroup && worldScene) {
      worldScene.remove(act3WorldGroup);
    }
    act3WorldGroup = null;
    restoreWorldFog();

    if (callbacks && callbacks.camera) {
      callbacks.camera.fov = savedCamFov || 75;
      callbacks.camera.far = savedCamFar || 300;
      callbacks.camera.updateProjectionMatrix();
    }

    for (let i = 0; i < ownedGeos.length; i++) {
      try { ownedGeos[i].dispose(); } catch (e) {}
    }
    for (let i = 0; i < ownedMats.length; i++) {
      try { ownedMats[i].dispose(); } catch (e) {}
    }
    ownedGeos = [];
    ownedMats = [];

    scene = null;
    worldScene = null;
    act1Group = null;
    act2Group = null;
    cardinals = [];
    nivaldo1 = null;
    nivaldo2 = null;
    nivaldo3 = null;
    crossGlowMesh = null;
    crossGlowLight = null;
    portalGroup = null;
    portalRings = [];
    portalDebris = [];
    tunnelWallTex = null;
    skyPortalRings = [];
    candles = [];
    fires = [];
    clouds = [];
    dustParticles = [];
    embers = [];
    faithSparks = [];
    windStreaks = [];
    impactRing = null;
    impactCrater = null;
    impactChunks = [];
    hammerSpark = null;
    councilLight = null;

    const cb = callbacks;
    callbacks = null;
    if (!silent && cb && cb.onComplete) cb.onComplete();
  }

  function skip() {
    if (!active || skipGrace > 0) return false;
    stop(false);
    return true;
  }

  /* ------------------------------------------------------------
     UPDATE ATO 1
     ------------------------------------------------------------ */
  function updateAct1(dt, camera) {
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const f = 0.85 + Math.sin(t * 14 + c.phase) * 0.18 + Math.cos(t * 23 + c.phase) * 0.1;
      c.mesh.scale.set(0.9 + (f - 0.85) * 0.4, f, 0.9 + (f - 0.85) * 0.4);
      c.mesh.position.y = c.baseY + (f - 1) * 0.08;
    }
    if (councilLight) councilLight.intensity = 2.15 + Math.sin(t * 7.3) * 0.15;

    for (let i = 0; i < dustParticles.length; i++) {
      const d = dustParticles[i];
      d.mesh.position.x = d.bx + Math.sin(t * 0.6 + d.phase) * 0.4;
      d.mesh.position.y = 1.2 + ((d.by + t * d.spd) % 12.5);
    }

    const decreeAmt = (t >= 16.0 && t < 20.6) ? smooth((t - 16.0) / 0.7) * (1 - smooth((t - 19.8) / 0.7)) : 0;
    const speakAmt = (t >= 2.0 && t < 23.5) ? 1 : 0;

    for (let i = 0; i < cardinals.length; i++) {
      const c = cardinals[i];
      const r = c.rig;
      const breath = Math.sin(t * 1.8 + c.phase) * 0.025;
      r.head.rotation.x = 0.04 + breath;
      r.head.rotation.y = Math.sin(t * 0.7 + c.phase) * 0.05;

      let armRX = -0.22, armRZ = -0.14, foreRX = -0.55;
      if (c.isLeader && speakAmt > 0) {
        const gest = Math.sin(t * 3.1 + c.phase) * 0.22;
        armRX = -0.68 + gest;
        foreRX = -0.72 - gest * 0.5;
      }
      if (decreeAmt > 0) {
        armRX = lerp(armRX, -1.25, decreeAmt);
        armRZ = lerp(armRZ, -0.22, decreeAmt);
        foreRX = lerp(foreRX, -0.28, decreeAmt);
      }
      r.armR.rotation.set(armRX, 0, armRZ);
      r.forearmR.rotation.set(foreRX, 0, 0.24);
      r.armL.rotation.set(-0.22 + breath, 0, 0.14);
      r.forearmL.rotation.set(-0.55, 0, -0.24);
    }

    if (nivaldo1) {
      const nb = Math.sin(t * 2.1) * 0.025;
      nivaldo1.chestGroup.rotation.x = nb;
      nivaldo1.head.rotation.x = -0.06;
      const tense = t >= 22.0 ? smooth((t - 22.0) / 1.2) : 0;
      nivaldo1.armL.rotation.set(-0.08 - tense * 0.35, 0, 0.12 + tense * 0.08);
      nivaldo1.forearmL.rotation.set(-0.18 - tense * 0.55, 0, 0);
      nivaldo1.armR.rotation.set(-0.08 - tense * 0.35, 0, -0.12 - tense * 0.08);
      nivaldo1.forearmR.rotation.set(-0.18 - tense * 0.55, 0, 0);
    }

    fireOnce('a1_title_on', () => {
      if (callbacks.setCinemaUI) callbacks.setCinemaUI(true, 'CONSELHO DOS SUPER-CARDEAIS', 'ANO 666 D.S.C. · BASÍLICA SUPREMA');
      if (window.SFX) SFX.play('ghost');
    });
    if (t >= 4.2) fireOnce('a1_title_off', () => { if (callbacks.setCinemaUI) callbacks.setCinemaUI(true); });
    if (t >= 1.8) fireOnce('a1_line1', () => {
      if (callbacks.say) callbacks.say('"Nivaldo... o Conselho dos Doze Super-Cardeais o convocou diante de uma blasfêmia sem precedentes."', 'CONSELHO DOS SUPER-CARDEAIS', 4.2);
    });
    if (t >= 6.0) fireOnce('a1_line2', () => {
      if (window.SFX) SFX.play('thunder');
      if (callbacks.say) callbacks.say('"Testus MMDCLXVI, o atual Super-Papa, desapareceu... corrompido pelas trevas satânicas do Inferno!"', 'SUPER-CARDEAL', 5.2);
    });
    if (t >= 11.4) fireOnce('a1_line3', () => {
      if (callbacks.say) callbacks.say('"Você foi escolhido entre todos os fiéis por ser o Mais Forte Super-Crente do Mundo."', 'SUPER-CARDEAL', 4.5);
    });
    if (t >= 16.1) fireOnce('a1_line4', () => {
      if (window.SFX) SFX.play('shock');
      if (callbacks.say) callbacks.say('"Você terá apenas TRÊS DIAS para retornar com a cabeça de Testus!"', 'CONSELHO DOS SUPER-CARDEAIS', 4.3);
    });
    if (t >= 20.6) fireOnce('a1_line5', () => {
      if (window.SFX) SFX.play('thunder');
      if (callbacks.say) callbacks.say('"Vá agora! Neste exato instante, sua cidade natal está sendo engolida pelo Portal do Inferno!"', 'SUPER-CARDEAL', 4.0);
    });

    const cPos = new V3();
    const cLook = new V3();
    let fov = 62;

    if (t < 5.6) {
      const u = smooth(t / 5.6);
      cPos.set(lerp(-5.5, 4.2, u), lerp(4.2, 5.8, u), lerp(9.2, 7.6, u));
      cLook.set(0, lerp(2.2, 3.3, u), lerp(-3.5, -8.5, u));
      fov = 64;
    } else if (t < 11.2) {
      const u = smooth((t - 5.6) / 5.6);
      cPos.set(lerp(-4.6, 4.6, u), lerp(3.9, 4.2, u), lerp(-3.6, -3.4, u));
      cLook.set(lerp(-1.2, 1.2, u), 3.7, -9.2);
      fov = 52;
    } else if (t < 16.0) {
      const u = smooth((t - 11.2) / 4.8);
      cPos.set(lerp(2.4, -2.1, u), lerp(1.65, 2.35, u), lerp(0.55, 0.35, u));
      cLook.set(0, 1.95, 3.6);
      fov = 48;
    } else if (t < 20.6) {
      const u = smooth((t - 16.0) / 4.6);
      cPos.set(lerp(6.8, -6.8, u), lerp(5.4, 4.6, u), lerp(3.2, 1.4, u));
      cLook.set(0, 3.5, -8.5);
      fov = 62;
    } else {
      const u = smooth((t - 20.6) / 4.2);
      cPos.set(lerp(-1.35, -0.85, u), lerp(2.15, 2.08, u), lerp(1.05, 1.75, u));
      cLook.set(0, 2.05, 3.6);
      fov = lerp(50, 42, u);
    }

    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.position.copy(cPos);
    camera.lookAt(cLook);

    if (t < 1.1) setFlashOverlay('#000', 1 - smooth(t / 1.1));
    else if (t >= 24.1) setFlashOverlay('#000', smooth((t - 24.1) / 0.85));
    else setFlashOverlay('#000', 0);
  }

  /* ------------------------------------------------------------
     UPDATE ATO 2 (Campo Bonito + Janela do Portal + Mergulho Superman)
     ------------------------------------------------------------ */
  function updateAct2(dt, camera) {
    const a2t = t - ACT2_TIME;

    for (let i = 0; i < clouds.length; i++) {
      clouds[i].group.position.x += clouds[i].spd * dt;
    }
    if (tunnelWallTex) {
      tunnelWallTex.offset.y -= dt * 0.28;
    }
    for (let i = 0; i < portalRings.length; i++) {
      portalRings[i].mesh.rotation.z += portalRings[i].spd * dt;
    }
    for (let i = 0; i < portalDebris.length; i++) {
      const d = portalDebris[i];
      d.ang += d.spd * dt;
      d.mesh.position.set(Math.cos(d.ang) * d.rad, Math.sin(d.ang) * d.rad, d.zOff);
      d.mesh.rotation.x += dt * 1.1;
      d.mesh.rotation.y += dt * 0.9;
    }
    for (let i = 0; i < fires.length; i++) {
      const f = fires[i];
      const sc = 0.82 + Math.sin(t * 11 + f.phase) * 0.22;
      f.outer.scale.set(1, sc, 1);
      f.core.scale.set(1, sc * 0.92, 1);
    }
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      e.mesh.position.x += e.vx * dt;
      e.mesh.position.y += e.vy * dt;
      e.mesh.position.z += e.vz * dt;
      if (e.mesh.position.y > 55 || e.mesh.position.z > -35) {
        e.mesh.position.set((Math.random() - 0.5) * 75, -15 + Math.random() * 40, -95 + Math.random() * 25);
      }
    }

    fireOnce('a2_enter', () => {
      if (window.SFX) { SFX.play('portal'); SFX.play('roar'); }
    });
    if (a2t >= 1.4) fireOnce('a2_title_on', () => {
      if (callbacks.setCinemaUI) callbacks.setCinemaUI(true, 'CIDADE NATAL DE NIVALDO', 'PORTAL DO INFERNO · DIA 1 DE 3', 'galius');
    });
    if (a2t >= 5.2) fireOnce('a2_title_off', () => { if (callbacks.setCinemaUI) callbacks.setCinemaUI(true); });
    if (a2t >= 8.6) fireOnce('a2_cross_sfx', () => { if (window.SFX) SFX.play('faith'); });
    if (a2t >= 9.2) fireOnce('a2_nivaldo_line', () => {
      if (callbacks.say) callbacks.say('"Que o Super-Senhor esteja comigo."', 'NIVALDO', 3.8);
    });
    if (a2t >= 13.9) fireOnce('a2_jump_sfx', () => {
      if (window.SFX) { SFX.play('dash'); SFX.play('portal'); }
    });

    const nivPos = new V3(0, 26.18, -0.4);
    if (nivaldo2) {
      const gripIn = a2t >= 8.2 ? smooth((a2t - 8.2) / 0.95) : 0;
      const gripOut = a2t >= 13.0 ? smooth((a2t - 13.0) / 0.5) : 0;
      const grip = gripIn * (1 - gripOut);

      if (crossGlowMesh && crossGlowLight) {
        const pulse = 0.85 + Math.sin(t * 14) * 0.15;
        crossGlowMesh.material.opacity = grip * 0.72 * pulse;
        crossGlowMesh.scale.setScalar(0.8 + grip * 0.65 * pulse);
        crossGlowLight.intensity = grip * 3.4 * pulse;
      }

      for (let i = 0; i < faithSparks.length; i++) {
        const sp = faithSparks[i];
        if (grip > 0.2) {
          sp.mesh.visible = true;
          const u = ((a2t * 0.9 + sp.phase) % 1);
          const ang = sp.ang + a2t * 2.2;
          sp.mesh.position.set(
            nivPos.x + Math.cos(ang) * sp.rad * (1 + u * 1.4),
            nivPos.y + 1.55 + u * 1.45,
            nivPos.z - 0.35 + Math.sin(ang) * sp.rad * (1 + u * 1.4)
          );
          sp.mesh.scale.setScalar(Math.max(0.01, (1 - u) * grip));
        } else {
          sp.mesh.visible = false;
        }
      }

      nivaldo2.torsoGroup.rotation.set(0, 0, 0);
      nivaldo2.chestGroup.rotation.set(Math.sin(t * 2.4) * 0.02, 0, 0);
      nivaldo2.head.rotation.set(0.16, 0, 0);
      nivaldo2.legL.rotation.set(0, 0, 0);
      nivaldo2.kneeL.rotation.set(0, 0, 0);
      nivaldo2.legR.rotation.set(0, 0, 0);
      nivaldo2.kneeR.rotation.set(0, 0, 0);
      if (nivaldo2.footL) nivaldo2.footL.rotation.set(0, 0, 0);
      if (nivaldo2.footR) nivaldo2.footR.rotation.set(0, 0, 0);
      nivaldo2.armL.rotation.set(-0.08, 0, 0.14);
      nivaldo2.forearmL.rotation.set(-0.22, 0, 0);

      nivaldo2.armR.rotation.set(
        lerp(-0.08, -1.18, grip),
        lerp(0, -0.45, grip),
        lerp(-0.14, 0.62, grip)
      );
      nivaldo2.forearmR.rotation.set(
        lerp(-0.22, -1.25, grip),
        0,
        lerp(0, 0.35, grip)
      );

      // Impulso e MERGULHO IGUAL O SUPERMAN (braços esticados para frente!)
      if (a2t >= 13.3 && a2t < 14.0) {
        const c = smooth((a2t - 13.3) / 0.7);
        nivPos.y = 26.18 - c * 0.42;
        nivPos.z = -0.4 - c * 0.75;
        nivaldo2.torsoGroup.rotation.x = c * 0.40;
        nivaldo2.legL.rotation.x = -c * 0.65;
        nivaldo2.kneeL.rotation.x = c * 1.15;
        nivaldo2.legR.rotation.x = -c * 0.55;
        nivaldo2.kneeR.rotation.x = c * 1.05;
        nivaldo2.armL.rotation.set(c * 0.55, 0, 0.22);
        nivaldo2.armR.rotation.set(c * 0.55, 0, -0.22);
      } else if (a2t >= 14.0) {
        const j = clamp((a2t - 14.0) / 3.1, 0, 1);
        const je = easeInQuad(j);
        const arc = Math.sin(j * Math.PI) * 4.8;
        nivPos.y = lerp(26.1, 12.0, je) + arc * (1 - j * 0.5);
        nivPos.z = lerp(-1.15, -78.0, lerp(j, je, 0.45));

        const sup = smooth(j * 2.4);
        // Corpo esticado em mergulho horizontal para frente (Superman!)
        nivaldo2.torsoGroup.rotation.x = lerp(0.40, 1.56, sup);
        nivaldo2.head.rotation.x = lerp(0.1, -0.90, sup); // rosto olhando reto para frente
        // BRAÇOS ESTICADOS PARA FRENTE (acima da cabeça em local = pra frente no mergulho!)
        nivaldo2.armL.rotation.set(lerp(0.55, -2.96, sup), 0, lerp(0.22, 0.08, sup));
        nivaldo2.forearmL.rotation.set(-0.08, 0, 0);
        nivaldo2.armR.rotation.set(lerp(0.55, -2.96, sup), 0, lerp(-0.22, -0.08, sup));
        nivaldo2.forearmR.rotation.set(-0.08, 0, 0);
        // Pernas estendidas retas atrás como no voo do Superman (legL/legR são filhos de root, não de torsoGroup!)
        nivaldo2.legL.rotation.set(lerp(-0.65, 1.62, sup), 0, lerp(0, -0.06, sup));
        nivaldo2.kneeL.rotation.set(lerp(1.15, 0.14, sup), 0, 0);
        nivaldo2.legR.rotation.set(lerp(-0.55, 1.54, sup), 0, lerp(0, 0.06, sup));
        nivaldo2.kneeR.rotation.set(lerp(1.05, 0.10, sup), 0, 0);
        if (nivaldo2.footL) nivaldo2.footL.rotation.set(lerp(0, 0.55, sup), 0, 0);
        if (nivaldo2.footR) nivaldo2.footR.rotation.set(lerp(0, 0.55, sup), 0, 0);
      }

      nivaldo2.root.position.copy(nivPos);
    }

    const cPos = new V3();
    const cLook = new V3();
    let fov = 68;

    if (a2t < 8.2) {
      // Zoom out de trás do Nivaldo e subindo, revelando o campo bonito ao entardecer,
      // o morro de grama/terra com árvores passando POR CIMA do túnel infernal,
      // e a cidade em chamas muito lá embaixo no fundo do túnel!
      const u = smooth(a2t / 8.2);
      const uSlow = easeOutCubic(a2t / 8.2);
      cPos.set(Math.sin(u * 0.7) * 1.8, lerp(28.15, 45.5, u), lerp(2.45, 25.5, u));
      cLook.set(0, lerp(27.0, 12.0, uSlow), lerp(-22.0, -98.0, uSlow));
      fov = lerp(56, 74, u);
    } else if (a2t < 13.3) {
      const u = smooth((a2t - 8.2) / 5.1);
      cPos.set(lerp(1.55, 1.15, u), lerp(27.88, 27.95, u), lerp(-2.55, -2.15, u));
      cLook.set(0, 27.78, -0.35);
      fov = lerp(46, 42, u);
    } else {
      if (a2t < 14.15) {
        const p = smooth((a2t - 13.3) / 0.85);
        cPos.set(lerp(3.6, 4.4, p), lerp(28.2, 29.1, p), lerp(2.2, 3.2, p));
        cLook.set(nivPos.x, nivPos.y + 1.4, nivPos.z - 2.0);
        fov = 62;
      } else {
        const follow = clamp((a2t - 14.15) / 3.0, 0, 1);
        cPos.set(lerp(4.4, 1.8, smooth(follow)), nivPos.y + lerp(3.4, 2.2, follow), nivPos.z + lerp(7.0, 5.8, follow));
        cLook.set(0, lerp(nivPos.y, -10, follow * 0.55), lerp(nivPos.z - 12, -110, follow));
        fov = lerp(64, 88, easeInQuad(follow));
      }
    }

    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.position.copy(cPos);
    camera.lookAt(cLook);

    if (a2t < 0.85) setFlashOverlay('#000', 1 - smooth(a2t / 0.85));
    else if (a2t >= 16.5) setFlashOverlay('#ff4218', smooth((a2t - 16.5) / 0.65));
    else setFlashOverlay('#000', 0);
  }

  /* ------------------------------------------------------------
     UPDATE ATO 3: DIRETO NO MAPA REAL ATUAL (a1)!
       - Queda livre com braços e pernas abertos tentando frear
       - Pouso estilo Homem de Ferro exatamente no spawn
       - Levanta, diz "Vamos ver do que esses demônios são feitos"
       - Saca o martelinho -> câmera encaixa na 1ª pessoa!
     ------------------------------------------------------------ */
  function updateAct3(dt, camera) {
    const a3t = t - ACT3_TIME;
    const LAND_T = 4.8;
    const ACT3_DUR = TOTAL_DUR - ACT3_TIME;

    for (let i = 0; i < skyPortalRings.length; i++) {
      skyPortalRings[i].mesh.rotation.z += skyPortalRings[i].spd * dt;
    }

    const falling = a3t < LAND_T;
    for (let i = 0; i < windStreaks.length; i++) {
      const ws = windStreaks[i];
      ws.mesh.visible = falling;
      if (falling) {
        ws.mesh.position.y += ws.spd * dt;
        if (ws.mesh.position.y > spawnY + 120) {
          ws.mesh.position.y = Math.max(spawnY, (nivaldo3 ? nivaldo3.root.position.y : spawnY + 40) - 30);
        }
      }
    }

    fireOnce('a3_fall_sfx', () => {
      if (window.SFX) { SFX.play('dash'); SFX.play('roar'); }
    });

    if (a3t >= LAND_T) {
      fireOnce('a3_land_impact', () => {
        if (window.SFX) { SFX.play('slam'); SFX.play('thunder'); }
        if (impactCrater) impactCrater.visible = true;
        if (impactRing) impactRing.visible = true;
        for (let i = 0; i < impactChunks.length; i++) {
          const c = impactChunks[i];
          c.mesh.visible = true;
          c.mesh.position.set(spawnX, spawnY + 0.25, spawnZ);
        }
      });
    }

    if (a3t >= LAND_T + 3.5) {
      fireOnce('a3_nivaldo_line', () => {
        if (callbacks.say) callbacks.say('"Vamos ver do que esses demônios são feitos."', 'NIVALDO', 4.2);
      });
    }

    if (a3t >= LAND_T + 4.9) {
      fireOnce('a3_draw_hammer', () => {
        if (nivaldo3 && nivaldo3.hammer) nivaldo3.hammer.visible = true;
        if (window.SFX) { SFX.play('weapon'); SFX.play('clang'); }
      });
    }

    // Onda de choque e estilhaços no ponto de spawn
    if (a3t >= LAND_T) {
      const lt = a3t - LAND_T;
      if (impactRing) {
        const u = clamp(lt / 1.15, 0, 1);
        impactRing.scale.setScalar(1 + easeOutCubic(u) * 14.0);
        impactRing.material.opacity = (1 - u) * 0.85;
      }
      for (let i = 0; i < impactChunks.length; i++) {
        const c = impactChunks[i];
        if (lt < 2.2) {
          const px = spawnX + c.vx * lt;
          const pz = spawnZ + c.vz * lt;
          const py = Math.max(spawnY + 0.1, spawnY + 0.25 + c.vy * lt - 9.8 * lt * lt);
          c.mesh.position.set(px, py, pz);
          if (py > spawnY + 0.12) {
            c.mesh.rotation.x += c.rx * dt;
            c.mesh.rotation.z += c.rz * dt;
          }
        }
      }
    }

    // --- ANIMAÇÃO DO NIVALDO NO ATO 3 ---
    let ny = spawnY;
    if (nivaldo3) {
      if (a3t < LAND_T) {
        // QUEDA LIVRE NO MAPA REAL (braços e pernas abertos tentando desacelerar a queda!)
        const u = clamp(a3t / LAND_T, 0, 1);
        ny = lerp(spawnY + 108, spawnY + 0.05, easeInQuad(u));
        nivaldo3.root.position.set(spawnX, ny, spawnZ);

        // Nos últimos 0.75s ele fecha a pose para o pouso estilo Homem de Ferro
        const prep = smooth((u - 0.82) / 0.18);
        const windWobble = Math.sin(t * 16) * 0.09 * (1 - prep);
        const windAlt = Math.cos(t * 19) * 0.08 * (1 - prep);

        // Corpo de barriga voltada para baixo tentando pegar resistência do ar!
        nivaldo3.torsoGroup.rotation.set(lerp(1.42 + windWobble * 0.4, 0.56, prep), lerp(windAlt * 0.5, -0.18, prep), windWobble * 0.5);
        nivaldo3.chestGroup.rotation.set(lerp(-0.18, 0.08, prep), 0, 0);
        nivaldo3.head.rotation.set(lerp(-0.62, 0.28, prep), 0, 0);

        // PERNAS BEM ABERTAS EM X + joelhos levemente dobrados freando no vento
        nivaldo3.legL.rotation.set(lerp(-0.22 + windWobble, 0.55, prep), 0, lerp(-0.46, 0, prep));
        nivaldo3.kneeL.rotation.set(lerp(0.62, 1.45, prep), 0, 0);
        nivaldo3.legR.rotation.set(lerp(-0.22 - windWobble, -1.25, prep), 0, lerp(0.46, 0, prep));
        nivaldo3.kneeR.rotation.set(lerp(0.62, 1.38, prep), 0, 0);

        // BRAÇOS BEM ABERTOS EM X tentando desacelerar a queda!
        nivaldo3.armL.rotation.set(lerp(-1.15 + windAlt, 0.72, prep), lerp(0, 0.25, prep), lerp(-1.22, 0.68, prep));
        nivaldo3.forearmL.rotation.set(lerp(-0.52, -0.35, prep), 0, lerp(-0.28, 0, prep));
        nivaldo3.armR.rotation.set(lerp(-1.15 - windAlt, -0.95, prep), 0, lerp(1.22, -0.18, prep));
        nivaldo3.forearmR.rotation.set(lerp(-0.52, -0.12, prep), 0, lerp(0.28, 0, prep));
      } else {
        // POUSO HOMEM DE FERRO -> LEVANTA -> SACA O MARTELINHO!
        const lt = a3t - LAND_T;
        const rise = smooth((lt - 2.6) / 1.65);
        const headUp = smooth((lt - 1.35) / 1.15);
        const drawH = smooth((lt - 4.9) / 0.85);
        const settleH = smooth((lt - 5.8) / 0.75);

        ny = lerp(spawnY - 0.56, spawnY + 0.02, rise);
        nivaldo3.root.position.set(spawnX, ny, spawnZ);

        nivaldo3.torsoGroup.rotation.set(lerp(0.56, 0.0, rise), lerp(-0.18, 0.0, rise), 0);
        nivaldo3.chestGroup.rotation.set(lerp(0.08, Math.sin(t * 2.2) * 0.02, rise), 0, 0);
        nivaldo3.head.rotation.set(lerp(0.36, -0.04, headUp), lerp(0.14, 0, headUp), 0);

        nivaldo3.legL.rotation.set(lerp(0.55, 0, rise), 0, 0);
        nivaldo3.kneeL.rotation.set(lerp(1.45, 0, rise), 0, 0);
        nivaldo3.legR.rotation.set(lerp(-1.25, 0, rise), 0, 0);
        nivaldo3.kneeR.rotation.set(lerp(1.38, 0, rise), 0, 0);

        nivaldo3.armR.rotation.set(lerp(-0.95, -0.10, rise), 0, lerp(-0.18, -0.14, rise));
        nivaldo3.forearmR.rotation.set(lerp(-0.12, -0.26, rise), 0, 0);

        let armLX = lerp(0.72, -0.10, rise);
        let armLY = lerp(0.25, 0, rise);
        let armLZ = lerp(0.68, 0.14, rise);
        let foreLX = lerp(-0.35, -0.22, rise);

        if (drawH > 0) {
          const swingUp = lerp(-0.10, -1.15, drawH);
          armLX = lerp(swingUp, -0.78, settleH);
          armLY = lerp(0, 0.22, drawH);
          armLZ = lerp(0.14, 0.28, drawH);
          foreLX = lerp(-0.22, -0.68, drawH);
        }
        nivaldo3.armL.rotation.set(armLX, armLY, armLZ);
        nivaldo3.forearmL.rotation.set(foreLX, 0, 0);

        if (hammerSpark) {
          const spAlpha = drawH * (1 - settleH);
          hammerSpark.material.opacity = spAlpha * 0.78;
          hammerSpark.scale.setScalar(0.6 + spAlpha * 1.1);
        }

        // Esconde o modelo 3P de Nivaldo no instante final em que a câmera encaixa nos olhos dele!
        nivaldo3.root.visible = (a3t < ACT3_DUR - 0.28);
      }
    }

    // --- CÂMERA DO ATO 3 (NO MAPA REAL a1!) ---
    // Nivaldo está virado para -Z, então a frente dele é z < spawnZ!
    const cPos = new V3();
    const cLook = new V3();
    let fov = 66;
    let shake = 0;

    if (a3t < 2.3) {
      // Queda livre parte 1: ângulo acima/lado mostrando Nivaldo com braços e pernas abertos e o mapa real a1 lá embaixo!
      const u = clamp(a3t / 2.3, 0, 1);
      cPos.set(spawnX + lerp(4.2, -3.2, u), ny + lerp(7.0, 4.2, u), spawnZ + lerp(-5.5, -4.8, u));
      cLook.set(spawnX, ny - 6.0, spawnZ - 6.0);
      fov = 76;
    } else if (a3t < LAND_T) {
      // Queda livre parte 2: ângulo baixo olhando para cima (portal no céu atrás dele) acompanhando até o impacto no spawn!
      const u = clamp((a3t - 2.3) / (LAND_T - 2.3), 0, 1);
      cPos.set(spawnX + lerp(-4.0, 4.4, u), Math.max(spawnY + 1.4, ny - lerp(6.0, 0.5, u)), spawnZ + lerp(-6.2, -5.2, u));
      cLook.set(spawnX, ny + 1.2, spawnZ);
      fov = lerp(74, 62, u);
    } else if (a3t < LAND_T + 2.7) {
      // POUSO HOMEM DE FERRO: arco baixo heroico à frente de Nivaldo (z < spawnZ)!
      const u = smooth((a3t - LAND_T) / 2.7);
      const ang = lerp(0.62, -0.32, u);
      const dist = lerp(5.2, 3.8, u);
      cPos.set(spawnX + Math.sin(ang) * dist, spawnY + lerp(1.15, 1.35, u), spawnZ - Math.cos(ang) * dist);
      cLook.set(spawnX, spawnY + 1.15, spawnZ);
      fov = lerp(58, 48, u);
      if (a3t - LAND_T < 0.75) shake = (1 - (a3t - LAND_T) / 0.75) * 0.42;
    } else if (a3t < ACT3_DUR - 1.35) {
      // Levanta, fala e saca o martelinho!
      const u = smooth((a3t - (LAND_T + 2.7)) / 5.4);
      cPos.set(spawnX + lerp(-1.25, 1.15, u), spawnY + lerp(1.45, 1.92, u), spawnZ - lerp(3.65, 3.25, u));
      cLook.set(spawnX + lerp(0, 0.16, smooth((a3t - (LAND_T + 4.8)) / 1.2)), spawnY + lerp(1.55, 1.85, u), spawnZ);
      fov = lerp(48, 46, u);
    } else {
      // TRANSIÇÃO CONTÍNUA DIRETO PARA A 1ª PESSOA NO SPAWN (sem tela preta)!
      const u = smooth((a3t - (ACT3_DUR - 1.35)) / 1.35);
      const fromPos = new V3(spawnX + 1.15, spawnY + 1.92, spawnZ - 3.25);
      const toPos = new V3(spawnX, spawnY + playerEye, spawnZ);
      const fromLook = new V3(spawnX + 0.16, spawnY + 1.85, spawnZ);
      const toLook = new V3(spawnX, spawnY + playerEye, spawnZ - 14);
      cPos.lerpVectors(fromPos, toPos, u);
      cLook.lerpVectors(fromLook, toLook, u);
      fov = lerp(46, savedCamFov || 75, u);
    }

    if (shake > 0) {
      cPos.x += Math.sin(t * 67) * shake;
      cPos.y += Math.cos(t * 79) * shake;
    }

    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.position.copy(cPos);
    camera.lookAt(cLook);

    // Flash breve apenas na saída do portal (início do Ato 3); no final entra direto sem fade preto!
    if (a3t < 0.55) {
      setFlashOverlay('#ff4218', 1 - smooth(a3t / 0.55));
    } else {
      setFlashOverlay('#000', 0);
    }
  }

  function update(dt, camera) {
    if (!active || !scene) return;
    t += dt;
    if (skipGrace > 0) skipGrace -= dt;

    if (t < ACT2_TIME) {
      setAct(1);
      updateAct1(dt, camera);
    } else if (t < ACT3_TIME) {
      setAct(2);
      updateAct2(dt, camera);
    } else {
      setAct(3);
      updateAct3(dt, camera);
    }

    if (t >= TOTAL_DUR) {
      stop(false);
    }
  }

  function render(renderer, camera) {
    if (!active || !renderer || !camera) return;
    if (curAct === 3 && worldScene) {
      if (callbacks && callbacks.renderWorld) {
        callbacks.renderWorld();
      } else {
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(worldScene, camera);
      }
      return;
    }
    if (!scene) return;
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(scene, camera);
  }

  window.IntroCutscene = {
    start,
    stop,
    skip,
    update,
    render,
    isActive: () => active
  };
})();
