'use strict';
/* ============================================================
   HELLSLAYER BETA 1 - núcleo do jogo
   ============================================================ */
(function () {
  const $ = (id) => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const V3 = THREE.Vector3;
  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  /* ---------------- renderer / cenas ---------------- */
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.autoClear = false;
  renderer.setPixelRatio(1);
  $('screen').appendChild(renderer.domElement);
  const INTERNAL_H = 270;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a0a08, 6, 95);
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.25, 520);
  camera.rotation.order = 'YXZ';
  const vmScene = new THREE.Scene();
  const vmCam = new THREE.PerspectiveCamera(62, 16 / 9, 0.05, 20);
  vmScene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const vmDir = new THREE.DirectionalLight(0xffb080, 0.6);
  vmDir.position.set(1, 2, 1); vmScene.add(vmDir);

  const amb = new THREE.AmbientLight(0x8a5a50, 1.15); scene.add(amb);
  const sun = new THREE.DirectionalLight(0xff6a40, 0.7); sun.position.set(-0.3, 1, 0.5); scene.add(sun);
  const plight = new THREE.PointLight(0xffc080, 0.85, 26, 1.2); scene.add(plight);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 12, 8),
    new THREE.MeshBasicMaterial({ map: TX.skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false })
  );
  scene.add(sky);

  buildWorld(scene);
  const VMS = buildViewmodels();
  for (const k in VMS) { VMS[k].root.visible = false; vmScene.add(VMS[k].root); }

  /* ---------------- Ambient Occlusion (SSAO) ---------------- */
  const hasDepthTex = renderer.capabilities.isWebGL2 || !!renderer.extensions.get('WEBGL_depth_texture');
  let sceneRT = null, aoRT = null, aoCam = null, aoScene = null, aoQuad = null, ssaoMat = null, aoCompMat = null;
  if (hasDepthTex) {
    const dType = renderer.capabilities.isWebGL2 ? THREE.UnsignedIntType : THREE.UnsignedShortType;
    const depthTex = new THREE.DepthTexture(480, INTERNAL_H, dType);
    sceneRT = new THREE.WebGLRenderTarget(480, INTERNAL_H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      depthTexture: depthTex
    });
    aoRT = new THREE.WebGLRenderTarget(480, INTERNAL_H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false
    });
    aoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    aoScene = new THREE.Scene();

    const fsVert = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    ssaoMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDepth: { value: depthTex },
        uInvProj: { value: new THREE.Matrix4() },
        uProj: { value: new THREE.Matrix4() },
        uTexel: { value: new THREE.Vector2(1 / 480, 1 / INTERNAL_H) },
        uRadius: { value: 0.95 },
        uBias: { value: 0.035 },
        uIntensity: { value: 1.35 }
      },
      vertexShader: fsVert,
      fragmentShader: `
        uniform sampler2D tDepth;
        uniform mat4 uInvProj;
        uniform mat4 uProj;
        uniform vec2 uTexel;
        uniform float uRadius;
        uniform float uBias;
        uniform float uIntensity;
        varying vec2 vUv;

        vec3 getViewPosFromDepth(vec2 uv, float d) {
          vec4 ndc = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          vec4 vp = uInvProj * ndc;
          return vp.xyz / vp.w;
        }

        vec3 getViewPos(vec2 uv) {
          return getViewPosFromDepth(uv, texture2D(tDepth, uv).x);
        }

        void main() {
          float dC = texture2D(tDepth, vUv).x;
          if (dC >= 0.9999) { gl_FragColor = vec4(1.0); return; }

          vec3 pC = getViewPosFromDepth(vUv, dC);
          vec3 pL = getViewPos(vUv - vec2(uTexel.x, 0.0));
          vec3 pR = getViewPos(vUv + vec2(uTexel.x, 0.0));
          vec3 pD = getViewPos(vUv - vec2(0.0, uTexel.y));
          vec3 pU = getViewPos(vUv + vec2(0.0, uTexel.y));

          vec3 dX = (abs(pR.z - pC.z) < abs(pC.z - pL.z)) ? (pR - pC) : (pC - pL);
          vec3 dY = (abs(pU.z - pC.z) < abs(pC.z - pD.z)) ? (pU - pC) : (pC - pD);
          vec3 N = normalize(cross(dX, dY));

          float ang = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
          vec3 rvec = vec3(cos(ang), sin(ang), 0.0);
          vec3 T = normalize(rvec - N * dot(rvec, N));
          vec3 B = cross(N, T);
          mat3 TBN = mat3(T, B, N);

          vec3 k0  = vec3( 0.04,  0.02, 0.16);
          vec3 k1  = vec3(-0.11,  0.07, 0.19);
          vec3 k2  = vec3( 0.09, -0.15, 0.22);
          vec3 k3  = vec3(-0.22, -0.09, 0.27);
          vec3 k4  = vec3( 0.28,  0.14, 0.24);
          vec3 k5  = vec3(-0.14,  0.34, 0.31);
          vec3 k6  = vec3( 0.19, -0.37, 0.28);
          vec3 k7  = vec3(-0.46,  0.11, 0.35);
          vec3 k8  = vec3( 0.49, -0.19, 0.42);
          vec3 k9  = vec3(-0.27, -0.53, 0.38);
          vec3 k10 = vec3( 0.33,  0.58, 0.44);
          vec3 k11 = vec3(-0.61, -0.31, 0.52);

          float occ = 0.0;
          vec3 ks[12];
          ks[0] = k0; ks[1] = k1; ks[2] = k2; ks[3] = k3;
          ks[4] = k4; ks[5] = k5; ks[6] = k6; ks[7] = k7;
          ks[8] = k8; ks[9] = k9; ks[10] = k10; ks[11] = k11;

          for (int i = 0; i < 12; i++) {
            vec3 samplePos = pC + (TBN * ks[i]) * uRadius;
            vec4 clip = uProj * vec4(samplePos, 1.0);
            vec2 suv = (clip.xy / clip.w) * 0.5 + 0.5;
            if (suv.x >= 0.0 && suv.x <= 1.0 && suv.y >= 0.0 && suv.y <= 1.0) {
              float sd = texture2D(tDepth, suv).x;
              if (sd < 0.9999) {
                vec3 sView = getViewPosFromDepth(suv, sd);
                float rangeCheck = smoothstep(0.0, 1.0, uRadius / max(0.001, abs(pC.z - sView.z)));
                occ += (sView.z >= samplePos.z + uBias ? 1.0 : 0.0) * rangeCheck;
              }
            }
          }

          float distFade = smoothstep(95.0, 28.0, -pC.z);
          float ao = clamp(1.0 - (occ / 12.0) * uIntensity * distFade, 0.28, 1.0);
          gl_FragColor = vec4(ao, ao, ao, 1.0);
        }
      `
    });

    aoCompMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: sceneRT.texture },
        tAO: { value: aoRT.texture },
        tDepth: { value: depthTex },
        uTexel: { value: new THREE.Vector2(1 / 480, 1 / INTERNAL_H) }
      },
      vertexShader: fsVert,
      fragmentShader: `
        uniform sampler2D tColor;
        uniform sampler2D tAO;
        uniform sampler2D tDepth;
        uniform vec2 uTexel;
        varying vec2 vUv;

        void main() {
          vec4 col = texture2D(tColor, vUv);
          float dC = texture2D(tDepth, vUv).x;
          if (dC >= 0.9999) { gl_FragColor = col; return; }

          float wSum = 1.0;
          float aoSum = texture2D(tAO, vUv).r;

          vec2 offs[4];
          offs[0] = vec2(-uTexel.x, 0.0);
          offs[1] = vec2( uTexel.x, 0.0);
          offs[2] = vec2(0.0, -uTexel.y);
          offs[3] = vec2(0.0,  uTexel.y);
          for (int i = 0; i < 4; i++) {
            vec2 suv = vUv + offs[i];
            float dN = texture2D(tDepth, suv).x;
            float w = exp(-abs(dC - dN) * 220.0);
            aoSum += texture2D(tAO, suv).r * w;
            wSum += w;
          }
          float ao = aoSum / wSum;
          gl_FragColor = vec4(col.rgb * ao, col.a);
        }
      `
    });

    aoQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ssaoMat);
    aoQuad.frustumCulled = false;
    aoScene.add(aoQuad);
  }

  function renderScene() {
    if (!hasDepthTex) {
      renderer.clear();
      renderer.render(scene, camera);
      return;
    }
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene, camera);

    ssaoMat.uniforms.uProj.value.copy(camera.projectionMatrix);
    ssaoMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
    aoQuad.material = ssaoMat;
    renderer.setRenderTarget(aoRT);
    renderer.clear();
    renderer.render(aoScene, aoCam);

    aoQuad.material = aoCompMat;
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(aoScene, aoCam);
  }

  function resize() {
    const W = window.innerWidth, H = window.innerHeight;
    const ih = INTERNAL_H, iw = Math.round(ih * W / H);
    renderer.setSize(iw, ih, false);
    camera.aspect = iw / ih; camera.updateProjectionMatrix();
    vmCam.aspect = iw / ih; vmCam.updateProjectionMatrix();
    PSX_RES.value.set(iw, ih);
    if (hasDepthTex) {
      sceneRT.setSize(iw, ih);
      aoRT.setSize(iw, ih);
      ssaoMat.uniforms.uTexel.value.set(1 / iw, 1 / ih);
      aoCompMat.uniforms.uTexel.value.set(1 / iw, 1 / ih);
    }
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------------- estado ---------------- */
  const P = {
    pos: new V3(0, 0, 6), vel: new V3(), yaw: 0, pitch: 0, r: 0.7, eye: 2.45,
    hp: 200, maxhp: 200, faith: 0, faithMode: 0, onGround: true,
    dashT: 0, dashCd: 0, dashDir: new V3(), bob: 0, lastStep: 0, shake: 0, hurtFlash: 0,
    dead: false, god: false, rocks: 0, blood: 0, hand: 0,
    swingT: 0, swingDur: 0.3, swapT: 0, pending: null, locked: false, fovKick: 0
  };
  const S = {
    started: false, paused: true, time: 0, kills: 0, style: 0, ended: false,
    checkpoint: { x: 0, z: 6, yaw: 0 }, stage: 'a1', objRoom: null, objText: '',
    boss: null, quipCd: 0, cross: { state: 'held', pos: new V3(), dir: new V3(), t: 0, hitT: new Map() },
    env: 'hell', msgT: 0, baphT: 0, promptOn: false, cutscene: 0, rip: false, faithReady: false
  };
  const keys = {};
  let mouseL = false;

  const WEAPONS = [
    { id: 'fists',  vm: 'fists',  name: 'PUNHOS',               short: 'PUNHOS',  owned: true,  melee: true, range: 3.6, dmg: 16, cd: 0.30, cos: 0.5,  knock: 6, dur: 0.22, hitAt: 0.08, sfx: 'punch' },
    { id: 'hammer', vm: 'hammer', name: 'MARTELO DE OBRAS',     short: 'MARTELO', owned: true,  melee: true, range: 4.2, dmg: 36, cd: 0.62, cos: 0.45, knock: 9, dur: 0.42, hitAt: 0.18, sfx: 'hammer' },
    { id: 'sling',  vm: 'sling',  name: 'FUNDA',                short: 'FUNDA',   owned: false, ammo: 'rocks', cd: 0.48, dmg: 24, dur: 0.25 },
    { id: 'scythe', vm: 'scythe', name: 'FOICE',                short: 'FOICE',   owned: false, melee: true, range: 6.0, dmg: 30, cd: 0.72, cos: -0.25, knock: 6, dur: 0.5, hitAt: 0.2, sfx: 'scythe', sweep: true },
    { id: 'demo',   vm: 'demo',   name: 'MARTELO DE DEMOLIÇÃO', short: 'DEMOL.',  owned: false, cd: 1.5, dmg: 120, dur: 0.85, hitAt: 0.42, aoe: 6.5 },
    { id: 'cross',  vm: 'cross',  name: 'SACRA CRUZ PAPAL',     short: 'CRUZ',    owned: false, cd: 0.25, dmg: 34, dur: 0.3 },
    { id: 'heart',  vm: 'heart',  name: 'CORAÇÃO ATEU',         short: 'CORAÇÃO', owned: false, ammo: 'blood', cd: 0.15, dmg: 13, dur: 0.12 }
  ];
  let curW = 0;
  const wcd = {}; // cooldown por arma
  WEAPONS.forEach(w => wcd[w.id] = 0);
  const AMMO_MAX = { rocks: 80, blood: 100 };

  /* ---------------- colisão + plataformas (altura Y) ---------------- */
  function groundAt(x, z, y, r) {
    const pit = World.altar && World.altar.pit;
    let gy = (World.altar && World.altar.open && pit && x > pit.x1 && x < pit.x2 && z > pit.z1 && z < pit.z2) ? -3.5 : getGroundY(x, z);
    const cs = World.colliders;
    const rad = (r || 0.7) * 0.85;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c.active || !c.walkable || c.yMax == null) continue;
      if (x + rad > c.x1 && x - rad < c.x2 && z + rad > c.z1 && z - rad < c.z2) {
        if (y >= c.yMax - 0.45 && c.yMax > gy) gy = c.yMax;
      }
    }
    return gy;
  }
  function resolveCircle(pos, r, y) {
    const py = y != null ? y : (pos.y || 0);
    for (let it = 0; it < 2; it++) {
      const cs = World.colliders;
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        if (!c.active) continue;
        if (c.walkable && c.yMax != null && py >= c.yMax - 0.35) continue;
        if (pos.x < c.x1 - r || pos.x > c.x2 + r || pos.z < c.z1 - r || pos.z > c.z2 + r) continue;
        const cx = clamp(pos.x, c.x1, c.x2), cz = clamp(pos.z, c.z1, c.z2);
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2), push = r - d;
            pos.x += dx / d * push; pos.z += dz / d * push;
          } else {
            const l = pos.x - c.x1, rr = c.x2 - pos.x, t = pos.z - c.z1, b = c.z2 - pos.z;
            const m = Math.min(l, rr, t, b);
            if (m === l) pos.x = c.x1 - r; else if (m === rr) pos.x = c.x2 + r;
            else if (m === t) pos.z = c.z1 - r; else pos.z = c.z2 + r;
          }
        }
      }
    }
  }
  function pointInWall(x, z) {
    const cs = World.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.active && x > c.x1 && x < c.x2 && z > c.z1 && z < c.z2) return true;
    }
    return false;
  }
  function segHitsBox(ax, az, bx, bz, c) {
    const dx = bx - ax, dz = bz - az;
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-8) { if (ax < c.x1 || ax > c.x2) return false; }
    else {
      let a = (c.x1 - ax) / dx, b = (c.x2 - ax) / dx;
      if (a > b) { const t = a; a = b; b = t; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
    if (Math.abs(dz) < 1e-8) { if (az < c.z1 || az > c.z2) return false; }
    else {
      let a = (c.z1 - az) / dz, b = (c.z2 - az) / dz;
      if (a > b) { const t = a; a = b; b = t; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
    return true;
  }
  function los(ax, az, bx, bz) {
    const cs = World.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.active && segHitsBox(ax, az, bx, bz, c)) return false;
    }
    return true;
  }

  /* ---------------- partículas / gore ---------------- */
  const parts = [], gibs = [], decals = [];
  const PGEO = new THREE.BoxGeometry(1, 1, 1);
  const MAXP = 680;
  let goreDuration = 20;
  function setGoreDuration(sec) {
    const n = Number(sec);
    goreDuration = (!Number.isFinite(n) || n >= 61 || n <= 0) ? Infinity : Math.max(1, n);
  }
  let decalLayer = 0;
  const BLOOD_COLS = [0xd80818, 0xa80610, 0x7a040a, 0x520206];
  const GIB_COLS = [0x820c14, 0x5c060c, 0x420408, 0xd8ccb8];

  function spawnBloodDecal(x, z, size) {
    const maxD = goreDuration === Infinity ? 1200 : 320;
    while (decals.length >= maxD) { const o = decals.shift(); scene.remove(o.m); }
    const col = BLOOD_COLS[(Math.random() * 3) | 0];
    const m = new THREE.Mesh(PGEO, MT(col, { basic: false }));
    const sx = size * rnd(0.8, 1.35), sz = size * rnd(0.8, 1.35);
    m.scale.set(sx, 0.016, sz);
    m.rotation.y = rnd(0, Math.PI * 2);
    decalLayer = (decalLayer + 1) % 12;
    m.position.set(x, getGroundY(x, z) + 0.03 + decalLayer * 0.0015, z);
    scene.add(m);
    decals.push({ m, age: 0, sx, sz });
  }

  function burst(x, y, z, color, n, spd, life, size, grav, basic) {
    for (let i = 0; i < n; i++) {
      if (parts.length >= MAXP) { const o = parts.shift(); scene.remove(o.m); }
      const m = new THREE.Mesh(PGEO, MT(color, { basic: basic !== false }));
      m.scale.setScalar(size * rnd(0.5, 1.3));
      m.position.set(x, y, z);
      scene.add(m);
      parts.push({ m, v: new V3(rnd(-1, 1) * spd, rnd(-0.1, 1.1) * spd, rnd(-1, 1) * spd), life: life * rnd(0.6, 1.2), g: grav == null ? 18 : grav });
    }
  }

  function bloodSpurt(x, y, z, dx, dz, power, n, upBoost) {
    let lx = dx || 0, lz = dz || 0;
    const len = Math.hypot(lx, lz);
    if (len > 0.001) { lx /= len; lz /= len; }
    else { const a = rnd(0, Math.PI * 2); lx = Math.cos(a); lz = Math.sin(a); }
    for (let i = 0; i < n; i++) {
      if (parts.length >= MAXP) { const o = parts.shift(); scene.remove(o.m); }
      const col = BLOOD_COLS[(Math.random() * BLOOD_COLS.length) | 0];
      const sz = rnd(0.08, 0.19);
      const m = new THREE.Mesh(PGEO, MT(col, { basic: false }));
      m.scale.set(sz, sz, sz * 1.8);
      m.position.set(x + rnd(-0.12, 0.12), y + rnd(-0.12, 0.12), z + rnd(-0.12, 0.12));
      scene.add(m);
      const sp = power * rnd(0.45, 1.35);
      const spread = 0.55;
      const vx = (lx + rnd(-spread, spread)) * sp;
      const vz = (lz + rnd(-spread, spread)) * sp;
      const vy = rnd(0.15, 1.0) * sp * 0.65 + (upBoost || 2.5);
      parts.push({ m, type: 'blood', sz, v: new V3(vx, vy, vz), life: rnd(0.6, 1.3), g: 24 });
    }
  }

  function spawnGore(x, y, z, h, kx, kz, isBig) {
    const scale = isBig ? 1.5 : 1;
    // Poça principal e respingos imediatos no chão
    spawnBloodDecal(x, z, 1.25 * scale);
    for (let i = 0; i < (isBig ? 6 : 3); i++) {
      spawnBloodDecal(x + rnd(-1.4, 1.4) * scale, z + rnd(-1.4, 1.4) * scale, rnd(0.45, 1.05) * scale);
    }
    // Jato arterial direcional na direção do golpe + fonte para cima
    bloodSpurt(x, y + h * 0.55, z, kx, kz, isBig ? 14 : 11, isBig ? 42 : 24, 5.5);
    bloodSpurt(x, y + h * 0.65, z, -kx * 0.4, -kz * 0.4, isBig ? 10 : 7, isBig ? 22 : 12, 7.0);

    // Pedaços físicos de carne, órgãos e ossos girando no ar
    const gibN = isBig ? 24 : 10;
    const maxG = goreDuration === Infinity ? 1000 : 400;
    for (let i = 0; i < gibN; i++) {
      while (gibs.length >= maxG) { const o = gibs.shift(); scene.remove(o.m); }
      const isBone = i % 5 === 4;
      const col = isBone ? GIB_COLS[3] : GIB_COLS[(Math.random() * 3) | 0];
      const m = new THREE.Mesh(PGEO, MT(col, { basic: false }));
      const sx = (isBone ? rnd(0.1, 0.16) : rnd(0.18, 0.36)) * scale;
      const sy = (isBone ? rnd(0.1, 0.16) : rnd(0.14, 0.30)) * scale;
      const sz = (isBone ? rnd(0.32, 0.55) : rnd(0.18, 0.38)) * scale;
      m.scale.set(sx, sy, sz);
      m.position.set(x + rnd(-0.25, 0.25), y + h * rnd(0.35, 0.8), z + rnd(-0.25, 0.25));
      scene.add(m);
      const sp = rnd(5, 13) * (isBig ? 1.2 : 1);
      const a = rnd(0, Math.PI * 2);
      const vx = Math.cos(a) * sp * 0.75 + (kx || 0) * rnd(3, 7);
      const vz = Math.sin(a) * sp * 0.75 + (kz || 0) * rnd(3, 7);
      const vy = rnd(3.5, 9.5) * (isBig ? 1.15 : 1);
      gibs.push({
        m, sz: Math.max(sx, sz), sx, sy, sz0: sz,
        v: new V3(vx, vy, vz),
        rv: new V3(rnd(-14, 14), rnd(-14, 14), rnd(-14, 14)),
        age: 0, g: 24, dripT: 0, bounces: 0
      });
    }
  }

  const _tmpV = new V3();
  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      p.v.y -= p.g * dt;
      if (p.type === 'blood') {
        p.v.multiplyScalar(1 - Math.min(0.4, dt * 0.9));
        p.m.position.addScaledVector(p.v, dt);
        const spd = p.v.length();
        if (spd > 0.5) {
          _tmpV.copy(p.m.position).add(p.v);
          p.m.lookAt(_tmpV);
          p.m.scale.set(p.sz, p.sz, Math.min(0.95, Math.max(p.sz, spd * 0.045)));
        }
        if (p.m.position.y <= getGroundY(p.m.position.x, p.m.position.z) + 0.04) {
          spawnBloodDecal(p.m.position.x, p.m.position.z, p.sz * rnd(2.0, 3.6));
          scene.remove(p.m); parts.splice(i, 1); continue;
        }
      } else {
        p.m.position.addScaledVector(p.v, dt);
        const gy = getGroundY(p.m.position.x, p.m.position.z);
        if (p.m.position.y < gy + 0.05) { p.m.position.y = gy + 0.05; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; }
      }
      if (p.life <= 0) { scene.remove(p.m); parts.splice(i, 1); }
    }
    const dur = goreDuration;
    const fadeWindow = dur === Infinity ? 0 : Math.min(1.5, dur * 0.3);
    for (let i = gibs.length - 1; i >= 0; i--) {
      const p = gibs[i];
      p.age += dt;
      const gy = getGroundY(p.m.position.x, p.m.position.z);
      if (p.m.position.y > gy + 0.07 || p.v.y > 0 || p.v.x * p.v.x + p.v.z * p.v.z > 0.01) {
        p.v.y -= p.g * dt;
        p.m.position.addScaledVector(p.v, dt);
        p.m.rotation.x += p.rv.x * dt;
        p.m.rotation.y += p.rv.y * dt;
        p.m.rotation.z += p.rv.z * dt;
        p.dripT -= dt;
        if (p.dripT <= 0 && p.v.lengthSq() > 14) {
          p.dripT = 0.045;
          if (parts.length < MAXP) {
            const dm = new THREE.Mesh(PGEO, MT(BLOOD_COLS[1], { basic: false }));
            const dsz = rnd(0.06, 0.11);
            dm.scale.setScalar(dsz);
            dm.position.copy(p.m.position);
            scene.add(dm);
            parts.push({ m: dm, type: 'blood', sz: dsz, v: new V3(p.v.x * 0.25 + rnd(-1, 1), p.v.y * 0.2, p.v.z * 0.25 + rnd(-1, 1)), life: 0.7, g: 24 });
          }
        }
        const gy2 = getGroundY(p.m.position.x, p.m.position.z);
        if (p.m.position.y < gy2 + 0.07) {
          p.m.position.y = gy2 + 0.07;
          if (p.v.y < -2.2) {
            spawnBloodDecal(p.m.position.x, p.m.position.z, p.sz * rnd(1.3, 2.2));
            p.bounces++;
            if (p.bounces <= 2) bloodSpurt(p.m.position.x, gy2 + 0.12, p.m.position.z, p.v.x, p.v.z, 3.5, 3, 1.5);
          }
          p.v.y *= -0.4; p.v.x *= 0.65; p.v.z *= 0.65;
          p.rv.multiplyScalar(0.55);
          if (Math.abs(p.v.y) < 0.4) p.v.y = 0;
        }
      }
      if (dur !== Infinity) {
        const rem = dur - p.age;
        if (rem <= 0) { scene.remove(p.m); gibs.splice(i, 1); continue; }
        if (rem < fadeWindow) {
          const k = Math.max(0.01, rem / fadeWindow);
          p.m.scale.set(p.sx * k, p.sy * k, p.sz0 * k);
        } else {
          p.m.scale.set(p.sx, p.sy, p.sz0);
        }
      } else {
        p.m.scale.set(p.sx, p.sy, p.sz0);
      }
    }
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i];
      d.age += dt;
      if (dur !== Infinity) {
        const rem = dur - d.age;
        if (rem <= 0) { scene.remove(d.m); decals.splice(i, 1); continue; }
        if (rem < fadeWindow) {
          const k = Math.max(0.01, rem / fadeWindow);
          d.m.scale.set(d.sx * k, 0.016, d.sz * k);
        } else {
          d.m.scale.set(d.sx, 0.016, d.sz);
        }
      } else {
        d.m.scale.set(d.sx, 0.016, d.sz);
      }
    }
  }
  function clearParts() {
    parts.forEach(p => scene.remove(p.m)); parts.length = 0;
    gibs.forEach(p => scene.remove(p.m)); gibs.length = 0;
    decals.forEach(d => scene.remove(d.m)); decals.length = 0;
  }

  /* ---------------- anéis de choque ---------------- */
  const rings = [];
  function spawnRing(x, z, maxR, speed, dmg, color, owner) {
    const gy = getGroundY(x, z);
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 28), MT(color || 0xff5020, { basic: true, tr: 0.7, add: true, dbl: true }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, gy + 0.2, z);
    scene.add(m);
    rings.push({ x, z, y: gy, r: 1, max: maxR, speed, dmg, m, hit: false, owner });
  }
  function updateRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const q = rings[i];
      q.r += q.speed * dt;
      q.m.scale.setScalar(q.r);
      if (q.owner === 'e' && !q.hit && !P.dead) {
        const d = Math.hypot(P.pos.x - q.x, P.pos.z - q.z);
        if (Math.abs(d - q.r) < 1.6 && P.pos.y < q.y + 1.2) { q.hit = true; hurtPlayer(q.dmg, q.x, q.z, 14); }
      }
      if (q.r >= q.max) { scene.remove(q.m); q.m.geometry.dispose(); rings.splice(i, 1); }
    }
  }

  /* ---------------- projéteis ---------------- */
  const projs = [];
  function spawnProj(kind, pos, vel, dmg, owner, r, life, grav) {
    let m;
    if (kind === 'rock') m = new THREE.Mesh(BX(0.28, 0.28, 0.28), MT(0x9a9aa0));
    else if (kind === 'boulder') m = new THREE.Mesh(BX(0.46, 0.46, 0.46), MT(0xc4b078));
    else if (kind === 'brick') m = new THREE.Mesh(BX(0.32, 0.2, 0.48), MT(0xb84a28));
    else if (kind === 'blood') m = new THREE.Mesh(BX(0.26, 0.26, 0.5), MT(0xff1a2a, { basic: true }));
    else if (kind === 'fire') m = new THREE.Mesh(BX(0.4, 0.4, 0.4), MT(0xff7a10, { basic: true }));
    else m = new THREE.Mesh(BX(0.5, 0.5, 0.5), MT(0xcc44ff, { basic: true }));
    m.position.copy(pos);
    if (kind === 'blood' || kind === 'brick') m.lookAt(pos.clone().add(vel));
    scene.add(m);
    projs.push({ kind, m, v: vel.clone(), dmg, owner, r: r || 0.3, life: life || 3, g: grav || 0, parried: false });
  }
  function killProj(i, fx) {
    const p = projs[i];
    if (fx) burst(p.m.position.x, p.m.position.y, p.m.position.z, p.kind === 'blood' ? 0xc01020 : p.kind === 'brick' ? 0xb84a28 : (p.kind === 'rock' || p.kind === 'boulder') ? 0x9a9aa0 : p.kind === 'fire' ? 0xff7a10 : 0xcc44ff, p.parried ? 10 : 5, p.parried ? 8 : 5, 0.4, 0.15, 12);
    scene.remove(p.m);
    projs.splice(i, 1);
  }
  function updateProjs(dt) {
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i];
      p.life -= dt;
      if (p.life <= 0) { killProj(i, false); continue; }
      const sp = p.v.length() * dt;
      const steps = Math.max(1, Math.ceil(sp / 0.45));
      const sdt = dt / steps;
      let dead = false;
      for (let s = 0; s < steps && !dead; s++) {
        p.v.y -= p.g * sdt;
        p.m.position.addScaledVector(p.v, sdt);
        const pp = p.m.position;
        if (p.kind === 'hex' || p.kind === 'fire' || p.kind === 'brick' || p.kind === 'boulder') { p.m.rotation.x += dt * 6; p.m.rotation.y += dt * 7; }
        const gy = getGroundY(pp.x, pp.z);
        if (pp.y < gy + 0.1 || pp.y > gy + 45 || pointInWall(pp.x, pp.z)) { killProj(i, true); dead = true; break; }
        if (p.owner === 'e') {
          if (!P.dead && pp.distanceTo(new V3(P.pos.x, P.pos.y + 1.2, P.pos.z)) < p.r + 0.8) {
            hurtPlayer(p.dmg, pp.x - p.v.x, pp.z - p.v.z, 4);
            killProj(i, true); dead = true; break;
          }
        } else {
          for (const e of enemies) {
            if (e.dead || e.downed) continue;
            const ep = e.g.position;
            if (pp.y < ep.y - 0.2 || pp.y > ep.y + e.h + 0.3) continue;
            if (Math.hypot(pp.x - ep.x, pp.z - ep.z) < e.r + p.r) {
              const l = Math.hypot(p.v.x, p.v.z) || 1;
              const knock = p.parried ? 10 : (p.kind === 'boulder' || p.kind === 'brick') ? 8 : (p.kind === 'rock' ? 4 : 1.5);
              dmgEnemy(e, p.dmg, p.v.x / l, p.v.z / l, { knock, stunBonus: (p.kind === 'boulder' || p.parried) ? 0.55 : 0 });
              killProj(i, true); dead = true; break;
            }
          }
        }
      }
    }
  }
  function clearProjs() { for (let i = projs.length - 1; i >= 0; i--) killProj(i, false); rings.forEach(q => { scene.remove(q.m); }); rings.length = 0; }

  /* ---------------- inimigos ---------------- */
  const FLASH = MT(0xffffff, { basic: true });
  const ETYPES = {
    campones: { model: 'campones', hp: 45, speed: 3.4, r: 0.6, melee: { range: 1.9, dmg: 9, cd: 1.3, wind: 0.45 }, pts: 10, faith: 4, blood: 6, armsFwd: true, name: 'Camponês Endemoniado' },
    guarda:   { model: 'guarda', hp: 120, speed: 4.2, r: 0.75, melee: { range: 2.6, dmg: 16, cd: 1.5, wind: 0.5 }, pts: 25, faith: 8, blood: 10, name: 'Guarda Endemoniado' },
    diabrete: { model: 'diabrete', hp: 28, speed: 5, r: 0.5, flying: true, hover: 3, ranged: { proj: 'fire', dmg: 7, cd: 2.2, speed: 17, range: 38 }, pts: 10, faith: 4, blood: 5 },
    gargula:  { model: 'gargula', hp: 85, speed: 9, r: 0.7, flying: true, hover: 4, melee: { range: 2.6, dmg: 13, cd: 1.6, wind: 0.3 }, pts: 20, faith: 7, blood: 9, armsFwd: true },
    demonio:  { model: 'demonio', hp: 320, speed: 3.8, r: 1.3, melee: { range: 3.4, dmg: 28, cd: 1.8, wind: 0.6 }, charge: { cd: 7, speed: 17, dur: 0.9, dmg: 30, wind: 0.7 }, pts: 50, faith: 18, blood: 20, mass: 2.5 },
    padre:    { model: 'padre', hp: 80, speed: 3, r: 0.7, ranged: { proj: 'hex', dmg: 14, cd: 2.8, speed: 11, range: 45 }, keep: 13, pts: 25, faith: 8, blood: 10 },
    maximus:  { model: 'maximus', boss: true, name: 'MAXIMUS · LÍDER DA SUPER-GUARDA REAL', hp: 1100, speed: 4.6, r: 1.7, aggro: 90,
                melee: { range: 5.0, dmg: 32, cd: 1.7, wind: 0.6 }, charge: { cd: 6, speed: 24, dur: 0.8, dmg: 40, wind: 0.8 }, pts: 300, faith: 60, blood: 60, mass: 6 },
    galius1:  { model: 'galius', boss: true, name: 'GALIUS · O SUPER-ATEU', hp: 4000, speed: 5.2, r: 3.2, aggro: 120, immortal: true, dmgScale: 0.03,
                melee: { range: 7.5, dmg: 36, cd: 2.3, wind: 0.8 }, stomp: { cd: 6, dmg: 26 }, pts: 0, faith: 0, blood: 0, mass: 20 },
    galius2:  { model: 'galius', boss: true, name: 'GALIUS · O SUPER-ATEU', hp: 2400, speed: 5.4, r: 3.2, aggro: 120, galius2: true,
                melee: { range: 7.5, dmg: 40, cd: 2.0, wind: 0.75 }, charge: { cd: 8, speed: 22, dur: 0.9, dmg: 45, wind: 0.9 }, stomp: { cd: 5, dmg: 30 }, pts: 0, faith: 0, blood: 0, mass: 20 }
  };
  const enemies = [];

  function spawnEnemy(type, x, z, room, y) {
    const T = ETYPES[type];
    const rig = BUILD[T.model]();
    const g = rig.root;
    const gy = getGroundY(x, z);
    g.position.set(x, T.flying ? gy + (y || T.hover) : gy, z);
    g.rotation.y = rnd(0, 6.28);
    scene.add(g);
    const e = {
      type, T, rig, g, hp: T.hp, maxhp: T.hp, r: T.r, h: rig.h, room, aggro: false, cd: rnd(0.4, 1.6),
      state: 'move', st: 0, kv: new V3(), cdir: new V3(), stun: 0, flash: 0, flashing: false, anim: rnd(0, 6),
      dead: false, downed: false, kneel: false, recover: 0, chargeCd: rnd(2, 5), stompCd: rnd(3, 5), yaw: g.rotation.y,
      strafe: Math.random() < 0.5 ? 1 : -1, hit: false, ranged: false, enrage: false, moved: false
    };
    g.traverse(o => { if (o.isMesh) o.userData.om = o.material; });
    enemies.push(e);
    return e;
  }
  function setFlash(e, on) {
    e.flashing = on;
    e.g.traverse(o => { if (o.isMesh) o.material = on ? FLASH : o.userData.om; });
  }
  function removeEnemy(e) {
    scene.remove(e.g);
    const i = enemies.indexOf(e);
    if (i >= 0) enemies.splice(i, 1);
  }
  function clearRoomEnemies(room) {
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].room === room) removeEnemy(enemies[i]);
  }
  function aliveInRoom(room) {
    let n = 0;
    for (const e of enemies) if (e.room === room && !e.dead) n++;
    return n;
  }

  function hurtPlayer(dmg, sx, sz, kb) {
    if (P.dead || P.god || S.cutscene > 0) return;
    if (P.dashT > 0 || P.invuln > 0) return;
    const amt = dmg * (P.faithMode > 0 ? 0.5 : 1);
    P.hp -= amt;
    P.hurtFlash = Math.min(1, 0.45 + amt / 40);
    P.shake = Math.max(P.shake, 0.25 + amt / 80);
    const dx = P.pos.x - sx, dz = P.pos.z - sz, l = Math.hypot(dx, dz) || 1;
    P.vel.x += dx / l * (kb || 5); P.vel.z += dz / l * (kb || 5);
    SFX.play('hurt');
    S.style = Math.max(0, S.style - 25);
    if (P.hp <= 0) { P.hp = 0; die(); }
  }

  function dmgEnemy(e, amt, kx, kz, o) {
    if (e.dead || e.downed) return false;
    o = o || {};
    const T = e.T;
    const c = e.g.position;
    if (T.immortal) {
      e.aggro = true;
      e.flash = 0.05;
      SFX.play('clang');
      burst(c.x, c.y + e.h * 0.55, c.z, 0xd8e0ff, 6, 7, 0.35, 0.14, 10);
      burst(c.x, c.y + e.h * 0.55, c.z, 0xffd24a, 4, 6, 0.3, 0.12, 10);
      if (S.msgT <= 0.2) say('IMUNE A ARMAS COMUNS! Desça pela ESCADARIA NO ALTAR!', 'AVISO', 3.0);
      return false;
    }
    let a = amt * (P.faithMode > 0 ? 2 : 1) * (T.dmgScale || 1);
    e.hp -= a;
    e.aggro = true;
    e.flash = 0.08;
    const k = (o.knock || 0) / (T.mass || 1);
    e.kv.x += kx * k * 3; e.kv.z += kz * k * 3;
    if (!T.boss && amt > 14) e.stun = Math.max(e.stun, (0.16 + (o.stunBonus || 0)) / (T.mass ? T.mass * 0.5 : 1));
    else if (o.stunBonus) e.stun = Math.max(e.stun, o.stunBonus * 0.5);
    S.hitMark = 0.12;
    SFX.play('hit', o.hitSfx || 'general');
    const spurtN = Math.min(22, 6 + ((a / 8) | 0));
    bloodSpurt(c.x, c.y + e.h * 0.6, c.z, kx, kz, Math.min(13, 6 + a * 0.12), spurtN, 2.2);
    if (T.galius2) {
      if (!e.kneel && e.hp <= e.maxhp * 0.4) {
        e.kneel = true; e.state = 'move'; e.stun = 1.2;
        S.shakeBig = 1; SFX.play('shock');
        say('Os joelhos de Galius se despedaçam! Acabe com ele!', 'NIVALDO', 3.5);
      }
      if (e.hp <= 0) {
        e.hp = 0; e.downed = true; e.state = 'move';
        SFX.play('roar'); S.shakeBig = 1.2;
        say('Galius caiu! Arranque o Coração Ateu!', 'NIVALDO', 4);
      }
      return true;
    }
    if (e.hp <= 0 && !T.immortal) killEnemy(e, kx, kz);
    return true;
  }

  const SCREAM_PITCH = {
    diabrete: 1.45, gargula: 1.2, campones: 1.05, padre: 0.95,
    guarda: 0.78, demonio: 0.55, maximus: 0.42, galius: 0.42
  };
  function killEnemy(e, kx, kz) {
    if (e.dead) return;
    e.dead = true;
    const c = e.g.position, T = e.T;
    const isBig = !!(T.boss || T.hp >= 200);
    const pitch = SCREAM_PITCH[T.model] || (isBig ? 0.5 : 1.0);
    SFX.play(isBig ? 'gib' : 'kill', pitch);
    spawnGore(c.x, c.y, c.z, e.h, kx || 0, kz || 0, isBig);
    burst(c.x, c.y + e.h * 0.7, c.z, 0xffcc40, 3, 6, 0.5, 0.15, 10);
    S.kills++;
    S.levelKills = (S.levelKills || 0) + 1;
    S.style = Math.min(420, S.style + T.pts * 0.7 + 8);
    if (P.faithMode <= 0) addFaith(T.faith);
    if (WEAPONS[6].owned) P.blood = Math.min(AMMO_MAX.blood, P.blood + T.blood);
    quip();
    // drops
    const r = Math.random();
    if (!T.boss) {
      if (r < 0.22) spawnPickup('host', c.x, c.z);
      else if (r < 0.46) spawnPickup('rocks', c.x, c.z);
      else if (r < 0.62 && WEAPONS[6].owned) spawnPickup('vial', c.x, c.z);
    }
    removeEnemy(e);
  }

  function addFaith(n) {
    if (P.faith >= 100) return;
    P.faith = Math.min(100, P.faith + n);
    if (P.faith >= 100 && !S.faithReady) { S.faithReady = true; say('SUPER-FÉ PRONTA! Pressione [Q]', '', 3); SFX.play('pickup'); }
  }

  function doEnemyAttack(e, dist) {
    const T = e.T;
    if (e.ranged) {
      const R = T.ranged;
      const o = new V3(e.g.position.x, e.g.position.y + e.h * 0.7, e.g.position.z);
      const tgt = new V3(P.pos.x, P.pos.y + 1.3, P.pos.z);
      const dir = tgt.sub(o).normalize();
      spawnProj(R.proj, o, dir.multiplyScalar(R.speed), R.dmg, 'e', R.proj === 'hex' ? 0.5 : 0.35, 5, 0);
      SFX.play(R.proj === 'hex' ? 'hex' : 'fire');
      e.cd = R.cd * rnd(0.8, 1.3);
      e.ranged = false;
    } else {
      const M = T.melee;
      SFX.play('swing');
      if (dist <= M.range + e.r + 1.3) hurtPlayer(M.dmg, e.g.position.x, e.g.position.z, T.boss ? 12 : 6);
      e.cd = M.cd * rnd(0.85, 1.2);
    }
    e.recover = 0.35;
  }

  function updateEnemy(e, dt) {
    const T = e.T, g = e.g, pos = g.position;
    e.anim += dt;
    if (e.flash > 0) { e.flash -= dt; if (!e.flashing) setFlash(e, true); }
    else if (e.flashing) setFlash(e, false);
    if (e.recover > 0) e.recover -= dt;

    let dx = P.pos.x - pos.x, dz = P.pos.z - pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    if (!e.aggro) {
      if (dist < (T.aggro || 40) && !P.dead) {
        e.aggro = true;
        if (T.boss) SFX.play('roar');
      } else { animEnemy(e, dt, false); return; }
    }
    if (P.dead) { animEnemy(e, dt, false); return; }

    if (e.kv.lengthSq() > 0.01) {
      pos.x += e.kv.x * dt; pos.z += e.kv.z * dt;
      e.kv.multiplyScalar(Math.max(0, 1 - dt * 5));
      resolveCircle(pos, e.r);
    }
    if (e.downed) {
      pos.y += (-2.3 - pos.y) * Math.min(1, dt * 3);
      animEnemy(e, dt, false);
      return;
    }
    if (e.kneel) pos.y += (-1.6 - pos.y) * Math.min(1, dt * 3);
    if (e.stun > 0) { e.stun -= dt; animEnemy(e, dt, false); return; }

    e.cd -= dt; e.chargeCd -= dt; e.stompCd -= dt;
    const nx = dx / dist, nz = dz / dist;
    if (e.state !== 'charge') e.yaw = lerpAngle(e.yaw, Math.atan2(dx, dz), Math.min(1, dt * (e.state === 'move' ? 9 : 4)));
    let mvx = 0, mvz = 0, spd = T.speed * (e.enrage ? 1.3 : 1) * (e.kneel ? 0.4 : 1);
    const tall = T.boss;

    switch (e.state) {
      case 'move': {
        if (T.keep) {
          if (dist < T.keep - 2) { mvx = -nx; mvz = -nz; }
          else if (dist > T.keep + 4) { mvx = nx; mvz = nz; }
          else { mvx = -nz * e.strafe * 0.6; mvz = nx * e.strafe * 0.6; }
        } else {
          const stop = (T.melee ? T.melee.range : 10) * 0.6 + e.r;
          if (dist > stop) { mvx = nx; mvz = nz; }
          if (T.flying && dist < 14) { mvx += -nz * e.strafe * 0.5; mvz += nx * e.strafe * 0.5; }
          if (T.ranged && !T.melee && dist < 9) { mvx = -nx * 0.6; mvz = -nz * 0.6; }
        }
        if (T.charge && e.chargeCd <= 0 && dist > 8 && dist < 36 && !e.kneel && los(pos.x, pos.z, P.pos.x, P.pos.z)) {
          e.state = 'chargeWind'; e.st = T.charge.wind;
        } else if (T.stomp && e.stompCd <= 0 && dist < 28) {
          e.state = 'stompWind'; e.st = 1.0;
        } else if (T.melee && e.cd <= 0 && dist <= T.melee.range + e.r * 0.6) {
          e.state = 'wind'; e.st = T.melee.wind; e.ranged = false;
        } else if (T.ranged && !T.melee && e.cd <= 0 && dist < T.ranged.range && los(pos.x, pos.z, P.pos.x, P.pos.z)) {
          e.state = 'wind'; e.st = 0.45; e.ranged = true;
        } else if (T.ranged && T.melee && e.cd <= 0) { e.state = 'wind'; e.st = 0.4; e.ranged = true; }
        break;
      }
      case 'wind':
        e.st -= dt;
        if (T.flying) { mvx = nx * 0.4; mvz = nz * 0.4; }
        if (e.st <= 0) { doEnemyAttack(e, dist); e.state = 'move'; }
        break;
      case 'chargeWind':
        e.st -= dt;
        if (e.st <= 0) { e.state = 'charge'; e.st = T.charge.dur; e.cdir.set(nx, 0, nz); e.hit = false; SFX.play('roar'); }
        break;
      case 'charge':
        e.st -= dt; mvx = e.cdir.x; mvz = e.cdir.z; spd = T.charge.speed;
        e.yaw = Math.atan2(e.cdir.x, e.cdir.z);
        if (!e.hit && dist < e.r + 1.3) { hurtPlayer(T.charge.dmg, pos.x, pos.z, 16); e.hit = true; }
        if (e.st <= 0) { e.state = 'move'; e.chargeCd = T.charge.cd * rnd(0.9, 1.3); e.cd = 0.5; }
        break;
      case 'stompWind':
        e.st -= dt;
        if (e.st <= 0) {
          spawnRing(pos.x, pos.z, 34, 20, T.stomp.dmg, 0xff3a10, 'e');
          S.shakeBig = 0.8; SFX.play('shock');
          burst(pos.x, 0.5, pos.z, 0x6a5a4a, 20, 10, 0.8, 0.35, 15, false);
          e.state = 'move'; e.stompCd = T.stomp.cd * rnd(0.9, 1.2); e.cd = 1.0;
        }
        break;
    }

    const before = pos.x * 1000 + pos.z;
    const px0 = pos.x, pz0 = pos.z;
    const ml = Math.hypot(mvx, mvz);
    if (ml > 0.001) {
      pos.x += mvx / ml * Math.min(1, ml) * spd * dt;
      pos.z += mvz / ml * Math.min(1, ml) * spd * dt;
    }
    // separação entre inimigos
    for (let i = 0; i < enemies.length; i++) {
      const o = enemies[i];
      if (o === e || o.dead) continue;
      const ox = pos.x - o.g.position.x, oz = pos.z - o.g.position.z;
      const md = e.r + o.r;
      if (Math.abs(ox) < md && Math.abs(oz) < md) {
        const d = Math.hypot(ox, oz) || 0.01;
        if (d < md) { const push = (md - d) * 0.5 * (o.T.boss ? 1 : 0.6); pos.x += ox / d * push; pos.z += oz / d * push; }
      }
    }
    resolveCircle(pos, e.r);
    if (e.state === 'charge') {
      const moved = Math.hypot(pos.x - px0, pos.z - pz0);
      if (moved < spd * dt * 0.4 && e.st > 0.1) {
        e.state = 'move'; e.chargeCd = T.charge.cd; e.stun = tall ? 1.5 : 0.8; S.shakeBig = 0.6; SFX.play('boom');
        burst(pos.x, pos.y + 2, pos.z, 0x6a5a4a, 14, 8, 0.7, 0.35, 15, false);
      }
    }
    if (T.flying && !e.kneel) {
      const swoop = T.model === 'gargula' && (e.state === 'wind' || dist < 4.2);
      const baseGy = getGroundY(pos.x, pos.z);
      const ty = swoop ? Math.max(baseGy + 0.8, P.pos.y + 1.1) : (baseGy + T.hover + Math.sin(e.anim * 2 + e.strafe) * 0.5);
      pos.y += (ty - pos.y) * Math.min(1, dt * (swoop ? 6 : 2));
    } else if (!T.flying && !e.downed && !e.kneel) {
      const gy = groundAt(pos.x, pos.z, pos.y + 1.0, e.r);
      pos.y += (gy - pos.y) * Math.min(1, dt * 16);
    }
    g.rotation.y = e.yaw;
    // Galius p2 enfurece
    if (T.galius2 && !e.enrage && e.hp < e.maxhp * 0.7) { e.enrage = true; SFX.play('roar'); S.shakeBig = 0.8; }
    if (T.model === 'maximus' && !e.enrage && e.hp < e.maxhp * 0.5) { e.enrage = true; SFX.play('roar'); S.shakeBig = 0.6; say('MAXIMUS: PELA ORDEM DE BAPHOMET!', '', 3); }
    animEnemy(e, dt, ml > 0.01);
  }

  function animEnemy(e, dt, moving) {
    const R = e.rig, a = e.anim, T = e.T;
    const sw = moving ? Math.sin(a * T.speed * 2.2) * 0.7 : 0;
    const winding = e.state === 'wind' || e.state === 'stompWind' || e.state === 'chargeWind';
    const wt = e.state === 'stompWind' ? 1.0 : e.state === 'chargeWind' ? (T.charge ? T.charge.wind : 0.7) : (T.melee ? T.melee.wind : 0.45);
    const windP = winding ? clamp(1 - e.st / wt, 0, 1) : 0;
    const strikeT = e.recover > 0 ? e.recover / 0.35 : 0;
    if (R.legL && !e.downed) {
      R.legL.rotation.x = e.kneel ? -1.4 : sw;
      R.legR.rotation.x = e.kneel ? -1.4 : -sw;
    }
    if (R.legL && R.armL && !R.book) {
      const base = T.armsFwd ? -1.3 : 0;
      if (e.state === 'stompWind') {
        R.armL.rotation.x = -2.9 * windP; R.armR.rotation.x = -2.9 * windP;
      } else {
        R.armL.rotation.x = base + (moving && !T.armsFwd ? -sw * 0.6 : 0);
        R.armR.rotation.x = base + (moving && !T.armsFwd ? sw * 0.6 : 0) - windP * 2.6 + (strikeT > 0 ? 1.1 * (1 - strikeT) : 0) * 1;
        if (strikeT > 0 && !winding) R.armR.rotation.x = base - 2.6 * strikeT + 0.9 * (1 - strikeT);
      }
      if (e.downed) { R.armL.rotation.x = 0.4; R.armR.rotation.x = 0.4; R.head.rotation.x = 0.5; }
    }
    if (R.book) { // padre
      R.book.position.y = 1.55 + Math.sin(a * 3) * 0.08;
      R.armL.rotation.x = -1.2 - windP * 1.2; R.armR.rotation.x = -1.2 - windP * 1.2;
      R.book.scale.setScalar(1 + windP * 0.8);
    }
    if (R.wingL) {
      const f = Math.sin(a * (T.model === 'diabrete' ? 18 : 12)) * 0.7;
      R.wingL.rotation.z = f; R.wingR.rotation.z = -f;
    }
    if (R.heart) { const s = 1 + 0.2 * Math.sin(a * 6); R.heart.scale.set(s, s, s); }
    if (T.model === 'diabrete') { R.armL.rotation.x = -windP * 1.5; R.armR.rotation.x = -windP * 1.5; }
  }

  /* referencias para outras partes */
  window.__HS = { P, S, WEAPONS, enemies, scene, camera, renderer, parts, projs, rings, vmScene, vmCam, VMS };
  window.__HSAPI = {
    $, rnd, clamp, V3, lerpAngle, resolveCircle, groundAt, pointInWall, los, burst, spawnRing, spawnProj, spawnEnemy, removeEnemy,
    clearRoomEnemies, aliveInRoom, hurtPlayer, dmgEnemy, killEnemy, addFaith, updateEnemy, updateParts, updateRings, updateProjs,
    clearParts, clearProjs, setGoreDuration, ETYPES, AMMO_MAX, keys, scene, camera, renderer, amb, sun, plight, sky, vmDir, vmScene, vmCam, resize, renderScene,
    setMouse: (v) => { mouseL = v; }, getMouse: () => mouseL, curW: () => curW, setCurW: (v) => { curW = v; }, wcd
  };
  // As funções abaixo são definidas na parte 2 (story) e referenciadas aqui
  var die, say, quip, spawnPickup;
  window.__HSAPI.bind = (fns) => { die = fns.die; say = fns.say; quip = fns.quip; spawnPickup = fns.spawnPickup; };
  // ---- continua em game2.js ----
})();
