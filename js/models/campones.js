'use strict';

function buildCampones() {
  const s = 0.85;
  const root = new THREE.Group();
  const rig = { root, h: 2.35 * s };

  // Paleta baseada na referência do aldeão zumbi (pele pálida/cadavérica, camisa bege ensanguentada, colete marrom, calça rasgada, botas diferentes)
  const SKIN_BASE = 0x8c7765;
  const SKIN_SH   = 0x675446;
  const SKIN_DARK = 0x4b3b30;
  const SKIN_HI   = 0x9e8976;
  const SHIRT_BASE = 0xb5a692;
  const SHIRT_SH   = 0x8f806d;
  const SHIRT_DIRT = 0x6f6150;
  const VEST_BASE  = 0x4d3423;
  const VEST_DARK  = 0x362316;
  const VEST_EDGE  = 0x60432e;
  const PANTS_BASE = 0x3a322d;
  const PANTS_WORN = 0x4c423a;
  const PANTS_DARK = 0x26201c;
  const BOOT_L_BASE = 0x6b3b22;
  const BOOT_L_HI   = 0x7e482b;
  const BOOT_R_BASE = 0x4d433a;
  const BOOT_R_HI   = 0x5d5146;
  const SOLE_COL    = 0x1e1612;
  const HAIR_BASE   = 0x241a14;
  const HAIR_DARK   = 0x160f0b;
  const BLOOD_1     = 0x6e0b0d;
  const BLOOD_2     = 0x4a0708;
  const BLOOD_3     = 0x8a1214;

  // Pernas: calça marrom-acinzentada rasgada nos joelhos/coxas + botas pesadas assimétricas
  const mkLeg = (side) => {
    const l = limb(root, 0.28 * s, 0.95 * s, 0.30 * s, PANTS_BASE, side * 0.19 * s, 0.95 * s, 0);
    // Coxa e tecido amassado
    part(l, 0.30 * s, 0.36 * s, 0.32 * s, PANTS_BASE, 0, -0.18 * s, 0);
    part(l, 0.14 * s, 0.18 * s, 0.33 * s, PANTS_WORN, side * 0.06 * s, -0.16 * s, 0.005 * s);
    part(l, 0.12 * s, 0.14 * s, 0.33 * s, PANTS_DARK, -side * 0.07 * s, -0.28 * s, 0.005 * s);

    // Rasgos na calça expondo carne pálida e sangue (como na foto)
    if (side < 0) {
      // Perna esquerda: rasgo grande na coxa/joelho
      part(l, 0.13 * s, 0.16 * s, 0.03 * s, SKIN_SH, -0.02 * s, -0.36 * s, 0.155 * s);
      part(l, 0.09 * s, 0.11 * s, 0.035 * s, BLOOD_1, -0.01 * s, -0.37 * s, 0.158 * s);
      part(l, 0.14 * s, 0.12 * s, 0.03 * s, BLOOD_2, 0.04 * s, -0.22 * s, 0.158 * s);
    } else {
      // Perna direita: rasgo lateral no joelho e mancha de sangue
      part(l, 0.12 * s, 0.15 * s, 0.03 * s, SKIN_SH, 0.03 * s, -0.40 * s, 0.155 * s);
      part(l, 0.08 * s, 0.10 * s, 0.035 * s, BLOOD_1, 0.02 * s, -0.41 * s, 0.158 * s);
      part(l, 0.11 * s, 0.14 * s, 0.03 * s, BLOOD_2, -0.04 * s, -0.20 * s, 0.158 * s);
    }

    // Boca da calça dobrada/amassada acima da bota
    part(l, 0.31 * s, 0.14 * s, 0.33 * s, PANTS_WORN, 0, -0.50 * s, 0);
    part(l, 0.29 * s, 0.06 * s, 0.31 * s, PANTS_DARK, 0, -0.56 * s, 0);

    // Bota pesada (esquerda marrom-avermelhada, direita cinza-marrom enlameada)
    const bBase = side < 0 ? BOOT_L_BASE : BOOT_R_BASE;
    const bHi   = side < 0 ? BOOT_L_HI : BOOT_R_HI;
    part(l, 0.29 * s, 0.30 * s, 0.31 * s, bBase, 0, -0.73 * s, 0);
    part(l, 0.30 * s, 0.06 * s, 0.32 * s, bHi, 0, -0.60 * s, 0); // borda do cano
    part(l, 0.28 * s, 0.14 * s, 0.38 * s, bBase, 0, -0.84 * s, 0.04 * s); // peito do pé/biqueira
    part(l, 0.26 * s, 0.08 * s, 0.12 * s, bHi, 0, -0.85 * s, 0.18 * s); // bico da bota
    part(l, 0.29 * s, 0.05 * s, 0.40 * s, SOLE_COL, 0, -0.925 * s, 0.04 * s); // sola
    return l;
  };
  rig.legL = mkLeg(-1);
  rig.legR = mkLeg(1);

  // Tronco: camisa bege/suja aberta no colarinho e ensanguentada + colete marrom aberto
  rig.torso = part(root, 0.76 * s, 0.92 * s, 0.42 * s, SHIRT_BASE, 0, 1.40 * s, 0);
  const T = rig.torso;

  // Abertura em V no peito mostrando pescoço/peito cadavérico e sangue
  part(T, 0.22 * s, 0.24 * s, 0.04 * s, SKIN_SH, 0, 0.34 * s, 0.20 * s);
  part(T, 0.14 * s, 0.16 * s, 0.045 * s, BLOOD_1, 0, 0.31 * s, 0.202 * s);
  // Gola aberta da camisa
  part(T, 0.12 * s, 0.14 * s, 0.08 * s, SHIRT_SH, -0.14 * s, 0.39 * s, 0.19 * s);
  part(T, 0.12 * s, 0.14 * s, 0.08 * s, SHIRT_SH, 0.14 * s, 0.39 * s, 0.19 * s);
  // Carcela de botões no centro
  part(T, 0.06 * s, 0.68 * s, 0.025 * s, SHIRT_SH, 0, -0.10 * s, 0.208 * s);
  for (let i = 0; i < 4; i++) {
    part(T, 0.025 * s, 0.025 * s, 0.03 * s, 0x2c241d, 0, (0.14 - i * 0.14) * s, 0.212 * s);
  }

  // Manchas de sangue pesadas na frente da camisa (como na referência)
  part(T, 0.28 * s, 0.34 * s, 0.025 * s, BLOOD_1, -0.06 * s, 0.02 * s, 0.212 * s);
  part(T, 0.18 * s, 0.22 * s, 0.03 * s, BLOOD_2, -0.04 * s, -0.04 * s, 0.214 * s);
  part(T, 0.16 * s, 0.20 * s, 0.025 * s, BLOOD_3, 0.07 * s, 0.12 * s, 0.212 * s);
  part(T, 0.20 * s, 0.18 * s, 0.025 * s, BLOOD_1, 0.04 * s, -0.24 * s, 0.212 * s);
  part(T, 0.34 * s, 0.20 * s, 0.025 * s, SHIRT_DIRT, 0.02 * s, -0.34 * s, 0.208 * s);

  // Barra da camisa rasgada/irregular pendendo abaixo da cintura
  part(T, 0.24 * s, 0.14 * s, 0.04 * s, SHIRT_BASE, -0.15 * s, -0.49 * s, 0.19 * s);
  part(T, 0.18 * s, 0.10 * s, 0.04 * s, BLOOD_1, -0.12 * s, -0.48 * s, 0.195 * s);
  part(T, 0.22 * s, 0.11 * s, 0.04 * s, SHIRT_SH, 0.14 * s, -0.47 * s, 0.19 * s);
  part(T, 0.72 * s, 0.10 * s, 0.06 * s, SHIRT_DIRT, 0, -0.47 * s, -0.18 * s);

  // Colete rústico marrom aberto (abas frontais + costas + ombros)
  part(T, 0.25 * s, 0.88 * s, 0.08 * s, VEST_BASE, -0.26 * s, 0.02 * s, 0.19 * s);
  part(T, 0.25 * s, 0.88 * s, 0.08 * s, VEST_BASE, 0.26 * s, 0.02 * s, 0.19 * s);
  part(T, 0.05 * s, 0.84 * s, 0.09 * s, VEST_EDGE, -0.15 * s, 0.02 * s, 0.195 * s);
  part(T, 0.05 * s, 0.84 * s, 0.09 * s, VEST_EDGE, 0.15 * s, 0.02 * s, 0.195 * s);
  // Laterais e costas do colete
  part(T, 0.80 * s, 0.86 * s, 0.10 * s, VEST_DARK, 0, 0.03 * s, -0.19 * s);
  part(T, 0.06 * s, 0.84 * s, 0.44 * s, VEST_BASE, -0.37 * s, 0.03 * s, 0);
  part(T, 0.06 * s, 0.84 * s, 0.44 * s, VEST_BASE, 0.37 * s, 0.03 * s, 0);
  // Pontas inferiores do colete
  part(T, 0.20 * s, 0.10 * s, 0.07 * s, VEST_DARK, -0.26 * s, -0.45 * s, 0.185 * s);
  part(T, 0.20 * s, 0.10 * s, 0.07 * s, VEST_DARK, 0.26 * s, -0.45 * s, 0.185 * s);

  // Cabeça: rosto cadavérico, olhos brancos fundos, boca aberta gritando com dentes e barba/cabelo despenteado
  rig.head = part(root, 0.44 * s, 0.48 * s, 0.44 * s, SKIN_BASE, 0, 2.10 * s, 0);
  const H = rig.head;

  // Pescoço fino e ensanguentado
  part(H, 0.22 * s, 0.16 * s, 0.22 * s, SKIN_SH, 0, -0.26 * s, 0);
  part(H, 0.14 * s, 0.12 * s, 0.23 * s, BLOOD_2, 0, -0.25 * s, 0.01 * s);

  // Arcada supraciliar marcada + maçãs do rosto fundas + nariz fino
  part(H, 0.42 * s, 0.07 * s, 0.06 * s, SKIN_SH, 0, 0.10 * s, 0.21 * s);
  part(H, 0.10 * s, 0.12 * s, 0.05 * s, SKIN_DARK, -0.16 * s, -0.02 * s, 0.205 * s);
  part(H, 0.10 * s, 0.12 * s, 0.05 * s, SKIN_DARK, 0.16 * s, -0.02 * s, 0.205 * s);
  part(H, 0.07 * s, 0.10 * s, 0.06 * s, SKIN_HI, 0, 0.01 * s, 0.23 * s);

  // Órbitas fundas escuras + olhos branco-leitosos de morto-vivo
  part(H, 0.13 * s, 0.08 * s, 0.03 * s, 0x1e1210, -0.10 * s, 0.05 * s, 0.215 * s);
  part(H, 0.13 * s, 0.08 * s, 0.03 * s, 0x1e1210, 0.10 * s, 0.05 * s, 0.215 * s);
  part(H, 0.06 * s, 0.045 * s, 0.02 * s, 0xdcd6c8, -0.10 * s, 0.05 * s, 0.226 * s, { basic: true });
  part(H, 0.06 * s, 0.045 * s, 0.02 * s, 0xdcd6c8, 0.10 * s, 0.05 * s, 0.226 * s, { basic: true });

  // Boca aberta gritando com dentes podres e sangue no queixo
  part(H, 0.18 * s, 0.13 * s, 0.04 * s, 0x180506, 0, -0.10 * s, 0.214 * s, { basic: true });
  part(H, 0.13 * s, 0.028 * s, 0.03 * s, 0xc8bc98, 0, -0.055 * s, 0.224 * s); // dentes superiores
  part(H, 0.12 * s, 0.025 * s, 0.03 * s, 0xb8ac88, 0, -0.145 * s, 0.224 * s); // dentes inferiores
  part(H, 0.14 * s, 0.06 * s, 0.03 * s, BLOOD_1, 0, -0.19 * s, 0.218 * s);

  // Bigode e cavanhaque despenteados ao redor da boca
  part(H, 0.20 * s, 0.035 * s, 0.04 * s, HAIR_BASE, 0, -0.035 * s, 0.22 * s);
  part(H, 0.05 * s, 0.14 * s, 0.04 * s, HAIR_BASE, -0.11 * s, -0.12 * s, 0.218 * s);
  part(H, 0.05 * s, 0.14 * s, 0.04 * s, HAIR_BASE, 0.11 * s, -0.12 * s, 0.218 * s);
  part(H, 0.16 * s, 0.09 * s, 0.06 * s, HAIR_BASE, 0, -0.22 * s, 0.20 * s);
  part(H, 0.09 * s, 0.07 * s, 0.05 * s, HAIR_DARK, 0, -0.26 * s, 0.19 * s);

  // Cabelo ralo/despenteado no topo, têmporas e nuca
  part(H, 0.46 * s, 0.10 * s, 0.46 * s, HAIR_BASE, 0, 0.23 * s, -0.01 * s);
  part(H, 0.18 * s, 0.09 * s, 0.08 * s, HAIR_DARK, -0.15 * s, 0.19 * s, 0.20 * s);
  part(H, 0.16 * s, 0.08 * s, 0.08 * s, HAIR_BASE, 0.16 * s, 0.18 * s, 0.20 * s);
  part(H, 0.06 * s, 0.26 * s, 0.36 * s, HAIR_BASE, -0.23 * s, 0.08 * s, -0.02 * s);
  part(H, 0.06 * s, 0.26 * s, 0.36 * s, HAIR_BASE, 0.23 * s, 0.08 * s, -0.02 * s);
  part(H, 0.44 * s, 0.32 * s, 0.06 * s, HAIR_DARK, 0, 0.06 * s, -0.23 * s);

  // Braços: mangas da camisa arregaçadas + antebraços expostos e ensanguentados
  const mkArm = (side) => {
    const a = limb(root, 0.21 * s, 0.90 * s, 0.21 * s, SKIN_BASE, side * 0.51 * s, 1.80 * s, 0);
    // Manga da camisa até o meio do braço
    part(a, 0.25 * s, 0.42 * s, 0.25 * s, SHIRT_BASE, 0, -0.21 * s, 0);
    part(a, 0.26 * s, 0.07 * s, 0.26 * s, SHIRT_SH, 0, -0.41 * s, 0); // dobra arregaçada
    part(a, 0.14 * s, 0.20 * s, 0.26 * s, BLOOD_1, side * 0.03 * s, -0.24 * s, 0.01 * s);
    // Antebraço exposto com manchas de sangue e mãos cadavéricas
    part(a, 0.19 * s, 0.24 * s, 0.19 * s, SKIN_SH, 0, -0.60 * s, 0);
    part(a, 0.12 * s, 0.22 * s, 0.20 * s, BLOOD_1, 0, -0.64 * s, 0.015 * s);
    part(a, 0.18 * s, 0.14 * s, 0.20 * s, BLOOD_2, 0, -0.83 * s, 0.01 * s);
    return a;
  };
  rig.armL = mkArm(-1);
  rig.armR = mkArm(1);
  rig.armL.rotation.x = -1.3;
  rig.armR.rotation.x = -1.3;

  // Forcado opcional (40% de chance, preservando variedade original)
  if (Math.random() < 0.4) {
    rig.pitchfork = new THREE.Group();
    part(rig.pitchfork, 0.06 * s, 1.45 * s, 0.06 * s, 0x5a3a1c, 0, -1.325 * s, 0);
    part(rig.pitchfork, 0.3 * s, 0.06 * s, 0.05 * s, 0x909090, 0, -2.05 * s, 0);
    for (let i = -1; i <= 1; i++) part(rig.pitchfork, 0.04 * s, 0.3 * s, 0.04 * s, 0x909090, i * 0.12 * s, -2.2 * s, 0);
    rig.armR.add(rig.pitchfork);
  }

  return rig;
}

BUILD.campones = buildCampones;
