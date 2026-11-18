'use strict';
/* ============================================================
   HELLSLAYER - Sistema de Sangue Progressivo (Nivaldo & Armas)
   ============================================================ */
(function () {
  const BLOOD_DARK = new THREE.Color(0x520406);
  const BLOOD_SKIN = new THREE.Color(0x7a090d);
  const BLOOD_COLS = [0x8a080c, 0x620406, 0xa21016, 0x450204];

  // Materiais compartilhados para manchas 3D (um por tom de sangue)
  const SPLAT_MATS = BLOOD_COLS.map((c) => {
    const m = new THREE.MeshLambertMaterial({ color: c });
    if (typeof psx === 'function') psx(m);
    return m;
  });

  // Geometria unitária compartilhada para todas as manchas 3D (escalada por patch)
  const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

  const state = {
    body: 0,
    grace: 0,
    weapons: {
      fists: 0,
      hammer: 0,
      sling: 0,
      scythe: 0,
      demo: 0,
      cross: 0,
      heart: 0,
      kick: 0
    }
  };

  let nivaldo3PRec = null;
  const vmRecs = {}; // weaponId -> { meshes, splats, lastVal }

  // Gerador determinístico simples para posicionar manchas sem aleatoriedade instável
  function hashSeed(n) {
    let x = (n ^ 0x9e3779b9) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }

  function isArmNode(obj) {
    let cur = obj;
    while (cur) {
      if (cur.userData && cur.userData.isArm) return true;
      cur = cur.parent;
    }
    return false;
  }

  function prepareTarget(root, opts) {
    opts = opts || {};
    const meshes = [];
    const splats = [];
    const tmpBox = new THREE.Box3();
    const tmpSize = new THREE.Vector3();
    let idx = 0;

    root.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry || !obj.material) return;
      if (obj.userData && obj.userData.isBloodSplat) return;

      // Clona material para não alterar o cache global _mat de models.js
      const mat = obj.material.clone();
      obj.material = mat;

      const baseColor = mat.color ? mat.color.clone() : new THREE.Color(0xffffff);
      const baseEmissive = mat.emissive ? mat.emissive.clone() : null;
      const isArm = opts.forceBody || (opts.detectArms && isArmNode(obj));
      const isBasic = !!mat.isMeshBasicMaterial;

      meshes.push({ mesh: obj, mat, baseColor, baseEmissive, isArm, isBasic });

      // Pula detalhes básicos (olhos, dentes, núcleo brilhante da cruz) para manchas 3D
      // (e peças mescladas marcadas com noSplat: cabelo, corrente, spikes, cadarços)
      if (isBasic || (obj.userData && obj.userData.noSplat)) { idx++; return; }

      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
      tmpBox.copy(obj.geometry.boundingBox);
      tmpBox.getSize(tmpSize);

      const maxDim = Math.max(tmpSize.x, tmpSize.y, tmpSize.z);
      const minDim = Math.min(tmpSize.x, tmpSize.y, tmpSize.z);
      if (maxDim < 0.08 || minDim < 0.015) { idx++; return; }

      // Quantidade de manchas proporcional ao tamanho da peça
      const count = maxDim > 0.55 ? 4 : maxDim > 0.25 ? 3 : 2;
      for (let s = 0; s < count; s++) {
        const seed = idx * 31 + s * 17 + (opts.seedOffset || 0);
        const r1 = hashSeed(seed + 1);
        const r2 = hashSeed(seed + 2);
        const r3 = hashSeed(seed + 3);
        const r4 = hashSeed(seed + 4);
        const r5 = hashSeed(seed + 5);

        // Escolhe uma face da caixa para grudar a mancha
        const face = Math.floor(r1 * 6);
        const sx = tmpSize.x, sy = tmpSize.y, sz = tmpSize.z;
        const pad = 0.005;
        let px = (r2 - 0.5) * sx * 0.72;
        let py = (r3 - 0.5) * sy * 0.72;
        let pz = (r4 - 0.5) * sz * 0.72;

        // Tamanho da mancha: fina no eixo normal à face, alongada nos outros
        const patchA = Math.min(maxDim * 0.42, 0.045 + r5 * 0.11);
        const patchB = Math.min(maxDim * 0.34, 0.03 + r2 * 0.08);
        const thick = 0.008;
        let w = patchA, h = patchB, d = thick;

        if (face === 0) { px = sx * 0.5 + pad; w = thick; h = patchA; d = patchB; }
        else if (face === 1) { px = -sx * 0.5 - pad; w = thick; h = patchA; d = patchB; }
        else if (face === 2) { py = sy * 0.5 + pad; w = patchA; h = thick; d = patchB; }
        else if (face === 3) { py = -sy * 0.5 - pad; w = patchA; h = thick; d = patchB; }
        else if (face === 4) { pz = sz * 0.5 + pad; w = patchA; h = patchB; d = thick; }
        else { pz = -sz * 0.5 - pad; w = patchA; h = patchB; d = thick; }

        // Peças arredondadas (músculos elipsoides / cilindros): puxa a mancha até a superfície
        const round = obj.userData && obj.userData.roundSplat;
        if (round) {
          const ax = sx * 0.5, ay = sy * 0.5, az = sz * 0.5;
          if (round === 'sphere') {
            const k = 1.01 / Math.sqrt((px / ax) ** 2 + (py / ay) ** 2 + (pz / az) ** 2);
            px *= k; py *= k; pz *= k;
          } else if (round === 'cyl' && face !== 2 && face !== 3) {
            const k = 1.01 / Math.sqrt((px / ax) ** 2 + (pz / az) ** 2);
            px *= k; pz *= k;
          }
        }

        const splatMat = SPLAT_MATS[(seed) % SPLAT_MATS.length];
        const splat = new THREE.Mesh(UNIT_BOX, splatMat);
        splat.scale.set(w, h, d);
        splat.position.set(px, py, pz);
        splat.visible = false;
        splat.userData.isBloodSplat = true;
        obj.add(splat);

        // Limiar progressivo para aparecer conforme o nível de sangue sobe
        const threshold = 0.06 + (s / count) * 0.55 + r5 * 0.30;
        splats.push({ mesh: splat, threshold: Math.min(0.95, threshold), isArm });
      }
      idx++;
    });

    return { meshes, splats, lastBody: -1, lastWeap: -1 };
  }

  function applyRecord(rec, bodyVal, weapVal) {
    if (!rec) return;
    if (rec.lastBody === bodyVal && rec.lastWeap === weapVal) return;
    rec.lastBody = bodyVal;
    rec.lastWeap = weapVal;

    for (let i = 0; i < rec.meshes.length; i++) {
      const m = rec.meshes[i];
      if (m.isBasic) continue;
      const v = m.isArm ? bodyVal : weapVal;
      if (m.mat.color) {
        const target = m.isArm ? BLOOD_SKIN : BLOOD_DARK;
        const mix = v * 0.48;
        m.mat.color.copy(m.baseColor).lerp(target, mix);
      }
      if (m.baseEmissive && m.mat.emissive) {
        m.mat.emissive.copy(m.baseEmissive).multiplyScalar(1 - v * 0.55);
      }
    }

    for (let i = 0; i < rec.splats.length; i++) {
      const sp = rec.splats[i];
      const v = sp.isArm ? bodyVal : weapVal;
      sp.mesh.visible = v >= sp.threshold;
    }
  }

  function syncAll() {
    if (nivaldo3PRec) applyRecord(nivaldo3PRec, state.body, state.body);
    for (const id in vmRecs) {
      const wVal = state.weapons[id] || 0;
      const bodyVal = (id === 'fists' || id === 'kick')
        ? Math.max(state.body * 0.85, wVal)
        : state.body;
      applyRecord(vmRecs[id], bodyVal, wVal);
    }
  }

  function init(nivaldo3P, VMS) {
    if (nivaldo3P && nivaldo3P.root && !nivaldo3PRec) {
      nivaldo3PRec = prepareTarget(nivaldo3P.root, { forceBody: true, seedOffset: 101 });
    }
    if (VMS) {
      let off = 200;
      for (const id in VMS) {
        if (VMS[id] && VMS[id].root && !vmRecs[id]) {
          const isBodyWeapon = (id === 'fists' || id === 'kick');
          vmRecs[id] = prepareTarget(VMS[id].root, {
            detectArms: !isBodyWeapon,
            forceBody: false,
            seedOffset: off
          });
          off += 97;
        }
      }
    }
    syncAll();
  }

  function addBlood(bodyAmt, weaponId, weaponAmt) {
    if (bodyAmt > 0) state.body = Math.min(1, state.body + bodyAmt);
    if (weaponId && state.weapons[weaponId] !== undefined && weaponAmt > 0) {
      state.weapons[weaponId] = Math.min(1, state.weapons[weaponId] + weaponAmt);
    }
    state.grace = 1.5;
    syncAll();
  }

  function applyToCross(mesh) {
    if (!mesh) return;
    if (!mesh.userData._bloodRec) {
      mesh.userData._bloodRec = prepareTarget(mesh, { forceBody: false, seedOffset: 777 });
    }
    const wVal = state.weapons.cross || 0;
    applyRecord(mesh.userData._bloodRec, wVal, wVal);
  }

  function update(dt, moveAmt) {
    if (state.grace > 0) {
      state.grace = Math.max(0, state.grace - dt);
      return;
    }
    // Desaparece gradualmente conforme Nivaldo anda e se movimenta
    const mv = Math.max(0, moveAmt || 0);
    const wear = mv > 0.3
      ? (0.012 + Math.min(24, mv) * 0.0028) * dt
      : 0.002 * dt;
    let changed = false;
    if (state.body > 0) {
      state.body = Math.max(0, state.body - wear);
      changed = true;
    }
    for (const id in state.weapons) {
      if (state.weapons[id] > 0) {
        state.weapons[id] = Math.max(0, state.weapons[id] - wear);
        changed = true;
      }
    }
    if (changed) syncAll();
  }

  function reset() {
    state.body = 0;
    state.grace = 0;
    for (const id in state.weapons) state.weapons[id] = 0;
    syncAll();
  }

  window.BloodStain = {
    init,
    addBlood,
    applyToCross,
    update,
    reset,
    getBodyBlood: () => state.body,
    getWeaponBlood: (id) => state.weapons[id] || 0
  };
})();
