'use strict';
/* ============================================================
   HELLSLAYER - texturas procedurais (estilo PS1) + patch de shader
   ============================================================ */

// Resolução interna (atualizada pelo game.js) usada no "snap" de vértices do PS1
const PSX_RES = { value: new THREE.Vector2(480, 270) };

// Faz os vértices "tremerem" na grade de pixels, como no PlayStation 1
function psx(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRes = PSX_RES;
    shader.vertexShader = 'uniform vec2 uRes;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
       if (gl_Position.w > 0.0) {
         vec4 sp = gl_Position;
         sp.xyz /= sp.w;
         sp.xy = floor(sp.xy * uRes * 0.5 + 0.5) / (uRes * 0.5);
         sp.xyz *= gl_Position.w;
         gl_Position = sp;
       }`
    );
  };
  mat.customProgramCacheKey = () => 'psx';
  return mat;
}

const TX = (() => {
  const cache = {};
  let seed = 1337;
  function r() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function pick(a) { return a[Math.floor(r() * a.length)]; }
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function speckle(g, w, h, n, cols, s) {
    s = s || 1;
    for (let i = 0; i < n; i++) {
      g.fillStyle = pick(cols);
      g.fillRect(Math.floor(r() * w), Math.floor(r() * h), s, s);
    }
  }
  let curFilter = THREE.NearestFilter;
  function mk(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = curFilter;
    t.minFilter = curFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  const makers = {
    brick() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#2a1410'; g.fillRect(0, 0, 64, 64);
      const cols = ['#8a4030', '#7a3828', '#964a38', '#6e3426', '#823c2c'];
      for (let row = 0; row < 8; row++) {
        const off = (row % 2) * 8;
        for (let x = -16; x < 64; x += 16) {
          g.fillStyle = pick(cols);
          g.fillRect(x + off + 1, row * 8 + 1, 14, 6);
        }
      }
      speckle(g, 64, 64, 160, ['#4a2018', '#a65a44', '#5a2a20']);
      return c;
    },
    stone() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#1c1c24'; g.fillRect(0, 0, 64, 64);
      const cols = ['#5a5a6a', '#505062', '#64647a', '#4a4a5a'];
      for (let row = 0; row < 4; row++) {
        const off = (row % 2) * 16;
        for (let x = -32; x < 64; x += 32) {
          g.fillStyle = pick(cols);
          g.fillRect(x + off + 1, row * 16 + 1, 30, 14);
        }
      }
      speckle(g, 64, 64, 200, ['#3a3a48', '#7a7a8a', '#30303c']);
      return c;
    },
    church() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#17141c'; g.fillRect(0, 0, 64, 64);
      const cols = ['#3c3848', '#443f50', '#37333f'];
      for (let row = 0; row < 4; row++) {
        const off = (row % 2) * 8;
        for (let x = -16; x < 64; x += 16) {
          g.fillStyle = pick(cols);
          g.fillRect(x + off + 1, row * 16 + 1, 14, 14);
        }
      }
      g.fillStyle = '#6a1a1a';
      for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 60), Math.floor(r() * 60), 1, 6);
      speckle(g, 64, 64, 120, ['#25222e', '#55506a']);
      return c;
    },
    crypt() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#0c1210'; g.fillRect(0, 0, 64, 64);
      const cols = ['#2c3a30', '#26332a', '#33443a', '#222e26'];
      for (let row = 0; row < 8; row++) {
        const off = (row % 2) * 8;
        for (let x = -16; x < 64; x += 16) {
          g.fillStyle = pick(cols);
          g.fillRect(x + off + 1, row * 8 + 1, 14, 6);
        }
      }
      // caveiras
      for (let i = 0; i < 3; i++) {
        const sx = 4 + Math.floor(r() * 50), sy = 4 + Math.floor(r() * 50);
        g.fillStyle = '#cfc8a8'; g.fillRect(sx, sy, 5, 4);
        g.fillStyle = '#000'; g.fillRect(sx + 1, sy + 1, 1, 1); g.fillRect(sx + 3, sy + 1, 1, 1);
        g.fillRect(sx + 2, sy + 3, 1, 1);
      }
      speckle(g, 64, 64, 120, ['#141c18', '#3c5044']);
      return c;
    },
    dirt() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#3a2618'; g.fillRect(0, 0, 64, 64);
      speckle(g, 64, 64, 500, ['#4a3220', '#2c1c10', '#56402a', '#241408'], 2);
      speckle(g, 64, 64, 80, ['#6a1c10']);
      return c;
    },
    cobble() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#14141a'; g.fillRect(0, 0, 64, 64);
      const cols = ['#4a4854', '#3e3c48', '#545260', '#46444f'];
      for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x += 8) {
        g.fillStyle = pick(cols);
        g.fillRect(x + 1, y + 1, 6, 6);
      }
      speckle(g, 64, 64, 80, ['#6a1c10', '#28262e']);
      return c;
    },
    hellfloor() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#220808'; g.fillRect(0, 0, 64, 64);
      speckle(g, 64, 64, 400, ['#2e0c0a', '#3a1010', '#180606'], 2);
      g.fillStyle = '#ff5a10';
      for (let i = 0; i < 7; i++) {
        let x = Math.floor(r() * 64), y = Math.floor(r() * 64);
        for (let k = 0; k < 10; k++) { g.fillRect(x, y, 1, 1); x += r() < .5 ? 1 : -1; y += 1; }
      }
      return c;
    },
    marble() {
      const c = cv(64, 64), g = c.getContext('2d');
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        g.fillStyle = (x + y) % 2 ? '#2a262e' : '#6a5a5a';
        g.fillRect(x * 32, y * 32, 32, 32);
      }
      speckle(g, 64, 64, 300, ['#7a6a6a', '#201c24', '#4a3e44']);
      g.fillStyle = '#12101a';
      g.fillRect(0, 0, 64, 1); g.fillRect(0, 31, 64, 1); g.fillRect(0, 0, 1, 64); g.fillRect(31, 0, 1, 64);
      return c;
    },
    grass() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#2a2a14'; g.fillRect(0, 0, 64, 64);
      speckle(g, 64, 64, 500, ['#3a3a1c', '#4a4a22', '#201e0e', '#52401c'], 2);
      return c;
    },
    crops() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#34200e'; g.fillRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x += 8) {
        g.fillStyle = '#6a5a1a'; g.fillRect(x + 2, 0, 4, 64);
        speckle(g, 64, 64, 0, ['#000']);
      }
      speckle(g, 64, 64, 200, ['#8a7a22', '#4a3c10', '#a08a30']);
      return c;
    },
    wood() {
      const c = cv(64, 64), g = c.getContext('2d');
      for (let y = 0; y < 64; y += 16) {
        g.fillStyle = pick(['#5a3a1c', '#4e3218', '#64421e']);
        g.fillRect(0, y, 64, 15);
        g.fillStyle = '#20120a'; g.fillRect(0, y + 15, 64, 1);
      }
      speckle(g, 64, 64, 200, ['#3a2410', '#70502a']);
      return c;
    },
    roof() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#1a0a0a'; g.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 8; row++) {
        const off = (row % 2) * 4;
        for (let x = -8; x < 64; x += 8) {
          g.fillStyle = pick(['#5a1a14', '#4a1410', '#6a2018']);
          g.fillRect(x + off + 1, row * 8 + 1, 6, 6);
        }
      }
      return c;
    },
    door() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#3a220e'; g.fillRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x += 16) { g.fillStyle = '#4e3016'; g.fillRect(x + 1, 0, 14, 64); }
      g.fillStyle = '#2a2a30';
      g.fillRect(0, 8, 64, 6); g.fillRect(0, 50, 64, 6);
      speckle(g, 64, 64, 120, ['#aa8a20', '#222']);
      return c;
    },
    hay() {
      const c = cv(32, 32), g = c.getContext('2d');
      g.fillStyle = '#8a7020'; g.fillRect(0, 0, 32, 32);
      speckle(g, 32, 32, 200, ['#a88a2a', '#5a4a10', '#c0a040'], 1);
      return c;
    },
    dark() {
      const c = cv(32, 32), g = c.getContext('2d');
      g.fillStyle = '#0c0810'; g.fillRect(0, 0, 32, 32);
      speckle(g, 32, 32, 100, ['#181020', '#06040a']);
      return c;
    },
    bonefloor() {
      const c = cv(64, 64), g = c.getContext('2d');
      g.fillStyle = '#10161a'; g.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x += 16) {
        g.fillStyle = pick(['#1c2a26', '#18241f', '#223228']);
        g.fillRect(x + 1, y + 1, 14, 14);
      }
      speckle(g, 64, 64, 100, ['#cfc8a8', '#0a0e0c'], 1);
      return c;
    },
    gold() {
      const c = cv(16, 16), g = c.getContext('2d');
      g.fillStyle = '#c9a227'; g.fillRect(0, 0, 16, 16);
      speckle(g, 16, 16, 40, ['#f0d060', '#8a6a10']);
      return c;
    }
  };

  function get(name) {
    if (!cache[name]) cache[name] = mk(makers[name]());
    return cache[name];
  }

  const mats = {};
  function mat(name, polyOffset) {
    const key = polyOffset ? name + '_' + polyOffset : name;
    if (!mats[key]) {
      const opts = { map: get(name) };
      if (polyOffset) {
        opts.polygonOffset = true;
        opts.polygonOffsetFactor = polyOffset;
        opts.polygonOffsetUnits = polyOffset;
      }
      const m = new THREE.MeshLambertMaterial(opts);
      psx(m);
      mats[key] = m;
    }
    return mats[key];
  }

  // Céu em gradiente
  let skyTex = null;
  function skyTexture() {
    if (skyTex) return skyTex;
    const c = cv(8, 128), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#070006');
    gr.addColorStop(0.45, '#3a0808');
    gr.addColorStop(0.7, '#a02808');
    gr.addColorStop(1, '#d05010');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = curFilter; t.minFilter = curFilter;
    skyTex = t;
    return t;
  }

  // Preview fotográfico procedural da próxima fase (exibido atrás do portão gradeado)
  const previewCache = {};
  function levelPreviewTexture(mapId) {
    const key = mapId || 'default';
    if (previewCache[key]) return previewCache[key];
    const W = 384, H = 256;
    const c = cv(W, H), g = c.getContext('2d');
    let pSeed = 9187;
    for (let i = 0; i < key.length; i++) pSeed = (pSeed * 31 + key.charCodeAt(i) * 97) % 2147483647;
    const pr = () => { pSeed = (pSeed * 16807) % 2147483647; return (pSeed - 1) / 2147483646; };

    const drawSky = (stops) => {
      const gr = g.createLinearGradient(0, 0, 0, H * 0.68);
      stops.forEach(([p, col]) => gr.addColorStop(p, col));
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    };
    const drawPortal = (x, y, rx, ry) => {
      const rg = g.createRadialGradient(x, y, 2, x, y, rx * 1.4);
      rg.addColorStop(0, 'rgba(255,140,40,0.85)');
      rg.addColorStop(0.45, 'rgba(220,40,12,0.65)');
      rg.addColorStop(1, 'rgba(120,10,0,0)');
      g.fillStyle = rg;
      g.beginPath(); g.ellipse(x, y, rx * 1.4, ry * 1.4, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,95,30,0.9)';
      g.lineWidth = 3;
      g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.stroke();
    };
    const drawDistantCathedral = (cx, baseY, sc) => {
      g.save();
      g.translate(cx, baseY);
      g.scale(sc, sc);
      g.fillStyle = '#14060d';
      g.fillRect(-34, -26, 68, 26);
      g.fillRect(-20, -40, 40, 40);
      // Torres gêmeas
      g.fillRect(-26, -68, 12, 68);
      g.fillRect(14, -68, 12, 68);
      // Agulhas
      g.beginPath(); g.moveTo(-28, -68); g.lineTo(-20, -96); g.lineTo(-12, -68); g.fill();
      g.beginPath(); g.moveTo(12, -68); g.lineTo(20, -96); g.lineTo(28, -68); g.fill();
      // Cruz dourada no topo
      g.fillStyle = '#e0a828';
      g.fillRect(-1.5, -62, 3, 22);
      g.fillRect(-7, -56, 14, 3);
      // Rosácea
      g.fillStyle = '#ff4418';
      g.beginPath(); g.arc(0, -24, 5.5, 0, Math.PI * 2); g.fill();
      g.restore();
    };
    const drawFireGlow = (x, y, rad, core) => {
      const rg = g.createRadialGradient(x, y, 1, x, y, rad);
      rg.addColorStop(0, core || 'rgba(255,235,140,0.95)');
      rg.addColorStop(0.35, 'rgba(255,115,24,0.72)');
      rg.addColorStop(1, 'rgba(200,30,0,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    };
    const drawDeadTree = (x, y, h) => {
      g.strokeStyle = '#180c08';
      g.lineWidth = Math.max(2, h * 0.08);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y - h); g.stroke();
      g.lineWidth = Math.max(1.2, h * 0.045);
      g.beginPath();
      g.moveTo(x + 1, y - h * 0.55); g.lineTo(x - h * 0.35, y - h * 0.85);
      g.moveTo(x + 1, y - h * 0.7); g.lineTo(x + h * 0.38, y - h * 0.96);
      g.moveTo(x + 2, y - h * 0.85); g.lineTo(x - h * 0.18, y - h * 1.12);
      g.stroke();
    };
    const drawEmbers = (count, col1, col2) => {
      for (let i = 0; i < count; i++) {
        g.fillStyle = pr() > 0.45 ? col1 : col2;
        const ex = pr() * W, ey = pr() * H * 0.92;
        const s = 1 + Math.floor(pr() * 2.4);
        g.fillRect(ex, ey, s, s);
      }
    };

    if (key === 'a2') {
      // CAMPOS DA PERDIÇÃO — colinas em chamas, plantações douradas, celeiro, espantalhos, estrada
      drawSky([[0, '#120308'], [0.42, '#4c0d08'], [0.75, '#b83c10'], [1, '#eb7a20']]);
      drawPortal(W * 0.54, 42, 34, 11);
      // Colinas distantes
      g.fillStyle = '#2d0c08';
      g.beginPath(); g.moveTo(0, 146);
      for (let x = 0; x <= W; x += 24) g.lineTo(x, 128 + Math.sin(x * 0.025) * 14);
      g.lineTo(W, H); g.lineTo(0, H); g.fill();
      drawDistantCathedral(W * 0.5, 134, 0.52);
      // Campos e colinas médias
      const fg = g.createLinearGradient(0, 135, 0, H);
      fg.addColorStop(0, '#5a240e'); fg.addColorStop(0.5, '#3b1c0c'); fg.addColorStop(1, '#1d0d08');
      g.fillStyle = fg;
      g.fillRect(0, 136, W, H - 136);
      // Estrada de pedra central
      g.fillStyle = '#3c302a';
      g.beginPath();
      g.moveTo(W * 0.46, 136); g.lineTo(W * 0.54, 136);
      g.lineTo(W * 0.68, H); g.lineTo(W * 0.32, H);
      g.closePath(); g.fill();
      // Plantações douradas/queimadas nos dois lados
      for (let side of [-1, 1]) {
        for (let i = 0; i < 65; i++) {
          const t = pr();
          const py = 148 + t * 102;
          const spread = 24 + t * 140;
          const px = side < 0 ? (W * 0.44 - pr() * spread) : (W * 0.56 + pr() * spread);
          g.fillStyle = pr() > 0.35 ? '#c48a22' : '#8a5614';
          g.fillRect(px, py - (5 + t * 10), 2, 6 + t * 10);
        }
      }
      // Celeiro em chamas à esquerda
      g.fillStyle = '#240f0a';
      g.fillRect(36, 112, 68, 44);
      g.beginPath(); g.moveTo(28, 112); g.lineTo(70, 82); g.lineTo(112, 112); g.fill();
      drawFireGlow(70, 96, 38);
      g.fillStyle = '#ffaa28'; g.fillRect(58, 128, 12, 16); g.fillRect(78, 128, 12, 16);
      // Espantalho à direita
      g.strokeStyle = '#1a0a06'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(298, 198); g.lineTo(298, 134); g.moveTo(276, 150); g.lineTo(320, 146); g.stroke();
      g.fillStyle = '#26140c'; g.beginPath(); g.arc(298, 128, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff6a18'; g.fillRect(295, 127, 2, 2); g.fillRect(300, 127, 2, 2);
      // Cercas e árvores secas
      drawDeadTree(136, 152, 42);
      drawDeadTree(248, 156, 38);
      drawFireGlow(148, 184, 22);
      drawFireGlow(238, 190, 22);
      drawEmbers(55, '#ffcc44', '#ff6618');
    } else if (key === 'a3') {
      // SUBÚRBIO EXTERIOR — cidade fortificada, muralhas de pedra, casas em chamas, lampiões
      drawSky([[0, '#0f0309'], [0.45, '#420a10'], [0.78, '#9e2e14'], [1, '#d9621e']]);
      drawPortal(W * 0.5, 36, 36, 11);
      drawDistantCathedral(W * 0.5, 136, 0.72);
      // Muralha de pedra ao fundo
      g.fillStyle = '#2c2224';
      g.fillRect(0, 122, W, 30);
      for (let x = 0; x < W; x += 22) g.fillRect(x, 114, 13, 10);
      // Chão de paralelepípedos
      const fg = g.createLinearGradient(0, 142, 0, H);
      fg.addColorStop(0, '#362b2c'); fg.addColorStop(1, '#1a1416');
      g.fillStyle = fg; g.fillRect(0, 142, W, H - 142);
      // Casas de tijolo e pedra em chamas nas laterais
      const houses = [
        [8, 92, 74, 88, '#4a2018'], [86, 106, 52, 62, '#3d2828'],
        [246, 104, 54, 64, '#3e2c2e'], [304, 88, 72, 92, '#47221a']
      ];
      houses.forEach(([hx, hy, hw, hh, col]) => {
        g.fillStyle = col; g.fillRect(hx, hy, hw, hh);
        g.fillStyle = '#1b0d0c';
        g.beginPath(); g.moveTo(hx - 6, hy); g.lineTo(hx + hw / 2, hy - 22); g.lineTo(hx + hw + 6, hy); g.fill();
        drawFireGlow(hx + hw * 0.5, hy - 6, 30);
        g.fillStyle = '#ff9d2e';
        g.fillRect(hx + 12, hy + 18, 12, 16);
        g.fillRect(hx + hw - 24, hy + 18, 12, 16);
      });
      // Lampiões acesos dos dois lados da rua
      [[136, 184], [248, 184], [156, 158], [228, 158]].forEach(([lx, ly]) => {
        g.fillStyle = '#181416'; g.fillRect(lx - 2, ly - 44, 4, 44);
        drawFireGlow(lx, ly - 46, 20, 'rgba(255,245,180,0.95)');
      });
      drawFireGlow(W * 0.5, 198, 26);
      drawEmbers(60, '#ffb838', '#ff5418');
    } else if (key === 'a4') {
      // CASARÕES DOS SUPER-RICOS — mansões de mármore, fonte central, postes dourados
      drawSky([[0, '#0d0414'], [0.45, '#3b0c22'], [0.78, '#8a2620'], [1, '#cc5828']]);
      drawPortal(W * 0.5, 34, 38, 12);
      drawDistantCathedral(W * 0.5, 134, 0.92);
      // Praça de mármore e pedra
      const fg = g.createLinearGradient(0, 140, 0, H);
      fg.addColorStop(0, '#44383e'); fg.addColorStop(1, '#1e181e');
      g.fillStyle = fg; g.fillRect(0, 140, W, H - 140);
      // Mansões nobres de mármore nas laterais
      [[6, 78, 98, 114], [280, 78, 98, 114]].forEach(([mx, my, mw, mh]) => {
        g.fillStyle = '#8b8086'; g.fillRect(mx, my, mw, mh);
        g.fillStyle = '#c8b8bc'; g.fillRect(mx + 6, my + 8, mw - 12, 6);
        // Colunas de mármore
        g.fillStyle = '#d8cfd2';
        for (let cx = mx + 12; cx < mx + mw - 8; cx += 22) g.fillRect(cx, my + 16, 7, mh - 20);
        // Friso dourado
        g.fillStyle = '#d4a017'; g.fillRect(mx, my + 12, mw, 4);
        // Janelas em chamas
        g.fillStyle = '#ff9824';
        g.fillRect(mx + 22, my + 34, 14, 22);
        g.fillRect(mx + mw - 36, my + 34, 14, 22);
        drawFireGlow(mx + mw * 0.5, my + 2, 34);
      });
      // Fonte central ornamentada
      g.fillStyle = '#6c646a'; g.fillRect(W * 0.5 - 38, 184, 76, 18);
      g.fillStyle = '#9a8f96'; g.fillRect(W * 0.5 - 10, 152, 20, 34);
      g.fillStyle = '#703038'; g.fillRect(W * 0.5 - 32, 186, 64, 6);
      // Postes aristocráticos
      [[126, 198], [258, 198]].forEach(([lx, ly]) => {
        g.fillStyle = '#20181c'; g.fillRect(lx - 2, ly - 56, 4, 56);
        g.fillStyle = '#d4a017'; g.fillRect(lx - 5, ly - 58, 10, 4);
        drawFireGlow(lx, ly - 62, 24, 'rgba(255,242,170,0.95)');
      });
      drawEmbers(45, '#ffd858', '#ff6424');
    } else if (key === 'a5') {
      // AVENIDA DO HORROR — avenida gótica, obelisco em chamas, pilares com piras, Ultra-Igreja gigante
      drawSky([[0, '#090210'], [0.42, '#34081c'], [0.76, '#841c18'], [1, '#c84214']]);
      drawPortal(W * 0.5, 32, 42, 13);
      drawDistantCathedral(W * 0.5, 138, 1.25);
      // Avenida em perspectiva
      const fg = g.createLinearGradient(0, 140, 0, H);
      fg.addColorStop(0, '#2c1e26'); fg.addColorStop(1, '#120a10');
      g.fillStyle = fg; g.fillRect(0, 140, W, H - 140);
      // Fissuras infernais no chão
      g.strokeStyle = 'rgba(255,70,20,0.65)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(W * 0.34, H); g.lineTo(W * 0.45, 175); g.lineTo(W * 0.42, 150); g.stroke();
      g.beginPath(); g.moveTo(W * 0.68, H); g.lineTo(W * 0.57, 180); g.lineTo(W * 0.60, 152); g.stroke();
      // Pilares góticos com fogo dos dois lados
      [[42, 224, 18, 118], [324, 224, 18, 118], [104, 186, 12, 76], [268, 186, 12, 76]].forEach(([px, py, pw, ph]) => {
        g.fillStyle = '#261420'; g.fillRect(px, py - ph, pw, ph);
        g.fillStyle = '#8a5a18'; g.fillRect(px - 2, py - ph, pw + 4, 4);
        drawFireGlow(px + pw / 2, py - ph - 6, pw * 1.5);
      });
      // Obelisco central em chamas
      g.fillStyle = '#1b0d16';
      g.fillRect(W * 0.5 - 10, 198, 20, 16);
      g.beginPath(); g.moveTo(W * 0.5 - 6, 198); g.lineTo(W * 0.5, 114); g.lineTo(W * 0.5 + 6, 198); g.fill();
      drawFireGlow(W * 0.5, 112, 24);
      drawEmbers(70, '#ffaa28', '#ff3c14');
    } else if (key === 'a6_nave') {
      // NAVE DA ULTRA-IGREJA — interior gótico monumental, pilares, bancos de madeira, vitrais e altar dourado
      drawSky([[0, '#090310'], [0.45, '#1d0a26'], [0.85, '#341028'], [1, '#1a0814']]);
      // Abóbadas góticas do teto em perspectiva
      g.strokeStyle = '#381a3e';
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const rx = 185 - t * 125, ry = 130 - t * 88;
        g.lineWidth = 4 - t * 2;
        g.beginPath();
        g.ellipse(W * 0.5, 116, rx, ry, 0, Math.PI, Math.PI * 2);
        g.stroke();
      }
      // Vitrais luminosos ao fundo da catedral
      const drawStainedGlass = (vx, vy, vw, vh) => {
        const vg = g.createLinearGradient(vx, vy, vx, vy + vh);
        vg.addColorStop(0, '#ff4020'); vg.addColorStop(0.5, '#d41848'); vg.addColorStop(1, '#ffaa28');
        g.fillStyle = vg;
        g.beginPath();
        g.moveTo(vx - vw / 2, vy + vh);
        g.lineTo(vx - vw / 2, vy + vh * 0.32);
        g.quadraticCurveTo(vx, vy - vh * 0.12, vx + vw / 2, vy + vh * 0.32);
        g.lineTo(vx + vw / 2, vy + vh);
        g.closePath();
        g.fill();
        drawFireGlow(vx, vy + vh * 0.45, vw * 1.4, 'rgba(255,100,60,0.35)');
      };
      drawStainedGlass(W * 0.5, 58, 36, 72);
      drawStainedGlass(W * 0.5 - 54, 72, 22, 54);
      drawStainedGlass(W * 0.5 + 54, 72, 22, 54);

      // Piso de mármore escuro em perspectiva com tapete carmesim central
      const fg = g.createLinearGradient(0, 146, 0, H);
      fg.addColorStop(0, '#2a1c2e'); fg.addColorStop(0.5, '#3b2c3e'); fg.addColorStop(1, '#18101c');
      g.fillStyle = fg;
      g.fillRect(0, 146, W, H - 146);
      // Tapete vermelho-sangue levando ao altar
      g.fillStyle = '#6c121e';
      g.beginPath();
      g.moveTo(W * 0.46, 148); g.lineTo(W * 0.54, 148);
      g.lineTo(W * 0.64, H); g.lineTo(W * 0.36, H);
      g.closePath(); g.fill();
      g.strokeStyle = '#d4a017'; g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(W * 0.465, 148); g.lineTo(W * 0.375, H);
      g.moveTo(W * 0.535, 148); g.lineTo(W * 0.625, H);
      g.stroke();

      // Bancos de madeira nas laterais do corredor
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const y = 160 + t * 84;
        const h = 5 + t * 11;
        const inner = 26 + t * 44;
        const bw = 42 + t * 62;
        g.fillStyle = '#2d1812';
        g.fillRect(W * 0.5 - inner - bw, y, bw, h);
        g.fillRect(W * 0.5 + inner, y, bw, h);
        g.fillStyle = '#4a281a';
        g.fillRect(W * 0.5 - inner - bw, y, bw, 2);
        g.fillRect(W * 0.5 + inner, y, bw, 2);
      }

      // Colunata de pilares góticos com tochas dos dois lados
      const pillars = [
        [24, 248, 30, 240], [330, 248, 30, 240],
        [76, 212, 20, 178], [288, 212, 20, 178],
        [114, 184, 14, 130], [256, 184, 14, 130],
        [142, 164, 9, 96], [233, 164, 9, 96]
      ];
      pillars.forEach(([px, py, pw, ph]) => {
        g.fillStyle = '#1b0d1e';
        g.fillRect(px, py - ph, pw, ph);
        g.fillStyle = '#341c38';
        g.fillRect(px + 2, py - ph, Math.max(2, pw * 0.28), ph);
        // Tocha brilhante no pilar
        const tx = px < W * 0.5 ? px + pw + 2 : px - 2;
        const ty = py - ph * 0.45;
        drawFireGlow(tx, ty, pw * 1.1, 'rgba(255,220,120,0.92)');
      });

      // Altar monumental de mármore e ouro ao fundo + Cruz Radiante
      g.fillStyle = '#9a8c96';
      g.fillRect(W * 0.5 - 32, 144, 64, 14);
      g.fillStyle = '#c8bcc4';
      g.fillRect(W * 0.5 - 24, 136, 48, 10);
      g.fillStyle = '#d4a017';
      g.fillRect(W * 0.5 - 26, 136, 52, 2.5);
      // Cruz dourada brilhante sobre o altar
      drawFireGlow(W * 0.5, 114, 34, 'rgba(255,215,100,0.65)');
      g.fillStyle = '#f2c83a';
      g.fillRect(W * 0.5 - 3, 92, 6, 44);
      g.fillRect(W * 0.5 - 15, 104, 30, 5);
      drawEmbers(45, '#ffd860', '#c050ff');
    } else {
      // PORTÕES DA ULTRA-IGREJA (a6_gate) — fachada colossal da catedral, torres gêmeas, cruz dourada, rosácea
      drawSky([[0, '#07010d'], [0.4, '#2a061c'], [0.75, '#7a141c'], [1, '#b83214']]);
      drawPortal(W * 0.5, 24, 46, 12);
      // Pátio da catedral
      const fg = g.createLinearGradient(0, 176, 0, H);
      fg.addColorStop(0, '#2a1c26'); fg.addColorStop(1, '#100810');
      g.fillStyle = fg; g.fillRect(0, 176, W, H - 176);
      // Mega-estrutura da Ultra-Igreja ocupando o quadro
      g.fillStyle = '#200f1c';
      g.fillRect(54, 72, 276, 112);
      // Torres gêmeas monumentais
      g.fillStyle = '#281324';
      g.fillRect(58, 26, 56, 158);
      g.fillRect(270, 26, 56, 158);
      // Agulhas das torres
      g.fillStyle = '#140812';
      g.beginPath(); g.moveTo(52, 28); g.lineTo(86, 2); g.lineTo(120, 28); g.fill();
      g.beginPath(); g.moveTo(264, 28); g.lineTo(298, 2); g.lineTo(332, 28); g.fill();
      // Chamas no alto das torres
      drawFireGlow(86, 38, 26);
      drawFireGlow(298, 38, 26);
      // Grande Cruz Dourada central
      g.fillStyle = '#f0be2c';
      g.fillRect(W * 0.5 - 5, 24, 10, 62);
      g.fillRect(W * 0.5 - 24, 42, 48, 9);
      drawFireGlow(W * 0.5, 48, 36, 'rgba(255,225,110,0.55)');
      // Rosácea escarlate brilhante
      drawFireGlow(W * 0.5, 114, 30, 'rgba(255,80,30,0.95)');
      g.fillStyle = '#ff3a10';
      g.beginPath(); g.arc(W * 0.5, 114, 16, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#180810'; g.lineWidth = 2;
      g.beginPath(); g.arc(W * 0.5, 114, 16, 0, Math.PI * 2); g.stroke();
      // Portal interno escuro da catedral
      g.fillStyle = '#090308';
      g.fillRect(W * 0.5 - 26, 144, 52, 40);
      // Colunata do pátio com piras
      [[38, 232], [346, 232], [116, 206], [268, 206]].forEach(([px, py]) => {
        g.fillStyle = '#241120'; g.fillRect(px - 7, py - 52, 14, 52);
        drawFireGlow(px, py - 56, 20);
      });
      drawFireGlow(W * 0.5, 214, 28);
      drawEmbers(75, '#ffcc40', '#ff4418');
    }

    // Granulação sutil e vinheta fotográfica para dar profundidade atrás da grade
    for (let i = 0; i < 420; i++) {
      g.fillStyle = pr() > 0.5 ? 'rgba(255,220,180,0.04)' : 'rgba(0,0,0,0.08)';
      g.fillRect(Math.floor(pr() * W), Math.floor(pr() * H), 2, 2);
    }
    const vig = g.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, W * 0.66);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.52)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);

    const t = new THREE.CanvasTexture(c);
    t.magFilter = curFilter;
    t.minFilter = curFilter;
    previewCache[key] = t;

    // Carrega foto real capturada do jogo (assets/previews/<mapId>.jpg) sobre o canvas
    if (key && key !== 'default' && typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        t.needsUpdate = true;
      };
      img.src = 'assets/previews/' + key + '.jpg';
    }

    return t;
  }

  // Placa luminosa no topo do portão de saída ("SAÍDA · PRÓXIMA ÁREA")
  const signCache = {};
  function exitSignTexture(nextLabel, accentHex) {
    const accent = accentHex || '#f0be2c';
    const key = (nextLabel || 'SAÍDA') + '|' + accent;
    if (signCache[key]) return signCache[key];
    const W = 512, H = 128;
    const c = cv(W, H), g = c.getContext('2d');
    // Fundo escuro metálico
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1e1010');
    bg.addColorStop(0.5, '#12080a');
    bg.addColorStop(1, '#201012');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // Moldura brilhante dupla
    g.strokeStyle = accent;
    g.lineWidth = 6;
    g.strokeRect(5, 5, W - 10, H - 10);
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 2;
    g.strokeRect(13, 13, W - 26, H - 26);
    // Rebites nos cantos
    g.fillStyle = accent;
    [[20, 20], [W - 20, 20], [20, H - 20], [W - 20, H - 20]].forEach(([rx, ry]) => {
      g.beginPath(); g.arc(rx, ry, 4, 0, Math.PI * 2); g.fill();
    });
    // Cabeçalho SAÍDA
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 24px Georgia, serif';
    g.fillStyle = '#50ff9e';
    g.fillText('✦  SAÍDA · PRÓXIMA FASE  ✦', W / 2, 37);
    // Nome da próxima fase
    const lbl = String(nextLabel || 'PRÓXIMA ÁREA').toUpperCase();
    let fsize = 34;
    if (lbl.length > 22) fsize = 26;
    else if (lbl.length > 17) fsize = 30;
    g.font = 'bold ' + fsize + 'px Georgia, serif';
    g.fillStyle = '#000000';
    g.fillText(lbl, W / 2 + 2, 86);
    g.fillStyle = '#fff2c8';
    g.fillText(lbl, W / 2, 84);

    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    signCache[key] = t;
    return t;
  }

  function setFilter(mode) {
    const f = mode === 'linear' ? THREE.LinearFilter : THREE.NearestFilter;
    if (curFilter === f) return;
    curFilter = f;
    for (const k in cache) {
      const t = cache[k];
      if (t) { t.magFilter = f; t.minFilter = f; t.needsUpdate = true; }
    }
    for (const k in previewCache) {
      const t = previewCache[k];
      if (t) { t.magFilter = f; t.minFilter = f; t.needsUpdate = true; }
    }
    if (skyTex) { skyTex.magFilter = f; skyTex.minFilter = f; skyTex.needsUpdate = true; }
  }

  return { get, mat, skyTexture, levelPreviewTexture, exitSignTexture, setFilter };
})();
