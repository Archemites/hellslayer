---
title: Bestiário, Bosses e Camponeses (Código Atual)
type: gameplay
tags:
  - gameplay
  - enemies
  - bosses
  - ai
  - peasants
updated: 2026-11-18
source_files:
  - js/game.js
  - js/game2.js
  - js/models/
---

# 👹 Bestiário, Bosses e Camponeses (Estado Real do Código)

> Valores extraídos diretamente de `ETYPES` (`js/game.js:1531–1544`). Todos os danos recebem multiplicador da dificuldade atual (`getDifficulty().dmgMul`) e a quantidade de inimigos comuns é escalada por `spawnMul`.

---

## 1. Inimigos Comuns (`ETYPES`)

| ID | Modelo (`BUILD.*`) | HP (`hpRange`) | Vel. | Raio | Tipo / Ataques | Recompensa (`pts` / `faith` / `blood`) |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| `campones` | `campones` | `45` (`45–70`) | `3.4` | `0.60` | Melee (`1.9u`, `9 dmg`, cd `1.3s`, `armsFwd`) | `10` / `4` / `6` |
| `guarda` | `guarda` | `120` (`110–150`) | `4.2` | `0.75` | Melee (`2.6u`, `16 dmg`, cd `1.5s`) | `25` / `8` / `10` |
| `diabrete` | `diabrete` | `28` (`20–40`) | `5.0` | `0.50` | **Voador** (`hover: 3`), Ranged fogo (`7 dmg`, cd `2.2s`, vel `17`, alcance `38`) | `10` / `4` / `5` |
| `gargula` | `gargula` | `85` (`80–85`) | `9.0` | `0.70` | **Voador** (`hover: 4`), mergulho Melee (`2.6u`, `13 dmg`, cd `1.6s`) | `20` / `7` / `9` |
| `padre` | `padre` | `80` (`75–85`) | `3.0` | `0.70` | Ranged `hex` (`14 dmg`, cd `2.8s`, vel `11`, alcance `45`, mantém distância `keep: 13`) | `25` / `8` / `10` |
| `demonio` | `demonio` | `320` (`300–400`) | `3.8` | `1.30` | Melee (`3.4u`, `28 dmg`) + **Investida/Charge** (`30 dmg`, vel `17`, cd `7s`, `mass: 2.5`) | `50` / `18` / `20` |

---

## 2. Bosses Implementados (Capítulo 1)

### ⚔️ `maximus` — Sérgio Maximo · Líder da Super-Guarda Real
- **Stats base:** `HP 900`, `speed 6.8`, `r 1.45`, `aggro 90`, `mass 5`, `pts 300`, `faith 60`, `blood 60`.
- **Equipamento / Visual:** Flamberge colossal + física de rosário/prop (`js/models/maximus.js`).
- **Combate em 2 Fases (`js/game.js:3401–3699`):**
  - Intro cinemática (`updateMaximusIntro` `L3129`, disparada por `spawnMaximus` em `game2.js:4158`).
  - **Fase 1 & Transição (`updateMaximusPhaseTrans` `L3401`):** alterna combos de Flamberge (`melee: 26 dmg`), investidas (`charge: 36 dmg`, vel `24`) e **Empalamento** (`startImpale` / `updateImpale` em `game2.js:4275–4395`).
  - Quebra pilares da arena (`bossBreakPillars`) e usa A\* (`navFindPath`).
- **Desfecho (`maximusDead` `game2.js:4198`):** cutscene de fúria na porta usando o corpo de Maximus como aríete para invadir a Ultra-Igreja.

### 🩸 `galius1` & `galius2` — Galius · O Super-Ateu
- **Fase 1 (`galius1` — Nave da Ultra-Igreja):**
  - `HP 9500`, `speed 5.2`, `r 3.2`, `mass 20`, `melee: 7.5u / 36 dmg`, `stomp: cd 6s / 26 dmg`.
  - Intro (`updateGaliusIntro` `game.js:3055`) + evento de Baphomet (`galiusEvent` `game2.js:4786`).
  - **Imune a armas comuns:** gera som metálico + aviso de imunidade; empurra o jogador para abrir o alçapão do altar rumo às Catacumbas (`goCrypt`).
- **Fase 2 (`galius2` — Retorno com a Sacra Cruz Papal):**
  - `HP 2400`, `speed 5.4`, `r 3.2`, `mass 20`, `melee: 40 dmg`, `charge: 45 dmg`, `stomp: 30 dmg`, mais raio de sangue (`ensureGaliusBloodBeam` `game.js:3026`) e ataque de **Mordida** (`startGaliusBite` / `updateGaliusBite` `game2.js:4396–4523`).
  - Vulnerável à **Sacra Cruz Papal** (atordoa e deforma com `deformGaliusHit`).
  - **Finalização (`ripSequence` `game2.js:4973`):** Nivaldo arranca o **Coração Ateu**, esmaga Galius sob a Super-Cruz Dourada (`plantGaliusCross`, `spawnGaliusMeatPile`), libera o Coração Ateu (Slot 7) e abre o portal para o Capítulo 2.

---

## 3. Camponeses Aliados (`peasants` — `js/game.js:2530–2906`)

- **Modelo:** `BUILD.camponesVivo` (`js/models/camponesVivo.js`).
- **Spawns:** tabela `PEASANTS` em `js/level.js:2462`.
- **Comportamento (`updatePeasant`):**
  - Fogem de demônios, podem ser resgatados pelo jogador (`rescuePeasant` com `E`) e exibem rótulos flutuantes no HUD (`updatePeasantLabels`, toggle `SAVE.peasantLabels`).
  - Se atingidos por golpes/explosões (`hitPeasant`), entram em ragdoll físico (`launchPeasantRagdoll`).

---

## 4. Ciclo de IA e Estados (`js/game.js`)

1. `spawnEnemy(type, x, z, room, y)` cria o rig via `BUILD[def.model]()`, inicializa `initEnemyLimbs(e)` e opcionalmente `addBlobShadow`.
2. `dmgEnemy(e, amt, kx, kz, o)` aplica dano, flash branco (`setFlash`), dano visual progressivo (`updateEnemyVisualDamage`), chance de desmembramento (`severLimb`) e entrada em estado Glory (`queueGloryCandidate` → `flushGloryQueue` → `enterGloryState`).
3. `updateEnemy(e, dt)` executa aggro, navegação (`bossWaypoint` para bosses), verticalidade (`updateEnemyVertical`), ataques (`doEnemyAttack`) e animação procedural de membros (`animEnemy`).
4. **Anti-Softlock:** quando restam poucos inimigos na sala, entram em aggro total e o radar/seta de navegação (`updateNavArrow`) apontam para o inimigo mais próximo.

---

## Notas Relacionadas
- [Combate, Armas e Controles](Combate-Armas-e-Controles.md)
- [Modelos 3D e Animação](Modelos-3D-e-Animacao.md)
- [Física, Colisão e Navegação](../01-Arquitetura/Fisica-Colisao-e-Navegacao.md)
