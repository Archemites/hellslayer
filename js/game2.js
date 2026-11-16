'use strict';
/* ============================================================
   HELLSLAYER BETA 1 - parte 2: jogador, armas, HUD, história
   ============================================================ */
(function () {
  const { P, S, WEAPONS, enemies, scene, camera, renderer, parts, projs, rings, vmScene, vmCam, VMS } = window.__HS;
  const A = window.__HSAPI;
  const { $, rnd, clamp, V3, resolveCircle, burst, spawnRing, spawnProj, hurtPlayer, dmgEnemy, killEnemy, addFaith, AMMO_MAX, keys, wcd } = A;
  let mouseL = false, mouseR = false, nolock = false;
  const curW = () => A.curW();

  /* ---------------- util ---------------- */
  const ELS = {};
  function el(id) { return ELS[id] || (ELS[id] = $(id)); }
  function setText(id, v) { const e = el(id); if (e.__v !== v) { e.__v = v; e.textContent = v; } }
  function setW(id, pct) { const e = el(id); const v = Math.round(pct * 10) / 10; if (e.__w !== v) { e.__w = v; e.style.width = v + '%'; } }
  function show(id, on) { el(id).classList.toggle('hidden', !on); }
  function fwd3() {
    const cp = Math.cos(P.pitch);
    return new V3(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp);
  }
  function eyePos() { return new V3(P.pos.x, P.pos.y + P.eye, P.pos.z); }
  function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

  /* ---------------- mensagens ---------------- */
  function say(text, who, dur) {
    el('msgWho').textContent = who ? who + ':' : '';
    el('msgText').textContent = text;
    show('msg', true);
    S.msgT = dur || 3;
  }
  function baph(text, dur) {
    el('baph').textContent = text; show('baph', true); S.baphT = dur || 5;
    SFX.play('roar');
  }
  const QUIPS = ['O alicerce do inferno tá fofo.', 'Amém… e AMASSOU.', 'Isso aqui é obra de Deus!', 'Vou rebocar essa tua cara!', 'Desceu pelo ralo, capeta.', 'Super-Fé na marreta!', 'Cimento e oração!', 'Me aguarda, Testus.', 'Hoje o inferno ganha uma reforma.', 'Trabalho bem feito.'];
  function quip() {
    if (S.quipCd > 0 || Math.random() > 0.2) return;
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
      part(g, 0.55, 0.12, 0.55, 0xf4f0e0, 0, 0, 0);
      part(g, 0.12, 0.16, 0.34, 0xcc2020, 0, 0, 0, { basic: true });
      part(g, 0.34, 0.16, 0.12, 0xcc2020, 0, 0, 0, { basic: true });
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
    const y0 = y != null ? y : 0.9;
    g.position.set(x, y0, z);
    scene.add(g);
    pickups.push({ k, id, g, x, z, y0, t: Math.random() * 6, life: k === 'weapon' ? 1e9 : 40 });
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
  function collect(p) {
    if (p.k === 'host') { if (P.hp >= P.maxhp) return false; P.hp = Math.min(P.maxhp, P.hp + 30); SFX.play('pickup'); P.healFlash = 0.3; return true; }
    if (p.k === 'rocks') { if (P.rocks >= AMMO_MAX.rocks) return false; P.rocks = Math.min(AMMO_MAX.rocks, P.rocks + 10); SFX.play('pickup'); return true; }
    if (p.k === 'vial') { if (P.blood >= AMMO_MAX.blood) return false; P.blood = Math.min(AMMO_MAX.blood, P.blood + 25); SFX.play('pickup'); return true; }
    if (p.k === 'weapon') {
      const idx = WEAPONS.findIndex(w => w.id === p.id);
      WEAPONS[idx].owned = true;
      if (p.id === 'sling') P.rocks = Math.max(P.rocks, 25);
      SFX.play('weapon');
      selectWeapon(idx, true);
      const msg = { sling: 'FUNDA encontrada! Pedras são munição. [3]', scythe: 'FOICE encontrada! Acerta vários inimigos. [4]', demo: 'MARTELO DE DEMOLIÇÃO! Duas mãos, dano em área. [5]' }[p.id];
      say(msg, '', 4);
      updateSlots();
      return true;
    }
    return false;
  }
  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.t += dt; p.life -= dt;
      p.g.rotation.y += dt * 2;
      p.g.position.y = p.y0 + Math.sin(p.t * 3) * 0.15;
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

  function meleeAttack(w, silent) {
    const f = fwd3(), eye = eyePos();
    const cand = [];
    for (const e of enemies) {
      if (e.dead || e.downed) continue;
      const c = new V3(e.g.position.x, e.g.position.y + e.h * 0.5, e.g.position.z);
      const v = c.clone().sub(eye);
      const d = v.length();
      if (d - e.r * 0.85 > w.range) continue;
      const dot = v.dot(f) / d;
      const cosEff = d < e.r + 1.6 ? -1 : w.cos - e.r * 0.06;
      if (dot < cosEff) continue;
      if (!A.los(eye.x, eye.z, c.x, c.z) && d > e.r + 1.2) continue;
      cand.push({ e, d, v });
    }
    cand.sort((a, b) => a.d - b.d);
    const maxHits = w.sweep ? 99 : (w.id === 'fists' ? 1 : 2);
    let hits = 0;
    for (const c of cand) {
      if (hits >= maxHits) break;
      const l = Math.hypot(c.v.x, c.v.z) || 1;
      dmgEnemy(c.e, w.dmg, c.v.x / l, c.v.z / l, { knock: w.knock, hitSfx: w.hitSfx || (w.id === 'scythe' ? 'cut' : w.id === 'cross' ? 'cross' : 'general') });
      hits++;
    }
    if (hits > 0) {
      P.shake = Math.max(P.shake, 0.12 + (w.dmg > 30 ? 0.12 : 0));
      S.hitStop = 0.035;
      const eyeF = eye.clone().addScaledVector(f, Math.min(3, w.range * 0.7));
      burst(eyeF.x, eyeF.y, eyeF.z, 0xffd060, 4, 5, 0.25, 0.12, 8);
    } else if (!silent) SFX.play('swing');
    return hits;
  }

  function demoSlam(w) {
    const f = fwd3();
    const fl = new V3(f.x, 0, f.z).normalize();
    P.vel.x += fl.x * 11; P.vel.z += fl.z * 11;
    const cx = P.pos.x + fl.x * 3.8, cz = P.pos.z + fl.z * 3.8;
    let hits = 0;
    for (const e of enemies) {
      if (e.dead || e.downed) continue;
      const ep = e.g.position;
      const d = dist2(cx, cz, ep.x, ep.z);
      if (d > w.aoe + e.r || ep.y > 4.5) continue;
      const l = d || 1;
      dmgEnemy(e, w.dmg * (1 - 0.45 * clamp(d / (w.aoe + e.r), 0, 1)), (ep.x - cx) / l, (ep.z - cz) / l, { knock: 18, stunBonus: 0.45 });
      hits++;
    }
    spawnRing(cx, cz, w.aoe + 3.5, 26, 0, 0xffa040, 'p');
    burst(cx, 0.5, cz, 0x7a6a5a, 24, 10, 0.8, 0.35, 16, false);
    burst(cx, 0.8, cz, 0xffc060, 12, 9, 0.4, 0.2, 10);
    P.shake = Math.max(P.shake, 0.75);
    SFX.play('boom');
    S.hitStop = hits ? 0.075 : 0.025;
  }

  function throwCross() {
    const c = S.cross;
    c.state = 'out'; c.t = 0;
    c.dir.copy(fwd3());
    c.pos.copy(eyePos()).addScaledVector(c.dir, 1.2);
    c.mesh = buildThrownCross();
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
    if (c.state === 'out') {
      c.pos.addScaledVector(c.dir, 52 * dt);
      if (c.t > 0.55 || A.pointInWall(c.pos.x, c.pos.z) || c.pos.y < 0.3) {
        c.state = 'back'; burst(c.pos.x, c.pos.y, c.pos.z, 0xffe080, 6, 6, 0.3, 0.14, 6);
      }
    } else {
      const tgt = eyePos(); tgt.y -= 0.5;
      const d = tgt.clone().sub(c.pos);
      const L = d.length();
      if (L < 1.7) { crossRemove(); SFX.play('catchCross'); return; }
      c.pos.addScaledVector(d.normalize(), (55 + c.t * 25) * dt);
    }
    c.mesh.position.copy(c.pos);
    for (const e of enemies) {
      if (e.dead || e.downed) continue;
      const ec = new V3(e.g.position.x, e.g.position.y + e.h * 0.5, e.g.position.z);
      if (ec.distanceTo(c.pos) < 1.7 + e.r * 0.9) {
        const last = c.hitT.get(e) || -1;
        if (c.t - last > 0.18) {
          c.hitT.set(e, c.t);
          dmgEnemy(e, WEAPONS[5].dmg, c.dir.x, c.dir.z, { knock: 2, hitSfx: 'cross' });
        }
      }
    }
  }

  function attack(w) {
    const cdMul = P.faithMode > 0 ? 0.7 : 1;
    switch (w.id) {
      case 'fists':
      case 'hammer':
      case 'scythe':
        startSwing(w); if (w.id === 'fists') P.hand ^= 1;
        P.pending = { t: w.hitAt, fn: () => meleeAttack(w) };
        break;
      case 'demo':
        startSwing(w);
        P.pending = { t: w.hitAt, fn: () => demoSlam(w) };
        break;
      case 'sling': {
        if (P.rocks <= 0) { wcd[w.id] = 0.25; SFX.play('ui'); S.ammoFlash = 0.4; return; }
        P.rocks--; startSwing(w);
        const f = fwd3(), o = eyePos().addScaledVector(f, 0.8);
        o.x += Math.cos(P.yaw) * 0.25; o.z += -Math.sin(P.yaw) * 0.25; o.y -= 0.2;
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
        const f = fwd3();
        f.x += rnd(-0.015, 0.015); f.y += rnd(-0.015, 0.015); f.z += rnd(-0.015, 0.015); f.normalize();
        const o = eyePos().addScaledVector(f, 0.9); o.y -= 0.15;
        spawnProj('blood', o, f.multiplyScalar(62), w.dmg, 'p', 0.4, 1.6, 0);
        SFX.play('blood');
        break;
      }
    }
    wcd[w.id] = w.cd * cdMul;
  }
  function doParry() {
    const f = fwd3(), eye = eyePos();
    let parried = 0;
    // 1) Rebater projéteis inimigos próximos
    for (const p of projs) {
      if (p.owner !== 'e') continue;
      const d = p.m.position.distanceTo(eye);
      if (d < 5.0) {
        p.owner = 'p';
        p.parried = true;
        p.dmg = p.dmg * 3.5 + 35;
        p.life = 3.5;
        p.r = 0.55;
        p.v.copy(f).multiplyScalar(78);
        burst(p.m.position.x, p.m.position.y, p.m.position.z, 0xffe060, 14, 9, 0.4, 0.18, 8);
        parried++;
      }
    }
    // 2) Interromper inimigos em windup melee/charge à frente
    for (const e of enemies) {
      if (e.dead || e.downed) continue;
      const c = new V3(e.g.position.x, e.g.position.y + e.h * 0.5, e.g.position.z);
      const v = c.clone().sub(eye);
      const d = v.length();
      if (d < 4.5 + e.r && (e.state === 'wind' || e.state === 'chargeWind' || e.state === 'charge')) {
        e.state = 'move'; e.stun = 1.2; e.cd = 1.2;
        dmgEnemy(e, 34, f.x, f.z, { knock: 12, stunBonus: 0.8 });
        parried++;
      }
    }
    if (parried > 0) {
      SFX.play('parry');
      S.hitStop = 0.075;
      P.shake = Math.max(P.shake, 0.5);
      P.hp = Math.min(P.maxhp, P.hp + 15);
      addFaith(12);
      S.style = Math.min(420, S.style + 40);
      el('flash').style.background = '#ffe080'; P.flashV = 0.45;
      say('PARRY DE PEDREIRO! (+15 VIDA / +FÉ)', '', 1.6);
    } else {
      meleeAttack({ range: 3.8, dmg: 22, cos: 0.4, knock: 11, sfx: 'punch', id: 'fists' });
    }
  }

  function altAttack() {
    const w = WEAPONS[curW()];
    const cdMul = P.faithMode > 0 ? 0.7 : 1;
    if (wcd.alt > 0 || P.swapT >= 0.45) return;

    if (w.id === 'fists') {
      wcd.alt = 0.55 * cdMul;
      P.hand ^= 1;
      P.swingDur = 0.24; P.swingT = 0.24;
      doParry();
      return;
    }
    if (w.id === 'hammer') {
      wcd.alt = 1.35 * cdMul;
      P.swingDur = 0.35; P.swingT = 0.35;
      const f = fwd3(), o = eyePos().addScaledVector(f, 0.85); o.y -= 0.15;
      spawnProj('brick', o, f.clone().multiplyScalar(54), 44, 'p', 0.38, 2.2, 9);
      SFX.play('brick');
      return;
    }
    if (w.id === 'sling') {
      if (P.rocks < 3) { wcd.alt = 0.3; SFX.play('ui'); S.ammoFlash = 0.4; return; }
      P.rocks -= 3;
      wcd.alt = 0.95 * cdMul;
      P.swingDur = 0.35; P.swingT = 0.35;
      const f = fwd3(), o = eyePos().addScaledVector(f, 0.85); o.y -= 0.15;
      spawnProj('boulder', o, f.clone().multiplyScalar(68), 68, 'p', 0.48, 2.4, 5);
      P.shake = Math.max(P.shake, 0.22);
      SFX.play('sling'); SFX.play('hammer');
      return;
    }
    if (w.id === 'scythe') {
      wcd.alt = 1.15 * cdMul;
      P.swingDur = 0.48; P.swingT = 0.48;
      P.pending = { t: 0.16, fn: () => {
        const hits = meleeAttack({ range: 7.2, dmg: 38, cos: -0.35, knock: -10, sweep: true, sfx: 'scythe', id: 'scythe' });
        if (hits > 0 && WEAPONS[6].owned) P.blood = Math.min(AMMO_MAX.blood, P.blood + hits * 8);
      } };
      return;
    }
    if (w.id === 'demo') {
      wcd.alt = 2.0 * cdMul;
      P.swingDur = 0.85; P.swingT = 0.85;
      P.pending = { t: 0.4, fn: () => {
        demoSlam(w);
        const f = fwd3(), fl = new V3(f.x, 0, f.z).normalize();
        for (let step = 1; step <= 2; step++) {
          const sx = P.pos.x + fl.x * (3.8 + step * 5.2), sz = P.pos.z + fl.z * (3.8 + step * 5.2);
          later(step * 0.12, () => {
            spawnRing(sx, sz, 5.5, 22, 0, 0xff6020, 'p');
            burst(sx, 0.4, sz, 0xffa040, 10, 8, 0.45, 0.22, 12);
            for (const e of enemies) {
              if (!e.dead && !e.downed && dist2(sx, sz, e.g.position.x, e.g.position.z) < 4.8 + e.r) {
                dmgEnemy(e, 65, fl.x, fl.z, { knock: 12, stunBonus: 0.4 });
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
      const baseF = fwd3(), o = eyePos().addScaledVector(baseF, 0.9); o.y -= 0.15;
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
    if (P.swapT > 0) P.swapT = Math.max(0, P.swapT - dt * 5);
    if (P.pending) { P.pending.t -= dt; if (P.pending.t <= 0) { const f = P.pending.fn; P.pending = null; f(); } }
    if (P.dead || S.cutscene > 0) return;
    const w = WEAPONS[curW()];
    if (mouseL && wcd[w.id] <= 0 && P.swapT < 0.45) attack(w);
    if (mouseR) altAttack();
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
  function updateVM(dt) {
    for (const k in VMS) VMS[k].root.visible = false;
    const w = WEAPONS[curW()], vm = VMS[w.vm];
    vm.root.visible = !(w.id === 'cross' && S.cross.state !== 'held');
    const moveAmt = Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 8) * (P.onGround ? 1 : 0.2);
    const bx = Math.sin(P.bob) * 0.015 * moveAmt, by = Math.abs(Math.cos(P.bob)) * 0.015 * moveAmt - P.swapT * 0.55;
    const sw = P.swingT > 0, a = sw ? 1 - P.swingT / P.swingDur : 0, s = Math.sin(a * Math.PI);
    if (w.id === 'fists') {
      [vm.handL, vm.handR].forEach((h, i) => {
        const b = h.userData.base, active = sw && P.hand === i;
        const side = i ? 1 : -1;
        h.position.set(b.x + bx * side - (active ? side * s * 0.18 : 0), b.y + by + (active ? s * 0.06 : 0), b.z - (active ? s * 0.6 : 0));
        h.rotation.set(active ? -s * 0.25 : 0, active ? -side * s * 0.35 : 0, 0);
      });
      return;
    }
    const b = vm.root.userData.base, r = vm.root;
    r.position.copy(b.p); r.rotation.copy(b.r);
    r.position.x += bx; r.position.y += by;
    switch (w.id) {
      case 'hammer': r.rotation.x += curve(a, 0.9, -1.3); r.position.z -= sw ? s * 0.25 : 0; break;
      case 'demo': r.rotation.x += curve(a, 1.0, -1.45); r.position.y += sw ? Math.sin(Math.min(1, a / 0.4) * Math.PI) * 0.15 : 0; r.position.z -= sw ? s * 0.3 : 0; break;
      case 'scythe': r.rotation.y += sw ? 0.9 - a * 2.4 : 0; r.rotation.z += sw ? -s * 0.4 : 0; r.position.x += sw ? (0.5 - a) * 0.4 : 0; break;
      case 'sling': r.position.z += sw ? s * 0.12 : 0; r.rotation.x += sw ? s * 0.35 : 0; break;
      case 'cross': r.position.z -= sw ? s * 0.4 : 0; r.rotation.x -= sw ? s * 0.4 : 0; break;
      case 'heart': {
        const pulse = 1 + 0.12 * Math.sin(S.time * 8) + (sw ? s * 0.2 : 0);
        vm.root.heart.scale.setScalar(pulse); r.position.z += sw ? s * 0.07 : 0; break;
      }
    }
  }

  /* ---------------- HUD: slots / face / radar ---------------- */
  function buildSlots() {
    const box = el('slots'); box.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const d = document.createElement('div'); d.className = 'slot'; d.id = 'slot' + i;
      d.innerHTML = '<b>' + (i + 1) + '</b><span>' + w.short + '</span>';
      box.appendChild(d);
    });
  }
  function updateSlots() {
    WEAPONS.forEach((w, i) => {
      const d = el('slot' + i);
      d.classList.toggle('owned', !!w.owned);
      d.classList.toggle('active', i === curW());
    });
  }

  let faceKey = '';
  function drawFace() {
    const lvl = P.hp > 133 ? 0 : P.hp > 66 ? 1 : P.hp > 30 ? 2 : 3;
    const fm = P.faithMode > 0 ? 1 : 0, grin = S.grin > 0 ? 1 : 0, hurt = P.hurtFlash > 0.25 ? 1 : 0;
    const key = lvl + '' + fm + grin + hurt + (P.dead ? 'd' : '');
    if (key === faceKey) return;
    faceKey = key;
    const c = el('face').getContext('2d');
    c.clearRect(0, 0, 24, 24);
    c.fillStyle = fm ? '#5a3a08' : '#2a0a08'; c.fillRect(0, 0, 24, 24);
    c.fillStyle = '#5a3820'; c.fillRect(5, 3, 14, 18); c.fillRect(4, 6, 16, 12); c.fillRect(6, 20, 12, 2);
    c.fillStyle = '#6e4628'; c.fillRect(6, 4, 12, 3);
    c.fillStyle = '#4a2c18'; c.fillRect(3, 9, 2, 5); c.fillRect(19, 9, 2, 5);
    c.fillStyle = '#1a0c06';
    c.fillRect(6, 8, 5, 1); c.fillRect(7, 9, 4, 1); c.fillRect(13, 8, 5, 1); c.fillRect(13, 9, 4, 1);
    c.fillStyle = fm ? '#ffe060' : '#f0e6d0';
    if (lvl >= 2) { c.fillRect(14, 10, 3, 2); c.fillStyle = '#1a0c06'; c.fillRect(7, 11, 3, 1); }
    else { c.fillRect(7, 10, 3, 2); c.fillRect(14, 10, 3, 2); }
    c.fillStyle = '#000'; if (lvl < 2) c.fillRect(8, 10, 1, 2); c.fillRect(15, 10, 1, 2);
    c.fillStyle = '#3c2010'; c.fillRect(11, 12, 2, 4); c.fillRect(10, 15, 4, 1);
    c.fillStyle = '#1a0806'; c.fillRect(8, 17, 8, hurt || grin ? 3 : 1);
    c.fillStyle = '#f0e6d0'; if (grin || hurt) { c.fillRect(9, 17, 6, 1); } else c.fillRect(9, 17, 6, 1);
    c.fillStyle = '#a01010';
    if (lvl >= 1) { c.fillRect(6, 5, 1, 5); c.fillRect(7, 8, 1, 2); }
    if (lvl >= 2) { c.fillRect(16, 4, 2, 6); c.fillRect(12, 18, 3, 3); c.fillRect(5, 12, 2, 3); }
    if (lvl >= 3) { c.fillRect(8, 3, 8, 2); c.fillRect(4, 14, 3, 6); c.fillRect(17, 13, 3, 6); c.fillStyle = '#600808'; c.fillRect(9, 12, 2, 3); }
    if (P.dead) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, 24, 24); }
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
      if (e.dead) continue;
      const q = proj(e.g.position.x, e.g.position.z);
      const rx = q[0] * sc, ry = -q[1] * sc * -1;
      const px = q[0], py = q[1];
      if (Math.hypot(px, py) > range) continue;
      c.fillStyle = e.T.boss ? '#ff8a00' : (e.aggro ? '#ff2a2a' : '#a02020');
      const sz = e.T.boss ? 6 : 3;
      c.fillRect(R + px * sc - sz / 2, R + py * sc - sz / 2, sz, sz);
    }
    for (const p of pickups) {
      if (p.k !== 'weapon') continue;
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

  function updateHUD(dt) {
    const w = WEAPONS[curW()];
    setText('hpNum', Math.ceil(P.hp));
    setW('hpFill', P.hp / P.maxhp * 100);
    el('hpFill').style.background = P.hp < 50 ? 'linear-gradient(#ff5050,#a00000)' : '';
    setW('faithFill', P.faith);
    setText('faithTxt', P.faithMode > 0 ? 'SUPER-FÉ!' : (P.faith >= 100 ? '[Q] PRONTA' : Math.floor(P.faith) + '%'));
    setW('dashFill', (1 - clamp(P.dashCd / 1.1, 0, 1)) * 100);
    setText('weaponName', w.name);
    let am = '∞', al = 'DIR: PARRY DE PROJÉTIL';
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
    // objetivo
    let obj = S.objText;
    if (S.objRoom && S.rooms[S.objRoom] && S.rooms[S.objRoom].spawned && !S.rooms[S.objRoom].cleared && !ROOMS[S.objRoom].noCount) {
      obj += '  (' + A.aliveInRoom(S.objRoom) + ' restantes)';
    }
    setText('objective', obj);
    // chefe
    const b = S.boss;
    if (b && enemies.includes(b) && !b.dead) {
      show('bossbar', true);
      setText('bossName', b.T.name);
      setW('bossFill', clamp(b.hp / b.maxhp, 0, 1) * 100);
    } else show('bossbar', false);
    // overlays
    const low = P.hp < 50 && !P.dead ? 0.25 + Math.sin(S.time * 6) * 0.1 : 0;
    el('damage').style.opacity = clamp(P.hurtFlash + low, 0, 1);
    el('faithTint').style.opacity = P.faithMode > 0 ? 0.7 + Math.sin(S.time * 10) * 0.15 : 0;
    el('hitmarker').classList.toggle('on', S.hitMark > 0);
    if (S.msgT <= 0) show('msg', false);
    if (S.baphT <= 0) show('baph', false);
    if (S.prompt) { show('prompt', true); setText('prompt', S.prompt); } else show('prompt', false);
    drawFace();
    drawRadar();
  }

  /* ---------------- salas / história ---------------- */
  const ROOMS = {
    a1: { name: 'EP. 1 · ÁREA 1 · BAIRRO ALTO', obj: 'Elimine todos os demônios do Bairro Alto',
      onClear() {
        unlockExitGate(); SFX.play('gate');
        say('Bairro Alto purificado! Atravesse o Portão de Saída!', 'NIVALDO', 4.5);
        setObj('Atravesse o Portão de Saída para os Campos da Perdição', { x: World.exitGate.x, z: World.exitGate.z });
        S.stage = 'a1done';
      } },
    a2: { name: 'EP. 1 · ÁREA 2 · CAMPOS DA PERDIÇÃO', obj: 'Limpe os campos e celeiros em chamas',
      onClear() {
        unlockExitGate(); SFX.play('gate');
        say('Campos purificados! O Portão para o Subúrbio Exterior está aberto!', 'NIVALDO', 4.5);
        setObj('Atravesse o Portão de Saída para o Subúrbio Exterior', { x: World.exitGate.x, z: World.exitGate.z });
        S.stage = 'a2done';
      } },
    a3: { name: 'EP. 1 · ÁREA 3 · SUBÚRBIO EXTERIOR', obj: 'Elimine os demônios e guardas do Subúrbio',
      onClear() {
        unlockExitGate(); SFX.play('gate');
        say('Episódio 1 concluído! Atravesse o Portão rumo à Cidade Baixa!', 'NIVALDO', 4.5);
        setObj('Atravesse o Portão de Saída para os Casarões dos Super-Ricos', { x: World.exitGate.x, z: World.exitGate.z });
        S.stage = 'a3done';
      } },
    a4: { name: 'EP. 2 · ÁREA 4 · CASARÕES DOS SUPER-RICOS', obj: 'Elimine os demônios das mansões em chamas',
      onClear() {
        unlockExitGate(); SFX.play('gate');
        say('Mansões purificadas! O Portão para a Avenida do Horror se abriu!', 'NIVALDO', 4.5);
        setObj('Atravesse o Portão de Saída para a Avenida do Horror', { x: World.exitGate.x, z: World.exitGate.z });
        S.stage = 'a4done';
      } },
    a5: { name: 'EP. 2 · ÁREA 5 · AVENIDA DO HORROR', obj: 'Rompa os ninhos infernais rumo à Ultra-Igreja',
      onClear() {
        unlockExitGate(); SFX.play('gate');
        say('Episódio 2 concluído! A Ultra-Igreja aguarda além do Portão!', 'NIVALDO', 4.5);
        setObj('Atravesse o Portão de Saída para os Portões da Ultra-Igreja', { x: World.exitGate.x, z: World.exitGate.z });
        S.stage = 'a5done';
      } },
    a6_gate: { name: 'EP. 3 · ÁREA 6 · PORTÕES DA ULTRA-IGREJA', obj: 'Derrote a guarda e MAXIMUS nos portões', noCount: true, onClear: maximusDead },
    a6_nave: { name: 'EP. 3 · ÁREA 6 · A ULTRA-IGREJA', obj: 'Esmigalhe os demônios da Ultra-Igreja', onClear: galiusEvent },
    a6_galius1: { name: 'EP. 3 · ÁREA 6 · A ULTRA-IGREJA', obj: 'Galius é forte demais! Desça pela ESCADARIA NO ALTAR!', noCount: true, noClear: true },
    a6_crypt1: { name: 'EP. 3 · CATACUMBAS · ENTRADA', obj: 'Elimine os endemoniados das catacumbas',
      onClear() { openGate('g_c1'); SFX.play('gate'); setObj('Avance para o Salão dos Mortos', { x: 58, z: -14 }); } },
    a6_crypt2: { name: 'EP. 3 · CATACUMBAS · SALÃO DOS MORTOS', obj: 'Elimine os guardiões do Salão dos Mortos',
      onClear() { openGate('g_c2'); SFX.play('gate'); setObj('Avance para a Galeria dos Ossos', { x: 58, z: -76 }); } },
    a6_crypt3: { name: 'EP. 3 · CATACUMBAS · GALERIA DOS OSSOS', obj: 'Elimine os horrores da Galeria dos Ossos',
      onClear() { openGate('g_c3'); SFX.play('gate'); setObj('Chegue à Câmara Sacra', { x: -4, z: -86 }); } },
    a6_galius2: { name: 'EP. 3 · ÁREA 6 · A ULTRA-IGREJA', obj: 'Derrote Galius com a Sacra Cruz Papal', noCount: true, noClear: true }
  };
  for (const id in ROOMS) S.rooms[id] = { spawned: false, cleared: false };

  function startRoom(id, silent) {
    const r = S.rooms[id];
    r.spawned = true; r.cleared = false;
    const list = SPAWNS[id] || [];
    for (const sp of list) {
      const e = A.spawnEnemy(sp[0], sp[1], sp[2], id, sp[3]);
      if (e.T.boss) S.boss = e;
      if (!ROOMS[id].noCount) S.levelTotal = (S.levelTotal || 0) + 1;
    }
    S.objRoom = id;
    el('areaName').textContent = ROOMS[id].name;
    if (!silent) setObj(ROOMS[id].obj, null);
    else setObj(ROOMS[id].obj, S.objPos);
  }
  function loadMap(mapId, opts) {
    opts = opts || {};
    for (const e of enemies.slice()) A.removeEnemy(e);
    A.clearProjs(); A.clearParts();
    S.boss = null;
    for (const id in S.rooms) S.rooms[id] = { spawned: false, cleared: false };
    buildMap(mapId);
    spawnMapPickups(mapId);
    if (!opts.keepPlayer) {
      P.hp = P.maxhp; P.faith = 0; P.faithMode = 0; P.rocks = 0; P.blood = 0;
      WEAPONS.forEach((w, i) => w.owned = i < 2);
      updateSlots(); selectWeapon(0, true);
    }
    S.levelKills = 0;
    S.levelTotal = 0;
    S.levelTime = 0;
    S.levelPeakStyle = 0;
    const sx = opts.x != null ? opts.x : 0;
    const sz = opts.z != null ? opts.z : 10;
    P.pos.set(sx, 0, sz); P.vel.set(0, 0, 0); P.yaw = opts.yaw || 0; P.pitch = 0;
    resetCamera();
    const firstRoom = opts.room || (mapId === 'a6_crypt' ? 'a6_crypt1' : mapId);
    if (ROOMS[firstRoom]) startRoom(firstRoom);
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
    const kills = Math.min(total, S.levelKills || total);
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
        faith: Math.round(P.faith),
        rocks: P.rocks,
        blood: P.blood,
        curW: curW(),
        owned: WEAPONS.map(w => !!w.owned),
        cleared: Object.keys(S.rooms).filter(k => S.rooms[k].cleared),
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
            const d = dist2(P.pos.x, P.pos.z, e.g.position.x, e.g.position.z);
            if (d < bestD) { bestD = d; nearest = e; }
          }
        }
        if (nearest) S.objPos = { x: nearest.g.position.x, z: nearest.g.position.z };
      }
    }
  }

  function maximusDead() {
    S.boss = null;
    S.stage = 'door';
    SFX.play('boom');
    say('Maximus esmigalhado. Agora, o aríete…', 'NIVALDO', 3);
    S.cutscene = 2.2 + Math.max(0, P.pos.z + 165.5) / 9; S.csKind = 'door'; S.csT = 0; S.csHit = false;
    S.corpse = BUILD.maximus().root;
    S.corpse.rotation.x = -Math.PI / 2;
    scene.add(S.corpse);
    setObj('Arrombe a porta da Ultra-Igreja', { x: 0, z: -169 });
  }

  function updateCutscene(dt) {
    if (S.cutscene <= 0) return;
    S.cutscene -= dt; S.csT += dt;
    if (S.csKind === 'door') {
      const targetZ = -165.5;
      if (P.pos.z > targetZ && S.csT > 0.6) {
        P.vel.z = -10; P.vel.x = -P.pos.x * 2;
      } else { P.vel.x *= 0.8; P.vel.z *= 0.8; }
      P.yaw = A.lerpAngle(P.yaw, 0, Math.min(1, dt * 5));
      P.pitch += (0 - P.pitch) * Math.min(1, dt * 5);
      if (S.corpse) S.corpse.position.set(P.pos.x, P.pos.y + 1.6, P.pos.z + 1.0);
      P.shake = Math.max(P.shake, 0.1);
      if (!S.csHit && (P.pos.z < -164.2 || S.cutscene <= 0)) {
        S.csHit = true;
        openGate('door'); SFX.play('door');
        P.shake = 1.2;
        burst(0, 5, -169, 0x6a5a4a, 40, 14, 1.2, 0.5, 14, false);
        burst(0, 5, -169, 0xffa040, 12, 10, 0.5, 0.2, 8);
        say('A Ultra-Igreja está aberta! Entre no santuário!', 'NIVALDO', 3);
        setObj('Entre na Ultra-Igreja', { x: 0, z: -176 });
        later(0.8, () => { if (S.corpse) { scene.remove(S.corpse); S.corpse = null; } });
      }
      if (S.cutscene <= 0 && S.corpse) { scene.remove(S.corpse); S.corpse = null; }
    }
  }

  function galiusEvent() {
    S.stage = 'galius1';
    baph('“JAMAIS PODERÁ DERROTAR MINHA CRIAÇÃO, GALIUS, O SUPER-ATEU! DESISTA NIVALDO VOCÊ NÃO TEM CHANCE! MORRA AGORA!”', 7);
    const bw = World.breakWall;
    bw.visible = false; bw.userData.col.active = false;
    burst(-28, 6, -102, 0x55506a, 50, 16, 1.4, 0.7, 14, false);
    burst(-28, 6, -102, 0xffa040, 14, 12, 0.6, 0.25, 8);
    P.shake = 1.4; SFX.play('boom');
    World.altarCross.visible = false;
    openAltar();
    SFX.play('gate');
    burst(0, 1.2, -142, 0x6a5a5a, 32, 10, 1.1, 0.4, 14, false);
    P.vel.x += 22; P.vel.y = 6; P.onGround = false;
    hurtPlayer(20, -30, -102, 0);
    startRoom('a6_galius1');
    setObj(ROOMS.a6_galius1.obj, { x: World.hatch.x, z: World.hatch.z });
    setCheckpoint(0, -24, 0);
    later(2.5, () => say('Nem cócegas! Essa coisa é imune a martelo… o altar se abriu no meio!', 'NIVALDO', 4));
    SFX.setIntensity(1);
  }

  function goCrypt() {
    S.stage = 'crypt';
    fade('#000', 0.5, () => {
      loadMap('a6_crypt', { keepPlayer: true, x: 0, z: -4, room: 'a6_crypt1' });
      S.rooms.a6_galius1.cleared = true;
      say('Catacumbas… o Super-Papa Romulus III está enterrado por aqui.', 'NIVALDO', 4);
      SFX.setIntensity(0.4);
    });
  }

  function tombSequence() {
    S.cutscene = 9; S.csKind = 'tomb'; S.csT = 0;
    say('Super-Papa Romulus… permita que eu empunhe sua relíquia.', 'NIVALDO', 3);
    later(3.2, () => { SFX.play('ghost'); say('Leve-a, filho. Que a Super-Fé guie seu braço.', 'ROMULUS III', 3.2); });
    later(6.2, () => {
      WEAPONS[5].owned = true; S.hasCross = true; World.crossPickup.visible = false;
      SFX.play('weapon'); updateSlots();
      say('SACRA CRUZ PAPAL adquirida! [6] · Clique: arremessar · Botão dir.: golpe/recall', '', 4.5);
      selectWeapon(5, true);
      P.shake = 1.2; SFX.play('boom');
      burst(-4, 8, -86, 0x6a5a4a, 40, 14, 1.4, 0.6, 14, false);
    });
    later(8, () => {
      fade('#fff', 0.5, () => {
        loadMap('a6_nave', { keepPlayer: true, x: 0, z: -24, room: 'a6_galius2' });
        if (World.breakWall) { World.breakWall.visible = false; World.breakWall.userData.col.active = false; }
        if (World.altarCross) World.altarCross.visible = false;
        closeAltarInstant();
        S.stage = 'galius2';
        S.cutscene = 0;
        baph('IMPOSSÍVEL!! ESSA RELÍQUIA… MATE-O, GALIUS!!', 5);
        SFX.setIntensity(1);
      });
    });
  }

  function ripSequence(g) {
    S.cutscene = 7.5; S.csKind = 'rip'; S.csT = 0; S.rip = true;
    P.vel.set(0, 0, 0);
    say('Nivaldo enfia a mão no peito de Galius…', '', 2.2);
    SFX.play('heart');
    later(1.0, () => { SFX.play('heart'); P.shake = 0.8; });
    later(2.0, () => {
      burst(g.g.position.x, 3, g.g.position.z + 2, 0xc01020, 40, 12, 1.2, 0.35, 14);
      WEAPONS[6].owned = true; P.blood = 100; S.hasHeart = true;
      SFX.play('weapon'); updateSlots(); selectWeapon(6, true);
      say('CORAÇÃO ATEU adquirido! [7] · Atira sangue, recarrega com a chacina!', '', 4.5);
      if (g.rig.heart) g.rig.heart.visible = false;
    });
    later(3.6, () => {
      say('Nivaldo esmaga Galius sob o peso de seus Super-Pecados.', '', 3);
      S.fall = { m: buildThrownCross(), vy: 0, x: g.g.position.x, z: g.g.position.z };
      S.fall.m.scale.setScalar(5); S.fall.m.position.set(S.fall.x, 30, S.fall.z); S.fall.m.rotation.z = Math.PI;
      scene.add(S.fall.m);
    });
    later(5.6, () => {
      const p = g.g.position;
      burst(p.x, 1, p.z, 0xb01020, 70, 16, 1.5, 0.5, 18);
      burst(p.x, 1, p.z, 0xffd060, 30, 14, 0.9, 0.3, 12);
      P.shake = 1.5; SFX.play('boom'); SFX.play('gib');
      A.removeEnemy(g); S.boss = null; S.rooms.a6_galius2.cleared = true;
      if (S.fall) { scene.remove(S.fall.m); S.fall = null; }
      SFX.setIntensity(0.3);
    });
    later(6.4, () => {
      World.portal.g.visible = true; World.portal.active = true; SFX.play('portal');
      say('Existe um caminho mais fundo… um portal se abriu no altar.', 'SUPER-ANJO', 5);
      setObj('Entre no portal', { x: World.portal.x, z: World.portal.z });
      S.stage = 'portal'; S.rip = false;
    });
  }

  /* ---------------- persistência & configurações ---------------- */
  const SAVE_KEY = 'hellslayer_save_v1';
  const SAVE = { sens: 1.0, vol: 0.55, goreVol: 0.55, bestTime: null, bestKills: 0, bestRank: '—', ch2Unlocked: false };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) Object.assign(SAVE, JSON.parse(raw));
  } catch (e) {}
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

  function updateEvents(dt) {
    S.prompt = '';
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

    // Túmulo de Romulus III
    if (World.currentMap === 'a6_crypt' && S.stage === 'crypt' && S.rooms.a6_crypt3.cleared && !S.hasCross && S.cutscene <= 0) {
      const d = dist2(px, pz, -4, -86);
      if (d < 12) {
        S.prompt = '[E] PEDIR PERMISSÃO AO FANTASMA DE ROMULUS III';
        if (P.wantUse) tombSequence();
      }
    }
    // Galius derrubado
    const b = S.boss;
    if (b && b.T.galius2 && b.downed && !S.rip && S.cutscene <= 0) {
      const d = dist2(px, pz, b.g.position.x, b.g.position.z);
      if (d < b.r + 7) {
        S.prompt = '[E] ARRANCAR O CORAÇÃO ATEU';
        if (P.wantUse) ripSequence(b);
      }
    }
    // portal final
    if (World.portal && World.portal.active && dist2(px, pz, World.portal.x, World.portal.z) < World.portal.r + 0.6) endGame();
    P.wantUse = false;
  }

  /* ---------------- jogador ---------------- */
  function die() {
    if (P.dead) return;
    P.dead = true; mouseL = false; mouseR = false;
    SFX.play('roar');
    show('death', true);
    if (document.exitPointerLock) document.exitPointerLock();
  }
  function respawn() {
    show('death', false);
    P.dead = false; P.hp = P.maxhp; P.vel.set(0, 0, 0); P.faithMode = 0; P.hurtFlash = 0;
    P.pos.set(S.checkpoint.x, 0, S.checkpoint.z); P.yaw = S.checkpoint.yaw; P.pitch = 0;
    resetCamera();
    A.clearProjs(); A.clearParts();
    for (const id in S.rooms) {
      const r = S.rooms[id];
      if (r.spawned && !r.cleared) { A.clearRoomEnemies(id); startRoom(id, true); }
    }
    if (S.cross.state !== 'held') crossRemove();
    S.cutscene = 0; S.rip = false;
    S.boss = enemies.find(e => e.T.boss) || null;
    requestLock();
  }

  function doGroundSlam() {
    SFX.play('slam');
    P.shake = Math.max(P.shake, 0.85);
    S.hitStop = 0.055;
    spawnRing(P.pos.x, P.pos.z, 7.5, 26, 0, 0xffaa30, 'p');
    burst(P.pos.x, P.pos.y + 0.3, P.pos.z, 0x8a725a, 24, 11, 0.7, 0.32, 16, false);
    burst(P.pos.x, P.pos.y + 0.5, P.pos.z, 0xffd060, 10, 9, 0.4, 0.2, 10);
    for (const e of enemies) {
      if (e.dead || e.downed) continue;
      const ep = e.g.position;
      const d = dist2(P.pos.x, P.pos.z, ep.x, ep.z);
      if (d < 6.8 + e.r && Math.abs(ep.y - P.pos.y) < 4.5) {
        const l = d || 1;
        dmgEnemy(e, 48, (ep.x - P.pos.x) / l, (ep.z - P.pos.z) / l, { knock: 16, stunBonus: 0.6 });
      }
    }
  }

  function updatePlayer(dt) {
    const input = !P.dead && S.cutscene <= 0;
    if (input) {
      if (mouseGuard.pendingX !== 0 || mouseGuard.pendingY !== 0) {
        const k = 0.0022 * SAVE.sens;
        P.yaw = wrapAngle(P.yaw - mouseGuard.pendingX * k);
        P.pitch = clamp(P.pitch - mouseGuard.pendingY * k, -1.45, 1.45);
        mouseGuard.pendingX = 0;
        mouseGuard.pendingY = 0;
      }
      const look = 2.2 * dt * SAVE.sens;
      if (keys.ArrowLeft) P.yaw = wrapAngle(P.yaw + look);
      if (keys.ArrowRight) P.yaw = wrapAngle(P.yaw - look);
      if (keys.ArrowUp) P.pitch = clamp(P.pitch + look, -1.45, 1.45);
      if (keys.ArrowDown) P.pitch = clamp(P.pitch - look, -1.45, 1.45);
    } else {
      mouseGuard.pendingX = 0;
      mouseGuard.pendingY = 0;
    }
    const f = input ? ((keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0)) : 0;
    const s = input ? ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)) : 0;
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    let wx = -sy * f + cy * s, wz = -cy * f - sy * s;
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

    // Coyote time + Jump buffer + Ground Slam (450 kg)
    P.coyoteT = P.onGround ? 0.12 : Math.max(0, (P.coyoteT || 0) - dt);
    if (input && keys.Space) P.jumpBufT = 0.12;
    else P.jumpBufT = Math.max(0, (P.jumpBufT || 0) - dt);

    if (input && P.jumpBufT > 0 && P.coyoteT > 0) {
      P.vel.y = 10.5; P.onGround = false; P.coyoteT = 0; P.jumpBufT = 0; P.slamming = false;
      SFX.play('jump');
    }
    if (input && !P.onGround && P.pos.y > 0.7 && !P.slamming && (keys.ControlLeft || keys.ControlRight || keys.KeyC)) {
      P.slamming = true;
      P.vel.y = -38;
      P.fovKick = Math.max(P.fovKick, 0.6);
    }

    P.vel.y -= 30 * dt;
    P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; P.pos.y += P.vel.y * dt;
    resolveCircle(P.pos, P.r, P.pos.y);
    const gy = A.groundAt(P.pos.x, P.pos.z, P.pos.y, P.r);
    if (P.pos.y <= gy) {
      if (P.slamming) { P.slamming = false; P.landImpact = 1.0; doGroundSlam(); }
      else if (!P.onGround && P.vel.y < -4) {
        P.landImpact = Math.min(1, -P.vel.y / 22);
        if (P.vel.y < -12) P.shake = Math.max(P.shake, 0.18);
      }
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
    if (P.flashV > 0) { P.flashV = Math.max(0, P.flashV - dt * 2); el('flash').style.opacity = P.flashV; }
  }

  /* ---------------- câmera / ambiente ---------------- */
  const envTarget = { fog: new THREE.Color(), amb: new THREE.Color(), sun: new THREE.Color() };
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
    x: 0, y: 2.45, z: 6, yaw: 0, pitch: 0, roll: 0, fov: 75,
    bobAmt: 0, landDip: 0, landVel: 0, shakePhase: 0, init: false
  };
  function resetCamera() {
    CAM.x = P.pos.x;
    CAM.y = P.pos.y + P.eye;
    CAM.z = P.pos.z;
    CAM.yaw = wrapAngle(P.yaw);
    CAM.pitch = clamp(P.pitch, -1.45, 1.45);
    CAM.roll = 0;
    CAM.fov = 75 + (P.faithMode > 0 ? 6 : 0);
    CAM.bobAmt = 0;
    CAM.landDip = 0;
    CAM.landVel = 0;
    CAM.init = true;
    P.lastStep = Math.floor((P.bob + Math.PI * 0.25) / Math.PI);
    mouseGuard.pendingX = 0;
    mouseGuard.pendingY = 0;
  }

  function updateCamera(dt) {
    if (!CAM.init) resetCamera();

    // Suavização exponencial independente de FPS para rotação e altura
    CAM.yaw = dampAngle(CAM.yaw, P.yaw, 42, dt);
    CAM.pitch = damp(CAM.pitch, P.pitch, 42, dt);
    CAM.x = P.pos.x;
    CAM.z = P.pos.z;
    CAM.y = damp(CAM.y, P.pos.y + P.eye, 26, dt);

    // Mola sutil de impacto ao aterrissar
    if (P.landImpact > 0) {
      CAM.landVel -= P.landImpact * 4.2;
      P.landImpact = 0;
    }
    CAM.landVel += (-CAM.landDip * 180 - CAM.landVel * 22) * dt;
    CAM.landDip = clamp(CAM.landDip + CAM.landVel * dt, -0.45, 0.12);

    // Tremor harmônico suave (substitui ruído aleatório seco)
    if (S.shakeBig) { P.shake = Math.max(P.shake, S.shakeBig * 0.9); S.shakeBig = 0; }
    P.shake = Math.max(0, P.shake - dt * 2.4);
    const sh = P.shake * P.shake * 0.34;
    CAM.shakePhase += dt * 48;
    const sx = (Math.sin(CAM.shakePhase) * 0.65 + Math.sin(CAM.shakePhase * 1.73) * 0.35) * sh;
    const sy = (Math.cos(CAM.shakePhase * 1.27) * 0.65 + Math.sin(CAM.shakePhase * 2.11) * 0.35) * sh;
    const sr = Math.sin(CAM.shakePhase * 1.41) * sh * 0.16;

    // Balanço de caminhada com entrada/saída suave
    const hs = Math.hypot(P.vel.x, P.vel.z);
    const targetBob = Math.min(1, hs / 8) * (P.onGround ? 1 : 0);
    CAM.bobAmt = damp(CAM.bobAmt, targetBob, 10, dt);
    const bobY = Math.sin(P.bob * 2) * 0.05 * CAM.bobAmt;
    const bobX = Math.cos(P.bob) * 0.03 * CAM.bobAmt;

    // Inclinação lateral (strafe) suavizada
    const strafe = (!P.dead && S.cutscene <= 0) ? ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)) : 0;
    const targetRoll = -strafe * 0.022 + (P.dead ? 0.6 : 0);
    CAM.roll = damp(CAM.roll, targetRoll, 14, dt);

    const cy = Math.cos(CAM.yaw), syaw = Math.sin(CAM.yaw);
    const baseY = P.dead ? P.pos.y + 0.6 : CAM.y + CAM.landDip + bobY;
    camera.position.set(
      CAM.x + cy * (bobX + sx),
      baseY + sy,
      CAM.z - syaw * (bobX + sx)
    );
    camera.rotation.set(CAM.pitch, CAM.yaw, CAM.roll + sr);

    P.fovKick = Math.max(0, P.fovKick - dt * 3.5);
    const targetFov = 75 + P.fovKick * 14 + (P.faithMode > 0 ? 6 : 0);
    CAM.fov = damp(CAM.fov, targetFov, 14, dt);
    if (Math.abs(camera.fov - CAM.fov) > 0.03) { camera.fov = CAM.fov; camera.updateProjectionMatrix(); }
    A.sky.position.copy(camera.position);
    A.plight.position.set(camera.position.x, camera.position.y + 0.5, camera.position.z);
    A.plight.color.setHex(P.faithMode > 0 ? 0xffd860 : 0xffc080);
    A.plight.intensity = (P.faithMode > 0 ? 1.7 : 1.0) + Math.sin(S.time * 17) * 0.06;
    // ambiente
    const E = ENV[envAt(P.pos.x, P.pos.z)];
    const k = Math.min(1, dt * 2.5);
    envTarget.fog.setHex(E.fog); envTarget.amb.setHex(E.amb); envTarget.sun.setHex(E.dir);
    scene.fog.color.lerp(envTarget.fog, k);
    scene.fog.near += (E.near - scene.fog.near) * k; scene.fog.far += (E.far - scene.fog.far) * k;
    A.amb.color.lerp(envTarget.amb, k); A.amb.intensity += (E.ambI - A.amb.intensity) * k;
    A.sun.color.lerp(envTarget.sun, k); A.sun.intensity += (E.dirI - A.sun.intensity) * k;
    // relâmpago
    S.lightT = (S.lightT || rnd(8, 18)) - dt;
    if (S.lightT <= 0 && P.pos.x < 200 && P.pos.z > -216) {
      S.lightT = rnd(10, 22); S.lightning = 0.18; SFX.play('thunder');
    }
    if (S.lightning > 0) { S.lightning -= dt; A.amb.intensity += 1.6 * (S.lightning > 0.09 ? 1 : 0.5); }
    A.renderer.setClearColor(scene.fog.color);
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
    updateCutscene(dt);
    updatePlayer(dt);
    updateWeapons(dt);
    updateCross(dt);
    for (let i = enemies.length - 1; i >= 0; i--) { if (enemies[i]) A.updateEnemy(enemies[i], dt); }
    A.updateProjs(dt); A.updateRings(dt); A.updateParts(dt);
    updatePickups(dt);
    updateWorld(S.time, dt);
    S.checkT = (S.checkT || 0) - dt;
    if (S.checkT <= 0) { S.checkT = 0.25; checkRooms(); }
    updateEvents(dt);
    // música: intensidade pela quantidade de inimigos agressivos
    let ag = 0; for (const e of enemies) if (e.aggro) ag++;
    if (S.stage !== 'galius1' && S.stage !== 'galius2') SFX.setIntensity(Math.min(1, ag / 10));
    updateCamera(dt);
    updateVM(dt);
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
      if (o === e || o.room !== 'title_demo') continue;
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

    const tagEl = el('titleCamLabel');
    if (tagEl && tagEl.__v !== cur.label) { tagEl.__v = cur.label; tagEl.textContent = cur.label; }

    A.sky.position.copy(camera.position);
    A.plight.position.set(camera.position.x, camera.position.y + 1.5, camera.position.z);
    A.plight.color.setHex(0xffa860);
    A.plight.intensity = 1.25 + Math.sin(titleTime * 13) * 0.12;

    const E = ENV[envAt(camera.position.x, camera.position.z)];
    const k = Math.min(1, dt * 3.5);
    envTarget.fog.setHex(E.fog); envTarget.amb.setHex(E.amb); envTarget.sun.setHex(E.dir);
    scene.fog.color.lerp(envTarget.fog, k);
    scene.fog.near += (E.near - scene.fog.near) * k; scene.fog.far += (E.far - scene.fog.far) * k;
    A.amb.color.lerp(envTarget.amb, k); A.amb.intensity += (E.ambI - A.amb.intensity) * k;
    A.sun.color.lerp(envTarget.sun, k); A.sun.intensity += (E.dirI - A.sun.intensity) * k;
    A.renderer.setClearColor(scene.fog.color);

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i] && enemies[i].room === 'title_demo') updateTitleEnemy(enemies[i], dt);
    }
    // Atualiza projéteis de demonstração
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i];
      p.life -= dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += dt * 6; p.m.rotation.y += dt * 7;
      let hit = p.life <= 0 || p.m.position.y < 0.2 || A.pointInWall(p.m.position.x, p.m.position.z);
      if (!hit) {
        for (const e of enemies) {
          if (e.room === 'title_demo' && dist2(p.m.position.x, p.m.position.z, e.g.position.x, e.g.position.z) < e.r + 0.45) {
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
    if (S.started) {
      r.clearDepth();
      vmCam.position.set(0, 0, 0);
      r.render(vmScene, vmCam);
    }
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!S.started) tickTitle(dt);
    else if (!S.paused && !S.ended && !S.intermission) tick(dt);
    render();
  }

  /* ---------------- entrada ---------------- */
  function requestLock() {
    if (nolock) return;
    try {
      const p = renderer.domElement.requestPointerLock({ unadjustedMovement: true });
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
    if (!S.started || S.paused || P.dead) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    let i = curW();
    for (let n = 0; n < WEAPONS.length; n++) {
      i = (i + dir + WEAPONS.length) % WEAPONS.length;
      if (WEAPONS[i].owned) { selectWeapon(i); break; }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (!S.started) {
      if (e.code === 'Escape') closeAllTitleModals();
      return;
    }
    if (e.code === 'KeyM') SFX.toggleMute();
    if (S.intermission) {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); finishLevelComplete(); }
      return;
    }
    if (e.code === 'KeyR' && P.dead) respawn();
    if (S.paused) return;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') P.wantDash = true;
    if (e.code === 'KeyE') P.wantUse = true;
    if (e.code === 'KeyQ') activateFaith();
    if (e.code.startsWith('Digit')) { const n = parseInt(e.code.slice(5), 10) - 1; if (n >= 0 && n < WEAPONS.length) selectWeapon(n); }
    if (e.code === 'F1') { e.preventDefault(); WEAPONS.forEach(w => w.owned = true); P.rocks = 80; P.blood = 100; P.hp = P.maxhp; P.faith = 100; updateSlots(); say('[DEV] Arsenal completo', '', 2); }
    if (e.code === 'F2') { e.preventDefault(); P.god = !P.god; say('[DEV] Modo deus: ' + (P.god ? 'ON' : 'OFF'), '', 2); }
    if (e.code === 'F3') { e.preventDefault(); devClear(); }
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
      if (e.T.galius2) { dmgEnemy(e, 1e5, 0, 0, {}); dmgEnemy(e, 1e5, 0, 0, {}); continue; }
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
    show('title', false); show('hud', true);
    S.started = true; S.paused = false;
    requestLock();

    const sv = opts.resumeSave;
    if (sv) {
      if (Array.isArray(sv.owned)) {
        sv.owned.forEach((own, idx) => { if (WEAPONS[idx]) WEAPONS[idx].owned = !!own; });
      }
      P.hp = sv.hp || 200;
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

  // coleciona pickups do mapa e inicia vitrine 3D da tela de título
  spawnMapPickups('a1');
  buildSlots(); updateSlots();
  A.bind({ die, say, quip, spawnPickup });
  P.wantDash = false; P.wantUse = false;
  initTitleShowcase();

  // vincula sliders de configuração e recordes
  SFX.setVolume(SAVE.vol);
  SFX.setGoreVolume(SAVE.goreVol);
  refreshRecordUI();
  function syncSettingsUI() {
    ['sensSlider', 'sensSliderPause'].forEach(id => { if (el(id)) el(id).value = SAVE.sens; });
    ['volSlider', 'volSliderPause'].forEach(id => { if (el(id)) el(id).value = SAVE.vol; });
    ['goreVolSlider', 'goreVolSliderPause'].forEach(id => { if (el(id)) el(id).value = SAVE.goreVol; });
    if (el('sensVal')) el('sensVal').textContent = Number(SAVE.sens).toFixed(1) + 'x';
    if (el('volVal')) el('volVal').textContent = Math.round(SAVE.vol * 100) + '%';
    if (el('goreVolVal')) el('goreVolVal').textContent = Math.round(SAVE.goreVol * 100) + '%';
    if (el('continueBtn')) {
      el('continueBtn').classList.toggle('disabled-look', !SAVE.savedGame);
    }
  }
  syncSettingsUI();
  ['sensSlider', 'sensSliderPause'].forEach(id => {
    if (el(id)) el(id).addEventListener('input', (e) => {
      SAVE.sens = parseFloat(e.target.value) || 1.0;
      syncSettingsUI(); writeSave();
    });
  });
  ['volSlider', 'volSliderPause'].forEach(id => {
    if (el(id)) el(id).addEventListener('input', (e) => {
      SAVE.vol = parseFloat(e.target.value);
      SFX.init(); SFX.setVolume(SAVE.vol);
      syncSettingsUI(); writeSave();
    });
  });
  ['goreVolSlider', 'goreVolSliderPause'].forEach(id => {
    if (el(id)) el(id).addEventListener('input', (e) => {
      SAVE.goreVol = parseFloat(e.target.value);
      SFX.init(); SFX.setGoreVolume(SAVE.goreVol);
      syncSettingsUI(); writeSave();
    });
  });

  function closeAllTitleModals() {
    ['titleChapterModal', 'titleEpisodeModal', 'titleLoadModal', 'titleSettingsModal', 'titleExitModal'].forEach(id => {
      if (el(id)) show(id, false);
    });
  }

  const EPISODES = [
    {
      title: 'ÀS MARGENS DO INFERNO',
      badge: 'ÁREAS 1–3',
      desc: 'Bairro Alto, Campos da Perdição e Subúrbio Exterior. Recupere sua funda na casinha, pegue a foice nos celeiros e abra caminho até a cidade.',
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
      desc: 'Enfrente Maximus no pátio, invada a mega-estrutura, desça às catacumbas e encare Galius, o Super-Ateu criado por Baphomet.',
      intro: 'ÁREA 6 — A ULTRA-IGREJA. Maximus guarda os portões da Mega-Estrutura.',
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

      const c = document.createElement('canvas');
      c.width = 192;
      c.height = 108;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;

      EPISODES.forEach((ep, i) => {
        const pv = ep.preview;
        if (pv.map && World.currentMap !== pv.map) buildMap(pv.map);
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
      if (World.currentMap !== 'a1') buildMap('a1');

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
        if (!ep.data) startGame();
        else startGame({ resumeSave: ep.data, episodeIntro: ep.intro });
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
      title: 'Área 6 · Portões da Ultra-Igreja (Maximus)',
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
      title: 'Área 6 · Catacumbas de Romulus III',
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
      autoSlot.className = 'save-slot-item';
      autoSlot.innerHTML =
        '<div><div class="save-slot-title">Último Checkpoint Salvo</div>' +
        '<div class="save-slot-meta">' + (sv.areaLabel || 'Capítulo 1') + ' · Tempo ' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ' · Chacina ' + (sv.kills || 0) + '</div></div>' +
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
    show('titleChapterModal', true);
  });
  if (el('chapter1Card')) {
    el('chapter1Card').addEventListener('click', () => {
      closeAllTitleModals();
      populateEpisodes();
      show('titleEpisodeModal', true);
    });
  }
  if (el('closeChapterBtn')) el('closeChapterBtn').addEventListener('click', closeAllTitleModals);
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
      show('titleSettingsModal', true);
    });
  }
  if (el('exitBtn')) {
    el('exitBtn').addEventListener('click', () => {
      closeAllTitleModals();
      show('titleExitModal', true);
    });
  }
  if (el('closeLoadBtn')) el('closeLoadBtn').addEventListener('click', closeAllTitleModals);
  if (el('closeSettingsBtn')) el('closeSettingsBtn').addEventListener('click', closeAllTitleModals);
  if (el('cancelExitBtn')) el('cancelExitBtn').addEventListener('click', closeAllTitleModals);
  if (el('confirmExitBtn')) {
    el('confirmExitBtn').addEventListener('click', () => {
      window.close();
      closeAllTitleModals();
      el('titleCamLabel').textContent = 'SESSÃO ENCERRADA · FECHE A ABA OU CLIQUE EM NOVO JOGO';
    });
  }
  ['titleChapterModal', 'titleEpisodeModal', 'titleLoadModal', 'titleSettingsModal', 'titleExitModal'].forEach(id => {
    if (el(id)) el(id).addEventListener('click', (e) => { if (e.target.id === id) closeAllTitleModals(); });
  });

  el('resumeBtn').addEventListener('click', () => { pause(false); requestLock(); });
  el('respawnBtn').addEventListener('click', () => respawn());
  el('againBtn').addEventListener('click', () => location.reload());
  el('pause').addEventListener('click', (e) => { if (e.target.id === 'pause') { pause(false); requestLock(); } });

  window.__game = { start: startGame, tick, tickTitle, render, P, S, WEAPONS, enemies, World, ROOMS, startRoom, devClear, pickups, say, selectWeapon, attack, altAttack, respawn, SAVE, setMouse: (v) => { mouseL = v; }, get curW() { return curW(); } };
  if (location.search.includes('autostart')) startGame({ nolock: true });
  requestAnimationFrame(frame);
})();
