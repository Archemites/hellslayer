/* ==========================================================================
 * SANGUE REALISTA — gotículas instanciadas no próprio motor WebGL do jogo
 *
 *  - O sangue de cada jorro é quebrado em centenas de gotículas pequenas
 *    (raio 1–5 cm) com a mesma física do sangue simples (gravidade 24, arrasto).
 *  - Jorros grandes saem como jato contínuo por alguns décimos de segundo,
 *    pulsando e perdendo pressão, em vez de uma explosão instantânea.
 *  - Cada gota é um quad esticado pela velocidade no vertex shader (rastro de
 *    movimento), com cabeça arredondada, brilho úmido, luz e névoa da cena.
 *    Tudo num único draw call, dentro da cena: paredes, inimigos e a arma
 *    tampam o sangue normalmente.
 *  - Ao tocar o chão a gota vira mancha (decal persistente do jogo) por
 *    amostragem, e gotas rápidas soltam respingos secundários.
 *  - Física em arrays tipados (sem objetos por gota) e chão em cache para
 *    aguentar milhares de gotas sem pesar.
 *
 * API (window.RealBlood): init, setEnabled, setCapacity, spurt, drip, update,
 * clear, stats.
 * ========================================================================== */
(function () {
  'use strict';

  const RB = {};
  window.RealBlood = RB;

  const MAX_CAP = 60000;
  const GRAV = 24;                     // mesma gravidade do sangue simples
  const DENSITY = 24;                  // gotículas por gota do sangue simples (3x)
  const STRETCH = 0.02;                // comprimento do rastro (s de velocidade)
  const MAX_TRAIL = 0.28;              // rastro máximo (m)

  let cap = 21000, count = 0, enabled = false;
  let scene = null, camera = null, onStain = null, groundAt = null;
  let renderer = null, terrainAt = null, forEachStain = null;
  let mesh = null, geo = null, aPos = null, aVel = null, mat = null;

  // estado das gotas (struct-of-arrays)
  const px = new Float32Array(MAX_CAP), py = new Float32Array(MAX_CAP), pz = new Float32Array(MAX_CAP);
  const vx = new Float32Array(MAX_CAP), vy = new Float32Array(MAX_CAP), vz = new Float32Array(MAX_CAP);
  const life = new Float32Array(MAX_CAP), rad = new Float32Array(MAX_CAP), shade = new Float32Array(MAX_CAP);
  const gy = new Float32Array(MAX_CAP), gx0 = new Float32Array(MAX_CAP), gz0 = new Float32Array(MAX_CAP);
  const child = new Uint8Array(MAX_CAP);

  // jatos contínuos
  const emitters = [];
  const emitterPool = [];

  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------------- render ---------------- */
  const VERT = `
    attribute vec4 iPos;   // xyz, raio
    attribute vec4 iVel;   // velocidade xyz, tom
    uniform float uStretch;
    uniform float uMaxTrail;
    uniform float uPx;     // tamanho de 1 pixel a 1 m de distância
    varying vec2 vC;
    varying float vShade;
    varying float vDepth;
    void main() {
      vec4 a = modelViewMatrix * vec4(iPos.xyz, 1.0);
      float dist = max(0.05, -a.z);
      float r = max(iPos.w, uPx * dist * 0.75);       // nunca menor que ~1 pixel
      vec3 t = (modelViewMatrix * vec4(iVel.xyz * uStretch, 0.0)).xyz;
      float tl = min(length(t), uMaxTrail);
      vec3 tn = vec3(0.0, 1.0, 0.0);
      vec3 s = vec3(1.0, 0.0, 0.0);
      if (tl > r * 0.35) {
        tn = normalize(t);
        vec3 c = cross(tn, normalize(a.xyz));
        float cl = length(c);
        if (cl > 1e-4) s = c / cl; else tl = 0.0;
      } else {
        tl = 0.0;
      }
      float along = position.y * 0.5 + 0.5;            // 0 = cabeça, 1 = cauda
      vec3 head = a.xyz + tn * r;
      vec3 tail = a.xyz - tn * (tl + r);
      float w = r * mix(1.0, 0.4, along * step(0.001, tl));
      vec3 p = mix(head, tail, along) + s * position.x * w;
      vC = position.xy;
      vShade = iVel.w;
      vDepth = dist;
      gl_Position = projectionMatrix * vec4(p, 1.0);
      // gota colada na câmera viraria um borrão gigante: descarta
      if (-a.z < 0.45) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }
  `;
  const FRAG = `
    uniform vec3 uDark;
    uniform vec3 uBright;
    uniform float uLight;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    varying vec2 vC;
    varying float vShade;
    varying float vDepth;
    void main() {
      // cabeça arredondada
      if (vC.y < -0.35) {
        vec2 q = vec2(vC.x, (vC.y + 0.35) / 0.65);
        if (dot(q, q) > 1.0) discard;
      }
      vec3 col = mix(uDark, uBright, vShade);
      // borda mais escura (volume) e brilho úmido perto da cabeça
      col *= 1.0 - 0.35 * vC.x * vC.x;
      float hl = 1.0 - smoothstep(0.0, 0.45, length(vC - vec2(-0.3, -0.6)));
      col = col * uLight + vec3(0.6, 0.22, 0.2) * hl * 0.55;
      float f = smoothstep(uFogNear, uFogFar, vDepth);
      gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
    }
  `;

  // Cor/luz/névoa compartilhadas: o jorro e as poças usam exatamente os mesmos uniforms
  const SHARED = {
    uDark: { value: new THREE.Color(0.20, 0.0, 0.015) },
    uBright: { value: new THREE.Color(0.78, 0.02, 0.05) },
    uLight: { value: 1.0 },
    uFogColor: { value: new THREE.Color(0, 0, 0) },
    uFogNear: { value: 6 },
    uFogFar: { value: 95 }
  };

  function ensureReady() {
    if (mesh || !scene) return;
    geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CAP * 4), 4);
    aVel = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CAP * 4), 4);
    aPos.setUsage(THREE.DynamicDrawUsage);
    aVel.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', aPos);
    geo.setAttribute('iVel', aVel);
    geo.instanceCount = 0;

    mat = new THREE.ShaderMaterial({
      uniforms: {
        uStretch: { value: STRETCH },
        uMaxTrail: { value: MAX_TRAIL },
        uPx: { value: 0.005 },
        uDark: SHARED.uDark,
        uBright: SHARED.uBright,
        uLight: SHARED.uLight,
        uFogColor: SHARED.uFogColor,
        uFogNear: SHARED.uFogNear,
        uFogFar: SHARED.uFogFar
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide
    });
    mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.name = 'RealBlood';
    scene.add(mesh);
    initStains();
    initMap();
  }

  RB.init = function (opts) {
    if (scene) return;
    scene = opts.scene;
    camera = opts.camera;
    onStain = opts.onStain;
    groundAt = opts.groundAt;
    renderer = opts.renderer || null;
    terrainAt = opts.terrainAt || opts.groundAt;
    forEachStain = opts.forEachStain || null;
  };

  RB.setEnabled = function (on) {
    enabled = !!on;
    if (!enabled) { RB.clear(); RB.clearMap(); if (poolMesh) poolMesh.visible = false; }
    if (mesh) mesh.visible = enabled && count > 0;
  };

  RB.setCapacity = function (n) {
    cap = Math.max(500, Math.min(MAX_CAP, Math.round(n)));
    while (count > cap) kill(count - 1);
  };

  RB.stats = () => ({ count, cap, emitters: emitters.length, enabled });

  RB.clear = function () {
    count = 0;
    while (emitters.length) emitterPool.push(emitters.pop());
    if (geo) geo.instanceCount = 0;
    if (mesh) mesh.visible = false;
  };

  /* ---------------- gotas ---------------- */
  function kill(i) {
    const j = --count;
    if (i === j) return;
    px[i] = px[j]; py[i] = py[j]; pz[i] = pz[j];
    vx[i] = vx[j]; vy[i] = vy[j]; vz[i] = vz[j];
    life[i] = life[j]; rad[i] = rad[j]; shade[i] = shade[j];
    gy[i] = gy[j]; gx0[i] = gx0[j]; gz0[i] = gz0[j];
    child[i] = child[j];
  }

  function add(x, y, z, ux, uy, uz, r, l, isChild) {
    if (count >= cap) kill((Math.random() * count) | 0);  // cheio: troca uma gota aleatória
    const i = count++;
    px[i] = x; py[i] = y; pz[i] = z;
    vx[i] = ux; vy[i] = uy; vz[i] = uz;
    life[i] = l; rad[i] = r;
    shade[i] = rnd(0.35, 1.0);
    gy[i] = groundAt(x, z, y); gx0[i] = x; gz0[i] = z;
    child[i] = isChild ? 1 : 0;
  }

  // raio com viés para gotas pequenas (spray fino + algumas gotas grossas)
  function dropRadius() {
    const u = Math.random();
    return 0.011 + 0.038 * u * u;
  }

  function emitDrop(x, y, z, lx, lz, power, up) {
    const core = Math.random() < 0.62;                  // núcleo do jato coeso + spray aberto
    const spread = core ? 0.16 : 0.62;
    const sp = power * (core ? rnd(0.75, 1.2) : rnd(0.35, 1.3));
    const ux = (lx + rnd(-spread, spread)) * sp;
    const uz = (lz + rnd(-spread, spread)) * sp;
    const uy = (core ? rnd(0.4, 0.8) : rnd(0.1, 1.0)) * sp * 0.65 + up;
    add(x + rnd(-0.08, 0.08), y + rnd(-0.08, 0.08), z + rnd(-0.08, 0.08), ux, uy, uz, dropRadius(), rnd(0.9, 1.8), false);
  }

  /**
   * Jorro de sangue. Mesmos parâmetros do bloodSpurt simples; `mult` é o fator de
   * quantidade já calculado pelo jogo (impacto × qualidade × partículas).
   */
  RB.spurt = function (x, y, z, dx, dz, power, n, upBoost, mult) {
    if (!enabled) return;
    if (!mesh) ensureReady();
    if (!mesh) return;
    let lx = dx || 0, lz = dz || 0;
    const len = Math.hypot(lx, lz);
    if (len > 0.001) { lx /= len; lz /= len; }
    else { const a = Math.random() * Math.PI * 2; lx = Math.cos(a); lz = Math.sin(a); }
    const up = upBoost == null ? 2.5 : upBoost;
    const total = Math.max(2, Math.round(n * mult * DENSITY));
    // jorros pequenos (gotejamento de articulações) saem de uma vez
    if (total <= 72) {
      for (let i = 0; i < total; i++) emitDrop(x, y, z, lx, lz, power, up);
      return;
    }
    const now = Math.round(total * 0.38);
    for (let i = 0; i < now; i++) emitDrop(x, y, z, lx, lz, power, up);
    if (emitters.length >= 24) {
      emitterPool.push(emitters.shift());
    }
    const e = emitterPool.length ? emitterPool.pop() : {};
    e.x = x; e.y = y; e.z = z; e.lx = lx; e.lz = lz;
    e.power = power; e.up = up;
    e.left = total - now;
    e.dur = 0.12 + Math.min(0.3, total / 1400);
    e.rate = e.left / e.dur;
    e.t = 0; e.carry = 0;
    emitters.push(e);
  };

  /** Gotejamento de pedaços/membros. */
  RB.drip = function (x, y, z, ux, uy, uz) {
    if (!enabled) return;
    if (!mesh) ensureReady();
    if (!mesh) return;
    const qScale = Math.max(0.35, cap / MAX_CAP);
    const k = Math.max(1, Math.round((Math.random() < 0.5 ? 6 : 9) * qScale));
    for (let i = 0; i < k; i++) {
      add(x + rnd(-0.04, 0.04), y, z + rnd(-0.04, 0.04), ux + rnd(-0.3, 0.3), uy, uz + rnd(-0.3, 0.3),
        0.009 + Math.random() * 0.016, rnd(0.6, 1.0), false);
    }
  };

  function updateEmitters(dt) {
    for (let k = emitters.length - 1; k >= 0; k--) {
      const e = emitters[k];
      e.t += dt;
      const f = Math.min(1, e.t / e.dur);
      // pressão caindo + pulsação (batimento)
      const pulse = 0.82 + 0.18 * Math.sin(e.t * 38);
      const pw = e.power * (1 - 0.45 * f) * pulse;
      const up = e.up * (1 - 0.3 * f);
      e.carry += e.rate * dt;
      let m = Math.min(e.left, Math.floor(e.carry));
      e.carry -= m;
      e.left -= m;
      while (m-- > 0) emitDrop(e.x, e.y, e.z, e.lx, e.lz, pw, up);
      if (e.left <= 0 || e.t >= e.dur + 0.05) {
        emitters[k] = emitters[emitters.length - 1];
        emitters.pop();
        emitterPool.push(e);
      }
    }
  }

  function land(i) {
    const r = rad[i];
    const s2 = vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i];
    // mancha por amostragem: gotas maiores e mais rápidas mancham mais
    const p = 0.07 + r * 5.5 + (s2 > 60 ? 0.06 : 0);
    if (Math.random() < p) onStain(px[i], pz[i], r * rnd(9, 16) * (s2 > 60 ? 1.2 : 1), vx[i], vz[i], Math.sqrt(s2), gy[i]);
    // respingo: gotas rápidas quebram em 1–2 gotículas que pulam
    if (!child[i] && s2 > 36 && r > 0.016 && Math.random() < 0.4) {
      const sp = Math.sqrt(s2);
      const n = Math.random() < 0.5 ? 1 : 2;
      const x = px[i], z = pz[i], g = gy[i] + 0.03, hx = vx[i] * 0.12, hz = vz[i] * 0.12;
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, h = sp * rnd(0.05, 0.14);
        add(x, g, z, Math.cos(a) * h + hx, rnd(1.6, 3.8), Math.sin(a) * h + hz, r * rnd(0.4, 0.6), rnd(0.3, 0.6), true);
      }
    }
    kill(i);
  }

  /* ---------------- loop ---------------- */
  RB.update = function (dt, env, playerHit) {
    if (!enabled) return;
    if (!mesh) ensureReady();
    if (!mesh) return;
    mapUpdate(dt);
    if (emitters.length) updateEmitters(dt);
    if (count === 0) { geo.instanceCount = 0; mesh.visible = false; syncEnv(env); return; }

    const damp = 1 - Math.min(0.4, dt * 0.9);
    const g = GRAV * dt;
    const pR2 = playerHit ? (playerHit.r + 0.25) * (playerHit.r + 0.25) : 0;
    for (let i = count - 1; i >= 0; i--) {
      life[i] -= dt;
      if (life[i] <= 0) { kill(i); continue; }
      vy[i] -= g;
      vx[i] *= damp; vy[i] *= damp; vz[i] *= damp;
      const x = px[i] += vx[i] * dt;
      const y = py[i] += vy[i] * dt;
      const z = pz[i] += vz[i] * dt;
      if (playerHit && y >= playerHit.y + 0.45 && y <= playerHit.y + playerHit.h) {
        const dx = x - playerHit.x, dz = z - playerHit.z;
        if (dx * dx + dz * dz < pR2) {
          playerHit.onHit(y - playerHit.y, rad[i]);
          kill(i);
          continue;
        }
      }
      // chão em cache: só recalcula depois de andar ~0,35 m
      if (Math.abs(x - gx0[i]) + Math.abs(z - gz0[i]) > 0.35) {
        gy[i] = groundAt(x, z, y); gx0[i] = x; gz0[i] = z;
      }
      if (y <= gy[i] + 0.02) land(i);
    }

    const P = aPos.array, V = aVel.array;
    for (let i = 0; i < count; i++) {
      const o = i * 4;
      P[o] = px[i]; P[o + 1] = py[i]; P[o + 2] = pz[i]; P[o + 3] = rad[i];
      V[o] = vx[i]; V[o + 1] = vy[i]; V[o + 2] = vz[i]; V[o + 3] = shade[i];
    }
    aPos.updateRange.offset = 0; aPos.updateRange.count = count * 4;
    aVel.updateRange.offset = 0; aVel.updateRange.count = count * 4;
    aPos.needsUpdate = true; aVel.needsUpdate = true;
    geo.instanceCount = count;
    mesh.visible = count > 0;

    // luz, névoa e tamanho de pixel acompanham a cena
    syncEnv(env);
  };

  function syncEnv(env) {
    if (env) {
      SHARED.uLight.value = env.light;
      mat.uniforms.uPx.value = env.pxSize;
    }
    if (scene.fog) {
      SHARED.uFogColor.value.copy(scene.fog.color);
      SHARED.uFogNear.value = scene.fog.near;
      SHARED.uFogFar.value = scene.fog.far;
    }
  }
  RB.syncEnv = syncEnv;

  /* ==========================================================================
   * MANCHAS / POÇAS (Sangue Realista)
   *  - Formas orgânicas geradas por metaballs (16 variantes num atlas): gota
   *    redonda, poça irregular e respingo com gotas-satélite na direção do impacto.
   *  - Malha 4×4 por mancha com altura amostrada no terreno/pisos em cada vértice:
   *    a mancha acompanha rampas e degraus suaves e é cortada em quinas, degraus
   *    altos e paredes (não fica flutuando nem atravessa muro).
   *  - Mesmo shader de cor/luz/névoa do jorro (uniforms SHARED); poça grossa no
   *    centro fica mais escura e com brilho úmido. Ao expirar, a mancha seca
   *    encolhendo das bordas para o centro.
   * ========================================================================== */
  const STAIN_MAX = 78000;
  const GRID_N = 4;                       // 4×4 vértices
  const ATLAS = 4, CELL_PX = 64;          // 4×4 variantes de 64 px
  let stainGeo = null, stainMesh = null, stainCount = 0;
  let sA = null, sB = null, sH = [null, null, null, null];

  function hash(x, y, seed) {
    const h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function vnoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  // R = campo (cobertura em 0,5), G = espessura da poça
  function buildStainAtlas() {
    const W = ATLAS * CELL_PX;
    const data = new Uint8Array(W * W * 4);
    for (let vi = 0; vi < ATLAS * ATLAS; vi++) {
      const splatter = vi >= 8;            // 8–15: respingo de impacto rápido
      const balls = [];
      let seed = vi * 13.37 + 1;
      const R = (a, b) => { seed += 1; return a + hash(seed, vi, 3.1) * (b - a); };
      // corpo principal: vários lóbulos sobrepostos
      const lobes = splatter ? 5 : 4 + (vi % 4);
      for (let k = 0; k < lobes; k++) {
        const ang = R(0, Math.PI * 2), dist = R(0, splatter ? 0.12 : 0.16);
        balls.push([Math.cos(ang) * dist, Math.sin(ang) * dist, R(0.1, splatter ? 0.15 : 0.19)]);
      }
      // gotas-satélite (no respingo, concentradas para +x = direção do impacto)
      const sats = splatter ? 9 + (vi % 4) * 2 : 2 + (vi % 3);
      for (let k = 0; k < sats; k++) {
        const ang = splatter ? R(-0.7, 0.7) : R(0, Math.PI * 2);
        const dist = R(0.24, 0.44);
        balls.push([Math.cos(ang) * dist, Math.sin(ang) * dist, R(0.022, 0.05)]);
      }
      // rastro alongado entre o corpo e os satélites
      if (splatter) {
        for (let k = 0; k < 5; k++) balls.push([0.1 + k * 0.06, R(-0.03, 0.03), 0.07 - k * 0.009]);
      }
      const ox = (vi % ATLAS) * CELL_PX, oy = Math.floor(vi / ATLAS) * CELL_PX;
      for (let y = 0; y < CELL_PX; y++) {
        for (let x = 0; x < CELL_PX; x++) {
          const u = (x + 0.5) / CELL_PX - 0.5, v = (y + 0.5) / CELL_PX - 0.5;
          let f = 0;
          for (let k = 0; k < balls.length; k++) {
            const b = balls[k], dx = u - b[0], dy = v - b[1];
            f += (b[2] * b[2]) / (dx * dx + dy * dy + 1e-5);
          }
          f *= 0.82 + 0.36 * vnoise(u * 9 + vi * 3, v * 9, vi);   // borda irregular
          const edge = Math.max(0, Math.hypot(u, v) * 2 - 0.86);    // nunca encosta na borda da célula
          f *= Math.max(0, 1 - edge * 6);
          const i = ((oy + y) * W + (ox + x)) * 4;
          data[i] = Math.min(255, Math.round(Math.min(1, f * 0.5) * 255));
          data[i + 1] = Math.min(255, Math.round(Math.max(0, Math.min(1, (f - 1) / 3)) * 255));
          data[i + 2] = Math.round(vnoise(u * 20, v * 20, vi + 7) * 255);
          data[i + 3] = 255;
        }
      }
    }
    const tex = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  const STAIN_VERT = `
    attribute vec4 rowSel;
    attribute vec4 colSel;
    attribute vec4 iA;    // x, (livre), z, tamanho
    attribute vec4 iB;    // yaw, alongamento, variante, tom
    attribute vec4 iC;    // fade (1 = fresca), idade, -, -
    attribute vec4 iH0;
    attribute vec4 iH1;
    attribute vec4 iH2;
    attribute vec4 iH3;
    varying vec2 vUv;
    varying float vValid;
    varying float vShade;
    varying float vFade;
    varying float vDepth;
    void main() {
      float h = dot(colSel, mat4(iH0, iH1, iH2, iH3) * rowSel);
      vValid = h < -500.0 ? 0.0 : 1.0;
      float st = iB.y;
      vec2 l = vec2(position.x * iA.w * st, position.z * iA.w / sqrt(st));
      float c = cos(iB.x), sn = sin(iB.x);
      vec3 wp = vec3(iA.x + l.x * c - l.y * sn, max(h, -500.0) + 0.095, iA.z + l.x * sn + l.y * c);
      float vi = iB.z;
      vec2 cell = vec2(mod(vi, 4.0), floor(vi / 4.0));
      vUv = (cell + uv) / 4.0;
      vShade = iB.w;
      vFade = iC.x;
      vec4 mv = modelViewMatrix * vec4(wp, 1.0);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `;
  const STAIN_FRAG = `
    uniform sampler2D uMap;
    uniform vec3 uDark;
    uniform vec3 uBright;
    uniform float uLight;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    varying vec2 vUv;
    varying float vValid;
    varying float vShade;
    varying float vFade;
    varying float vDepth;
    void main() {
      if (vValid < 0.5) discard;                         // cortada em degrau/parede
      vec4 t = texture2D(uMap, vUv);
      float thr = 0.5 + (1.0 - vFade) * 0.42;            // secando: encolhe para o centro
      if (t.r < thr) discard;
      float thick = t.g;
      // mesma cor do jorro; o centro mais grosso da poça escurece só um pouco, para as
      // manchas vizinhas se fundirem numa poça única em vez de formar "células"
      vec3 col = mix(uDark, uBright, vShade);
      col *= mix(1.0, 0.8, thick);
      col *= 0.94 + 0.12 * t.b;
      col *= uLight;
      // brilho úmido onde a poça é mais grossa
      col += vec3(0.42, 0.12, 0.1) * smoothstep(0.55, 0.95, thick) * step(0.72, t.b) * 0.5;
      float f = smoothstep(uFogNear, uFogFar, vDepth);
      gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
    }
  `;

  function initStains() {
    const n = GRID_N, pos = [], uvs = [], rows = [], colsA = [], idx = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        pos.push(c / (n - 1) - 0.5, 0, r / (n - 1) - 0.5);
        uvs.push(c / (n - 1), r / (n - 1));
        rows.push(r === 0 ? 1 : 0, r === 1 ? 1 : 0, r === 2 ? 1 : 0, r === 3 ? 1 : 0);
        colsA.push(c === 0 ? 1 : 0, c === 1 ? 1 : 0, c === 2 ? 1 : 0, c === 3 ? 1 : 0);
      }
    }
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const a = r * n + c, b = a + 1, d = a + n, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
    stainGeo = new THREE.InstancedBufferGeometry();
    stainGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    stainGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    stainGeo.setAttribute('rowSel', new THREE.Float32BufferAttribute(rows, 4));
    stainGeo.setAttribute('colSel', new THREE.Float32BufferAttribute(colsA, 4));
    stainGeo.setIndex(idx);
    const mk = (name) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(STAIN_MAX * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage);
      stainGeo.setAttribute(name, a);
      return a;
    };
    sA = mk('iA'); sB = mk('iB');
    const sC = mk('iC');
    sB.sC = sC;
    for (let k = 0; k < 4; k++) sH[k] = mk('iH' + k);
    stainGeo.instanceCount = 0;
    const stainMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: buildStainAtlas() },
        uDark: SHARED.uDark, uBright: SHARED.uBright, uLight: SHARED.uLight,
        uFogColor: SHARED.uFogColor, uFogNear: SHARED.uFogNear, uFogFar: SHARED.uFogFar
      },
      vertexShader: STAIN_VERT,
      fragmentShader: STAIN_FRAG,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -12,
      polygonOffsetUnits: -12
    });
    stainMesh = new THREE.Mesh(stainGeo, stainMat);
    stainMesh.frustumCulled = false;
    stainMesh.renderOrder = 5;
    stainMesh.visible = false;
    stainMesh.name = 'RealBloodStains';
    scene.add(stainMesh);
  }

  /**
   * Prepara uma mancha (chamado uma vez ao nascer): forma, orientação pelo impacto
   * e altura do terreno. Se a mancha nasce dentro do mapa de fluido 48x48m, adia a
   * amostragem 4x4 dos 16 vértices (lazy) para só calcular se o jogador se afastar
   * da área, eliminando ~90% dos raycasts de colisão durante os jorros de combate.
   */
  function ensureStainGrid(d) {
    if (d._gridReady) return;
    d._gridReady = true;
    if (!d.h) d.h = new Float32Array(16);
    const surfaceAt = d._surfFn || groundAt;
    const blockedAt = d._blockFn || null;
    if (!surfaceAt) return;
    const x = d.x, z = d.z, cy = d.y, size = d.size;
    const c = Math.cos(d.yaw), s = Math.sin(d.yaw);
    for (let r = 0; r < GRID_N; r++) {
      for (let k = 0; k < GRID_N; k++) {
        const lx = (k / (GRID_N - 1) - 0.5) * size * d.stretch;
        const lz = (r / (GRID_N - 1) - 0.5) * size / Math.sqrt(d.stretch);
        const wx = x + lx * c - lz * s, wz = z + lx * s + lz * c;
        let h = surfaceAt(wx, wz, cy + 0.3);
        if (Math.abs(h - cy) > 0.4 || (blockedAt && blockedAt(wx, wz, cy))) h = -999;
        d.h[r * GRID_N + k] = h;
      }
    }
  }

  RB.prepareStain = function (d, x, z, size, dirX, dirZ, speed, yHint, surfaceAt, blockedAt) {
    if (enabled && !mesh) ensureReady();
    const hs = Math.hypot(dirX || 0, dirZ || 0);
    const fast = speed > 7 && hs > 0.5;
    d.yaw = hs > 0.01 ? Math.atan2(dirZ, dirX) : Math.random() * Math.PI * 2;
    d.stretch = fast ? 1 + Math.min(0.9, (hs / Math.max(1, speed)) * (speed / 12)) : rnd(0.9, 1.15);
    d.vari = fast ? 8 + ((Math.random() * 8) | 0) : (Math.random() * 8) | 0;
    d.shade = rnd(0.45, 1.0);
    d.size = size;
    d.vol = 0.1 + size * 0.38;          // cm de sangue depositados no mapa
    const cy = (yHint != null && Number.isFinite(yHint)) ? yHint : surfaceAt(x, z, yHint);
    d.x = x; d.z = z; d.y = cy;
    d._surfFn = surfaceAt;
    d._blockFn = blockedAt;
    d._gridReady = false;
    if (!RB.inMap(x, z)) ensureStainGrid(d);
  };

  RB.stainBegin = function () { stainCount = 0; };
  RB.stainPush = function (d, fade) {
    if (!stainMesh || stainCount >= STAIN_MAX) return;
    if (!d._gridReady) ensureStainGrid(d);
    const o = stainCount * 4;
    const A = sA.array, B = sB.array, C = sB.sC.array;
    A[o] = d.x; A[o + 1] = d.y; A[o + 2] = d.z; A[o + 3] = d.size;
    B[o] = d.yaw; B[o + 1] = d.stretch; B[o + 2] = d.vari; B[o + 3] = d.shade;
    C[o] = fade; C[o + 1] = d.age || 0; C[o + 2] = 0; C[o + 3] = 0;
    const h = d.h;
    for (let r = 0; r < 4; r++) {
      const H = sH[r].array;
      H[o] = h[r * 4]; H[o + 1] = h[r * 4 + 1]; H[o + 2] = h[r * 4 + 2]; H[o + 3] = h[r * 4 + 3];
    }
    stainCount++;
  };
  RB.stainEnd = function () {
    if (!stainMesh) return;
    const n = stainCount * 4;
    const list = [sA, sB, sB.sC, sH[0], sH[1], sH[2], sH[3]];
    for (let k = 0; k < list.length; k++) {
      list[k].updateRange.offset = 0;
      list[k].updateRange.count = n;
      list[k].needsUpdate = true;
    }
    stainGeo.instanceCount = stainCount;
    stainMesh.visible = stainCount > 0;
  };

  /* ==========================================================================
   * MAPA DE SANGUE (Sangue Realista): poças que se fundem e escorrem
   *  - Uma textura em espaço de mundo (48×48 m, 12,5 cm por texel) ao redor do
   *    jogador guarda a quantidade de sangue em cada ponto (R) e o quão fresco
   *    ele está (G). Cada mancha deposita sangue com a forma orgânica do atlas;
   *    manchas próximas somam e viram uma poça única (contorno por limiar).
   *  - Um passe de fluxo na GPU (30 Hz) move o sangue para os vizinhos mais
   *    baixos usando a altura real do terreno, pisos e degraus: escorre ladeira
   *    abaixo, cai de degraus e se espalha em poça até coagular (~8 s).
   *    Muros bloqueiam o fluxo. O fluxo conserva o volume.
   *  - A poça é desenhada por uma malha que acompanha o terreno, com a mesma
   *    cor/luz/névoa do jorro. Ao andar, o mapa se reposiciona (calculado aos
   *    poucos, sem travar) e as manchas antigas são redepositadas.
   *  - Manchas fora do mapa usam o desenho individual (atlas + malha 4×4).
   * ========================================================================== */
  const MAP_RES = 384, MAP_SIZE = 48, MAP_TEXEL = MAP_SIZE / MAP_RES;
  const MESH_STEP = 2, MESH_N = MAP_RES / MESH_STEP + 1;
  const FLOW_HZ = 30;
  const MIN_FILM = 0.32;           // cm de sangue que gruda e não escorre (sangue é viscoso)
  const SHOW_T = 0.16;             // cm mínimos para aparecer
  let mapOK = false, map = null, job = null, mapVersion = 0;
  let rtA = null, rtB = null, heightTex = null, heightData = null;
  let quadScene = null, quadCam = null, quadMesh = null, flowMat = null, shiftMat = null;
  let splatScene = null, splatGeo = null, splatMesh = null, splA = null, splB = null;
  let poolMesh = null, poolMat = null, poolGeo = null;
  let flowAcc = 0, decayAcc = 0, wetTimer = 0, hasFluid = false;
  let _jobTerr = null, _jobSurf = null, _jobWall = null;
  const pendingSplats = [];
  const _clearCol = new THREE.Color();

  const FS_VERT = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `;
  const FLOW_FRAG = `
    uniform sampler2D tFluid;
    uniform sampler2D tHeight;
    uniform vec2 uTexel;
    uniform float uK;
    uniform float uMin;
    uniform float uDecay;
    uniform float uWetDecay;
    varying vec2 vUv;
    float flowPair(vec4 c, float Hc, vec2 uv) {
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
      vec4 hn = texture2D(tHeight, uv);
      if (hn.g > 0.5) return 0.0;
      vec4 n = texture2D(tFluid, uv);
      float d = (hn.r * 100.0 + n.r) - Hc;
      if (d > 0.0) return uK * min(n.g, 1.0) * min(d * 0.5, max(n.r - uMin, 0.0) * 0.25);
      return -uK * min(c.g, 1.0) * min(-d * 0.5, max(c.r - uMin, 0.0) * 0.25);
    }
    void main() {
      vec4 hc = texture2D(tHeight, vUv);
      if (hc.g > 0.5) { gl_FragColor = vec4(0.0); return; }
      vec4 c = texture2D(tFluid, vUv);
      float Hc = hc.r * 100.0 + c.r;
      float net = flowPair(c, Hc, vUv + vec2(uTexel.x, 0.0))
                + flowPair(c, Hc, vUv - vec2(uTexel.x, 0.0))
                + flowPair(c, Hc, vUv + vec2(0.0, uTexel.y))
                + flowPair(c, Hc, vUv - vec2(0.0, uTexel.y));
      float a = max(0.0, c.r + net) * uDecay;
      if (a < 0.02) a = 0.0;
      float wet = min(c.g, 1.0) * uWetDecay;
      // sangue que chega a um texel seco o deixa úmido (frente da poça continua andando)
      if (net > 0.01) wet = max(wet, min(1.0, net * 4.0) * 0.6);
      gl_FragColor = vec4(a, wet, 0.0, 1.0);
    }
  `;
  const SHIFT_FRAG = `
    uniform sampler2D tFluid;
    uniform vec2 uOffset;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv + uOffset;
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
      gl_FragColor = texture2D(tFluid, uv);
    }
  `;
  const SPLAT_VERT = `
    attribute vec4 iS;   // u, v, tamanho (uv), yaw
    attribute vec4 iT;   // alongamento, variante, volume (cm), -
    varying vec2 vUv;
    varying float vVol;
    void main() {
      float st = iT.x;
      vec2 l = vec2(position.x * iS.z * st, position.y * iS.z / sqrt(st));
      float c = cos(iS.w), s = sin(iS.w);
      vec2 p = iS.xy + vec2(l.x * c - l.y * s, l.x * s + l.y * c);
      float vi = iT.y;
      vUv = (vec2(mod(vi, 4.0), floor(vi / 4.0)) + (position.xy + 0.5)) / 4.0;
      vVol = iT.z;
      gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }
  `;
  const SPLAT_FRAG = `
    uniform sampler2D uMap;
    varying vec2 vUv;
    varying float vVol;
    void main() {
      vec4 t = texture2D(uMap, vUv);
      float dep = (t.r + t.g) * vVol;
      gl_FragColor = vec4(dep, step(0.05, t.r), 0.0, 0.0);
    }
  `;
  const POOL_VERT = `
    uniform vec2 uMin;
    uniform float uSize;
    varying vec2 vUv;
    varying float vDepth;
    void main() {
      vUv = (position.xz - uMin) / uSize;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `;
  const POOL_FRAG = `
    uniform sampler2D tFluid;
    uniform vec3 uDark;
    uniform vec3 uBright;
    uniform float uLight;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    uniform float uShow;
    uniform vec2 uTexel;
    varying vec2 vUv;
    varying float vDepth;
    void main() {
      // borda da janela do mapa: some suavemente (lá as manchas individuais assumem)
      if (vUv.x < uTexel.x || vUv.y < uTexel.y || vUv.x > 1.0 - uTexel.x || vUv.y > 1.0 - uTexel.y) discard;
      vec4 f = texture2D(tFluid, vUv);
      if (f.r < uShow) discard;
      float thick = smoothstep(uShow, 2.0, f.r);
      float wet = clamp(f.g, 0.0, 1.0);
      // mesma cor do jorro (tom médio das gotas); poça funda escurece, sangue velho fica mais fosco
      vec3 col = mix(uDark, uBright, 0.72);
      col *= mix(1.0, 0.78, thick);
      col *= mix(0.86, 1.0, wet);
      col *= uLight;
      // sangue fresco e fundo fica levemente mais vivo (úmido)
      col += vec3(0.1, 0.012, 0.01) * wet * thick * uLight;
      float fg = smoothstep(uFogNear, uFogFar, vDepth);
      gl_FragColor = vec4(mix(col, uFogColor, fg), 1.0);
    }
  `;

  function initMap() {
    if (!renderer || !renderer.capabilities || !renderer.capabilities.isWebGL2) return;
    if (renderer.extensions && renderer.extensions.has && !renderer.extensions.has('EXT_color_buffer_float')) return;
    const rtOpts = {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false
    };
    rtA = new THREE.WebGLRenderTarget(MAP_RES, MAP_RES, rtOpts);
    rtB = new THREE.WebGLRenderTarget(MAP_RES, MAP_RES, rtOpts);
    heightData = new Float32Array(MAP_RES * MAP_RES * 4);
    heightTex = new THREE.DataTexture(heightData, MAP_RES, MAP_RES, THREE.RGBAFormat, THREE.FloatType);
    heightTex.magFilter = THREE.NearestFilter; heightTex.minFilter = THREE.NearestFilter;
    heightTex.generateMipmaps = false;
    heightTex.needsUpdate = true;

    quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quadScene = new THREE.Scene();
    flowMat = new THREE.ShaderMaterial({
      uniforms: {
        tFluid: { value: null }, tHeight: { value: heightTex },
        uTexel: { value: new THREE.Vector2(1 / MAP_RES, 1 / MAP_RES) },
        uK: { value: 0.22 }, uMin: { value: MIN_FILM }, uDecay: { value: 1 }, uWetDecay: { value: 1 }
      },
      vertexShader: FS_VERT, fragmentShader: FLOW_FRAG, depthTest: false, depthWrite: false
    });
    shiftMat = new THREE.ShaderMaterial({
      uniforms: { tFluid: { value: null }, uOffset: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT, fragmentShader: SHIFT_FRAG, depthTest: false, depthWrite: false
    });
    quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), flowMat);
    quadMesh.frustumCulled = false;
    quadScene.add(quadMesh);

    splatScene = new THREE.Scene();
    splatGeo = new THREE.InstancedBufferGeometry();
    splatGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    splatGeo.setIndex([0, 1, 2, 0, 2, 3]);
    splA = new THREE.InstancedBufferAttribute(new Float32Array(4096 * 4), 4);
    splB = new THREE.InstancedBufferAttribute(new Float32Array(4096 * 4), 4);
    splA.setUsage(THREE.DynamicDrawUsage); splB.setUsage(THREE.DynamicDrawUsage);
    splatGeo.setAttribute('iS', splA);
    splatGeo.setAttribute('iT', splB);
    splatGeo.instanceCount = 0;
    splatMesh = new THREE.Mesh(splatGeo, new THREE.ShaderMaterial({
      uniforms: { uMap: { value: stainMesh.material.uniforms.uMap.value } },
      vertexShader: SPLAT_VERT, fragmentShader: SPLAT_FRAG,
      depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor
    }));
    splatMesh.frustumCulled = false;
    splatScene.add(splatMesh);

    // malha da poça: grade que segue a altura do terreno/pisos
    poolGeo = new THREE.BufferGeometry();
    poolGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MESH_N * MESH_N * 3), 3));
    const idx = [];
    for (let r = 0; r < MESH_N - 1; r++) {
      for (let c = 0; c < MESH_N - 1; c++) {
        const a = r * MESH_N + c, b = a + 1, d = a + MESH_N, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
    poolGeo.setIndex(idx);
    poolMat = new THREE.ShaderMaterial({
      uniforms: {
        tFluid: { value: rtA.texture }, uMin: { value: new THREE.Vector2() }, uSize: { value: MAP_SIZE },
        uShow: { value: SHOW_T }, uTexel: { value: new THREE.Vector2(1 / MAP_RES, 1 / MAP_RES) },
        uDark: SHARED.uDark, uBright: SHARED.uBright, uLight: SHARED.uLight,
        uFogColor: SHARED.uFogColor, uFogNear: SHARED.uFogNear, uFogFar: SHARED.uFogFar
      },
      vertexShader: POOL_VERT, fragmentShader: POOL_FRAG,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -14, polygonOffsetUnits: -14,
      side: THREE.FrontSide
    });
    poolMesh = new THREE.Mesh(poolGeo, poolMat);
    poolMesh.frustumCulled = false;
    poolMesh.renderOrder = 6;
    poolMesh.visible = false;
    poolMesh.name = 'RealBloodPools';
    scene.add(poolMesh);
    mapOK = true;
  }

  function withTarget(rt, fn) {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    fn();
    renderer.setRenderTarget(prev);
  }
  function clearRT(rt) {
    renderer.getClearColor(_clearCol);
    const a = renderer.getClearAlpha();
    withTarget(rt, () => { renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false); });
    renderer.setClearColor(_clearCol, a);
  }

  RB.clearMap = function () {
    if (!mapOK) return;
    pendingSplats.length = 0;
    if (map) { clearRT(rtA); clearRT(rtB); }
    map = null; job = null;          // recalcula alturas (troca de mapa/fase)
    wetTimer = 0; hasFluid = false; flowAcc = 0; decayAcc = 0;
    mapVersion++;
    if (poolMesh) poolMesh.visible = false;
  };
  RB.inMap = function (x, z) {
    if (!map) return false;
    const m = 1.0;
    return x > map.minX + m && x < map.minX + MAP_SIZE - m && z > map.minZ + m && z < map.minZ + MAP_SIZE - m;
  };
  RB.mapVersion = () => mapVersion;
  RB.hasMap = () => mapOK;

  /** Deposita uma mancha no mapa (se estiver dentro dele). */
  RB.splat = function (d) {
    if (!mapOK) return false;
    pendingSplats.push(d);
    return true;
  };

  function flushSplats() {
    if (!pendingSplats.length || !map) return;
    const A = splA.array, B = splB.array;
    let n = 0;
    for (let i = 0; i < pendingSplats.length && n < 4096; i++) {
      const d = pendingSplats[i];
      const u = (d.x - map.minX) / MAP_SIZE, v = (d.z - map.minZ) / MAP_SIZE;
      if (u < -0.05 || v < -0.05 || u > 1.05 || v > 1.05) continue;
      const o = n * 4;
      A[o] = u; A[o + 1] = v; A[o + 2] = d.size / MAP_SIZE; A[o + 3] = d.yaw;
      B[o] = d.stretch; B[o + 1] = d.vari; B[o + 2] = d.vol; B[o + 3] = 0;
      n++;
    }
    pendingSplats.length = 0;
    if (!n) return;
    splA.updateRange.offset = 0; splA.updateRange.count = n * 4; splA.needsUpdate = true;
    splB.updateRange.offset = 0; splB.updateRange.count = n * 4; splB.needsUpdate = true;
    splatGeo.instanceCount = n;
    withTarget(rtA, () => renderer.render(splatScene, quadCam));
    wetTimer = 12.0;
    hasFluid = true;
  }

  function flowStep(dt, decay) {
    flowMat.uniforms.tFluid.value = rtA.texture;
    flowMat.uniforms.uDecay.value = decay;
    flowMat.uniforms.uWetDecay.value = Math.exp(-dt / 8);   // coagula em ~8 s
    quadMesh.material = flowMat;
    withTarget(rtB, () => renderer.render(quadScene, quadCam));
    const t = rtA; rtA = rtB; rtB = t;
  }

  /* ---- reposicionamento do mapa (alturas calculadas aos poucos) ---- */
  function startJob(px, pz) {
    const snap = MAP_TEXEL * MESH_STEP;
    const cx = Math.round(px / snap) * snap, cz = Math.round(pz / snap) * snap;
    if (!_jobTerr) {
      const cells = MAP_RES * MAP_RES;
      _jobTerr = new Float32Array(cells);
      _jobSurf = new Float32Array(cells);
      _jobWall = new Uint8Array(cells);
    }
    job = {
      minX: cx - MAP_SIZE / 2, minZ: cz - MAP_SIZE / 2,
      terr: _jobTerr, surf: null, wall: null, row: 0
    };
  }

  const _colList = [];
  function stepJob(budgetMs) {
    const t0 = performance.now();
    const R = MAP_RES;
    while (job.row < R) {
      const z = job.minZ + (job.row + 0.5) * MAP_TEXEL;
      const base = job.row * R;
      for (let i = 0; i < R; i++) job.terr[base + i] = terrainAt(job.minX + (i + 0.5) * MAP_TEXEL, z);
      job.row++;
      if (performance.now() - t0 > budgetMs) return false;
    }
    // pisos/caixas viram superfície; muros bloqueiam (reutiliza buffers pré-alocados)
    const surf = _jobSurf;
    surf.set(job.terr);
    const wall = _jobWall;
    wall.fill(0);
    const W = window.World || (typeof World !== 'undefined' ? World : null);
    if (W) {
      const maxX = job.minX + MAP_SIZE, maxZ = job.minZ + MAP_SIZE;
      const list = W.queryColliders ? W.queryColliders(job.minX, job.minZ, maxX, maxZ, _colList) : (W.colliders || []);
      for (let k = 0; k < list.length; k++) {
        const c = list[k];
        if (!c || c.active === false) continue;
        const i0 = Math.max(0, Math.ceil((c.x1 - job.minX) / MAP_TEXEL - 0.5));
        const i1 = Math.min(R - 1, Math.floor((c.x2 - job.minX) / MAP_TEXEL - 0.5));
        const j0 = Math.max(0, Math.ceil((c.z1 - job.minZ) / MAP_TEXEL - 0.5));
        const j1 = Math.min(R - 1, Math.floor((c.z2 - job.minZ) / MAP_TEXEL - 0.5));
        if (i0 > i1 || j0 > j1) continue;
        const floor = c.walkable && c.yMax != null;
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const t = j * R + i;
            if (floor) { if (c.yMax > surf[t]) surf[t] = c.yMax; }
            else wall[t] = 1;
          }
        }
      }
    }
    job.surf = surf; job.wall = wall;
    return true;
  }

  function finishJob() {
    const R = MAP_RES;
    const old = map;
    const baseY = job.surf[(R >> 1) * R + (R >> 1)];
    for (let t = 0; t < R * R; t++) {
      heightData[t * 4] = job.surf[t] - baseY;
      heightData[t * 4 + 1] = job.wall[t];
      heightData[t * 4 + 2] = 0; heightData[t * 4 + 3] = 1;
    }
    heightTex.needsUpdate = true;
    // malha da poça: precisa ficar acima do chão VISÍVEL. Os pisos do jogo (terra, pedra,
    // plantação, madeira) são desenhados até 7 cm acima do terreno e com malha grossa
    // (passo de 2,5–4 m): em baixadas a reta entre vértices fica acima da curva real.
    // Usa o envelope pela corda de ±2 m + folga, senão o chão cobre a poça perto do jogador.
    const T = job.terr, K = Math.round(2 / MAP_TEXEL);
    const P = poolGeo.attributes.position.array;
    for (let r = 0; r < MESH_N; r++) {
      for (let c = 0; c < MESH_N; c++) {
        const ti = Math.min(R - 1, r * MESH_STEP), tj = Math.min(R - 1, c * MESH_STEP);
        const t = ti * R + tj;
        let h;
        if (job.wall[t]) h = T[t];
        else if (job.surf[t] > T[t] + 0.01) h = job.surf[t] + 0.05;      // topo de piso/caixa: plano
        else {
          let hv = T[t];
          if (tj - K >= 0 && tj + K < R) hv = Math.max(hv, (T[t - K] + T[t + K]) * 0.5);
          if (ti - K >= 0 && ti + K < R) hv = Math.max(hv, (T[t - K * R] + T[t + K * R]) * 0.5);
          h = hv + 0.095;
        }
        const o = (r * MESH_N + c) * 3;
        P[o] = job.minX + (Math.min(c * MESH_STEP, R) ) * MAP_TEXEL;
        P[o + 1] = h;
        P[o + 2] = job.minZ + (Math.min(r * MESH_STEP, R)) * MAP_TEXEL;
      }
    }
    poolGeo.attributes.position.needsUpdate = true;
    poolMat.uniforms.uMin.value.set(job.minX, job.minZ);

    // desloca o sangue que já estava no mapa
    if (old) {
      shiftMat.uniforms.tFluid.value = rtA.texture;
      shiftMat.uniforms.uOffset.value.set((job.minX - old.minX) / MAP_SIZE, (job.minZ - old.minZ) / MAP_SIZE);
      quadMesh.material = shiftMat;
      withTarget(rtB, () => renderer.render(quadScene, quadCam));
      const t = rtA; rtA = rtB; rtB = t;
    } else {
      clearRT(rtA); clearRT(rtB);
    }
    map = { minX: job.minX, minZ: job.minZ };
    // manchas antigas na área nova (que não estava no mapa) são redepositadas
    if (forEachStain) {
      forEachStain((d) => {
        const inNew = d.x > map.minX && d.x < map.minX + MAP_SIZE && d.z > map.minZ && d.z < map.minZ + MAP_SIZE;
        const inOld = old && d.x > old.minX && d.x < old.minX + MAP_SIZE && d.z > old.minZ && d.z < old.minZ + MAP_SIZE;
        if (inNew && !inOld) pendingSplats.push(d);
      });
    }
    job = null;
    mapVersion++;
  }

  function mapUpdate(dt) {
    if (!mapOK || !camera) return;
    const p = camera.position;
    if (!map && !job) startJob(p.x, p.z);
    if (map && !job) {
      const cx = map.minX + MAP_SIZE / 2, cz = map.minZ + MAP_SIZE / 2;
      if (Math.abs(p.x - cx) > 8 || Math.abs(p.z - cz) > 8) startJob(p.x, p.z);
    }
    if (job) {
      // alturas calculadas aos poucos (1.35 ms por quadro) e finalizadas no quadro seguinte para zero micro-stutter
      if (job.readyToFinish) finishJob();
      else if (stepJob(1.35)) job.readyToFinish = true;
    }
    if (!map) return;
    flushSplats();
    if (hasFluid) {
      const life = RB.bloodLifetime ? RB.bloodLifetime() : Infinity;
      const finiteLife = isFinite(life);
      if (wetTimer > 0) {
        wetTimer = Math.max(0, wetTimer - dt);
        flowAcc += dt;
        const decay = finiteLife ? Math.exp(-(1 / FLOW_HZ) * 3 / Math.max(1, life)) : 1;
        if (flowAcc >= 1 / FLOW_HZ) {
          flowAcc -= 1 / FLOW_HZ;
          flowStep(1 / FLOW_HZ, decay);
        }
        if (flowAcc > 0.1) flowAcc = 0;
      } else if (finiteLife) {
        // Sangue já coagulou: reduz o passe de decaimento de 30 Hz para 2 Hz (-93% GPU)
        decayAcc += dt;
        if (decayAcc >= 0.5) {
          const stepDt = Math.min(2.0, decayAcc);
          decayAcc = 0;
          flowStep(stepDt, Math.exp(-stepDt * 3 / Math.max(1, life)));
        }
      }
    }
    poolMat.uniforms.tFluid.value = rtA.texture;
    poolMesh.visible = hasFluid;
  }
})();
