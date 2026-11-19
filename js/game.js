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
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.autoClear = false;
  renderer.setPixelRatio(1);
  $('screen').appendChild(renderer.domElement);
  let internalH = 270;
  let ssaoEnabled = false;
  let ssaoQuality = 'off';

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
  let sceneRT = null, aoRT = null, depthTex = null, aoCam = null, aoScene = null, aoQuad = null, ssaoMat = null, aoCompMat = null;
  function getAoDiv(ih) { return ih >= 1080 ? 4 : (ih >= 720 ? 3 : 2); }
  function disposeSSAO() {
    if (sceneRT) { sceneRT.dispose(); sceneRT = null; }
    if (aoRT) { aoRT.dispose(); aoRT = null; }
    if (depthTex) { depthTex.dispose(); depthTex = null; }
  }
  function ensureSSAO(iw, ih) {
    if (!hasDepthTex) return false;
    const aoDiv = getAoDiv(ih);
    const aoW = Math.max(1, Math.floor(iw / aoDiv));
    const aoH = Math.max(1, Math.floor(ih / aoDiv));
    if (!sceneRT) {
      const dType = renderer.capabilities.isWebGL2 ? THREE.UnsignedIntType : THREE.UnsignedShortType;
      depthTex = new THREE.DepthTexture(iw, ih, dType);
      sceneRT = new THREE.WebGLRenderTarget(iw, ih, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: true,
        depthTexture: depthTex
      });
      aoRT = new THREE.WebGLRenderTarget(aoW, aoH, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false
      });
      if (ssaoMat) ssaoMat.uniforms.tDepth.value = depthTex;
      if (aoCompMat) {
        aoCompMat.uniforms.tColor.value = sceneRT.texture;
        aoCompMat.uniforms.tAO.value = aoRT.texture;
        aoCompMat.uniforms.tDepth.value = depthTex;
      }
    } else if (sceneRT.width !== iw || sceneRT.height !== ih || aoRT.width !== aoW || aoRT.height !== aoH) {
      sceneRT.setSize(iw, ih);
      aoRT.setSize(aoW, aoH);
    }
    if (ssaoMat) ssaoMat.uniforms.uTexel.value.set(1 / iw, 1 / ih);
    if (aoCompMat) aoCompMat.uniforms.uTexel.value.set(1 / aoW, 1 / aoH);
    return true;
  }
  if (hasDepthTex) {
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
        tDepth: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        uProj: { value: new THREE.Matrix4() },
        uTexel: { value: new THREE.Vector2(1 / 480, 1 / internalH) },
        uRadius: { value: 0.95 },
        uBias: { value: 0.035 },
        uIntensity: { value: 1.35 },
        uSamples: { value: 12.0 }
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
        uniform float uSamples;
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

          vec3 ks[16];
          ks[0]  = vec3( 0.04,  0.02, 0.16);
          ks[1]  = vec3(-0.11,  0.07, 0.19);
          ks[2]  = vec3( 0.09, -0.15, 0.22);
          ks[3]  = vec3(-0.22, -0.09, 0.27);
          ks[4]  = vec3( 0.28,  0.14, 0.24);
          ks[5]  = vec3(-0.14,  0.34, 0.31);
          ks[6]  = vec3( 0.19, -0.37, 0.28);
          ks[7]  = vec3(-0.46,  0.11, 0.35);
          ks[8]  = vec3( 0.49, -0.19, 0.42);
          ks[9]  = vec3(-0.27, -0.53, 0.38);
          ks[10] = vec3( 0.33,  0.58, 0.44);
          ks[11] = vec3(-0.61, -0.31, 0.52);
          ks[12] = vec3( 0.58,  0.42, 0.36);
          ks[13] = vec3(-0.42,  0.64, 0.48);
          ks[14] = vec3( 0.67, -0.48, 0.45);
          ks[15] = vec3(-0.54, -0.58, 0.56);

          float occ = 0.0;
          for (int i = 0; i < 16; i++) {
            if (float(i) >= uSamples) break;
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
          float ao = clamp(1.0 - (occ / max(1.0, uSamples)) * uIntensity * distFade, 0.28, 1.0);
          gl_FragColor = vec4(ao, ao, ao, 1.0);
        }
      `
    });

    aoCompMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: null },
        tAO: { value: null },
        tDepth: { value: null },
        uTexel: { value: new THREE.Vector2(1 / 480, 1 / internalH) },
        uBlur: { value: 1.0 }
      },
      vertexShader: fsVert,
      fragmentShader: `
        uniform sampler2D tColor;
        uniform sampler2D tAO;
        uniform sampler2D tDepth;
        uniform vec2 uTexel;
        uniform float uBlur;
        varying vec2 vUv;

        void main() {
          vec4 col = texture2D(tColor, vUv);
          float dC = texture2D(tDepth, vUv).x;
          if (dC >= 0.9999) { gl_FragColor = col; return; }

          float ao = texture2D(tAO, vUv).r;
          if (uBlur > 0.5) {
            float wSum = 1.0;
            float aoSum = ao;
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
            ao = aoSum / wSum;
          }
          gl_FragColor = vec4(col.rgb * ao, col.a);
        }
      `
    });

    aoQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ssaoMat);
    aoQuad.frustumCulled = false;
    aoScene.add(aoQuad);
  }

  /* ---------------- Culling estrito por FOV (+5° por lado, não mutável) ---------------- */
  const FOV_CULL_MARGIN_DEG = 5;
  const _cullCam = new THREE.PerspectiveCamera(75, 16 / 9, 0.25, 520);
  const _cullProjScreenMatrix = new THREE.Matrix4();
  const _cullInvMat = new THREE.Matrix4();
  const _cullFrustum = new THREE.Frustum();
  const _cullSphere = new THREE.Sphere();
  const _cullBox = new THREE.Box3();
  const _cullVec = new V3();
  const _hiddenForFov = [];

  function updateCullFrustum() {
    const deg2rad = Math.PI / 180;
    const vHalf = (camera.fov * 0.5) * deg2rad;
    const aspect = Math.max(0.01, camera.aspect || (16 / 9));
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const padRad = FOV_CULL_MARGIN_DEG * deg2rad;
    const targetVHalf = Math.min(87 * deg2rad, vHalf + padRad);
    const targetHHalf = Math.min(87 * deg2rad, hHalf + padRad);
    const vFromH = Math.atan(Math.tan(targetHHalf) / aspect);
    const cullFov = (Math.max(targetVHalf, vFromH) * 2) / deg2rad;

    _cullCam.fov = cullFov;
    _cullCam.aspect = aspect;
    _cullCam.near = camera.near;
    _cullCam.far = camera.far;
    _cullCam.updateProjectionMatrix();

    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    _cullProjScreenMatrix.multiplyMatrices(_cullCam.projectionMatrix, camera.matrixWorldInverse);
    _cullFrustum.setFromProjectionMatrix(_cullProjScreenMatrix);
  }

  function isObjInFovFrustum(obj) {
    if (obj.isMesh && obj.geometry) {
      if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
      obj.updateMatrixWorld(false);
      _cullSphere.copy(obj.geometry.boundingSphere).applyMatrix4(obj.matrixWorld);
      return _cullFrustum.intersectsSphere(_cullSphere);
    }
    let cs = obj.userData && obj.userData._cullSphere;
    if (!cs) {
      obj.updateMatrixWorld(true);
      _cullBox.setFromObject(obj);
      if (_cullBox.isEmpty()) {
        cs = { lx: 0, ly: 0, lz: 0, r: 1.5 };
      } else {
        _cullBox.getBoundingSphere(_cullSphere);
        _cullInvMat.copy(obj.matrixWorld).invert();
        _cullVec.copy(_cullSphere.center).applyMatrix4(_cullInvMat);
        const maxS = Math.max(Math.abs(obj.scale.x), Math.abs(obj.scale.y), Math.abs(obj.scale.z), 0.001);
        cs = { lx: _cullVec.x, ly: _cullVec.y, lz: _cullVec.z, r: (_cullSphere.radius / maxS) + 0.75 };
      }
      if (!obj.userData) obj.userData = {};
      obj.userData._cullSphere = cs;
    } else if (cs.lx === 0 && cs.lz === 0) {
      const p = obj.position, s = obj.scale;
      const maxS = Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z), 0.001);
      _cullSphere.center.set(p.x, p.y + cs.ly * s.y, p.z);
      _cullSphere.radius = cs.r * maxS;
      return _cullFrustum.intersectsSphere(_cullSphere);
    } else {
      obj.updateMatrixWorld(false);
    }
    _cullSphere.center.set(cs.lx, cs.ly, cs.lz).applyMatrix4(obj.matrixWorld);
    const maxS = Math.max(Math.abs(obj.scale.x), Math.abs(obj.scale.y), Math.abs(obj.scale.z), 0.001);
    _cullSphere.radius = cs.r * maxS;
    return _cullFrustum.intersectsSphere(_cullSphere);
  }

  function ensureChunkCullBox(ch) {
    if (ch._cullBox && ch._cullStaticCount === ch.objects.length) return ch._cullBox;
    const box = ch._cullBox || new THREE.Box3();
    box.makeEmpty();
    ch.group.updateMatrixWorld(true);
    for (let i = 0; i < ch.objects.length; i++) {
      _cullBox.setFromObject(ch.objects[i]);
      if (!_cullBox.isEmpty()) box.union(_cullBox);
    }
    if (box.isEmpty()) {
      const x0 = ch.cx * World.CHUNK_SIZE;
      const z0 = ch.cz * World.CHUNK_SIZE;
      box.min.set(x0, -20, z0);
      box.max.set(x0 + World.CHUNK_SIZE, 40, z0 + World.CHUNK_SIZE);
    } else {
      box.expandByScalar(0.5);
    }
    ch._cullBox = box;
    ch._cullStaticCount = ch.objects.length;
    return box;
  }

  function applyFovCulling() {
    _hiddenForFov.length = 0;
    updateCullFrustum();

    // Culling por Chunk (16x16m): descarta blocos inteiros fora do FOV em O(chunks);
    // os meshes internos do chunk visível usam o frustum culling nativo do Three.js sem duplicar trabalho em JS.
    for (const ch of World.chunks.values()) {
      if (!ch.active || !ch.group || !ch.group.visible) continue;
      const cbox = ensureChunkCullBox(ch);
      if (!_cullFrustum.intersectsBox(cbox)) {
        ch.group.visible = false;
        _hiddenForFov.push(ch.group);
      }
    }

    // Entidades dinâmicas agrupadas (inimigos, camponeses, pickups, corpses) na raiz da cena
    const sKids = scene.children;
    const wGroup = World.group;
    for (let i = 0; i < sKids.length; i++) {
      const obj = sKids[i];
      if (!obj.visible || obj.isMesh || !obj.frustumCulled || obj === sky || obj === wGroup || obj.isLight) continue;
      if (!isObjInFovFrustum(obj)) {
        obj.visible = false;
        _hiddenForFov.push(obj);
      }
    }
  }

  function restoreFovCulling() {
    for (let i = 0; i < _hiddenForFov.length; i++) {
      _hiddenForFov[i].visible = true;
    }
    _hiddenForFov.length = 0;
  }

  function renderScene() {
    applyFovCulling();
    try {
      if (!hasDepthTex || !ssaoEnabled || !sceneRT || !aoRT) {
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(scene, camera);
        return;
      }
      renderer.setRenderTarget(sceneRT);
      renderer.clear();
      renderer.render(scene, camera);
    } finally {
      restoreFovCulling();
    }

    ssaoMat.uniforms.uProj.value.copy(camera.projectionMatrix);
    ssaoMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
    aoQuad.material = ssaoMat;
    renderer.setRenderTarget(aoRT);
    renderer.render(aoScene, aoCam);

    aoQuad.material = aoCompMat;
    renderer.setRenderTarget(null);
    renderer.render(aoScene, aoCam);
  }

  let psxJitterMode = 'normal';
  function updatePsxRes(iw, ih) {
    if (psxJitterMode === 'off') PSX_RES.value.set(65536, 65536);
    else if (psxJitterMode === 'soft') PSX_RES.value.set(Math.max(iw, 720), Math.max(ih, 405));
    else if (psxJitterMode === 'extreme') PSX_RES.value.set(192, 108);
    else PSX_RES.value.set(Math.min(iw, 480), Math.min(ih, 270));
  }
  function resize() {
    const W = window.innerWidth, H = window.innerHeight;
    const ih = internalH, iw = Math.max(1, Math.round(ih * W / H));
    renderer.setSize(iw, ih, false);
    camera.aspect = iw / ih; camera.updateProjectionMatrix();
    vmCam.aspect = iw / ih; vmCam.updateProjectionMatrix();
    updatePsxRes(iw, ih);
    if (hasDepthTex && ssaoEnabled) {
      ensureSSAO(iw, ih);
    }
  }
  function setInternalHeight(h) {
    const n = Math.round(Number(h));
    if (!Number.isFinite(n) || n < 100 || n > 1440) return;
    if (internalH !== n) { internalH = n; resize(); }
  }
  function setPsxJitter(mode) {
    psxJitterMode = mode || 'normal';
    const W = window.innerWidth, H = window.innerHeight;
    const ih = internalH, iw = Math.max(1, Math.round(ih * W / H));
    updatePsxRes(iw, ih);
  }
  function setPixelatedCanvas(on) {
    renderer.domElement.style.imageRendering = on ? 'pixelated' : 'auto';
  }
  function setSSAO(q) {
    ssaoQuality = q || 'off';
    if (!q || q === 'off') {
      ssaoEnabled = false;
      disposeSSAO();
      return;
    }
    ssaoEnabled = true;
    if (!hasDepthTex || !ssaoMat || !aoCompMat) return;
    const W = window.innerWidth, H = window.innerHeight;
    const ih = internalH, iw = Math.max(1, Math.round(ih * W / H));
    ensureSSAO(iw, ih);
    if (q === 'low') {
      ssaoMat.uniforms.uSamples.value = 4.0;
      ssaoMat.uniforms.uIntensity.value = 1.05;
      ssaoMat.uniforms.uRadius.value = 0.78;
      aoCompMat.uniforms.uBlur.value = 0.0;
    } else if (q === 'med') {
      ssaoMat.uniforms.uSamples.value = 8.0;
      ssaoMat.uniforms.uIntensity.value = 1.22;
      ssaoMat.uniforms.uRadius.value = 0.88;
      aoCompMat.uniforms.uBlur.value = 1.0;
    } else if (q === 'ultra') {
      ssaoMat.uniforms.uSamples.value = 16.0;
      ssaoMat.uniforms.uIntensity.value = 1.52;
      ssaoMat.uniforms.uRadius.value = 1.12;
      aoCompMat.uniforms.uBlur.value = 1.0;
    } else {
      ssaoMat.uniforms.uSamples.value = 12.0;
      ssaoMat.uniforms.uIntensity.value = 1.35;
      ssaoMat.uniforms.uRadius.value = 0.95;
      aoCompMat.uniforms.uBlur.value = 1.0;
    }
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------------- estado ---------------- */
  const P = {
    pos: new V3(0, 0, 6), vel: new V3(), yaw: 0, pitch: 0, r: 0.7, eye: 2.08,
    hp: 200, maxhp: 200, armor: 0, maxarmor: 100, faith: 0, faithMode: 0, onGround: true,
    dashT: 0, dashCd: 0, dashDir: new V3(), bob: 0, lastStep: 0, shake: 0, hurtFlash: 0, healFlash: 0,
    dead: false, god: false, rocks: 0, blood: 0, hand: 0,
    fistCombo: 0, fistComboT: 0, fistUpper: false,
    scytheStep: 0, demoStep: 0, comboResetT: 0, crossCatchT: 0,
    swingT: 0, swingDur: 0.3, swapT: 0, pending: null, locked: false, fovKick: 0,
    kickT: 0, kickDur: 0.36, kickCd: 0, kickPending: null,
    slamming: false, slamCd: 0, slamJumpT: 0, slamJumpBufT: 0, wasJumpDown: false,
    grabbed: null, grabT: 0, ramHitSet: null, fireCd: 0
  };
  const S = {
    started: false, paused: true, difficulty: 2, time: 0, kills: 0, style: 0, ended: false,
    bloodLiters: 0, levelBloodLiters: 0, levelBloodExpected: 1, completedBloodSum: 0, completedMapsCount: 0,
    hitCombo: 0, hitComboT: 0, hitPopT: 0, levelMaxCombo: 0, killCombo: 0, killComboT: 0, styleT: 0, stylePopT: 0, lastStyleRankIdx: -1,
    killFeed: [],
    checkpoint: { x: 0, z: 6, yaw: 0 }, stage: 'a1', objRoom: null, objText: '',
    boss: null, quipCd: 0, cross: { state: 'held', hand: 1, pos: new V3(), dir: new V3(), t: 0, hitT: new Map() },
    env: 'hell', msgT: 0, baphT: 0, promptOn: false, cutscene: 0, rip: false, faithReady: false
  };
  const DIFFICULTIES = [
    { id: 0, label: 'Dificuldade 0 - Melzinho na Chupeta', short: 'Melzinho na Chupeta', spawnMul: 0.5,  dmgMul: 0.35, desc: 'Para passear pelo inferno sem suar a camisa.' },
    { id: 1, label: 'Dificuldade 1 - Fácil',               short: 'Fácil',               spawnMul: 0.75, dmgMul: 0.65, desc: 'Menos demônios e golpes mais brandos.' },
    { id: 2, label: 'Dificuldade 2 - Normal',              short: 'Normal',              spawnMul: 1.0,  dmgMul: 1.0,  desc: 'A experiência padrão de PARAINFERNÁLIA.' },
    { id: 3, label: 'Dificuldade 3 - Difícil',             short: 'Difícil',             spawnMul: 1.35, dmgMul: 1.4,  desc: 'Hordas maiores e demônios mais letais.' },
    { id: 4, label: 'Dificuldade 4 - Muito Difícil',       short: 'Muito Difícil',       spawnMul: 1.75, dmgMul: 1.85, desc: 'Chuva de demônios e dano implacável.' },
    { id: 5, label: 'Dificuldade 5 - PARAINFERNÁLIA!!!',   short: 'PARAINFERNÁLIA!!!',   spawnMul: 2.25, dmgMul: 2.5,  desc: 'Carnificina máxima. Só os abençoados sobrevivem.' }
  ];
  function getDifficulty() {
    const raw = S.difficulty == null ? 2 : parseInt(S.difficulty, 10);
    const idx = clamp(Number.isNaN(raw) ? 2 : raw, 0, DIFFICULTIES.length - 1);
    return DIFFICULTIES[idx];
  }
  const keys = {};
  let mouseL = false;

  const WEAPONS = [
    { id: 'fists',  vm: 'fists',  name: 'PUNHOS',               short: 'PUNHOS',  owned: true,  melee: true, range: 3.6, dmg: 16, cd: 0.30, cos: 0.5,  knock: 6, dur: 0.22, hitAt: 0.08, sfx: 'punch' },
    { id: 'hammer', vm: 'hammer', name: 'MARTELO DE OBRAS',     short: 'MARTELO', owned: true,  melee: true, range: 4.8, dmg: 36, cd: 0.62, cos: 0.2, knock: 9, dur: 0.42, hitAt: 0.18, sfx: 'hammer' },
    { id: 'sling',  vm: 'sling',  name: 'ESTILINGUE',           short: 'ESTIL.',  owned: false, ammo: 'rocks', cd: 0.48, dmg: 24, dur: 0.25 },
    { id: 'scythe', vm: 'scythe', name: 'FOICE',                short: 'FOICE',   owned: false, melee: true, range: 6.0, dmg: 30, cd: 0.72, cos: -0.25, knock: 6, dur: 0.5, hitAt: 0.2, sfx: 'scythe', sweep: true },
    { id: 'demo',   vm: 'demo',   name: 'MARTELO DE DEMOLIÇÃO', short: 'DEMOL.',  owned: false, cd: 1.5, dmg: 120, dur: 0.85, hitAt: 0.42, aoe: 6.5 },
    { id: 'cross',  vm: 'cross',  name: 'SACRA CRUZ PAPAL',     short: 'CRUZ',    owned: false, cd: 0.25, dmg: 34, dur: 0.3 },
    { id: 'heart',  vm: 'heart',  name: 'CORAÇÃO ATEU',         short: 'CORAÇÃO', owned: false, ammo: 'blood', cd: 0.15, dmg: 13, dur: 0.12 }
  ];
  let curW = 1;
  const wcd = {}; // cooldown por arma
  WEAPONS.forEach(w => wcd[w.id] = 0);
  const AMMO_MAX = { rocks: 80, blood: 100 };

  /* ---------------- sistema de litros de sangue & combos de estilo ---------------- */
  const WEAPON_BLOOD = {
    fists: 1.00,
    hammer: 1.22,
    sling: 0.75,
    brick: 1.08,
    scythe: 1.42,
    demo: 1.52,
    cross: 1.18,
    heart: 1.32,
    kick: 1.12,
    slam: 1.28,
    ram: 1.20,
    parry: 1.36,
    glory: 1.62
  };
  const KILL_TYPE_LABELS = {
    fists: 'SOCO',
    hammer: 'MARRETADA',
    sling: 'PEDRADA',
    brick: 'TIJOLADA',
    scythe: 'FOICE',
    demo: 'DEMOLIÇÃO',
    cross: 'CRUZ PAPAL',
    heart: 'CORAÇÃO ATEU',
    kick: 'CHUTE',
    slam: 'ESMAGAMENTO',
    ram: 'ATROPELO',
    parry: 'PARRY',
    glory: 'EXECUÇÃO',
    decap: 'DECAPITAÇÃO',
    rip: 'RASGADO',
    impale: 'EMPALADO'
  };
  const MAP_BLOOD_ROOMS = {
    a1: ['a1'],
    a2: ['a2'],
    a3: ['a3'],
    a4: ['a4'],
    a5: ['a5'],
    a6_gate: ['a6_gate', 'a6_maximus'],
    a6_nave: ['a6_nave', 'a6_galius2'],
    a6_crypt: ['a6_crypt1', 'a6_crypt2', 'a6_crypt3']
  };
  function enemyBloodWeight(typeOrObj) {
    const T = typeof typeOrObj === 'string' ? ETYPES[typeOrObj] : (typeOrObj && typeOrObj.T ? typeOrObj.T : typeOrObj);
    if (!T || T.immortal) return 0;
    if (T.model === 'galius') return 5.0;
    if (T.model === 'maximus') return 3.2;
    if (T.model === 'demonio') return 1.75;
    if (T.model === 'guarda') return 1.45;
    if (T.model === 'padre' || T.model === 'gargula') return 1.2;
    return 1.0;
  }
  function computeMapBloodExpected(mapId, roomOverride) {
    let rooms = MAP_BLOOD_ROOMS[mapId] || [mapId];
    if (roomOverride === 'a6_galius2') rooms = ['a6_galius2'];
    else if (roomOverride === 'a6_crypt2') rooms = ['a6_crypt2', 'a6_crypt3'];
    else if (roomOverride === 'a6_crypt3') rooms = ['a6_crypt3'];
    const spawnMul = getDifficulty().spawnMul;
    let totalW = 0;
    for (let r = 0; r < rooms.length; r++) {
      const list = (typeof SPAWNS !== 'undefined' && SPAWNS[rooms[r]]) ? SPAWNS[rooms[r]] : [];
      const bosses = [];
      const regulars = [];
      for (let i = 0; i < list.length; i++) {
        const sp = list[i];
        const T = ETYPES[sp[0]];
        if (!T || T.immortal) continue;
        if (T.boss) bosses.push(sp);
        else regulars.push(sp);
      }
      for (let i = 0; i < bosses.length; i++) totalW += enemyBloodWeight(bosses[i][0]);
      if (regulars.length > 0) {
        let acc = 0, spawned = 0;
        for (let i = 0; i < regulars.length; i++) {
          acc += spawnMul;
          const count = Math.floor(acc + 1e-9);
          acc -= count;
          for (let k = 0; k < count; k++) {
            totalW += enemyBloodWeight(regulars[i][0]);
            spawned++;
          }
        }
        if (spawned === 0) totalW += enemyBloodWeight(regulars[0][0]);
      }
    }
    S.levelBloodExpected = Math.max(1, totalW);
    return S.levelBloodExpected;
  }
  function addBloodLiters(liters) {
    if (!liters || liters <= 0 || !Number.isFinite(liters)) return;
    S.levelBloodLiters = (S.levelBloodLiters || 0) + liters;
    S.bloodLiters = (S.bloodLiters || 0) + liters;
  }
  function awardEnemyHitBlood(e, dmgDealt, weaponId, part) {
    if (!e || !e.T || e.T.immortal) return;
    const w = enemyBloodWeight(e);
    if (w <= 0) return;
    const maxhp = Math.max(1, e.maxhp || 1);
    const prev = e._bloodDmgCredited || 0;
    const rem = Math.max(0, maxhp - prev);
    const eff = Math.min(rem, Math.max(0, dmgDealt || 0));
    if (eff <= 0) return;
    e._bloodDmgCredited = prev + eff;
    const basePerUnit = 840 / Math.max(1, S.levelBloodExpected || 1);
    const weapMul = WEAPON_BLOOD[weaponId] || 1.0;
    const partMul = part === 'head' ? 1.25 : 1.0;
    addBloodLiters(basePerUnit * w * 0.35 * (eff / maxhp) * weapMul * partMul);
  }
  function awardEnemyKillBlood(e, ko) {
    if (!e || !e.T || e.T.immortal || e._bloodKillCredited) return;
    e._bloodKillCredited = true;
    const w = enemyBloodWeight(e);
    if (w <= 0) return;
    const maxhp = Math.max(1, e.maxhp || 1);
    const prevRatio = clamp((e._bloodDmgCredited || 0) / maxhp, 0, 1);
    const uncreditedDmgShare = (1 - prevRatio) * 0.35;
    const basePerUnit = 840 / Math.max(1, S.levelBloodExpected || 1);
    const weapKey = (ko && ko.glory) ? 'glory' : ((ko && ko.weapon) || e._lastHitWeapon || (WEAPONS[curW] ? WEAPONS[curW].id : 'fists'));
    const weapMul = WEAPON_BLOOD[weapKey] || 1.0;
    const finishMul = (ko && (ko.decapitated || ko.glory)) ? 1.18 : 1.0;
    const comboMul = 1 + Math.min(0.18, Math.max(0, (S.hitCombo || 1) - 1) * 0.015);
    addBloodLiters(basePerUnit * w * (0.65 + uncreditedDmgShare) * weapMul * finishMul * comboMul);
  }
  const STYLE_TIMER_DUR = 5.0;
  function addStyle(pts, cap) {
    if (!pts || pts <= 0) return;
    S.style = Math.min(cap || 480, (S.style || 0) + pts);
    S.styleT = STYLE_TIMER_DUR;
  }
  function registerStyleHit(weaponId, part, styleBonus) {
    S.hitCombo = (S.hitCombo || 0) + 1;
    if (S.hitCombo > (S.levelMaxCombo || 0)) S.levelMaxCombo = S.hitCombo;
    S.hitComboT = STYLE_TIMER_DUR;
    S.hitPopT = 0.24;
    const add = (styleBonus != null ? styleBonus : 6) + (part === 'head' ? 6 : 0) + Math.min(8, S.hitCombo * 0.45);
    addStyle(add);
  }
  function resolveKillLabel(ko, e) {
    if (ko && ko.killLabel) return ko.killLabel;
    if (ko && ko.glory) {
      if (ko.glory === 'rip') return KILL_TYPE_LABELS.rip;
      if (ko.glory === 'decap') return KILL_TYPE_LABELS.decap;
      if (ko.glory === 'impale') return KILL_TYPE_LABELS.impale;
      if (ko.glory === 'hammer') return KILL_TYPE_LABELS.hammer;
      if (ko.glory === 'kick') return KILL_TYPE_LABELS.kick;
      return KILL_TYPE_LABELS.glory;
    }
    if (ko && ko.decapitated) return KILL_TYPE_LABELS.decap;
    const wk = (ko && ko.weapon) || (e && e._lastHitWeapon) || (WEAPONS[curW] ? WEAPONS[curW].id : 'fists');
    return KILL_TYPE_LABELS[wk] || 'CHACINA';
  }
  function registerStyleKill(e, ko) {
    S.killCombo = (S.killCombo || 0) + 1;
    S.killComboT = STYLE_TIMER_DUR;
    S.hitCombo = (S.hitCombo || 0) + 1;
    if (S.hitCombo > (S.levelMaxCombo || 0)) S.levelMaxCombo = S.hitCombo;
    S.hitComboT = STYLE_TIMER_DUR;
    S.styleT = STYLE_TIMER_DUR;
    S.hitPopT = 0.42;
    const label = resolveKillLabel(ko, e);
    const isSpecial = !!(ko && (ko.glory || ko.decapitated || ko.weapon === 'parry' || ko.weapon === 'demo'));
    if (!Array.isArray(S.killFeed)) S.killFeed = [];
    S.killFeed.unshift({ label, isSpecial, t: 5.0, maxT: 5.0, id: ++registerStyleKill._seq });
    if (S.killFeed.length > 5) S.killFeed.length = 5;
    awardEnemyKillBlood(e, ko);
  }
  registerStyleKill._seq = 0;

  /* ---------------- colisão + plataformas (altura Y) ---------------- */
  const _colTmp = [];
  function groundAt(x, z, y, r) {
    const pit = World.altar && World.altar.pit;
    let gy = (World.altar && World.altar.open && pit && x > pit.x1 && x < pit.x2 && z > pit.z1 && z < pit.z2) ? -3.5 : getGroundY(x, z);
    const rad = (r || 0.7) * 0.85;
    const cs = World.queryColliders ? World.queryColliders(x - rad, z - rad, x + rad, z + rad, _colTmp) : World.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c.active || !c.walkable || c.yMax == null) continue;
      if (x + rad > c.x1 && x - rad < c.x2 && z + rad > c.z1 && z - rad < c.z2) {
        if (y >= c.yMax - 0.45 && c.yMax > gy) gy = c.yMax;
      }
    }
    return gy;
  }
  function resolveCircle(pos, r, y, h) {
    const py = y != null ? y : (pos.y || 0);
    const eh = h != null ? h : 3.35;
    const cs = World.queryColliders
      ? World.queryColliders(pos.x - r - 1, pos.z - r - 1, pos.x + r + 1, pos.z + r + 1, _colTmp)
      : World.colliders;
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        if (!c.active) continue;
        if (c.yMax != null && py >= c.yMax - 0.35) continue;
        if (c.y0 != null && py + eh <= c.y0 + 0.12) continue;
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
  function ceilingAt(x, z, y, prevY, r, h) {
    const rad = (r || 0.7) * 0.85;
    const eh = h != null ? h : 3.35;
    const py0 = prevY != null ? prevY : y;
    const cs = World.queryColliders ? World.queryColliders(x - rad, z - rad, x + rad, z + rad, _colTmp) : World.colliders;
    let ceilY = Infinity;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c.active || c.y0 == null) continue;
      if (x + rad > c.x1 && x - rad < c.x2 && z + rad > c.z1 && z - rad < c.z2) {
        if (c.y0 >= py0 + eh - 0.35 && y + eh > c.y0 && c.y0 < ceilY) {
          ceilY = c.y0;
        }
      }
    }
    return ceilY;
  }
  function pointInWall(x, z, y) {
    const cs = World.queryColliders ? World.queryColliders(x, z, x, z, _colTmp) : World.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c.active) continue;
      if (y != null) {
        if (c.y0 != null && y < c.y0) continue;
        if (c.yMax != null && y > c.yMax) continue;
      } else if (c.overhead) {
        continue;
      }
      if (x > c.x1 && x < c.x2 && z > c.z1 && z < c.z2) return true;
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
    if (!World.colliderGrid || !World.colliderGrid.size) {
      const cs = World.colliders;
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        if (c.active && !c.overhead && segHitsBox(ax, az, bx, bz, c)) return false;
      }
      return true;
    }
    const dyn = World.dynamicColliders;
    for (let i = 0; i < dyn.length; i++) {
      const c = dyn[i];
      if (c.active && !c.overhead && segHitsBox(ax, az, bx, bz, c)) return false;
    }
    const CS = World.CHUNK_SIZE || 16;
    const stamp = ++World._queryStamp;
    let cx = Math.floor(ax / CS), cz = Math.floor(az / CS);
    const endCx = Math.floor(bx / CS), endCz = Math.floor(bz / CS);
    const dx = bx - ax, dz = bz - az;
    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = Math.abs(dx) > 1e-8 ? CS / Math.abs(dx) : 1e9;
    const tDeltaZ = Math.abs(dz) > 1e-8 ? CS / Math.abs(dz) : 1e9;
    let tMaxX = Math.abs(dx) > 1e-8 ? ((dx > 0 ? (cx + 1) * CS - ax : ax - cx * CS) / Math.abs(dx)) : 1e9;
    let tMaxZ = Math.abs(dz) > 1e-8 ? ((dz > 0 ? (cz + 1) * CS - az : az - cz * CS) / Math.abs(dz)) : 1e9;

    for (let steps = 0; steps < 128; steps++) {
      const bucket = World.colliderGrid.get(cx + ',' + cz);
      if (bucket) {
        for (let i = 0; i < bucket.length; i++) {
          const c = bucket[i];
          if (c._qStamp !== stamp) {
            c._qStamp = stamp;
            if (c.active && !c.overhead && segHitsBox(ax, az, bx, bz, c)) return false;
          }
        }
      }
      if (cx === endCx && cz === endCz) break;
      if (tMaxX < tMaxZ) { tMaxX += tDeltaX; cx += stepX; }
      else { tMaxZ += tDeltaZ; cz += stepZ; }
    }
    return true;
  }
  function clipCameraRay(ax, ay, az, bx, by, bz, pad, out) {
    const p = pad != null ? pad : 0.4;
    const yp = Math.min(p, 0.28);
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const minX = Math.min(ax, bx) - p, maxX = Math.max(ax, bx) + p;
    const minZ = Math.min(az, bz) - p, maxZ = Math.max(az, bz) + p;
    const cs = World.queryColliders
      ? World.queryColliders(minX, minZ, maxX, maxZ, _colTmp)
      : World.colliders;
    let bestT = 1;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c.active) continue;
      const cy0 = c.y0 != null ? c.y0 : -1e9;
      const cy1 = c.yMax != null ? c.yMax : 1e9;

      let t0 = 0, t1 = bestT;
      const x1 = c.x1 - p, x2 = c.x2 + p;
      if (Math.abs(dx) < 1e-8) { if (ax < x1 || ax > x2) continue; }
      else {
        let a = (x1 - ax) / dx, b = (x2 - ax) / dx;
        if (a > b) { const tmp = a; a = b; b = tmp; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) continue;
      }
      const y1 = cy0 - yp, y2 = cy1 + yp;
      if (Math.abs(dy) < 1e-8) { if (ay < y1 || ay > y2) continue; }
      else {
        let a = (y1 - ay) / dy, b = (y2 - ay) / dy;
        if (a > b) { const tmp = a; a = b; b = tmp; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) continue;
      }
      const z1 = c.z1 - p, z2 = c.z2 + p;
      if (Math.abs(dz) < 1e-8) { if (az < z1 || az > z2) continue; }
      else {
        let a = (z1 - az) / dz, b = (z2 - az) / dz;
        if (a > b) { const tmp = a; a = b; b = tmp; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) continue;
      }

      if (t0 > 0) {
        bestT = t0;
      } else {
        let u0 = 0, u1 = bestT;
        if (Math.abs(dx) < 1e-8) { if (ax < c.x1 || ax > c.x2) continue; }
        else {
          let a = (c.x1 - ax) / dx, b = (c.x2 - ax) / dx;
          if (a > b) { const tmp = a; a = b; b = tmp; }
          u0 = Math.max(u0, a); u1 = Math.min(u1, b);
          if (u0 > u1) continue;
        }
        if (Math.abs(dy) < 1e-8) { if (ay < cy0 || ay > cy1) continue; }
        else {
          let a = (cy0 - ay) / dy, b = (cy1 - ay) / dy;
          if (a > b) { const tmp = a; a = b; b = tmp; }
          u0 = Math.max(u0, a); u1 = Math.min(u1, b);
          if (u0 > u1) continue;
        }
        if (Math.abs(dz) < 1e-8) { if (az < c.z1 || az > c.z2) continue; }
        else {
          let a = (c.z1 - az) / dz, b = (c.z2 - az) / dz;
          if (a > b) { const tmp = a; a = b; b = tmp; }
          u0 = Math.max(u0, a); u1 = Math.min(u1, b);
          if (u0 > u1) continue;
        }
        const len = Math.hypot(dx, dy, dz);
        const back = len > 1e-5 ? p / len : 0;
        bestT = Math.max(0, u0 - back);
      }
    }
    if (out) {
      out.x = ax + dx * bestT;
      out.y = ay + dy * bestT;
      out.z = az + dz * bestT;
    }
    return bestT;
  }

  /* ---------------- partículas / gore (InstancedMesh + Pooling) ---------------- */
  const parts = [], gibs = [], decals = [], corpses = [];
  const MAX_CORPSES = 45;
  function addCorpsePart(g, opts) {
    opts = opts || {};
    while (corpses.length >= MAX_CORPSES) {
      const old = corpses.shift();
      scene.remove(old.g);
    }
    g.visible = true;
    scene.add(g);
    const c = {
      g,
      vx: opts.vx || 0, vy: opts.vy || 0, vz: opts.vz || 0,
      rvx: opts.rvx || 0, rvy: opts.rvy || 0, rvz: opts.rvz || 0,
      grav: opts.grav != null ? opts.grav : 24,
      floorOff: opts.floorOff != null ? opts.floorOff : 0.25,
      rad: opts.rad || 0.45,
      age: 0,
      bounces: 0,
      settled: false,
      dripT: 0,
      trail: !!opts.trail,
      hitEnemies: !!opts.hitEnemies,
      lay: !!opts.lay, layX: opts.layX || 0, layZ: opts.layZ || 0,
      inRender: true
    };
    corpses.push(c);
    return c;
  }
  const partPool = [], gibPool = [], decalPool = [];
  const PGEO = new THREE.BoxGeometry(1, 1, 1);
  let maxParticles = 2040;
  let particleScale = 1.0;
  let goreQualityMul = 1.0;
  let dismemberEnabled = true;
  let bleedJointsEnabled = true;
  let gibDripsEnabled = true;
  let blobShadowsEnabled = true;
  let enemyCullDist = 480;
  let goreDuration = 20;
  let goreImpact = 0.55;
  const GORE_Q_MAP = { min: 0, very_low: 0.2, low: 0.45, med: 0.75, high: 1.0, very_high: 1.5, ultra: 2.2 };

  const _imMat4 = new THREE.Matrix4();
  const _imPos = new THREE.Vector3();
  const _imQuat = new THREE.Quaternion();
  const _imScale = new THREE.Vector3();
  const _imEuler = new THREE.Euler();
  const _imTarget = new THREE.Vector3();
  const _imUp = new THREE.Vector3(0, 1, 0);
  const _imCol = new THREE.Color();
  const _imLookMat = new THREE.Matrix4();

  function makeIM(mat, cap) {
    const im = new THREE.InstancedMesh(PGEO, mat, cap);
    im.frustumCulled = false;
    im.count = 0;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.setColorAt(0, _imCol.setHex(0xffffff));
    scene.add(im);
    return im;
  }
  const partBasicIM = makeIM(psx(new THREE.MeshBasicMaterial({ color: 0xffffff })), 6600);
  const partLitIM = makeIM(psx(new THREE.MeshLambertMaterial({ color: 0xffffff })), 6600);
  const gibIM = makeIM(psx(new THREE.MeshLambertMaterial({ color: 0xffffff })), 2800);
  let decalIMCap = 4096;
  const decalMat = psx(new THREE.MeshLambertMaterial({
    color: 0xffffff,
    polygonOffset: true,
    polygonOffsetFactor: -12,
    polygonOffsetUnits: -12,
    depthWrite: false
  }));
  let decalIM = makeIM(decalMat, decalIMCap);
  decalIM.renderOrder = 5;
  let decalsDirty = true;
  let gibsDirty = true;
  function uploadIM(im, count) {
    im.count = count;
    if (count > 0) {
      im.instanceMatrix.updateRange.offset = 0;
      im.instanceMatrix.updateRange.count = count * 16;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) {
        im.instanceColor.updateRange.offset = 0;
        im.instanceColor.updateRange.count = count * 3;
        im.instanceColor.needsUpdate = true;
      }
    }
  }

  function ensureDecalIMCapacity(needed) {
    if (needed <= decalIMCap) return;
    while (decalIMCap < needed) decalIMCap = Math.min(78000, decalIMCap * 2);
    scene.remove(decalIM);
    decalIM.dispose();
    decalIM = makeIM(decalMat, decalIMCap);
    decalIM.renderOrder = 5;
  }
  function swapRemove(arr, i, pool) {
    const o = arr[i];
    const last = arr.length - 1;
    if (i !== last) arr[i] = arr[last];
    arr.pop();
    if (pool) pool.push(o);
    return o;
  }

  function setGoreDuration(sec) {
    const n = Number(sec);
    goreDuration = (!Number.isFinite(n) || n >= 61 || n <= 0) ? Infinity : Math.max(1, n);
  }
  function setGoreImpact(v) {
    const n = Number(v);
    goreImpact = Number.isFinite(n) ? clamp(n, 0, 1) : 0.55;
  }
  function setParticleScale(v) {
    const n = Number(v);
    particleScale = Number.isFinite(n) ? clamp(n, 0.1, 2.5) : 1.0;
    maxParticles = Math.round(clamp(2040 * particleScale, 150, 6600));
    while (parts.length > maxParticles) swapRemove(parts, 0, partPool);
    syncRealBloodCap();
  }
  function setGoreQuality(q) {
    goreQualityMul = GORE_Q_MAP[q] != null ? GORE_Q_MAP[q] : 1.0;
    syncRealBloodCap();
    if (goreQualityMul <= 0) {
      while (gibs.length) gibPool.push(gibs.pop());
      while (decals.length) decalPool.push(decals.pop());
      gibIM.count = 0;
      decalIM.count = 0;
      if (RB) { RB.stainBegin(); RB.stainEnd(); RB.clearMap(); }
      decalsDirty = true;
      gibsDirty = true;
    }
  }
  function setDismember(on) { dismemberEnabled = !!on; }
  function setBleedJoints(on) { bleedJointsEnabled = !!on; }
  function setGibDrips(on) { gibDripsEnabled = !!on; }
  function setEnemyCullDist(d) { enemyCullDist = Math.max(45, Number(d) || 480); }
  function getBloodDuration() {
    if (goreDuration === Infinity) return Infinity;
    // Sangue permanece no chão bem mais tempo que o gore sólido, escalado pelo slider GORE / IMPACTO
    return goreDuration * (3 + goreImpact * 17);
  }
  let decalLayer = 0;
  const DECAL_UP = new V3(0, 1, 0);
  const _decalNrm = new V3();
  const _decalYawQ = new THREE.Quaternion();
  const BLOOD_COLS = [0xd80818, 0xa80610, 0x7a040a, 0x520206];
  const _tmpV = new V3(); // usado pelo sangramento contínuo das junções (updateEnemy)
  const GIB_COLS = [0x820c14, 0x5c060c, 0x420408, 0xd8ccb8];

  function removeMeshFromParent(m) {
    if (m && m.parent) m.parent.remove(m);
  }

  function evictDecalsFor() {
    const baseMax = goreDuration === Infinity
      ? Math.round((4500 + goreImpact * 6500) * 3)
      : Math.round((3000 + goreImpact * 5000) * 3);
    const maxD = Math.max(15, Math.round(baseMax * goreQualityMul));
    while (decals.length >= maxD) {
      let idx = -1;
      for (let i = 0; i < decals.length; i++) {
        if (decals[i].inRender) { idx = i; break; }
      }
      if (idx < 0) idx = 0;
      swapRemove(decals, idx, decalPool);
    }
  }

  /* ---- Sangue Realista: superfície onde o sangue pousa (terreno, pisos e topos de caixas/muros) ---- */
  const _bloodColTmp = [];
  function bloodSurfaceY(x, z, y) {
    const pit = World.altar && World.altar.pit;
    let gy = (World.altar && World.altar.open && pit && x > pit.x1 && x < pit.x2 && z > pit.z1 && z < pit.z2) ? -3.5 : getGroundY(x, z);
    if (y == null) y = gy + 0.3;
    const cs = World.queryColliders ? World.queryColliders(x, z, x, z, _bloodColTmp) : World.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c.active || c.yMax == null) continue;
      if (x >= c.x1 && x <= c.x2 && z >= c.z1 && z <= c.z2 && y >= c.yMax - 0.45 && c.yMax > gy) gy = c.yMax;
    }
    return gy;
  }
  // ponto dentro de um muro/caixa mais alto que a poça (a mancha é cortada ali)
  function bloodBlockedAt(x, z, y) {
    const cs = World.queryColliders ? World.queryColliders(x, z, x, z, _bloodColTmp) : World.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c.active) continue;
      if (x > c.x1 && x < c.x2 && z > c.z1 && z < c.z2 && (c.yMax == null || c.yMax > y + 0.3)) return true;
    }
    return false;
  }
  /** Mancha inteligente do Sangue Realista: forma orgânica, orientada pelo impacto e moldada ao chão. */
  function spawnRealStain(x, z, size, dirX, dirZ, speed, yHint) {
    if (goreQualityMul <= 0 || !RB) return;
    evictDecalsFor();
    const impScale = 0.7 + goreImpact * 0.55;
    const sz = Math.min(3.2, size * impScale * rnd(0.85, 1.3) * 1.35);
    const ch = World.getChunkAt(x, z);
    const d = decalPool.length ? decalPool.pop() : {};
    d.real = true;
    RB.prepareStain(d, x, z, sz, dirX, dirZ, speed || 0, yHint, bloodSurfaceY, bloodBlockedAt);
    if (RB.inMap(x, z)) RB.splat(d);   // poça no mapa de sangue (funde e escorre)
    d.age = 0;
    d.chunk = ch;
    d.inRender = ch ? ch.active : World.isPosInRender(x, z);
    decals.push(d);
    decalsDirty = true;
    gibsDirty = true;
  }

  function spawnBloodDecal(x, z, size) {
    if (goreQualityMul <= 0) return;
    if (realBloodOn()) { spawnRealStain(x, z, size, 0, 0, 0); return; }
    evictDecalsFor();
    const impScale = 0.7 + goreImpact * 0.55;
    const sx = size * impScale * rnd(0.8, 1.35), sz = size * impScale * rnd(0.8, 1.35);
    const gy = getGroundY(x, z);
    const eps = 0.4;
    const gx = getGroundY(x - eps, z) - getGroundY(x + eps, z);
    const gz = getGroundY(x, z - eps) - getGroundY(x, z + eps);
    _decalNrm.set(gx, 2 * eps, gz).normalize();
    _imQuat.setFromUnitVectors(DECAL_UP, _decalNrm);
    _decalYawQ.setFromAxisAngle(DECAL_UP, rnd(0, Math.PI * 2));
    _imQuat.multiply(_decalYawQ);
    const hr = Math.min(2.0, Math.max(sx, sz) * 0.5);
    const nySafe = Math.max(0.25, _decalNrm.y);
    let extraLift = 0;
    for (let cx = -1; cx <= 1; cx += 2) {
      for (let cz = -1; cz <= 1; cz += 2) {
        const dx = cx * hr, dz = cz * hr;
        const planeY = gy - (_decalNrm.x * dx + _decalNrm.z * dz) / nySafe;
        const diff = getGroundY(x + dx, z + dz) - planeY;
        if (diff > extraLift) extraLift = diff;
      }
    }
    if (extraLift > 0.35) extraLift = 0.35;
    decalLayer = (decalLayer + 1) % 12;
    const lift = 0.09 + extraLift + decalLayer * 0.002;
    const px = x + _decalNrm.x * lift;
    const py = gy + _decalNrm.y * lift;
    const pz = z + _decalNrm.z * lift;
    const ch = World.getChunkAt(px, pz);
    const inRender = ch ? ch.active : World.isPosInRender(px, pz);
    const d = decalPool.length ? decalPool.pop() : {};
    d.real = false;
    d.x = px; d.y = py; d.z = pz;
    d.qx = _imQuat.x; d.qy = _imQuat.y; d.qz = _imQuat.z; d.qw = _imQuat.w;
    d.sx = sx; d.sz = sz;
    d.age = 0;
    d.colHex = BLOOD_COLS[(Math.random() * 3) | 0];
    d.chunk = ch;
    d.inRender = inRender;
    decals.push(d);
    decalsDirty = true;
    gibsDirty = true;
  }

  function pushPart(x, y, z, vx, vy, vz, sx, sy, sz, life, g, colHex, basic, type, pSz) {
    if (parts.length >= maxParticles) swapRemove(parts, 0, partPool);
    const p = partPool.length ? partPool.pop() : {};
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.sx = sx; p.sy = sy; p.sz = sz;
    p.life = life; p.g = g;
    p.colHex = colHex; p.basic = basic;
    p.type = type; p.pSz = pSz;
    parts.push(p);
    return p;
  }

  /* ---- Sangue Realista: milhares de gotículas instanciadas (js/realblood.js) ---- */
  const RB = window.RealBlood || null;
  let bloodMode = 'simple';
  function realBloodOn() { return bloodMode === 'realistic' && RB !== null; }
  function syncRealBloodCap() {
    if (!RB) return;
    // volume máximo de gotas vivas segue Qualidade de Gore × Multiplicador de Partículas
    RB.setCapacity(27000 * Math.max(0.25, goreQualityMul) * particleScale);
  }
  function setBloodMode(m) {
    bloodMode = m === 'realistic' ? 'realistic' : 'simple';
    if (RB) { syncRealBloodCap(); RB.setEnabled(bloodMode === 'realistic'); }
  }
  if (RB) {
    RB.init({
      scene, camera,
      renderer,
      groundAt: bloodSurfaceY,
      terrainAt: (x, z) => {
        const pit = World.altar && World.altar.pit;
        return (World.altar && World.altar.open && pit && x > pit.x1 && x < pit.x2 && z > pit.z1 && z < pit.z2) ? -3.5 : getGroundY(x, z);
      },
      forEachStain: (fn) => { for (let i = 0; i < decals.length; i++) if (decals[i].real) fn(decals[i]); },
      onStain: (x, z, size, dx, dz, spd, y) => spawnRealStain(x, z, size, dx, dz, spd, y)
    });
  }
  const _rbEnv = { light: 1, pxSize: 0.005 };
  let _rbMapVersion = -1;
  if (RB) RB.bloodLifetime = () => getBloodDuration();
  const _rbPlayerHit = {
    x: 0, y: 0, z: 0, r: 0.7, h: 3.15,
    onHit: (relY, rad) => {
      if (!window.BloodStain || P.dead) return;
      const w = WEAPONS[curW];
      const wId = (relY > 0.9 && w) ? w.id : null;
      BloodStain.addBlood(0.025 + rad * 0.6, wId, wId ? 0.02 + rad * 0.5 : 0);
    }
  };
  function updateRealBlood(dt) {
    // luz da cena (pesando o vermelho) e tamanho de 1 pixel interno a 1 m
    const lum = (c) => c.r * 0.6 + c.g * 0.3 + c.b * 0.1;
    _rbEnv.light = clamp((lum(amb.color) * amb.intensity + lum(sun.color) * sun.intensity * 0.6) * 1.05, 0.45, 1.35);
    _rbEnv.pxSize = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, renderer.domElement.height);
    _rbPlayerHit.x = P.pos.x; _rbPlayerHit.y = P.pos.y; _rbPlayerHit.z = P.pos.z; _rbPlayerHit.r = P.r;
    RB.update(dt, _rbEnv, P.dead ? null : _rbPlayerHit);
  }
  // Gotejamento de pedaços/membros
  function bloodDrip(x, y, z, vx, vy, vz, dsz, life, col) {
    if (realBloodOn()) { RB.drip(x, y, z, vx, vy, vz); return; }
    for (let i = 0; i < 3; i++) {
      pushPart(x + rnd(-0.04, 0.04), y, z + rnd(-0.04, 0.04), vx + rnd(-0.3, 0.3), vy, vz + rnd(-0.3, 0.3), dsz, dsz, dsz, life, 24, col, false, 'blood', dsz);
    }
  }

  function burst(x, y, z, color, n, spd, life, size, grav, basic) {
    if (!World.isPosInRender(x, z)) return;
    const count = Math.max(1, Math.round(n * particleScale));
    const isBasic = basic !== false;
    const gVal = grav == null ? 18 : grav;
    for (let i = 0; i < count; i++) {
      const sc = size * rnd(0.5, 1.3);
      pushPart(
        x, y, z,
        rnd(-1, 1) * spd, rnd(-0.1, 1.1) * spd, rnd(-1, 1) * spd,
        sc, sc, sc,
        life * rnd(0.6, 1.2), gVal, color, isBasic, null, sc
      );
    }
  }
  World.onFlameEmber = (x, y, z, s) => {
    const sc = s || 1;
    const spread = 0.25 * sc;
    const sz = Math.min(0.18, 0.075 + sc * 0.022);
    const spd = Math.min(2.8, 1.0 + sc * 0.35);
    const life = Math.min(1.4, 0.65 + sc * 0.18);
    const col = Math.random() < 0.4 ? 0xff5a10 : (Math.random() < 0.6 ? 0xff9a20 : 0xffe060);
    burst(x + rnd(-spread, spread), y, z + rnd(-spread, spread), col, 1, spd, life, sz, -4.2, true);
  };

  function bloodSpurt(x, y, z, dx, dz, power, n, upBoost) {
    let lx = dx || 0, lz = dz || 0;
    const len = Math.hypot(lx, lz);
    if (len > 0.001) { lx /= len; lz /= len; }
    else { const a = rnd(0, Math.PI * 2); lx = Math.cos(a); lz = Math.sin(a); }
    const effScale = Math.max(0.15, goreQualityMul) * particleScale;
    if (realBloodOn()) {
      if (World.isPosInRender(x, z)) RB.spurt(x, y, z, lx, lz, power, n, upBoost || 2.5, (0.5 + goreImpact * 0.9) * effScale);
      return;
    }
    const count = Math.max(1, Math.round(n * (0.5 + goreImpact * 0.9) * effScale * 3));
    for (let i = 0; i < count; i++) {
      const col = BLOOD_COLS[(Math.random() * BLOOD_COLS.length) | 0];
      const sz = rnd(0.08, 0.19);
      const sp = power * rnd(0.45, 1.35);
      const spread = 0.55;
      const vx = (lx + rnd(-spread, spread)) * sp;
      const vz = (lz + rnd(-spread, spread)) * sp;
      const vy = rnd(0.15, 1.0) * sp * 0.65 + (upBoost || 2.5);
      pushPart(
        x + rnd(-0.12, 0.12), y + rnd(-0.12, 0.12), z + rnd(-0.12, 0.12),
        vx, vy, vz,
        sz, sz, sz * 1.8,
        rnd(0.6, 1.3), 24, col, false, 'blood', sz
      );
    }
  }

  function evictOldestGib(maxG) {
    while (gibs.length >= maxG) {
      let idx = -1;
      for (let i = 0; i < gibs.length; i++) {
        if (gibs[i].inRender) { idx = i; break; }
      }
      if (idx < 0) idx = 0;
      swapRemove(gibs, idx, gibPool);
      gibsDirty = true;
    }
  }

  function pushGib(x, y, z, vx, vy, vz, rvx, rvy, rvz, sx, sy, sz, colHex, inRender) {
    const g = gibPool.length ? gibPool.pop() : {};
    g.x = x; g.y = y; g.z = z;
    g.vx = vx; g.vy = vy; g.vz = vz;
    g.rx = 0; g.ry = 0; g.rz = 0;
    g.rvx = rvx; g.rvy = rvy; g.rvz = rvz;
    g.sx = sx; g.sy = sy; g.sz0 = sz; g.sz = Math.max(sx, sz);
    g.colHex = colHex;
    g.inRender = inRender;
    g.age = 0; g.g = 24; g.dripT = 0; g.bounces = 0;
    g.settled = false;
    gibs.push(g);
    gibsDirty = true;
  }

  function spawnGore(x, y, z, h, kx, kz, isBig) {
    if (goreQualityMul <= 0) {
      bloodSpurt(x, y + h * 0.55, z, kx, kz, 9, 4, 3.5);
      return;
    }
    const scale = isBig ? 1.5 : 1;
    // No Sangue Realista as manchas nascem quando as gotas caem no chão, não instantaneamente
    if (!realBloodOn()) {
      spawnBloodDecal(x, z, 1.25 * scale);
      const splashN = Math.max(1, Math.round((isBig ? 6 : 3) * Math.min(1.6, goreQualityMul) * 3));
      for (let i = 0; i < splashN; i++) {
        spawnBloodDecal(x + rnd(-1.4, 1.4) * scale, z + rnd(-1.4, 1.4) * scale, rnd(0.45, 1.05) * scale);
      }
    }
    bloodSpurt(x, y + h * 0.55, z, kx, kz, isBig ? 14 : 11, isBig ? 42 : 24, 5.5);
    bloodSpurt(x, y + h * 0.65, z, -kx * 0.4, -kz * 0.4, isBig ? 10 : 7, isBig ? 22 : 12, 7.0);

    const gibN = Math.max(1, Math.round((isBig ? 24 : 10) * goreQualityMul));
    const maxG = Math.max(10, Math.round((goreDuration === Infinity ? 1200 : 600) * goreQualityMul));
    for (let i = 0; i < gibN; i++) {
      evictOldestGib(maxG);
      const isBone = i % 5 === 4;
      const col = isBone ? GIB_COLS[3] : GIB_COLS[(Math.random() * 3) | 0];
      const sx = (isBone ? rnd(0.1, 0.16) : rnd(0.18, 0.36)) * scale;
      const sy = (isBone ? rnd(0.1, 0.16) : rnd(0.14, 0.30)) * scale;
      const sz = (isBone ? rnd(0.32, 0.55) : rnd(0.18, 0.38)) * scale;
      const px = x + rnd(-0.25, 0.25), py = y + h * rnd(0.35, 0.8), pz = z + rnd(-0.25, 0.25);
      const inR = World.isPosInRender(px, pz);
      const sp = rnd(5, 13) * (isBig ? 1.2 : 1);
      const a = rnd(0, Math.PI * 2);
      const vx = Math.cos(a) * sp * 0.75 + (kx || 0) * rnd(3, 7);
      const vz = Math.sin(a) * sp * 0.75 + (kz || 0) * rnd(3, 7);
      const vy = rnd(3.5, 9.5) * (isBig ? 1.15 : 1);
      pushGib(px, py, pz, vx, vy, vz, rnd(-14, 14), rnd(-14, 14), rnd(-14, 14), sx, sy, sz, col, inR);
    }
  }

  function updateParts(dt) {
    let basicCount = 0;
    let litCount = 0;
    const damp = 1 - Math.min(0.4, dt * 0.9);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (!World.isPosInRender(p.x, p.z)) {
        if (p.type === 'blood') spawnBloodDecal(p.x, p.z, p.pSz * rnd(2.0, 3.4));
        swapRemove(parts, i, partPool);
        continue;
      }
      p.life -= dt;
      p.vy -= p.g * dt;
      if (p.type === 'blood') {
        p.vx *= damp; p.vy *= damp; p.vz *= damp;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (window.BloodStain && !P.dead && p.y >= P.pos.y + 0.45 && p.y <= P.pos.y + 3.15) {
          const dx = p.x - P.pos.x, dz = p.z - P.pos.z;
          if (dx * dx + dz * dz < (P.r + 0.25) * (P.r + 0.25)) {
            const w = WEAPONS[curW];
            const wId = (p.y - P.pos.y > 0.9 && w) ? w.id : null;
            BloodStain.addBlood(0.035, wId, wId ? 0.028 : 0);
            swapRemove(parts, i, partPool);
            continue;
          }
        }
        const spd = Math.hypot(p.vx, p.vy, p.vz);
        if (p.y <= getGroundY(p.x, p.z) + 0.04) {
          spawnBloodDecal(p.x, p.z, p.pSz * rnd(2.0, 3.6));
          swapRemove(parts, i, partPool);
          continue;
        }
        if (p.life <= 0) { swapRemove(parts, i, partPool); continue; }
        _imPos.set(p.x, p.y, p.z);
        if (spd > 0.5) {
          _imTarget.set(p.x + p.vx, p.y + p.vy, p.z + p.vz);
          _imLookMat.lookAt(_imPos, _imTarget, _imUp);
          _imQuat.setFromRotationMatrix(_imLookMat);
          _imScale.set(p.pSz, p.pSz, Math.min(0.95, Math.max(p.pSz, spd * 0.045)));
        } else {
          _imQuat.set(0, 0, 0, 1);
          _imScale.set(p.sx, p.sy, p.sz);
        }
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const gy = getGroundY(p.x, p.z);
        if (p.y < gy + 0.05) { p.y = gy + 0.05; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
        if (p.life <= 0) { swapRemove(parts, i, partPool); continue; }
        _imPos.set(p.x, p.y, p.z);
        _imQuat.set(0, 0, 0, 1);
        _imScale.set(p.sx, p.sy, p.sz);
      }

      _imMat4.compose(_imPos, _imQuat, _imScale);
      if (p.basic) {
        if (basicCount < 6600) {
          partBasicIM.setMatrixAt(basicCount, _imMat4);
          partBasicIM.setColorAt(basicCount, _imCol.setHex(p.colHex));
          basicCount++;
        }
      } else {
        if (litCount < 6600) {
          partLitIM.setMatrixAt(litCount, _imMat4);
          partLitIM.setColorAt(litCount, _imCol.setHex(p.colHex));
          litCount++;
        }
      }
    }
    uploadIM(partBasicIM, basicCount);
    uploadIM(partLitIM, litCount);
    if (realBloodOn() && S.started) updateRealBlood(dt);

    const dur = goreDuration;
    const fadeWindow = dur === Infinity ? 0 : Math.min(1.5, dur * 0.3);
    let gibsFading = false;
    for (let i = gibs.length - 1; i >= 0; i--) {
      const p = gibs[i];
      const inR = World.isPosInRender(p.x, p.z);
      if (inR !== p.inRender) { p.inRender = inR; gibsDirty = true; }
      if (!inR) continue;

      p.age += dt;
      if (!p.settled) {
        const gy = getGroundY(p.x, p.z);
        if (p.y > gy + 0.07 || p.vy > 0 || p.vx * p.vx + p.vz * p.vz > 0.01) {
          p.vy -= p.g * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.rx += p.rvx * dt; p.ry += p.rvy * dt; p.rz += p.rvz * dt;
          gibsDirty = true;
          p.dripT -= dt;
          if (gibDripsEnabled && goreQualityMul >= 0.4 && p.dripT <= 0 && (p.vx * p.vx + p.vy * p.vy + p.vz * p.vz) > 14) {
            p.dripT = 0.045;
            if (parts.length < maxParticles) {
              const dsz = rnd(0.06, 0.11);
              bloodDrip(p.x, p.y, p.z, p.vx * 0.25 + rnd(-1, 1), p.vy * 0.2, p.vz * 0.25 + rnd(-1, 1), dsz, 0.7, BLOOD_COLS[1]);
            }
          }
          const gy2 = getGroundY(p.x, p.z);
          if (p.y < gy2 + 0.07) {
            p.y = gy2 + 0.07;
            if (p.vy < -2.2) {
              spawnBloodDecal(p.x, p.z, p.sz * rnd(1.3, 2.2));
              p.bounces++;
              if (p.bounces <= 2) bloodSpurt(p.x, gy2 + 0.12, p.z, p.vx, p.vz, 3.5, 3, 1.5);
            }
            p.vy *= -0.4; p.vx *= 0.65; p.vz *= 0.65;
            p.rvx *= 0.55; p.rvy *= 0.55; p.rvz *= 0.55;
            if (Math.abs(p.vy) < 0.4) p.vy = 0;
            if (p.vy === 0 && (p.vx * p.vx + p.vz * p.vz) < 0.01) p.settled = true;
          }
        } else {
          p.settled = true;
        }
      }
      if (dur !== Infinity) {
        const rem = dur - p.age;
        if (rem <= 0) { swapRemove(gibs, i, gibPool); gibsDirty = true; continue; }
        if (rem < fadeWindow) gibsFading = true;
      }
    }
    if (gibsDirty || gibsFading) {
      gibsDirty = false;
      let gibCount = 0;
      for (let i = 0; i < gibs.length; i++) {
        const p = gibs[i];
        if (!p.inRender) continue;
        let k = 1;
        if (dur !== Infinity) {
          const rem = dur - p.age;
          if (rem < fadeWindow) k = Math.max(0.01, rem / fadeWindow);
        }
        if (gibCount < 2800) {
          _imPos.set(p.x, p.y, p.z);
          _imQuat.setFromEuler(_imEuler.set(p.rx, p.ry, p.rz));
          _imScale.set(p.sx * k, p.sy * k, p.sz0 * k);
          _imMat4.compose(_imPos, _imQuat, _imScale);
          gibIM.setMatrixAt(gibCount, _imMat4);
          gibIM.setColorAt(gibCount, _imCol.setHex(p.colHex));
          gibCount++;
        }
      }
      uploadIM(gibIM, gibCount);
    }

    const bloodDur = getBloodDuration();
    if (RB && RB.mapVersion() !== _rbMapVersion) { _rbMapVersion = RB.mapVersion(); decalsDirty = true; }
    const bloodFadeWindow = bloodDur === Infinity ? 0 : Math.min(3.0, bloodDur * 0.15);
    let anyFading = false;
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i];
      const inR = d.chunk ? d.chunk.active : World.isPosInRender(d.x, d.z);
      if (inR !== d.inRender) { d.inRender = inR; decalsDirty = true; }
      if (!inR) continue;
      d.age += dt;
      if (bloodDur !== Infinity) {
        const rem = bloodDur - d.age;
        if (rem <= 0) { swapRemove(decals, i, decalPool); decalsDirty = true; continue; }
        if (rem < bloodFadeWindow) anyFading = true;
      }
    }
    if (decalsDirty || anyFading) {
      decalsDirty = false;
      ensureDecalIMCapacity(decals.length);
      let dCount = 0;
      if (RB) RB.stainBegin();
      for (let i = 0; i < decals.length; i++) {
        const d = decals[i];
        if (!d.inRender) continue;
        let k = 1;
        if (bloodDur !== Infinity) {
          const rem = bloodDur - d.age;
          if (rem < bloodFadeWindow) k = Math.max(0.01, rem / bloodFadeWindow);
        }
        // Sangue Realista: dentro do mapa a poça é desenhada pelo mapa de sangue;
        // fora dele (longe do jogador) a mancha individual assume
        if (d.real) { if (RB && !RB.inMap(d.x, d.z)) RB.stainPush(d, k); continue; }
        _imPos.set(d.x, d.y, d.z);
        _imQuat.set(d.qx, d.qy, d.qz, d.qw);
        _imScale.set(d.sx * k, 0.016, d.sz * k);
        _imMat4.compose(_imPos, _imQuat, _imScale);
        decalIM.setMatrixAt(dCount, _imMat4);
        decalIM.setColorAt(dCount, _imCol.setHex(d.colHex));
        dCount++;
      }
      uploadIM(decalIM, dCount);
      if (RB) RB.stainEnd();
    }
    // Atualiza corpos/partes em ragdoll (Glory Kills)
    for (let i = corpses.length - 1; i >= 0; i--) {
      const c = corpses[i];
      const gp = c.g.position;
      c.inRender = World.isPosInRender(gp.x, gp.z);
      c.g.visible = c.inRender;
      if (!c.inRender) continue;
      c.age += dt;
      if (dur !== Infinity) {
        const rem = dur - c.age;
        if (rem <= 0) { scene.remove(c.g); corpses.splice(i, 1); continue; }
        if (rem < fadeWindow) c.g.scale.setScalar(Math.max(0.02, rem / fadeWindow));
      }
      if (!c.settled) {
        c.vy -= c.grav * dt;
        gp.x += c.vx * dt; gp.y += c.vy * dt; gp.z += c.vz * dt;
        c.g.rotation.x += c.rvx * dt;
        c.g.rotation.y += c.rvy * dt;
        c.g.rotation.z += c.rvz * dt;
        if (c.hitEnemies && (c.vx * c.vx + c.vz * c.vz) > 64) {
          for (let j = 0; j < enemies.length; j++) {
            const o = enemies[j];
            if (!o || o.dead || !o.inRender) continue;
            const ox = o.g.position.x - gp.x, oz = o.g.position.z - gp.z;
            const md = c.rad + o.r + 0.35;
            if (Math.abs(ox) < md && Math.abs(oz) < md && Math.hypot(ox, oz) < md && Math.abs(o.g.position.y + o.h * 0.5 - gp.y) < o.h) {
              const l = Math.hypot(c.vx, c.vz) || 1;
              dmgEnemy(o, 45, c.vx / l, c.vz / l, { knock: 12, stunBonus: 0.5, weapon: 'ram' });
              c.vx *= 0.5; c.vz *= 0.5; c.hitEnemies = false;
              break;
            }
          }
        }
        if (pointInWall(gp.x, gp.z, gp.y)) {
          resolveCircle(gp, c.rad);
          c.vx *= -0.42; c.vz *= -0.42;
          c.rvx *= 0.6; c.rvz *= 0.6;
          bloodSpurt(gp.x, gp.y, gp.z, c.vx, c.vz, 5, 6, 2.0);
        }
        c.dripT -= dt;
        if ((c.trail || gibDripsEnabled) && goreQualityMul >= 0.4 && c.dripT <= 0 && (c.vx * c.vx + c.vy * c.vy + c.vz * c.vz) > 12) {
          c.dripT = 0.045;
          if (parts.length < maxParticles) {
            const dsz = rnd(0.07, 0.13);
            bloodDrip(gp.x, gp.y, gp.z, c.vx * 0.2 + rnd(-1, 1), c.vy * 0.15, c.vz * 0.2 + rnd(-1, 1), dsz, 0.75, BLOOD_COLS[0]);
          }
        }
        const gy = getGroundY(gp.x, gp.z);
        if (gp.y <= gy + c.floorOff) {
          gp.y = gy + c.floorOff;
          if (c.vy < -2.2) {
            spawnBloodDecal(gp.x, gp.z, c.rad * rnd(1.4, 2.2));
            c.bounces++;
            if (c.bounces <= 2) bloodSpurt(gp.x, gy + 0.14, gp.z, c.vx, c.vz, 4.5, 4, 1.8);
          }
          c.vy *= -0.32; c.vx *= 0.56; c.vz *= 0.56;
          c.rvx *= 0.4; c.rvy *= 0.4; c.rvz *= 0.4;
          if (Math.abs(c.vy) < 0.6) c.vy = 0;
          let layDone = true;
          if (c.lay) {
            const rt = c.g.rotation, lk = Math.min(1, dt * 9);
            rt.x = c.layX + Math.atan2(Math.sin(rt.x - c.layX), Math.cos(rt.x - c.layX));
            rt.z = c.layZ + Math.atan2(Math.sin(rt.z - c.layZ), Math.cos(rt.z - c.layZ));
            rt.x += (c.layX - rt.x) * lk; rt.z += (c.layZ - rt.z) * lk;
            c.rvx = 0; c.rvz = 0;
            layDone = Math.abs(rt.x - c.layX) < 0.03 && Math.abs(rt.z - c.layZ) < 0.03;
          }
          if (layDone && c.vy === 0 && (c.vx * c.vx + c.vz * c.vz) < 0.15) {
            c.vx = 0; c.vz = 0; c.rvx = 0; c.rvy = 0; c.rvz = 0; c.settled = true;
          }
        }
      }
    }
  }
  function clearParts() {
    while (corpses.length) { const c = corpses.pop(); scene.remove(c.g); }
    while (parts.length) partPool.push(parts.pop());
    if (RB) RB.clear();
    while (gibs.length) gibPool.push(gibs.pop());
    while (decals.length) decalPool.push(decals.pop());
    partBasicIM.count = 0;
    partLitIM.count = 0;
    gibIM.count = 0;
    decalIM.count = 0;
    if (RB) { RB.stainBegin(); RB.stainEnd(); RB.clearMap(); }
    decalsDirty = true;
    gibsDirty = true;
  }

  /* ---------------- anéis de choque ---------------- */
  const rings = [];
  const RING_GEO = new THREE.RingGeometry(0.9, 1.0, 28);
  function spawnRing(x, z, maxR, speed, dmg, color, owner) {
    const gy = getGroundY(x, z);
    const m = new THREE.Mesh(RING_GEO, MT(color || 0xff5020, { basic: true, tr: 0.7, add: true, dbl: true }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, gy + 0.2, z);
    scene.add(m);
    rings.push({ x, z, y: gy, r: 1, max: maxR, speed, dmg, m, hit: false, owner });
  }
  function updateRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const q = rings[i];
      q.r += q.speed * dt;
      q.m.scale.setScalar(q.r);
      q.m.visible = World.isPosInRender(q.x, q.z);
      if (q.owner === 'e' && !q.hit && !P.dead) {
        const d = Math.hypot(P.pos.x - q.x, P.pos.z - q.z);
        if (Math.abs(d - q.r) < 1.6 && P.pos.y < q.y + 1.2) { q.hit = true; hurtPlayer(q.dmg, q.x, q.z, 14); }
      }
      if (q.r >= q.max) { scene.remove(q.m); rings.splice(i, 1); }
    }
  }

  /* ---------------- projéteis ---------------- */
  const projs = [];
  const _projLookTgt = new V3();
  function spawnProj(kind, pos, vel, dmg, owner, r, life, grav) {
    let m;
    if (kind === 'rock') m = new THREE.Mesh(BX(0.28, 0.28, 0.28), MT(0x9a9aa0));
    else if (kind === 'boulder') m = new THREE.Mesh(BX(0.46, 0.46, 0.46), MT(0xc4b078));
    else if (kind === 'brick') m = new THREE.Mesh(BX(0.32, 0.2, 0.48), MT(0xb84a28));
    else if (kind === 'blood') m = new THREE.Mesh(BX(0.26, 0.26, 0.5), MT(0xff1a2a, { basic: true }));
    else if (kind === 'fire') m = new THREE.Mesh(BX(0.4, 0.4, 0.4), MT(0xff7a10, { basic: true }));
    else m = new THREE.Mesh(BX(0.5, 0.5, 0.5), MT(0xcc44ff, { basic: true }));
    m.position.copy(pos);
    if (kind === 'blood' || kind === 'brick') m.lookAt(_projLookTgt.copy(pos).add(vel));
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
      if (p.life <= 0 || !World.isPosInRender(p.m.position.x, p.m.position.z)) { killProj(i, false); continue; }
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
        if (pp.y < gy + 0.1 || pp.y > gy + 45 || pointInWall(pp.x, pp.z, pp.y)) { killProj(i, true); dead = true; break; }
        if (p.owner === 'e') {
          const pdx = pp.x - P.pos.x, pdy = pp.y - (P.pos.y + 1.2), pdz = pp.z - P.pos.z;
          const pHitR = p.r + 0.8;
          if (!P.dead && (pdx * pdx + pdy * pdy + pdz * pdz) < pHitR * pHitR) {
            hurtPlayer(p.dmg, pp.x - p.v.x, pp.z - p.v.z, 4);
            killProj(i, true); dead = true; break;
          }
          for (const cp of peasants) {
            if (cp.dead || !cp.inRender) continue;
            const cpp = cp.g.position;
            if (pp.y >= cpp.y - 0.1 && pp.y <= cpp.y + cp.h + 0.25 && Math.hypot(pp.x - cpp.x, pp.z - cpp.z) < cp.r + p.r) {
              hitPeasant(cp, pp.x - p.v.x, pp.z - p.v.z);
              killProj(i, true); dead = true; break;
            }
          }
          if (dead) break;
        } else {
          for (const e of enemies) {
            if (e.dead || e.downed || !e.inRender) continue;
            const ep = e.g.position;
            if (pp.y < ep.y - 0.2 || pp.y > ep.y + e.h + 0.35) continue;
            if (Math.hypot(pp.x - ep.x, pp.z - ep.z) < e.r + p.r + 0.35) {
              const hitPart = findHitPart(e, pp, p.r);
              const l = Math.hypot(p.v.x, p.v.z) || 1;
              const knock = p.parried ? 10 : (p.kind === 'boulder' || p.kind === 'brick') ? 8 : (p.kind === 'rock' ? 4 : 1.5);
              const projWeapon = p.parried ? 'parry' : (p.kind === 'brick' ? 'brick' : (p.kind === 'blood' ? 'heart' : 'sling'));
              dmgEnemy(e, p.dmg, p.v.x / l, p.v.z / l, { knock, stunBonus: (p.kind === 'boulder' || p.parried) ? 0.55 : 0, part: hitPart, hitPos: pp, weapon: projWeapon });
              killProj(i, true); dead = true; break;
            }
          }
          if (!dead) {
            for (const cp of peasants) {
              if (cp.dead || !cp.inRender) continue;
              const cpp = cp.g.position;
              if (pp.y >= cpp.y - 0.15 && pp.y <= cpp.y + cp.h + 0.35 && Math.hypot(pp.x - cpp.x, pp.z - cpp.z) < cp.r + p.r + 0.3) {
                const power = (p.kind === 'boulder' || p.parried) ? 1.65 : p.kind === 'brick' ? 1.35 : p.kind === 'rock' ? 1.15 : 0.95;
                launchPeasantRagdoll(cp, p.v.x, p.v.z, power);
                killProj(i, true); dead = true; break;
              }
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
    campones: { model: 'campones', hp: 45, hpRange: [45, 70], speed: 3.4, r: 0.6, melee: { range: 1.9, dmg: 9, cd: 1.3, wind: 0.45 }, pts: 10, faith: 4, blood: 6, armsFwd: true, name: 'Camponês Endemoniado' },
    guarda:   { model: 'guarda', hp: 120, hpRange: [110, 150], speed: 4.2, r: 0.75, melee: { range: 2.6, dmg: 16, cd: 1.5, wind: 0.5 }, pts: 25, faith: 8, blood: 10, name: 'Guarda Endemoniado' },
    diabrete: { model: 'diabrete', hp: 28, hpRange: [20, 40], speed: 5, r: 0.5, flying: true, hover: 3, ranged: { proj: 'fire', dmg: 7, cd: 2.2, speed: 17, range: 38 }, pts: 10, faith: 4, blood: 5 },
    gargula:  { model: 'gargula', hp: 85, hpRange: [80, 85], speed: 9, r: 0.7, flying: true, hover: 4, melee: { range: 2.6, dmg: 13, cd: 1.6, wind: 0.3 }, pts: 20, faith: 7, blood: 9, armsFwd: true },
    demonio:  { model: 'demonio', hp: 320, hpRange: [300, 400], speed: 3.8, r: 1.3, melee: { range: 3.4, dmg: 28, cd: 1.8, wind: 0.6 }, charge: { cd: 7, speed: 17, dur: 0.9, dmg: 30, wind: 0.7 }, pts: 50, faith: 18, blood: 20, mass: 2.5 },
    padre:    { model: 'padre', hp: 80, hpRange: [75, 85], speed: 3, r: 0.7, ranged: { proj: 'hex', dmg: 14, cd: 2.8, speed: 11, range: 45 }, keep: 13, pts: 25, faith: 8, blood: 10 },
    maximus:  { model: 'maximus', boss: true, name: 'SÉRGIO MAXIMO · LÍDER DA SUPER-GUARDA REAL', hp: 900, speed: 6.8, r: 1.45, aggro: 90,
                melee: { range: 4.8, dmg: 26, cd: 0.95, wind: 0.28 }, charge: { cd: 5, speed: 24, dur: 0.7, dmg: 36, wind: 0.5 }, pts: 300, faith: 60, blood: 60, mass: 5 },
    galius1:  { model: 'galius', boss: true, name: 'GALIUS · O SUPER-ATEU', hp: 9500, speed: 5.2, r: 3.2, aggro: 120,
                melee: { range: 7.5, dmg: 36, cd: 2.3, wind: 0.8 }, stomp: { cd: 6, dmg: 26 }, pts: 0, faith: 0, blood: 0, mass: 20 },
    galius2:  { model: 'galius', boss: true, name: 'GALIUS · O SUPER-ATEU', hp: 2400, speed: 5.4, r: 3.2, aggro: 120, galius2: true,
                melee: { range: 7.5, dmg: 40, cd: 2.0, wind: 0.75 }, charge: { cd: 8, speed: 22, dur: 0.9, dmg: 45, wind: 0.9 }, stomp: { cd: 5, dmg: 30 }, pts: 0, faith: 0, blood: 0, mass: 20 }
  };
  const enemies = [];

  const _invMat = new THREE.Matrix4();
  const _localPt = new THREE.Vector3();
  const _hitRay = new THREE.Ray();
  const _localRay = new THREE.Ray();
  const _tmpBox = new THREE.Box3();
  const _hitPt = new THREE.Vector3();
  const _partCenter = new THREE.Vector3();
  const PART_ORDER = ['head', 'armL', 'armR', 'legL', 'legR', 'wingL', 'wingR', 'torso'];

  function getBoxSize(mesh, out) {
    if (!mesh || !mesh.geometry) return out.set(0.3, 0.3, 0.3);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    return mesh.geometry.boundingBox.getSize(out);
  }

  function initEnemyLimbs(e) {
    const R = e.rig, T = e.T, hp = e.maxhp || T.hp;
    const limbs = {};
    const sz = new V3();
    if (R.torso) {
      limbs.torso = { node: R.torso, hitMesh: R.torso, hp, maxhp: hp, severed: false };
    }
    if (R.head) {
      getBoxSize(R.head, sz);
      const hHp = Math.max(12, Math.round(hp * (T.boss ? 0.55 : 0.42)));
      limbs.head = {
        node: R.head, hitMesh: R.head, hp: hHp, maxhp: hHp, severed: false,
        jointLocal: new V3(0, R.head.position.y - sz.y * 0.5, 0),
        jointDir: new V3(0, 1, 0),
        stumpSize: Math.max(0.18, Math.min(sz.x, sz.z) * 0.65),
        limbSize: sz.clone()
      };
    }
    const addAppendage = (key, node, hitMesh, hpMult, jDir, speedPenalty, subHitMesh) => {
      if (!node || !hitMesh) return;
      getBoxSize(hitMesh, sz);
      const lHp = Math.max(10, Math.round(hp * hpMult));
      const hitMeshes = [hitMesh];
      if (subHitMesh && subHitMesh !== hitMesh) hitMeshes.push(subHitMesh);
      limbs[key] = {
        node, hitMesh, hitMeshes, hp: lHp, maxhp: lHp, severed: false,
        jointLocal: node.position.clone(),
        jointDir: jDir,
        stumpSize: Math.max(0.14, Math.min(sz.x, sz.z) * 0.85),
        limbSize: sz.clone(),
        speedPenalty
      };
    };
    addAppendage('armL', R.armL, R.armL && (R.armL.userData.mesh || R.armL), T.boss ? 0.35 : 0.30, new V3(-1, 0.25, 0), 0.14, R.armL && R.armL.userData.subMesh);
    addAppendage('armR', R.armR, R.armR && (R.armR.userData.mesh || R.armR), T.boss ? 0.35 : 0.30, new V3(1, 0.25, 0), 0.14, R.armR && R.armR.userData.subMesh);
    addAppendage('legL', R.legL, R.legL && (R.legL.userData.mesh || R.legL), T.boss ? 0.40 : 0.35, new V3(-0.3, -1, 0), 0.28, R.legL && R.legL.userData.subMesh);
    addAppendage('legR', R.legR, R.legR && (R.legR.userData.mesh || R.legR), T.boss ? 0.40 : 0.35, new V3(0.3, -1, 0), 0.28, R.legR && R.legR.userData.subMesh);
    addAppendage('wingL', R.wingL, R.wingL && (R.wingL.children[0] || R.wingL), 0.28, new V3(-1, 0.4, -0.5), 0.24);
    addAppendage('wingR', R.wingR, R.wingR && (R.wingR.children[0] || R.wingR), 0.28, new V3(1, 0.4, -0.5), 0.24);
    e.limbs = limbs;
  }

  function ensureEnemyLimbMatrices(e) {
    const t = S.time || 0;
    if (e._matTime !== t) {
      e._matTime = t;
      e.g.updateMatrixWorld(true);
    }
  }
  function getHitMeshInvMat(hm) {
    const t = S.time || 0;
    const ud = hm.userData || (hm.userData = {});
    if (ud._invTime !== t || !ud._invMat) {
      ud._invTime = t;
      ud._invMat = (ud._invMat || new THREE.Matrix4()).copy(hm.matrixWorld).invert();
    }
    return ud._invMat;
  }

  function findHitPart(e, pt, rad) {
    if (!e.limbs) return 'torso';
    ensureEnemyLimbMatrices(e);
    let best = null, bestD = Infinity, headD = Infinity;
    const thr = (rad || 0.3) + 0.16;
    for (const name of PART_ORDER) {
      const L = e.limbs[name];
      if (!L || L.severed) continue;
      const ms = L.hitMeshes || (L.hitMesh ? [L.hitMesh] : null);
      if (!ms) continue;
      for (let mi = 0; mi < ms.length; mi++) {
        const hm = ms[mi];
        if (!hm || !hm.geometry) continue;
        if (!hm.geometry.boundingBox) hm.geometry.computeBoundingBox();
        _localPt.copy(pt).applyMatrix4(getHitMeshInvMat(hm));
        const d = hm.geometry.boundingBox.distanceToPoint(_localPt);
        if (name === 'head' && d < headD) headD = d;
        if (d <= thr && d < bestD) { bestD = d; best = name; }
      }
    }
    if (headD <= thr + 0.06 && headD <= bestD + 0.12) return 'head';
    return best || 'torso';
  }

  const _bestHitPt = new THREE.Vector3();
  function findHitPartRay(e, origin, dir, pad, opts) {
    const strict = !!(opts && opts.strict);
    const returnInfo = !!(opts && opts.returnInfo);
    if (!e.limbs) return strict ? null : (returnInfo ? { part: 'torso', dist: origin.distanceTo(e.g.position), point: e.g.position.clone() } : 'torso');
    ensureEnemyLimbMatrices(e);
    _hitRay.set(origin, dir);
    const p = pad == null ? 0.16 : pad;
    const headBias = (opts && opts.headBias != null) ? opts.headBias : (strict ? 0 : 0.25);
    let best = null, bestDist = Infinity, headDist = Infinity;
    let headPt = null;
    for (const name of PART_ORDER) {
      const L = e.limbs[name];
      if (!L || L.severed) continue;
      const ms = L.hitMeshes || (L.hitMesh ? [L.hitMesh] : null);
      if (!ms) continue;
      for (let mi = 0; mi < ms.length; mi++) {
        const hm = ms[mi];
        if (!hm || !hm.geometry) continue;
        if (!hm.geometry.boundingBox) hm.geometry.computeBoundingBox();
        _tmpBox.copy(hm.geometry.boundingBox).expandByScalar(p);
        _localRay.copy(_hitRay).applyMatrix4(getHitMeshInvMat(hm));
        if (_localRay.intersectBox(_tmpBox, _hitPt)) {
          _hitPt.applyMatrix4(hm.matrixWorld);
          const d = origin.distanceTo(_hitPt);
          if (name === 'head' && d < headDist) { headDist = d; headPt = _hitPt.clone(); }
          if (d < bestDist) { bestDist = d; best = name; _bestHitPt.copy(_hitPt); }
        }
      }
    }
    if (headBias > 0 && headDist < Infinity && headDist <= bestDist + headBias) {
      return returnInfo ? { part: 'head', dist: headDist, point: headPt } : 'head';
    }
    if (best) {
      return returnInfo ? { part: best, dist: bestDist, point: _bestHitPt.clone() } : best;
    }
    if (strict) return null;
    // Fallback para golpes amplos (ex: foice): parte mais próxima da linha de mira
    let nearPart = 'torso', nearSq = Infinity;
    for (const name of PART_ORDER) {
      const L = e.limbs[name];
      if (!L || L.severed || !L.hitMesh || !L.hitMesh.geometry) continue;
      if (!L.hitMesh.geometry.boundingBox) L.hitMesh.geometry.computeBoundingBox();
      L.hitMesh.geometry.boundingBox.getCenter(_partCenter).applyMatrix4(L.hitMesh.matrixWorld);
      const sq = _hitRay.distanceSqToPoint(_partCenter);
      if (sq < nearSq) { nearSq = sq; nearPart = name; }
    }
    if (returnInfo) {
      const L = e.limbs[nearPart];
      const pt = L && L.hitMesh && L.hitMesh.geometry.boundingBox
        ? L.hitMesh.geometry.boundingBox.getCenter(new V3()).applyMatrix4(L.hitMesh.matrixWorld)
        : e.g.position.clone();
      return { part: nearPart, dist: origin.distanceTo(pt), point: pt };
    }
    return nearPart;
  }

  function spawnSeveredLimbGib(e, L, kx, kz) {
    const wp = L.jointLocal.clone().applyMatrix4(e.g.matrixWorld);
    if (goreQualityMul <= 0) return wp;
    const maxG = Math.max(10, Math.round((goreDuration === Infinity ? 1200 : 600) * goreQualityMul));
    evictOldestGib(maxG);
    const col = (L.hitMesh && L.hitMesh.userData.om && L.hitMesh.userData.om.color) ? L.hitMesh.userData.om.color.getHex() : GIB_COLS[0];
    const ls = L.limbSize || new V3(0.3, 0.5, 0.3);
    const sx = Math.max(0.18, ls.x), sy = Math.max(0.18, ls.y), sz = Math.max(0.18, ls.z);
    const inR = World.isPosInRender(wp.x, wp.z);
    const a = rnd(0, Math.PI * 2);
    const sp = rnd(5, 10);
    pushGib(
      wp.x, wp.y, wp.z,
      Math.cos(a) * sp * 0.5 + (kx || 0) * 6, rnd(5, 9), Math.sin(a) * sp * 0.5 + (kz || 0) * 6,
      rnd(-14, 14), rnd(-14, 14), rnd(-14, 14),
      sx, sy, sz, col, inR
    );
    return wp;
  }

  // Clona um objeto sem copiar userData (tem materiais/ciclos) e sem sombra
  function cloneClean(obj) {
    const saved = [];
    obj.traverse(o => { saved.push([o, o.userData]); o.userData = o.userData && o.userData.isShadow ? { isShadow: true } : {}; });
    const c = obj.clone(true);
    for (const s of saved) s[0].userData = s[1];
    c.traverse(o => { if (o.userData && o.userData.isShadow) o.visible = false; });
    return c;
  }
  // Copia um membro/cabeça do inimigo para um grupo independente no mundo (mantém posição/rotação atuais)
  function makeNodeProp(node) {
    node.updateWorldMatrix(true, false);
    node.updateMatrixWorld(true);
    const g = new THREE.Group();
    node.matrixWorld.decompose(g.position, g.quaternion, g.scale);
    const c = cloneClean(node);
    c.position.set(0, 0, 0); c.quaternion.identity(); c.scale.set(1, 1, 1); c.visible = true;
    g.add(c);
    return g;
  }
  // Adiciona costelas, espinha dorsal, órgãos internos e tripinhas na face cortada do tronco
  function addSplitTorsoAnatomy(root, side, tBox, enemyH, enemyR) {
    let minY = tBox ? tBox.min.y : enemyH * 0.35;
    let maxY = tBox ? tBox.max.y : enemyH * 0.78;
    if (maxY - minY > enemyH * 0.62) {
      // Modelos com túnica longa (ex: padre): restringe a anatomia ao tronco real
      minY = enemyH * 0.30;
      maxY = enemyH * 0.74;
    }
    const th = Math.max(0.38, maxY - minY);
    const td = tBox ? Math.max(0.28, tBox.max.z - tBox.min.z) : Math.max(0.30, enemyR * 0.75);
    const cz = tBox ? (tBox.min.z + tBox.max.z) * 0.5 : 0;
    const tw = tBox ? Math.max(0.32, (tBox.max.x - tBox.min.x) * 0.5) : Math.max(0.36, enemyR * 0.85);
    const anat = new THREE.Group();
    const put = (w, h, d, col, x, y, z, rx, ry, rz) => {
      const m = new THREE.Mesh(BX(w, h, d), MT(col, { basic: false }));
      m.position.set(x, y, z);
      if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
      anat.add(m);
      return m;
    };

    // Cavidade de carne escura no plano do corte
    put(0.04, th * 0.94, td * 0.90, 0x5c0206, side * 0.015, minY + th * 0.50, cz);

    // Espinha dorsal (vértebras + discos de sangue) ao longo das costas
    const spineZ = cz - td * 0.33;
    for (let i = 0; i < 7; i++) {
      const vy = minY + th * (0.07 + i * 0.145);
      const boneCol = i % 2 === 0 ? 0xe8dcc8 : 0xd6c8b0;
      put(0.085, th * 0.08, 0.085, boneCol, side * 0.012, vy, spineZ);
      put(0.036, th * 0.055, 0.055, 0xd0c2aa, 0, vy, spineZ - td * 0.09);
      if (i < 6) put(0.068, th * 0.042, 0.068, 0x7a040a, side * 0.012, vy + th * 0.072, spineZ);
    }

    // Costelas (4 pares curvados saindo da espinha e projetando-se na abertura)
    for (let i = 0; i < 4; i++) {
      const ry = minY + th * (0.48 + i * 0.12);
      const ribReach = Math.min(tw * 0.44, 0.15);
      put(0.048, th * 0.046, td * 0.44, 0xe8dcc8, side * ribReach * 0.85, ry, cz - td * 0.05, 0.14, side * 0.25, 0);
      put(ribReach * 0.95, th * 0.044, 0.052, 0xdfd2bc, side * 0.045, ry - th * 0.035, cz + td * 0.21, 0, 0, -side * 0.16);
    }
    // Fragmento de esterno no topo frontal
    put(0.045, th * 0.18, 0.055, 0xd8cab2, side * 0.015, minY + th * 0.72, cz + td * 0.33);

    // Órgãos internos (pulmão, coração, fígado/estômago)
    put(Math.min(tw * 0.38, 0.14), th * 0.25, td * 0.32, 0xc04054, side * 0.05, minY + th * 0.72, cz + td * 0.03, 0.08, 0, -side * 0.1);
    if (side < 0) {
      put(0.10, th * 0.16, 0.11, 0x8e0814, -0.01, minY + th * 0.65, cz + td * 0.14, 0.12, 0.2, 0.15);
    }
    put(Math.min(tw * 0.40, 0.15), th * 0.16, td * 0.34, 0x6e141c, side * 0.04, minY + th * 0.42, cz + td * 0.06, -0.1, 0, 0);

    // Tripinhas (intestinos enrolados saindo do abdômen e pendurados na cintura)
    const gutCols = [0xc8586c, 0xb04054, 0xd86e80, 0x9c2c3e];
    for (let i = 0; i < 6; i++) {
      const gy = minY + th * (0.10 + (i % 3) * 0.085);
      const gz = cz + td * (-0.12 + (i / 5) * 0.32);
      const gx = side * (0.01 + (i % 2) * 0.03) - side * 0.025;
      put(0.075, th * 0.075, 0.13, gutCols[i % gutCols.length], gx, gy, gz, (i % 2 ? 0.35 : -0.3), side * 0.4, (i % 3 - 1) * 0.25);
    }
    // Alças de tripa penduradas para fora da metade rasgada
    for (let i = 0; i < 3; i++) {
      const len = th * (0.22 + (i % 2) * 0.10);
      put(0.062, len, 0.062, gutCols[(i + 1) % gutCols.length], -side * (0.01 + i * 0.012), minY - len * 0.32, cz + td * (-0.1 + i * 0.14), 0.15 * (i - 1), 0, -side * (0.18 + i * 0.08));
    }

    root.add(anat);
  }

  // Divide o corpo do inimigo em duas metades (esquerda/direita), centradas na origem do inimigo
  function makeEnemyHalves(e) {
    setGloryGlow(e, 0);
    const src = e.g;
    src.updateMatrixWorld(true);
    let torsoBox = null;
    if (e.rig && e.rig.torso && e.rig.torso.geometry) {
      if (!e.rig.torso.geometry.boundingBox) e.rig.torso.geometry.computeBoundingBox();
      torsoBox = e.rig.torso.geometry.boundingBox.clone();
      const m = new THREE.Matrix4().compose(e.rig.torso.position, e.rig.torso.quaternion, e.rig.torso.scale);
      torsoBox.applyMatrix4(m);
    }
    const out = [];
    for (const side of [-1, 1]) {
      const root = cloneClean(src);
      root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.visible = true;
      root.updateMatrixWorld(true);
      const jobs = [];
      root.traverse(o => {
        if (!o.isMesh || !o.geometry || !o.visible) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        const ctr = bb.getCenter(new V3()).applyMatrix4(o.matrixWorld);
        const sz = bb.getSize(new V3());
        jobs.push({ o, cx: ctr.x, bb, sz });
      });
      for (const j of jobs) {
        const o = j.o;
        if (Math.abs(j.cx) <= 0.06) {
          const w = j.sz.x * o.scale.x;
          o.scale.x *= 0.5;
          o.position.x += side * w * 0.25;
          const cf = new THREE.Mesh(BX(0.06, j.sz.y * 1.02, j.sz.z * 1.02), MT(0x7a040a, { basic: false }));
          const bc = j.bb.getCenter(new V3());
          cf.position.set(bc.x - side * j.sz.x * 0.5, bc.y, bc.z);
          o.add(cf);
        } else if (j.cx * side < 0) {
          o.visible = false;
        }
      }
      addSplitTorsoAnatomy(root, side, torsoBox, e.h, e.r);
      out.push({ g: root, side });
    }
    return out;
  }

  function severLimb(e, partName, kx, kz, so) {
    const L = e.limbs && e.limbs[partName];
    if (!L || L.severed) return;
    L.severed = true;
    L.node.visible = false;
    e.g.updateMatrixWorld(true);
    const wp = (so && so.noGib) ? L.jointLocal.clone().applyMatrix4(e.g.matrixWorld) : spawnSeveredLimbGib(e, L, kx, kz);

    // Coto sangrento na junção do tronco
    const s = L.stumpSize || 0.2;
    const stump = new THREE.Mesh(BX(s, s, s), MT(0x7a040a, { basic: false }));
    stump.position.copy(L.jointLocal);
    stump.userData.om = stump.material;
    e.g.add(stump);
    if (e.meshes) e.meshes.push(stump);
    if (partName === 'head') {
      const neckBone = new THREE.Mesh(BX(s * 0.48, s * 0.65, s * 0.48), MT(0xe8dcc8, { basic: false }));
      neckBone.position.set(L.jointLocal.x, L.jointLocal.y + s * 0.28, L.jointLocal.z - s * 0.08);
      neckBone.userData.om = neckBone.material;
      e.g.add(neckBone);
      if (e.meshes) e.meshes.push(neckBone);
    }

    // Jato inicial forte na junção
    const worldDir = L.jointDir.clone().applyAxisAngle(new V3(0, 1, 0), e.yaw);
    bloodSpurt(wp.x, wp.y, wp.z, worldDir.x + (kx || 0) * 0.5, worldDir.z + (kz || 0) * 0.5, 11, 20, 4.5);
    SFX.play('hit', 'cut');

    if (partName !== 'head') {
      e.severedCount = (e.severedCount || 0) + 1;
      e.limbSpeedMul = Math.max(0.30, (e.limbSpeedMul || 1) - (L.speedPenalty || 0.18));
      e.bleedJoints.push({ localPos: L.jointLocal.clone(), localDir: L.jointDir.clone(), cd: 0.05 });
      addStyle(15);
      const limbBasePerUnit = 840 / Math.max(1, S.levelBloodExpected || 1);
      const limbW = enemyBloodWeight(e);
      if (limbW > 0) addBloodLiters(limbBasePerUnit * limbW * 0.12 * (WEAPON_BLOOD[e._lastHitWeapon] || 1.0));

      if (e.T.flying && !e.wingsLost && e.limbs.wingL && e.limbs.wingL.severed && e.limbs.wingR && e.limbs.wingR.severed) {
        e.wingsLost = true;
        e.fallVel = Math.min(e.fallVel || 0, -1.5);
      }
      if (!e.crawling && e.limbs.legL && e.limbs.legL.severed && e.limbs.legR && e.limbs.legR.severed) {
        e.crawling = true;
        e.crawlT = 0;
        e.limbSpeedMul = Math.min(e.limbSpeedMul || 1, 0.35);
        e.fallVel = Math.min(e.fallVel || 0, -2.0);
        if (e.state === 'charge' || e.state === 'chargeWind') {
          e.state = 'move';
          e.chargeCd = e.T.charge ? e.T.charge.cd : 5;
        }
      }
    }
  }

  /* ---------------- danos visuais progressivos (carne, cara amassada, olhos, ossos, tripas) ---------------- */
  function addDmgMesh(parent, w, h, d, color, x, y, z, o) {
    const m = new THREE.Mesh(BX(w, h, d), MT(color, o));
    m.position.set(x || 0, y || 0, z || 0);
    m.userData.om = m.material;
    parent.add(m);
    let root = parent;
    while (root.parent && root.parent !== scene) root = root.parent;
    if (root.userData && root.userData._eMeshes) root.userData._eMeshes.push(m);
    return m;
  }

  function spawnFleshChunks(e, wx, wy, wz, kx, kz, count, scale) {
    if (goreQualityMul <= 0) return;
    const n = Math.max(1, Math.round(count * Math.min(1.5, goreQualityMul)));
    const maxG = Math.max(10, Math.round((goreDuration === Infinity ? 1200 : 600) * goreQualityMul));
    const sc = scale || 1;
    const inR = World.isPosInRender(wx, wz);
    for (let i = 0; i < n; i++) {
      evictOldestGib(maxG);
      const isBone = i % 4 === 3;
      const col = isBone ? GIB_COLS[3] : GIB_COLS[(Math.random() * 3) | 0];
      const sx = (isBone ? rnd(0.08, 0.14) : rnd(0.14, 0.28)) * sc;
      const sy = (isBone ? rnd(0.08, 0.14) : rnd(0.10, 0.22)) * sc;
      const sz = (isBone ? rnd(0.22, 0.38) : rnd(0.14, 0.28)) * sc;
      const a = rnd(0, Math.PI * 2);
      const sp = rnd(3.5, 9.5);
      pushGib(
        wx + rnd(-0.15, 0.15), wy + rnd(-0.15, 0.15), wz + rnd(-0.15, 0.15),
        Math.cos(a) * sp * 0.65 + (kx || 0) * rnd(2.5, 5.5),
        rnd(2.5, 7.0),
        Math.sin(a) * sp * 0.65 + (kz || 0) * rnd(2.5, 5.5),
        rnd(-12, 12), rnd(-12, 12), rnd(-12, 12),
        sx, sy, sz, col, inR
      );
    }
  }

  function attachDanglingEye(e, side, sz) {
    const head = e.rig && e.rig.head;
    if (!head) return;
    const eyePivot = new THREE.Group();
    const s = Math.max(0.22, Math.min(sz.x, sz.y));
    eyePivot.position.set(side * sz.x * 0.24, sz.y * 0.08, sz.z * 0.50);
    // Cavidade ocular ensanguentada
    addDmgMesh(head, s * 0.28, s * 0.24, s * 0.08, 0x3a0205, side * sz.x * 0.24, sz.y * 0.08, sz.z * 0.48, { basic: false });
    // Nervo óptico / tendão pendurado
    const cordLen = s * rnd(0.45, 0.70);
    addDmgMesh(eyePivot, s * 0.07, cordLen, s * 0.07, 0x8a0812, 0, -cordLen * 0.5, s * 0.04, { basic: false });
    // Globo ocular saltado
    const ball = addDmgMesh(eyePivot, s * 0.22, s * 0.22, s * 0.22, 0xf0e6d8, 0, -cordLen, s * 0.07, { basic: false });
    addDmgMesh(ball, s * 0.11, s * 0.11, s * 0.05, 0xb81018, 0, 0, s * 0.10, { basic: true });
    head.add(eyePivot);
    if (!e.danglingEyes) e.danglingEyes = [];
    e.danglingEyes.push({ pivot: eyePivot, phase: rnd(0, 6.28), side });
  }

  function attachGutsSpill(e, torso, sz, xOff, yOff, zOff, segCount) {
    const holeW = sz.x * 0.42, holeH = sz.y * 0.34;
    // Buraco de corte / rasgo escuro no tronco
    addDmgMesh(torso, holeW, holeH, sz.z * 0.14, 0x260104, xOff, yOff, zOff, { basic: false });
    addDmgMesh(torso, holeW * 1.12, holeH * 0.18, sz.z * 0.16, 0x8e0e16, xOff, yOff + holeH * 0.48, zOff, { basic: false });
    // Tripas segmentadas escorrendo para baixo
    const gutPivot = new THREE.Group();
    gutPivot.position.set(xOff, yOff - holeH * 0.15, zOff + sz.z * 0.08);
    let parent = gutPivot;
    const segCols = [0xc23842, 0x9c1c26, 0xd4525a, 0x7e1018];
    const segLen = sz.y * 0.20;
    const thick = Math.max(0.06, sz.x * 0.14);
    for (let i = 0; i < segCount; i++) {
      const seg = new THREE.Group();
      if (i > 0) seg.position.set(rnd(-0.02, 0.02), -segLen * 0.85, 0.01);
      const m = addDmgMesh(seg, thick * (1 - i * 0.08), segLen, thick * (1 - i * 0.08), segCols[i % segCols.length], 0, -segLen * 0.45, 0, { basic: false });
      m.rotation.z = (i % 2 === 0 ? 0.18 : -0.18);
      parent.add(seg);
      parent = seg;
    }
    torso.add(gutPivot);
    if (!e.gutsList) e.gutsList = [];
    e.gutsList.push({ pivot: gutPivot, phase: rnd(0, 6.28) });
  }

  function damageHeadVisual(e, stage, kx, kz) {
    const R = e.rig, L = e.limbs && e.limbs.head;
    if (!R || !R.head || (L && L.severed)) return;
    const cur = e.headDmgStage || 0;
    if (stage <= cur) return;
    e.headDmgStage = stage;
    const sz = (L && L.limbSize) ? L.limbSize : new V3(0.44, 0.46, 0.44);
    const side = e.headCrushSide || (e.headCrushSide = Math.random() < 0.5 ? -1 : 1);
    const wp = new V3();
    R.head.getWorldPosition(wp);

    if (stage >= 1 && cur < 1) {
      // Cara amassada (estágio 1) + olho pendurado
      R.head.scale.set(1.15, 0.88, 0.74);
      R.head.rotation.z = side * 0.20;
      addDmgMesh(R.head, sz.x * 0.42, sz.y * 0.34, sz.z * 0.12, 0x420307, side * sz.x * 0.18, -sz.y * 0.06, sz.z * 0.48, { basic: false });
      addDmgMesh(R.head, sz.x * 0.16, sz.y * 0.12, sz.z * 0.10, 0xe8dcc8, -side * sz.x * 0.12, -sz.y * 0.22, sz.z * 0.50, { basic: false });
      attachDanglingEye(e, side, sz);
      spawnFleshChunks(e, wp.x, wp.y, wp.z, kx, kz, 3, 0.75);
    }
    if (stage >= 2 && cur < 2) {
      // Cara completamente esmagada + segundo olho pendurado + osso do crânio exposto
      R.head.scale.set(1.30, 0.70, 0.58);
      R.head.rotation.z = -side * 0.30;
      R.head.rotation.x = 0.22;
      addDmgMesh(R.head, sz.x * 0.55, sz.y * 0.36, sz.z * 0.14, 0x2e0104, 0, sz.y * 0.12, sz.z * 0.46, { basic: false });
      addDmgMesh(R.head, sz.x * 0.22, sz.y * 0.20, sz.z * 0.14, 0xe8dcc8, -side * sz.x * 0.16, sz.y * 0.28, sz.z * 0.30, { basic: false });
      attachDanglingEye(e, -side, sz);
      spawnFleshChunks(e, wp.x, wp.y, wp.z, kx, kz, 4, 0.85);
    }
  }

  function damageLimbVisual(e, partName, kx, kz) {
    const L = e.limbs && e.limbs[partName];
    if (!L || L.severed || L.broken) return;
    L.broken = true;
    const sz = L.limbSize || new V3(0.25, 0.8, 0.25);
    const isLeg = partName === 'legL' || partName === 'legR';
    const isLeft = partName === 'armL' || partName === 'legL';
    const side = isLeft ? -1 : 1;
    const wp = new V3();
    L.node.getWorldPosition(wp);

    if (L.hitMesh && L.hitMesh !== L.node) {
      if (isLeg) {
        // Perna estourada: comprimida, torta e com osso/carne expostos
        L.hitMesh.scale.set(0.76, 0.90, 0.76);
        L.hitMesh.rotation.z = side * -0.32;
        L.hitMesh.rotation.x = 0.24;
      } else {
        // Braço quebrado: dobrado em ângulo antinatural
        L.hitMesh.scale.set(0.86, 0.94, 0.86);
        L.hitMesh.rotation.z = side * 0.58;
        L.hitMesh.rotation.x = 0.42;
      }
    }

    // Ferida aberta + estilhaço de osso saindo da fratura
    const midY = -sz.y * 0.45;
    addDmgMesh(L.node, sz.x * 1.15, sz.y * 0.24, sz.z * 1.15, 0x4a0206, 0, midY, 0, { basic: false });
    const bone = addDmgMesh(L.node, sz.x * 0.32, sz.y * 0.34, sz.z * 0.32, 0xe8dcc8, side * sz.x * 0.36, midY - sz.y * 0.05, sz.z * 0.34, { basic: false });
    bone.rotation.set(0.65, 0, side * 0.55);

    if (isLeg) {
      e.hasBrokenLeg = true;
      e.limbSpeedMul = Math.max(0.32, (e.limbSpeedMul || 1) - 0.16);
      // Teco de carne estourada no joelho/coxa
      addDmgMesh(L.node, sz.x * 0.65, sz.y * 0.26, sz.z * 0.45, 0x8e0e16, -side * sz.x * 0.25, midY + sz.y * 0.08, sz.z * 0.42, { basic: false });
    }

    if (e.bleedJoints) {
      e.bleedJoints.push({ localPos: L.jointLocal.clone().add(new V3(0, midY, 0)), localDir: new V3(side * 0.5, -0.3, 0.5), cd: 0.12 });
    }
    spawnFleshChunks(e, wp.x, wp.y - sz.y * 0.4, wp.z, kx, kz, isLeg ? 5 : 4, 0.9);
  }

  function damageTorsoVisual(e, stage, hitPos, kx, kz) {
    const R = e.rig;
    if (!R || !R.torso) return;
    const cur = e.torsoDmgStage || 0;
    if (stage <= cur) return;
    e.torsoDmgStage = stage;
    const sz = new V3();
    getBoxSize(R.torso, sz);
    const wp = hitPos ? hitPos.clone() : R.torso.getWorldPosition(new V3());
    const side = (Math.random() < 0.5 ? -1 : 1);

    if (stage >= 1 && cur < 1) {
      // Perda de teco de carne + costela exposta no peito/lateral
      const xO = side * sz.x * 0.22;
      const yO = sz.y * 0.14;
      const zO = sz.z * 0.47;
      addDmgMesh(R.torso, sz.x * 0.38, sz.y * 0.28, sz.z * 0.14, 0x2e0204, xO, yO, zO, { basic: false });
      addDmgMesh(R.torso, sz.x * 0.44, sz.y * 0.08, sz.z * 0.15, 0x8e0e16, xO, yO - sz.y * 0.13, zO, { basic: false });
      addDmgMesh(R.torso, sz.x * 0.24, sz.y * 0.06, sz.z * 0.08, 0xe8dcc8, xO, yO + sz.y * 0.04, zO + 0.02, { basic: false });
      spawnFleshChunks(e, wp.x, wp.y, wp.z, kx, kz, 4, 0.95);
    }
    if (stage >= 2 && cur < 2) {
      // Buraco de corte no abdômen com tripas escorrendo
      attachGutsSpill(e, R.torso, sz, -side * sz.x * 0.14, -sz.y * 0.12, sz.z * 0.47, 4);
      // Outro teco de carne arrancado na lateral
      addDmgMesh(R.torso, sz.x * 0.16, sz.y * 0.30, sz.z * 0.38, 0x3a0205, -side * sz.x * 0.46, sz.y * 0.10, 0, { basic: false });
      spawnFleshChunks(e, wp.x, wp.y, wp.z, kx, kz, 5, 1.0);
    }
    if (stage >= 3 && cur < 3) {
      // Rasgo grave com mais tripas + costelas quebradas + tronco murcho/mastigado
      attachGutsSpill(e, R.torso, sz, side * sz.x * 0.18, -sz.y * 0.18, sz.z * 0.46, 3);
      addDmgMesh(R.torso, sz.x * 0.30, sz.y * 0.07, sz.z * 0.10, 0xe8dcc8, 0, sz.y * 0.20, sz.z * 0.48, { basic: false });
      R.torso.scale.set(0.93, 0.96, 0.89);
      if (e.bleedJoints) {
        e.bleedJoints.push({ localPos: new V3(0, e.h * 0.48, 0.2), localDir: new V3(0, -0.2, 1), cd: 0.15 });
      }
      spawnFleshChunks(e, wp.x, wp.y, wp.z, kx, kz, 6, 1.1);
    }
  }

  function updateEnemyVisualDamage(e, part, hitPos, kx, kz) {
    if (!e || e.dead) return;
    const hpRatio = e.maxhp > 0 ? Math.max(0, e.hp / e.maxhp) : 1;

    // 1. Membro atingido quebrado/estourado antes de ser decepado
    if (part && part !== 'torso' && part !== 'head') {
      const L = e.limbs && e.limbs[part];
      if (L && !L.severed && !L.broken && L.maxhp > 0 && (L.hp / L.maxhp) <= 0.58) {
        damageLimbVisual(e, part, kx, kz);
      }
    }

    // 2. Cabeça amassada e olhos pendurados
    const hL = e.limbs && e.limbs.head;
    const hRatio = (hL && hL.maxhp > 0) ? Math.max(0, hL.hp / hL.maxhp) : hpRatio;
    if (part === 'head' || hpRatio <= 0.50) {
      if (hRatio <= 0.38 || hpRatio <= 0.24) damageHeadVisual(e, 2, kx, kz);
      else if (hRatio <= 0.74 || hpRatio <= 0.48) damageHeadVisual(e, 1, kx, kz);
    }

    // 3. Tronco perdendo tecos de carne e tripas escorrendo
    if (hpRatio <= 0.26) damageTorsoVisual(e, 3, hitPos, kx, kz);
    else if (hpRatio <= 0.52) damageTorsoVisual(e, 2, hitPos, kx, kz);
    else if (hpRatio <= 0.78) damageTorsoVisual(e, 1, hitPos, kx, kz);

    // 4. Em dano muito baixo geral, estoura/quebra um membro aleatório se nenhum estiver quebrado ainda
    if (hpRatio <= 0.30 && !e.extraLimbDamaged && e.limbs) {
      e.extraLimbDamaged = true;
      const cand = ['legL', 'legR', 'armL', 'armR'].filter(k => e.limbs[k] && !e.limbs[k].severed && !e.limbs[k].broken);
      if (cand.length > 0) damageLimbVisual(e, cand[(Math.random() * cand.length) | 0], kx, kz);
    }
  }

  function deformGaliusHit(g, stage, dir) {
    if (!g || g.dead || !g.rig) return;
    const R = g.rig;
    const wp = g.g.position;
    if (stage === 0) {
      // Coração arrancado: tripas e carne viva saindo da cavidade torácica
      if (R.torso) {
        const sz = new V3(); getBoxSize(R.torso, sz);
        attachGutsSpill(g, R.torso, sz, 0, -sz.y * 0.08, sz.z * 0.48, 4);
      }
      spawnFleshChunks(g, wp.x, wp.y + 3.2, wp.z, 0, 0, 8, 1.35);
      return;
    }
    const d = dir || 1;
    g.ripDeform = stage;
    g.ripRecoil = 1.0;
    g.ripHitDir = d;
    if (stage === 1) {
      // 1º tapa da Cruz: cara amassada pro lado, olho pendurado, tronco torcido, braço esquerdo quebrado
      if (R.head) {
        R.head.scale.set(1.24, 0.80, 0.66);
        R.head.rotation.set(0.32, -0.52 * d, 0.46 * d);
        const hsz = new V3(); getBoxSize(R.head, hsz);
        addDmgMesh(R.head, hsz.x * 0.50, hsz.y * 0.38, hsz.z * 0.16, 0x3a0205, d * hsz.x * 0.16, 0, hsz.z * 0.46, { basic: false });
        attachDanglingEye(g, d, hsz);
      }
      if (R.torso) {
        R.torso.scale.set(1.12, 0.88, 0.82);
        R.torso.rotation.set(0.22, -0.28 * d, 0.16 * d);
        const tsz = new V3(); getBoxSize(R.torso, tsz);
        addDmgMesh(R.torso, tsz.x * 0.36, tsz.y * 0.28, tsz.z * 0.16, 0x420307, d * tsz.x * 0.24, tsz.y * 0.18, tsz.z * 0.46, { basic: false });
      }
      damageLimbVisual(g, 'armL', d * 0.8, 0.2);
      spawnFleshChunks(g, wp.x, wp.y + 3.6, wp.z, d * 1.2, 0.4, 14, 1.5);
    } else if (stage >= 2) {
      // 2º tapa da Cruz: crânio completamente afundado, 2º olho pendurado, tronco esmagado, pernas cedendo
      if (R.head) {
        R.head.scale.set(1.44, 0.56, 0.48);
        R.head.rotation.set(0.64, 0.48 * d, -0.54 * d);
        const hsz = new V3(); getBoxSize(R.head, hsz);
        addDmgMesh(R.head, hsz.x * 0.30, hsz.y * 0.26, hsz.z * 0.18, 0xe8dcc8, -d * hsz.x * 0.15, hsz.y * 0.24, hsz.z * 0.38, { basic: false });
        attachDanglingEye(g, -d, hsz);
      }
      if (R.torso) {
        R.torso.scale.set(1.26, 0.72, 0.68);
        R.torso.rotation.set(0.42, 0.24 * d, -0.24 * d);
        const tsz = new V3(); getBoxSize(R.torso, tsz);
        attachGutsSpill(g, R.torso, tsz, d * tsz.x * 0.18, -tsz.y * 0.16, tsz.z * 0.46, 4);
      }
      if (R.legL) R.legL.scale.set(1.16, 0.78, 1.16);
      if (R.legR) R.legR.scale.set(1.16, 0.78, 1.16);
      damageLimbVisual(g, 'armR', d * 0.8, 0.2);
      spawnFleshChunks(g, wp.x, wp.y + 3.2, wp.z, d * 1.4, -0.4, 18, 1.65);
    }
  }

  const SHADOW_GEO = new THREE.CircleGeometry(1, 10);
  SHADOW_GEO.rotateX(-Math.PI / 2);
  const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false });
  function addBlobShadow(g, rad) {
    const sh = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
    sh.scale.setScalar((rad || 0.6) * 1.15);
    sh.position.y = 0.04;
    sh.userData.isShadow = true;
    sh.visible = blobShadowsEnabled;
    g.add(sh);
    return sh;
  }
  function setBlobShadows(on) {
    blobShadowsEnabled = !!on;
    for (const e of enemies) if (e.shadow) e.shadow.visible = blobShadowsEnabled;
    for (const p of peasants) if (p.shadow) p.shadow.visible = blobShadowsEnabled;
  }

  function spawnEnemy(type, x, z, room, y) {
    const T = ETYPES[type];
    const rig = BUILD[T.model]();
    const g = rig.root;
    const gy = getGroundY(x, z);
    const py = T.flying ? gy + (y || T.hover) : gy;
    const yaw = rnd(0, 6.28);
    g.position.set(x, py, z);
    g.rotation.y = yaw;
    const inRender = World.isPosInRender(x, z);
    g.visible = inRender;
    scene.add(g);
    const baseHp = T.hpRange ? Math.floor(rnd(T.hpRange[0], T.hpRange[1] + 1)) : T.hp;
    const hp = Math.max(1, Math.round(baseHp * getDifficulty().dmgMul));
    const e = {
      type, T, rig, g, hp, maxhp: hp, r: T.r, h: rig.h, room, aggro: false, aggroOnPlayer: false, cd: rnd(0.4, 1.6),
      state: 'move', st: 0, kv: new V3(), cdir: new V3(), stun: 0, flash: 0, flashing: false, anim: rnd(0, 6),
      dead: false, downed: false, kneel: false, glory: false, gloryT: 0, gloryGrace: 0, gloryBleedCd: 0,
      kicked: false, kickVel: new V3(), kickT: 0, kickBloodT: 0, grabbed: false,
      recover: 0, chargeCd: rnd(2, 5), stompCd: rnd(3, 5), yaw,
      savedPos: new V3(x, py, z), savedYaw: yaw, inRender,
      strafe: Math.random() < 0.5 ? 1 : -1, hit: false, ranged: false, enrage: false, moved: false,
      limbSpeedMul: 1, severedCount: 0, bleedJoints: [], crushCd: 0,
      wingsLost: false, crawling: false, crawlT: 0, fallVel: 0
    };
    g.userData._cullSphere = { lx: 0, ly: rig.h * 0.5, lz: 0, r: Math.max(T.r, rig.h * 0.5) + 1.0 };
    const eMeshes = [];
    g.traverse(o => { if (o.isMesh && !o.userData.isShadow) { o.userData.om = o.material; eMeshes.push(o); } });
    g.userData._eMeshes = eMeshes;
    e.meshes = eMeshes;
    initEnemyLimbs(e);
    e.shadow = addBlobShadow(g, T.r);
    enemies.push(e);
    return e;
  }
  const GLORY_MATS = [
    MT(0x7a0808, { em: 0x550000 }),
    MT(0xc01010, { em: 0xa00808 }),
    MT(0xff2418, { em: 0xe01808 })
  ];
  function setFlash(e, on) {
    e.flashing = on;
    const gm = e.glory ? GLORY_MATS[e.gloryMatIdx || 0] : null;
    if (e.meshes) {
      for (let i = 0; i < e.meshes.length; i++) {
        const o = e.meshes[i];
        o.material = on ? FLASH : (gm || o.userData.om);
      }
      return;
    }
    e.g.traverse(o => {
      if (o.isMesh && !o.userData.isShadow) {
        o.material = on ? FLASH : (gm || o.userData.om);
      }
    });
  }
  function setGloryGlow(e, intensity) {
    if (intensity <= 0) {
      e.gloryMatIdx = -1;
      if (e.meshes && !e.flashing) {
        for (let i = 0; i < e.meshes.length; i++) e.meshes[i].material = e.meshes[i].userData.om;
        return;
      }
      e.g.traverse(o => {
        if (o.isMesh && !o.userData.isShadow && !e.flashing) o.material = o.userData.om;
      });
      return;
    }
    const idx = intensity > 0.72 ? 2 : (intensity > 0.42 ? 1 : 0);
    if (e.gloryMatIdx === idx && !e.flashing) return;
    e.gloryMatIdx = idx;
    const gm = GLORY_MATS[idx];
    if (e.meshes && !e.flashing) {
      for (let i = 0; i < e.meshes.length; i++) e.meshes[i].material = gm;
      return;
    }
    e.g.traverse(o => {
      if (o.isMesh && !o.userData.isShadow && !e.flashing) o.material = gm;
    });
  }
  function enterGloryState(e, kx, kz) {
    e.hp = 1;
    e.glory = true;
    e.gloryT = 6.0;
    e.gloryGrace = 0.28;
    e.gloryBleedCd = 0.15;
    e.gloryMatIdx = -1;
    e.kneel = true;
    e.state = 'move';
    e.stun = 0;
    e.flash = 0;
    e.flashing = false;
    e.kv.multiplyScalar(0.3);
    const pitch = SCREAM_PITCH[e.T.model] || 1.0;
    SFX.play('scream', pitch * 0.85);
    setGloryGlow(e, 0.85);
  }
  const gloryQueue = [];
  function queueGloryCandidate(e, kx, kz, weapon) {
    if (e._gloryPending || e.dead) return;
    e._gloryPending = true;
    gloryQueue.push({ e, kx, kz, weapon });
  }
  function flushGloryQueue() {
    if (!gloryQueue.length) return;
    let minMaxHp = Infinity;
    for (const item of gloryQueue) {
      const e = item.e;
      if (e.dead || !enemies.includes(e)) continue;
      if (e.maxhp < minMaxHp) minMaxHp = e.maxhp;
    }
    const lowest = [];
    for (const item of gloryQueue) {
      const e = item.e;
      if (!e.dead && enemies.includes(e) && e.maxhp === minMaxHp) lowest.push(item);
    }
    const winner = lowest.length ? lowest[(Math.random() * lowest.length) | 0].e : null;
    for (const item of gloryQueue) {
      const { e, kx, kz, weapon } = item;
      e._gloryPending = false;
      if (e.dead || !enemies.includes(e)) continue;
      if (e === winner) enterGloryState(e, kx, kz);
      else killEnemy(e, kx, kz, { weapon });
    }
    gloryQueue.length = 0;
  }
  function bisectEnemy(e, kx, kz) {
    if (!e || e.dead) return;
    e.glory = false;
    setGloryGlow(e, 0);
    const c = e.g.position;
    // Duas metades do corpo voando para os lados (esquerda/direita)
    const rx = -(kz || 0), rz = (kx || 1);
    const len = Math.hypot(rx, rz) || 1;
    const sx = rx / len, sz = rz / len;
    if (goreQualityMul > 0) {
      const maxG = Math.max(10, Math.round((goreDuration === Infinity ? 1200 : 600) * goreQualityMul));
      for (let side = -1; side <= 1; side += 2) {
        evictOldestGib(maxG);
        const w = Math.max(0.35, e.r * 0.75), h = Math.max(0.45, e.h * 0.45), d = Math.max(0.32, e.r * 0.65);
        const px = c.x + sx * side * 0.25, py = c.y + e.h * 0.45, pz = c.z + sz * side * 0.25;
        const inR = World.isPosInRender(px, pz);
        pushGib(
          px, py, pz,
          sx * side * rnd(6, 10) + (kx || 0) * 3, rnd(5, 8.5), sz * side * rnd(6, 10) + (kz || 0) * 3,
          rnd(-12, 12), rnd(-12, 12), rnd(-12, 12),
          w, h, d, GIB_COLS[side < 0 ? 0 : 1], inR
        );
      }
    }
    bloodSpurt(c.x, c.y + e.h * 0.5, c.z, sx, sz, 13, 28, 6.0);
    bloodSpurt(c.x, c.y + e.h * 0.5, c.z, -sx, -sz, 13, 28, 6.0);
    killEnemy(e, kx, kz);
  }
  function decapEnemy(e, kx, kz) {
    if (!e || e.dead) return;
    e.glory = false;
    setGloryGlow(e, 0);
    const c = e.g.position;
    if (e.limbs && e.limbs.head && !e.limbs.head.severed) {
      severLimb(e, 'head', kx, kz);
    }
    bloodSpurt(c.x, c.y + e.h * 0.85, c.z, kx || 0, kz || 0, 12, 26, 7.5);
    killEnemy(e, kx, kz, { decapitated: true });
  }
  function smashHeadEnemy(e, kx, kz) {
    if (!e || e.dead) return;
    e.glory = false;
    setGloryGlow(e, 0);
    const c = e.g.position;
    if (e.rig && e.rig.head) e.rig.head.visible = false;
    if (e.limbs && e.limbs.head) e.limbs.head.severed = true;
    // Estilhaços de crânio e sangue na altura da cabeça
    bloodSpurt(c.x, c.y + e.h * 0.78, c.z, kx || 0, kz || 0, 15, 36, 7.5);
    burst(c.x, c.y + e.h * 0.78, c.z, 0xe8dcc8, 8, 9, 0.55, 0.16, 20);
    killEnemy(e, kx, kz, { decapitated: true });
  }
  function launchKickedEnemy(e, dirX, dirZ) {
    if (!e || e.dead) return;
    e.glory = false;
    setGloryGlow(e, 0);
    e.kneel = false;
    e.kicked = true;
    e.kickT = 1.25;
    e.kickBloodT = 0;
    const len = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / len, nz = dirZ / len;
    e.kickVel.set(nx * 34, 9.5, nz * 34);
    e.g.position.y += 0.35;
    const c = e.g.position;
    bloodSpurt(c.x, c.y + e.h * 0.5, c.z, nx, nz, 12, 18, 4.0);
  }
  function cleanupGaliusProps(e, restoreWeapon) {
    if (!e) return;
    if (e.droppedCross) { scene.remove(e.droppedCross); e.droppedCross = null; }
    if (e.bloodBeamMesh) { scene.remove(e.bloodBeamMesh); e.bloodBeamMesh = null; }
    if (restoreWeapon && e.rig && e.rig.weapon) e.rig.weapon.visible = true;
  }
  function removeEnemy(e) {
    if (e && e.grabbed) e.grabbed = false;
    if (P.grabbed === e) { P.grabbed = null; P.ramHitSet = null; }
    cleanupGaliusProps(e, false);
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
    if (P.dead || P.god || S.cutscene > 0 || S.glory) return;
    if (P.dashT > 0 || P.invuln > 0) return;
    const amt = dmg * getDifficulty().dmgMul * (P.faithMode > 0 ? 0.5 : 1);
    P.hp -= amt;
    P.hurtFlash = Math.min(1, 0.45 + amt / 40);
    P.shake = Math.max(P.shake, 0.25 + amt / 80);
    const dx = P.pos.x - sx, dz = P.pos.z - sz, l = Math.hypot(dx, dz) || 1;
    P.vel.x += dx / l * (kb || 5); P.vel.z += dz / l * (kb || 5);
    SFX.play('hurt');
    S.style = Math.max(0, S.style - 30);
    if (S.style <= 0) { S.styleT = 0; S.lastStyleRankIdx = -1; }
    S.hitCombo = 0;
    S.hitComboT = 0;
    if (P.hp <= 0) { P.hp = 0; die(); }
  }

  function dmgEnemy(e, amt, kx, kz, o) {
    if (e.dead || e.downed || e.kicked || e._gloryPending || e.galiusIntro || e.maximusIntro || e.invuln) return false;
    o = o || {};
    const weapId = o.weapon || (WEAPONS[curW] ? WEAPONS[curW].id : 'fists');
    e._lastHitWeapon = weapId;
    if (e.glory) {
      if (e.gloryGrace > 0) return true;
      e.glory = false;
      setGloryGlow(e, 0);
      e.flash = 0.06;
      SFX.play('hit', o.hitSfx || 'general');
      killEnemy(e, kx, kz, { weapon: weapId });
      return true;
    }
    const T = e.T;
    const c = e.g.position;
    if (T.immortal) {
      e.aggro = true;
      e.aggroOnPlayer = true;
      e.targetPeasant = null;
      e.flash = 0.05;
      SFX.play('clang');
      burst(c.x, c.y + e.h * 0.55, c.z, 0xd8e0ff, 6, 7, 0.35, 0.14, 10);
      burst(c.x, c.y + e.h * 0.55, c.z, 0xffd24a, 4, 6, 0.3, 0.12, 10);
      if (S.msgT <= 0.2) say('IMUNE A ARMAS COMUNS! Desça pela ESCADARIA NO ALTAR!', 'AVISO', 3.0);
      return false;
    }
    const stuckMult = (T.model === 'maximus' && (e.state === 'mStuck' || e.state === 'mImpaleMiss')) ? 1.75 : 1;
    const baseDmg = amt * (P.faithMode > 0 ? 2 : 1) * (T.dmgScale || 1) * stuckMult;
    const part = o.part || 'torso';
    const L = e.limbs && e.limbs[part];
    const isHead = part === 'head' && L && !L.severed;
    const isLimb = dismemberEnabled && part !== 'torso' && part !== 'head' && L && !L.severed;
    const a = isHead ? baseDmg * 2 : baseDmg;

    if (isHead && dismemberEnabled) {
      L.hp -= a;
      e.hp -= a;
    } else if (isLimb) {
      // Membros têm vida própria: não diminuem a vida do tronco
      L.hp -= a;
    } else {
      e.hp -= a;
    }

    e.aggro = true;
    e.aggroOnPlayer = true;
    e.targetPeasant = null;
    e.flash = 0.08;
    if (!e.grabbed) {
      const k = (o.knock || 0) / (T.mass || 1);
      e.kv.x += kx * k * 3; e.kv.z += kz * k * 3;
    }
    if (!T.boss && amt > 14) e.stun = Math.max(e.stun, (0.16 + (o.stunBonus || 0)) / (T.mass ? T.mass * 0.5 : 1));
    else if (o.stunBonus) e.stun = Math.max(e.stun, o.stunBonus * 0.5);
    S.hitMark = 0.12;
    SFX.play('hit', o.hitSfx || 'general');
    registerStyleHit(weapId, part, isHead ? 10 : 5);
    awardEnemyHitBlood(e, a, weapId, part);
    const spurtN = Math.min(22, 6 + ((a / 8) | 0));
    const hp = o.hitPos;
    const sx = hp ? hp.x : c.x, sy = hp ? hp.y : (c.y + e.h * 0.6), sz = hp ? hp.z : c.z;
    bloodSpurt(sx, sy, sz, kx, kz, Math.min(13, 6 + a * 0.12), spurtN, isHead ? 3.5 : 2.2);
    if (window.BloodStain) {
      const hitDist = Math.hypot(c.x - P.pos.x, c.z - P.pos.z);
      const weapId = o.weapon || (hitDist < 5.5 && WEAPONS[curW] && WEAPONS[curW].melee ? WEAPONS[curW].id : null);
      if (weapId || hitDist < 6.5) {
        BloodStain.addBlood(hitDist < 6.5 ? 0.05 : 0, weapId, weapId ? 0.09 : 0);
      }
    }

    if (dismemberEnabled && isLimb && L.hp <= 0) {
      severLimb(e, part, kx, kz);
      if (window.BloodStain && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 7.5) {
        BloodStain.addBlood(0.10, o.weapon || (WEAPONS[curW] ? WEAPONS[curW].id : null), 0.14);
      }
      return true;
    }

    if (dismemberEnabled && isHead && L.hp <= 0) {
      severLimb(e, 'head', kx, kz);
      if (T.model === 'galius') {
        e.hp = 0; e.downed = true; e.state = 'move';
        cleanupGaliusProps(e, true);
        SFX.play('roar'); S.shakeBig = 1.2;
        say('Galius caiu! Arranque o Coração Ateu!', 'NIVALDO', 4);
        return true;
      }
      addStyle(18);
      killEnemy(e, kx, kz, { decapitated: true, weapon: weapId });
      return true;
    }

    updateEnemyVisualDamage(e, part, o.hitPos, kx, kz);

    if (T.model === 'galius') {
      if (!e.kneel && e.hp <= e.maxhp * 0.4) {
        e.kneel = true; e.state = 'move'; e.stun = 1.2;
        S.shakeBig = 1; SFX.play('shock');
        say('Os joelhos de Galius se despedaçam! Acabe com ele!', 'NIVALDO', 3.5);
      }
      if (e.hp <= 0) {
        e.hp = 0; e.downed = true; e.state = 'move';
        cleanupGaliusProps(e, true);
        SFX.play('roar'); S.shakeBig = 1.2;
        say('Galius caiu! Arranque o Coração Ateu!', 'NIVALDO', 4);
      }
      return true;
    }
    if (T.model === 'maximus') {
      if (e.hp <= 0) {
        if ((e.phase || 1) === 1) {
          e.phase = 1.5;
          e.phaseTransT = 0;
          e.hp = 1;
          e.invuln = true;
          e.state = 'phaseTrans';
          e.kneel = true;
          e.kv.set(0, 0, 0);
          e.vy = 0;
          e._transSaid = false;
          e._transHelmetOff = false;
          e._transIgnited = false;
          SFX.play('parry');
          S.shakeBig = 0.5;
          return true;
        }
        if (e.phase === 2) {
          killEnemy(e, kx, kz, { weapon: weapId });
        }
      }
      return true;
    }
    if (e.hp <= 0 && !T.immortal) {
      if (!T.boss && !T.galius2 && !e.grabbed) queueGloryCandidate(e, kx, kz, weapId);
      else killEnemy(e, kx, kz, { weapon: weapId });
    }
    return true;
  }

  const SCREAM_PITCH = {
    diabrete: 1.45, gargula: 1.2, campones: 1.05, padre: 0.95,
    guarda: 0.78, demonio: 0.55, maximus: 0.42, galius: 0.42
  };

  /* ---------------- camponeses sobreviventes (aliados) ---------------- */
  const peasants = [];
  const _projV = new V3();

  function spawnPeasant(x, z, room, variant) {
    const rig = BUILD.camponesVivo(variant);
    const g = rig.root;
    const gy = getGroundY(x, z);
    g.position.set(x, gy, z);
    const yaw = rnd(0, Math.PI * 2);
    g.rotation.y = yaw;
    const inRender = World.isPosInRender(x, z);
    g.visible = inRender;
    g.userData._cullSphere = { lx: 0, ly: rig.h * 0.5, lz: 0, r: Math.max(0.55, rig.h * 0.5) + 0.85 };
    scene.add(g);
    const pMeshes = [];
    g.traverse(o => { if (o.isMesh && !o.userData.isShadow) { o.userData.om = o.material; pMeshes.push(o); } });

    let labelEl = null;
    const labelBox = $('peasantLabels');
    if (labelBox) {
      labelEl = document.createElement('div');
      labelEl.className = 'peasant-label hidden';
      labelEl.textContent = 'Obrigado Nivaldo!';
      labelBox.appendChild(labelEl);
    }

    const p = {
      rig, g, r: 0.55, h: rig.h, room: room || 'a1',
      homeX: x, homeZ: z, yaw, wanderAng: yaw,
      savedPos: new V3(x, gy, z), savedYaw: yaw, inRender,
      wanderT: rnd(1.0, 3.2), pauseT: 0,
      orbitDir: Math.random() < 0.5 ? 1 : -1,
      kv: new V3(), flash: 0, flashing: false, anim: rnd(0, 6),
      beingChased: false, thankT: 0, thankText: '', waveT: 0, screamCd: rnd(0.5, 2.5),
      dead: false, ragdoll: null, labelEl, meshes: pMeshes
    };
    p.shadow = addBlobShadow(g, 0.55);
    peasants.push(p);
    return p;
  }

  function removePeasant(p) {
    scene.remove(p.g);
    if (p.labelEl && p.labelEl.parentNode) p.labelEl.parentNode.removeChild(p.labelEl);
    const i = peasants.indexOf(p);
    if (i >= 0) peasants.splice(i, 1);
  }

  function clearPeasants() {
    for (let i = peasants.length - 1; i >= 0; i--) removePeasant(peasants[i]);
  }

  function spawnMapPeasants(mapId) {
    clearPeasants();
    const list = (typeof PEASANTS !== 'undefined' && PEASANTS[mapId]) ? PEASANTS[mapId] : [];
    for (let i = 0; i < list.length; i++) {
      const sp = list[i];
      spawnPeasant(sp[0], sp[1], mapId, i);
    }
  }

  function hitPeasant(p, sx, sz) {
    if (!p || p.dead) return;
    p.flash = 0.12;
    const dx = p.g.position.x - sx, dz = p.g.position.z - sz, l = Math.hypot(dx, dz) || 1;
    p.kv.x += (dx / l) * 5.5;
    p.kv.z += (dz / l) * 5.5;
    bloodSpurt(p.g.position.x, p.g.position.y + 1.1, p.g.position.z, dx / l, dz / l, 6, 5, 1.8);
    if (p.screamCd <= 0 && Math.hypot(P.pos.x - p.g.position.x, P.pos.z - p.g.position.z) < 42) {
      p.screamCd = rnd(4.5, 8.0);
      SFX.play('scream', 1.35);
    }
  }

  function launchPeasantRagdoll(p, dx, dz, power) {
    if (!p || p.dead) return;
    let l = Math.hypot(dx, dz);
    let nx, nz;
    if (l < 0.001) {
      const a = rnd(0, Math.PI * 2);
      nx = Math.cos(a); nz = Math.sin(a);
    } else {
      nx = dx / l; nz = dz / l;
    }
    const pw = power != null ? power : 1;
    const hSpd = rnd(22, 32) * pw;
    const vSpd = rnd(11, 17) * Math.min(1.45, pw);
    p.flash = 0.14;
    p.thankT = 0; p.thankText = ''; p.waveT = 0;
    if (p.labelEl) p.labelEl.classList.add('hidden');
    if (p.shadow) p.shadow.visible = false;
    p.kv.set(0, 0, 0);
    p.g.rotation.order = 'YXZ';
    p.ragdoll = {
      vx: nx * hSpd,
      vy: vSpd,
      vz: nz * hSpd,
      rvx: rnd(-14, 14),
      rvy: rnd(-10, 10),
      rvz: rnd(-14, 14),
      grav: 24,
      bounces: 0,
      settled: false,
      recoverT: 0
    };
    burst(p.g.position.x, p.g.position.y + 1.0, p.g.position.z, 0xffe0a0, 7, 6, 0.35, 0.14, 8);
    if (p.screamCd <= 1.0) {
      p.screamCd = rnd(1.2, 2.2);
      SFX.play('scream', rnd(1.2, 1.55));
    }
  }

  function rescuePeasant(p) {
    if (!p || p.dead) return;
    p.thankT = 4.2;
    p.thankText = 'Obrigado Nivaldo!';
    p.waveT = 2.6;
    if (p.labelEl && p.inRender) {
      p.labelEl.textContent = 'Obrigado Nivaldo!';
      p.labelEl.classList.remove('hidden');
    }
    const px = p.g.position.x, pz = p.g.position.z;
    const dx = P.pos.x - px, dz = P.pos.z - pz, dl = Math.hypot(dx, dz) || 1;
    const off = Math.min(1.3, dl * 0.45);
    let hx = px + (dx / dl) * off + rnd(-0.2, 0.2);
    let hz = pz + (dz / dl) * off + rnd(-0.2, 0.2);
    if (pointInWall(hx, hz)) { hx = px; hz = pz; }
    if (spawnPickup) spawnPickup('host', hx, hz);
    burst(px, p.g.position.y + p.h + 0.2, pz, 0xffe060, 10, 5, 0.5, 0.14, 8);
    burst(hx, p.g.position.y + 0.7, hz, 0xff4040, 8, 4, 0.4, 0.14, 8);
    SFX.play('pickup');
  }

  function updatePeasant(p, dt) {
    if (!p || p.dead) return;
    const pos = p.g.position, R = p.rig;
    const inR = World.isPosInRender(p.savedPos.x, p.savedPos.z);
    if (!inR && !p.ragdoll) {
      if (p.inRender) {
        p.savedPos.copy(pos);
        p.savedYaw = p.yaw;
        if (p.flashing) {
          p.flashing = false;
          if (p.meshes) { for (let i = 0; i < p.meshes.length; i++) p.meshes[i].material = p.meshes[i].userData.om; }
        }
        p.g.visible = false;
        if (p.labelEl) p.labelEl.classList.add('hidden');
        p.inRender = false;
      }
      // Fora da render distance: guarda posição e mantém o camponês congelado no lugar
      return;
    }
    if (!p.ragdoll && !p.inRender) {
      pos.copy(p.savedPos);
      p.yaw = p.savedYaw;
      p.g.rotation.y = p.savedYaw;
      p.g.visible = true;
      p.inRender = true;
    } else if (p.ragdoll) {
      p.inRender = inR;
      p.g.visible = inR;
      if (!inR && p.labelEl) p.labelEl.classList.add('hidden');
    }

    p.anim += dt;
    if (p.screamCd > 0) p.screamCd -= dt;
    if (p.thankT > 0) {
      p.thankT = Math.max(0, p.thankT - dt);
      if (p.thankT <= 0) p.thankText = '';
    }
    if (p.flash > 0) {
      p.flash -= dt;
      if (!p.flashing) {
        p.flashing = true;
        if (p.meshes) { for (let i = 0; i < p.meshes.length; i++) p.meshes[i].material = FLASH; }
      }
    } else if (p.flashing) {
      p.flashing = false;
      if (p.meshes) { for (let i = 0; i < p.meshes.length; i++) p.meshes[i].material = p.meshes[i].userData.om; }
    }

    if (p.ragdoll) {
      const r = p.ragdoll;
      const floorOff = 0.32;
      if (!r.settled) {
        r.vy -= r.grav * dt;
        pos.x += r.vx * dt; pos.y += r.vy * dt; pos.z += r.vz * dt;
        p.g.rotation.x += r.rvx * dt;
        p.g.rotation.y += r.rvy * dt;
        p.g.rotation.z += r.rvz * dt;
        if (R.armL) R.armL.rotation.x = Math.sin(p.anim * 22) * 1.4 - 1.2;
        if (R.armR) R.armR.rotation.x = Math.cos(p.anim * 22) * 1.4 - 1.2;
        if (R.forearmL) R.forearmL.rotation.x = -0.65 - Math.abs(Math.cos(p.anim * 22)) * 0.75;
        if (R.forearmR) R.forearmR.rotation.x = -0.65 - Math.abs(Math.sin(p.anim * 22)) * 0.75;
        if (R.legL) R.legL.rotation.x = Math.sin(p.anim * 20) * 1.1;
        if (R.legR) R.legR.rotation.x = -Math.sin(p.anim * 20) * 1.1;
        if (R.kneeL) R.kneeL.rotation.x = 0.45 + Math.abs(Math.cos(p.anim * 20)) * 0.85;
        if (R.kneeR) R.kneeR.rotation.x = 0.45 + Math.abs(Math.sin(p.anim * 20)) * 0.85;
        if (pointInWall(pos.x, pos.z, pos.y)) {
          resolveCircle(pos, p.r);
          r.vx *= -0.55; r.vz *= -0.55;
          r.rvx *= 0.65; r.rvz *= 0.65;
          if (inR) burst(pos.x, pos.y + 0.5, pos.z, 0x9a8a78, 5, 5, 0.3, 0.14, 6);
        }
        const gy = getGroundY(pos.x, pos.z);
        if (pos.y <= gy + floorOff) {
          pos.y = gy + floorOff;
          if (r.vy < -2.5) {
            r.bounces++;
            if (inR && r.bounces <= 3) burst(pos.x, gy + 0.15, pos.z, 0x9a8a78, 5, 4, 0.35, 0.15, 6);
          }
          r.vy *= -0.45; r.vx *= 0.68; r.vz *= 0.68;
          r.rvx *= 0.45; r.rvy *= 0.45; r.rvz *= 0.45;
          if (Math.abs(r.vy) < 1.0) r.vy = 0;
          const rt = p.g.rotation, lk = Math.min(1, dt * 8);
          const layX = Math.PI / 2;
          rt.x = layX + Math.atan2(Math.sin(rt.x - layX), Math.cos(rt.x - layX));
          rt.z = Math.atan2(Math.sin(rt.z), Math.cos(rt.z));
          rt.x += (layX - rt.x) * lk; rt.z += (0 - rt.z) * lk;
          if (r.vy === 0 && (r.vx * r.vx + r.vz * r.vz) < 0.25) {
            r.vx = 0; r.vz = 0; r.rvx = 0; r.rvy = 0; r.rvz = 0;
            r.settled = true;
            r.recoverT = 1.2;
          }
        }
      } else {
        r.recoverT -= dt;
        const gy = getGroundY(pos.x, pos.z);
        pos.y = gy + floorOff;
        const rt = p.g.rotation, lk = Math.min(1, dt * 10);
        const layX = Math.PI / 2;
        rt.x += (layX - rt.x) * lk; rt.z += (0 - rt.z) * lk;
        if (r.recoverT <= 0) {
          p.ragdoll = null;
          p.g.rotation.order = 'XYZ';
          p.g.rotation.x = 0; p.g.rotation.z = 0;
          p.yaw = p.g.rotation.y;
          pos.y = gy;
          if (p.shadow && blobShadowsEnabled) p.shadow.visible = true;
        }
      }
      p.savedPos.copy(pos);
      p.savedYaw = p.g.rotation.y;
      return;
    }

    if (p.kv.lengthSq() > 0.01) {
      pos.x += p.kv.x * dt; pos.z += p.kv.z * dt;
      p.kv.multiplyScalar(Math.max(0, 1 - dt * 6));
      resolveCircle(pos, p.r);
    }

    // Verifica se algum inimigo está perseguindo este camponês (cacheado por 0.16s)
    p._chaserScanCd = (p._chaserScanCd || 0) - dt;
    let chaser = p._cachedChaser;
    if (p._chaserScanCd <= 0 || (chaser && (chaser.dead || chaser.downed || !chaser.inRender))) {
      p._chaserScanCd = 0.16;
      chaser = null;
      let bestD2 = 24 * 24;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.dead || e.downed || e.T.boss || !e.inRender) continue;
        const dx = e.g.position.x - pos.x, dz = e.g.position.z - pos.z;
        const d2 = dx * dx + dz * dz;
        if ((e.targetPeasant === p || d2 < 12 * 12) && d2 < bestD2) {
          bestD2 = d2;
          chaser = e;
        }
      }
      p._cachedChaser = chaser;
    }
    p.beingChased = !!chaser;

    let mvx = 0, mvz = 0, spd = 2.3;
    if (chaser) {
      p.waveT = 0;
      spd = 3.1;
      let fx = pos.x - chaser.g.position.x, fz = pos.z - chaser.g.position.z;
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl; fz /= fl;
      const hx = p.homeX - pos.x, hz = p.homeZ - pos.z, hl = Math.hypot(hx, hz) || 1;
      if (hl > 14) {
        const pull = Math.min(0.85, (hl - 14) / 14);
        fx = fx * (1 - pull) + (hx / hl) * pull + (-hz / hl) * p.orbitDir * 0.45;
        fz = fz * (1 - pull) + (hz / hl) * pull + (hx / hl) * p.orbitDir * 0.45;
      } else {
        fx += (-fz) * p.orbitDir * 0.35;
        fz += fx * p.orbitDir * 0.35;
      }
      if (pointInWall(pos.x + fx * 2.2, pos.z + fz * 2.2)) {
        p.orbitDir = -p.orbitDir;
        const ang = Math.atan2(fx, fz) + p.orbitDir * 1.4;
        fx = Math.sin(ang); fz = Math.cos(ang);
      }
      p.wanderAng = lerpAngle(p.wanderAng, Math.atan2(fx, fz), Math.min(1, dt * 8));
      p.yaw = p.wanderAng;
      mvx = Math.sin(p.wanderAng);
      mvz = Math.cos(p.wanderAng);
    } else if (p.waveT > 0) {
      p.waveT -= dt;
      const toPx = P.pos.x - pos.x, toPz = P.pos.z - pos.z;
      p.yaw = lerpAngle(p.yaw, Math.atan2(toPx, toPz), Math.min(1, dt * 10));
    } else {
      p.wanderT -= dt;
      if (p.pauseT > 0) {
        p.pauseT -= dt;
      } else {
        if (p.wanderT <= 0) {
          p.wanderT = rnd(1.8, 4.0);
          if (Math.random() < 0.22) p.pauseT = rnd(0.35, 0.85);
          const hx = p.homeX - pos.x, hz = p.homeZ - pos.z, hd = Math.hypot(hx, hz);
          if (hd > 13) p.wanderAng = Math.atan2(hx, hz) + rnd(-0.6, 0.6);
          else p.wanderAng += rnd(-1.6, 1.6);
        }
        const tx = Math.sin(p.wanderAng), tz = Math.cos(p.wanderAng);
        if (pointInWall(pos.x + tx * 2.0, pos.z + tz * 2.0)) {
          p.wanderAng += Math.PI * 0.7;
          p.wanderT = rnd(1.2, 2.4);
        } else {
          mvx = tx; mvz = tz;
        }
        p.yaw = lerpAngle(p.yaw, p.wanderAng, Math.min(1, dt * 7));
      }
    }

    const ml = Math.hypot(mvx, mvz);
    if (ml > 0.001) {
      pos.x += (mvx / ml) * spd * dt;
      pos.z += (mvz / ml) * spd * dt;
    }
    // Separação suave de outros camponeses
    for (let i = 0; i < peasants.length; i++) {
      const o = peasants[i];
      if (o === p || o.dead || !o.inRender) continue;
      const ox = pos.x - o.g.position.x, oz = pos.z - o.g.position.z;
      const md = p.r + o.r;
      if (Math.abs(ox) < md && Math.abs(oz) < md) {
        const d = Math.hypot(ox, oz) || 0.01;
        if (d < md) { const push = (md - d) * 0.5; pos.x += (ox / d) * push; pos.z += (oz / d) * push; }
      }
    }
    resolveCircle(pos, p.r);
    const gy = groundAt(pos.x, pos.z, pos.y + 1.0, p.r);
    pos.y += (gy - pos.y) * Math.min(1, dt * 16);
    p.g.rotation.y = p.yaw;
    p.savedPos.copy(pos);
    p.savedYaw = p.yaw;

    const moving = ml > 0.01;
    const pPh = p.anim * spd * 2.6;
    const sw = moving ? Math.sin(pPh) * 0.65 : 0;
    if (R.legL) {
      R.legL.rotation.x = sw; R.legR.rotation.x = -sw;
      if (R.kneeL) R.kneeL.rotation.x = moving ? Math.max(0.06, -Math.cos(pPh) * 0.82) : 0.06;
      if (R.kneeR) R.kneeR.rotation.x = moving ? Math.max(0.06, Math.cos(pPh) * 0.82) : 0.06;
    }
    if (R.armL && R.armR) {
      if (p.beingChased) {
        R.armL.rotation.x = -2.35 + Math.sin(p.anim * 15) * 0.42;
        R.armR.rotation.x = -2.35 - Math.sin(p.anim * 15) * 0.42;
        if (R.forearmL) R.forearmL.rotation.x = -0.85 + Math.cos(p.anim * 15) * 0.35;
        if (R.forearmR) R.forearmR.rotation.x = -0.85 - Math.cos(p.anim * 15) * 0.35;
        if (R.head) R.head.rotation.y = Math.sin(p.anim * 11) * 0.25;
      } else if (p.thankT > 0) {
        R.armL.rotation.x = -sw * 0.5;
        R.armR.rotation.x = -2.1 + Math.sin(p.anim * 12) * 0.28;
        if (R.forearmL) R.forearmL.rotation.x = -0.32;
        if (R.forearmR) R.forearmR.rotation.x = -0.85 + Math.sin(p.anim * 12 + 0.6) * 0.48;
        if (R.head) R.head.rotation.y = 0;
      } else {
        R.armL.rotation.x = -sw * 0.55;
        R.armR.rotation.x = sw * 0.55;
        if (R.forearmL) R.forearmL.rotation.x = -0.30 - Math.max(0, sw) * 0.35;
        if (R.forearmR) R.forearmR.rotation.x = -0.30 - Math.max(0, -sw) * 0.35;
        if (R.head) R.head.rotation.y = Math.sin(p.anim * 1.6) * 0.14;
      }
    }
  }

  let peasantLabelsEnabled = true;
  function setPeasantLabels(on) { peasantLabelsEnabled = !!on; }
  function updatePeasantLabels() {
    const W = window.innerWidth, H = window.innerHeight;
    for (let i = 0; i < peasants.length; i++) {
      const p = peasants[i];
      const el = p.labelEl;
      if (!el) continue;
      if (!peasantLabelsEnabled || p.dead || !p.inRender || p.thankT <= 0 || !S.started || S.ended) {
        el.classList.add('hidden');
        continue;
      }
      _projV.set(p.g.position.x, p.g.position.y + p.h + 0.55, p.g.position.z);
      _projV.project(camera);
      if (_projV.z >= -1 && _projV.z <= 1) {
        const x = clamp((_projV.x * 0.5 + 0.5) * W, 90, W - 90);
        const y = clamp((-_projV.y * 0.5 + 0.5) * H, 36, H - 36);
        el.classList.remove('hidden');
        el.style.left = Math.round(x) + 'px';
        el.style.top = Math.round(y) + 'px';
        el.style.opacity = p.thankT < 0.5 ? (p.thankT / 0.5).toFixed(2) : '1';
      } else {
        el.classList.add('hidden');
      }
    }
  }

  function killEnemy(e, kx, kz, ko) {
    if (e.dead) return;
    e.dead = true;
    if (e.grabbed) e.grabbed = false;
    if (P.grabbed === e) { P.grabbed = null; P.ramHitSet = null; }
    const c = e.g.position, T = e.T;
    const isBig = !!(T.boss || T.hp >= 200);
    const pitch = SCREAM_PITCH[T.model] || (isBig ? 0.5 : 1.0);
    SFX.play(isBig ? 'gib' : 'kill', pitch);
    if (T.model === 'maximus') {
      S.kills++;
      S.levelKills = (S.levelKills || 0) + 1;
      addStyle(T.pts * 0.8 + 18);
      registerStyleKill(e, ko);
      if (P.faithMode <= 0) addFaith(T.faith);
      if (WEAPONS[6].owned) P.blood = Math.min(AMMO_MAX.blood, P.blood + T.blood);
      S.maximusCorpse = e;
      const idx = enemies.indexOf(e);
      if (idx >= 0) enemies.splice(idx, 1);
      return;
    }
    if (ko && ko.noGore) bloodSpurt(c.x, c.y + e.h * 0.6, c.z, kx || 0, kz || 0, 6, 8, 3);
    else spawnGore(c.x, c.y, c.z, e.h, kx || 0, kz || 0, isBig);
    if (window.BloodStain) {
      const kd = Math.hypot(c.x - P.pos.x, c.z - P.pos.z);
      const prox = kd < 4.5 ? 0.22 : kd < 9 ? 0.12 : kd < 16 ? 0.05 : 0.02;
      const wObj = WEAPONS[curW];
      const wId = (ko && ko.weapon) || (e.kicked ? 'kick' : (wObj && (wObj.melee || kd < 8.5) ? wObj.id : null));
      BloodStain.addBlood(prox * (isBig ? 1.4 : 1), wId, wId ? Math.max(0.14, prox * 1.1) : 0);
    }
    burst(c.x, c.y + e.h * 0.7, c.z, 0xffcc40, 3, 6, 0.5, 0.15, 10);
    S.kills++;
    S.levelKills = (S.levelKills || 0) + 1;
    addStyle(T.pts * 0.8 + 12);
    registerStyleKill(e, ko);
    if (P.faithMode <= 0) addFaith(T.faith);
    if (WEAPONS[6].owned) P.blood = Math.min(AMMO_MAX.blood, P.blood + T.blood);
    quip();
    // Verifica se o inimigo morto estava perseguindo algum camponês
    if (!T.boss) {
      let savedP = (e.targetPeasant && !e.targetPeasant.dead) ? e.targetPeasant
                 : (e.lastPeasant && e.lastPeasantT > 0 && !e.lastPeasant.dead) ? e.lastPeasant : null;
      if (!savedP) {
        let bestD = 18;
        for (let i = 0; i < peasants.length; i++) {
          const p = peasants[i];
          if (p.dead || !p.inRender) continue;
          const d = Math.hypot(p.g.position.x - c.x, p.g.position.z - c.z);
          if (d < bestD) { bestD = d; savedP = p; }
        }
      }
      if (savedP) rescuePeasant(savedP);
    }
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
    const tp = (e.targetPeasant && !e.targetPeasant.dead && e.targetPeasant.inRender) ? e.targetPeasant : null;
    if (e.ranged) {
      const R = T.ranged;
      const o = new V3(e.g.position.x, e.g.position.y + e.h * 0.7, e.g.position.z);
      const tgt = tp ? new V3(tp.g.position.x, tp.g.position.y + 1.2, tp.g.position.z) : new V3(P.pos.x, P.pos.y + 1.3, P.pos.z);
      const dir = tgt.sub(o).normalize();
      spawnProj(R.proj, o, dir.multiplyScalar(R.speed), R.dmg, 'e', R.proj === 'hex' ? 0.5 : 0.35, 5, 0);
      SFX.play(R.proj === 'hex' ? 'hex' : 'fire');
      e.cd = R.cd * rnd(0.8, 1.3);
      e.ranged = false;
    } else {
      const M = T.melee;
      SFX.play('swing');
      if (tp && dist <= M.range + e.r + 1.1) {
        hitPeasant(tp, e.g.position.x, e.g.position.z);
      }
      const pDist = Math.hypot(P.pos.x - e.g.position.x, P.pos.z - e.g.position.z);
      if (pDist <= M.range + e.r + 1.3) hurtPlayer(M.dmg, e.g.position.x, e.g.position.z, T.boss ? 12 : 6);
      e.cd = M.cd * rnd(0.85, 1.2);
    }
    e.recover = 0.35;
  }

  function spawnGaliusDroppedCross(e) {
    if (e.droppedCross) return;
    const g = new THREE.Group();
    const s = 3.55;
    const mGold = new THREE.MeshLambertMaterial({ color: 0xd4a017, emissive: 0x3a2800 });
    const mGlow = new THREE.MeshBasicMaterial({ color: 0xfff0a0 });
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 3.4 * s, 0.28 * s), mGold);
    shaft.position.set(0, 0, 0);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 0.28 * s, 0.28 * s), mGold);
    bar.position.set(0, 0.9 * s, 0);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.34 * s, 0.34 * s, 0.34 * s), mGlow);
    core.position.set(0, 0.9 * s, 0);
    g.add(shaft, bar, core);
    const rx = Math.cos(e.yaw), rz = -Math.sin(e.yaw);
    const cx = e.g.position.x + rx * 2.9 + Math.sin(e.yaw) * 1.1;
    const cz = e.g.position.z + rz * 2.9 + Math.cos(e.yaw) * 1.1;
    const gy = groundAt(cx, cz, e.g.position.y + 1.5, 1.0);
    g.position.set(cx, gy + 0.42, cz);
    g.rotation.order = 'YXZ';
    g.rotation.set(Math.PI * 0.5, e.yaw + 0.35, 0.25);
    scene.add(g);
    e.droppedCross = g;
    if (e.rig && e.rig.weapon) e.rig.weapon.visible = false;
    burst(cx, gy + 0.5, cz, 0x6a5a4a, 16, 8, 0.7, 0.35, 14, false);
    SFX.play('slam');
    S.shakeBig = Math.max(S.shakeBig || 0, 0.45);
  }
  function ensureGaliusBloodBeam(e) {
    if (e.bloodBeamMesh) return e.bloodBeamMesh;
    const grp = new THREE.Group();
    const coreGeo = new THREE.CylinderGeometry(0.24, 0.34, 1, 10, 1, true);
    coreGeo.translate(0, 0.5, 0);
    coreGeo.rotateX(Math.PI * 0.5);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff1a24, transparent: true, opacity: 0.95 });
    const auraGeo = new THREE.CylinderGeometry(0.56, 0.78, 1, 10, 1, true);
    auraGeo.translate(0, 0.5, 0);
    auraGeo.rotateX(Math.PI * 0.5);
    const auraMat = new THREE.MeshBasicMaterial({ color: 0x7a020a, transparent: true, opacity: 0.55, depthWrite: false });
    const core = new THREE.Mesh(coreGeo, coreMat);
    const aura = new THREE.Mesh(auraGeo, auraMat);
    grp.add(aura, core);
    grp.userData.core = core;
    grp.userData.aura = aura;
    scene.add(grp);
    e.bloodBeamMesh = grp;
    return grp;
  }
  function pointSegDistSq3D(px, py, pz, ax, ay, az, bx, by, bz) {
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const lenSq = abx * abx + aby * aby + abz * abz || 0.0001;
    let t = ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / lenSq;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const cx = ax + abx * t - px, cy = ay + aby * t - py, cz = az + abz * t - pz;
    return cx * cx + cy * cy + cz * cz;
  }

  function updateGaliusIntro(e, dt) {
    const pos = e.g.position;
    const targetZ = -148.2;
    e.galiusIntroT = (e.galiusIntroT || 0) + dt;
    if (e.galiusIntro === 'burst') {
      e.yaw = lerpAngle(e.yaw, 0, Math.min(1, dt * 8));
      e.g.rotation.y = e.yaw;
      animEnemy(e, dt, false);
      if (e.galiusIntroT >= 0.65 && !e._burstedWall) {
        e._burstedWall = true;
        const bw = World.breakWall;
        if (bw) { bw.visible = false; bw.userData.col.active = false; }
        burst(0, 6, -150, 0x55506a, 65, 20, 1.6, 0.75, 16, false);
        burst(0, 6, -150, 0xffa040, 22, 14, 0.8, 0.35, 12);
        SFX.play('boom');
        S.shakeBig = Math.max(S.shakeBig || 0, 1.5);
        if (e.onGaliusBurst) { e.onGaliusBurst(); e.onGaliusBurst = null; }
      }
      if (e.galiusIntroT >= 1.25) {
        e.galiusIntro = 'walk';
        e.galiusIntroT = 0;
      }
    } else if (e.galiusIntro === 'walk') {
      pos.z = Math.min(targetZ, pos.z + e.T.speed * dt);
      const ty = pos.z >= -150.0 ? 1.85 : getGroundY(pos.x, pos.z);
      pos.y += (ty - pos.y) * Math.min(1, dt * 8);
      e.yaw = lerpAngle(e.yaw, 0, Math.min(1, dt * 8));
      e.g.rotation.y = e.yaw;
      animEnemy(e, dt, true);
      if (pos.z >= targetZ - 0.05) {
        pos.z = targetZ;
        e.galiusIntro = 'grab';
        e.galiusIntroT = 0;
      }
    } else if (e.galiusIntro === 'grab') {
      pos.y += (1.85 - pos.y) * Math.min(1, dt * 8);
      e.yaw = lerpAngle(e.yaw, 0, Math.min(1, dt * 8));
      e.g.rotation.y = e.yaw;
      animEnemy(e, dt, false);
      if (e.galiusIntroT >= 0.60 && !e._grabbedCross) {
        e._grabbedCross = true;
        if (World.altarCross) World.altarCross.visible = false;
        if (e.rig && e.rig.weapon) e.rig.weapon.visible = true;
        burst(0, 7, -146.5, 0xffd060, 30, 12, 0.9, 0.35, 12);
        SFX.play('cross');
        S.shakeBig = Math.max(S.shakeBig || 0, 0.8);
      }
      if (e.galiusIntroT >= 1.15) {
        e.galiusIntro = 'roar';
        e.galiusIntroT = 0;
        SFX.play('roar');
        S.shakeBig = Math.max(S.shakeBig || 0, 1.3);
        spawnRing(pos.x, pos.z, 16, 26, 0, 0xff2818, 'e');
        if (e.onGaliusRoar) { e.onGaliusRoar(); e.onGaliusRoar = null; }
      }
    } else if (e.galiusIntro === 'roar') {
      pos.y += (1.85 - pos.y) * Math.min(1, dt * 8);
      e.yaw = lerpAngle(e.yaw, 0, Math.min(1, dt * 8));
      e.g.rotation.y = e.yaw;
      animEnemy(e, dt, false);
      if (e.galiusIntroT >= 8.0 || (S.cutscene <= 0 && e.galiusIntroT >= 1.65)) {
        e.galiusIntro = null;
        e.aggro = true;
        e.cd = 1.0;
        if (e.onGaliusGrab) { e.onGaliusGrab(); e.onGaliusGrab = null; }
      }
    }
    if (e.shadow && blobShadowsEnabled) {
      e.shadow.position.y = (groundAt(pos.x, pos.z, pos.y + 1.0, e.r) - pos.y) + 0.04;
    }
    e.savedPos.copy(pos);
    e.savedYaw = e.yaw;
  }

  function updateMaximusIntro(e, dt) {
    const pos = e.g.position;
    const R = e.rig;
    const gy = groundAt(pos.x, pos.z, 4, e.r);
    e.maximusIntroT = (e.maximusIntroT || 0) + dt;
    e.yaw = lerpAngle(e.yaw, 0, Math.min(1, dt * 10));
    e.g.rotation.y = e.yaw;

    if (e.maximusIntro === 'fall') {
      e.fallVel = (e.fallVel || 0) - 82 * dt;
      pos.y += e.fallVel * dt;
      if (pos.y <= gy) {
        pos.y = gy;
        e.fallVel = 0;
        e.maximusIntro = 'land';
        e.maximusIntroT = 0;
        SFX.play('boom');
        SFX.play('slam');
        S.shakeBig = Math.max(S.shakeBig || 0, 1.35);
        burst(pos.x, gy + 0.6, pos.z, 0xff4010, 42, 14, 1.0, 0.45, 14);
        burst(pos.x, gy + 0.4, pos.z, 0x6a5a4a, 28, 10, 0.9, 0.4, 12, false);
        spawnRing(pos.x, pos.z, 14, 24, 0, 0xff3010, 'e');
      }
    } else if (e.maximusIntro === 'land') {
      pos.y = gy;
      if (e.maximusIntroT >= 0.85) {
        e.maximusIntro = 'unsheathe';
        e.maximusIntroT = 0;
      }
    } else if (e.maximusIntro === 'unsheathe') {
      pos.y = gy;
      if (e.maximusIntroT >= 0.42 && R.sword && !R.sword.visible) {
        R.sword.visible = true;
        SFX.play('swing');
        SFX.play('parry');
        burst(pos.x + 1.2, gy + 2.2, pos.z + 0.8, 0xffe080, 14, 6, 0.4, 0.16, 8);
      }
      if (e.maximusIntroT >= 1.35) {
        e.maximusIntro = 'pose';
        e.maximusIntroT = 0;
        SFX.play('roar');
        S.shakeBig = Math.max(S.shakeBig || 0, 0.9);
        if (e.onMaximusReady) { e.onMaximusReady(); e.onMaximusReady = null; }
      }
    } else if (e.maximusIntro === 'pose') {
      pos.y = gy;
      if (e.maximusIntroT >= 15.0 || (S.cutscene <= 0 && e.maximusIntroT >= 1.15)) {
        e.maximusIntro = null;
        if (R.sword) R.sword.visible = true;
        e.phase = 1;
        e.aggro = true;
        e.cd = 0.5;
        e.slideCd = 1.4;
        e.pirCd = 0.8;
        if (e.onMaximusDone) { e.onMaximusDone(); e.onMaximusDone = null; }
      }
    }
    animEnemy(e, dt, false);
    if (e.shadow && blobShadowsEnabled) {
      e.shadow.position.y = (gy - pos.y) + 0.04;
    }
    e.savedPos.copy(pos);
    e.savedYaw = e.yaw;
  }

  /* ---------------- Sérgio Maximo & Galius: destroem pilastras + pathfinding do menor caminho ---------------- */
  function isPillarBreaker(e) {
    const m = e.T && e.T.model;
    return (m === 'galius' || m === 'maximus') && !e.dead;
  }

  function breakPillar(p, e) {
    if (p.broken) return;
    p.broken = true;
    if (p.col) p.col.active = false;
    p.mesh.visible = false;
    if (p.rubble) p.rubble.visible = true;
    if (p.flame) {
      p.flame.visible = false;
      const fi = World.flames.findIndex(f => f && f.g === p.flame);
      if (fi >= 0) World.flames.splice(fi, 1);
    }
    const base = p.y0 || 0;
    for (let k = 0; k < 4; k++) {
      const y = base + 0.5 + (p.h - 1) * (k / 3);
      burst(p.x, y, p.z, 0x8a7a68, 14, 10, 0.9, 0.5, 18, false);
    }
    burst(p.x, base + 1.0, p.z, 0xc8b8a0, 18, 7, 0.7, 0.35, 12, false);
    SFX.play('boom');
    S.shakeBig = Math.max(S.shakeBig || 0, 0.55);
    // Estilhaços ferem Nivaldo se estiver colado
    const pd = Math.hypot(P.pos.x - p.x, P.pos.z - p.z);
    if (pd < 4.5 && !P.dead) hurtPlayer(8, p.x, p.z, 8);
  }

  // Quebra qualquer pilastra tocada pelo corpo do chefe
  function bossBreakPillars(e, pos) {
    const pl = World.pillars;
    if (!pl || !pl.length) return;
    const r = e.r + 0.2;
    for (let i = 0; i < pl.length; i++) {
      const p = pl[i];
      if (p.broken) continue;
      if (pos.x < p.x1 - r || pos.x > p.x2 + r || pos.z < p.z1 - r || pos.z > p.z2 + r) continue;
      const cx = clamp(pos.x, p.x1, p.x2), cz = clamp(pos.z, p.z1, p.z2);
      if ((pos.x - cx) * (pos.x - cx) + (pos.z - cz) * (pos.z - cz) <= r * r) breakPillar(p, e);
    }
  }

  function bossResolve(e, pos) {
    if (isPillarBreaker(e)) bossBreakPillars(e, pos);
    resolveCircle(pos, e.r);
  }

  // Colisor que realmente bloqueia o chefe (pilastras contam como livres, pois serão quebradas)
  const _navTmp = [];
  function navBlocked(x, z, r) {
    const cs = World.queryColliders(x - r, z - r, x + r, z + r, _navTmp);
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c.active || c.pillar) continue;
      if (c.walkable && c.yMax != null && c.yMax <= 1.2) continue;
      const cx = clamp(x, c.x1, c.x2), cz = clamp(z, c.z1, c.z2);
      if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r) return true;
    }
    return false;
  }
  function navLos(ax, az, bx, bz, r) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / 1.2));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (navBlocked(ax + (bx - ax) * t, az + (bz - az) * t, r)) return false;
    }
    return true;
  }
  function bossLos(e, ax, az, bx, bz) {
    return isPillarBreaker(e) ? navLos(ax, az, bx, bz, Math.min(e.r, 1.2) * 0.6) : los(ax, az, bx, bz);
  }

  // A* em grade 8-direções: menor caminho, atravessando pilastras e contornando paredes sólidas
  function navFindPath(sx, sz, gx, gz, rad) {
    const CELL = 2.0;
    const pad = 16;
    let minX = Math.min(sx, gx) - pad, maxX = Math.max(sx, gx) + pad;
    let minZ = Math.min(sz, gz) - pad, maxZ = Math.max(sz, gz) + pad;
    const W = Math.min(110, Math.ceil((maxX - minX) / CELL)), H = Math.min(110, Math.ceil((maxZ - minZ) / CELL));
    const cell = (x, z) => ({ i: clamp(Math.floor((x - minX) / CELL), 0, W - 1), j: clamp(Math.floor((z - minZ) / CELL), 0, H - 1) });
    const cx = (i) => minX + (i + 0.5) * CELL, cz = (j) => minZ + (j + 0.5) * CELL;
    const N = W * H;
    const blockedC = new Int8Array(N); // 0 desconhecido, 1 livre, 2 bloqueado
    const isBlocked = (i, j) => {
      const k = j * W + i;
      if (!blockedC[k]) blockedC[k] = navBlocked(cx(i), cz(j), rad) ? 2 : 1;
      return blockedC[k] === 2;
    };
    const s = cell(sx, sz), g = cell(gx, gz);
    const gScore = new Float32Array(N).fill(1e9);
    const from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = [];
    const push = (k, f) => {
      heap.push([f, k]);
      let c = heap.length - 1;
      while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = c * 2 + 1, r = l + 1; let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          const t = heap[m]; heap[m] = heap[c]; heap[c] = t; c = m;
        }
      }
      return top[1];
    };
    const sk = s.j * W + s.i, gk = g.j * W + g.i;
    gScore[sk] = 0;
    push(sk, 0);
    blockedC[sk] = 1; blockedC[gk] = 1; // início/fim sempre transitáveis
    const h = (i, j) => { const dx = Math.abs(i - g.i), dz = Math.abs(j - g.j); return (dx + dz + (1.4142 - 2) * Math.min(dx, dz)) * CELL; };
    let found = false, iter = 0;
    while (heap.length && iter++ < 9000) {
      const k = pop();
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === gk) { found = true; break; }
      const ci = k % W, cj = (k / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const nk = nj * W + ni;
        if (closed[nk] || isBlocked(ni, nj)) continue;
        if (di && dj && (isBlocked(ci + di, cj) || isBlocked(ci, cj + dj))) continue; // sem cortar quinas
        const ng = gScore[k] + (di && dj ? 1.4142 : 1) * CELL;
        if (ng < gScore[nk]) { gScore[nk] = ng; from[nk] = k; push(nk, ng + h(ni, nj)); }
      }
    }
    if (!found) return null;
    const raw = [];
    for (let k = gk; k !== -1; k = from[k]) raw.push({ x: cx(k % W), z: cz((k / W) | 0) });
    raw.reverse();
    raw[raw.length - 1] = { x: gx, z: gz };
    // string-pulling: mantém só os waypoints necessários (caminho mais curto e reto)
    const out = [];
    let ax = sx, az = sz, idx = 0;
    while (idx < raw.length) {
      let far = idx;
      for (let q = raw.length - 1; q > idx; q--) {
        if (navLos(ax, az, raw[q].x, raw[q].z, rad)) { far = q; break; }
      }
      out.push(raw[far]);
      ax = raw[far].x; az = raw[far].z; idx = far + 1;
    }
    return out;
  }

  // Retorna o ponto para onde o chefe deve andar agora (caminho mais curto até Nivaldo)
  function bossWaypoint(e, pos, tx, tz, dt) {
    const rad = Math.min(e.r, 1.6) * 0.8;
    e.navT = (e.navT || 0) - dt;
    if (navLos(pos.x, pos.z, tx, tz, rad)) { e.navPath = null; return { x: tx, z: tz }; }
    const moved = e.navGoal ? Math.hypot(tx - e.navGoal.x, tz - e.navGoal.z) : 1e9;
    if (!e.navPath || e.navT <= 0 || moved > 3) {
      e.navT = 0.3;
      e.navGoal = { x: tx, z: tz };
      e.navPath = navFindPath(pos.x, pos.z, tx, tz, rad);
    }
    const path = e.navPath;
    if (!path || !path.length) return { x: tx, z: tz };
    while (path.length > 1 && Math.hypot(path[0].x - pos.x, path[0].z - pos.z) < 1.8) path.shift();
    // atalho: se já enxerga um waypoint adiante, pula
    if (path.length > 1 && navLos(pos.x, pos.z, path[1].x, path[1].z, rad)) path.shift();
    return path[0];
  }

  function updateEnemyVertical(e, pos, dt, dist) {
    const T = e.T;
    const canFly = T.flying && !e.wingsLost && !e.crawling;
    if (canFly && !e.kneel) {
      const swoop = T.model === 'gargula' && (e.state === 'wind' || dist < 4.2);
      const baseGy = getGroundY(pos.x, pos.z);
      const ty = swoop ? Math.max(baseGy + 0.8, P.pos.y + 1.1) : (baseGy + T.hover + Math.sin(e.anim * 2 + e.strafe) * 0.5);
      pos.y += (ty - pos.y) * Math.min(1, dt * (swoop ? 6 : 2));
      if (e.shadow && blobShadowsEnabled) e.shadow.position.y = (baseGy - pos.y) + 0.04;
    } else if (!canFly && !e.downed && !e.kneel) {
      const gy = groundAt(pos.x, pos.z, pos.y + 1.0, e.r);
      if (pos.y > gy + 0.05) {
        e.fallVel = (e.fallVel || 0) - 28 * dt;
        pos.y += e.fallVel * dt;
        if (pos.y <= gy) {
          pos.y = gy;
          if (e.fallVel < -4) {
            SFX.play('hit', 'general');
            burst(pos.x, gy + 0.15, pos.z, 0x6a5a4a, 8, 5, 0.45, 0.22, 12, false);
          }
          e.fallVel = 0;
        }
      } else {
        e.fallVel = 0;
        pos.y += (gy - pos.y) * Math.min(1, dt * 16);
      }
      if (e.shadow && blobShadowsEnabled) e.shadow.position.y = (gy - pos.y) + 0.04;
    }
  }

  function updateMaximusPhaseTrans(e, dt) {
    const pos = e.g.position;
    const R = e.rig;
    const gy = groundAt(pos.x, pos.z, pos.y + 1.5, e.r);
    pos.y = gy;
    e.phaseTransT = (e.phaseTransT || 0) + dt;
    const t = e.phaseTransT;
    if (t >= 0.35 && !e._transSaid) {
      e._transSaid = true;
      say('"Hehe... Nada mal, Nivaldo! Mas você esqueceu do poder que Satã me deu!"', 'SÉRGIO MAXIMO', 3.4);
    }
    if (t >= 1.85 && !e._transHelmetOff) {
      e._transHelmetOff = true;
      if (R.helmetGroup) R.helmetGroup.visible = false;
      if (R.flameHead) R.flameHead.visible = true;
      SFX.play('fire');
      burst(pos.x, pos.y + e.h * 0.85, pos.z, 0xff5500, 34, 11, 0.8, 0.35, 14);
      burst(pos.x, pos.y + e.h * 0.85, pos.z, 0xffcc30, 18, 8, 0.6, 0.25, 10);
    }
    if (t >= 3.10 && !e._transIgnited) {
      e._transIgnited = true;
      e.kneel = false;
      e.swordGlow = true;
      SFX.play('roar');
      S.shakeBig = Math.max(S.shakeBig || 0, 0.9);
      spawnRing(pos.x, pos.z, 14, 24, 0, 0xff1828, 'e');
      say('"AGORA SINTA A VERDADEIRA CHAMA DO INFERNO!"', 'SÉRGIO MAXIMO', 3.2);
    }
    if (t >= 5.10) {
      e.phase = 2;
      e.invuln = false;
      const p2Hp = Math.max(1, Math.round(1100 * getDifficulty().dmgMul));
      e.maxhp = p2Hp;
      e.hp = p2Hp;
      e.state = 'move';
      e.kneel = false;
      e.cd = 0.45;
      e.leapCd = 0.8;
      e.leapCount = 0;
      e.chargeCd = 2.5;
    }
    animEnemy(e, dt, false);
    if (e.shadow && blobShadowsEnabled) e.shadow.position.y = (gy - pos.y) + 0.04;
    e.savedPos.copy(pos);
    e.savedYaw = e.yaw;
  }

  function updateMaximusCombat(e, dt, pos, dist, dx, dz, nx, nz, pDist) {
    const T = e.T;
    const p2 = (e.phase === 2);
    e.cd -= dt;
    e.slideCd = Math.max(0, (e.slideCd || 0) - dt);
    e.pirCd = Math.max(0, (e.pirCd || 0) - dt);
    e.leapCd = Math.max(0, (e.leapCd || 0) - dt);
    e.chargeCd = Math.max(0, (e.chargeCd || 0) - dt);
    if (e.impCd === undefined) e.impCd = 3.5;
    e.impCd = Math.max(0, e.impCd - dt);
    e.rushCd = Math.max(0, (e.rushCd || 0) - dt);

    if (e.state !== 'mSlide' && e.state !== 'mLeap' && e.state !== 'mStuck' && e.state !== 'charge' &&
        e.state !== 'mRush' && e.state !== 'mImpaleDash' && e.state !== 'mImpaled' && e.state !== 'mImpaleMiss') {
      e.yaw = lerpAngle(e.yaw, Math.atan2(dx, dz), Math.min(1, dt * (p2 ? 7 : 12)));
    }
    let mvx = 0, mvz = 0, spd = p2 ? 6.2 : 7.4;
    const gy = groundAt(pos.x, pos.z, pos.y + 1.5, e.r);

    switch (e.state) {
      case 'move': {
        if (!p2) {
          // Fase 1: ágil, esgrima, rodeios rápidos
          if (dist > 5.0) {
            mvx = nx * 0.85 - nz * e.strafe * 0.65;
            mvz = nz * 0.85 + nx * e.strafe * 0.65;
          } else {
            mvx = -nz * e.strafe * 0.9;
            mvz = nx * e.strafe * 0.9;
          }
          if (e.cd <= 0) {
            const sLos = bossLos(e, pos.x, pos.z, P.pos.x, P.pos.z);
            const canImp = dist > 7 && dist < 24 && sLos && e.impCd <= 0;
            const canRush = dist > 6 && dist < 26 && sLos && e.rushCd <= 0;
            if (canImp && (!canRush || e.flipSpecial)) {
              e.state = 'mImpaleWind'; e.st = 0.62; e.flipSpecial = false;
              SFX.play('parry');
            } else if (canRush) {
              e.state = 'mRushWind'; e.st = 0.5; e.flipSpecial = true;
            } else if (dist > 6.5 && dist < 24 && e.slideCd <= 0 && sLos) {
              e.state = 'mSlideWind'; e.st = 0.22;
              const flank = (Math.random() < 0.5 ? 1 : -1) * 0.28;
              e.cdir.set(nx - nz * flank, 0, nz + nx * flank).normalize();
            } else if (dist <= 11.5 && e.pirCd <= 0) {
              e.state = 'mPirWind'; e.st = 0.24;
            } else if (dist <= 9.0) {
              e.state = 'mLungeWind'; e.st = 0.24;
              e.cdir.set(nx, 0, nz);
            }
          }
        } else {
          // Fase 2: direto, implacável, sem floreios
          if (dist > 4.2) { mvx = nx; mvz = nz; }
          if (e.cd <= 0) {
            if (e.leapCd <= 0 && dist > 4.5 && dist < 34) {
              e.state = 'mLeapWind'; e.st = 0.36;
            } else if (dist <= 5.6) {
              e.state = 'mCleaveWind'; e.st = 0.36;
            } else if (e.chargeCd <= 0 && dist > 6 && dist < 22 && bossLos(e, pos.x, pos.z, P.pos.x, P.pos.z)) {
              e.state = 'chargeWind'; e.st = 0.45;
            }
          }
        }
        break;
      }
      // --- FASE 1: SLIDE ---
      case 'mSlideWind':
        e.st -= dt;
        if (e.st <= 0) { e.state = 'mSlide'; e.st = 0.52; e.hit = false; SFX.play('swing'); }
        break;
      case 'mSlide':
        e.st -= dt;
        mvx = e.cdir.x; mvz = e.cdir.z; spd = 23;
        e.yaw = Math.atan2(e.cdir.x, e.cdir.z);
        if (!e.hit && pDist <= 4.4) { hurtPlayer(24, pos.x, pos.z, 10); e.hit = true; SFX.play('hit'); }
        if (e.st <= 0) {
          e.state = 'move'; e.slideCd = 2.6; e.cd = 0.42; e.strafe = -e.strafe;
        }
        break;
      // --- FASE 1: INVESTIDA (rusha em cima do Nivaldo, persegue em curva) ---
      case 'mRushWind':
        e.st -= dt;
        if (Math.random() < dt * 40) burst(pos.x, pos.y + 0.2, pos.z, 0x6a5a4a, 2, 3, 0.3, 0.15, 6, false);
        if (e.st <= 0) { e.state = 'mRush'; e.st = 1.2; e.hit = false; SFX.play('roar'); }
        break;
      case 'mRush': {
        e.st -= dt;
        e.yaw = lerpAngle(e.yaw, Math.atan2(dx, dz), Math.min(1, dt * 2.8));
        e.cdir.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
        mvx = e.cdir.x; mvz = e.cdir.z; spd = 21.5;
        if (Math.random() < dt * 34) burst(pos.x, pos.y + 0.2, pos.z, 0x6a5a4a, 2, 3, 0.3, 0.15, 6, false);
        if (!e.hit && pDist <= 3.7) {
          hurtPlayer(26, pos.x, pos.z, 18); e.hit = true; SFX.play('hit');
          S.shakeBig = Math.max(S.shakeBig || 0, 0.5);
          e.st = Math.min(e.st, 0.3);
        }
        if (e.st <= 0) { e.state = 'move'; e.rushCd = 3.8; e.cd = 0.5; e.recover = 0.28; e.strafe = -e.strafe; }
        break;
      }
      // --- FASE 1: ESTOCADA EMPALADORA (se acertar: empala, gira e arremessa) ---
      case 'mImpaleWind':
        e.st -= dt;
        if (Math.random() < dt * 30) burst(pos.x + Math.sin(e.yaw) * 1.5, pos.y + 1.6, pos.z + Math.cos(e.yaw) * 1.5, 0xffd8a0, 1, 3, 0.25, 0.1, 6);
        if (e.st <= 0) {
          e.state = 'mImpaleDash'; e.st = 0.62; e.hit = false;
          e.cdir.set(nx, 0, nz); SFX.play('swing'); SFX.play('roar');
        }
        break;
      case 'mImpaleDash': {
        e.st -= dt;
        const wantY = Math.atan2(dx, dz), curY = Math.atan2(e.cdir.x, e.cdir.z);
        const newY = lerpAngle(curY, wantY, Math.min(1, dt * 1.6));
        e.cdir.set(Math.sin(newY), 0, Math.cos(newY));
        e.yaw = newY;
        mvx = e.cdir.x; mvz = e.cdir.z; spd = 31;
        if (!e.hit && pDist <= 3.4) {
          e.hit = true;
          if (startImpale && startImpale(e)) { mvx = 0; mvz = 0; break; }
        }
        if (e.st <= 0) {
          e.state = 'mImpaleMiss'; e.st = 1.0; e.impCd = 6;
          SFX.play('slam');
          burst(pos.x + Math.sin(e.yaw) * 2, pos.y + 0.3, pos.z + Math.cos(e.yaw) * 2, 0x6a5a4a, 12, 7, 0.5, 0.25, 8, false);
        }
        break;
      }
      case 'mImpaled':
        // controlado pela cutscene de empalamento (game2.js)
        if (!S.impale) { e.state = 'move'; e.cd = 0.8; }
        break;
      case 'mImpaleMiss':
        e.st -= dt;
        if (e.st <= 0) { e.state = 'move'; e.cd = 0.5; }
        break;
      // --- FASE 1: PIRUETA ---
      case 'mPirWind':
        e.st -= dt;
        if (e.st <= 0) { e.state = 'mPir'; e.st = 0.62; e.pirHits = 0; SFX.play('swing'); }
        break;
      case 'mPir':
        e.st -= dt;
        mvx = nx; mvz = nz; spd = 13.5;
        if (e.pirHits === 0 && e.st <= 0.44) {
          e.pirHits = 1; SFX.play('swing');
          if (pDist <= 5.0) hurtPlayer(18, pos.x, pos.z, 8);
        } else if (e.pirHits === 1 && e.st <= 0.18) {
          e.pirHits = 2; SFX.play('swing');
          if (pDist <= 5.0) hurtPlayer(20, pos.x, pos.z, 10);
        }
        if (e.st <= 0) { e.state = 'move'; e.pirCd = 2.2; e.cd = 0.45; }
        break;
      // --- FASE 1: ESGRIMA (ESTCADA RÁPIDA) ---
      case 'mLungeWind':
        e.st -= dt;
        if (e.st <= 0) { e.state = 'mLunge'; e.st = 0.24; e.hit = false; e.cdir.set(nx, 0, nz); SFX.play('swing'); }
        break;
      case 'mLunge':
        e.st -= dt;
        mvx = e.cdir.x; mvz = e.cdir.z; spd = 26;
        if (!e.hit && pDist <= 4.8) { hurtPlayer(25, pos.x, pos.z, 10); e.hit = true; SFX.play('parry'); }
        if (e.st <= 0) { e.state = 'move'; e.cd = 0.62; e.recover = 0.22; }
        break;
      // --- FASE 2: SALTO PARA CRAVAR A ESPADA ---
      case 'mLeapWind':
        e.st -= dt;
        if (e.st <= 0) {
          e.state = 'mLeap';
          e.st = 1.4;
          e.vy = 18.5;
          const leapSpd = clamp(dist * 1.1, 10, 23);
          e.leapVx = nx * leapSpd;
          e.leapVz = nz * leapSpd;
          SFX.play('roar');
        }
        break;
      case 'mLeap': {
        e.st -= dt;
        e.vy = (e.vy || 0) - 42 * dt;
        pos.x += (e.leapVx || 0) * dt;
        pos.z += (e.leapVz || 0) * dt;
        pos.y += e.vy * dt;
        bossResolve(e, pos);
        const curGy = groundAt(pos.x, pos.z, pos.y + 2.0, e.r);
        if (pos.y <= curGy && e.vy <= 0) {
          pos.y = curGy;
          e.vy = 0;
          SFX.play('slam'); SFX.play('boom');
          S.shakeBig = Math.max(S.shakeBig || 0, 0.9);
          spawnRing(pos.x, pos.z, 13, 22, 0, 0xff2020, 'e');
          burst(pos.x, curGy + 0.5, pos.z, 0xff4010, 26, 12, 0.7, 0.3, 12);
          burst(pos.x, curGy + 0.3, pos.z, 0x6a5a4a, 20, 9, 0.7, 0.35, 10, false);
          if (pDist <= 4.9) hurtPlayer(38, pos.x, pos.z, 14);
          e.leapCount = (e.leapCount || 0) + 1;
          if (e.leapCount % 2 === 0) {
            e.state = 'mStuck';
            e.st = 2.6;
            say('A espada de Sérgio Maximo ficou presa no chão! Ataque agora!', '', 2.4);
          } else {
            e.state = 'move';
            e.cd = 0.65;
            e.leapCd = 2.6;
          }
        }
        break;
      }
      // --- FASE 2: ESPADA PRESA NO CHÃO (VULNERÁVEL) ---
      case 'mStuck':
        e.st -= dt;
        pos.y = gy;
        if (Math.random() < dt * 8) burst(pos.x + Math.sin(e.yaw) * 1.1, gy + 0.3, pos.z + Math.cos(e.yaw) * 1.1, 0xff4020, 2, 4, 0.3, 0.12, 6);
        if (e.st <= 0) {
          SFX.play('parry');
          burst(pos.x, gy + 1.0, pos.z, 0xff5020, 14, 7, 0.45, 0.18, 9);
          e.state = 'move';
          e.cd = 0.5;
          e.leapCd = 2.4;
        }
        break;
      // --- FASE 2: GOLPE BRUTAL DIRETO ---
      case 'mCleaveWind':
        e.st -= dt;
        if (e.st <= 0) {
          SFX.play('swing');
          if (pDist <= 5.4) hurtPlayer(34, pos.x, pos.z, 14);
          e.state = 'move'; e.cd = 0.85; e.recover = 0.32;
        }
        break;
      case 'chargeWind':
        e.st -= dt;
        if (e.st <= 0) { e.state = 'charge'; e.st = 0.65; e.cdir.set(nx, 0, nz); e.hit = false; SFX.play('roar'); }
        break;
      case 'charge':
        e.st -= dt; mvx = e.cdir.x; mvz = e.cdir.z; spd = 25;
        e.yaw = Math.atan2(e.cdir.x, e.cdir.z);
        if (!e.hit && pDist < e.r + 1.5) { hurtPlayer(36, pos.x, pos.z, 16); e.hit = true; }
        if (e.st <= 0) { e.state = 'move'; e.chargeCd = 4.5; e.cd = 0.5; }
        break;
    }

    const ml = Math.hypot(mvx, mvz);
    if (ml > 0.001 && e.state !== 'mLeap' && e.state !== 'mStuck' && e.state !== 'mImpaled' && e.state !== 'mImpaleMiss') {
      pos.x += (mvx / ml) * Math.min(1, ml) * spd * dt;
      pos.z += (mvz / ml) * Math.min(1, ml) * spd * dt;
      bossResolve(e, pos);
    }
    if (e.state !== 'mLeap') updateEnemyVertical(e, pos, dt, dist);
    e.g.rotation.y = e.state === 'mPir' ? e.yaw + (1 - e.st / 0.62) * Math.PI * 4 : e.yaw;
    e.savedPos.copy(pos);
    e.savedYaw = e.yaw;
    animEnemy(e, dt, ml > 0.01);
  }

  function updateEnemy(e, dt) {
    if (e._gloryPending) return;
    const T = e.T, g = e.g, pos = g.position;
    const inR = World.isPosInRender(e.savedPos.x, e.savedPos.z);
    if (!inR) {
      if (e.inRender) {
        e.savedPos.copy(pos);
        e.savedYaw = e.yaw;
        if (e.flashing) setFlash(e, false);
        g.visible = false;
        e.inRender = false;
      }
      // Fora da render distance: guarda a posição e mantém o inimigo congelado no lugar
      return;
    }
    if (!e.inRender) {
      pos.copy(e.savedPos);
      e.yaw = e.savedYaw;
      g.rotation.y = e.savedYaw;
      g.visible = true;
      e.inRender = true;
    }

    e.anim += dt;
    if (e.crushCd > 0) e.crushCd = Math.max(0, e.crushCd - dt);
    if (e.flash > 0) { e.flash -= dt; if (!e.flashing) setFlash(e, true); }
    else if (e.flashing) setFlash(e, false);
    if (e.recover > 0) e.recover -= dt;

    // Sangramento contínuo nas junções de membros arrancados (só recalcula matriz quando um jato vai disparar)
    if (bleedJointsEnabled && goreQualityMul > 0 && e.bleedJoints && e.bleedJoints.length > 0 && !e.dead) {
      let matUpdated = false;
      for (let i = 0; i < e.bleedJoints.length; i++) {
        const bj = e.bleedJoints[i];
        bj.cd -= dt;
        if (bj.cd <= 0) {
          bj.cd = rnd(0.07, 0.15);
          if (!matUpdated) { g.updateMatrixWorld(true); matUpdated = true; }
          _tmpV.copy(bj.localPos).applyMatrix4(g.matrixWorld);
          const wx = _tmpV.x, wy = _tmpV.y, wz = _tmpV.z;
          _partCenter.copy(bj.localDir).applyAxisAngle(_localPt.set(0, 1, 0), e.yaw);
          bloodSpurt(wx, wy, wz, _partCenter.x, _partCenter.z, rnd(4.5, 7.5), 2, 1.8);
        }
      }
    }

    const pdx = P.pos.x - pos.x, pdz = P.pos.z - pos.z;
    const pDist = Math.hypot(pdx, pdz) || 0.001;
    if (!T.boss) g.visible = pDist <= enemyCullDist;

    if (e.galiusIntro) {
      updateGaliusIntro(e, dt);
      return;
    }
    if (e.maximusIntro) {
      updateMaximusIntro(e, dt);
      return;
    }
    if (T.model === 'maximus' && e.state === 'phaseTrans') {
      updateMaximusPhaseTrans(e, dt);
      return;
    }

    if (e.kicked) {
      e.kickT -= dt;
      e.kickVel.y -= 28 * dt;
      const nx = pos.x + e.kickVel.x * dt;
      const nz = pos.z + e.kickVel.z * dt;
      pos.x = nx; pos.z = nz; pos.y += e.kickVel.y * dt;
      g.rotation.x += dt * 11;
      g.rotation.z += dt * 7;
      e.kickBloodT -= dt;
      if (e.kickBloodT <= 0) {
        e.kickBloodT = 0.04;
        bloodSpurt(pos.x, pos.y + e.h * 0.5, pos.z, -e.kickVel.x, -e.kickVel.z, 5, 2, 1.5);
      }
      // Colisão com outros inimigos no caminho
      for (let i = 0; i < enemies.length; i++) {
        const o = enemies[i];
        if (o === e || o.dead || o.kicked || !o.inRender) continue;
        const ox = o.g.position.x - pos.x, oz = o.g.position.z - pos.z;
        const md = e.r + o.r + 0.5;
        if (Math.abs(ox) < md && Math.abs(oz) < md && Math.hypot(ox, oz) < md && Math.abs(o.g.position.y - pos.y) < e.h + 1.5) {
          const l = Math.hypot(e.kickVel.x, e.kickVel.z) || 1;
          dmgEnemy(o, 55, e.kickVel.x / l, e.kickVel.z / l, { knock: 14, stunBonus: 0.6, weapon: 'kick' });
        }
      }
      const wallHit = pointInWall(pos.x, pos.z, pos.y + (e.h || 2.5) * 0.5);
      resolveCircle(pos, e.r);
      const gy = groundAt(pos.x, pos.z, pos.y + 1.0, e.r);
      const groundHit = pos.y <= gy && e.kickVel.y < -1.5;
      if (groundHit) pos.y = gy;
      if (e.kickT <= 0 || wallHit || (groundHit && e.kickT < 1.05)) {
        e.kicked = false;
        SFX.play('boom');
        killEnemy(e, e.kickVel.x, e.kickVel.z, { weapon: 'kick' });
        return;
      }
      e.savedPos.copy(pos);
      e.savedYaw = e.yaw;
      return;
    }

    if (e.grabbed) {
      animEnemy(e, dt, false);
      e.savedPos.copy(pos);
      e.savedYaw = e.yaw;
      return;
    }

    if (e.glory) {
      e.gloryGrace = Math.max(0, e.gloryGrace - dt);
      e.gloryT -= dt;
      if (e.gloryT <= 0) {
        e.glory = false;
        setGloryGlow(e, 0);
        killEnemy(e, 0, 0);
        return;
      }
      if (e.kv.lengthSq() > 0.01) {
        pos.x += e.kv.x * dt; pos.z += e.kv.z * dt;
        e.kv.multiplyScalar(Math.max(0, 1 - dt * 6));
        resolveCircle(pos, e.r);
      }
      const gy = groundAt(pos.x, pos.z, pos.y + 1.0, e.r);
      const targetY = gy - (e.crawling ? 0 : Math.min(0.55, e.h * 0.22));
      pos.y += (targetY - pos.y) * Math.min(1, dt * 10);
      if (e.shadow && blobShadowsEnabled) e.shadow.position.y = (gy - pos.y) + 0.04;
      e.gloryBleedCd -= dt;
      if (e.gloryBleedCd <= 0) {
        e.gloryBleedCd = rnd(0.22, 0.45);
        bloodSpurt(pos.x, pos.y + e.h * 0.55, pos.z, rnd(-1, 1), rnd(-1, 1), 3.5, 2, 1.5);
      }
      const nearGlory = pDist < e.r + 4.4 && Math.abs(P.pos.y - pos.y) < 3.5;
      const pulseSpeed = nearGlory ? 16 : 8;
      const pulse = nearGlory ? (0.65 + 0.35 * Math.sin(e.anim * pulseSpeed)) : (0.35 + 0.25 * Math.sin(e.anim * pulseSpeed));
      setGloryGlow(e, pulse);
      animEnemy(e, dt, false);
      e.savedPos.copy(pos);
      e.savedYaw = e.yaw;
      return;
    }

    if (!T.boss) {
      if (e.lastPeasantT > 0) e.lastPeasantT -= dt;
      if (e.aggroOnPlayer || pDist <= 5.0) {
        // Quando já foi atingido por Nivaldo ou está dentro do raio de 5m: persegue o Nivaldo
        e.targetPeasant = null;
      } else {
        // Fora do raio de 5m do Nivaldo: persegue o camponês mais próximo (cacheado por 0.18s)
        e._peasantScanCd = (e._peasantScanCd || 0) - dt;
        if (e._peasantScanCd <= 0 || (e.targetPeasant && (e.targetPeasant.dead || !e.targetPeasant.inRender))) {
          e._peasantScanCd = 0.18;
          let bestP = null, bestPD2 = Infinity;
          for (let i = 0; i < peasants.length; i++) {
            const cp = peasants[i];
            if (cp.dead || !cp.inRender) continue;
            const px = cp.g.position.x - pos.x, pz = cp.g.position.z - pos.z;
            const d2 = px * px + pz * pz;
            if (d2 < bestPD2) { bestPD2 = d2; bestP = cp; }
          }
          e.targetPeasant = bestP;
          if (bestP && bestPD2 < 28 * 28) {
            e.lastPeasant = bestP;
            e.lastPeasantT = 8.0;
          }
        }
      }
    }

    const tp = (e.targetPeasant && !e.targetPeasant.dead && e.targetPeasant.inRender) ? e.targetPeasant : null;
    const tx = tp ? tp.g.position.x : P.pos.x;
    const tz = tp ? tp.g.position.z : P.pos.z;
    let dx = tx - pos.x, dz = tz - pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    if (!e.aggro) {
      if ((pDist < (T.aggro || 40) || (tp && pDist < 85 && dist < 34)) && !P.dead) {
        e.aggro = true;
        if (T.boss) SFX.play('roar');
      } else {
        e.savedPos.copy(pos);
        e.savedYaw = e.yaw;
        animEnemy(e, dt, false);
        return;
      }
    }
    if (P.dead) {
      updateEnemyVertical(e, pos, dt, dist);
      e.savedPos.copy(pos);
      e.savedYaw = e.yaw;
      animEnemy(e, dt, false);
      return;
    }

    if (e.downed) {
      e.kv.set(0, 0, 0);
      if (!S.rip) {
        const gy = groundAt(pos.x, pos.z, pos.y + 3.0, e.r);
        const targetDownY = gy - (T.model === 'galius' ? 5.20 : 2.3);
        pos.y += (targetDownY - pos.y) * Math.min(1, dt * (T.model === 'galius' ? 8 : 3));
      }
      e.savedPos.copy(pos);
      e.savedYaw = e.yaw;
      animEnemy(e, dt, false);
      return;
    }
    if (e.kv.lengthSq() > 0.01) {
      pos.x += e.kv.x * dt; pos.z += e.kv.z * dt;
      e.kv.multiplyScalar(Math.max(0, 1 - dt * 5));
      resolveCircle(pos, e.r);
    }
    if (e.kneel) {
      const gy = groundAt(pos.x, pos.z, pos.y + 3.0, e.r);
      pos.y += ((gy - (T.model === 'galius' ? 2.6 : 1.6)) - pos.y) * Math.min(1, dt * 3);
    }
    if (e.stun > 0) {
      e.stun -= dt;
      updateEnemyVertical(e, pos, dt, dist);
      e.savedPos.copy(pos);
      e.savedYaw = e.yaw;
      animEnemy(e, dt, false);
      return;
    }

    e.cd -= dt; e.chargeCd -= dt; e.stompCd -= dt;
    if (T.model === 'galius') {
      e.bloodBeamCd = (e.bloodBeamCd == null ? 6.0 : e.bloodBeamCd) - dt;
      e.biteCd = Math.max(0, (e.biteCd || 0) - dt);
      if (e.state === 'galiusBite') {
        e.savedPos.copy(pos);
        e.savedYaw = e.yaw;
        animEnemy(e, dt, false);
        return;
      }
      // Reação de proximidade: se Nivaldo se aproximar demais, Galius o agarra instantaneamente, morde a cabeça e arremessa
      if (!P.dead && !P.god && S.cutscene <= 0 && !S.glory && !S.impale && !S.galiusBite && e.biteCd <= 0 && pDist <= e.r + 5.2) {
        if (startGaliusBite && startGaliusBite(e)) {
          e.nearPlayerT = 0;
          e.biteCd = 8.0;
          cleanupGaliusProps(e, true);
          e.savedPos.copy(pos);
          e.savedYaw = e.yaw;
          animEnemy(e, dt, false);
          return;
        }
      }
    }
    if (isPillarBreaker(e) && !tp) {
      // Menor caminho até Nivaldo: reta se livre; senão A* (pilastras não contam como obstáculo)
      const wp = bossWaypoint(e, pos, tx, tz, dt);
      dx = wp.x - pos.x; dz = wp.z - pos.z;
    }
    const dl = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dl, nz = dz / dl;
    if (T.model === 'maximus') {
      updateMaximusCombat(e, dt, pos, dist, dx, dz, nx, nz, pDist);
      return;
    }
    if (e.state === 'galiusBeamFire') {
      e.yaw = lerpAngle(e.yaw, Math.atan2(dx, dz), Math.min(1, dt * 1.45));
    } else if (e.state !== 'charge' && e.state !== 'galiusDropCross' && e.state !== 'galiusPickCross') {
      e.yaw = lerpAngle(e.yaw, Math.atan2(dx, dz), Math.min(1, dt * (e.state === 'move' ? 9 : 4)));
    }
    const limbMul = e.limbSpeedMul || 1;
    let mvx = 0, mvz = 0, spd = T.speed * (e.enrage ? 1.3 : 1) * (e.kneel ? 0.4 : 1) * limbMul;
    const tall = T.boss;
    const canFly = T.flying && !e.wingsLost && !e.crawling;

    switch (e.state) {
      case 'move': {
        if (T.keep) {
          if (dist < T.keep - 2) { mvx = -nx; mvz = -nz; }
          else if (dist > T.keep + 4) { mvx = nx; mvz = nz; }
          else { mvx = -nz * e.strafe * 0.6; mvz = nx * e.strafe * 0.6; }
        } else {
          const stop = (T.melee ? T.melee.range : 10) * 0.6 + e.r;
          if (dist > stop) { mvx = nx; mvz = nz; }
          if (canFly && dist < 14) { mvx += -nz * e.strafe * 0.5; mvz += nx * e.strafe * 0.5; }
          if (T.ranged && !T.melee && dist < 9) { mvx = -nx * 0.6; mvz = -nz * 0.6; }
        }
        if (T.model === 'galius' && e.bloodBeamCd <= 0 && !e.kneel && dist > 8 && dist < 44 && bossLos(e, pos.x, pos.z, tx, tz)) {
          e.state = 'galiusDropCross'; e.st = 0.75; e._droppedNow = false;
        } else if (T.charge && !e.crawling && e.chargeCd <= 0 && dist > 8 && dist < 36 && !e.kneel && bossLos(e, pos.x, pos.z, tx, tz)) {
          e.state = 'chargeWind'; e.st = T.charge.wind;
        } else if (T.stomp && e.stompCd <= 0 && dist < 28) {
          e.state = 'stompWind'; e.st = 1.0;
        } else if (T.melee && e.cd <= 0 && dist <= T.melee.range + e.r * 0.6) {
          e.state = 'wind'; e.st = T.melee.wind; e.ranged = false;
        } else if (T.ranged && !T.melee && e.cd <= 0 && dist < T.ranged.range && bossLos(e, pos.x, pos.z, tx, tz)) {
          e.state = 'wind'; e.st = 0.45; e.ranged = true;
        } else if (T.ranged && T.melee && e.cd <= 0) { e.state = 'wind'; e.st = 0.4; e.ranged = true; }
        break;
      }
      case 'galiusDropCross':
        e.st -= dt;
        if (e.st <= 0.35 && !e._droppedNow) {
          e._droppedNow = true;
          spawnGaliusDroppedCross(e);
        }
        if (e.st <= 0) {
          e.state = 'galiusBeamWind'; e.st = 0.65;
          SFX.play('roar');
        }
        break;
      case 'galiusBeamWind':
        e.st -= dt;
        if (Math.random() < dt * 16) {
          const hx = pos.x + Math.sin(e.yaw) * 1.6, hy = pos.y + 6.9, hz = pos.z + Math.cos(e.yaw) * 1.6;
          bloodSpurt(hx, hy, hz, Math.sin(e.yaw), Math.cos(e.yaw), 4, 3, 2.0);
        }
        if (e.st <= 0) {
          e.state = 'galiusBeamFire'; e.st = 1.75; e.beamHitT = 0;
          ensureGaliusBloodBeam(e);
          SFX.play('gush');
        }
        break;
      case 'galiusBeamFire': {
        e.st -= dt;
        e.beamHitT = Math.max(0, (e.beamHitT || 0) - dt);
        const beam = ensureGaliusBloodBeam(e);
        const ox = pos.x + Math.sin(e.yaw) * 1.65;
        const oy = pos.y + 6.9;
        const oz = pos.z + Math.cos(e.yaw) * 1.65;
        const beamLen = 44;
        const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
        const dyTarget = clamp((P.pos.y + 1.2 - oy) / Math.max(4, pDist), -0.38, 0.25);
        const bx = ox + fx * beamLen, by = oy + dyTarget * beamLen, bz = oz + fz * beamLen;
        beam.position.set(ox, oy, oz);
        beam.lookAt(bx, by, bz);
        const pulse = 1 + Math.sin(e.anim * 28) * 0.22;
        beam.scale.set(pulse, pulse, beamLen);
        if (Math.random() < dt * 24) {
          const rt = Math.random() * 0.7;
          bloodSpurt(ox + fx * beamLen * rt, oy + dyTarget * beamLen * rt, oz + fz * beamLen * rt, fx, fz, 5, 2, 1.5);
        }
        const d2 = pointSegDistSq3D(P.pos.x, P.pos.y + 1.1, P.pos.z, ox, oy, oz, bx, by, bz);
        if (d2 < 1.45 * 1.45 && e.beamHitT <= 0) {
          e.beamHitT = 0.18;
          hurtPlayer(9, ox, oz, 6);
          burst(P.pos.x, P.pos.y + 1.1, P.pos.z, 0xb01010, 8, 6, 0.45, 0.2, 12);
        }
        if (e.st <= 0) {
          if (e.bloodBeamMesh) { scene.remove(e.bloodBeamMesh); e.bloodBeamMesh = null; }
          e.state = 'galiusPickCross'; e.st = 0.85; e._pickedNow = false;
        }
        break;
      }
      case 'galiusPickCross':
        e.st -= dt;
        if (e.st <= 0.38 && !e._pickedNow) {
          e._pickedNow = true;
          if (e.droppedCross) { scene.remove(e.droppedCross); e.droppedCross = null; }
          if (e.rig && e.rig.weapon) e.rig.weapon.visible = true;
          SFX.play('cross');
        }
        if (e.st <= 0) {
          e.state = 'move';
          e.bloodBeamCd = rnd(10, 14);
          e.cd = 0.9;
        }
        break;
      case 'wind':
        e.st -= dt;
        if (canFly) { mvx = nx * 0.4; mvz = nz * 0.4; }
        if (e.st <= 0) { doEnemyAttack(e, dist); e.state = 'move'; }
        break;
      case 'chargeWind':
        e.st -= dt;
        if (e.st <= 0) { e.state = 'charge'; e.st = T.charge.dur; e.cdir.set(nx, 0, nz); e.hit = false; SFX.play('roar'); }
        break;
      case 'charge':
        e.st -= dt; mvx = e.cdir.x; mvz = e.cdir.z; spd = T.charge.speed * limbMul;
        e.yaw = Math.atan2(e.cdir.x, e.cdir.z);
        if (!e.hit && tp && dist < e.r + 1.1) { hitPeasant(tp, pos.x, pos.z); e.hit = true; }
        if (!e.hit && pDist < e.r + 1.3) { hurtPlayer(T.charge.dmg, pos.x, pos.z, 16); e.hit = true; }
        if (e.st <= 0) { e.state = 'move'; e.chargeCd = T.charge.cd * rnd(0.9, 1.3); e.cd = 0.5; }
        break;
      case 'stompWind':
        e.st -= dt;
        if (e.st <= 0) {
          spawnRing(pos.x, pos.z, 34, 20, T.stomp.dmg, 0xff3a10, 'e');
          S.shakeBig = 0.8; SFX.play('shock');
          burst(pos.x, 0.5, pos.z, 0x6a5a4a, 20, 10, 0.8, 0.35, 15, false);
          e.state = 'move'; e.stompCd = T.stomp.cd * rnd(0.9, 1.2); e.cd = 1.0;
          if (T.model === 'galius') e.recover = 0.35;
        }
        break;
    }

    const px0 = pos.x, pz0 = pos.z;
    const ml = Math.hypot(mvx, mvz);
    if (ml > 0.001) {
      pos.x += mvx / ml * Math.min(1, ml) * spd * dt;
      pos.z += mvz / ml * Math.min(1, ml) * spd * dt;
    }
    // separação entre inimigos
    for (let i = 0; i < enemies.length; i++) {
      const o = enemies[i];
      if (o === e || o.dead || !o.inRender) continue;
      const ox = pos.x - o.g.position.x, oz = pos.z - o.g.position.z;
      const md = e.r + o.r;
      if (Math.abs(ox) < md && Math.abs(oz) < md) {
        const d = Math.hypot(ox, oz) || 0.01;
        if (d < md) { const push = (md - d) * 0.5 * (o.T.boss ? 1 : 0.6); pos.x += ox / d * push; pos.z += oz / d * push; }
      }
    }
    bossResolve(e, pos);
    if (e.state === 'charge') {
      const moved = Math.hypot(pos.x - px0, pos.z - pz0);
      if (moved < spd * dt * 0.4 && e.st > 0.1) {
        e.state = 'move'; e.chargeCd = T.charge.cd; e.stun = tall ? 1.5 : 0.8; S.shakeBig = 0.6; SFX.play('boom');
        burst(pos.x, pos.y + 2, pos.z, 0x6a5a4a, 14, 8, 0.7, 0.35, 15, false);
      }
    }
    updateEnemyVertical(e, pos, dt, dist);
    g.rotation.y = e.yaw;
    e.savedPos.copy(pos);
    e.savedYaw = e.yaw;
    // Galius enfurece
    if (T.model === 'galius' && !e.enrage && e.hp < e.maxhp * 0.7) { e.enrage = true; SFX.play('roar'); S.shakeBig = 0.8; }
    animEnemy(e, dt, ml > 0.01);
  }

  function animEnemy(e, dt, moving) {
    const R = e.rig, a = e.anim, T = e.T;
    if (e.crawling && e.crawlT < 1) e.crawlT = Math.min(1, (e.crawlT || 0) + dt * 6);
    if (!T.boss && !e.grabbed && !e.glory && !e.downed) {
      if (!e.g.visible) return;
      const dx = e.g.position.x - P.pos.x, dz = e.g.position.z - P.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 24 * 24) {
        const stride = d2 > 38 * 38 ? 3 : 2;
        e._animSkip = ((e._animSkip || 0) + 1) % stride;
        if (e._animSkip !== 0) return;
      }
    }
    const limbMul = e.limbSpeedMul || 1;
    const stepPh = a * T.speed * limbMul * 2.2;
    const sw = moving ? Math.sin(stepPh) * 0.7 : 0;
    const legLOff = e.limbs && e.limbs.legL && e.limbs.legL.severed;
    const legROff = e.limbs && e.limbs.legR && e.limbs.legR.severed;
    if (e.crawling && !e.downed) {
      e.g.rotation.z = moving ? Math.sin(a * 5.5) * 0.14 : 0;
    } else if (T.model === 'galius' && !e.downed && !e.galiusIntro && e.state !== 'galiusBite') {
      // Andar cambaleante e balangando de gordão morto reanimado
      const wad = a * 4.2;
      e.g.rotation.z = moving ? Math.sin(wad) * 0.11 : Math.sin(a * 1.4) * 0.025;
      if (R.torso) {
        R.torso.rotation.z = moving ? Math.sin(wad + 0.5) * 0.09 : Math.sin(a * 1.4) * 0.02;
        R.torso.rotation.y = moving ? Math.sin(wad) * 0.10 : 0;
        R.torso.rotation.x = moving ? 0.08 + Math.abs(Math.sin(wad)) * 0.05 : 0.04;
      }
    } else if (T.model === 'galius' && e.downed && !(e.ripDeform > 0)) {
      e.g.rotation.z = 0;
      if (R.torso) R.torso.rotation.set(0.06, 0, 0);
    } else if (legLOff !== legROff && !e.downed) {
      e.g.rotation.z = (legLOff ? 0.14 : -0.14) + (moving ? Math.sin(a * T.speed * limbMul * 2.2) * 0.08 : 0);
    } else if (e.g.rotation.z !== 0) {
      e.g.rotation.z = 0;
    }
    const winding = e.state === 'wind' || e.state === 'stompWind' || e.state === 'chargeWind';
    const wt = e.state === 'stompWind' ? 1.0 : e.state === 'chargeWind' ? (T.charge ? T.charge.wind : 0.7) : (T.melee ? T.melee.wind : 0.45);
    const windP = winding ? clamp(1 - e.st / wt, 0, 1) : 0;
    const strikeT = e.recover > 0 ? e.recover / 0.35 : 0;
    if (R.legL && !e.downed) {
      const flyingAir = T.flying && !e.wingsLost && !e.kneel;
      if (T.model === 'galius' && !e.galiusIntro) {
        const gPh = a * 4.2;
        const gsw = moving ? Math.sin(gPh) * 0.50 : 0;
        R.legL.rotation.x = e.kneel ? 1.35 : gsw;
        R.legR.rotation.x = e.kneel ? 1.35 : -gsw;
        if (R.kneeL) R.kneeL.rotation.x = e.kneel ? 0.55 : (moving ? Math.max(0.10, -Math.cos(gPh) * 0.65) : 0.10);
        if (R.kneeR) R.kneeR.rotation.x = e.kneel ? 0.55 : (moving ? Math.max(0.10, Math.cos(gPh) * 0.65) : 0.10);
      } else if (flyingAir) {
        const fBob = Math.sin(a * 5.2) * 0.14;
        R.legL.rotation.x = -0.35 + fBob;
        R.legR.rotation.x = -0.25 - fBob;
        if (R.kneeL) R.kneeL.rotation.x = 0.78 - fBob * 0.6;
        if (R.kneeR) R.kneeR.rotation.x = 0.68 + fBob * 0.6;
      } else {
        R.legL.rotation.x = e.kneel ? -1.35 : sw;
        R.legR.rotation.x = e.kneel ? -1.35 : -sw;
        if (R.kneeL) R.kneeL.rotation.x = e.kneel ? 2.05 : (moving ? Math.max(0.08, -Math.cos(stepPh) * 0.85) : 0.08);
        if (R.kneeR) R.kneeR.rotation.x = e.kneel ? 2.05 : (moving ? Math.max(0.08, Math.cos(stepPh) * 0.85) : 0.08);
      }
    } else if (R.legL && e.downed && T.model === 'galius') {
      R.legL.rotation.x = 1.35;
      R.legR.rotation.x = 1.35;
      if (R.kneeL) R.kneeL.rotation.x = 0.55;
      if (R.kneeR) R.kneeR.rotation.x = 0.55;
    }
    if (e.crawling && !e.downed) {
      if (R.armL && R.armR) {
        if (e.state === 'stompWind') {
          R.armL.rotation.x = -2.9 * windP; R.armR.rotation.x = -2.9 * windP;
          if (R.forearmL) R.forearmL.rotation.x = -0.85 * windP;
          if (R.forearmR) R.forearmR.rotation.x = -0.85 * windP;
        } else {
          const crawlArm = moving ? Math.sin(a * 5.5) * 0.65 : 0;
          R.armL.rotation.x = -1.75 + crawlArm;
          R.armR.rotation.x = -1.75 - crawlArm - windP * 1.4 + (strikeT > 0 ? 1.1 * (1 - strikeT) : 0);
          if (R.forearmL) R.forearmL.rotation.x = -0.55 - Math.max(0, -crawlArm) * 0.55;
          if (R.forearmR) R.forearmR.rotation.x = -0.55 - Math.max(0, crawlArm) * 0.55 - windP * 0.4;
        }
      }
      if (R.head) R.head.rotation.x = -0.85;
    } else if (T.model === 'galius' && R.armL && R.armR) {
      const mix = (x, y, t) => x + (y - x) * t;
      const setGF = (lx, rx) => {
        if (R.forearmL) R.forearmL.rotation.set(lx, 0, 0);
        if (R.forearmR) R.forearmR.rotation.set(rx, 0, 0);
      };
      if (e.galiusIntro === 'burst') {
        R.armL.rotation.set(-1.35, 0, 0.45);
        R.armR.rotation.set(-1.35, 0, -0.45);
        setGF(-0.75, -0.75);
        if (R.head) R.head.rotation.x = -0.15;
      } else if (e.galiusIntro === 'walk') {
        R.armL.rotation.set(-sw * 0.65, 0, 0.14);
        R.armR.rotation.set(sw * 0.65, 0, -0.14);
        setGF(-0.32 - Math.max(0, sw) * 0.25, -0.32 - Math.max(0, -sw) * 0.25);
        if (R.head) R.head.rotation.x = 0.08;
      } else if (e.galiusIntro === 'grab') {
        const p = clamp((e.galiusIntroT || 0) / 0.78, 0, 1);
        if (p < 0.6) {
          const k = p / 0.6;
          R.armL.rotation.set(mix(0, -1.7, k), 0, mix(0.14, 0.45, k));
          R.armR.rotation.set(mix(0, -1.7, k), 0, mix(-0.14, -0.35, k));
          setGF(mix(-0.3, -0.55, k), mix(-0.3, -0.55, k));
        } else {
          const k = (p - 0.6) / 0.4;
          R.armL.rotation.set(mix(-1.7, -1.12, k), 0, mix(0.45, 0.52, k));
          R.armR.rotation.set(mix(-1.7, -1.12, k), 0, mix(-0.35, -0.36, k));
          setGF(mix(-0.55, -0.35, k), mix(-0.55, -0.28, k));
          if (R.weapon) R.weapon.rotation.z = mix(-0.3, -1.21, k);
        }
      } else if (e.galiusIntro === 'roar') {
        const p = clamp((e.galiusIntroT || 0) / 0.35, 0, 1);
        const shake = Math.sin((e.galiusIntroT || 0) * 32) * 0.06;
        R.armL.rotation.set(mix(-1.12, -2.35, p) + shake, 0, mix(0.52, -0.48, p));
        R.armR.rotation.set(mix(-1.12, -2.45, p) - shake, 0, mix(-0.36, 0.38, p));
        setGF(mix(-0.35, -0.65, p), mix(-0.28, -0.45, p));
        if (R.weapon) R.weapon.rotation.z = mix(-1.21, 0.12, p);
        if (R.head) R.head.rotation.x = mix(0, -0.42, p) + shake * 0.5;
      } else if (e.downed) {
        R.armL.rotation.set(0.35, 0, 0.35);
        R.armR.rotation.set(0.35, 0, -0.35);
        setGF(-0.35, -0.35);
        if (R.weapon) R.weapon.rotation.z = -0.35;
        if (R.head && !(e.ripDeform > 0)) R.head.rotation.set(0.24, 0, 0);
        if (R.jaw) R.jaw.rotation.x = 0.32;
      } else if (e.state === 'galiusBite') {
        const bt = e.biteT || 0;
        if (e.bitePhase === 'throw') {
          // Braço esquerdo recua rápido e arremessa Nivaldo pra longe
          if (bt < 0.14) {
            const k = bt / 0.14;
            R.armL.rotation.set(mix(-2.05, -2.85, k), mix(0.45, 0.1, k), mix(-0.32, 0.25, k));
            setGF(mix(-0.95, -0.55, k), -0.35);
            if (R.torso) R.torso.rotation.set(mix(0.05, -0.18, k), mix(0, -0.22, k), 0);
          } else {
            const k = clamp((bt - 0.14) / 0.22, 0, 1);
            R.armL.rotation.set(mix(-2.85, -0.55, k), mix(0.1, -0.15, k), mix(0.25, 0.15, k));
            setGF(mix(-0.55, -0.18, k), -0.35);
            if (R.torso) R.torso.rotation.set(mix(-0.18, 0.32, k), mix(-0.22, 0.28, k), 0);
          }
          R.armR.rotation.set(-0.95, -0.18, -0.45);
          if (R.head) R.head.rotation.x = -0.12;
          if (R.jaw) R.jaw.rotation.x = 0.25;
        } else if (bt < 0.35) {
          // 1a. Galius se abaixa e estica a mão esquerda até o Nivaldo no chão
          const k = clamp(bt / 0.35, 0, 1);
          if (R.torso) R.torso.rotation.set(mix(0.04, 0.54, k), mix(0, 0.18, k), 0);
          if (R.legL) R.legL.rotation.x = mix(0, -0.42, k);
          if (R.legR) R.legR.rotation.x = mix(0, -0.42, k);
          if (R.kneeL) R.kneeL.rotation.x = mix(0.10, 0.72, k);
          if (R.kneeR) R.kneeR.rotation.x = mix(0.10, 0.72, k);
          R.armL.rotation.set(mix(-1.12, -0.52, k), mix(0.22, 0.15, k), mix(0.62, 0.14, k));
          R.armR.rotation.set(mix(-1.12, -0.75, k), -0.18, -0.48);
          setGF(mix(-0.35, -0.22, k), -0.35);
          if (R.head) R.head.rotation.x = mix(0, 0.28, k);
          if (R.jaw) R.jaw.rotation.x = 0.15;
        } else if (bt < 1.00) {
          // 1b/2a. Pega com a mão e leva a mão até a boca
          const k = clamp((bt - 0.35) / 0.65, 0, 1);
          if (R.torso) R.torso.rotation.set(mix(0.54, 0.04, k), mix(0.18, 0, k), 0);
          if (R.legL) R.legL.rotation.x = mix(-0.42, 0, k);
          if (R.legR) R.legR.rotation.x = mix(-0.42, 0, k);
          if (R.kneeL) R.kneeL.rotation.x = mix(0.72, 0.12, k);
          if (R.kneeR) R.kneeR.rotation.x = mix(0.72, 0.12, k);
          R.armL.rotation.set(mix(-0.52, -2.05, k), mix(0.15, 0.48, k), mix(0.14, -0.34, k));
          R.armR.rotation.set(mix(-0.75, -0.95, k), -0.18, -0.45);
          setGF(mix(-0.22, -0.95, k), -0.35);
          if (R.head) R.head.rotation.x = mix(0.28, 0.18, k);
          if (R.jaw) R.jaw.rotation.x = mix(0.15, 0.58, k);
        } else {
          // 2b. Segura na frente da boca e morde a cabeça do Nivaldo
          const chomp = Math.max(0, Math.sin((bt - 1.00) * 18));
          if (R.torso) R.torso.rotation.set(0.06, 0, 0);
          R.armL.rotation.set(-2.05, 0.48, -0.34);
          R.armR.rotation.set(-0.95, -0.18, -0.45);
          setGF(-0.95, -0.35);
          if (R.head) R.head.rotation.x = 0.24 + chomp * 0.18;
          if (R.jaw) R.jaw.rotation.x = 0.08 + chomp * 0.68;
        }
      } else if (e.state === 'galiusDropCross') {
        const k = clamp(1 - (e.st || 0) / 0.75, 0, 1);
        R.armL.rotation.set(mix(-1.12, 0.15, k), 0, mix(0.62, 0.35, k));
        R.armR.rotation.set(mix(-1.12, -0.35, k), 0, mix(-0.44, -0.65, k));
        setGF(mix(-0.35, -0.45, k), mix(-0.28, -0.45, k));
        if (R.torso) R.torso.rotation.x = Math.sin(k * Math.PI) * 0.22;
        if (R.head) R.head.rotation.x = 0.18 * k;
      } else if (e.state === 'galiusBeamWind') {
        const k = clamp(1 - (e.st || 0) / 0.65, 0, 1);
        R.armL.rotation.set(mix(0.15, 0.35, k), 0, mix(0.35, 0.85, k));
        R.armR.rotation.set(mix(-0.35, 0.35, k), 0, mix(-0.65, -0.85, k));
        setGF(mix(-0.45, -0.65, k), mix(-0.45, -0.65, k));
        if (R.torso) R.torso.rotation.x = mix(0, -0.24, k);
        if (R.head) R.head.rotation.x = mix(0.18, -0.35, k);
        if (R.jaw) R.jaw.rotation.x = 0.55 * k;
      } else if (e.state === 'galiusBeamFire') {
        const shake = Math.sin(a * 30) * 0.05;
        R.armL.rotation.set(0.35 + shake, 0, 0.92);
        R.armR.rotation.set(0.35 - shake, 0, -0.92);
        setGF(-0.65, -0.65);
        if (R.torso) R.torso.rotation.x = -0.22 + shake * 0.5;
        if (R.head) R.head.rotation.x = -0.35 + shake;
        if (R.jaw) R.jaw.rotation.x = 0.62;
      } else if (e.state === 'galiusPickCross') {
        const k = clamp(1 - (e.st || 0) / 0.85, 0, 1);
        if (k < 0.5) {
          const u = k / 0.5;
          R.armL.rotation.set(mix(0.35, -0.45, u), 0, mix(0.92, 0.45, u));
          R.armR.rotation.set(mix(0.35, -0.65, u), 0, mix(-0.92, -0.45, u));
          setGF(mix(-0.65, -0.25, u), mix(-0.65, -0.25, u));
          if (R.torso) R.torso.rotation.x = mix(-0.22, 0.32, u);
        } else {
          const u = (k - 0.5) / 0.5;
          R.armL.rotation.set(mix(-0.45, -1.12, u), mix(0, 0.22, u), mix(0.45, 0.62, u));
          R.armR.rotation.set(mix(-0.65, -1.12, u), mix(0, -0.18, u), mix(-0.45, -0.44, u));
          setGF(mix(-0.25, -0.35, u), mix(-0.25, -0.28, u));
          if (R.torso) R.torso.rotation.x = mix(0.32, 0.04, u);
        }
        if (R.jaw) R.jaw.rotation.x = 0.08;
      } else if (e.state === 'wind' || e.state === 'stompWind') {
        R.armL.rotation.x = mix(-1.12, 0.35, windP);
        R.armL.rotation.z = mix(0.62, -0.25, windP);
        R.armR.rotation.x = mix(-1.12, -2.9, windP);
        R.armR.rotation.z = mix(-0.44, 0, windP);
        setGF(mix(-0.35, -0.55, windP), mix(-0.28, -0.75, windP));
        if (R.weapon) R.weapon.rotation.z = mix(-1.21, 0, Math.min(1, windP * 1.35));
      } else if (strikeT > 0 && !winding) {
        const p = 1 - strikeT;
        if (p < 0.25) {
          const k = p / 0.25;
          R.armR.rotation.x = mix(-2.9, -1.02, k);
          R.armR.rotation.z = 0;
          R.armL.rotation.x = 0.35;
          R.armL.rotation.z = -0.25;
          setGF(-0.55, mix(-0.75, -0.15, k));
          if (R.weapon) R.weapon.rotation.z = 0;
        } else if (p < 0.55) {
          R.armR.rotation.x = -1.02;
          R.armR.rotation.z = 0;
          R.armL.rotation.x = 0.35;
          R.armL.rotation.z = -0.25;
          setGF(-0.55, -0.15);
          if (R.weapon) R.weapon.rotation.z = 0;
        } else {
          let k = (p - 0.55) / 0.45;
          k = k * k * (3 - 2 * k);
          R.armR.rotation.x = mix(-1.02, -1.12, k);
          R.armR.rotation.y = mix(0, -0.18, k);
          R.armR.rotation.z = mix(0, -0.44, k);
          R.armL.rotation.x = mix(0.35, -1.12, k);
          R.armL.rotation.y = mix(0, 0.22, k);
          R.armL.rotation.z = mix(-0.25, 0.62, k);
          setGF(mix(-0.55, -0.35, k), mix(-0.15, -0.28, k));
          if (R.weapon) R.weapon.rotation.z = mix(0, -1.21, k);
        }
      } else {
        const bob = moving ? Math.sin(a * 4.2) * 0.10 : 0;
        R.armL.rotation.set(-1.12 + bob, 0.22, 0.62);
        R.armR.rotation.set(-1.12 + bob, -0.18, -0.44);
        setGF(-0.35, -0.28);
        if (R.weapon) R.weapon.rotation.z = -1.21;
        if (R.head) R.head.rotation.x = moving ? Math.sin(a * 4.2) * 0.06 : 0;
        if (R.jaw) R.jaw.rotation.x = 0.08 + Math.sin(a * 2.5) * 0.04;
      }
    } else if (R.legL && R.armL && !R.book) {
      if (e.maximusIntro) {
        const mix = (x, y, t) => x + (y - x) * t;
        const setMJ = (fl, fr, kl, kr) => {
          if (R.forearmL) R.forearmL.rotation.set(fl, 0, 0);
          if (R.forearmR) R.forearmR.rotation.set(fr, 0, 0);
          if (R.kneeL) R.kneeL.rotation.set(kl, 0, 0);
          if (R.kneeR) R.kneeR.rotation.set(kr, 0, 0);
        };
        const t = e.maximusIntroT || 0;
        if (e.maximusIntro === 'fall') {
          R.legL.rotation.x = -0.35;
          R.legR.rotation.x = 0.28;
          R.armL.rotation.set(-2.2, 0, -0.55);
          R.armR.rotation.set(-2.2, 0, 0.55);
          setMJ(-0.55, -0.55, 0.85, 0.45);
          if (R.head) R.head.rotation.x = 0.25;
        } else if (e.maximusIntro === 'land') {
          const p = clamp(t / 0.85, 0, 1);
          const crouch = 1 - p * p;
          R.legL.rotation.x = -0.75 * crouch;
          R.legR.rotation.x = -0.75 * crouch;
          R.armL.rotation.set(-0.5 * crouch, 0, -0.35 * crouch);
          R.armR.rotation.set(-0.8 * crouch, 0, 0.25 * crouch);
          setMJ(-0.65 * crouch - 0.25, -0.65 * crouch - 0.25, 1.35 * crouch + 0.08, 1.35 * crouch + 0.08);
          if (R.head) R.head.rotation.x = 0.35 * crouch;
        } else if (e.maximusIntro === 'unsheathe') {
          const p = clamp(t / 1.35, 0, 1);
          R.legL.rotation.x = 0; R.legR.rotation.x = 0;
          R.armL.rotation.set(0.15, 0, 0);
          if (p < 0.32) {
            const k = p / 0.32;
            R.armR.rotation.set(mix(0, -1.15, k), 0, mix(0, 0.85, k));
            setMJ(-0.32, mix(-0.25, -0.95, k), 0.08, 0.08);
          } else {
            const k = (p - 0.32) / 0.68;
            const s = k * k * (3 - 2 * k);
            R.armR.rotation.set(mix(-1.15, -0.85, s), 0, mix(0.85, -0.38, s));
            setMJ(-0.32, mix(-0.95, -0.45, s), 0.08, 0.08);
          }
          if (R.head) R.head.rotation.x = 0.05;
        } else if (e.maximusIntro === 'shield') {
          const p = clamp(t / 0.85, 0, 1);
          R.legL.rotation.x = 0; R.legR.rotation.x = 0;
          R.armR.rotation.set(-0.85, 0, -0.38);
          if (p < 0.34) {
            const k = p / 0.34;
            R.armL.rotation.set(mix(0.15, 0.55, k), 0, mix(0, -0.45, k));
            setMJ(mix(-0.32, -0.85, k), -0.45, 0.08, 0.08);
          } else {
            const k = (p - 0.34) / 0.66;
            const s = k * k * (3 - 2 * k);
            R.armL.rotation.set(mix(0.55, -1.05, s), 0, mix(-0.45, 0.32, s));
            setMJ(mix(-0.85, -0.55, s), -0.45, 0.08, 0.08);
          }
          if (R.head) R.head.rotation.x = 0;
        } else if (e.maximusIntro === 'pose') {
          const p = clamp(t / 0.4, 0, 1);
          R.legL.rotation.x = 0; R.legR.rotation.x = 0;
          R.armL.rotation.set(mix(-0.15, -0.35, p), 0, 0.35);
          R.armR.rotation.set(mix(-0.85, -1.35, p), 0, -0.32);
          setMJ(mix(-0.45, -0.65, p), mix(-0.45, -0.32, p), 0.08, 0.08);
          if (R.head) R.head.rotation.x = mix(0, -0.18, p);
        }
      } else if (T.model === 'maximus') {
        const setMF = (fl, fr) => {
          if (R.forearmL) R.forearmL.rotation.set(fl, 0, 0);
          if (R.forearmR) R.forearmR.rotation.set(fr, 0, 0);
        };
        const setMK = (kl, kr) => {
          if (R.kneeL) R.kneeL.rotation.set(kl, 0, 0);
          if (R.kneeR) R.kneeR.rotation.set(kr, 0, 0);
        };
        // Chamas animadas na cabeça (Fase 2) + brilho vermelho cintilante na espada
        if (R.flames && R.flameHead && R.flameHead.visible) {
          for (let fi = 0; fi < R.flames.length; fi++) {
            const fm = R.flames[fi];
            const bp = fm.userData.basePos;
            const flk = 0.82 + 0.36 * Math.sin(a * 19 + fi * 1.7);
            fm.scale.set(1, flk, 1);
            fm.position.set(bp[0] + Math.sin(a * 14 + fi) * 0.018, bp[1] + (flk - 1) * 0.08, bp[2]);
          }
        }
        if (R.swordGlowMats) {
          const pulse = e.swordGlow ? (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(a * 14))) : 0;
          for (let mi = 0; mi < R.swordGlowMats.length; mi++) {
            const mat = R.swordGlowMats[mi];
            if (e.swordGlow) {
              mat.emissive.setRGB(pulse, pulse * 0.08, pulse * 0.14);
              mat.emissiveIntensity = 1.6;
            } else {
              mat.emissive.setHex(0x180406);
              mat.emissiveIntensity = 0.2;
            }
          }
        }
        if (e.state === 'phaseTrans') {
          const pt = e.phaseTransT || 0;
          if (pt < 1.0) {
            R.armR.rotation.set(-0.65, 0, -0.18);
            R.armL.rotation.set(-0.55, 0, 0.18);
            setMF(-0.65, -0.55); setMK(0.35, 0.35);
            if (R.head) R.head.rotation.x = 0.42;
          } else if (pt < 2.15) {
            const u = clamp((pt - 1.0) / 0.5, 0, 1);
            R.armR.rotation.set(-0.65, 0, -0.18);
            R.armL.rotation.set(-2.3 * u, 0, 0.25);
            setMF(-0.65 - 0.55 * u, -0.55); setMK(0.25, 0.25);
            if (R.head) R.head.rotation.x = 0.25 - u * 0.45;
          } else {
            R.armR.rotation.set(-2.2, 0, -0.35);
            R.armL.rotation.set(-1.1, 0, 0.45);
            setMF(-0.75, -0.35); setMK(0.18, 0.18);
            if (R.head) R.head.rotation.x = -0.25;
          }
        } else if (e.state === 'mRushWind') {
          R.legL.rotation.x = -0.8; R.legR.rotation.x = 0.55;
          setMK(1.15, 0.55);
          R.armR.rotation.set(0.6, 0.3, -0.7);
          R.armL.rotation.set(0.9, 0, 0.8);
          setMF(-0.85, -0.65);
          if (R.head) R.head.rotation.x = 0.35;
        } else if (e.state === 'mRush') {
          const runPh = a * 34;
          const run = Math.sin(runPh);
          R.legL.rotation.x = run * 1.15; R.legR.rotation.x = -run * 1.15;
          setMK(Math.max(0.15, -Math.cos(runPh) * 1.15), Math.max(0.15, Math.cos(runPh) * 1.15));
          R.armR.rotation.set(-1.35, 0.15, -0.12);
          R.armL.rotation.set(-0.45 + run * 0.5, 0, 0.55);
          setMF(-0.85, -0.32);
          if (R.head) R.head.rotation.x = 0.25;
        } else if (e.state === 'mImpaleWind') {
          const tremor = Math.sin(a * 40) * 0.03;
          R.legL.rotation.x = 0.55; R.legR.rotation.x = -0.65;
          setMK(0.35, 0.85);
          R.armR.rotation.set(0.75 + tremor, 0.2, -0.45);
          R.armL.rotation.set(0.55, 0, 0.7);
          setMF(-0.75, -0.85);
          if (R.head) R.head.rotation.x = -0.1;
        } else if (e.state === 'mImpaleDash') {
          const runPh = a * 36;
          const run = Math.sin(runPh);
          R.legL.rotation.x = run * 0.9 + 0.3; R.legR.rotation.x = -run * 0.9 - 0.2;
          setMK(Math.max(0.15, -Math.cos(runPh) * 1.0), Math.max(0.15, Math.cos(runPh) * 1.0));
          R.armR.rotation.set(-1.58, 0, 0.04);
          R.armL.rotation.set(-1.48, 0, 0.22);
          setMF(-0.35, -0.15);
          if (R.head) R.head.rotation.x = 0.15;
        } else if (e.state === 'mImpaled') {
          const strain = Math.sin(a * 24) * 0.04;
          R.legL.rotation.x = 0.55; R.legR.rotation.x = -0.75;
          setMK(0.35, 0.95);
          R.armR.rotation.set(-1.58 + strain, 0, 0.04);
          R.armL.rotation.set(-1.45 + strain, 0, 0.2);
          setMF(-0.45, -0.22);
          if (R.head) R.head.rotation.x = -0.18;
        } else if (e.state === 'mImpaleMiss') {
          const tug = Math.sin(a * 22) * 0.08;
          R.legL.rotation.x = 0.7; R.legR.rotation.x = -0.35;
          setMK(0.45, 0.65);
          R.armR.rotation.set(-1.2 + tug, 0, 0.1);
          R.armL.rotation.set(-0.95 + tug, 0, 0.3);
          setMF(-0.75, -0.65);
          if (R.head) R.head.rotation.x = 0.4;
        } else if (e.state === 'mSlideWind' || e.state === 'mSlide') {
          R.legL.rotation.x = -0.95; R.legR.rotation.x = 0.55;
          setMK(1.35, 0.35);
          R.armR.rotation.set(-1.35, -0.5, -0.65);
          R.armL.rotation.set(0.35, 0, 0.65);
          setMF(-0.75, -0.32);
          if (R.head) R.head.rotation.x = 0.22;
        } else if (e.state === 'mPirWind' || e.state === 'mPir') {
          R.armR.rotation.set(-1.45, 0, -1.15);
          R.armL.rotation.set(-0.65, 0, 0.95);
          setMF(-0.55, -0.22); setMK(0.25, 0.25);
        } else if (e.state === 'mLungeWind') {
          R.armR.rotation.set(0.35, 0, -0.25);
          R.armL.rotation.set(0.45, 0, 0.45);
          setMF(-0.75, -0.85); setMK(0.45, 0.55);
        } else if (e.state === 'mLunge') {
          R.legL.rotation.x = 0.65; R.legR.rotation.x = -0.75;
          setMK(0.25, 0.95);
          R.armR.rotation.set(-1.62, 0, 0);
          R.armL.rotation.set(0.55, 0, 0.55);
          setMF(-0.65, -0.15);
        } else if (e.state === 'mLeapWind') {
          R.legL.rotation.x = -0.6; R.legR.rotation.x = -0.6;
          setMK(1.15, 1.15);
          R.armR.rotation.set(-2.75, 0, 0.22);
          R.armL.rotation.set(-2.65, 0, -0.22);
          setMF(-0.65, -0.55);
        } else if (e.state === 'mLeap') {
          R.legL.rotation.x = -0.25; R.legR.rotation.x = 0.35;
          setMK(0.75, 0.45);
          R.armR.rotation.set(-2.35, 0, 0.18);
          R.armL.rotation.set(-2.25, 0, -0.18);
          setMF(-0.45, -0.35);
          if (R.head) R.head.rotation.x = 0.28;
        } else if (e.state === 'mStuck') {
          const tug = Math.sin(a * 26) * 0.12;
          R.legL.rotation.x = -0.55; R.legR.rotation.x = 0.35;
          setMK(0.85, 0.45);
          R.armR.rotation.set(-0.95 + tug, 0, 0.16);
          R.armL.rotation.set(-0.95 + tug, 0, -0.16);
          setMF(-0.72, -0.72);
          if (R.head) R.head.rotation.x = 0.38 + tug * 0.5;
        } else if (e.state === 'mCleaveWind') {
          R.armR.rotation.set(-2.6, 0, -0.3);
          R.armL.rotation.set(-2.2, 0, 0.2);
          setMF(-0.75, -0.85); setMK(0.32, 0.42);
        } else if (strikeT > 0) {
          R.armR.rotation.set(-0.75, 0, -0.2);
          R.armL.rotation.set(0.25, 0, 0.35);
          setMF(-0.55, -0.18);
        } else {
          // Pose de guarda ágil (Fase 1) ou agressiva (Fase 2)
          const p2 = e.phase === 2;
          R.armR.rotation.set(p2 ? -1.15 : -0.95 + sw * 0.25, 0, -0.22);
          R.armL.rotation.set(p2 ? -0.75 : 0.25 - sw * 0.35, 0, 0.38);
          setMF(p2 ? -0.72 : -0.45, p2 ? -0.42 : -0.35);
          if (R.head) R.head.rotation.x = p2 ? 0.12 : 0;
          if (moving && R.armR) {
            // balanço de braços oposto às pernas (mais solto)
            const ph = a * T.speed * limbMul * 2.2;
            R.armR.rotation.x += Math.sin(ph) * (p2 ? 0.30 : 0.12);
            R.armL.rotation.x -= Math.sin(ph) * (p2 ? 0.38 : 0.15);
          }
        }
        // ---- Corpo articulado e solto: inclinações, torção, balanço + suavização de pose ----
        const p2s = e.phase === 2 || e.phase === 1.5;
        let lx = 0, ly = 0, lz = 0, by = 0, hy = 0, hz = 0;
        const ph2 = a * T.speed * limbMul * 2.2;
        const st = e.state;
        if (st === 'move') {
          if (moving) {
            lx = (p2s ? 0.20 : 0.10) + Math.sin(ph2 * 2) * (p2s ? 0.05 : 0.03);
            lz = Math.sin(ph2) * (p2s ? 0.08 : 0.05);
            ly = Math.sin(ph2) * (p2s ? 0.20 : 0.12);
            by = Math.abs(Math.sin(ph2)) * (p2s ? 0.10 : 0.06);
            hy = -ly * 0.8;
            if (p2s) { R.legL.rotation.x *= 1.3; R.legR.rotation.x *= 1.3; }
          } else {
            lx = Math.sin(a * 1.9) * 0.025; lz = Math.sin(a * 1.2) * 0.02;
            ly = Math.sin(a * 0.8) * 0.06; hy = Math.sin(a * 1.1 + 1) * 0.10;
            by = Math.sin(a * 1.9) * 0.012;
          }
          hz = Math.sin(a * 2.3) * 0.04;
        } else if (st === 'mLeapWind') { lx = -0.28; by = -0.26; ly = 0.35;
        } else if (st === 'mLeap') { lx = 0.38; ly = -0.15;
        } else if (st === 'mStuck') { lx = 0.34 + Math.sin(a * 26) * 0.05; by = -0.12; hz = Math.sin(a * 18) * 0.08;
        } else if (st === 'mCleaveWind') { lx = -0.34; ly = 0.55; by = -0.10;
        } else if (st === 'chargeWind') { lx = 0.12; by = -0.22; ly = -0.3;
        } else if (st === 'charge') { lx = 0.52; lz = Math.sin(a * 28) * 0.05;
        } else if (st === 'mSlideWind' || st === 'mSlide') { lx = 0.28; lz = -0.28; by = -0.22;
        } else if (st === 'mPirWind' || st === 'mPir') { lx = 0.06; lz = Math.sin(a * 20) * 0.1;
        } else if (st === 'mLungeWind') { lx = -0.16; ly = 0.35;
        } else if (st === 'mLunge') { lx = 0.46; ly = -0.18; by = -0.08;
        } else if (st === 'mRushWind') { lx = 0.30; by = -0.30; ly = 0.2;
        } else if (st === 'mRush') { lx = 0.62; lz = Math.sin(a * 34) * 0.08; ly = Math.sin(a * 17) * 0.12; by = Math.abs(Math.sin(a * 34)) * 0.1;
        } else if (st === 'mImpaleWind') { lx = -0.32; ly = 0.55; by = -0.12;
        } else if (st === 'mImpaleDash') { lx = 0.50; ly = -0.12; by = -0.05;
        } else if (st === 'mImpaled') { lx = -0.22 + Math.sin(a * 24) * 0.02; ly = Math.sin(a * 11) * 0.04; by = -0.04;
        } else if (st === 'mImpaleMiss') { lx = 0.46; by = -0.10; hz = Math.sin(a * 22) * 0.06; }
        if (strikeT > 0) { lx += 0.2 * strikeT; ly += (e.strafe || 1) * 0.25 * strikeT; }
        if (R.legL && st !== 'phaseTrans') { R.legL.rotation.z = -0.04 - Math.abs(lz) * 0.5; R.legR.rotation.z = 0.04 + Math.abs(lz) * 0.5; }
        if (R.head) { R.head.rotation.y = hy; R.head.rotation.z = hz; }
        if (R.plume) R.plume.rotation.x = 0.42 + Math.sin(a * 6) * 0.10 + (moving ? 0.25 : 0);
        if (R.root) {
          if (e._rootY0 === undefined) e._rootY0 = R.root.position.y;
          lx += 0; // root pivota nos pés
        }
        const sm = e._sm || (e._sm = {});
        const kk = 1 - Math.exp(-dt * (p2s ? 11 : 17));
        const smRot = (key, o, tx, ty, tz) => {
          let p = sm[key];
          if (!p) p = sm[key] = [o.rotation.x, o.rotation.y, o.rotation.z];
          p[0] += (tx - p[0]) * kk; p[1] += (ty - p[1]) * kk; p[2] += (tz - p[2]) * kk;
          o.rotation.set(p[0], p[1], p[2]);
        };
        ['armR', 'armL', 'forearmR', 'forearmL', 'legL', 'legR', 'kneeL', 'kneeR', 'head'].forEach((key) => {
          const o = R[key]; if (o) smRot(key, o, o.rotation.x, o.rotation.y, o.rotation.z);
        });
        if (R.root) {
          smRot('root', R.root, lx, ly, lz);
          sm.by = (sm.by === undefined ? 0 : sm.by) + (by - (sm.by === undefined ? 0 : sm.by)) * kk;
          R.root.position.y = e._rootY0 + sm.by;
        }
      } else {
        const base = T.armsFwd ? -1.3 : 0;
        if (e.state === 'stompWind') {
          R.armL.rotation.x = -2.9 * windP; R.armR.rotation.x = -2.9 * windP;
          if (R.forearmL) R.forearmL.rotation.x = -0.35 - 0.65 * windP;
          if (R.forearmR) R.forearmR.rotation.x = -0.35 - 0.65 * windP;
        } else {
          R.armL.rotation.x = base + (moving && !T.armsFwd ? -sw * 0.6 : 0);
          R.armR.rotation.x = base + (moving && !T.armsFwd ? sw * 0.6 : 0) - windP * 2.6 + (strikeT > 0 ? 1.1 * (1 - strikeT) : 0) * 1;
          if (strikeT > 0 && !winding) R.armR.rotation.x = base - 2.6 * strikeT + 0.9 * (1 - strikeT);
          if (R.forearmL) {
            R.forearmL.rotation.x = T.armsFwd
              ? (-0.42 + Math.sin(a * 4.5) * 0.14)
              : (-0.34 - Math.max(0, sw) * 0.35);
          }
          if (R.forearmR) {
            if (winding) R.forearmR.rotation.x = -0.35 - 0.78 * windP;
            else if (strikeT > 0) R.forearmR.rotation.x = -0.18 - 0.85 * strikeT;
            else R.forearmR.rotation.x = T.armsFwd
              ? (-0.42 - Math.sin(a * 4.5) * 0.14)
              : (-0.34 - Math.max(0, -sw) * 0.35);
          }
        }
        R.armL.rotation.z = 0; R.armR.rotation.z = 0;
        if (R.head && !e.downed) R.head.rotation.x = 0;
        if (e.downed) {
          R.armL.rotation.x = 0.4; R.armR.rotation.x = 0.4; R.head.rotation.x = 0.5;
          if (R.forearmL) R.forearmL.rotation.x = -0.35;
          if (R.forearmR) R.forearmR.rotation.x = -0.35;
          if (R.kneeL) R.kneeL.rotation.x = 0.35;
          if (R.kneeR) R.kneeR.rotation.x = 0.35;
        }
      }
    }
    if (R.book) { // padre
      R.book.position.y = 1.55 + Math.sin(a * 3) * 0.08;
      R.armL.rotation.x = -1.2 - windP * 1.2; R.armR.rotation.x = -1.2 - windP * 1.2;
      if (R.forearmL) R.forearmL.rotation.x = -0.55 - windP * 0.45 + Math.sin(a * 3) * 0.08;
      if (R.forearmR) R.forearmR.rotation.x = -0.55 - windP * 0.45 - Math.sin(a * 3) * 0.08;
      R.book.scale.setScalar(1 + windP * 0.8);
    }
    if (R.wingL && !e.wingsLost) {
      const f = Math.sin(a * (T.model === 'diabrete' ? 18 : 12)) * 0.7;
      R.wingL.rotation.z = f; R.wingR.rotation.z = -f;
    }
    if (R.tail) {
      if (e.downed) {
        R.tail.rotation.y = Math.sin(a * 1.5) * 0.08;
        R.tail.rotation.x = 0.25;
      } else {
        const tailFreq = (winding || e.state === 'charge') ? 7.5 : (moving ? 4.2 : 2.2);
        const tailAmp = (winding || e.state === 'charge') ? 0.34 : (moving ? 0.26 : 0.16);
        R.tail.rotation.y = Math.sin(a * tailFreq) * tailAmp;
        R.tail.rotation.x = 0.08 * Math.cos(a * tailFreq * 0.7);
        if (R.tailSegs) {
          for (let ti = 0; ti < R.tailSegs.length; ti++) {
            R.tailSegs[ti].rotation.y = Math.sin(a * tailFreq - ti * 0.85) * (tailAmp * (0.65 + ti * 0.18));
          }
        }
      }
    }
    if (R.heart) {
      const beaming = e.state === 'galiusBeamWind' || e.state === 'galiusBeamFire';
      const rate = beaming ? 3.2 : (T.galius2 ? 1.65 : 1.25);
      const p = heartPulse(a * rate);
      const amp = beaming ? 0.42 : 0.25;
      R.heart.scale.set(1 + p * amp, 1 + p * (amp * 0.65), 1 + p * (amp * 1.2));
    }
    if (T.model === 'diabrete') {
      R.armL.rotation.x = -0.35 - windP * 1.5; R.armR.rotation.x = -0.35 - windP * 1.5;
      if (R.forearmL) R.forearmL.rotation.x = -0.65 - windP * 0.55 + Math.sin(a * 9) * 0.12;
      if (R.forearmR) R.forearmR.rotation.x = -0.65 - windP * 0.55 - Math.sin(a * 9) * 0.12;
    }
    if (e.glory) {
      e.g.rotation.x = (e.crawling ? 1.35 : 0.24) + Math.sin(a * 16) * 0.05;
      e.g.rotation.z = Math.sin(a * 21) * 0.04;
      if (R.legL) R.legL.rotation.x = -1.35;
      if (R.legR) R.legR.rotation.x = -1.35;
      if (R.kneeL) R.kneeL.rotation.x = 2.05;
      if (R.kneeR) R.kneeR.rotation.x = 2.05;
      if (R.armL) R.armL.rotation.x = -1.0 + Math.sin(a * 12) * 0.22;
      if (R.armR) R.armR.rotation.x = -1.0 - Math.sin(a * 12) * 0.22;
      if (R.forearmL) R.forearmL.rotation.x = -0.85 + Math.cos(a * 12) * 0.18;
      if (R.forearmR) R.forearmR.rotation.x = -0.85 - Math.cos(a * 12) * 0.18;
      if (R.head) {
        R.head.rotation.x = (e.crawling ? -0.65 : 0.45) + Math.sin(a * 14) * 0.14;
        R.head.rotation.y = Math.sin(a * 9) * 0.18;
      }
    } else if (e.crawling && !e.downed) {
      e.g.rotation.x = 1.35 * (e.crawlT || 0) + (moving ? Math.sin(a * 11) * 0.05 : 0);
    } else if (e.g.rotation.x !== 0) {
      e.g.rotation.x = 0;
    }
    if (e.hasBrokenLeg && !e.crawling && !e.downed) {
      e.g.rotation.z += Math.sin(a * 7.5) * 0.09;
    }
    if (e.limbs) {
      if (e.limbs.armL && e.limbs.armL.broken && R.armL && !e.downed) {
        R.armL.rotation.x = 0.25 + Math.sin(a * 9) * 0.10;
        if (R.forearmL) R.forearmL.rotation.x = -0.15 + Math.cos(a * 9) * 0.14;
      }
      if (e.limbs.armR && e.limbs.armR.broken && R.armR && !e.downed) {
        R.armR.rotation.x = 0.25 - Math.sin(a * 9) * 0.10;
        if (R.forearmR) R.forearmR.rotation.x = -0.15 - Math.cos(a * 9) * 0.14;
      }
    }
    if (e.danglingEyes) {
      for (let i = 0; i < e.danglingEyes.length; i++) {
        const de = e.danglingEyes[i];
        de.pivot.rotation.z = Math.sin(a * 8 + de.phase) * (moving ? 0.35 : 0.14);
        de.pivot.rotation.x = Math.cos(a * 6.5 + de.phase) * (moving ? 0.28 : 0.10);
      }
    }
    if (e.gutsList) {
      for (let i = 0; i < e.gutsList.length; i++) {
        const gl = e.gutsList[i];
        gl.pivot.rotation.z = Math.sin(a * 6.5 + gl.phase) * (moving ? 0.28 : 0.10);
        gl.pivot.rotation.x = Math.sin(a * 5.0 + gl.phase) * (moving ? 0.20 : 0.08);
      }
    }
  }

  function syncRenderDistanceEntities() {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || e.dead) continue;
      const inR = World.isPosInRender(e.savedPos.x, e.savedPos.z);
      if (inR && !e.inRender) {
        e.g.position.copy(e.savedPos);
        e.g.rotation.y = e.savedYaw;
        e.yaw = e.savedYaw;
      } else if (!inR && e.inRender) {
        e.savedPos.copy(e.g.position);
        e.savedYaw = e.yaw;
      }
      e.inRender = inR;
      e.g.visible = inR;
    }
    for (let i = 0; i < peasants.length; i++) {
      const p = peasants[i];
      if (!p || p.dead) continue;
      const inR = World.isPosInRender(p.savedPos.x, p.savedPos.z);
      if (inR && !p.inRender) {
        p.g.position.copy(p.savedPos);
        p.g.rotation.y = p.savedYaw;
        p.yaw = p.savedYaw;
      } else if (!inR && p.inRender) {
        p.savedPos.copy(p.g.position);
        p.savedYaw = p.yaw;
        if (p.labelEl) p.labelEl.classList.add('hidden');
      }
      p.inRender = inR;
      p.g.visible = inR;
    }
    for (let i = 0; i < gibs.length; i++) {
      const g = gibs[i];
      const inR = World.isPosInRender(g.x, g.z);
      if (g.inRender !== inR) { g.inRender = inR; gibsDirty = true; }
    }
    for (let i = 0; i < decals.length; i++) {
      const d = decals[i];
      const inR = d.chunk ? d.chunk.active : World.isPosInRender(d.x, d.z);
      if (d.inRender !== inR) { d.inRender = inR; decalsDirty = true; }
    }
  }

  function setRenderDistance(chunks) {
    World.setRenderDistance(chunks);
    syncRenderDistanceEntities();
  }

  /* referencias para outras partes */
  window.__HS = { P, S, WEAPONS, enemies, peasants, scene, camera, renderer, parts, gibs, decals, projs, rings, vmScene, vmCam, VMS };
  window.__HSAPI = {
    $, rnd, clamp, V3, lerpAngle, resolveCircle, groundAt, ceilingAt, pointInWall, los, clipCameraRay, burst, spawnRing, spawnProj, spawnEnemy, removeEnemy,
    clearRoomEnemies, aliveInRoom, hurtPlayer, dmgEnemy, killEnemy, addFaith, findHitPart, findHitPartRay, updateEnemy, updateParts, updateRings, updateProjs,
    setGloryGlow, flushGloryQueue, bisectEnemy, decapEnemy, smashHeadEnemy, launchKickedEnemy,
    makeNodeProp, makeEnemyHalves, severLimb, addCorpsePart, pushGib, evictOldestGib, bloodSpurt, spawnBloodDecal, spawnGore, deformGaliusHit, GIB_COLS,
    peasants, spawnPeasant, removePeasant, clearPeasants, spawnMapPeasants, hitPeasant, launchPeasantRagdoll, rescuePeasant, updatePeasant, updatePeasantLabels,
    clearParts, clearProjs, setBloodMode, setGoreDuration, setGoreImpact, setParticleScale, setGoreQuality, setDismember, setBleedJoints, setGibDrips,
    setBlobShadows, setEnemyCullDist, setPeasantLabels, setInternalHeight, setPsxJitter, setPixelatedCanvas, setSSAO,
    setRenderDistance, syncRenderDistanceEntities,
    computeMapBloodExpected, addBloodLiters, addStyle, registerStyleHit, registerStyleKill, WEAPON_BLOOD, KILL_TYPE_LABELS,
    ETYPES, DIFFICULTIES, getDifficulty, AMMO_MAX, keys, scene, camera, renderer, amb, sun, plight, sky, vmDir, vmScene, vmCam, resize, renderScene,
    setMouse: (v) => { mouseL = v; }, getMouse: () => mouseL, curW: () => curW, setCurW: (v) => { curW = v; }, wcd
  };
  // As funções abaixo são definidas na parte 2 (story) e referenciadas aqui
  var die, say, quip, spawnPickup, startImpale, startGaliusBite;
  window.__HSAPI.bind = (fns) => { die = fns.die; say = fns.say; quip = fns.quip; spawnPickup = fns.spawnPickup; startImpale = fns.startImpale; startGaliusBite = fns.startGaliusBite; };
  // ---- continua em game2.js ----
})();
