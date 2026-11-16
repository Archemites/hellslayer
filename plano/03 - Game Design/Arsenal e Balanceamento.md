---
title: Arsenal e Balanceamento
tags:
  - hellslayer
  - armas
  - balanceamento
status: ativo-beta1
---

# ⚔️ Arsenal e Balanceamento

## 1. Arsenal do Capítulo 1 (Implementado em `js/game.js`)

| Slot | Arma | Clique Esq. (Primário) | Botão Dir. (Secundário — Novo!) | Papel Tático | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | **Punhos** (`fists`) | Soco rápido (16 dmg, 0.30s) | **Parry de Pedreiro:** Rebate projéteis (3.5x dano), interrompe windup inimigo, cura +15 HP e dá +12 Fé. | Defesa ativa, sustain e combo rápido. | ✅ |
| **2** | **Martelo de Obras** (`hammer`) | Martelada (36 dmg, 0.62s) | **Arremessar Tijolo:** Lança um tijolo pesado (44 dmg, stun) sem gastar munição. | Anti-aéreo e médio alcance confiável. | ✅ |
| **3** | **Funda** (`sling`) | Pedrada rápida (24 dmg, 1 pedra) | **Pedrada de Davi:** Consome 3 pedras para disparar um pedregulho de 68 dmg e alto stun. | Burst à distância contra Gárgulas/Padres. | ✅ |
| **4** | **Foice** (`scythe`) | Corte em arco (30 dmg, sweep) | **Ceifa Sangrenta:** Golpe amplo (38 dmg) que puxa inimigos para perto e extrai +8 sangue por alvo. | Crowd control + gerador de munição pro Coração. | ✅ |
| **5** | **Martelo de Demolição** (`demo`) | Slam AoE com avanço (120 dmg) | **Onda Sísmica:** Slam seguido de ondas de choque frontais em linha reta. | Destruidor de tanques e fileiras. | ✅ |
| **6** | **Sacra Cruz Papal** (`cross`) | Arremesso bumerangue (34 dmg) | **Golpe / Recall:** Puxa a cruz de volta instantaneamente ou desfere golpe sagrado. | Arma versátil e matadora de Galius. | ✅ |
| **7** | **Coração Ateu** (`heart`) | Tiro contínuo de sangue (13 dmg) | **Rajada Arterial:** Shotgun de 6 projéteis de sangue (consome 15 de sangue). | DPS máximo de curto e longo alcance. | ✅ |

---

## 2. Análise de Balanceamento & Sinergias

> [!tip] Sinergia Principal: "Reboco e Sangria"
> - **Foice / Martelo de Demolição** entram no meio da horda -> geram **Sangue** e **Super-Fé**.
> - **Coração Ateu** derrete alvos distantes/voadores gastando o sangue acumulado.
> - **Sacra Cruz Papal** atravessa fileiras de inimigos e volta para a mão no botão direito (estilo *Leviathan Axe* / *Mjölnir* santo).

### Pontos de Ajuste Recomendados
1. **Punhos vs. Martelo de Obras:** Atualmente `fists` tem DPS teórico de `~53/s` (`16 / 0.30`) e `hammer` tem `~58/s` (`36 / 0.62`). Dar aos Punhos um **parry de projétil** (estilo *Ultrakill*) no botão direito tornaria o slot 1 útil do começo ao fim do jogo!
2. **Funda (`sling`):** Como é a única arma à distância até o fim da igreja, vale garantir que **pedras nunca faltem** em arenas com Gárgulas, ou permitir carregar o tiro segurando o botão para dobrar o dano (48 dmg) em alvos aéreos.
3. **Martelo de Demolição (`demo`):** O cooldown de `1.5s` é bem punitivo se errar. Adicionar um pequeno **dash para frente** ou **onda sísmica visual clara** ajuda o jogador a sentir o raio de `6.5u`.

---

## 3. Expansão do Arsenal (Capítulos 2 a 4)

> [!info] Ideias de Novas Armas / Mods Temáticos (Sem fugir da identidade de pedreiro + igreja)
> 1. **Turíbulo em Chamas (Cap. 2 — Floresta):** Mangual/incensário pesado que gira e deixa rastro de fogo sagrado, ótimo para queimar árvores demoníacas e enxames.
> 2. **Espingarda de Pregos / Pregadeira Bento (Cap. 3 — Forjas):** Ferramenta de construção turbinada com pregos de prata abençoados (disparo em rajada ou tiro secundário que prega inimigos na parede).
> 3. **Fragmento do Necro-Cristal ou Báculo Papal (Cap. 4):** Arma suprema de fim de jogo (laser contínuo de Super-Fé ou explosão de energia profana).

---

## 4. Notas Relacionadas
- [[Core Loop, Movimento e Super-Fe]]
- [[Bestiario e Bosses]]
- [[Capitulo 2 - A Floresta Infernal (Proximo)]]
