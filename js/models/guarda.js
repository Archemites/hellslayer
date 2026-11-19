'use strict';

function buildGuarda() {
  const s = 0.95;
  const root = new THREE.Group();
  const rig = { root, h: 2.35 * s };

  // Paleta baseada na referência do cavaleiro templário zumbi
  const ARMOR_BASE   = 0x5c5b5e;
  const ARMOR_HI     = 0x7c7b80;
  const ARMOR_DARK   = 0x38373a;
  const ARMOR_RUST   = 0x4b3830;
  const MAIL_BASE    = 0x34312f;
  const MAIL_HI      = 0x4d4843;
  const SURCOAT_BASE = 0x6b1416;
  const SURCOAT_DARK = 0x440b0d;
  const SURCOAT_EDGE = 0x821e20;
  const CROSS_COL    = 0xc9beab;
  const CROSS_STAIN  = 0x947e6d;
  const LEATHER      = 0x362419;
  const BUCKLE       = 0x786e62;
  const SKIN_BASE    = 0x6b5d53;
  const SKIN_SH      = 0x4b3f38;
  const SKIN_DARK    = 0x2f2621;
  const EYE_COL      = 0xe8e4d8;
  const BLOOD_1      = 0x6e0b0d;
  const BLOOD_2      = 0x4a0708;
  const BLOOD_3      = 0x8a1214;

  // Pernas: cota de malha na coxa, joelheira pontuda (poleyn), greva e sabaton (bota blindada)
  const mkLeg = (side) => {
    const l = limb(root, 0.28 * s, 0.44 * s, 0.30 * s, MAIL_BASE, side * 0.20 * s, 0.95 * s, 0);
    // Coxa em cota de malha com desgaste e sangue
    part(l, 0.30 * s, 0.34 * s, 0.32 * s, MAIL_BASE, 0, -0.17 * s, 0);
    part(l, 0.16 * s, 0.20 * s, 0.33 * s, MAIL_HI, side * 0.05 * s, -0.18 * s, 0.005 * s);
    part(l, 0.14 * s, 0.18 * s, 0.33 * s, BLOOD_2, -side * 0.04 * s, -0.24 * s, 0.008 * s);

    // Junta do joelho -> joelheira (poleyn) + greva + sabaton
    const kn = limb(l, 0.27 * s, 0.53 * s, 0.29 * s, ARMOR_BASE, 0, -0.42 * s, 0);
    l.userData.subMesh = kn.userData.mesh;
    // Joelheira (poleyn) articulada com crista central e aba lateral
    part(kn, 0.31 * s, 0.16 * s, 0.34 * s, ARMOR_BASE, 0, 0.02 * s, 0.015 * s);
    part(kn, 0.18 * s, 0.18 * s, 0.08 * s, ARMOR_HI, 0, 0.02 * s, 0.18 * s);
    part(kn, 0.06 * s, 0.20 * s, 0.06 * s, ARMOR_HI, 0, 0.02 * s, 0.21 * s); // ponta/crista do joelho
    part(kn, 0.08 * s, 0.12 * s, 0.14 * s, ARMOR_DARK, side * 0.16 * s, 0.02 * s, 0.04 * s); // aba lateral
    part(kn, 0.12 * s, 0.10 * s, 0.03 * s, BLOOD_1, side * 0.03 * s, 0.01 * s, 0.215 * s);

    // Greva (caneleira de aço com crista frontal e manchas de sangue)
    part(kn, 0.28 * s, 0.34 * s, 0.30 * s, ARMOR_BASE, 0, -0.22 * s, 0);
    part(kn, 0.08 * s, 0.32 * s, 0.05 * s, ARMOR_HI, 0, -0.22 * s, 0.15 * s);
    part(kn, 0.29 * s, 0.06 * s, 0.31 * s, ARMOR_DARK, 0, -0.10 * s, 0);
    part(kn, 0.14 * s, 0.18 * s, 0.03 * s, BLOOD_1, -side * 0.04 * s, -0.24 * s, 0.155 * s);
    part(kn, 0.10 * s, 0.14 * s, 0.31 * s, ARMOR_RUST, side * 0.08 * s, -0.26 * s, -0.02 * s);

    // Sabaton (bota de placas articuladas)
    part(kn, 0.29 * s, 0.12 * s, 0.34 * s, ARMOR_DARK, 0, -0.42 * s, 0.02 * s);
    part(kn, 0.27 * s, 0.10 * s, 0.38 * s, ARMOR_BASE, 0, -0.46 * s, 0.05 * s);
    part(kn, 0.25 * s, 0.07 * s, 0.14 * s, ARMOR_HI, 0, -0.47 * s, 0.18 * s); // bico articulado
    part(kn, 0.22 * s, 0.05 * s, 0.06 * s, BLOOD_2, 0, -0.46 * s, 0.22 * s);
    part(kn, 0.29 * s, 0.045 * s, 0.40 * s, 0x1b1715, 0, -0.51 * s, 0.05 * s); // sola
    return { leg: l, knee: kn };
  };
  const legLObj = mkLeg(-1), legRObj = mkLeg(1);
  rig.legL = legLObj.leg; rig.kneeL = legLObj.knee;
  rig.legR = legRObj.leg; rig.kneeR = legRObj.knee;

  // Tronco (Mesh principal para compatibilidade com boundingBox de desmembramento)
  rig.torso = part(root, 0.78 * s, 0.92 * s, 0.44 * s, ARMOR_DARK, 0, 1.40 * s, 0);
  const T = rig.torso;

  // Peitoral de aço por baixo + gorjal no colarinho
  part(T, 0.80 * s, 0.32 * s, 0.46 * s, ARMOR_BASE, 0, 0.26 * s, 0);
  part(T, 0.56 * s, 0.12 * s, 0.46 * s, ARMOR_HI, 0, 0.42 * s, 0.01 * s); // gorjal
  // Fivelas nos ombros segurando a sobreveste
  part(T, 0.08 * s, 0.10 * s, 0.06 * s, LEATHER, -0.22 * s, 0.40 * s, 0.22 * s);
  part(T, 0.08 * s, 0.10 * s, 0.06 * s, LEATHER, 0.22 * s, 0.40 * s, 0.22 * s);
  part(T, 0.05 * s, 0.05 * s, 0.07 * s, BUCKLE, -0.22 * s, 0.40 * s, 0.225 * s);
  part(T, 0.05 * s, 0.05 * s, 0.07 * s, BUCKLE, 0.22 * s, 0.40 * s, 0.225 * s);

  // Sobreveste (tabard) vermelho-sangue rasgada na frente e nas costas
  part(T, 0.62 * s, 0.86 * s, 0.04 * s, SURCOAT_BASE, 0, -0.02 * s, 0.225 * s);
  part(T, 0.64 * s, 0.86 * s, 0.04 * s, SURCOAT_DARK, 0, -0.02 * s, -0.225 * s);
  part(T, 0.22 * s, 0.34 * s, 0.045 * s, BLOOD_2, -0.16 * s, -0.10 * s, 0.230 * s);
  part(T, 0.20 * s, 0.28 * s, 0.045 * s, BLOOD_1, 0.18 * s, 0.08 * s, 0.230 * s);

  // Cruz Templária (Cross Pattée) branca gasta/manchada no peito
  part(T, 0.12 * s, 0.48 * s, 0.03 * s, CROSS_COL, 0, 0.07 * s, 0.242 * s); // haste vertical
  part(T, 0.40 * s, 0.12 * s, 0.03 * s, CROSS_COL, 0, 0.12 * s, 0.242 * s); // haste horizontal
  // Pontas alargadas da cruz (estilo templário)
  part(T, 0.18 * s, 0.06 * s, 0.03 * s, CROSS_COL, 0, 0.30 * s, 0.242 * s);
  part(T, 0.18 * s, 0.06 * s, 0.03 * s, CROSS_COL, 0, -0.16 * s, 0.242 * s);
  part(T, 0.06 * s, 0.18 * s, 0.03 * s, CROSS_COL, -0.19 * s, 0.12 * s, 0.242 * s);
  part(T, 0.06 * s, 0.18 * s, 0.03 * s, CROSS_COL, 0.19 * s, 0.12 * s, 0.242 * s);
  // Manchas de sujeira e sangue sobre a cruz
  part(T, 0.10 * s, 0.14 * s, 0.032 * s, CROSS_STAIN, 0.02 * s, -0.04 * s, 0.244 * s);
  part(T, 0.08 * s, 0.10 * s, 0.033 * s, BLOOD_1, -0.04 * s, 0.14 * s, 0.245 * s);

  // Cinto de couro na cintura com fivela metálica
  part(T, 0.84 * s, 0.10 * s, 0.48 * s, LEATHER, 0, -0.36 * s, 0);
  part(T, 0.12 * s, 0.12 * s, 0.04 * s, BUCKLE, 0, -0.36 * s, 0.245 * s);
  part(T, 0.06 * s, 0.06 * s, 0.045 * s, LEATHER, 0, -0.36 * s, 0.248 * s);
  // Correia diagonal auxiliar abaixo do cinto
  const strap = part(T, 0.36 * s, 0.06 * s, 0.04 * s, LEATHER, -0.16 * s, -0.45 * s, 0.242 * s);
  strap.rotation.z = 0.22;

  // Escarcelas (tassets) de aço segmentadas nos quadris + saia de malha + farrapos vermelhos
  for (const side of [-1, 1]) {
    // 3 placas segmentadas de aço em cada quadril
    for (let i = 0; i < 3; i++) {
      const py = (-0.50 - i * 0.11) * s;
      const pw = (0.24 - i * 0.015) * s;
      const plate = part(T, pw, 0.10 * s, 0.38 * s, i % 2 === 0 ? ARMOR_BASE : ARMOR_HI, side * (0.31 + i * 0.02) * s, py, 0.02 * s);
      plate.rotation.z = side * -0.16;
      if (i === 1) {
        part(T, 0.08 * s, 0.08 * s, 0.03 * s, BLOOD_1, side * 0.33 * s, py, 0.215 * s);
      }
    }
    // Abas frontais rasgadas da sobreveste
    part(T, 0.22 * s, 0.36 * s, 0.035 * s, SURCOAT_BASE, side * 0.15 * s, -0.62 * s, 0.21 * s);
    part(T, 0.12 * s, 0.22 * s, 0.035 * s, SURCOAT_EDGE, side * 0.18 * s, -0.84 * s, 0.20 * s);
    part(T, 0.14 * s, 0.18 * s, 0.04 * s, BLOOD_2, side * 0.12 * s, -0.70 * s, 0.215 * s);
  }
  // Cota de malha visível no centro abaixo do rasgo da sobreveste e atrás
  part(T, 0.44 * s, 0.34 * s, 0.04 * s, MAIL_BASE, 0, -0.60 * s, 0.17 * s);
  part(T, 0.26 * s, 0.16 * s, 0.04 * s, MAIL_HI, 0, -0.72 * s, 0.172 * s);
  part(T, 0.62 * s, 0.42 * s, 0.04 * s, SURCOAT_DARK, 0, -0.64 * s, -0.215 * s);

  // Cabeça: rosto cadavérico dentro de elmo medieval aberto com crista e sangue
  rig.head = part(root, 0.42 * s, 0.46 * s, 0.42 * s, SKIN_BASE, 0, 2.10 * s, 0);
  const H = rig.head;

  // Pescoço protegido por malha e sangue
  part(H, 0.26 * s, 0.16 * s, 0.26 * s, MAIL_BASE, 0, -0.25 * s, 0);
  part(H, 0.14 * s, 0.12 * s, 0.27 * s, BLOOD_2, 0, -0.25 * s, 0.01 * s);

  // Traços faciais cadavéricos (arcada, maçãs fundas, nariz)
  part(H, 0.38 * s, 0.06 * s, 0.05 * s, SKIN_SH, 0, 0.09 * s, 0.20 * s);
  part(H, 0.09 * s, 0.12 * s, 0.05 * s, SKIN_DARK, -0.14 * s, -0.02 * s, 0.195 * s);
  part(H, 0.09 * s, 0.12 * s, 0.05 * s, SKIN_DARK, 0.14 * s, -0.02 * s, 0.195 * s);
  part(H, 0.065 * s, 0.09 * s, 0.06 * s, SKIN_BASE, 0, 0.01 * s, 0.22 * s);

  // Órbitas fundas + olhos branco-pálidos brilhantes
  part(H, 0.12 * s, 0.075 * s, 0.03 * s, 0x160d0b, -0.095 * s, 0.045 * s, 0.205 * s);
  part(H, 0.12 * s, 0.075 * s, 0.03 * s, 0x160d0b, 0.095 * s, 0.045 * s, 0.205 * s);
  part(H, 0.055 * s, 0.04 * s, 0.02 * s, EYE_COL, -0.095 * s, 0.045 * s, 0.216 * s, { basic: true });
  part(H, 0.055 * s, 0.04 * s, 0.02 * s, EYE_COL, 0.095 * s, 0.045 * s, 0.216 * s, { basic: true });

  // Boca aberta rosnando com presas/dentes e sangue no queixo
  part(H, 0.18 * s, 0.13 * s, 0.04 * s, 0x160405, 0, -0.10 * s, 0.205 * s, { basic: true });
  part(H, 0.14 * s, 0.026 * s, 0.03 * s, 0xd0c6a8, 0, -0.055 * s, 0.215 * s);
  part(H, 0.13 * s, 0.024 * s, 0.03 * s, 0xbdb396, 0, -0.145 * s, 0.215 * s);
  part(H, 0.16 * s, 0.08 * s, 0.035 * s, BLOOD_1, 0, -0.19 * s, 0.208 * s);

  // Elmo medieval aberto (sallet/cervelliere com crista central e protetores laterais)
  part(H, 0.50 * s, 0.22 * s, 0.50 * s, ARMOR_BASE, 0, 0.18 * s, -0.01 * s); // domo principal
  part(H, 0.42 * s, 0.10 * s, 0.44 * s, ARMOR_HI, 0, 0.29 * s, -0.01 * s); // topo arredondado
  part(H, 0.08 * s, 0.08 * s, 0.54 * s, ARMOR_HI, 0, 0.34 * s, -0.01 * s); // crista central
  part(H, 0.52 * s, 0.06 * s, 0.12 * s, ARMOR_DARK, 0, 0.11 * s, 0.21 * s); // aba frontal
  // Protetores laterais de bochecha e nuca
  part(H, 0.07 * s, 0.34 * s, 0.38 * s, ARMOR_BASE, -0.23 * s, 0.01 * s, -0.03 * s);
  part(H, 0.07 * s, 0.34 * s, 0.38 * s, ARMOR_BASE, 0.23 * s, 0.01 * s, -0.03 * s);
  part(H, 0.50 * s, 0.34 * s, 0.08 * s, ARMOR_DARK, 0, 0.01 * s, -0.23 * s);
  // Manchas de sangue no elmo
  part(H, 0.14 * s, 0.10 * s, 0.03 * s, BLOOD_1, 0.10 * s, 0.22 * s, 0.24 * s);
  part(H, 0.10 * s, 0.12 * s, 0.03 * s, BLOOD_2, -0.12 * s, 0.15 * s, 0.24 * s);

  // Braços: ombreiras (pauldrons) em camadas, cota de malha, farrapos e antebraços articulados
  const mkArm = (side) => {
    const a = limb(root, 0.22 * s, 0.48 * s, 0.22 * s, MAIL_BASE, side * 0.54 * s, 1.80 * s, 0);
    // Ombreira (pauldron) em 3 placas sobrepostas
    part(a, 0.34 * s, 0.14 * s, 0.36 * s, ARMOR_HI, side * 0.04 * s, -0.02 * s, 0);
    part(a, 0.32 * s, 0.11 * s, 0.33 * s, ARMOR_BASE, side * 0.05 * s, -0.12 * s, 0);
    part(a, 0.28 * s, 0.09 * s, 0.30 * s, ARMOR_DARK, side * 0.04 * s, -0.20 * s, 0);
    part(a, 0.14 * s, 0.10 * s, 0.04 * s, BLOOD_1, side * 0.06 * s, -0.06 * s, 0.175 * s);

    // Mangas de cota de malha + farrapo vermelho pendendo no cotovelo
    part(a, 0.23 * s, 0.24 * s, 0.23 * s, MAIL_BASE, 0, -0.34 * s, 0);
    part(a, 0.08 * s, 0.18 * s, 0.14 * s, SURCOAT_DARK, -side * 0.10 * s, -0.44 * s, -0.02 * s);

    // Junta do cotovelo -> cotoveleira (couter) + antebraço blindado (vambrace) + manopla
    const f = limb(a, 0.21 * s, 0.44 * s, 0.21 * s, ARMOR_BASE, 0, -0.46 * s, 0);
    a.userData.subMesh = f.userData.mesh;
    part(f, 0.26 * s, 0.12 * s, 0.26 * s, ARMOR_HI, 0, -0.03 * s, -0.01 * s);
    part(f, 0.23 * s, 0.24 * s, 0.23 * s, ARMOR_BASE, 0, -0.19 * s, 0);
    part(f, 0.10 * s, 0.20 * s, 0.04 * s, BLOOD_1, 0, -0.19 * s, 0.118 * s);

    // Manopla blindada (gauntlet)
    part(f, 0.24 * s, 0.18 * s, 0.24 * s, ARMOR_DARK, 0, -0.38 * s, 0);
    part(f, 0.20 * s, 0.08 * s, 0.20 * s, ARMOR_HI, 0, -0.34 * s, 0.02 * s);
    part(f, 0.14 * s, 0.08 * s, 0.04 * s, BLOOD_2, 0, -0.43 * s, 0.11 * s);
    return { arm: a, forearm: f };
  };
  const armLObj = mkArm(-1), armRObj = mkArm(1);
  rig.armL = armLObj.arm; rig.forearmL = armLObj.forearm;
  rig.armR = armRObj.arm; rig.forearmR = armRObj.forearm;

  // Espada templária gasta e ensanguentada na mão direita
  rig.sword = new THREE.Group();
  part(rig.sword, 0.10 * s, 0.16 * s, 0.10 * s, LEATHER, 0, -0.42 * s, 0);
  part(rig.sword, 0.14 * s, 0.06 * s, 0.13 * s, ARMOR_DARK, 0, -0.32 * s, 0); // pomo
  part(rig.sword, 0.42 * s, 0.065 * s, 0.10 * s, ARMOR_HI, 0, -0.50 * s, 0); // guarda-mão
  part(rig.sword, 0.08 * s, 1.22 * s, 0.03 * s, 0xb4b8c0, 0, -1.12 * s, 0); // lâmina
  part(rig.sword, 0.06 * s, 0.46 * s, 0.034 * s, BLOOD_1, 0, -1.44 * s, 0); // sangue na ponta
  rig.forearmR.add(rig.sword);

  return rig;
}

BUILD.guarda = buildGuarda;
