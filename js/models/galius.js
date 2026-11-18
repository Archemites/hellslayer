'use strict';

function buildGalius() {
  const s = 3.55, w = 1.62;
  const root = new THREE.Group();
  const rig = { root, h: 2.85 * s };
  // Pele branco giz cadavérica, sombras cinza-giz, carne viva e ossos expostos
  const SKIN_G = 0xf2efe9, SKIN_SH = 0xd6d1c8, SKIN_DK = 0x9b968d, FLESH_G = 0x7c121a, RAGS_G = 0x22242c, BONE_G = 0xc8bfa8, CHAIN_G = 0x3d4048;

  // Pernas mais altas, bem gordas e inchadas (branco giz) com dobras, trapos e ossos expostos
  rig.legL = limb(root, 0.46 * s * w, 1.32 * s, 0.48 * s, SKIN_G, -0.26 * s * w, 1.32 * s, 0);
  rig.legR = limb(root, 0.46 * s * w, 1.32 * s, 0.48 * s, SKIN_G, 0.26 * s * w, 1.32 * s, 0);
  // Coxas e panturrilhas gordas com dobras pendentes
  part(rig.legL, 0.54 * s * w, 0.46 * s, 0.54 * s, SKIN_SH, -0.02 * s, -0.32 * s, 0.03 * s);
  part(rig.legR, 0.54 * s * w, 0.46 * s, 0.54 * s, SKIN_SH, 0.02 * s, -0.32 * s, 0.03 * s);
  part(rig.legL, 0.48 * s * w, 0.46 * s, 0.50 * s, RAGS_G, 0, -0.78 * s, 0);
  part(rig.legR, 0.48 * s * w, 0.48 * s, 0.50 * s, RAGS_G, 0, -0.76 * s, 0);
  // Pés gordos e deformados
  part(rig.legL, 0.46 * s * w, 0.18 * s, 0.58 * s, SKIN_SH, 0, -1.23 * s, 0.06 * s);
  part(rig.legR, 0.46 * s * w, 0.18 * s, 0.58 * s, SKIN_SH, 0, -1.23 * s, 0.06 * s);
  // Estilhaço de osso e carne viva nos joelhos
  const kBoneL = part(rig.legL, 0.10 * s, 0.24 * s, 0.10 * s, BONE_G, -0.06 * s, -0.52 * s, 0.25 * s);
  kBoneL.rotation.x = 0.6;
  part(rig.legR, 0.18 * s, 0.20 * s, 0.16 * s, FLESH_G, 0.08 * s, -0.52 * s, 0.22 * s);

  // Torso bem gordão branco giz com pança saliente e caixa torácica aberta no peito
  rig.torso = part(root, 1.02 * s * w, 1.02 * s, 0.62 * s, SKIN_G, 0, 1.82 * s, 0);
  // Pança enorme e caída na parte inferior do torso
  part(rig.torso, 1.12 * s * w, 0.54 * s, 0.58 * s, SKIN_G, 0, -0.26 * s, 0.16 * s);
  part(rig.torso, 1.04 * s * w, 0.24 * s, 0.50 * s, SKIN_SH, 0, -0.48 * s, 0.14 * s);
  // Dobras laterais de gordura e massas assimétricas nos ombros
  part(rig.torso, 0.44 * s, 0.46 * s, 0.48 * s, SKIN_SH, -0.44 * s * w, 0.24 * s, 0.02 * s);
  part(rig.torso, 0.42 * s, 0.42 * s, 0.46 * s, SKIN_SH, 0.44 * s * w, 0.20 * s, 0.02 * s);
  part(rig.torso, 0.28 * s, 0.26 * s, 0.26 * s, FLESH_G, -0.48 * s * w, 0.34 * s, 0.08 * s);

  // Caixa torácica aberta (bem visível acima da pança) com borda de carne viva e costelas abertas
  part(rig.torso, 0.64 * s, 0.58 * s, 0.12 * s, FLESH_G, 0, 0.20 * s, 0.28 * s);
  part(rig.torso, 0.54 * s, 0.50 * s, 0.12 * s, 0x1a0205, 0, 0.20 * s, 0.30 * s);
  for (let i = -1; i <= 1; i += 2) {
    const r1 = part(rig.torso, 0.22 * s, 0.065 * s, 0.08 * s, BONE_G, i * 0.24 * s, 0.34 * s, 0.33 * s);
    r1.rotation.set(0, i * -0.35, i * 0.22);
    const r2 = part(rig.torso, 0.24 * s, 0.065 * s, 0.08 * s, BONE_G, i * 0.26 * s, 0.20 * s, 0.34 * s);
    r2.rotation.set(0, i * -0.42, i * -0.06);
    const r3 = part(rig.torso, 0.20 * s, 0.06 * s, 0.08 * s, BONE_G, i * 0.23 * s, 0.06 * s, 0.33 * s);
    r3.rotation.set(0, i * -0.35, i * -0.24);
  }
  // Coração Ateu biológico pulsante bem exposto dentro da caixa torácica aberta
  rig.heart = bioHeart(2.25 * s);
  rig.heart.position.set(0, 0.20 * s, 0.33 * s);
  rig.torso.add(rig.heart);

  // Correntes enferrujadas e trapos rasgados na cintura gorda (presos ao torso para balangar junto)
  part(rig.torso, 1.14 * s * w, 0.08 * s, 0.66 * s, CHAIN_G, 0, -0.32 * s, 0.06 * s);
  part(rig.torso, 1.16 * s * w, 0.14 * s, 0.68 * s, RAGS_G, 0, -0.46 * s, 0.06 * s);

  // Vértebras tortas e estilhaços de osso rasgando as costas
  for (let i = 0; i < 5; i++) {
    const sp = part(rig.torso, 0.10 * s, 0.24 * s, 0.12 * s, BONE_G, (i % 2 === 0 ? -0.04 : 0.05) * s, (0.38 - i * 0.18) * s, -0.33 * s);
    sp.rotation.x = -0.45 - (i % 2) * 0.25;
    sp.rotation.z = (i % 2 === 0 ? 0.15 : -0.18);
  }

  // Cabeça de morto reanimado: branco giz, papada gorda, órbitas profundas e olhos mortos
  rig.head = part(root, 0.48 * s, 0.50 * s, 0.48 * s, SKIN_G, 0, 2.50 * s, 0.06 * s);
  // Papada / pescoço gordo cadavérico
  part(rig.head, 0.54 * s, 0.18 * s, 0.44 * s, SKIN_SH, 0, -0.24 * s, -0.02 * s);
  // Carne exposta e cicatriz costurada na testa/têmpora
  part(rig.head, 0.16 * s, 0.16 * s, 0.16 * s, FLESH_G, -0.20 * s, 0.16 * s, -0.02 * s);
  part(rig.head, 0.22 * s, 0.03 * s, 0.03 * s, SKIN_DK, 0.06 * s, 0.14 * s, 0.235 * s);
  for (const sx of [-0.02, 0.04, 0.10, 0.15]) {
    part(rig.head, 0.02 * s, 0.07 * s, 0.03 * s, 0x2a181c, sx * s, 0.14 * s, 0.24 * s);
  }
  // Órbitas oculares fundas e olheiras de defunto, com olhos mortos leitosos sem vida
  part(rig.head, 0.14 * s, 0.12 * s, 0.04 * s, 0x18181c, -0.11 * s, 0.05 * s, 0.232 * s);
  part(rig.head, 0.14 * s, 0.12 * s, 0.04 * s, 0x18181c, 0.11 * s, 0.05 * s, 0.232 * s);
  part(rig.head, 0.065 * s, 0.055 * s, 0.03 * s, 0xd8dcd6, -0.11 * s, 0.05 * s, 0.244 * s, { basic: true });
  part(rig.head, 0.065 * s, 0.055 * s, 0.03 * s, 0xd8dcd6, 0.11 * s, 0.05 * s, 0.244 * s, { basic: true });
  part(rig.head, 0.025 * s, 0.025 * s, 0.032 * s, 0x4a5250, -0.11 * s, 0.05 * s, 0.248 * s, { basic: true });
  part(rig.head, 0.025 * s, 0.025 * s, 0.032 * s, 0x4a5250, 0.11 * s, 0.05 * s, 0.248 * s, { basic: true });
  // Nariz afundado de cadáver
  part(rig.head, 0.07 * s, 0.08 * s, 0.04 * s, 0x2a2426, 0, -0.02 * s, 0.24 * s);
  // Cavidade bucal e dentes superiores
  part(rig.head, 0.28 * s, 0.14 * s, 0.06 * s, 0x1a0306, 0, -0.12 * s, 0.228 * s, { basic: true });
  for (const fx of [-0.09, -0.04, 0.01, 0.06, 0.10]) {
    part(rig.head, 0.028 * s, 0.05 * s, 0.03 * s, BONE_G, fx * s, -0.08 * s, 0.244 * s, { basic: true });
  }
  // Mandíbula inferior articulada (para morder a cabeça do Nivaldo!)
  rig.jaw = new THREE.Group();
  rig.jaw.position.set(0, -0.16 * s, 0.08 * s);
  part(rig.jaw, 0.34 * s, 0.11 * s, 0.28 * s, SKIN_SH, 0, -0.04 * s, 0.06 * s);
  for (const fx of [-0.07, -0.01, 0.05]) {
    part(rig.jaw, 0.028 * s, 0.05 * s, 0.03 * s, BONE_G, fx * s, 0.02 * s, 0.165 * s, { basic: true });
  }
  rig.head.add(rig.jaw);

  // Braços gordos e pesados branco giz para segurar a Super-Cruz com as duas mãos
  rig.armL = limb(root, 0.30 * s * w, 0.96 * s, 0.32 * s, SKIN_G, -0.62 * s * w, 2.24 * s, 0);
  part(rig.armL, 0.34 * s * w, 0.36 * s, 0.34 * s, FLESH_G, -0.03 * s, -0.34 * s, 0);
  part(rig.armL, 0.28 * s * w, 0.16 * s, 0.28 * s, CHAIN_G, 0, -0.72 * s, 0);

  rig.armR = limb(root, 0.30 * s * w, 0.96 * s, 0.32 * s, SKIN_G, 0.62 * s * w, 2.24 * s, 0);
  part(rig.armR, 0.34 * s * w, 0.36 * s, 0.34 * s, SKIN_SH, 0.03 * s, -0.34 * s, 0);
  part(rig.armR, 0.28 * s * w, 0.16 * s, 0.28 * s, CHAIN_G, 0, -0.72 * s, 0);

  // Super-Cruz Dourada gigante segurada com as duas mãos na frente do corpo
  part(rig.armR, 0.14 * s, 0.16 * s, 0.14 * s, 0x5a3820, 0, -0.94 * s, 0);
  rig.weapon = new THREE.Group();
  rig.weapon.position.set(0, -0.94 * s, 0.08 * s);
  part(rig.weapon, 0.28 * s, 3.4 * s, 0.28 * s, 0xd4a017, 0, -0.75 * s, 0, { em: 0x3a2800 });
  part(rig.weapon, 1.5 * s, 0.28 * s, 0.28 * s, 0xd4a017, 0, -1.65 * s, 0, { em: 0x3a2800 });
  part(rig.weapon, 0.34 * s, 0.34 * s, 0.34 * s, 0xfff0a0, 0, -1.65 * s, 0, { basic: true });
  rig.weapon.rotation.z = -1.21;
  rig.armR.add(rig.weapon);
  // Pose inicial com as duas mãos juntas segurando o cabo da cruz
  rig.armL.rotation.set(-1.12, 0.22, 0.62);
  rig.armR.rotation.set(-1.12, -0.18, -0.44);

  return rig;
}

BUILD.galius = buildGalius;
