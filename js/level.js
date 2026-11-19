'use strict';
/* ============================================================
   HELLSLAYER - construção dos mapas separados (Beta 1+) + Sistema de Chunks
   Convenção: "frente" = -Z.  hall(x1,z1,x2,z2): x1<x2, z1<z2
   ============================================================ */
const CHUNK_SIZE = 16;

const World = {
  CHUNK_SIZE,
  renderChunks: 8,
  viewerX: 0, viewerZ: 0,
  viewerChunkX: 0, viewerChunkZ: 0,
  _lastRenderChunks: -1,
  chunks: new Map(),
  scene: null, group: null, currentMap: 'a1',
  colliders: [], dynamicColliders: [], colliderGrid: new Map(), _queryStamp: 0,
  triggers: [], gates: {}, flames: [], anim: [], meshes: [], pillars: [],
  distantMeshes: [], detailMode: 'high', onFlameEmber: null,
  terrainY: null, terrainBaseFn: null, pads: [], pendingFloors: [], houseRects: [],
  exitGate: null, breakWall: null, hatch: null, altar: null, portal: null,
  altarCross: null, ghost: null, crossPickup: null, doorMesh: null, skyPortal: null,
  addTrigger(t) {
    World.triggers.push(Object.assign({ active: true, once: true, triggered: false }, t));
  },
  toChunk(v) {
    return Math.floor(v / CHUNK_SIZE);
  },
  chunkKey(cx, cz) {
    return cx + ',' + cz;
  },
  isChunkInRender(cx, cz) {
    const R = World.renderChunks || 8;
    const dx = cx - World.viewerChunkX;
    const dz = cz - World.viewerChunkZ;
    return Math.abs(dx) <= R && Math.abs(dz) <= R && (dx * dx + dz * dz) <= (R + 0.45) * (R + 0.45);
  },
  isPosInRender(x, z) {
    return World.isChunkInRender(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
  },
  getChunk(cx, cz) {
    const key = cx + ',' + cz;
    let ch = World.chunks.get(key);
    if (!ch) {
      const grp = new THREE.Group();
      const active = World.isChunkInRender(cx, cz);
      grp.visible = active;
      if (World.group || World.scene) (World.group || World.scene).add(grp);
      ch = { cx, cz, key, group: grp, objects: [], active };
      World.chunks.set(key, ch);
    }
    return ch;
  },
  getChunkAt(x, z) {
    return World.getChunk(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
  },
  setRenderDistance(chunks) {
    const n = Number(chunks);
    World.renderChunks = Number.isFinite(n) ? Math.max(2, Math.min(16, Math.round(n))) : 8;
    World.updateChunks(World.viewerX || 0, World.viewerZ || 0, true);
  },
  updateChunks(vx, vz, force) {
    World.viewerX = vx;
    World.viewerZ = vz;
    const vcx = Math.floor(vx / CHUNK_SIZE);
    const vcz = Math.floor(vz / CHUNK_SIZE);
    if (!force && vcx === World.viewerChunkX && vcz === World.viewerChunkZ && World._lastRenderChunks === World.renderChunks) {
      return false;
    }
    World.viewerChunkX = vcx;
    World.viewerChunkZ = vcz;
    World._lastRenderChunks = World.renderChunks;
    for (const ch of World.chunks.values()) {
      const vis = World.isChunkInRender(ch.cx, ch.cz);
      if (ch.active !== vis) {
        ch.active = vis;
        ch.group.visible = vis;
        if (vis) {
          for (let i = 0; i < ch.objects.length; i++) {
            const o = ch.objects[i];
            if (o.userData && o.userData.savedPos && !o.userData.dynamicPos) {
              o.position.copy(o.userData.savedPos);
            }
          }
        } else {
          for (let i = 0; i < ch.objects.length; i++) {
            const o = ch.objects[i];
            if (o.userData && !o.userData.dynamicPos) {
              if (!o.userData.savedPos) o.userData.savedPos = o.position.clone();
              else o.userData.savedPos.copy(o.position);
            }
          }
        }
      } else {
        ch.group.visible = vis;
      }
    }
    return true;
  },
  rebuildColliderGrid() {
    World.colliderGrid.clear();
    World.dynamicColliders.length = 0;
    const cs = World.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c) continue;
      c._qStamp = 0;
      if (c._dyn) {
        World.dynamicColliders.push(c);
        continue;
      }
      const cMinX = Math.floor(c.x1 / CHUNK_SIZE);
      const cMaxX = Math.floor(c.x2 / CHUNK_SIZE);
      const cMinZ = Math.floor(c.z1 / CHUNK_SIZE);
      const cMaxZ = Math.floor(c.z2 / CHUNK_SIZE);
      for (let cx = cMinX; cx <= cMaxX; cx++) {
        for (let cz = cMinZ; cz <= cMaxZ; cz++) {
          const k = cx + ',' + cz;
          let bucket = World.colliderGrid.get(k);
          if (!bucket) { bucket = []; World.colliderGrid.set(k, bucket); }
          bucket.push(c);
        }
      }
    }
  },
  queryColliders(minX, minZ, maxX, maxZ, out) {
    out.length = 0;
    const stamp = ++World._queryStamp;
    const cMinX = Math.floor(minX / CHUNK_SIZE);
    const cMaxX = Math.floor(maxX / CHUNK_SIZE);
    const cMinZ = Math.floor(minZ / CHUNK_SIZE);
    const cMaxZ = Math.floor(maxZ / CHUNK_SIZE);
    for (let cx = cMinX; cx <= cMaxX; cx++) {
      for (let cz = cMinZ; cz <= cMaxZ; cz++) {
        const bucket = World.colliderGrid.get(cx + ',' + cz);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const c = bucket[i];
          if (c._qStamp !== stamp) {
            c._qStamp = stamp;
            out.push(c);
          }
        }
      }
    }
    const dyn = World.dynamicColliders;
    for (let i = 0; i < dyn.length; i++) {
      const c = dyn[i];
      if (c._qStamp !== stamp) {
        c._qStamp = stamp;
        out.push(c);
      }
    }
    return out;
  }
};
window.CHAPTERS = window.CHAPTERS || {};

const ENV = {
  hell:   { fog: 0x2a0a08, near: 6,  far: 140, amb: 0x8a5a50, ambI: 1.15, dir: 0xff6a40, dirI: 0.7 },
  church: { fog: 0x160a18, near: 5,  far: 90,  amb: 0x84609a, ambI: 1.4,  dir: 0xaa5080, dirI: 0.5 },
  crypt:  { fog: 0x050c0a, near: 2,  far: 52,  amb: 0x4a7060, ambI: 1.0,  dir: 0x40a080, dirI: 0.35 }
};

function getGroundY(x, z) {
  return World.terrainY ? World.terrainY(x, z) : 0;
}
function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function applyPads(x, z, h) {
  const pads = World.pads;
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    const b = p.blend;
    const ax = Math.abs(x - p.cx) - p.hw;
    if (ax >= b) continue;
    const az = Math.abs(z - p.cz) - p.hd;
    if (az >= b) continue;
    if (ax <= 0 && az <= 0) {
      h = p.y;
      continue;
    }
    const dx = ax > 0 ? ax : 0;
    const dz = az > 0 ? az : 0;
    const d2 = dx * dx + dz * dz;
    const bSq = p.blendSq || (b * b);
    if (d2 < bSq) {
      const t = Math.sqrt(d2) / b;
      const s = t * t * (3 - 2 * t);
      h = p.y * (1 - s) + h * s;
    }
  }
  return h;
}
function setTerrain(baseFn) {
  World.terrainBaseFn = baseFn;
  World.terrainY = (x, z) => applyPads(x, z, baseFn(x, z));
}
function addPad(cx, cz, hw, hd, blend) {
  if (!World.terrainBaseFn) return 0;
  const y = World.terrainBaseFn(cx, cz);
  const b = blend || 5;
  World.pads.push({ cx, cz, hw, hd, blend: b, blendSq: b * b, y });
  return y;
}
function envAt(x, z) {
  if (World.currentMap === 'a6_crypt') return 'crypt';
  if (World.currentMap === 'a6_nave') return 'church';
  return 'hell';
}

function addW(obj, refX, refZ) {
  obj.userData = obj.userData || {};
  const rx = refX != null ? refX : (obj.userData.chunkPos ? obj.userData.chunkPos.x : obj.position.x);
  const rz = refZ != null ? refZ : (obj.userData.chunkPos ? obj.userData.chunkPos.z : obj.position.z);
  obj.userData.savedPos = obj.position.clone();
  obj.userData.worldRef = { x: rx, z: rz };
  const ch = World.getChunkAt(rx, rz);
  obj.userData.chunk = ch;
  ch.objects.push(obj);
  ch.group.add(obj);
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
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  m.position.set(cx, y0 + h / 2, cz);
  addW(m, cx, cz);
  let col = null;
  if (o.collide !== false) {
    const walkable = o.walkable != null ? o.walkable : (h <= 2.2);
    col = {
      x1: Math.min(x1, x2), z1: Math.min(z1, z2),
      x2: Math.max(x1, x2), z2: Math.max(z1, z2),
      y0, yMax: y0 + h, walkable, overhead: !!o.overhead, active: true
    };
    World.colliders.push(col);
  }
  m.userData.col = col;
  return m;
}

// Pilastra quebrável (Sérgio Maximo e Galius destroem ao passar). Não é fundida em mesh estática.
function wpillar(x1, z1, x2, z2, h, tex, o) {
  o = o || {};
  const m = wbox(x1, z1, x2, z2, h, tex, o);
  m.userData.noMerge = true;
  const col = m.userData.col;
  if (col) col.pillar = true;
  const rub = wbox(x1 - 0.5, z1 - 0.5, x2 + 0.5, z2 + 0.5, 0.45, 'stone', { collide: false, tile: 2, y0: o.y0 || 0 });
  rub.userData.noMerge = true;
  rub.visible = false;
  const p = {
    mesh: m, col, rubble: rub, flame: null, broken: false, h,
    x1: Math.min(x1, x2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), z2: Math.max(z1, z2),
    x: (x1 + x2) / 2, z: (z1 + z2) / 2, y0: o.y0 || 0
  };
  World.pillars.push(p);
  return p;
}

function wterrainPatch(sx1, sz1, sx2, sz2, minX, maxZ, tex, yLift, tile, step, fn, mat, renderOrder, skipBuried) {
  if (skipBuried) {
    const mx = (sx1 + sx2) * 0.5, mz = (sz1 + sz2) * 0.5;
    if (
      fn(sx1, sz1) <= getGroundY(sx1, sz1) - 4.5 &&
      fn(sx2, sz1) <= getGroundY(sx2, sz1) - 4.5 &&
      fn(sx1, sz2) <= getGroundY(sx1, sz2) - 4.5 &&
      fn(sx2, sz2) <= getGroundY(sx2, sz2) - 4.5 &&
      fn(mx, mz) <= getGroundY(mx, mz) - 4.5
    ) {
      return null;
    }
  }
  const w = sx2 - sx1, d = sz2 - sz1;
  const segX = Math.max(1, Math.min(24, Math.round(w / step)));
  const segZ = Math.max(1, Math.min(24, Math.round(d / step)));
  const g = new THREE.PlaneGeometry(w, d, segX, segZ);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const wx = sx1 + uv.getX(i) * w;
    const wz = sz1 + (1 - uv.getY(i)) * d;
    uv.setXY(i, (wx - minX) / tile, (maxZ - wz) / tile);
  }
  g.rotateX(-Math.PI / 2);
  const cx = (sx1 + sx2) / 2, cz = (sz1 + sz2) / 2;
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const eps = 0.35;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i) + cx, vz = pos.getZ(i) + cz;
    pos.setY(i, fn(vx, vz) + yLift);
    if (nrm) {
      const nx = fn(vx - eps, vz) - fn(vx + eps, vz);
      const nz = fn(vx, vz - eps) - fn(vx, vz + eps);
      const ny = 2 * eps;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nrm.setXYZ(i, nx / nl, ny / nl, nz / nl);
    }
  }
  if (!nrm) g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.position.set(cx, 0, cz);
  if (renderOrder) m.renderOrder = renderOrder;
  return addW(m, cx, cz);
}

function wterrain(x1, z1, x2, z2, tex, yOff, tile, segStep, customFn, skipBuried) {
  tile = tile || 4;
  const yPos = yOff || 0;
  const yLift = yPos > 0 ? Math.max(yPos, 0.07) : yPos;
  const step = segStep || (yPos > 0 ? 2.5 : 4);
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  const fn = customFn || getGroundY;
  const polyOffset = yLift < 0 ? 4 : (yLift >= 0.06 ? -6 : (yLift > 0 ? -2 : 0));
  const mat = TX.mat(tex, polyOffset);
  const renderOrder = yLift < 0 ? -1 : (yLift >= 0.06 ? 2 : (yLift > 0 ? 1 : 0));

  const cMinX = Math.floor(minX / CHUNK_SIZE), cMaxX = Math.ceil(maxX / CHUNK_SIZE) - 1;
  const cMinZ = Math.floor(minZ / CHUNK_SIZE), cMaxZ = Math.ceil(maxZ / CHUNK_SIZE) - 1;
  let lastMesh = null;
  for (let cxIdx = cMinX; cxIdx <= cMaxX; cxIdx++) {
    const sx1 = Math.max(minX, cxIdx * CHUNK_SIZE);
    const sx2 = Math.min(maxX, (cxIdx + 1) * CHUNK_SIZE);
    if (sx2 - sx1 < 0.01) continue;
    for (let czIdx = cMinZ; czIdx <= cMaxZ; czIdx++) {
      const sz1 = Math.max(minZ, czIdx * CHUNK_SIZE);
      const sz2 = Math.min(maxZ, (czIdx + 1) * CHUNK_SIZE);
      if (sz2 - sz1 < 0.01) continue;
      const m = wterrainPatch(sx1, sz1, sx2, sz2, minX, maxZ, tex, yLift, tile, step, fn, mat, renderOrder, skipBuried);
      if (m) lastMesh = m;
    }
  }
  return lastMesh;
}

function flushTerrain() {
  for (let i = 0; i < World.pendingFloors.length; i++) {
    const f = World.pendingFloors[i];
    wterrain(f.x1, f.z1, f.x2, f.z2, f.tex, f.y, f.tile, f.segStep, f.customFn, f.skipBuried);
  }
  World.pendingFloors.length = 0;
}

function wfloor(x1, z1, x2, z2, tex, y, tile, flat) {
  tile = tile || 4;
  const yPos = y || 0;
  if (World.terrainY && !flat) {
    World.pendingFloors.push({ x1, z1, x2, z2, tex, y: yPos, tile });
    return null;
  }
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  const polyOffset = yPos < 0 ? 4 : (yPos >= 0.06 ? -5 : (yPos > 0 ? -2 : 0));
  const mat = TX.mat(tex, polyOffset);
  const renderOrder = yPos < 0 ? -1 : (yPos >= 0.06 ? 2 : (yPos > 0 ? 1 : 0));

  const cMinX = Math.floor(minX / CHUNK_SIZE), cMaxX = Math.ceil(maxX / CHUNK_SIZE) - 1;
  const cMinZ = Math.floor(minZ / CHUNK_SIZE), cMaxZ = Math.ceil(maxZ / CHUNK_SIZE) - 1;
  let lastMesh = null;
  for (let cxIdx = cMinX; cxIdx <= cMaxX; cxIdx++) {
    const sx1 = Math.max(minX, cxIdx * CHUNK_SIZE);
    const sx2 = Math.min(maxX, (cxIdx + 1) * CHUNK_SIZE);
    const sw = sx2 - sx1;
    if (sw < 0.01) continue;
    for (let czIdx = cMinZ; czIdx <= cMaxZ; czIdx++) {
      const sz1 = Math.max(minZ, czIdx * CHUNK_SIZE);
      const sz2 = Math.min(maxZ, (czIdx + 1) * CHUNK_SIZE);
      const sd = sz2 - sz1;
      if (sd < 0.01) continue;
      const segX = Math.max(1, Math.min(4, Math.round(sw / 8)));
      const segZ = Math.max(1, Math.min(4, Math.round(sd / 8)));
      const g = new THREE.PlaneGeometry(sw, sd, segX, segZ);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const wx = sx1 + uv.getX(i) * sw;
        const wz = sz1 + (1 - uv.getY(i)) * sd;
        uv.setXY(i, (wx - minX) / tile, (maxZ - wz) / tile);
      }
      g.rotateX(-Math.PI / 2);
      const cx = (sx1 + sx2) / 2, cz = (sz1 + sz2) / 2;
      const m = new THREE.Mesh(g, mat);
      m.position.set(cx, yPos, cz);
      if (renderOrder) m.renderOrder = renderOrder;
      lastMesh = addW(m, cx, cz);
    }
  }
  return lastMesh;
}

function wceil(x1, z1, x2, z2, tex, y, tile) {
  tile = tile || 4;
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  const mat = TX.mat(tex);
  const cMinX = Math.floor(minX / CHUNK_SIZE), cMaxX = Math.ceil(maxX / CHUNK_SIZE) - 1;
  const cMinZ = Math.floor(minZ / CHUNK_SIZE), cMaxZ = Math.ceil(maxZ / CHUNK_SIZE) - 1;
  let lastMesh = null;
  for (let cxIdx = cMinX; cxIdx <= cMaxX; cxIdx++) {
    const sx1 = Math.max(minX, cxIdx * CHUNK_SIZE);
    const sx2 = Math.min(maxX, (cxIdx + 1) * CHUNK_SIZE);
    const sw = sx2 - sx1;
    if (sw < 0.01) continue;
    for (let czIdx = cMinZ; czIdx <= cMaxZ; czIdx++) {
      const sz1 = Math.max(minZ, czIdx * CHUNK_SIZE);
      const sz2 = Math.min(maxZ, (czIdx + 1) * CHUNK_SIZE);
      const sd = sz2 - sz1;
      if (sd < 0.01) continue;
      const g = new THREE.PlaneGeometry(sw, sd);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const wx = sx1 + uv.getX(i) * sw;
        const wz = sz1 + (1 - uv.getY(i)) * sd;
        uv.setXY(i, (wx - minX) / tile, (maxZ - wz) / tile);
      }
      g.rotateX(Math.PI / 2);
      const cx = (sx1 + sx2) / 2, cz = (sz1 + sz2) / 2;
      const m = new THREE.Mesh(g, mat);
      m.position.set(cx, y, cz);
      lastMesh = addW(m, cx, cz);
    }
  }
  return lastMesh;
}

function hall(x1, z1, x2, z2, o) {
  const h = o.h || 5, t = o.t || 1, tex = o.wall || 'brick', skip = o.skip || [], ops = o.openings || [];
  const hts = o.heights || {};
  const baseY = o.y0 || 0, sink = o.sink || 0;
  const follow = !!(World.terrainY && o.y0 == null && !o.flat);
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
    const seg = (sa, sb, y0, hh, collide, isLintel) => {
      if (sb - sa < 0.01) return;
      if (follow) {
        const len = sb - sa;
        const nChunks = Math.max(1, Math.ceil(len / 8));
        const step = len / nChunks;
        for (let i = 0; i < nChunks; i++) {
          const ca = sa + i * step, cb = sa + (i + 1) * step, cm = (ca + cb) * 0.5;
          const ga = S.ax === 'x' ? getGroundY(ca, S.f) : getGroundY(S.f, ca);
          const gm = S.ax === 'x' ? getGroundY(cm, S.f) : getGroundY(S.f, cm);
          const gb = S.ax === 'x' ? getGroundY(cb, S.f) : getGroundY(S.f, cb);
          const gMin = Math.min(ga, gm, gb), gMax = Math.max(ga, gm, gb);
          const cy0 = isLintel ? (gm + y0) : (gMin - 3.0);
          const ch = isLintel ? hh : (gMax + hh - cy0);
          if (S.ax === 'x') wbox(ca, S.f - t / 2, cb, S.f + t / 2, ch, tex, { y0: cy0, collide, walkable: false, overhead: isLintel });
          else wbox(S.f - t / 2, ca, S.f + t / 2, cb, ch, tex, { y0: cy0, collide, walkable: false, overhead: isLintel });
        }
        return;
      }
      const cy0 = isLintel ? (baseY + y0) : (baseY + y0 - sink);
      const ch = isLintel ? hh : (hh + sink);
      const len = sb - sa;
      if (len > CHUNK_SIZE) {
        if (collide) {
          const col = S.ax === 'x'
            ? { x1: Math.min(sa, sb), z1: S.f - t / 2, x2: Math.max(sa, sb), z2: S.f + t / 2, y0: cy0, yMax: cy0 + ch, walkable: false, overhead: isLintel, active: true }
            : { x1: S.f - t / 2, z1: Math.min(sa, sb), x2: S.f + t / 2, z2: Math.max(sa, sb), y0: cy0, yMax: cy0 + ch, walkable: false, overhead: isLintel, active: true };
          World.colliders.push(col);
        }
        const nSegs = Math.max(1, Math.ceil(len / CHUNK_SIZE));
        const step = len / nSegs;
        for (let i = 0; i < nSegs; i++) {
          const ca = sa + i * step, cb = sa + (i + 1) * step;
          if (S.ax === 'x') wbox(ca, S.f - t / 2, cb, S.f + t / 2, ch, tex, { y0: cy0, collide: false, walkable: false });
          else wbox(S.f - t / 2, ca, S.f + t / 2, cb, ch, tex, { y0: cy0, collide: false, walkable: false });
        }
        return;
      }
      if (S.ax === 'x') wbox(sa, S.f - t / 2, sb, S.f + t / 2, ch, tex, { y0: cy0, collide, walkable: false, overhead: isLintel });
      else wbox(S.f - t / 2, sa, S.f + t / 2, sb, ch, tex, { y0: cy0, collide, walkable: false, overhead: isLintel });
    };
    let cur = S.a;
    for (const p of list) {
      if (p.a > cur) seg(cur, p.a, 0, H, true, false);
      if (p.oh < H) seg(p.a, p.b, p.oh, H - p.oh, o.lintelCollide !== false, true);
      cur = p.b;
    }
    if (cur < S.b) seg(cur, S.b, 0, H, true, false);
  }
  if (o.ceil) wceil(x1, z1, x2, z2, o.ceil, baseY + h, 8);
  if (o.roof) {
    const w = x2 - x1, d = z2 - z1, m = Math.max(w, d);
    const roofH = o.roofH || 3;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(m * 0.78, roofH, 4), TX.mat('roof'));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w / m, 1, d / m);
    const rcx = (x1 + x2) / 2, rcz = (z1 + z2) / 2;
    roof.position.set(rcx, baseY + h + roofH / 2, rcz);
    addW(roof, rcx, rcz);
    const tiers = Math.max(6, Math.ceil(roofH / 0.32));
    const stepH = roofH / tiers;
    for (let i = 0; i < tiers; i++) {
      const shrink = (i / tiers) * 0.5;
      const hw = Math.max(0.5, (w * 0.5 + 0.35) * (1 - shrink * 1.6));
      const hd = Math.max(0.5, (d * 0.5 + 0.35) * (1 - shrink * 1.6));
      World.colliders.push({
        x1: rcx - hw, z1: rcz - hd, x2: rcx + hw, z2: rcz + hd,
        y0: (i === 0) ? (baseY + h - 0.25) : (baseY + h + i * stepH),
        yMax: baseY + h + (i + 1) * stepH,
        walkable: true, overhead: true, active: true
      });
    }
    if (o.burn) {
      const peakScale = Math.max(2.6, Math.min(4.6, m * 0.25));
      flame(rcx, baseY + h + roofH - 0.35, rcz, peakScale, null, { smoke: true });
      const spots = [
        [-0.22, -0.18, 0.72],
        [0.24, -0.2, 0.68],
        [-0.2, 0.24, 0.65],
        [0.21, 0.2, 0.7]
      ];
      for (let i = 0; i < spots.length; i++) {
        const sp = spots[i];
        const fx = rcx + sp[0] * w, fz = rcz + sp[1] * d;
        const slopeH = Math.max(0, 1 - 2 * Math.max(Math.abs(sp[0]), Math.abs(sp[1])));
        const fy = baseY + h + roofH * slopeH - 0.3;
        flame(fx, fy, fz, peakScale * sp[2], null, { smoke: i < 2 });
      }
    }
  }
}

function gablePrismGeo(span, height, thick, tile) {
  const hs = span * 0.5, ht = thick * 0.5, t = tile || 4;
  const sLen = Math.hypot(hs, height);
  const nx = height / sLen, ny = hs / sLen;
  const pos = [
    -hs, 0, ht,   hs, 0, ht,    0, height, ht,
     hs, 0, -ht, -hs, 0, -ht,   0, height, -ht,
    -hs, 0, -ht, -hs, 0, ht,    0, height, ht,
    -hs, 0, -ht,  0, height, ht, 0, height, -ht,
     hs, 0, ht,   hs, 0, -ht,   0, height, -ht,
     hs, 0, ht,   0, height, -ht, 0, height, ht,
    -hs, 0, -ht,  hs, 0, -ht,   hs, 0, ht,
    -hs, 0, -ht,  hs, 0, ht,   -hs, 0, ht
  ];
  const nrm = [
    0, 0, 1,   0, 0, 1,   0, 0, 1,
    0, 0, -1,  0, 0, -1,  0, 0, -1,
    -nx, ny, 0, -nx, ny, 0, -nx, ny, 0,
    -nx, ny, 0, -nx, ny, 0, -nx, ny, 0,
    nx, ny, 0,  nx, ny, 0,  nx, ny, 0,
    nx, ny, 0,  nx, ny, 0,  nx, ny, 0,
    0, -1, 0,   0, -1, 0,   0, -1, 0,
    0, -1, 0,   0, -1, 0,   0, -1, 0
  ];
  const uv = [
    0, 0,  span / t, 0,  hs / t, height / t,
    0, 0,  span / t, 0,  hs / t, height / t,
    0, 0,  thick / t, 0,  thick / t, sLen / t,
    0, 0,  thick / t, sLen / t,  0, sLen / t,
    0, 0,  thick / t, 0,  thick / t, sLen / t,
    0, 0,  thick / t, sLen / t,  0, sLen / t,
    0, 0,  span / t, 0,  span / t, thick / t,
    0, 0,  span / t, thick / t,  0, thick / t
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

function addHouseWindow(wx, wy, wz, axis, winW, winH, trimTex, burn) {
  const paneMat = MT(burn ? 0x160a05 : 0x26180d, { emissive: burn ? 0x180702 : 0x2a1808 });
  const fT = 0.16, fD = 0.22;
  if (axis === 'x') {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.12), paneMat);
    pane.position.set(wx, wy, wz);
    addW(pane, wx, wz);
    wbox(wx - winW / 2 - fT, wz - fD / 2, wx + winW / 2 + fT, wz + fD / 2, fT + 0.04, trimTex, { y0: wy - winH / 2 - fT, collide: false, tile: 2 });
    wbox(wx - winW / 2 - fT, wz - fD / 2, wx + winW / 2 + fT, wz + fD / 2, fT, trimTex, { y0: wy + winH / 2, collide: false, tile: 2 });
    wbox(wx - winW / 2 - fT, wz - fD / 2, wx - winW / 2, wz + fD / 2, winH, trimTex, { y0: wy - winH / 2, collide: false, tile: 2 });
    wbox(wx + winW / 2, wz - fD / 2, wx + winW / 2 + fT, wz + fD / 2, winH, trimTex, { y0: wy - winH / 2, collide: false, tile: 2 });
    wbox(wx - 0.06, wz - fD / 2, wx + 0.06, wz + fD / 2, winH, trimTex, { y0: wy - winH / 2, collide: false, tile: 2 });
    wbox(wx - winW / 2, wz - fD / 2, wx + winW / 2, wz + fD / 2, 0.10, trimTex, { y0: wy - 0.05, collide: false, tile: 2 });
  } else {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.12, winH, winW), paneMat);
    pane.position.set(wx, wy, wz);
    addW(pane, wx, wz);
    wbox(wx - fD / 2, wz - winW / 2 - fT, wx + fD / 2, wz + winW / 2 + fT, fT + 0.04, trimTex, { y0: wy - winH / 2 - fT, collide: false, tile: 2 });
    wbox(wx - fD / 2, wz - winW / 2 - fT, wx + fD / 2, wz + winW / 2 + fT, fT, trimTex, { y0: wy + winH / 2, collide: false, tile: 2 });
    wbox(wx - fD / 2, wz - winW / 2 - fT, wx + fD / 2, wz - winW / 2, winH, trimTex, { y0: wy - winH / 2, collide: false, tile: 2 });
    wbox(wx - fD / 2, wz + winW / 2, wx + fD / 2, wz + winW / 2 + fT, winH, trimTex, { y0: wy - winH / 2, collide: false, tile: 2 });
    wbox(wx - fD / 2, wz - 0.06, wx + fD / 2, wz + 0.06, winH, trimTex, { y0: wy - winH / 2, collide: false, tile: 2 });
    wbox(wx - fD / 2, wz - winW / 2, wx + fD / 2, wz + winW / 2, 0.10, trimTex, { y0: wy - 0.05, collide: false, tile: 2 });
  }
}

function house(cx, cz, w, d, face, o) {
  o = o || {};
  const h = Math.max(4.8, o.h || 4.8);
  const big = h > 5.5;
  const t = 0.7;
  const wallTex = o.wall || 'brick';
  const trimTex = wallTex === 'church' ? 'church' : (wallTex === 'stone' ? 'stone' : 'wood');
  const plinthTex = wallTex === 'church' ? 'church' : 'stone';
  const doorC = (face === 'e' || face === 'w') ? cz : cx;
  const doorW = big ? 4.2 : 3.2;
  const oh = big ? 4.6 : 3.85;
  const sink = World.terrainY ? 2.5 : 0.2;
  const floorRise = 0.22;
  const hy = World.terrainY ? addPad(cx, cz, w / 2 + 1.5, d / 2 + 1.5, 5.5) : 0;
  const x1 = cx - w / 2, x2 = cx + w / 2, z1 = cz - d / 2, z2 = cz + d / 2;
  World.houseRects.push({ x1, z1, x2, z2, cx, cz, face });

  // Paredes principais + verga da porta com colisão (overhead)
  hall(x1, z1, x2, z2, {
    h, t, wall: wallTex, roof: false, lintelCollide: true,
    y0: hy, sink: World.terrainY ? 2.5 : 0,
    openings: [{ side: face, c: doorC, w: doorW, oh }]
  });

  // Piso interno caminhável
  wbox(x1, z1, x2, z2, sink + floorRise, o.floor || 'wood', {
    y0: hy - sink, tile: 4, walkable: true
  });

  // Rodapé de pedra ao redor da base (respeitando a abertura da porta)
  const ph = 0.58 + sink, py0 = hy - sink, pOut = t / 2 + 0.14;
  if (face !== 'n') wbox(x1 - pOut, z1 - pOut, x2 + pOut, z1 + t / 2, ph, plinthTex, { y0: py0, collide: false, tile: 2 });
  else {
    wbox(x1 - pOut, z1 - pOut, doorC - doorW / 2, z1 + t / 2, ph, plinthTex, { y0: py0, collide: false, tile: 2 });
    wbox(doorC + doorW / 2, z1 - pOut, x2 + pOut, z1 + t / 2, ph, plinthTex, { y0: py0, collide: false, tile: 2 });
  }
  if (face !== 's') wbox(x1 - pOut, z2 - t / 2, x2 + pOut, z2 + pOut, ph, plinthTex, { y0: py0, collide: false, tile: 2 });
  else {
    wbox(x1 - pOut, z2 - t / 2, doorC - doorW / 2, z2 + pOut, ph, plinthTex, { y0: py0, collide: false, tile: 2 });
    wbox(doorC + doorW / 2, z2 - t / 2, x2 + pOut, z2 + pOut, ph, plinthTex, { y0: py0, collide: false, tile: 2 });
  }
  if (face !== 'w') wbox(x1 - pOut, z1 - pOut, x1 + t / 2, z2 + pOut, ph, plinthTex, { y0: py0, collide: false, tile: 2 });
  else {
    wbox(x1 - pOut, z1 - pOut, x1 + t / 2, doorC - doorW / 2, ph, plinthTex, { y0: py0, collide: false, tile: 2 });
    wbox(x1 - pOut, doorC + doorW / 2, x1 + t / 2, z2 + pOut, ph, plinthTex, { y0: py0, collide: false, tile: 2 });
  }
  if (face !== 'e') wbox(x2 - t / 2, z1 - pOut, x2 + pOut, z2 + pOut, ph, plinthTex, { y0: py0, collide: false, tile: 2 });
  else {
    wbox(x2 - t / 2, z1 - pOut, x2 + pOut, doorC - doorW / 2, ph, plinthTex, { y0: py0, collide: false, tile: 2 });
    wbox(x2 - t / 2, doorC + doorW / 2, x2 + pOut, z2 + pOut, ph, plinthTex, { y0: py0, collide: false, tile: 2 });
  }

  // Pilastras de canto + vigas horizontais de acabamento
  const cR = 0.44;
  [[x1, z1], [x2, z1], [x1, z2], [x2, z2]].forEach(([px, pz]) => {
    wbox(px - cR, pz - cR, px + cR, pz + cR, h + 0.05, trimTex, { y0: hy, collide: false, tile: 2 });
  });
  const bOut = t / 2 + 0.12;
  const beamAt = (by, bh) => {
    wbox(x1 - bOut, z1 - bOut, x2 + bOut, z1 + bOut, bh, trimTex, { y0: by, collide: false, tile: 2 });
    wbox(x1 - bOut, z2 - bOut, x2 + bOut, z2 + bOut, bh, trimTex, { y0: by, collide: false, tile: 2 });
    wbox(x1 - bOut, z1 - bOut, x1 + bOut, z2 + bOut, bh, trimTex, { y0: by, collide: false, tile: 2 });
    wbox(x2 - bOut, z1 - bOut, x2 + bOut, z2 + bOut, bh, trimTex, { y0: by, collide: false, tile: 2 });
  };
  beamAt(hy + h - 0.34, 0.34);
  if (h >= 6.0) beamAt(hy + oh, 0.26);

  // Portal da porta (ombreiras, verga reforçada e soleira)
  const jW = 0.30, jOut = t / 2 + 0.16, lH = 0.40;
  if (face === 'n' || face === 's') {
    const fz = face === 'n' ? z1 : z2;
    const stepDir = face === 'n' ? -1 : 1;
    wbox(doorC - doorW / 2 - jW, fz - jOut, doorC - doorW / 2 + 0.06, fz + jOut, oh, trimTex, { y0: hy, collide: false, tile: 2 });
    wbox(doorC + doorW / 2 - 0.06, fz - jOut, doorC + doorW / 2 + jW, fz + jOut, oh, trimTex, { y0: hy, collide: false, tile: 2 });
    wbox(doorC - doorW / 2 - jW - 0.1, fz - jOut - 0.04, doorC + doorW / 2 + jW + 0.1, fz + jOut + 0.04, lH, trimTex, { y0: hy + oh - 0.04, collide: false, tile: 2 });
    wbox(doorC - doorW / 2 - 0.1, fz + (stepDir > 0 ? 0 : -0.85), doorC + doorW / 2 + 0.1, fz + (stepDir > 0 ? 0.85 : 0), floorRise + 0.04, plinthTex, { y0: hy - 0.04, collide: false, tile: 2 });
  } else {
    const fx = face === 'w' ? x1 : x2;
    const stepDir = face === 'w' ? -1 : 1;
    wbox(fx - jOut, doorC - doorW / 2 - jW, fx + jOut, doorC - doorW / 2 + 0.06, oh, trimTex, { y0: hy, collide: false, tile: 2 });
    wbox(fx - jOut, doorC + doorW / 2 - 0.06, fx + jOut, doorC + doorW / 2 + jW, oh, trimTex, { y0: hy, collide: false, tile: 2 });
    wbox(fx - jOut - 0.04, doorC - doorW / 2 - jW - 0.1, fx + jOut + 0.04, doorC + doorW / 2 + jW + 0.1, lH, trimTex, { y0: hy + oh - 0.04, collide: false, tile: 2 });
    wbox(fx + (stepDir > 0 ? 0 : -0.85), doorC - doorW / 2 - 0.1, fx + (stepDir > 0 ? 0.85 : 0), doorC + doorW / 2 + 0.1, floorRise + 0.04, plinthTex, { y0: hy - 0.04, collide: false, tile: 2 });
  }

  // Janelas medievais nas fachadas
  const winY = hy + (big ? 2.55 : 2.35), winW = 1.5, winH = 1.65;
  const placeSideWindows = (side) => {
    const len = (side === 'n' || side === 's') ? w : d;
    const cPos = (side === 'n' || side === 's') ? cx : cz;
    const isDoorSide = side === face;
    if (isDoorSide) {
      if (len >= 13) {
        const off = doorW / 2 + (len / 2 - doorW / 2) * 0.52;
        if (side === 'n' || side === 's') {
          const wz = side === 'n' ? z1 - t / 2 - 0.02 : z2 + t / 2 + 0.02;
          addHouseWindow(cPos - off, winY, wz, 'x', winW, winH, trimTex, o.burn);
          addHouseWindow(cPos + off, winY, wz, 'x', winW, winH, trimTex, o.burn);
        } else {
          const wx = side === 'w' ? x1 - t / 2 - 0.02 : x2 + t / 2 + 0.02;
          addHouseWindow(wx, winY, cPos - off, 'z', winW, winH, trimTex, o.burn);
          addHouseWindow(wx, winY, cPos + off, 'z', winW, winH, trimTex, o.burn);
        }
      }
      return;
    }
    const offsets = len >= 13 ? [-len * 0.24, len * 0.24] : [0];
    for (const off of offsets) {
      if (side === 'n' || side === 's') {
        const wz = side === 'n' ? z1 - t / 2 - 0.02 : z2 + t / 2 + 0.02;
        addHouseWindow(cPos + off, winY, wz, 'x', winW, winH, trimTex, o.burn);
      } else {
        const wx = side === 'w' ? x1 - t / 2 - 0.02 : x2 + t / 2 + 0.02;
        addHouseWindow(wx, winY, cPos + off, 'z', winW, winH, trimTex, o.burn);
      }
    }
  };
  placeSideWindows('n'); placeSideWindows('s'); placeSideWindows('w'); placeSideWindows('e');

  // Telhado de duas águas com beiral, oitões, cumeeira, chaminé e colisão em degraus caminháveis
  const wallTop = hy + h;
  const roofH = big ? 4.0 : 3.0;
  const eaveOut = 0.55;
  const ridgeAlongX = (face === 'e' || face === 'w');
  const wallSpan = ridgeAlongX ? d : w;
  const wallLen = ridgeAlongX ? w : d;
  const gableHalf = wallSpan * 0.5 + t * 0.5;
  const ridgeLen = wallLen + t + eaveOut * 2;
  const ridgeHalf = ridgeLen * 0.5;
  const sStart = -0.12;
  const sEnd = gableHalf + eaveOut;
  const sMid = (sStart + sEnd) * 0.5;
  const yMid = wallTop + roofH * (1 - sMid / gableHalf);
  const slopeAng = Math.atan2(roofH, gableHalf);
  const slopeLen = (sEnd - sStart) / Math.cos(slopeAng);
  const roofThick = 0.30;

  if (ridgeAlongX) {
    const sN = new THREE.Mesh(tiledBox(ridgeLen, roofThick, slopeLen, 4), TX.mat('roof'));
    sN.rotation.x = -slopeAng;
    sN.position.set(cx, yMid, cz - sMid);
    addW(sN, cx, cz);

    const sS = new THREE.Mesh(tiledBox(ridgeLen, roofThick, slopeLen, 4), TX.mat('roof'));
    sS.rotation.x = slopeAng;
    sS.position.set(cx, yMid, cz + sMid);
    addW(sS, cx, cz);

    const ridge = new THREE.Mesh(tiledBox(ridgeLen + 0.16, 0.34, 0.42, 2), TX.mat(trimTex));
    ridge.position.set(cx, wallTop + roofH + 0.04, cz);
    addW(ridge, cx, cz);

    const gGeo = gablePrismGeo(d + t, roofH, t, 4);
    const gW = new THREE.Mesh(gGeo, TX.mat(wallTex));
    gW.rotation.y = Math.PI / 2;
    gW.position.set(x1, wallTop, cz);
    addW(gW, x1, cz);

    const gE = new THREE.Mesh(gGeo.clone(), TX.mat(wallTex));
    gE.rotation.y = Math.PI / 2;
    gE.position.set(x2, wallTop, cz);
    addW(gE, x2, cz);
  } else {
    const sW = new THREE.Mesh(tiledBox(slopeLen, roofThick, ridgeLen, 4), TX.mat('roof'));
    sW.rotation.z = slopeAng;
    sW.position.set(cx - sMid, yMid, cz);
    addW(sW, cx, cz);

    const sE = new THREE.Mesh(tiledBox(slopeLen, roofThick, ridgeLen, 4), TX.mat('roof'));
    sE.rotation.z = -slopeAng;
    sE.position.set(cx + sMid, yMid, cz);
    addW(sE, cx, cz);

    const ridge = new THREE.Mesh(tiledBox(0.42, 0.34, ridgeLen + 0.16, 2), TX.mat(trimTex));
    ridge.position.set(cx, wallTop + roofH + 0.04, cz);
    addW(ridge, cx, cz);

    const gGeo = gablePrismGeo(w + t, roofH, t, 4);
    const gN = new THREE.Mesh(gGeo, TX.mat(wallTex));
    gN.position.set(cx, wallTop, z1);
    addW(gN, cx, z1);

    const gS = new THREE.Mesh(gGeo.clone(), TX.mat(wallTex));
    gS.position.set(cx, wallTop, z2);
    addW(gS, cx, z2);
  }

  // Chaminé de pedra com colisão
  const chX = ridgeAlongX ? (cx - w * 0.22) : (cx + w * 0.22);
  const chZ = cz - d * 0.22;
  const chTop = wallTop + roofH + 1.1;
  const chBase = wallTop + roofH * 0.45;
  wbox(chX - 0.65, chZ - 0.65, chX + 0.65, chZ + 0.65, chTop - chBase, plinthTex, {
    y0: chBase, tile: 2, walkable: true, overhead: true
  });
  wbox(chX - 0.80, chZ - 0.80, chX + 0.80, chZ + 0.80, 0.26, plinthTex, {
    y0: chTop, tile: 2, walkable: true, overhead: true
  });

  // Colisão do telhado (degraus caminháveis ao longo da inclinação)
  const tiers = Math.max(6, Math.ceil(roofH / 0.32));
  const stepH = roofH / tiers;
  for (let i = 0; i < tiers; i++) {
    const frac = i / tiers;
    const tierY0 = (i === 0) ? (wallTop - 0.25) : (wallTop + i * stepH);
    const tierYMax = wallTop + (i + 1) * stepH;
    const curHalf = Math.max(0.45, gableHalf * (1 - frac) + 0.15);
    const col = ridgeAlongX
      ? { x1: cx - ridgeHalf, z1: cz - curHalf, x2: cx + ridgeHalf, z2: cz + curHalf, y0: tierY0, yMax: tierYMax, walkable: true, overhead: true, active: true }
      : { x1: cx - curHalf, z1: cz - ridgeHalf, x2: cx + curHalf, z2: cz + ridgeHalf, y0: tierY0, yMax: tierYMax, walkable: true, overhead: true, active: true };
    World.colliders.push(col);
  }

  if (!o.noFurniture) populateHouseFurniture(cx, cz, w, d, t, hy + floorRise, face, o);

  if (o.burn) {
    const peakScale = Math.max(2.6, Math.min(4.6, Math.max(w, d) * 0.25));
    flame(cx, wallTop + roofH - 0.15, cz, peakScale, null, { smoke: true });
    const spots = [[-0.22, -0.18, 0.72], [0.24, -0.2, 0.68], [-0.2, 0.24, 0.65], [0.21, 0.2, 0.7]];
    for (let i = 0; i < spots.length; i++) {
      const sp = spots[i];
      const fx = cx + sp[0] * w, fz = cz + sp[1] * d;
      const slopeF = ridgeAlongX ? Math.max(0, 1 - 2 * Math.abs(sp[1])) : Math.max(0, 1 - 2 * Math.abs(sp[0]));
      flame(fx, wallTop + roofH * slopeF - 0.15, fz, peakScale * sp[2], null, { smoke: i < 2 });
    }
  }
}

function populateHouseFurniture(cx, cz, w, d, t, floorY, face, o) {
  let inX = 0, inZ = 1, rtX = 1, rtZ = 0, rotY = 0;
  let halfIn = d * 0.5 - t * 0.5, halfRt = w * 0.5 - t * 0.5;
  if (face === 's') {
    inX = 0; inZ = -1; rtX = -1; rtZ = 0; rotY = Math.PI;
  } else if (face === 'w') {
    inX = 1; inZ = 0; rtX = 0; rtZ = -1; rotY = Math.PI / 2;
    halfIn = w * 0.5 - t * 0.5; halfRt = d * 0.5 - t * 0.5;
  } else if (face === 'e') {
    inX = -1; inZ = 0; rtX = 0; rtZ = 1; rotY = -Math.PI / 2;
    halfIn = w * 0.5 - t * 0.5; halfRt = d * 0.5 - t * 0.5;
  }
  if (halfIn < 3.0 || halfRt < 3.0) return;

  const grp = new THREE.Group();
  grp.position.set(cx, floorY, cz);
  grp.rotation.y = rotY;
  addW(grp, cx, cz);

  const addFurnCol = (lx, lz, lw, ld, fh, walkable) => {
    const wx = cx + lx * rtX + lz * inX;
    const wz = cz + lx * rtZ + lz * inZ;
    const hw = (Math.abs(rtX) > 0.5 ? lw : ld) * 0.5;
    const hd = (Math.abs(rtZ) > 0.5 ? lw : ld) * 0.5;
    World.colliders.push({
      x1: wx - hw, z1: wz - hd, x2: wx + hw, z2: wz + hd,
      y0: floorY, yMax: floorY + fh, walkable: !!walkable, active: true
    });
  };

  const burn = !!o.burn;
  const woodDark = burn ? 0x2b1d12 : 0x4a2e18;
  const woodMid = burn ? 0x3a2819 : 0x613e22;
  const woodLight = burn ? 0x4a3422 : 0x7a5230;
  const ironCol = 0x35383d;

  if (o.wall === 'church') {
    // Tapete central + altar ao fundo + fileiras de bancos
    const runnerLen = Math.max(4, halfIn * 1.6);
    part(grp, 2.2, 0.03, runnerLen, 0x611919, 0, 0.015, 0.3);
    part(grp, 2.4, 0.02, runnerLen + 0.15, 0x8a6d3b, 0, 0.01, 0.3);

    const altZ = halfIn - 1.3;
    part(grp, 3.4, 1.05, 1.3, 0x5c5852, 0, 0.525, altZ);
    part(grp, 3.6, 0.14, 1.5, 0x736e66, 0, 1.12, altZ);
    part(grp, 1.6, 0.04, 1.54, 0x6e1c1c, 0, 1.20, altZ);
    part(grp, 0.10, 0.32, 0.10, 0xd9cfa8, -1.1, 1.36, altZ);
    part(grp, 0.10, 0.32, 0.10, 0xd9cfa8, 1.1, 1.36, altZ);
    part(grp, 0.08, 0.08, 0.08, 0xffaa22, -1.1, 1.55, altZ, { basic: true });
    part(grp, 0.08, 0.08, 0.08, 0xffaa22, 1.1, 1.55, altZ, { basic: true });
    addFurnCol(0, altZ, 3.6, 1.5, 1.2, true);

    const pewW = Math.min(3.4, halfRt - 1.8);
    if (pewW >= 1.8) {
      for (let pz = halfIn - 3.6; pz >= -halfIn + 2.6; pz -= 2.2) {
        for (const side of [-1, 1]) {
          const px = side * (1.45 + pewW * 0.5);
          part(grp, pewW, 0.10, 0.55, woodMid, px, 0.45, pz);
          part(grp, pewW, 0.55, 0.10, woodDark, px, 0.72, pz - 0.24);
          part(grp, 0.14, 0.45, 0.50, woodDark, px - pewW * 0.44, 0.225, pz);
          part(grp, 0.14, 0.45, 0.50, woodDark, px + pewW * 0.44, 0.225, pz);
          addFurnCol(px, pz, pewW, 0.6, 0.85, true);
        }
      }
    }
    return;
  }

  // Tapete central
  const rugW = Math.min(3.6, halfRt * 0.95);
  const rugD = Math.min(3.0, halfIn * 0.85);
  part(grp, rugW + 0.22, 0.02, rugD + 0.22, 0x785c30, 0, 0.01, 0.35);
  part(grp, rugW, 0.03, rugD, burn ? 0x3b1715 : 0x5c1d1a, 0, 0.015, 0.35);

  // Cama no canto traseiro esquerdo
  const bedX = -halfRt + 1.05;
  const bedZ = halfIn - 1.45;
  part(grp, 1.55, 0.34, 2.35, woodDark, bedX, 0.22, bedZ);
  part(grp, 1.60, 0.85, 0.14, woodMid, bedX, 0.425, bedZ + 1.15);
  part(grp, 1.40, 0.22, 2.15, burn ? 0x45201d : 0x732622, bedX, 0.48, bedZ - 0.03);
  part(grp, 0.95, 0.14, 0.48, burn ? 0x7a7060 : 0xc2b69b, bedX, 0.64, bedZ + 0.76);
  addFurnCol(bedX, bedZ, 1.6, 2.4, 0.75, true);

  // Mesa + 2 cadeiras + objetos no canto traseiro direito
  const tblX = halfRt - 1.65;
  const tblZ = halfIn - 1.50;
  part(grp, 1.75, 0.10, 1.15, woodMid, tblX, 0.78, tblZ);
  for (const lx of [-0.75, 0.75]) {
    for (const lz of [-0.45, 0.45]) {
      part(grp, 0.12, 0.74, 0.12, woodDark, tblX + lx, 0.37, tblZ + lz);
    }
  }
  addFurnCol(tblX, tblZ, 1.75, 1.15, 0.85, true);
  // Cadeiras
  for (const czOff of [-0.88, 0.88]) {
    const cz = tblZ + czOff;
    const backDir = czOff < 0 ? -1 : 1;
    part(grp, 0.50, 0.08, 0.50, woodLight, tblX, 0.45, cz);
    part(grp, 0.50, 0.52, 0.08, woodDark, tblX, 0.71, cz + backDir * 0.21);
    for (const cxOff of [-0.19, 0.19]) {
      for (const czL of [-0.19, 0.19]) {
        part(grp, 0.08, 0.44, 0.08, woodDark, tblX + cxOff, 0.22, cz + czL);
      }
    }
  }
  // Caneca, prato e vela sobre a mesa
  part(grp, 0.28, 0.04, 0.28, 0x8f8574, tblX - 0.35, 0.85, tblZ + 0.12);
  part(grp, 0.14, 0.18, 0.14, 0x6e4f28, tblX + 0.28, 0.92, tblZ - 0.15);
  part(grp, 0.08, 0.20, 0.08, 0xd9cfa8, tblX + 0.52, 0.93, tblZ + 0.22);
  part(grp, 0.06, 0.06, 0.06, 0xffaa22, tblX + 0.52, 1.06, tblZ + 0.22, { basic: true });

  // Estante de livros na parede esquerda (longe da porta)
  if (halfIn >= 3.6) {
    const shX = -halfRt + 0.38;
    const shZ = -0.15;
    part(grp, 0.58, 2.10, 1.75, woodDark, shX, 1.05, shZ);
    for (let sy = 0.45; sy <= 1.75; sy += 0.45) {
      part(grp, 0.62, 0.07, 1.65, woodLight, shX + 0.04, sy, shZ);
      part(grp, 0.36, 0.28, 0.45, 0x6b201b, shX + 0.10, sy + 0.17, shZ - 0.45);
      part(grp, 0.36, 0.30, 0.38, 0x2a4530, shX + 0.10, sy + 0.18, shZ + 0.02);
      part(grp, 0.36, 0.26, 0.42, 0x353b54, shX + 0.10, sy + 0.16, shZ + 0.48);
    }
    addFurnCol(shX, shZ, 0.65, 1.75, 2.10, false);
  }

  // Baú reforçado na parede direita
  const chX = halfRt - 0.55;
  const chZ = -0.25;
  part(grp, 0.72, 0.58, 1.25, woodDark, chX, 0.29, chZ);
  part(grp, 0.76, 0.14, 1.29, woodMid, chX, 0.63, chZ);
  part(grp, 0.78, 0.68, 0.10, ironCol, chX, 0.36, chZ - 0.40);
  part(grp, 0.78, 0.68, 0.10, ironCol, chX, 0.36, chZ + 0.40);
  part(grp, 0.08, 0.14, 0.14, 0x998245, chX - 0.38, 0.52, chZ);
  addFurnCol(chX, chZ, 0.76, 1.30, 0.72, true);
}

function _isNearHouseOrProp(x, z, housePad, doorPad, propPad) {
  for (let i = 0; i < World.houseRects.length; i++) {
    const h = World.houseRects[i];
    if (x >= h.x1 - housePad && x <= h.x2 + housePad && z >= h.z1 - housePad && z <= h.z2 + housePad) return true;
    const dx = h.face === 'e' ? h.x2 + doorPad * 0.5 : (h.face === 'w' ? h.x1 - doorPad * 0.5 : h.cx);
    const dz = h.face === 's' ? h.z2 + doorPad * 0.5 : (h.face === 'n' ? h.z1 - doorPad * 0.5 : h.cz);
    if (Math.hypot(x - dx, z - dz) < doorPad) return true;
  }
  if (propPad > 0) {
    for (let i = 0; i < World.colliders.length; i++) {
      const c = World.colliders[i];
      if (!c.active || c.overhead) continue;
      if (x >= c.x1 - propPad && x <= c.x2 + propPad && z >= c.z1 - propPad && z <= c.z2 + propPad) return true;
    }
  }
  return false;
}

function addCropFence(x1, z1, x2, z2) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  const segLen = 3.0;
  const gateHalf = 2.4;
  const postCol = 0x54361b;
  const railCol = 0x694524;

  const buildRun = (ax, az, bx, bz, axis) => {
    const total = axis === 'x' ? (bx - ax) : (bz - az);
    const mid = total * 0.5;
    const steps = Math.max(1, Math.round(total / segLen));
    const dt = total / steps;
    for (let i = 0; i < steps; i++) {
      const t0 = i * dt, t1 = (i + 1) * dt, tm = (t0 + t1) * 0.5;
      if (Math.abs(tm - mid) < gateHalf) continue;
      const sx1 = axis === 'x' ? ax + t0 : ax;
      const sz1 = axis === 'x' ? az : az + t0;
      const sx2 = axis === 'x' ? ax + t1 : bx;
      const sz2 = axis === 'x' ? az : az + t1;
      const mx = (sx1 + sx2) * 0.5, mz = (sz1 + sz2) * 0.5;
      if (_isNearHouseOrProp(mx, mz, 2.2, 4.2, 1.4)) continue;

      const yA = getGroundY(sx1, sz1), yB = getGroundY(sx2, sz2);
      const yM = (yA + yB) * 0.5;
      const g = new THREE.Group();
      g.position.set(mx, yM, mz);
      const len = Math.hypot(sx2 - sx1, sz2 - sz1);
      if (axis === 'x') {
        part(g, 0.16, 1.05, 0.16, postCol, -len * 0.5, 0.525 + (yA - yM), 0);
        part(g, 0.16, 1.05, 0.16, postCol, len * 0.5, 0.525 + (yB - yM), 0);
        part(g, len, 0.10, 0.08, railCol, 0, 0.38, 0);
        part(g, len, 0.10, 0.08, railCol, 0, 0.78, 0);
      } else {
        part(g, 0.16, 1.05, 0.16, postCol, 0, 0.525 + (yA - yM), -len * 0.5);
        part(g, 0.16, 1.05, 0.16, postCol, 0, 0.525 + (yB - yM), len * 0.5);
        part(g, 0.08, 0.10, len, railCol, 0, 0.38, 0);
        part(g, 0.08, 0.10, len, railCol, 0, 0.78, 0);
      }
      addW(g, mx, mz);
      World.colliders.push({
        x1: Math.min(sx1, sx2) - 0.14, z1: Math.min(sz1, sz2) - 0.14,
        x2: Math.max(sx1, sx2) + 0.14, z2: Math.max(sz1, sz2) + 0.14,
        y0: Math.min(yA, yB), yMax: Math.max(yA, yB) + 1.05,
        walkable: false, active: true
      });
    }
  };

  buildRun(minX, minZ, maxX, minZ, 'x');
  buildRun(minX, maxZ, maxX, maxZ, 'x');
  buildRun(minX, minZ, minX, maxZ, 'z');
  buildRun(maxX, minZ, maxX, maxZ, 'z');
}

function populateCrops(x1, z1, x2, z2) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  let s = ((minX * 73856093) ^ (minZ * 19349663) ^ (maxX * 83492791)) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  const stepX = 2.5, stepZ = 2.5;
  for (let gx = minX + 2.0; gx <= maxX - 2.0; gx += stepX) {
    for (let gz = minZ + 2.0; gz <= maxZ - 2.0; gz += stepZ) {
      const px = gx + (rnd() - 0.5) * 0.55;
      const pz = gz + (rnd() - 0.5) * 0.55;
      if (_isNearHouseOrProp(px, pz, 2.2, 4.2, 1.5)) continue;

      const py = getGroundY(px, pz) + 0.04;
      const g = new THREE.Group();
      g.position.set(px, py, pz);
      g.rotation.y = rnd() * Math.PI * 2;
      const kind = Math.floor((gz - minZ) / 5.0 + Math.floor((gx - minX) / 13.0)) % 5;

      if (kind === 0) {
        // Repolhos / alfaces
        part(g, 0.85, 0.12, 0.85, 0x3b2615, 0, 0.06, 0);
        part(g, 0.58, 0.14, 0.58, 0x2b5c1e, 0, 0.17, 0);
        part(g, 0.42, 0.34, 0.42, 0x4b8f30, 0, 0.32, 0);
        part(g, 0.28, 0.14, 0.28, 0x68ad44, 0, 0.49, 0);
      } else if (kind === 1) {
        // Abóboras
        part(g, 0.72, 0.10, 0.72, 0x3b2615, 0, 0.05, 0);
        part(g, 0.56, 0.44, 0.56, 0xc76216, 0, 0.28, 0);
        part(g, 0.12, 0.18, 0.12, 0x2e4d1b, 0, 0.56, 0);
        part(g, 0.38, 0.08, 0.26, 0x356924, 0.34, 0.12, 0.12);
      } else if (kind === 2) {
        // Cenouras / rabanetes em leira
        part(g, 0.90, 0.14, 0.65, 0x3b2615, 0, 0.07, 0);
        for (const ox of [-0.24, 0.22]) {
          part(g, 0.16, 0.14, 0.16, 0xd96b1c, ox, 0.17, 0);
          part(g, 0.28, 0.30, 0.28, 0x3f8528, ox, 0.36, 0);
        }
      } else if (kind === 3) {
        // Tomates em estaca
        part(g, 0.68, 0.10, 0.68, 0x3b2615, 0, 0.05, 0);
        part(g, 0.08, 1.15, 0.08, 0x5a3a1c, 0, 0.58, 0);
        part(g, 0.48, 0.68, 0.48, 0x2e6620, 0, 0.52, 0);
        part(g, 0.12, 0.12, 0.12, 0xc4251a, 0.22, 0.58, 0.16);
        part(g, 0.12, 0.12, 0.12, 0xc4251a, -0.20, 0.44, -0.18);
        part(g, 0.11, 0.11, 0.11, 0xc4251a, 0.10, 0.74, -0.22);
      } else {
        // Milho / hastes altas
        part(g, 0.72, 0.10, 0.72, 0x3b2615, 0, 0.05, 0);
        for (const [ox, oz, hh] of [[-0.16, -0.12, 1.25], [0.16, 0.14, 1.10]]) {
          part(g, 0.10, hh, 0.10, 0x5c6e26, ox, hh * 0.5 + 0.08, oz);
          part(g, 0.14, 0.24, 0.14, 0xc9a52c, ox + 0.08, hh * 0.58, oz);
        }
      }
      addW(g, px, pz);
    }
  }
}

const FLAME_TIME = { value: 0 };
let _flameGeo = null;
let _smokeGeo = null;

function buildCrossPlanes(planes) {
  let totalV = 0, totalI = 0;
  const parts = [];
  for (let p = 0; p < planes.length; p++) {
    const cfg = planes[p];
    const g = new THREE.PlaneGeometry(cfg.w, cfg.h, cfg.ws, cfg.hs);
    g.translate(0, cfg.y, 0);
    g.rotateY(cfg.ry);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const idx = g.getIndex();
    const vCount = pos.count;
    const iCount = idx ? idx.count : vCount;
    parts.push({ g, pos, uv, idx, vCount, iCount, layer: cfg.layer || 0, seed: cfg.seed || 0 });
    totalV += vCount;
    totalI += iCount;
  }
  const posArr = new Float32Array(totalV * 3);
  const uvArr = new Float32Array(totalV * 2);
  const layerArr = new Float32Array(totalV);
  const seedArr = new Float32Array(totalV);
  const idxArr = new Uint16Array(totalI);
  let vOff = 0, iOff = 0;
  for (let p = 0; p < parts.length; p++) {
    const it = parts[p];
    posArr.set(it.pos.array, vOff * 3);
    uvArr.set(it.uv.array, vOff * 2);
    layerArr.fill(it.layer, vOff, vOff + it.vCount);
    seedArr.fill(it.seed, vOff, vOff + it.vCount);
    if (it.idx) {
      const src = it.idx.array;
      for (let j = 0; j < it.iCount; j++) idxArr[iOff + j] = src[j] + vOff;
    } else {
      for (let j = 0; j < it.iCount; j++) idxArr[iOff + j] = vOff + j;
    }
    vOff += it.vCount;
    iOff += it.iCount;
    it.g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  out.setAttribute('aLayer', new THREE.BufferAttribute(layerArr, 1));
  out.setAttribute('aSeed', new THREE.BufferAttribute(seedArr, 1));
  out.setIndex(new THREE.BufferAttribute(idxArr, 1));
  return out;
}

function getFlameGeo() {
  if (!_flameGeo) {
    _flameGeo = buildCrossPlanes([
      { w: 1.25, h: 1.95, ws: 4, hs: 10, y: 0.96, ry: 0.0, layer: 0.0, seed: 0.0 },
      { w: 1.25, h: 1.95, ws: 4, hs: 10, y: 0.96, ry: Math.PI / 3, layer: 0.0, seed: 1.93 },
      { w: 1.25, h: 1.95, ws: 4, hs: 10, y: 0.96, ry: (2 * Math.PI) / 3, layer: 0.0, seed: 3.87 },
      { w: 0.72, h: 1.38, ws: 3, hs: 7, y: 0.68, ry: Math.PI / 6, layer: 1.0, seed: 7.1 },
      { w: 0.72, h: 1.38, ws: 3, hs: 7, y: 0.68, ry: (2 * Math.PI) / 3 + 0.25, layer: 1.0, seed: 9.4 }
    ]);
  }
  return _flameGeo;
}

function getSmokeGeo() {
  if (!_smokeGeo) {
    _smokeGeo = buildCrossPlanes([
      { w: 1.9, h: 2.9, ws: 3, hs: 8, y: 2.35, ry: Math.PI / 4, layer: 0.0, seed: 1.3 },
      { w: 1.9, h: 2.9, ws: 3, hs: 8, y: 2.35, ry: (3 * Math.PI) / 4, layer: 0.0, seed: 4.1 }
    ]);
  }
  return _smokeGeo;
}

const FLAME_NOISE_GLSL = `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm3(vec2 p) {
    float v = 0.58 * vnoise(p);
    p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.05 + vec2(17.1, 31.7);
    v += 0.295 * vnoise(p);
    return v;
  }
`;

const _flameMatCache = new Map();
const _smokeMatCache = new Map();

function makeFlameMat(cols) {
  const key = cols[0] + '|' + cols[1];
  let mat = _flameMatCache.get(key);
  if (mat) return mat;
  mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: FLAME_TIME,
      uColOuter: { value: new THREE.Color(cols[0]) },
      uColInner: { value: new THREE.Color(cols[1]) }
    },
    vertexShader: `
      attribute float aLayer;
      attribute float aSeed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vLayer;
      varying float vSeed;
      varying float vPhase;
      void main() {
        vUv = uv;
        vLayer = aLayer;
        vSeed = aSeed;
        float phase = fract(sin(dot(modelMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 20.0;
        vPhase = phase;
        vec3 pos = position;
        float h = uv.y;
        float w = uTime * 3.2 + phase + aSeed;
        pos.x += sin(w + h * 4.2) * 0.14 * h * h;
        pos.z += cos(w * 0.87 + h * 3.6) * 0.12 * h * h;
        pos.y *= 1.0 + sin(uTime * 6.4 + phase + aSeed * 1.7) * 0.075 * h;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColOuter;
      uniform vec3 uColInner;
      varying vec2 vUv;
      varying float vLayer;
      varying float vSeed;
      varying float vPhase;
      ${FLAME_NOISE_GLSL}
      void main() {
        float x = (vUv.x - 0.5) * 2.0;
        float y = vUv.y;
        float t = uTime * (1.85 + 0.35 * vLayer) + vPhase + vSeed * 2.3;
        vec2 q = vec2(x * 2.25 + vSeed * 1.1, y * 2.7 - t * 1.55);
        float n1 = fbm3(q);
        float n2 = vnoise(q * 2.15 + vec2(n1 * 1.35, -t * 0.85)) * 0.875;
        float turb = mix(n1, n2, 0.55);

        float widthProfile = mix(0.88, 0.16, pow(y, 0.82)) * smoothstep(0.0, 0.1, y);
        float dx = abs(x + (turb - 0.5) * (0.42 + 0.88 * y));
        float shape = 1.0 - smoothstep(widthProfile * 0.32, widthProfile, dx);
        float tongues = smoothstep(0.16, 0.78, shape + (turb - 0.42) * (0.45 + 0.92 * y));
        float vFade = smoothstep(0.0, 0.07, y) * (1.0 - smoothstep(0.56, 1.0, y));
        float intensity = tongues * vFade;

        float coreHeat = smoothstep(0.36, 0.9, intensity) * (1.0 - smoothstep(0.08, 0.72, y));
        vec3 colHot = mix(uColInner, vec3(1.0, 0.98, 0.88), 0.72);
        vec3 colEdge = uColOuter * vec3(1.0, 0.48, 0.22);
        vec3 col = mix(colEdge, uColInner, smoothstep(0.14, 0.56, intensity));
        col = mix(col, colHot, clamp(coreHeat + vLayer * 0.35, 0.0, 1.0));
        col *= 1.15 + 0.35 * coreHeat;

        float alpha = smoothstep(0.08, 0.38, intensity);
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  _flameMatCache.set(key, mat);
  return mat;
}

function makeSmokeMat(glowCol) {
  let mat = _smokeMatCache.get(glowCol);
  if (mat) return mat;
  mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: FLAME_TIME,
      uGlowCol: { value: new THREE.Color(glowCol) }
    },
    vertexShader: `
      attribute float aSeed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vSeed;
      varying float vPhase;
      void main() {
        vUv = uv;
        vSeed = aSeed;
        float phase = fract(sin(dot(modelMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 20.0;
        vPhase = phase;
        vec3 pos = position;
        float h = uv.y;
        pos.x += sin(uTime * 1.4 + phase + h * 3.0 + aSeed) * 0.28 * h;
        pos.z += cos(uTime * 1.15 + phase + h * 2.5 + aSeed) * 0.24 * h;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uGlowCol;
      varying vec2 vUv;
      varying float vSeed;
      varying float vPhase;
      ${FLAME_NOISE_GLSL}
      void main() {
        float x = (vUv.x - 0.5) * 2.0;
        float y = vUv.y;
        float t = uTime * 0.75 + vPhase + vSeed * 1.7;
        vec2 q = vec2(x * 1.8 + vSeed, y * 2.2 - t);
        float n = fbm3(q);
        float width = mix(0.45, 0.95, y);
        float mask = 1.0 - smoothstep(width * 0.28, width, abs(x + (n - 0.5) * 0.55));
        float billow = smoothstep(0.28, 0.78, mask * 0.85 + n * 0.45);
        float vFade = smoothstep(0.0, 0.18, y) * (1.0 - smoothstep(0.45, 1.0, y));
        float alpha = billow * vFade * 0.46;
        if (alpha < 0.015) discard;
        vec3 soot = vec3(0.07, 0.06, 0.06);
        vec3 col = mix(uGlowCol * 0.55, soot, smoothstep(0.0, 0.42, y));
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  _smokeMatCache.set(glowCol, mat);
  return mat;
}

function flame(x, y, z, s, cols, opts) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const sc = s || 1;
  cols = cols || [0xff5a10, 0xffc030];
  opts = opts || {};
  const ph = Math.random() * 20;
  g.rotation.y = Math.random() * Math.PI * 2;
  g.scale.set(sc, sc, sc);

  const fireMesh = new THREE.Mesh(getFlameGeo(), makeFlameMat(cols));
  fireMesh.renderOrder = 2;
  fireMesh.matrixAutoUpdate = false;
  g.add(fireMesh);

  let smokeMesh = null;
  if (opts.smoke || sc >= 1.7) {
    smokeMesh = new THREE.Mesh(getSmokeGeo(), makeSmokeMat(cols[0]));
    smokeMesh.renderOrder = 1;
    smokeMesh.matrixAutoUpdate = false;
    g.add(smokeMesh);
  }

  g.updateMatrix();
  g.matrixAutoUpdate = false;
  addW(g, x, z);
  World.flames.push({ g, ph, s: sc, smokeMesh, chunk: g.userData.chunk });
  return g;
}

function deadTree(x, z) {
  const ty = getGroundY(x, z);
  const g = new THREE.Group();
  g.position.set(x, ty, z);
  part(g, 0.5, 5, 0.5, 0x2a1c12, 0, 2.5, 0);
  const b1 = part(g, 0.25, 2.2, 0.25, 0x2a1c12, 0.8, 4.0, 0); b1.rotation.z = -0.9;
  const b2 = part(g, 0.25, 1.8, 0.25, 0x2a1c12, -0.7, 3.4, 0.2); b2.rotation.z = 0.9;
  const b3 = part(g, 0.2, 1.4, 0.2, 0x2a1c12, 0.1, 4.6, -0.6); b3.rotation.x = 0.8;
  addW(g, x, z);
  World.colliders.push({ x1: x - 0.4, z1: z - 0.4, x2: x + 0.4, z2: z + 0.4, active: true });
}
function crate(x, z, s) {
  const ty = getGroundY(x, z);
  wbox(x - s / 2, z - s / 2, x + s / 2, z + s / 2, s, 'wood', { y0: ty, tile: s });
}
function hay(x, z) {
  const ty = getGroundY(x, z);
  wbox(x - 1, z - 1, x + 1, z + 1, 1.6, 'hay', { y0: ty, tile: 2 });
}
function lamp(x, z, cols) {
  const ty = getGroundY(x, z);
  wbox(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 4, 'stone', { y0: ty, tile: 2 });
  flame(x, ty + 4, z, 0.8, cols);
}
function barrelFire(x, z) {
  const ty = getGroundY(x, z);
  wbox(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 1.1, 'brick', { y0: ty, tile: 1 });
  flame(x, ty + 1.1, z, 1.1);
}
function scarecrow(x, z) {
  const ty = getGroundY(x, z);
  const g = new THREE.Group();
  g.position.set(x, ty, z);
  part(g, 0.12, 3, 0.12, 0x5a3a1c, 0, 1.5, 0);
  part(g, 2.2, 0.1, 0.1, 0x5a3a1c, 0, 2.3, 0);
  part(g, 0.5, 0.5, 0.5, 0x8a7020, 0, 3.1, 0);
  part(g, 0.1, 0.08, 0.02, 0xff2200, -0.1, 3.15, 0.26, { basic: true });
  part(g, 0.1, 0.08, 0.02, 0xff2200, 0.1, 3.15, 0.26, { basic: true });
  part(g, 0.9, 1.0, 0.3, 0x4a3a2a, 0, 2.0, 0);
  addW(g, x, z);
}
function fountain(cx, cz) {
  const ty = World.terrainY ? addPad(cx, cz, 4.2, 4.2, 5.0) : 0;
  wbox(cx - 3.2, cz - 3.2, cx + 3.2, cz + 3.2, 1.2, 'stone', { y0: ty, tile: 2 });
  wbox(cx - 0.6, cz - 0.6, cx + 0.6, cz + 0.6, 3.8, 'stone', { y0: ty + 1.2, tile: 2, collide: false });
  const sg = new THREE.Group(); sg.position.set(cx, ty + 5, cz);
  part(sg, 1.2, 1.6, 0.8, 0x6a6a7a, 0, 0.8, 0); part(sg, 0.6, 0.6, 0.6, 0x6a6a7a, 0, 1.9, 0);
  part(sg, 2.4, 0.2, 0.2, 0x6a6a7a, 0, 1.3, 0);
  addW(sg, cx, cz);
}

function makeGate(id, cx, cz, w, axis, h, style) {
  const ty = getGroundY(cx, cz);
  const t = 1.2;
  const col = {
    x1: axis === 'x' ? cx - w / 2 : cx - t / 2, x2: axis === 'x' ? cx + w / 2 : cx + t / 2,
    z1: axis === 'x' ? cz - t / 2 : cz - w / 2, z2: axis === 'x' ? cz + t / 2 : cz + w / 2, active: true
  };
  World.colliders.push(col);
  const grp = new THREE.Group();
  grp.position.set(cx, ty, cz);
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
    // Portão pesado de madeira da Ultra-Igreja com centro quebrável (Nivaldo arrebenta um buraco nele!)
    const holeW = 6.2, holeH = 7.4;
    const sideW = (w - holeW) / 2;
    const topH = h - holeH;
    const addDoorPanel = (parent, pw, ph, pd, x, y, z) => {
      const m = new THREE.Mesh(tiledBox(pw, ph, pd, 4), TX.mat('door'));
      m.position.set(x, y, z || 0);
      parent.add(m);
      return m;
    };

    // Moldura externa intacta do portão de madeira (fica de pé ao redor do buraco arrombado)
    addDoorPanel(grp, sideW, h, 1.0, -(holeW / 2 + sideW / 2), h / 2, 0);
    addDoorPanel(grp, sideW, h, 1.0,  (holeW / 2 + sideW / 2), h / 2, 0);
    addDoorPanel(grp, holeW, topH, 1.0, 0, holeH + topH / 2, 0);
    // Parte superior e braço horizontal da cruz dourada (permanecem no portão)
    part(grp, 1.2, topH, 0.12, 0xc9a227, 0, holeH + topH / 2, 0.55);
    part(grp, w, 1.2, 0.12, 0xc9a227, 0, h * 0.7, 0.55);

    // Painel central que Nivaldo arrebenta (visível enquanto o portão está fechado)
    const smashGrp = new THREE.Group();
    addDoorPanel(smashGrp, holeW, holeH, 1.0, 0, holeH / 2, 0);
    part(smashGrp, 1.2, holeH, 0.12, 0xc9a227, 0, holeH / 2, 0.55);
    grp.add(smashGrp);

    // Lascas e tábuas quebradas irregulares ao redor do buraco (aparecem quando arrebentado)
    const splinterGrp = new THREE.Group();
    splinterGrp.visible = false;
    const splinters = [
      // Borda esquerda do buraco
      [-holeW / 2 + 0.35, 1.0, 0.95, 1.35, 0.14],
      [-holeW / 2 + 0.52, 2.7, 1.25, 1.20, -0.18],
      [-holeW / 2 + 0.28, 4.4, 0.85, 1.45, 0.12],
      [-holeW / 2 + 0.58, 6.1, 1.30, 1.15, -0.22],
      // Borda direita do buraco
      [holeW / 2 - 0.42, 1.2, 1.05, 1.40, -0.15],
      [holeW / 2 - 0.28, 3.0, 0.80, 1.30, 0.16],
      [holeW / 2 - 0.56, 4.8, 1.25, 1.25, -0.20],
      [holeW / 2 - 0.36, 6.3, 0.95, 1.10, 0.14],
      // Borda superior do buraco (dentes de madeira pendurados)
      [-1.9, holeH - 0.38, 1.25, 1.05, 0.18],
      [-0.5, holeH - 0.52, 1.15, 1.25, -0.12],
      [0.85, holeH - 0.34, 1.20, 0.95, 0.20],
      [2.05, holeH - 0.46, 1.10, 1.15, -0.16]
    ];
    splinters.forEach(([sx, sy, sw, sh, rz], idx) => {
      const sp = new THREE.Mesh(tiledBox(sw, sh, 0.82, 3), idx % 3 === 0 ? TX.mat('wood') : TX.mat('door'));
      sp.position.set(sx, sy, -0.12);
      sp.rotation.set(-0.18, (idx % 2 === 0 ? 0.12 : -0.12), rz);
      splinterGrp.add(sp);
    });
    // Ponta quebrada da cruz dourada no topo do buraco
    const brokenCross = part(splinterGrp, 1.15, 0.85, 0.14, 0xc9a227, 0, holeH - 0.28, 0.52);
    brokenCross.rotation.z = 0.16;
    grp.add(splinterGrp);

    // Estilhaços 3D de madeira e ouro que voam quando Nivaldo arrebenta o buraco
    const debris = [];
    for (let i = 0; i < 14; i++) {
      const isGold = i < 3;
      const dw = isGold ? 0.9 : (0.9 + (i % 3) * 0.45);
      const dh = isGold ? 1.4 : (0.55 + ((i * 7) % 4) * 0.28);
      const dd = isGold ? 0.18 : 0.45;
      const dm = new THREE.Mesh(
        BX(dw, dh, dd),
        isGold ? MT(0xc9a227, { em: 0x3a2400 }) : TX.mat(i % 2 === 0 ? 'door' : 'wood')
      );
      const ix = ((i % 5) - 2) * 1.1;
      const iy = 1.2 + Math.floor(i / 5) * 2.1;
      dm.position.set(ix, iy, 0);
      dm.visible = false;
      grp.add(dm);
      debris.push({
        m: dm,
        x0: ix, y0: iy, z0: 0,
        vx: ix * 2.4 + ((i % 2 === 0 ? 1 : -1) * 1.8),
        vy: 3.5 + (i % 4) * 1.6,
        vz: -9.5 - (i % 3) * 3.5,
        rx: (i % 2 === 0 ? 1 : -1) * (4 + i * 0.4),
        ry: (i % 3 - 1) * 5.2,
        rz: (i % 2 === 0 ? -1 : 1) * (3.5 + i * 0.3)
      });
    }

    World.doorMesh = grp;
    addW(grp, cx, cz);
    World.gates[id] = { col, grp, style, open: false, t: 0, h, axis, smashGrp, splinterGrp, debris };
    return;
  }
  addW(grp, cx, cz);
  World.gates[id] = { col, grp, style, open: false, t: 0, h, axis };
}
function openGate(id) {
  const g = World.gates[id];
  if (!g || g.open) return;
  g.open = true; g.col.active = false; g.t = 0;
  if (g.smashGrp) g.smashGrp.visible = false;
  if (g.splinterGrp) g.splinterGrp.visible = true;
  if (g.debris) {
    for (let i = 0; i < g.debris.length; i++) {
      const d = g.debris[i];
      d.m.visible = true;
      d.m.position.set(d.x0, d.y0, d.z0);
      d.m.rotation.set(0, 0, 0);
    }
  }
}
function closeGateInstant(id) {
  const g = World.gates[id];
  if (!g) return;
  g.open = false; g.col.active = true; g.t = 0;
  g.grp.scale.set(1, 1, 1); g.grp.rotation.x = 0; g.grp.visible = true;
  if (g.smashGrp) g.smashGrp.visible = true;
  if (g.splinterGrp) g.splinterGrp.visible = false;
  if (g.debris) {
    for (let i = 0; i < g.debris.length; i++) g.debris[i].m.visible = false;
  }
}

/* ---------------- Portão de Saída Monumental Tematizado + Preview da Próxima Fase ---------------- */
function makeExitGate(cx, cz, nextMap, nextLabel) {
  const ty = World.terrainY ? addPad(cx, cz, 11.0, 7.5, 7.0) : 0;
  const grp = new THREE.Group();
  grp.position.set(cx, ty, cz);

  const area = World.currentMap || 'a1';
  const THEMES = {
    a1: { style: 'village',   pillarTex: 'brick',  trimTex: 'wood',  roofTex: 'roof',   accent: 0xffb830, accentCss: '#ffb830', beamCol: 0x48ff98, flameCols: [0xff9820, 0xfff080], barCol: 0x26201e, tipCol: 0xc48c28 },
    a2: { style: 'fields',    pillarTex: 'stone',  trimTex: 'wood',  roofTex: 'wood',   accent: 0xff8824, accentCss: '#ff8824', beamCol: 0x48ff98, flameCols: [0xff7a18, 0xffe470], barCol: 0x281e1a, tipCol: 0xd06a22 },
    a3: { style: 'fortress',  pillarTex: 'stone',  trimTex: 'stone', roofTex: 'stone',  accent: 0xe6b830, accentCss: '#e6b830', beamCol: 0x48ff98, flameCols: [0xff9020, 0xfff090], barCol: 0x20242a, tipCol: 0xd4a017 },
    a4: { style: 'mansion',   pillarTex: 'marble', trimTex: 'gold',  roofTex: 'marble', accent: 0xffd84a, accentCss: '#ffd84a', beamCol: 0x50ff9e, flameCols: [0xffc430, 0xffffa8], barCol: 0x1a1a22, tipCol: 0xf0c83c },
    a5: { style: 'cathedral', pillarTex: 'church', trimTex: 'gold',  roofTex: 'roof',   accent: 0xff5226, accentCss: '#ff5226', beamCol: 0x50ff9e, flameCols: [0xff3a14, 0xffd060], barCol: 0x18101c, tipCol: 0xd4a017 }
  };
  const th = THEMES[area] || THEMES.a1;

  const w = 13.6, h = 10.6;
  const pw = 2.6, pd = 2.8;
  const pxOff = w / 2 + pw / 2;

  const tbox = (parent, bw, bh, bd, tex, x, y, z, tile) => {
    const m = new THREE.Mesh(tiledBox(bw, bh, bd, tile || 3), TX.mat(tex));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // --- 1. Caixa escura recuada (alcova) + Foto Preview da Próxima Fase ---
  const alcoveD = 1.15;
  part(grp, w + 0.6, 0.35, alcoveD + 0.25, 0x0c0809, 0, h + 0.15, -alcoveD / 2 - 0.08);
  part(grp, w + 0.6, 0.16, alcoveD + 0.25, 0x120c0e, 0, 0.08, -alcoveD / 2 - 0.08);
  part(grp, 0.35, h + 0.2, alcoveD + 0.25, 0x0c0809, -w / 2 - 0.12, h / 2, -alcoveD / 2 - 0.08);
  part(grp, 0.35, h + 0.2, alcoveD + 0.25, 0x0c0809,  w / 2 + 0.12, h / 2, -alcoveD / 2 - 0.08);
  part(grp, w + 0.8, h + 0.6, 0.26, 0x0a0608, 0, h / 2, -alcoveD - 0.10);

  const previewMat = new THREE.MeshBasicMaterial({
    map: TX.levelPreviewTexture(nextMap),
    fog: false
  });
  psx(previewMat);
  const previewMesh = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.16, h - 0.16), previewMat);
  previewMesh.position.set(0, h / 2, -alcoveD + 0.14);
  grp.add(previewMesh);

  // Moldura interna luminosa ao redor da abertura (destaca sem tampar a foto)
  const rimMat = new THREE.MeshBasicMaterial({ color: th.accent, fog: false });
  const addRim = (rw, rh, rd, rx, ry, rz) => {
    const m = new THREE.Mesh(BX(rw, rh, rd), rimMat);
    m.position.set(rx, ry, rz);
    grp.add(m);
  };
  addRim(0.22, h, 0.22, -w / 2 + 0.06, h / 2, -0.18);
  addRim(0.22, h, 0.22,  w / 2 - 0.06, h / 2, -0.18);
  addRim(w, 0.22, 0.22, 0, h - 0.06, -0.18);

  // --- 2. Pilares monumentais + Arquitetura Tematizada da Área ---
  const pillarH = h + 2.8;
  for (const s of [-1, 1]) {
    const sx = s * pxOff;
    // Base/pedestal
    tbox(grp, pw + 0.7, 1.3, pd + 0.7, th.style === 'mansion' ? 'stone' : th.pillarTex, sx, 0.65, 0, 2.5);
    // Corpo do pilar principal
    tbox(grp, pw, pillarH, pd, th.pillarTex, sx, pillarH / 2, 0, 3);
    // Capitel superior
    tbox(grp, pw + 0.7, 0.8, pd + 0.7, th.trimTex, sx, pillarH + 0.3, 0, 2);
  }
  // Verga principal (lintel) acima do portão
  tbox(grp, w + pw * 2 + 1.0, 2.4, pd + 0.2, th.pillarTex, 0, h + 1.35, 0, 3);
  part(grp, w + pw * 2 + 1.3, 0.32, pd + 0.55, th.accent, 0, h + 0.18, 0, { em: 0x4a2800 });
  part(grp, w + pw * 2 + 1.3, 0.32, pd + 0.55, th.accent, 0, h + 2.55, 0, { em: 0x4a2800 });

  // Detalhes exclusivos por área
  if (th.style === 'village') {
    // a1: Bairro Alto — vigas de madeira, telhado rústico em duas águas e lanternas pendentes
    for (const s of [-1, 1]) {
      const sx = s * pxOff;
      for (const ox of [-pw / 2, pw / 2]) {
        tbox(grp, 0.38, pillarH + 0.2, 0.38, 'wood', sx + ox, pillarH / 2, pd / 2 + 0.05, 2);
      }
      // Suporte e lanterna pendente na frente
      part(grp, 0.26, 0.26, 1.5, 0x261a12, sx, h - 1.2, pd / 2 + 0.7);
      part(grp, 0.55, 0.85, 0.55, 0xffd060, sx, h - 1.85, pd / 2 + 1.35, { basic: true, nofog: true });
      part(grp, 0.75, 0.22, 0.75, 0x201814, sx, h - 1.35, pd / 2 + 1.35);
      part(grp, 0.75, 0.22, 0.75, 0x201814, sx, h - 2.35, pd / 2 + 1.35);
    }
    // Telhado rústico inclinado sobre a verga
    const roofW = w + pw * 2 + 2.8;
    const slopeF = new THREE.Mesh(tiledBox(roofW, 0.45, 3.2, 3), TX.mat('roof'));
    slopeF.position.set(0, h + 3.45, 1.15);
    slopeF.rotation.x = 0.46;
    grp.add(slopeF);
    const slopeB = new THREE.Mesh(tiledBox(roofW, 0.45, 3.2, 3), TX.mat('roof'));
    slopeB.position.set(0, h + 3.45, -1.15);
    slopeB.rotation.x = -0.46;
    grp.add(slopeB);
    tbox(grp, roofW + 0.4, 0.5, 0.6, 'wood', 0, h + 4.15, 0, 2);
  } else if (th.style === 'fields') {
    // a2: Campos da Perdição — paliçada de madeira queimada, estacas afiadas e foices cruzadas
    for (const s of [-1, 1]) {
      const sx = s * pxOff;
      tbox(grp, pw + 0.3, 4.2, pd + 0.3, 'wood', sx, pillarH - 2.0, 0, 2.5);
    }
    for (let x = -w / 2 - 1.5; x <= w / 2 + 1.5; x += 1.35) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.1, 4), TX.mat('wood'));
      sp.position.set(x, h + 3.6, 0.2);
      grp.add(sp);
    }
    // Emblema de foices cruzadas no topo
    for (const s of [-1, 1]) {
      const handle = part(grp, 0.22, 4.4, 0.22, 0x3b2214, 0, h + 4.2, 0.9);
      handle.rotation.z = s * 0.68;
      const blade = part(grp, 1.7, 0.35, 0.12, 0xc8ccd0, s * 1.15, h + 5.2, 0.95, { em: 0x3a2410 });
      blade.rotation.z = s * 0.22;
    }
  } else if (th.style === 'fortress') {
    // a3: Subúrbio Exterior — ameias fortificadas, estandartes carmesim e dentes de grade levadiça
    for (const s of [-1, 1]) {
      const sx = s * pxOff;
      // Ameias (merlons) no topo das torres
      for (const ox of [-0.95, 0.95]) for (const oz of [-0.95, 0.95]) {
        tbox(grp, 0.85, 1.4, 0.85, 'stone', sx + ox, pillarH + 1.35, oz, 2);
      }
      // Estandarte carmesim dos guardas na frente de cada torre
      part(grp, 1.55, 5.6, 0.14, 0x8e1418, sx, h * 0.56, pd / 2 + 0.12, { em: 0x280406 });
      part(grp, 1.72, 0.28, 0.22, 0xd4a017, sx, h * 0.56 + 2.8, pd / 2 + 0.14, { em: 0x4a3000 });
      part(grp, 1.55, 0.24, 0.16, 0xd4a017, sx, h * 0.56 - 2.65, pd / 2 + 0.14, { em: 0x4a3000 });
    }
    // Ameias sobre a verga central
    for (let x = -w / 2 + 0.5; x <= w / 2 - 0.5; x += 2.1) {
      tbox(grp, 1.25, 1.25, 1.3, 'stone', x, h + 3.25, 0.4, 2);
    }
  } else if (th.style === 'mansion') {
    // a4: Casarões dos Super-Ricos — colunas de mármore com anéis dourados e frontão clássico
    for (const s of [-1, 1]) {
      const sx = s * pxOff;
      part(grp, pw + 0.45, 0.45, pd + 0.45, 0xd4a017, sx, 1.5, 0, { em: 0x503400 });
      part(grp, pw + 0.45, 0.45, pd + 0.45, 0xd4a017, sx, pillarH - 0.6, 0, { em: 0x503400 });
      // Urna/pináculo dourado no topo de cada coluna
      const urn = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), MT(0xf0c83c, { em: 0x5a3c00 }));
      urn.position.set(sx, pillarH + 1.55, 0);
      grp.add(urn);
    }
    // Frontão triangular clássico em mármore e ouro
    const pedW = w + 1.2;
    const pedL = tbox(grp, pedW * 0.56, 0.75, pd, 'marble', -pedW * 0.24, h + 3.7, 0, 2);
    pedL.rotation.z = 0.28;
    const pedR = tbox(grp, pedW * 0.56, 0.75, pd, 'marble',  pedW * 0.24, h + 3.7, 0, 2);
    pedR.rotation.z = -0.28;
    part(grp, 1.2, 1.6, 1.2, 0xf0c83c, 0, h + 5.15, 0, { em: 0x5a3c00 });
  } else {
    // a5: Avenida do Horror — torres góticas da Ultra-Igreja, agulhas pontudas, rosácea e cruz dourada
    for (const s of [-1, 1]) {
      const sx = s * pxOff;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(1.9, 6.4, 4), TX.mat('roof'));
      spire.rotation.y = Math.PI / 4;
      spire.position.set(sx, pillarH + 3.8, 0);
      grp.add(spire);
      // Contrafortes laterais
      tbox(grp, 1.1, pillarH * 0.75, pd + 1.2, 'church', sx + s * 1.45, pillarH * 0.375, 0, 2.5);
    }
    // Rosácea escarlate + grande cruz dourada acima da placa
    const rose = new THREE.Mesh(new THREE.CircleGeometry(1.45, 12), MT(0xff3a10, { basic: true, nofog: true }));
    rose.position.set(0, h + 4.15, 1.15);
    grp.add(rose);
    part(grp, 0.65, 5.6, 0.65, 0xf0be2c, 0, h + 5.7, 0.6, { em: 0x6a3c00 });
    part(grp, 3.4, 0.65, 0.65, 0xf0be2c, 0, h + 6.7, 0.6, { em: 0x6a3c00 });
  }

  // --- 3. Portão Gradeado de Ferro (duas folhas articuladas na frente da foto preview) ---
  const leafW = w / 2 - 0.06;
  const leafH = h - 0.16;
  const makeBarredLeaf = (side) => {
    // side = -1 (folha esquerda, pivô em -w/2) | +1 (folha direita, pivô em +w/2)
    const pivot = new THREE.Group();
    pivot.position.set(side * (w / 2), 0, 0.08);
    const dir = -side; // cresce em direção ao centro (x = 0)
    // Moldura externa da folha
    part(pivot, 0.28, leafH, 0.26, th.barCol, dir * 0.14, leafH / 2, 0);
    part(pivot, 0.28, leafH, 0.26, th.barCol, dir * (leafW - 0.14), leafH / 2, 0);
    // Travessas horizontais (base, meio e topo)
    part(pivot, leafW, 0.55, 0.24, th.barCol, dir * (leafW / 2), 0.32, 0);
    part(pivot, leafW, 0.28, 0.24, th.barCol, dir * (leafW / 2), leafH * 0.48, 0);
    part(pivot, leafW, 0.32, 0.24, th.barCol, dir * (leafW / 2), leafH - 0.72, 0);
    // Barras verticais espaçadas (deixam ~85% da foto preview bem visível!)
    const numBars = 4;
    for (let i = 1; i <= numBars; i++) {
      const bx = dir * (leafW * (i / (numBars + 1)));
      part(pivot, 0.17, leafH - 0.45, 0.17, th.barCol, bx, (leafH - 0.45) / 2 + 0.1, 0);
      // Ponta de lança no topo de cada barra
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.58, 4), MT(th.tipCol, { em: 0x3a2000 }));
      tip.position.set(bx, leafH - 0.18, 0);
      pivot.add(tip);
    }
    // Meia-argola/medalhão central onde as duas folhas se encontram
    part(pivot, 0.42, 1.3, 0.34, th.tipCol, dir * (leafW - 0.22), leafH * 0.48, 0.08, { em: 0x4a2800 });
    grp.add(pivot);
    return pivot;
  };
  const leftLeaf = makeBarredLeaf(-1);
  const rightLeaf = makeBarredLeaf(1);

  // --- 4. Destaque de Saída: Placa Luminosa, Tapete Guia, Tochas e Feixe no Céu ---
  const signW = 10.6, signH = 2.65;
  part(grp, signW + 0.45, signH + 0.35, 0.38, 0x160a0c, 0, h + 1.38, pd / 2 + 0.16);
  const signMat = new THREE.MeshBasicMaterial({
    map: TX.exitSignTexture(nextLabel, th.accentCss),
    fog: false
  });
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), signMat);
  signMesh.position.set(0, h + 1.38, pd / 2 + 0.38);
  grp.add(signMesh);

  // Piras de fogo no alto das torres + 2 pedestais avançados formando corredor de entrada
  flame(cx - pxOff, ty + pillarH + 0.85, cz, 1.85, th.flameCols);
  flame(cx + pxOff, ty + pillarH + 0.85, cz, 1.85, th.flameCols);
  for (const s of [-1, 1]) {
    const fx = s * (w / 2 + 2.1);
    const fz = 4.0;
    tbox(grp, 1.35, 2.2, 1.35, th.pillarTex, fx, 1.1, fz, 2);
    part(grp, 1.55, 0.28, 1.55, th.accent, fx, 2.28, fz, { em: 0x4a2800 });
    flame(cx + fx, ty + 2.45, cz + fz, 1.45, th.flameCols);
  }

  // Feixe vertical alto visível de qualquer ponto da fase
  const beamMat = new THREE.MeshBasicMaterial({
    color: th.beamCol, transparent: true, opacity: 0.26,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3.2, 72, 10, 1, true), beamMat);
  beam.position.set(0, 36, -0.5);
  grp.add(beam);

  // Barreira vermelha (quando trancado)
  const lockMat = new THREE.MeshBasicMaterial({
    color: 0xff2200, transparent: true, opacity: 0.42,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const lockPl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lockMat);
  lockPl.position.set(0, h / 2, 0.34);
  lockPl.visible = false;
  grp.add(lockPl);

  // Tapete luminoso no chão em frente ao portão (guia o olhar sem cobrir a foto preview)
  const openMat = new THREE.MeshBasicMaterial({
    color: 0x40ff98, transparent: true, opacity: 0.26,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
  });
  const openPl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.8, 4.6), openMat);
  openPl.rotation.x = -Math.PI / 2;
  openPl.position.set(0, 0.08, 2.4);
  openPl.visible = true;
  grp.add(openPl);

  // Halo dourado giratório alto acima do portão (visível de longe, nunca tampa a foto)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, 0.22, 5, 16),
    MT(0xffd84a, { basic: true, nofog: true })
  );
  ring.position.set(0, h + 5.4, 1.2);
  ring.visible = true;
  grp.add(ring);

  addW(grp, cx, cz);
  for (const s of [-1, 1]) {
    const sx = cx + s * pxOff;
    World.colliders.push({
      x1: sx - pw / 2 - 0.35, z1: cz - pd / 2 - 0.4,
      x2: sx + pw / 2 + 0.35, z2: cz + pd / 2 + 0.35,
      active: true
    });
  }
  const col = { x1: cx - w / 2 - 1.5, z1: cz - 1.5, x2: cx + w / 2 + 1.5, z2: cz + 1.5, active: false };
  World.colliders.push(col);
  World.exitGate = {
    x: cx, z: cz, r: 9.5, unlocked: true, nextMap, nextLabel,
    grp, lockPl, openPl, beam, ring, col,
    leftLeaf, rightLeaf, gateOpen: 0, rimMat, accent: th.accent
  };
}
function unlockExitGate() {
  const eg = World.exitGate;
  if (!eg || eg.unlocked) return;
  eg.unlocked = true;
  if (eg.col) eg.col.active = false;
  eg.lockPl.visible = false;
  eg.openPl.visible = true;
  eg.ring.visible = true;
  eg.beam.material.color.setHex(0x48ff98);
  eg.beam.material.opacity = 0.28;
}

function addSkyPortal(x, y, z) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(68, 5, 6, 18), MT(0xff3010, { basic: true, nofog: true }));
  ring.position.set(x, y, z); ring.rotation.x = 1.15;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(65, 18), MT(0x701000, { basic: true, tr: 0.7, add: true, dbl: true, nofog: true }));
  disc.position.copy(ring.position); disc.rotation.x = 1.15;
  addW(ring, x, z); addW(disc, x, z);
  World.distantMeshes.push(ring, disc);
  World.skyPortal = ring;
}

function addDistantChurch(x, y, z, s) {
  s = s || 1;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  const dark = { basic: true, nofog: true };
  // Nave principal + alas
  part(g, 42, 34, 24, 0x1a0912, 0, 17, 0, dark);
  part(g, 64, 22, 18, 0x15070e, 0, 11, 2, dark);
  // Torres gêmeas
  part(g, 11, 56, 11, 0x200b16, -15, 28, 6, dark);
  part(g, 11, 56, 11, 0x200b16,  15, 28, 6, dark);
  // Agulhas (spires)
  const spGeo = new THREE.ConeGeometry(7.2, 26, 4);
  const spMat = MT(0x280d1a, dark);
  const spL = new THREE.Mesh(spGeo, spMat); spL.position.set(-15, 69, 6); spL.rotation.y = Math.PI / 4; g.add(spL);
  const spR = new THREE.Mesh(spGeo, spMat); spR.position.set( 15, 69, 6); spR.rotation.y = Math.PI / 4; g.add(spR);
  // Pináculo central + Cruz luminosa
  part(g, 14, 48, 14, 0x220c18, 0, 34, -2, dark);
  const spC = new THREE.Mesh(new THREE.ConeGeometry(9.5, 32, 4), spMat);
  spC.position.set(0, 74, -2); spC.rotation.y = Math.PI / 4; g.add(spC);
  part(g, 1.8, 16, 1.8, 0xd4a017, 0, 94, -2, dark);
  part(g, 10, 1.8, 1.8, 0xd4a017, 0, 96, -2, dark);
  // Rosácea brilhante e portal
  const rose = new THREE.Mesh(new THREE.CircleGeometry(5.5, 12), MT(0xb82048, dark));
  rose.position.set(0, 26, 12.2); g.add(rose);
  part(g, 8, 14, 1, 0x501020, 0, 7, 12.1, dark);
  addW(g, x, z);
  World.distantMeshes.push(g);
  return g;
}

function addOuterHills(x1, z1, x2, z2, tex, hillFn, segStep) {
  World.pendingFloors.push({ x1, z1, x2, z2, tex, y: -0.35, tile: 16, segStep: Math.max(segStep || 8, 16), customFn: hillFn, skipBuried: true });
}

function hillWall(x1, z1, x2, z2, h, tex) {
  const w = Math.abs(x2 - x1), d = Math.abs(z2 - z1);
  const len = Math.max(w, d);
  const n = Math.max(1, Math.ceil(len / 8));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const cx1 = w >= d ? x1 + (x2 - x1) * t0 : x1;
    const cx2 = w >= d ? x1 + (x2 - x1) * t1 : x2;
    const cz1 = d > w ? z1 + (z2 - z1) * t0 : z1;
    const cz2 = d > w ? z1 + (z2 - z1) * t1 : z2;
    const ga = getGroundY(cx1, cz1), gb = getGroundY(cx2, cz2), gm = getGroundY((cx1 + cx2) * 0.5, (cz1 + cz2) * 0.5);
    const y0 = Math.min(ga, gm, gb) - 3.0;
    const yTop = Math.max(ga, gm, gb) + h;
    wbox(cx1, cz1, cx2, cz2, yTop - y0, tex, { y0, walkable: false });
  }
}

/* ============================================================
   MAPA A1: EP. 1 · ÁREA 1 — BAIRRO ALTO (L-loop não-linear, ~195x180)
   ============================================================ */
function buildMapA1() {
  setTerrain((x, z) => 12.5 + 3.0 * Math.sin(x * 0.045 + 0.4) * Math.cos(z * 0.045) + 2.0 * Math.sin((x - z) * 0.032) + (z + 70) * 0.035);
  addOuterHills(-260, -280, 300, 140, 'hellfloor', (x, z) => {
    const base = getGroundY(x, z);
    const dx = x < -45 ? (-45 - x) : (x > 140 ? (x - 140) : 0);
    const dz = z < -150 ? (-150 - z) : (z > 20 ? (z - 20) : 0);
    const out = Math.hypot(dx, dz);
    if (out < 2.5) return base - 8.0;
    // Morros altos ao redor, mas abrindo um vale para a Ultra-Igreja ao norte (-Z)
    const ridge = (Math.sin(x * 0.032) * Math.cos(z * 0.035) + 1) * 9.5 + Math.sin((x + z) * 0.02) * 4;
    const valleyN = z < -155 ? smoothstep(-155, -240, z) * Math.max(0, 1 - Math.abs(x) / 95) * 18 : 0;
    const ramp = smoothstep(2.5, 28, out);
    return base - 2.0 * (1 - ramp) + ramp * ridge - valleyN;
  }, 8);
  addDistantChurch(-10, -16, -290, 0.72);
  // 1. Bairro Sul (Spawn + Casa de Nivaldo) — saída apenas pelo Leste!
  wfloor(-45, -55, 45, 20, 'dirt', 0, 8);
  hall(-45, -55, 45, 20, { h: 7, t: 2, wall: 'brick', skip: ['e'] });
  house(-24, -4, 11, 10, 'e', { burn: true });
  house(20, -10, 10, 9, 'w');
  house(-26, -34, 11, 10, 'e', { burn: true });
  house(16, -38, 10, 9, 's');

  // 2. Beco dos Lavradores (Ala Leste: x 45..140, z -55..20)
  wfloor(45, -55, 140, 20, 'dirt', 0, 8);
  wfloor(82, -48, 132, 12, 'crops', 0.04, 6);
  hall(45, -55, 140, 20, { h: 7, t: 2, wall: 'brick', skip: ['w', 'n', 's'] });
  hillWall(46, 19, 141, 21, 7, 'brick');
  hillWall(44, -20, 46, 19, 7, 'brick'); // parede divisória sul deixando passagem em z=-55..-20
  house(68, -4, 12, 10, 'n', { burn: true });
  house(114, -18, 12, 11, 'w');
  house(116, -42, 11, 9, 'w', { burn: true });
  scarecrow(96, -26);

  // 3. Praça do Poço (Ala Nordeste: x 45..140, z -150..-55)
  wfloor(45, -150, 140, -55, 'dirt', 0, 8);
  wfloor(74, -120, 112, -84, 'cobble', 0.02, 5);
  hall(45, -150, 140, -55, { h: 7.5, t: 2, wall: 'brick', skip: ['s', 'w', 'n'] });
  hillWall(46, -151, 141, -149, 7.5, 'brick');
  hillWall(139, -56, 141, -54, 7.5, 'brick'); // fecha junção do muro leste entre Beco e Praça
  fountain(93, -102);
  house(122, -78, 14, 14, 'w', { burn: true, h: 6 });
  house(120, -128, 14, 12, 'w');
  house(64, -132, 12, 11, 's', { burn: true });
  house(66, -72, 10, 10, 'e');

  // 4. Largo do Portão (Ala Noroeste: x -45..45, z -150..-55)
  wfloor(-45, -150, 45, -55, 'dirt', 0, 8);
  wfloor(-28, -149, 2, -95, 'cobble', 0.02, 5);
  hall(-45, -150, 45, -55, { h: 8, t: 2, wall: 'brick', skip: ['e', 's'] });
  house(-28, -82, 12, 11, 'e', { burn: true });
  house(22, -88, 12, 11, 'w');
  house(24, -126, 12, 12, 'w', { burn: true });
  makeExitGate(-15, -147.65, 'a2', 'CAMPOS DA PERDIÇÃO');

  // Props espalhados
  [[88, -8], [104, -36], [126, -6], [56, -98], [76, -138], [-10, -110]].forEach(p => hay(p[0], p[1]));
  [[-6, -22], [12, -24], [62, -32], [96, -72], [80, -118], [-34, -114], [10, -118], [36, -68]].forEach(p => deadTree(p[0], p[1]));
  [[4, -14], [58, -16], [96, -42], [108, -96], [62, -108], [-12, -74], [-22, -124], [12, -134]].forEach(p => barrelFire(p[0], p[1]));
  [[-8, 4], [8, 4], [52, -36], [84, -76], [106, -122], [-4, -102], [-28, -130]].forEach(p => crate(p[0], p[1], 1.6));
  addCropFence(82, -48, 132, 12);
  populateCrops(82, -48, 132, 12);
  addSkyPortal(40, 140, -110);
}

/* ============================================================
   MAPA A2: EP. 1 · ÁREA 2 — CAMPOS DA PERDIÇÃO (Ramificado O/L/N, ~260x200)
   ============================================================ */
function buildMapA2() {
  setTerrain((x, z) => 6.5 + 2.6 * Math.sin(x * 0.04) * Math.cos(z * 0.045) + 1.4 * Math.cos(x * 0.06) + (z + 80) * 0.035);
  addOuterHills(-280, -290, 280, 130, 'hellfloor', (x, z) => {
    const base = getGroundY(x, z);
    const out = Math.max(0, Math.abs(x) - 135, z < -185 ? (-185 - z) : (z > 20 ? z - 20 : 0));
    if (out < 2.5) return base - 8.0;
    const ridge = (Math.sin(x * 0.035) * Math.cos(z * 0.035) + 1) * 7.5;
    const valleyN = z < -190 ? smoothstep(-190, -260, z) * Math.max(0, 1 - Math.abs(x) / 100) * 14 : 0;
    const ramp = smoothstep(2.5, 28, out);
    return base - 2.0 * (1 - ramp) + ramp * ridge - valleyN;
  }, 8);
  addDistantChurch(0, -8, -265, 1.0);
  // 1. Encruzilhada Central
  wfloor(-45, -80, 45, 20, 'dirt', 0, 8);
  wfloor(-38, -70, -12, -18, 'crops', 0.04, 6);
  wfloor(12, -70, 38, -18, 'crops', 0.04, 6);
  hall(-45, -80, 45, 20, { h: 7, t: 2, wall: 'brick', skip: ['w', 'e'], openings: [{ side: 'n', c: 0, w: 14 }] });
  hillWall(-46, 1, -44, 19, 7, 'brick');
  hillWall(44, 1, 46, 19, 7, 'brick');
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
  wfloor(-105, -185, 105, -120, 'dirt', 0, 8);
  wfloor(-45, -120, 45, -80, 'dirt', 0, 8);
  wfloor(-14, -185, 14, -80, 'cobble', 0.02, 5);
  hall(-105, -185, 105, -120, { h: 8, t: 2, wall: 'stone', skip: ['s'], openings: [] });
  house(-72, -138, 14, 12, 'e', { burn: true, h: 6 });
  house(72, -138, 14, 12, 'w', { burn: true, h: 6 });
  house(-32, -156, 11, 10, 'e');
  house(32, -156, 11, 10, 'w');
  makeExitGate(0, -182.65, 'a3', 'SUBÚRBIO EXTERIOR');

  [[-22, -26], [22, -26], [-72, -32], [-112, -74], [64, -46], [94, -36], [-48, -116], [48, -116], [0, -126]].forEach(p => hay(p[0], p[1]));
  [[-6, -18], [8, -56], [-56, -54], [-118, -14], [60, -82], [122, -22], [-18, -110], [18, -144], [-58, -166], [58, -166]].forEach(p => deadTree(p[0], p[1]));
  [[0, -10], [-60, -18], [-90, -64], [60, -18], [90, -62], [-20, -128], [20, -128], [0, -158]].forEach(p => barrelFire(p[0], p[1]));
  [[-38, -70, -12, -18], [12, -70, 38, -18], [-125, -108, -62, -20], [58, -108, 125, -18]].forEach(([cx1, cz1, cx2, cz2]) => {
    addCropFence(cx1, cz1, cx2, cz2);
    populateCrops(cx1, cz1, cx2, cz2);
  });
  addSkyPortal(0, 150, -110);
}

/* ============================================================
   MAPA A3: EP. 1 · ÁREA 3 — SUBÚRBIO EXTERIOR (Cidade fortificada, ~260x200)
   ============================================================ */
function buildMapA3() {
  setTerrain((x, z) => 2.8 + 1.3 * Math.sin(x * 0.045) * Math.cos(z * 0.04) + (z + 90) * 0.022);
  addOuterHills(-260, -280, 260, 120, 'hellfloor', (x, z) => {
    const base = getGroundY(x, z);
    const out = Math.max(0, Math.abs(x) - 130, z < -195 ? (-195 - z) : (z > 20 ? z - 20 : 0));
    if (out < 2.5) return base - 8.0;
    const ridge = (Math.sin(x * 0.03) * Math.cos(z * 0.03) + 1) * 4.5;
    const valleyN = z < -200 ? smoothstep(-200, -260, z) * Math.max(0, 1 - Math.abs(x) / 100) * 8 : 0;
    const ramp = smoothstep(2.5, 28, out);
    return base - 2.0 * (1 - ramp) + ramp * ridge - valleyN;
  }, 8);
  addDistantChurch(0, -3, -245, 1.35);
  // 1. Mercado em Ruínas
  wfloor(-45, -75, 45, 20, 'dirt', 0, 8);
  wfloor(-12, -75, 12, 20, 'cobble', 0.02, 5);
  hall(-45, -75, 45, 20, { h: 8, t: 2, wall: 'brick', skip: ['w', 'e'], openings: [{ side: 'n', c: 0, w: 14 }] });
  hillWall(-46, -14, -44, 19, 8, 'brick');
  hillWall(44, -14, 46, 19, 8, 'brick');
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
  wfloor(-105, -195, 105, -130, 'cobble', 0, 6);
  wfloor(-45, -130, 45, -75, 'cobble', 0, 6);
  hall(-105, -195, 105, -130, { h: 9, t: 2, wall: 'stone', skip: ['s'] });
  house(-66, -154, 15, 14, 'e', { wall: 'stone', h: 7, burn: true });
  house(66, -154, 15, 14, 'w', { wall: 'stone', h: 7, burn: true });
  wbox(-24, -148, -18, -142, 5, 'stone', { y0: getGroundY(-21, -145), tile: 2 });
  wbox(18, -148, 24, -142, 5, 'stone', { y0: getGroundY(21, -145), tile: 2 });
  makeExitGate(0, -192.65, 'a4', 'BURGO SATANIZADO EXTERIOR');

  [[-12, -16], [12, -16], [-12, -52], [12, -52], [62, -46], [62, -88], [-22, -135], [22, -135], [-22, -170], [22, -170]].forEach(p => lamp(p[0], p[1]));
  [[-6, -34], [6, -34], [-80, -64], [80, -64], [0, -156], [-42, -168], [42, -168]].forEach(p => barrelFire(p[0], p[1]));
  [[-10, -62], [10, -62], [-76, -34], [78, -34], [-14, -138], [14, -138]].forEach(p => crate(p[0], p[1], 1.7));
  addSkyPortal(0, 150, -120);
}

/* ============================================================
   MAPA A4: EP. 2 · ÁREA 4 — BURGO SATANIZADO EXTERIOR (~280x210)
   ============================================================ */
function buildMapA4() {
  setTerrain((x, z) => 0.9 + 0.55 * Math.sin(x * 0.035) * Math.cos(z * 0.035) + (z + 100) * 0.009);
  addOuterHills(-240, -260, 240, 100, 'hellfloor', (x, z) => {
    const base = getGroundY(x, z);
    const out = Math.max(0, Math.abs(x) - 140, z < -200 ? (-200 - z) : (z > 20 ? z - 20 : 0));
    if (out < 2.5) return base - 8.0;
    const ramp = smoothstep(2.5, 28, out);
    const ridge = (Math.sin(x * 0.03) * Math.cos(z * 0.03) + 1) * 2.5;
    return base - 2.0 * (1 - ramp) + ramp * ridge;
  }, 8);
  addDistantChurch(0, 0, -230, 1.75);
  // 1. Praça da Fonte
  wfloor(-55, -90, 55, 20, 'cobble', 0, 6);
  hall(-55, -90, 55, 20, { h: 9, t: 2, wall: 'stone', skip: ['w', 'e'], openings: [{ side: 'n', c: 0, w: 16 }] });
  hillWall(-56, -19, -54, 19, 9, 'stone');
  hillWall(54, -19, 56, 19, 9, 'stone');
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
  wfloor(-110, -200, 110, -140, 'cobble', 0, 6);
  wfloor(-55, -140, 55, -90, 'cobble', 0, 6);
  hall(-110, -200, 110, -140, { h: 9.5, t: 2, wall: 'stone', skip: ['s'] });
  house(-68, -166, 18, 16, 'e', { wall: 'stone', h: 7.5, floor: 'marble', burn: true });
  house(68, -166, 18, 16, 'w', { wall: 'stone', h: 7.5, floor: 'marble', burn: true });
  makeExitGate(0, -197.65, 'a5', 'BURGO SATANIZADO INTERIOR');

  [[-16, -12], [16, -12], [-16, -58], [16, -58], [-74, -64], [-74, -98], [74, -64], [74, -98], [-22, -150], [22, -150]].forEach(p => lamp(p[0], p[1]));
  [[-26, -34], [26, -34], [-90, -80], [98, -80], [0, -162], [-36, -176], [36, -176]].forEach(p => barrelFire(p[0], p[1]));
  [[-10, -70], [10, -70], [-66, -48], [66, -48], [0, -142]].forEach(p => crate(p[0], p[1], 1.7));
  addSkyPortal(0, 150, -130);
}

/* ============================================================
   MAPA A5: EP. 2 · ÁREA 5 — BURGO SATANIZADO INTERIOR (~280x220)
   ============================================================ */
function buildMapA5() {
  wfloor(-200, -250, 200, 60, 'hellfloor', -0.25, 16);
  addDistantChurch(0, 0, -245, 2.3);
  // 1. Avenida Destruída
  wfloor(-48, -90, 48, 20, 'cobble', 0, 6);
  hall(-48, -90, 48, 20, { h: 9, t: 2, wall: 'stone', skip: ['w', 'e'], openings: [{ side: 'n', c: 0, w: 14 }] });
  wbox(-49, -24, -47, 19, 9, 'stone');
  wbox(47, -24, 49, 19, 9, 'stone');
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
  wfloor(-110, -210, 110, -145, 'cobble', 0, 6);
  wfloor(-48, -145, 48, -90, 'cobble', 0, 6);
  hall(-110, -210, 110, -145, { h: 10, t: 2, wall: 'stone', skip: ['s'] });
  [-152, -178].forEach(z => [-20, 20].forEach(x => {
    wbox(x - 1, z - 1, x + 1, z + 1, 9, 'church', { tile: 2 });
    flame(x, 9, z, 1.3);
  }));
  house(-72, -172, 16, 16, 'e', { wall: 'church', h: 8, floor: 'marble', burn: true });
  house(72, -172, 16, 16, 'w', { wall: 'church', h: 8, floor: 'marble', burn: true });
  makeExitGate(0, -207.65, 'a6_gate', 'PORTÕES DA ULTRA-IGREJA');

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
  wbox(-56, -24, -54, 19, 9.5, 'stone');
  wbox(54, -24, 56, 19, 9.5, 'stone');
  wbox(-56, -169, -54, -126, 9.5, 'stone');
  wbox(54, -169, 56, -126, 9.5, 'stone');
  makeGate('door', 0, -169, 12, 'x', 12, 'door');

  // Vestíbulo recuado + Foto Preview da Nave da Ultra-Igreja (revelado quando Nivaldo arrebenta o buraco)
  const churchPreviewGrp = new THREE.Group();
  churchPreviewGrp.position.set(0, 0, -169);
  const cAlcoveD = 3.0;
  part(churchPreviewGrp, 12.6, 0.4, cAlcoveD + 0.4, 0x0c0610, 0, 12.15, -cAlcoveD / 2);
  part(churchPreviewGrp, 12.6, 0.16, cAlcoveD + 0.4, 0x160c1a, 0, 0.08, -cAlcoveD / 2);
  part(churchPreviewGrp, 0.4, 12.2, cAlcoveD + 0.4, 0x0c0610, -6.15, 6.0, -cAlcoveD / 2);
  part(churchPreviewGrp, 0.4, 12.2, cAlcoveD + 0.4, 0x0c0610,  6.15, 6.0, -cAlcoveD / 2);
  part(churchPreviewGrp, 12.8, 12.6, 0.4, 0x09040c, 0, 6.0, -cAlcoveD - 0.15);
  const navePreviewMat = new THREE.MeshBasicMaterial({
    map: TX.levelPreviewTexture('a6_nave'),
    fog: false
  });
  psx(navePreviewMat);
  const navePreviewMesh = new THREE.Mesh(new THREE.PlaneGeometry(11.84, 11.84), navePreviewMat);
  navePreviewMesh.position.set(0, 6.0, -cAlcoveD + 0.25);
  churchPreviewGrp.add(navePreviewMesh);
  churchPreviewGrp.userData.noMerge = true;
  addW(churchPreviewGrp, 0, -169);

  // Claustro Oeste & Claustro Leste (alas laterais)
  wfloor(-118, -125, -55, -25, 'cobble', 0, 6);
  hall(-118, -125, -55, -25, { h: 9.5, t: 2, wall: 'church', skip: ['e'] });
  house(-92, -75, 16, 18, 'e', { wall: 'church', h: 8, floor: 'marble', burn: true });

  wfloor(55, -125, 118, -25, 'cobble', 0, 6);
  hall(55, -125, 118, -25, { h: 9.5, t: 2, wall: 'church', skip: ['w'] });
  house(92, -75, 16, 18, 'w', { wall: 'church', h: 8, floor: 'marble', burn: true });

  // Colunata & Pira central
  [-28, -56, -84, -112, -140].forEach(z => [-18, 18].forEach(x => {
    const pl = wpillar(x - 1.1, z - 1.1, x + 1.1, z + 1.1, 10, 'church', { tile: 2 });
    pl.flame = flame(x, 10, z, 1.3);
  }));
  wbox(-2.8, -77.8, 2.8, -72.2, 1.2, 'church', { tile: 2 });
  flame(0, 1.2, -75, 2.0);

  // Mega-Estrutura da Ultra-Igreja
  wbox(-30, -173, 30, -167, 16, 'church', { y0: 26, tile: 4, collide: false });
  wbox(-55, -173, -34, -167, 48, 'church', { y0: 26, tile: 4, collide: false });
  wbox(34, -173, 55, -167, 48, 'church', { y0: 26, tile: 4, collide: false });
  wbox(-50, -172, -38, -168, 16, 'church', { y0: 74, tile: 3, collide: false });
  wbox(38, -172, 50, -168, 16, 'church', { y0: 74, tile: 3, collide: false });
  [-44, 44].forEach(tx => {
    const spire = new THREE.Mesh(new THREE.ConeGeometry(5, 18, 4), TX.mat('roof'));
    spire.rotation.y = Math.PI / 4;
    spire.position.set(tx, 98, -170);
    addW(spire, tx, -170);
    flame(tx, 74.5, -166.5, 2.4);
  });
  const topCross = new THREE.Group(); topCross.position.set(0, 42, -168);
  part(topCross, 1.8, 22, 1.8, 0xd4a017, 0, 11, 0, { em: 0x5a2800 });
  part(topCross, 11, 1.8, 1.8, 0xd4a017, 0, 15, 0, { em: 0x5a2800 });
  addW(topCross, 0, -168);
  const rose = new THREE.Mesh(new THREE.CircleGeometry(5.2, 12), MT(0xff3a10, { basic: true }));
  rose.position.set(0, 20, -168.7);
  addW(rose, 0, -168.7);

  [[-36, -148], [36, -148], [-36, -102], [36, -102]].forEach(p => deadTree(p[0], p[1]));
  addSkyPortal(0, 150, -100);
}

/* ============================================================
   MAPA A6_NAVE: EP. 3 · ÁREA 6 — A CAPELA DEMONIZADA (Em cruz, com transeptos)
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
    openings: [{ side: 'n', c: 0, w: 20 }, { side: 'w', c: -60, w: 22 }, { side: 'e', c: -60, w: 22 }]
  });

  // Transepto Oeste & Transepto Leste (catedral em formato de cruz)
  wfloor(-66, -78, -28, -42, 'marble', 0, 8);
  hall(-66, -78, -28, -42, { h: 17, t: 2, wall: 'church', skip: ['e', 'n', 's'], ceil: 'dark' });
  wbox(-67, -79, -29, -77, 17, 'church');
  wbox(-67, -43, -29, -41, 17, 'church');
  wfloor(28, -78, 66, -42, 'marble', 0, 8);
  hall(28, -78, 66, -42, { h: 17, t: 2, wall: 'church', skip: ['w', 'n', 's'], ceil: 'dark' });
  wbox(29, -79, 67, -77, 17, 'church');
  wbox(29, -43, 67, -41, 17, 'church');

  // Pilares & Bancos
  [-22, -40, -58, -78, -98, -118, -134].forEach(z => [-15, 15].forEach(x => wpillar(x - 0.9, z - 0.9, x + 0.9, z + 0.9, 19, 'church', { tile: 3 })));
  for (let z = -18; z > -130; z -= 7) {
    wbox(-9.5, z - 0.5, -3.5, z + 0.5, 0.9, 'wood', { tile: 2, collide: false });
    wbox(3.5, z - 0.5, 9.5, z + 0.5, 0.9, 'wood', { tile: 2, collide: false });
  }

  // Escadaria subterrânea oculta sob o centro do altar (x: -3..3, z: -148.5..-136)
  wbox(-3.4, -148.5, -3.0, -136.0, 4.2, 'crypt', { y0: -4.2, tile: 2, collide: false });
  wbox(3.0, -148.5, 3.4, -136.0, 4.2, 'crypt', { y0: -4.2, tile: 2, collide: false });
  wbox(-3.4, -148.9, 3.4, -148.5, 4.2, 'crypt', { y0: -4.2, tile: 2, collide: false });
  for (let i = 0; i < 10; i++) {
    const z1 = -136.0 - (i + 1) * 1.0, z2 = -136.0 - i * 1.0;
    const yTop = -(i + 1) * 0.32;
    wbox(-3.0, z1, 3.0, z2, 1.2, i % 2 === 0 ? 'marble' : 'stone', { y0: yTop - 1.2, tile: 2, walkable: true });
  }
  wbox(-3.0, -148.5, 3.0, -146.0, 1.2, 'bonefloor', { y0: -3.4 - 1.2, tile: 2, walkable: true });
  const cryptDoor = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), MT(0x051812, { basic: true }));
  cryptDoor.position.set(0, -1.8, -148.42);
  addW(cryptDoor, 0, -148.42);
  const cryptGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.8), MT(0x30ffc0, { basic: true, tr: 0.38, add: true }));
  cryptGlow.position.set(0, -1.8, -148.38);
  addW(cryptGlow, 0, -148.38);
  flame(-2.2, -1.9, -147.6, 0.75, [0x40ffd0, 0xc0fff0]);
  flame(2.2, -1.9, -147.6, 0.75, [0x40ffd0, 0xc0fff0]);

  // Altar bipartido
  const mkAltarHalf = (side) => {
    const g = new THREE.Group();
    g.userData.dynamicPos = true;
    const b1 = new THREE.Mesh(tiledBox(7.0, 0.45, 12.8, 3), TX.mat('marble'));
    b1.position.set(side * 3.5, 0.225, -142.2); g.add(b1);
    const b2 = new THREE.Mesh(tiledBox(6.0, 1.1, 10.6, 3), TX.mat('marble'));
    b2.position.set(side * 3.0, 1.0, -142.5); g.add(b2);
    const b3 = new THREE.Mesh(tiledBox(6.3, 0.26, 11.2, 3), TX.mat('marble'));
    b3.position.set(side * 3.15, 1.68, -142.5); g.add(b3);
    part(g, 0.32, 1.42, 11.25, 0xd4a017, side * 0.16, 1.13, -142.5, { em: 0x3a2800 });
    part(g, 5.8, 0.22, 0.14, 0xd4a017, side * 3.0, 1.15, -137.15, { em: 0x3a2800 });
    part(g, 0.5, 0.9, 0.5, 0xd4a017, side * 4.6, 2.25, -142.5, { em: 0x3a2800 });
    addW(g, side * 3.5, -142.5);
    return g;
  };
  const leftGrp = mkAltarHalf(-1);
  const rightGrp = mkAltarHalf(1);
  const colL = { x1: -7.0, z1: -148.6, x2: 0, z2: -135.8, y0: 0, yMax: 1.85, walkable: true, active: true, _dyn: true };
  const colR = { x1: 0, z1: -148.6, x2: 7.0, z2: -135.8, y0: 0, yMax: 1.85, walkable: true, active: true, _dyn: true };
  World.colliders.push(colL, colR);
  World.altar = {
    leftGrp, rightGrp, colL, colR, open: false, t: 0,
    pit: { x1: -2.9, x2: 2.9, z1: -148.6, z2: -135.8 }
  };

  // Super-Cruz Dourada decorativa atrás do altar
  const ac = new THREE.Group(); ac.position.set(0, 0, -146.5);
  part(ac, 1.3, 15, 1.3, 0xd4a017, 0, 8.5, 0, { em: 0x4a3400 });
  part(ac, 7, 1.3, 1.3, 0xd4a017, 0, 12, 0, { em: 0x4a3400 });
  addW(ac, 0, -146.5); World.altarCross = ac;
  const cols = [0xcc2020, 0x8a30cc, 0xd0a020, 0x2050d0];
  [-24, -44, -84, -104, -124].forEach((z, i) => {
    [-1, 1].forEach(side => {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(4, 8), MT(cols[(i + (side > 0 ? 1 : 0)) % 4], { basic: true, tr: 0.85 }));
      gl.position.set(side * 26.9, 10, z);
      gl.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      addW(gl, side * 26.9, z);
    });
  });
  [[-24, -10], [24, -10], [-60, -60], [60, -60], [-24, -140], [24, -140]].forEach(p => {
    wbox(p[0] - 0.5, p[1] - 0.5, p[0] + 0.5, p[1] + 0.5, 1.3, 'church', { tile: 1 });
    flame(p[0], 1.3, p[1], 1.1, [0x8a30ff, 0xffa0ff]);
  });

  // parede atrás da cruz do altar que Galius vai explodir
  World.breakWall = wbox(-10, -151, 10, -149, 19, 'church', { tile: 3 });
  wfloor(-18, -184, 18, -151, 'hellfloor', 0, 6);
  wceil(-18, -184, 18, -150, 'dark', 19, 8);
  hall(-18, -184, 18, -151, { h: 19, t: 2, wall: 'crypt', skip: ['s'] });

  const hatchBeam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 12, 11.5), MT(0x40ffd0, { basic: true, tr: 0.16, add: true, dbl: true }));
  hatchBeam.position.set(0, 4.5, -142.2);
  const hg = new THREE.Group(); hg.add(hatchBeam);
  hg.visible = false; addW(hg, 0, -142.2);
  World.hatch = { g: hg, x: 0, z: -140, r: 3.2, active: false };

  const pg = new THREE.Group(); pg.position.set(0, 0, -130);
  const pc = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 9, 8, 1, true), MT(0x30ff70, { basic: true, tr: 0.45, add: true, dbl: true }));
  pc.position.y = 4.5;
  const pr = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.35, 5, 12), MT(0x90ffb0, { basic: true }));
  pr.position.y = 4.5; pr.rotation.x = 0;
  pg.add(pc); pg.add(pr);
  pg.visible = false; addW(pg, 0, -130);
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
  wbox(14.5, -18, 35.5, -17, 6.5, 'crypt'); wbox(14.5, -11, 35.5, -10, 6.5, 'crypt');
  makeGate('g_c1', 14, -14, 6, 'z', 6.5, 'barrier');

  // 2. Sala B: Salão dos Mortos (x 36..80, z -42..6) -> saída Norte (x 58)
  fl(36, -42, 80, 6);
  hall(36, -42, 80, 6, { h: 7.5, t: 1, wall: 'crypt', ceil: 'dark', openings: [{ side: 'w', c: -14, w: 6, oh: 6.5 }, { side: 'n', c: 58, w: 6, oh: 6.5 }] });
  [[46, -4], [70, -4], [46, -32], [70, -32]].forEach(p => wbox(p[0] - 1, p[1] - 1, p[0] + 1, p[1] + 1, 7.5, 'crypt', { tile: 2 }));
  [[52, -18], [64, -18]].forEach(p => wbox(p[0] - 1, p[1] - 2.5, p[0] + 1, p[1] + 2.5, 1.2, 'stone', { tile: 2 }));
  [[40, 2], [76, 2], [40, -38], [76, -38]].forEach(p => { wbox(p[0] - 0.4, p[1] - 0.4, p[0] + 0.4, p[1] + 0.4, 1.2, 'crypt', { tile: 1 }); flame(p[0], 1.2, p[1], 0.9, gc); });
  makeGate('g_c2', 58, -42, 6, 'x', 7.5, 'barrier');

  // Corredor 2 (Norte: x 55..61, z -64..-42)
  fl(55, -64, 61, -42); wceil(55, -64, 61, -42, 'dark', 6.5, 8);
  wbox(54, -63.5, 55, -42.5, 6.5, 'crypt'); wbox(61, -63.5, 62, -42.5, 6.5, 'crypt');

  // 3. Sala C: Galeria dos Ossos (x 38..78, z -108..-64) -> saída Oeste (z -86)
  fl(38, -108, 78, -64);
  hall(38, -108, 78, -64, { h: 8, t: 1, wall: 'crypt', ceil: 'dark', openings: [{ side: 's', c: 58, w: 6, oh: 6.5 }, { side: 'w', c: -86, w: 6, oh: 6.5 }] });
  [[48, -74], [68, -74], [48, -98], [68, -98]].forEach(p => wbox(p[0] - 1, p[1] - 1, p[0] + 1, p[1] + 1, 8, 'crypt', { tile: 2 }));
  [[42, -68], [74, -68], [42, -104], [74, -104]].forEach(p => { wbox(p[0] - 0.4, p[1] - 0.4, p[0] + 0.4, p[1] + 0.4, 1.3, 'crypt', { tile: 1 }); flame(p[0], 1.3, p[1], 0.95, gc); });
  makeGate('g_c3', 38, -86, 6, 'z', 8, 'barrier');

  // Corredor 3 (Oeste: x 16..38, z -89..-83)
  fl(16, -89, 38, -83); wceil(16, -89, 38, -83, 'dark', 6.5, 8);
  wbox(16.5, -90, 37.5, -89, 6.5, 'crypt'); wbox(16.5, -83, 37.5, -82, 6.5, 'crypt');

  // 4. Câmara Sacra de Romulus III (x -22..16, z -106..-66)
  fl(-22, -106, 16, -66);
  hall(-22, -106, 16, -66, { h: 9.5, t: 1, wall: 'crypt', ceil: 'dark', openings: [{ side: 'e', c: -86, w: 6, oh: 6.5 }] });
  wbox(-8, -90, 0, -82, 1.4, 'marble', { tile: 3 });
  wbox(-7, -89, -1, -83, 0.6, 'stone', { tile: 2, y0: 1.4, collide: false });
  [[-18, -70], [12, -70], [-18, -102], [12, -102]].forEach(p => { wbox(p[0] - 0.5, p[1] - 0.5, p[0] + 0.5, p[1] + 0.5, 1.6, 'crypt', { tile: 1 }); flame(p[0], 1.6, p[1], 1.0, gc); });
  const cg = buildThrownCross(); cg.position.set(-4, 3.0, -86); cg.scale.set(0.7, 0.7, 0.7);
  cg.userData.dynamicPos = true;
  addW(cg, -4, -86); World.crossPickup = cg;
  const gh = new THREE.Group(); gh.position.set(-12, 2.6, -86);
  gh.rotation.y = Math.PI / 2;
  gh.userData.dynamicPos = true;
  const gm = { basic: true, tr: 0.45, add: true };
  part(gh, 1.2, 1.8, 0.7, 0x80c8ff, 0, 0, 0, gm);
  part(gh, 0.8, 0.8, 0.8, 0xb0e0ff, 0, 1.4, 0, gm);
  part(gh, 0.9, 0.4, 0.9, 0xffe080, 0, 1.95, 0, gm);
  part(gh, 0.9, 0.1, 0.1, 0x000000, 0, 1.45, 0.41, { basic: true });
  part(gh, 0.3, 1.0, 0.3, 0x80c8ff, -0.75, -0.1, 0, gm);
  part(gh, 0.3, 1.0, 0.3, 0x80c8ff, 0.75, -0.1, 0, gm);
  addW(gh, -12, -86); World.ghost = gh;
}

/* ============ SPAWNS & PICKUPS POR MAPA ============ */
const SPAWNS = {
  a1: [
    // Bairro Sul
    ['campones', -8, -16], ['campones', 12, -14], ['campones', -30, -14], ['campones', 20, -28], ['campones', -10, -40],
    ['campones', -22, -24], ['campones', 4, -22], ['campones', 26, -16], ['campones', -16, -34], ['campones', 8, -38],
    ['diabrete', 0, -26, 3], ['diabrete', -18, -44, 3.5], ['diabrete', 16, -32, 3.2], ['diabrete', -28, -28, 3.8],
    // Beco dos Lavradores (Leste)
    ['campones', 62, -16], ['campones', 88, -10], ['campones', 112, -28], ['campones', 96, -42], ['campones', 126, -12],
    ['campones', 72, -32], ['campones', 102, -18], ['campones', 120, -24], ['campones', 82, -38],
    ['diabrete', 76, -24, 3], ['diabrete', 116, -34, 3.5], ['diabrete', 92, -6, 3], ['diabrete', 104, -40, 3.5], ['guarda', 110, -18],
    // Praça do Poço (Nordeste)
    ['campones', 74, -84], ['campones', 110, -84], ['campones', 92, -122], ['campones', 62, -112],
    ['campones', 82, -96], ['campones', 104, -104], ['campones', 68, -98], ['campones', 116, -94],
    ['diabrete', 92, -92, 3.5], ['diabrete', 118, -110, 3], ['diabrete', 76, -114, 3.2], ['gargula', 92, -108, 4], ['gargula', 108, -90, 4.5],
    ['guarda', 86, -116], ['guarda', 102, -116],
    // Largo do Portão (Noroeste)
    ['campones', 12, -96], ['campones', -22, -108], ['campones', -6, -98], ['campones', 20, -112], ['campones', -18, -92],
    ['diabrete', 0, -118, 3.5], ['diabrete', -24, -120, 3.2], ['diabrete', 18, -122, 3.5],
    ['guarda', -15, -126], ['guarda', 10, -130], ['guarda', -28, -132], ['guarda', -2, -134], ['gargula', -12, -112, 4.5]
  ],
  a2: [
    // Encruzilhada Central
    ['campones', -12, -18], ['campones', 14, -22], ['campones', 0, -48], ['campones', -22, -34], ['campones', 22, -34], ['campones', 0, -30],
    ['diabrete', -16, -54, 3], ['diabrete', 16, -54, 3], ['diabrete', 0, -38, 3.5], ['guarda', -10, -44], ['guarda', 10, -44],
    // Ala Oeste
    ['campones', -66, -34], ['campones', -88, -50], ['campones', -112, -70], ['campones', -78, -96],
    ['campones', -76, -46], ['campones', -100, -60], ['campones', -90, -82], ['campones', -68, -80],
    ['diabrete', -94, -36, 3.5], ['diabrete', -68, -64, 3], ['diabrete', -106, -82, 3.2], ['gargula', -96, -68, 4.5], ['gargula', -78, -56, 4.5],
    ['guarda', -106, -98], ['guarda', -84, -104],
    // Ala Leste (Celeiro da Foice)
    ['campones', 68, -42], ['campones', 92, -56], ['campones', 114, -80], ['campones', 78, -98],
    ['campones', 78, -50], ['campones', 104, -66], ['campones', 88, -84], ['campones', 110, -94],
    ['diabrete', 90, -34, 3], ['diabrete', 112, -48, 3.5], ['diabrete', 76, -72, 3.2], ['gargula', 96, -72, 4.5], ['gargula', 108, -60, 4.5],
    ['guarda', 96, -104], ['guarda', 82, -92],
    // Colina Norte
    ['campones', -40, -128], ['campones', 40, -128], ['campones', -20, -134], ['campones', 20, -134], ['campones', 0, -150],
    ['diabrete', -22, -148, 3.5], ['diabrete', 22, -148, 3.5], ['diabrete', -38, -146, 3.2], ['diabrete', 38, -146, 3.2],
    ['gargula', 0, -138, 5], ['gargula', -54, -158, 4.5], ['gargula', 54, -158, 4.5], ['gargula', -28, -162, 4.8], ['gargula', 28, -162, 4.8],
    ['guarda', -12, -160], ['guarda', 12, -160], ['guarda', 0, -168], ['guarda', -26, -154], ['guarda', 26, -154]
  ],
  a3: [
    // Mercado em Ruínas
    ['campones', -14, -22], ['campones', 14, -22], ['campones', -20, -38], ['campones', 20, -38], ['campones', 0, -28],
    ['diabrete', 0, -42, 3], ['diabrete', -18, -48, 3.2], ['diabrete', 18, -48, 3.2],
    ['guarda', -12, -58], ['guarda', 12, -58], ['guarda', 0, -52],
    // Ala Oeste (Vila Incendiada)
    ['campones', -72, -44], ['campones', -96, -66], ['campones', -78, -98], ['campones', -84, -56], ['campones', -102, -92],
    ['diabrete', -88, -48, 3.5], ['diabrete', -108, -82, 3], ['diabrete', -72, -78, 3.2],
    ['guarda', -84, -112], ['guarda', -96, -104], ['guarda', -74, -90],
    ['gargula', -90, -74, 4.5], ['gargula', -104, -64, 4.5], ['demonio', -92, -98],
    // Ala Leste (Quartel dos Guardas)
    ['guarda', 68, -42], ['guarda', 92, -62], ['guarda', 104, -88], ['guarda', 76, -108],
    ['guarda', 82, -52], ['guarda', 98, -76], ['guarda', 68, -92],
    ['diabrete', 82, -46, 3], ['diabrete', 96, -98, 3.2], ['gargula', 96, -72, 4.5], ['gargula', 78, -64, 4.5],
    ['campones', 66, -78], ['campones', 88, -104], ['demonio', 92, -88],
    // Bastião Norte
    ['guarda', -32, -140], ['guarda', 32, -140], ['guarda', -14, -168], ['guarda', 14, -168], ['guarda', 0, -156],
    ['diabrete', -50, -156, 3.5], ['diabrete', 50, -156, 3.5], ['diabrete', -24, -148, 3.2], ['diabrete', 24, -148, 3.2],
    ['gargula', 0, -146, 5], ['gargula', -40, -172, 4.5], ['gargula', 40, -172, 4.5],
    ['demonio', -18, -176], ['demonio', 18, -176], ['demonio', -34, -164], ['demonio', 34, -164]
  ],
  a4: [
    // Praça da Fonte
    ['campones', -18, -22], ['campones', 18, -22], ['campones', 0, -32], ['guarda', -22, -50], ['guarda', 22, -50],
    ['guarda', -12, -38], ['guarda', 12, -38], ['diabrete', -24, -36, 3.2], ['diabrete', 24, -36, 3.2], ['gargula', 0, -44, 4.5],
    // Ala Oeste (Mansão do Duque)
    ['guarda', -76, -54], ['guarda', -94, -104], ['guarda', -84, -72], ['guarda', -106, -90],
    ['demonio', -102, -74], ['demonio', -84, -88], ['demonio', -110, -118], ['demonio', -78, -102],
    ['gargula', -88, -62, 4.5], ['gargula', -104, -96, 4.5], ['diabrete', -72, -114, 3], ['diabrete', -94, -68, 3.2], ['padre', -96, -116],
    // Ala Leste (Vilas & Jardins)
    ['guarda', 76, -54], ['guarda', 94, -104], ['guarda', 84, -72], ['guarda', 106, -90],
    ['demonio', 102, -74], ['demonio', 84, -88], ['demonio', 110, -118], ['demonio', 78, -102],
    ['gargula', 88, -62, 4.5], ['gargula', 104, -96, 4.5], ['diabrete', 72, -114, 3], ['diabrete', 94, -68, 3.2], ['padre', 96, -116],
    // Terraço Nobre
    ['demonio', -36, -156], ['demonio', 36, -156], ['demonio', 0, -174], ['demonio', -22, -152], ['demonio', 22, -152],
    ['guarda', -20, -168], ['guarda', 20, -168], ['guarda', -42, -170], ['guarda', 42, -170],
    ['padre', -48, -180], ['padre', 48, -180], ['padre', 0, -182],
    ['gargula', 0, -152, 5], ['gargula', -50, -166, 4.5], ['gargula', 50, -166, 4.5], ['gargula', -26, -176, 4.5], ['gargula', 26, -176, 4.5]
  ],
  a5: [
    // Avenida Destruída
    ['diabrete', -12, -24, 3], ['diabrete', 12, -24, 3], ['diabrete', -22, -40, 3.2], ['diabrete', 22, -40, 3.2],
    ['guarda', -18, -56], ['guarda', 18, -56], ['guarda', -8, -42], ['guarda', 8, -42],
    ['demonio', 0, -64], ['demonio', -16, -68], ['demonio', 16, -68],
    // Ala Oeste (Beco das Gárgulas)
    ['gargula', -76, -56, 4.5], ['gargula', -104, -82, 5], ['gargula', -88, -116, 4.5], ['gargula', -96, -72, 4.8],
    ['demonio', -96, -64], ['demonio', -96, -108], ['demonio', -80, -84], ['demonio', -108, -96],
    ['guarda', -72, -96], ['guarda', -84, -106], ['diabrete', -114, -90, 3.5], ['padre', -102, -114],
    // Ala Leste (Ninho dos Padres)
    ['padre', 78, -58], ['padre', 104, -86], ['padre', 92, -118], ['padre', 84, -74],
    ['demonio', 96, -64], ['demonio', 96, -108], ['demonio', 80, -84], ['demonio', 108, -96],
    ['guarda', 72, -96], ['guarda', 84, -106], ['gargula', 88, -96, 4.5], ['gargula', 106, -70, 4.5], ['diabrete', 112, -90, 3.5],
    // Esplanada da Ultra-Igreja
    ['demonio', -38, -164], ['demonio', 38, -164], ['demonio', 0, -184], ['demonio', -22, -174], ['demonio', 22, -174],
    ['padre', -26, -186], ['padre', 26, -186], ['padre', -44, -176], ['padre', 44, -176],
    ['guarda', -54, -184], ['guarda', 54, -184], ['guarda', -14, -190], ['guarda', 14, -190],
    ['gargula', -18, -168, 5], ['gargula', 18, -168, 5], ['gargula', -40, -190, 4.8], ['gargula', 40, -190, 4.8]
  ],
  a6_gate: [
    // Pátio + Claustros (Maximus spawna após eliminar todos os inimigos)
    ['guarda', -16, -34], ['guarda', 16, -34], ['guarda', -24, -48], ['guarda', 24, -48],
    ['padre', -26, -62], ['padre', 26, -62], ['diabrete', -12, -52, 3.2], ['diabrete', 12, -52, 3.2],
    ['demonio', -84, -70], ['demonio', -76, -82], ['padre', -76, -92], ['gargula', -86, -80, 5], ['guarda', -92, -88],
    ['demonio', 84, -70], ['demonio', 76, -82], ['padre', 76, -92], ['gargula', 86, -80, 5], ['guarda', 92, -88],
    ['guarda', -18, -118], ['guarda', 18, -118], ['demonio', -10, -106], ['demonio', 10, -106], ['gargula', 0, -110, 5]
  ],
  a6_maximus: [
    ['maximus', 0, -148]
  ],
  a6_nave: [
    ['demonio', -10, -28], ['demonio', 10, -32], ['demonio', 0, -40],
    ['diabrete', -6, -24, 3], ['diabrete', 6, -24, 3], ['diabrete', -14, -36, 3.2], ['diabrete', 14, -36, 3.2],
    ['demonio', -46, -60], ['demonio', -52, -72], ['gargula', -50, -56, 5], ['padre', -54, -66], ['guarda', -42, -68],
    ['demonio', 46, -60], ['demonio', 52, -72], ['gargula', 50, -56, 5], ['padre', 54, -66], ['guarda', 42, -68],
    ['demonio', 0, -92], ['demonio', -18, -98], ['demonio', 18, -98],
    ['gargula', -14, -84, 5], ['gargula', 14, -84, 5], ['gargula', 0, -104, 5],
    ['padre', -16, -118], ['padre', 16, -118], ['padre', -12, -132], ['padre', 12, -132], ['guarda', -22, -126], ['guarda', 22, -126]
  ],
  a6_galius1: [['galius1', 0, -162]],
  a6_crypt1: [
    ['diabrete', -6, -10, 3], ['diabrete', 6, -14, 3], ['diabrete', 0, -22, 3], ['diabrete', -8, -20, 3.2], ['diabrete', 8, -20, 3.2],
    ['campones', -8, -18], ['campones', 8, -8], ['campones', 0, -12], ['campones', -4, -24], ['campones', 4, -24]
  ],
  a6_crypt2: [
    ['padre', 48, -6], ['padre', 68, -6], ['padre', 58, -34], ['padre', 58, -22],
    ['guarda', 46, -20], ['guarda', 70, -20], ['guarda', 58, -14], ['guarda', 50, -12], ['guarda', 66, -12],
    ['campones', 52, -28], ['campones', 64, -28], ['diabrete', 58, -8, 3.2]
  ],
  a6_crypt3: [
    ['demonio', 48, -76], ['demonio', 68, -76], ['demonio', 58, -88],
    ['padre', 48, -96], ['padre', 68, -96], ['padre', 58, -100],
    ['gargula', 58, -84, 4], ['gargula', 50, -90, 4.2], ['gargula', 66, -90, 4.2],
    ['diabrete', 52, -70, 3], ['diabrete', 64, -70, 3], ['guarda', 58, -74]
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

const PEASANTS = {
  a1: [
    [0, -12], [-14, -20], [10, -28],
    [76, -20], [100, -14],
    [82, -88], [104, -112],
    [0, -104], [-16, -118]
  ],
  a2: [
    [-8, -28], [10, -52],
    [-80, -44], [-88, -72],
    [82, -52], [96, -78],
    [-14, -136], [14, -148]
  ],
  a3: [
    [-8, -30], [10, -46],
    [-80, -58], [-90, -82],
    [80, -58], [88, -84],
    [-16, -152], [16, -152]
  ],
  a4: [
    [-16, -28], [16, -44],
    [-88, -68], [-96, -98],
    [92, -62], [96, -98],
    [-24, -160], [24, -160]
  ],
  a5: [
    [-14, -32], [14, -52],
    [-90, -72], [-92, -102],
    [90, -72], [92, -102],
    [-24, -170], [24, -170]
  ],
  a6_gate: [
    [-12, -42], [12, -58], [-78, -75], [78, -75]
  ],
  a6_nave: [
    [-12, -32], [12, -48], [-44, -60], [44, -60]
  ],
  a6_crypt: []
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

function mergeBufferGeometries(geos) {
  let totalVerts = 0;
  let totalIdx = 0;
  let hasNorm = true;
  let hasUv = true;
  const prepared = [];
  for (let i = 0; i < geos.length; i++) {
    const g = geos[i];
    const pos = g.attributes.position;
    if (!pos) continue;
    if (!g.attributes.normal) hasNorm = false;
    if (!g.attributes.uv) hasUv = false;
    const idx = g.index;
    const vCount = pos.count;
    const iCount = idx ? idx.count : vCount;
    prepared.push({ g, pos, nrm: g.attributes.normal, uv: g.attributes.uv, idx, vCount, iCount });
    totalVerts += vCount;
    totalIdx += iCount;
  }
  if (!prepared.length) return null;

  const posArr = new Float32Array(totalVerts * 3);
  const nrmArr = hasNorm ? new Float32Array(totalVerts * 3) : null;
  const uvArr = hasUv ? new Float32Array(totalVerts * 2) : null;
  const idxArr = totalVerts > 65535 ? new Uint32Array(totalIdx) : new Uint16Array(totalIdx);

  let vOff = 0;
  let iOff = 0;
  for (let p = 0; p < prepared.length; p++) {
    const it = prepared[p];
    posArr.set(it.pos.array, vOff * 3);
    if (nrmArr && it.nrm) nrmArr.set(it.nrm.array, vOff * 3);
    if (uvArr && it.uv) uvArr.set(it.uv.array, vOff * 2);
    if (it.idx) {
      const src = it.idx.array;
      for (let j = 0; j < it.iCount; j++) idxArr[iOff + j] = src[j] + vOff;
    } else {
      for (let j = 0; j < it.iCount; j++) idxArr[iOff + j] = vOff + j;
    }
    vOff += it.vCount;
    iOff += it.iCount;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  if (nrmArr) out.setAttribute('normal', new THREE.BufferAttribute(nrmArr, 3));
  if (uvArr) out.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  out.setIndex(new THREE.BufferAttribute(idxArr, 1));
  return out;
}

function mergeStaticChunks() {
  const dynSet = new Set();
  const markDyn = (o) => { if (o) { dynSet.add(o); o.userData = o.userData || {}; o.userData.noMerge = true; } };
  for (let i = 0; i < World.flames.length; i++) if (World.flames[i]) markDyn(World.flames[i].g);
  for (const id in World.gates) if (World.gates[id]) markDyn(World.gates[id].grp);
  if (World.exitGate) markDyn(World.exitGate.grp);
  if (World.altar) { markDyn(World.altar.leftGrp); markDyn(World.altar.rightGrp); }
  if (World.portal) markDyn(World.portal.g);
  markDyn(World.ghost);
  markDyn(World.crossPickup);
  markDyn(World.altarCross);
  markDyn(World.skyPortal);
  markDyn(World.breakWall);
  markDyn(World.hatch);
  markDyn(World.doorMesh);
  for (let i = 0; i < World.distantMeshes.length; i++) markDyn(World.distantMeshes[i]);

  for (const ch of World.chunks.values()) {
    ch.group.updateMatrixWorld(true);
    const chInv = new THREE.Matrix4().copy(ch.group.matrixWorld).invert();
    const groups = new Map();
    const toRemove = [];

    const collect = (node, blocked) => {
      const isBlocked = blocked || dynSet.has(node) || (node.userData && (node.userData.noMerge || node.userData.dynamicPos));
      if (node.isMesh && !isBlocked && node.geometry && node.material && !Array.isArray(node.material)) {
        const key = node.material.id + '|' + (node.renderOrder || 0);
        let entry = groups.get(key);
        if (!entry) { entry = { mat: node.material, renderOrder: node.renderOrder || 0, meshes: [] }; groups.set(key, entry); }
        entry.meshes.push(node);
        return;
      }
      const kids = node.children;
      for (let i = 0; i < kids.length; i++) collect(kids[i], isBlocked);
    };
    collect(ch.group, false);

    const localMat = new THREE.Matrix4();
    for (const entry of groups.values()) {
      if (entry.meshes.length < 2) {
        if (entry.meshes.length === 1) {
          entry.meshes[0].updateMatrix();
          entry.meshes[0].matrixAutoUpdate = false;
        }
        continue;
      }
      const geos = [];
      for (let i = 0; i < entry.meshes.length; i++) {
        const m = entry.meshes[i];
        localMat.multiplyMatrices(chInv, m.matrixWorld);
        const g = m.geometry.clone();
        g.applyMatrix4(localMat);
        geos.push(g);
        toRemove.push(m);
      }
      const merged = mergeBufferGeometries(geos);
      for (let i = 0; i < geos.length; i++) geos[i].dispose();
      if (merged) {
        merged.userData = merged.userData || {};
        merged.userData._merged = true;
        const mm = new THREE.Mesh(merged, entry.mat);
        if (entry.renderOrder) mm.renderOrder = entry.renderOrder;
        mm.updateMatrix();
        mm.matrixAutoUpdate = false;
        mm.userData = { savedPos: new THREE.Vector3(0, 0, 0), chunk: ch };
        ch.group.add(mm);
      }
    }

    for (let i = 0; i < toRemove.length; i++) {
      const m = toRemove[i];
      if (m.parent) m.parent.remove(m);
    }

    // Remove empty static groups left behind and freeze remaining static objects
    const prune = (node) => {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const c = node.children[i];
        if (!dynSet.has(c) && !(c.userData && c.userData.dynamicPos)) {
          prune(c);
          if (!c.isMesh && c.children.length === 0) node.remove(c);
        }
      }
    };
    prune(ch.group);

    ch.objects.length = 0;
    for (let i = 0; i < ch.group.children.length; i++) {
      const c = ch.group.children[i];
      ch.objects.push(c);
      if (!dynSet.has(c) && !(c.userData && c.userData.dynamicPos)) {
        c.updateMatrix();
        c.matrixAutoUpdate = false;
      }
    }
  }
}

function buildMap(mapId) {
  if (!World.scene) return;
  if (!World.group) {
    World.group = new THREE.Group();
    World.scene.add(World.group);
  }
  World.group.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.userData && o.geometry.userData._merged) {
      o.geometry.dispose();
    }
  });
  while (World.group.children.length) World.group.remove(World.group.children[0]);
  World.chunks.clear();
  World._lastRenderChunks = -1;
  World.colliders.length = 0;
  World.dynamicColliders.length = 0;
  World.colliderGrid.clear();
  World.triggers.length = 0;
  World.flames.length = 0;
  World.pillars.length = 0;
  World.distantMeshes.length = 0;
  World.terrainY = null;
  World.terrainBaseFn = null;
  World.pads.length = 0;
  World.pendingFloors.length = 0;
  World.houseRects.length = 0;
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
  flushTerrain();
  mergeStaticChunks();
  World.rebuildColliderGrid();
  World.updateChunks(World.viewerX || 0, World.viewerZ || 0, true);
  World.setWorldDetail(World.detailMode);
}

World.setWorldDetail = function (mode) {
  World.detailMode = mode || 'high';
  const showDistant = World.detailMode !== 'min' && World.detailMode !== 'low';
  const showFlames = World.detailMode !== 'min';
  for (let i = 0; i < World.distantMeshes.length; i++) {
    if (World.distantMeshes[i]) World.distantMeshes[i].visible = showDistant;
  }
  for (let i = 0; i < World.flames.length; i++) {
    const f = World.flames[i];
    if (f && f.g) {
      f.g.visible = showFlames;
      if (f.smokeMesh) f.smokeMesh.visible = showDistant;
    }
  }
};

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
  const dm = World.detailMode || 'high';
  if (dm !== 'min') FLAME_TIME.value = t;
  if (dm !== 'min' && dm !== 'low') {
    const emitEmbers = (dm === 'high' || dm === 'ultra') && World.onFlameEmber;
    const baseEmberChance = (dm === 'ultra' ? 2.4 : 1.0) * dt;
    const vx = World.viewerX || 0, vz = World.viewerZ || 0;
    if (emitEmbers) {
      for (const f of World.flames) {
        if (f.chunk && !f.chunk.active) continue;
        const sc = f.s || 1;
        const dx = f.g.position.x - vx, dz = f.g.position.z - vz;
        const maxDist = 42 + sc * 8;
        if (dx * dx + dz * dz < maxDist * maxDist && Math.random() < baseEmberChance * Math.min(2.8, 0.7 + sc * 0.45)) {
          World.onFlameEmber(f.g.position.x, f.g.position.y + 0.75 * sc, f.g.position.z, sc);
        }
      }
    }
  }
  for (const id in World.gates) {
    const g = World.gates[id];
    if (g.open && g.t < 1) {
      g.t = Math.min(1, g.t + dt * (g.style === 'door' ? 0.75 : 1.2));
      if (g.style === 'barrier') g.grp.scale.y = Math.max(0.001, 1 - g.t);
      else if (g.debris) {
        const tm = g.t * 1.35;
        for (let i = 0; i < g.debris.length; i++) {
          const d = g.debris[i];
          d.m.position.set(
            d.x0 + d.vx * tm,
            Math.max(0.25, d.y0 + d.vy * tm - 11.5 * tm * tm),
            d.z0 + d.vz * tm
          );
          d.m.rotation.set(d.rx * tm, d.ry * tm, d.rz * tm);
          if (g.t >= 1) d.m.visible = false;
        }
      } else g.grp.rotation.x = -g.t * g.t * (Math.PI / 2) * 0.98;
      if (g.t >= 1 && g.style === 'barrier') g.grp.visible = false;
    } else if (!g.open && g.style === 'barrier') {
      g.grp.children[0].material.opacity = 0.3 + Math.sin(t * 5) * 0.08;
    }
  }
  if (World.exitGate) {
    const eg = World.exitGate;
    if (!eg.unlocked) {
      eg.lockPl.material.opacity = 0.35 + Math.sin(t * 6) * 0.12;
      if (eg.leftLeaf && eg.rightLeaf) {
        eg.gateOpen = Math.max(0, (eg.gateOpen || 0) - dt * 2.2);
        eg.leftLeaf.rotation.y = -eg.gateOpen * 0.85;
        eg.rightLeaf.rotation.y = eg.gateOpen * 0.85;
      }
    } else {
      eg.openPl.material.opacity = 0.22 + Math.sin(t * 6) * 0.09;
      if (eg.beam && eg.beam.material) {
        eg.beam.material.opacity = 0.22 + Math.sin(t * 3.5) * 0.06;
      }
      eg.ring.rotation.z += dt * 2.4;
      const sc = 1 + Math.sin(t * 4.5) * 0.08;
      eg.ring.scale.set(sc, sc, 1);
      if (eg.leftLeaf && eg.rightLeaf) {
        const vx = World.viewerX || 0, vz = World.viewerZ || 0;
        const d = Math.hypot(vx - eg.x, vz - eg.z);
        const targetOpen = d < 13.5 ? Math.min(1, (13.5 - d) / 7.5) : 0;
        eg.gateOpen = (eg.gateOpen || 0) + (targetOpen - (eg.gateOpen || 0)) * Math.min(1, dt * 4.2);
        eg.leftLeaf.rotation.y = -eg.gateOpen * 0.85;
        eg.rightLeaf.rotation.y = eg.gateOpen * 0.85;
      }
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
