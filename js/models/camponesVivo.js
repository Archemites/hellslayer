'use strict';

function buildCamponesVivo(v) {
  const s = 0.86;
  const root = new THREE.Group();
  const rig = { root, h: 2.35 * s };

  // 4 variantes baseadas no modelo de camponês medieval desgastado:
  // 0: Clássico (referência base — cabelo/barba castanho escuro, camisa creme suja, colete marrom, calça remendada)
  // 1: Lenhador ruivo (boina escura, barba cheia ruiva, camisa aveia, colete verde-musgo)
  // 2: Camponês do campo (chapéu de palha, barba rala, colete ocre-ferrugem, calça carvão)
  // 3: Ancião grisalho (cabelo/barba grisalhos, lenço bordô no pescoço, camisa cinza-linho, colete escuro)
  const VARIANTS = [
    {
      skin: 0xc99674, skinSh: 0x9e6f52, skinDark: 0x785038, skinHi: 0xd9aa89,
      shirt: 0xc2b299, shirtSh: 0x9c8c74, shirtDirt: 0x7c6d58,
      vest: 0x4b3322, vestDark: 0x332115, vestEdge: 0x62442e,
      pants: 0x543c2c, pantsWorn: 0x664b38, pantsDark: 0x39281d, pantsPatch: 0x6f5440,
      boot: 0x442b1c, bootHi: 0x593926, wrap: 0x624632,
      hair: 0x2b1d14, hairDark: 0x1a100b, beard: 0x2b1d14,
      rope: 0x8e724e, ropeDark: 0x6b5336, pouch: 0x3e2618, pouchHi: 0x523422,
      hat: null, scarf: null, fullBeard: false
    },
    {
      skin: 0xd4a17e, skinSh: 0xa87656, skinDark: 0x80543b, skinHi: 0xe2b494,
      shirt: 0xb8aa8e, shirtSh: 0x92846b, shirtDirt: 0x71654f,
      vest: 0x3e4835, vestDark: 0x2a3124, vestEdge: 0x525e47,
      pants: 0x433d36, pantsWorn: 0x554e45, pantsDark: 0x2c2823, pantsPatch: 0x5e5245,
      boot: 0x342821, bootHi: 0x47372e, wrap: 0x524236,
      hair: 0x6e321a, hairDark: 0x4d2010, beard: 0x6e321a,
      rope: 0x8a704c, ropeDark: 0x665134, pouch: 0x382418, pouchHi: 0x4d3221,
      hat: 'cap', scarf: null, fullBeard: true
    },
    {
      skin: 0xb88460, skinSh: 0x8d6042, skinDark: 0x69442c, skinHi: 0xc99672,
      shirt: 0xcab99c, shirtSh: 0xa39276, shirtDirt: 0x82725a,
      vest: 0x633b24, vestDark: 0x452817, vestEdge: 0x7a4b30,
      pants: 0x38322e, pantsWorn: 0x4a423d, pantsDark: 0x24201d, pantsPatch: 0x5a4838,
      boot: 0x523624, bootHi: 0x684630, wrap: 0x70533c,
      hair: 0x241912, hairDark: 0x150e0a, beard: 0x35251b,
      rope: 0x987b54, ropeDark: 0x72593a, pouch: 0x462b1b, pouchHi: 0x5c3925,
      hat: 'straw', scarf: null, fullBeard: false
    },
    {
      skin: 0xd1a98c, skinSh: 0xa47c62, skinDark: 0x7b5a45, skinHi: 0xe0bca2,
      shirt: 0xa8a094, shirtSh: 0x857d72, shirtDirt: 0x676057,
      vest: 0x332924, vestDark: 0x211a16, vestEdge: 0x473a33,
      pants: 0x493528, pantsWorn: 0x5c4434, pantsDark: 0x31231a, pantsPatch: 0x644c3c,
      boot: 0x2f221b, bootHi: 0x423127, wrap: 0x544134,
      hair: 0x6c6864, hairDark: 0x4b4744, beard: 0x605c58,
      rope: 0x836a48, ropeDark: 0x604c32, pouch: 0x342015, pouchHi: 0x482d1e,
      hat: null, scarf: 0x6e2b24, fullBeard: true
    }
  ];

  const idx = ((v != null ? v : Math.floor(Math.random() * 4)) % 4 + 4) % 4;
  const C = VARIANTS[idx];
  const SOLE_COL = 0x1b1410;

  // Pernas: calça folgada com remendos/rasgos + faixas enroladas na canela + botas altas
  const mkLeg = (side) => {
    const l = limb(root, 0.30 * s, 0.95 * s, 0.32 * s, C.pants, side * 0.19 * s, 0.95 * s, 0);
    // Coxa larga e tecido dobrado
    part(l, 0.33 * s, 0.42 * s, 0.35 * s, C.pants, 0, -0.20 * s, 0);
    part(l, 0.31 * s, 0.14 * s, 0.33 * s, C.pantsWorn, 0, -0.45 * s, 0);

    // Remendos costurados e pequenos furos de desgaste (como na imagem base)
    if (side < 0) {
      part(l, 0.14 * s, 0.16 * s, 0.03 * s, C.pantsPatch, -0.04 * s, -0.22 * s, 0.17 * s);
      part(l, 0.06 * s, 0.07 * s, 0.03 * s, C.pantsDark, 0.06 * s, -0.35 * s, 0.168 * s);
    } else {
      part(l, 0.15 * s, 0.18 * s, 0.03 * s, C.pantsPatch, 0.03 * s, -0.32 * s, 0.17 * s);
      part(l, 0.07 * s, 0.06 * s, 0.03 * s, C.pantsDark, -0.05 * s, -0.18 * s, 0.168 * s);
    }

    // Dobra da calça acima da bota
    part(l, 0.32 * s, 0.08 * s, 0.34 * s, C.pantsDark, 0, -0.53 * s, 0);

    // Bota alta com tiras/faixas enroladas na canela
    part(l, 0.29 * s, 0.32 * s, 0.31 * s, C.boot, 0, -0.72 * s, 0);
    part(l, 0.305 * s, 0.045 * s, 0.325 * s, C.wrap, 0, -0.59 * s, 0);
    part(l, 0.305 * s, 0.045 * s, 0.325 * s, C.wrap, 0, -0.68 * s, 0);
    part(l, 0.305 * s, 0.045 * s, 0.325 * s, C.wrap, 0, -0.77 * s, 0);
    part(l, 0.28 * s, 0.13 * s, 0.38 * s, C.boot, 0, -0.84 * s, 0.04 * s);
    part(l, 0.26 * s, 0.08 * s, 0.12 * s, C.bootHi, 0, -0.85 * s, 0.18 * s);
    part(l, 0.29 * s, 0.05 * s, 0.40 * s, SOLE_COL, 0, -0.925 * s, 0.04 * s);
    return l;
  };
  rig.legL = mkLeg(-1);
  rig.legR = mkLeg(1);

  // Tronco: camisa de linho suja aberta no colarinho + colete aberto + cinto de corda + bolsa
  rig.torso = part(root, 0.76 * s, 0.92 * s, 0.42 * s, C.shirt, 0, 1.40 * s, 0);
  const T = rig.torso;

  // Abertura em V no colarinho mostrando peito/pescoço
  part(T, 0.20 * s, 0.22 * s, 0.04 * s, C.skinSh, 0, 0.35 * s, 0.20 * s);
  part(T, 0.11 * s, 0.14 * s, 0.07 * s, C.shirtSh, -0.13 * s, 0.39 * s, 0.19 * s);
  part(T, 0.11 * s, 0.14 * s, 0.07 * s, C.shirtSh, 0.13 * s, 0.39 * s, 0.19 * s);
  // Carcela central da camisa + dobras de sujeira
  part(T, 0.055 * s, 0.62 * s, 0.025 * s, C.shirtSh, 0, -0.08 * s, 0.208 * s);
  for (let i = 0; i < 3; i++) {
    part(T, 0.024 * s, 0.024 * s, 0.03 * s, 0x2c221a, 0, (0.14 - i * 0.14) * s, 0.212 * s);
  }
  part(T, 0.30 * s, 0.18 * s, 0.02 * s, C.shirtDirt, 0.02 * s, -0.28 * s, 0.206 * s);

  // Lenço opcional no pescoço (variante 3)
  if (C.scarf) {
    part(T, 0.34 * s, 0.11 * s, 0.32 * s, C.scarf, 0, 0.42 * s, 0.06 * s);
    part(T, 0.12 * s, 0.18 * s, 0.06 * s, C.scarf, 0.02 * s, 0.30 * s, 0.21 * s);
  }

  // Barra da camisa rasgada e irregular pendendo abaixo da cintura
  part(T, 0.24 * s, 0.13 * s, 0.04 * s, C.shirt, -0.14 * s, -0.49 * s, 0.19 * s);
  part(T, 0.20 * s, 0.10 * s, 0.04 * s, C.shirtSh, 0.13 * s, -0.47 * s, 0.19 * s);
  part(T, 0.72 * s, 0.10 * s, 0.06 * s, C.shirtDirt, 0, -0.47 * s, -0.18 * s);

  // Colete rústico aberto (frente, bordas, botões, laterais e costas)
  part(T, 0.24 * s, 0.86 * s, 0.08 * s, C.vest, -0.26 * s, 0.02 * s, 0.19 * s);
  part(T, 0.24 * s, 0.86 * s, 0.08 * s, C.vest, 0.26 * s, 0.02 * s, 0.19 * s);
  part(T, 0.045 * s, 0.82 * s, 0.09 * s, C.vestEdge, -0.15 * s, 0.02 * s, 0.195 * s);
  part(T, 0.045 * s, 0.82 * s, 0.09 * s, C.vestEdge, 0.15 * s, 0.02 * s, 0.195 * s);
  for (let i = 0; i < 3; i++) {
    part(T, 0.028 * s, 0.028 * s, 0.03 * s, C.vestDark, -0.18 * s, (0.20 - i * 0.18) * s, 0.23 * s);
  }
  part(T, 0.80 * s, 0.86 * s, 0.10 * s, C.vestDark, 0, 0.03 * s, -0.19 * s);
  part(T, 0.06 * s, 0.84 * s, 0.44 * s, C.vest, -0.37 * s, 0.03 * s, 0);
  part(T, 0.06 * s, 0.84 * s, 0.44 * s, C.vest, 0.37 * s, 0.03 * s, 0);
  part(T, 0.19 * s, 0.09 * s, 0.07 * s, C.vestDark, -0.26 * s, -0.44 * s, 0.185 * s);
  part(T, 0.19 * s, 0.09 * s, 0.07 * s, C.vestDark, 0.26 * s, -0.44 * s, 0.185 * s);

  // Cinto de corda trançada amarrado na cintura + pontas penduradas
  part(T, 0.84 * s, 0.075 * s, 0.47 * s, C.rope, 0, -0.26 * s, 0);
  part(T, 0.85 * s, 0.025 * s, 0.48 * s, C.ropeDark, 0, -0.26 * s, 0);
  part(T, 0.10 * s, 0.09 * s, 0.08 * s, C.rope, -0.06 * s, -0.26 * s, 0.23 * s); // nó
  part(T, 0.045 * s, 0.26 * s, 0.045 * s, C.rope, -0.10 * s, -0.40 * s, 0.235 * s);
  part(T, 0.045 * s, 0.22 * s, 0.045 * s, C.ropeDark, -0.04 * s, -0.38 * s, 0.235 * s);

  // Bolsa de couro na lateral direita do quadril
  part(T, 0.14 * s, 0.22 * s, 0.18 * s, C.pouch, -0.43 * s, -0.36 * s, 0.06 * s);
  part(T, 0.15 * s, 0.09 * s, 0.19 * s, C.pouchHi, -0.435 * s, -0.30 * s, 0.06 * s);

  // Cabeça: rosto humano desgastado, olhos vivos, cabelo despenteado e barba
  rig.head = part(root, 0.44 * s, 0.46 * s, 0.44 * s, C.skin, 0, 2.10 * s, 0);
  const H = rig.head;

  // Pescoço
  part(H, 0.22 * s, 0.15 * s, 0.22 * s, C.skinSh, 0, -0.25 * s, 0);

  // Arcada supraciliar, sombras das bochechas e nariz
  part(H, 0.40 * s, 0.06 * s, 0.05 * s, C.skinSh, 0, 0.10 * s, 0.205 * s);
  part(H, 0.09 * s, 0.10 * s, 0.04 * s, C.skinDark, -0.16 * s, -0.02 * s, 0.205 * s);
  part(H, 0.09 * s, 0.10 * s, 0.04 * s, C.skinDark, 0.16 * s, -0.02 * s, 0.205 * s);
  part(H, 0.07 * s, 0.095 * s, 0.06 * s, C.skinHi, 0, 0.01 * s, 0.225 * s);

  // Olhos vivos (esclera + pupila escura)
  part(H, 0.10 * s, 0.055 * s, 0.02 * s, 0xe8e0d4, -0.10 * s, 0.045 * s, 0.222 * s, { basic: true });
  part(H, 0.10 * s, 0.055 * s, 0.02 * s, 0xe8e0d4, 0.10 * s, 0.045 * s, 0.222 * s, { basic: true });
  part(H, 0.05 * s, 0.045 * s, 0.022 * s, 0x1e1612, -0.10 * s, 0.045 * s, 0.225 * s, { basic: true });
  part(H, 0.05 * s, 0.045 * s, 0.022 * s, 0x1e1612, 0.10 * s, 0.045 * s, 0.225 * s, { basic: true });

  // Boca
  part(H, 0.15 * s, 0.038 * s, 0.025 * s, 0x5c2e28, 0, -0.105 * s, 0.222 * s, { basic: true });

  // Barba / bigode (varia entre barba rala/média e barba cheia)
  part(H, 0.19 * s, 0.032 * s, 0.035 * s, C.beard, 0, -0.06 * s, 0.22 * s);
  part(H, 0.05 * s, 0.12 * s, 0.035 * s, C.beard, -0.10 * s, -0.12 * s, 0.218 * s);
  part(H, 0.05 * s, 0.12 * s, 0.035 * s, C.beard, 0.10 * s, -0.12 * s, 0.218 * s);
  part(H, 0.24 * s, C.fullBeard ? 0.13 * s : 0.08 * s, 0.10 * s, C.beard, 0, C.fullBeard ? -0.20 * s : -0.18 * s, 0.18 * s);
  if (C.fullBeard) {
    part(H, 0.14 * s, 0.08 * s, 0.06 * s, C.hairDark, 0, -0.26 * s, 0.19 * s);
  }

  // Cabelo despenteado (topo, mechas na testa, laterais e nuca)
  part(H, 0.46 * s, 0.11 * s, 0.46 * s, C.hair, 0, 0.22 * s, -0.01 * s);
  part(H, 0.16 * s, 0.10 * s, 0.07 * s, C.hairDark, -0.14 * s, 0.18 * s, 0.20 * s);
  part(H, 0.15 * s, 0.09 * s, 0.07 * s, C.hair, 0.15 * s, 0.17 * s, 0.20 * s);
  part(H, 0.08 * s, 0.07 * s, 0.06 * s, C.hair, -0.02 * s, 0.19 * s, 0.21 * s);
  part(H, 0.06 * s, 0.26 * s, 0.36 * s, C.hair, -0.23 * s, 0.07 * s, -0.02 * s);
  part(H, 0.06 * s, 0.26 * s, 0.36 * s, C.hair, 0.23 * s, 0.07 * s, -0.02 * s);
  part(H, 0.44 * s, 0.30 * s, 0.06 * s, C.hairDark, 0, 0.05 * s, -0.23 * s);

  // Chapéu / boina opcional por variante
  if (C.hat === 'straw') {
    part(H, 0.72 * s, 0.05 * s, 0.72 * s, 0xc4a24c, 0, 0.24 * s, 0);
    part(H, 0.46 * s, 0.15 * s, 0.46 * s, 0xb5933e, 0, 0.32 * s, 0);
    part(H, 0.48 * s, 0.04 * s, 0.48 * s, 0x4a2c18, 0, 0.26 * s, 0);
  } else if (C.hat === 'cap') {
    part(H, 0.48 * s, 0.14 * s, 0.50 * s, 0x3b3530, 0, 0.24 * s, -0.01 * s);
    part(H, 0.44 * s, 0.04 * s, 0.14 * s, 0x2c2723, 0, 0.19 * s, 0.24 * s);
  }

  // Braços: mangas da camisa arregaçadas + antebraços e mãos expostos
  const mkArm = (side) => {
    const a = limb(root, 0.21 * s, 0.90 * s, 0.21 * s, C.skin, side * 0.51 * s, 1.80 * s, 0);
    part(a, 0.25 * s, 0.42 * s, 0.25 * s, C.shirt, 0, -0.21 * s, 0);
    part(a, 0.26 * s, 0.07 * s, 0.26 * s, C.shirtSh, 0, -0.41 * s, 0);
    part(a, 0.19 * s, 0.26 * s, 0.19 * s, C.skinSh, 0, -0.59 * s, 0);
    return a;
  };
  rig.armL = mkArm(-1);
  rig.armR = mkArm(1);

  return rig;
}

BUILD.camponesVivo = buildCamponesVivo;
