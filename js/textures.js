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
  function mk(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
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
  function skyTexture() {
    const c = cv(8, 128), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#070006');
    gr.addColorStop(0.45, '#3a0808');
    gr.addColorStop(0.7, '#a02808');
    gr.addColorStop(1, '#d05010');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    return t;
  }

  return { get, mat, skyTexture };
})();
