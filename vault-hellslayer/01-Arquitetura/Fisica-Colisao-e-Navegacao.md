---
title: Física, Colisão e Navegação (Pathfinding)
type: architecture
tags:
  - architecture
  - physics
  - collision
  - pathfinding
updated: 2026-11-18
source_files:
  - js/level.js
  - js/game.js
  - js/game2.js
---

# 🧭 Física, Colisão e Navegação

## 1. Convenções Espaciais

- **Frente do mundo:** `-Z` (`yaw = 0` aponta para `(0, 0, -1)`).
- **Altura:** eixo `+Y`.
- **Retângulos / AABBs (`hall`, `wbox`, `colliders`):** sempre definidos com `x1 < x2` e `z1 < z2`.
- **Jogador (`P`):** raio `r = 0.7`, altura dos olhos `eye = 2.08`.

---

## 2. Terreno e Altura (`Y`)

| Função | Arquivo | Papel |
| :--- | :--- | :--- |
| `setTerrain(baseFn)` | `js/level.js:189` | Define a função de elevação base do mapa atual (`terrainBaseFn`). |
| `addPad(cx, cz, hw, hd, blend)` | `js/level.js:193` | Achata suavemente o terreno (`smoothstep`) em torno de casas, arenas e estradas. |
| `getGroundY(x, z)` | `js/level.js:168` | Retorna a altura do terreno com `applyPads`. |
| `groundAt(x, z, y, r)` | `js/game.js:501` | Calcula a superfície pisável considerando terreno, fosso do altar (`World.altar.open && pit` → `-3.5`) e coliders walkable/plataformas (`yMax`). |
| `ceilingAt(x, z, y, prevY, r, h)` | `js/game.js:545` | Evita que o jogador ou entidades atravessem tetos ou plataformas superiores ao pular. |

---

## 3. Colisão 2.5D & Spatial Hash Grid

- **`World.colliders` + `World.dynamicColliders` + `World.colliderGrid`** (`js/level.js:16`):
  - Colisores estáticos são indexados em uma grade espacial (`World.queryColliders(minX, minZ, maxX, maxZ, out)`), evitando checar todos os blocos do mapa a cada passo.
  - Objetos sólidos dinâmicos criados em runtime (ex.: pilha de carne do Galius ou portões) usam `registerSolidPropBox` (`js/game2.js:4885`) / `dynamicColliders`.
- **`resolveCircle(pos, r, y, h)`** (`js/game.js:515`): resolve empurrão círculo-vs-AABB em XZ levando em conta a faixa vertical `[y, y + h]` (permite passar por cima de muretas/plataformas ou por baixo de lintéis).
- **Linha de Visão e Câmera:**
  - `pointInWall(x, z, y)` (`js/game.js:562`)
  - `segHitsBox(ax, az, bx, bz, c)` (`js/game.js:577`)
  - `los(ax, az, bx, bz)` (`js/game.js:596`) — checa linha de visão entre inimigos e player.
  - `clipCameraRay(ax, ay, az, bx, by, bz, pad, out)` (`js/game.js:639`) — impede a câmera de 3ª pessoa (e Glory Kills) de entrar dentro de paredes.

---

## 4. Navegação de Bosses & Quebra de Pilares (`js/game.js:3195–3370`)

Bosses pesados (`maximus`, `galius1`, `galius2`) possuem navegação mais sofisticada que inimigos comuns:

- **Quebra de Pilares (`World.pillars`):**
  - `isPillarBreaker(e)` (`L3195`), `breakPillar(p, e)` (`L3200`), `bossBreakPillars(e, pos)` (`L3225`): quando o boss investe contra pilares destrutíveis (`wpillar` em `level.js:252`), o pilar estilhaça e remove seu colisor.
- **Pathfinding A\* em Grade (`navFindPath`):**
  - `navBlocked(x, z, r)` (`L3245`), `navLos` (`L3256`), `bossLos` (`L3265`), `navFindPath(sx, sz, gx, gz, rad)` (`L3270`) e `bossWaypoint(e, pos, tx, tz, dt)` (`L3353`): permite que Maximus e Galius contornem obstáculos da arena sem travar em quinas.
- **Verticalidade de Inimigos:**
  - `updateEnemyVertical(e, pos, dt, dist)` (`L3371`) controla gravidade, queda e voo suave (Diabretes e Gárgulas com `flying: true` e `hover`).

---

## 5. Movimento do Jogador (`js/game2.js:5741` — `updatePlayer`)

- **Movimento base** com aceleração, strafing, bobbing e roll lateral configurável (`SAVE.bob`, `SAVE.roll`).
- **Dash (`Shift`):** impulso direcional de alta velocidade com cooldown e barra dedicada no HUD.
- **Pulo (`Espaço`) + Coyote Time + Jump Buffering:** resposta suave em bordas de plataformas e escadas.
- **Ground Slam / Queda de 450 kg (`Ctrl` no ar → `doGroundSlam`, `L5695`):** queda vertical acelerada que gera onda sísmica AoE e arremessa inimigos leves ao tocar o chão.
- **Perigo de Fogo (`updateFireHazard`, `L5718`):** aplica dano contínuo com cooldown (`P.fireCd`) ao pisar em focos de fogo/chamas.

---

## Notas Relacionadas
- [Combate, Armas e Controles](../02-Gameplay-e-Sistemas/Combate-Armas-e-Controles.md)
- [Mapas, Campanha e Progressão](../02-Gameplay-e-Sistemas/Mapas-Campanha-e-Progressao.md)
- [Bestiário e Bosses (Código)](../02-Gameplay-e-Sistemas/Bestiario-e-Bosses-Codigo.md)
