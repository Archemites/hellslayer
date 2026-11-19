---
title: Modelos 3D, Rigs e Animação Procedural
type: gameplay
tags:
  - gameplay
  - models
  - 3d
  - animation
  - rigging
updated: 2026-11-18
source_files:
  - js/models/core.js
  - js/models/viewmodels.js
  - js/models/nivaldo.js
  - js/nivaldo.js
  - viewer.html
---

# 🧱 Modelos 3D, Rigs e Animação Procedural

Todos os personagens, inimigos, bosses e armas são construídos **100% proceduralmente em Three.js** (estilo voxel/low-poly PSX), sem arquivos `.glb`/`.obj` externos.

> [!important] Refatoração Modular Concluída
> O antigo monolito `js/models.js` foi dividido em **13 arquivos dedicados** dentro de `js/models/`. Qualquer referência antiga a `js/models.js` é obsoleta.

---

## 1. Núcleo de Modelagem (`js/models/core.js` — ~760 linhas)

| Helper | Função |
| :--- | :--- |
| `BX(w, h, d)` | Cria/cacheia `BoxGeometry` compartilhadas para economizar memória. |
| `MT(color, o)` | Cria `MeshLambertMaterial` ou `MeshBasicMaterial` já passando por `psx(mat)`. |
| `part(parent, w, h, d, color, x, y, z, o)` | Adiciona caixa estilizada a um nó pai. |
| `limb(parent, w, h, d, color, jx, jy, jz, o)` | Cria pivot de articulação (`Group`) + mesh deslocado para rotação natural na junta. |
| `humanoid(o)` | Builder base de esqueleto articulado com juntas padronizadas (`torso`, `head`, `armL`, `armR`, `legL`, `legR`). |
| `bioHeart(scale)` / `heartPulse(t)` | Geometria orgânica do Coração Ateu com animação pulsante de ventrículo (`getBioHeartVentricleGeo`). |
| `buildRosary(scale, opts)` | Constrói rosário articulado em cadeia com contas e crucifixo (animado com física em `updateRosaryPhysics` em `js/game2.js:2953`). |
| `bakeRig(rig)` / `cloneBakedRig(tpl)` / `buildBakedCached(key, fn)` | **Otimização chave:** funde caixas estáticas dentro de cada junta articulada em um único `BufferGeometry` com cores por vértice (`mergeBakedGeos`) e clona templates em cache. |

---

## 2. Inventário de `js/models/`

| Arquivo | Export | Papel |
| :--- | :--- | :--- |
| `js/models/core.js` | `BUILD`, helpers, `bakeRig` | Fundação de todos os rigs e otimização |
| `js/models/cross.js` | `buildPapalCrossMesh`, `buildThrownCross` | Sacra Cruz Papal (altar, mão e projétil bumerangue) |
| `js/models/viewmodels.js` | `buildViewmodels` | Os 7 viewmodels em 1ª pessoa (`fists`, `hammer`, `sling`, `scythe`, `demo`, `cross`, `heart`) |
| `js/models/nivaldo.js` | `BUILD.nivaldo` | Modelo 3ª pessoa de Nivaldo Cruz (cabelo preto, barba, peito nu musculoso, corrente com cruz, calça cargo, coturnos, props de arma nas mãos) |
| `js/models/campones.js` | `BUILD.campones` | Camponês Endemoniado |
| `js/models/camponesVivo.js` | `BUILD.camponesVivo` | Camponês aliado vivo (para resgate) |
| `js/models/guarda.js` | `BUILD.guarda` | Guarda Endemoniado |
| `js/models/diabrete.js` | `BUILD.diabrete` | Diabrete voador |
| `js/models/gargula.js` | `BUILD.gargula` | Gárgula voadora (asas `wingL`/`wingR`) |
| `js/models/padre.js` | `BUILD.padre` | Padre corrompido |
| `js/models/demonio.js` | `BUILD.demonio` | Demônio pesado |
| `js/models/maximus.js` | `BUILD.maximus` | Boss Sérgio Maximo (armadura real + Flamberge + rosário) |
| `js/models/galius.js` | `BUILD.galius` | Boss Galius, o Super-Ateu (gigante + Super-Cruz Dourada) |

---

## 3. Contratos de Juntas (Não Renomear!)

O sistema de animação (`animEnemy` em `js/game.js:4109`, `updateNivaldo3P` em `js/game2.js:799`) e o sistema de desmembramento (`initEnemyLimbs` em `js/game.js:1562`) dependem dos nomes de propriedades anexadas ao rig:
- **Inimigos:** `head`, `torso`, `armL`, `armR`, `legL`, `legR` (+ `wingL`, `wingR` em voadores; `weapon` quando aplicável).
- **Nivaldo 3P:** `legL`/`kneeL`/`footL`, `legR`/`kneeR`/`footR`, `torsoGroup`, `chestGroup`, `head`, `shoulderL/R`, `armL/R`, `forearmL/R`, `handL/R` + props de armas e rosário.
- **Sangue Progressivo (`js/bloodstain.js`):** nós de braços nos viewmodels marcados com `userData.isArm = true` recebem o nível de sangue do corpo (`state.body`), enquanto o restante recebe `state.weapons[weaponId]`.

---

## 4. `viewer.html` e `js/nivaldo.js` (Visualizador Standalone)
- `viewer.html` é uma página utilitária para inspecionar o modelo de Nivaldo em poses (`tpose`, `idle`, `walk`, `flex`, `punch`), slider de sangue e props.
- **⚠️ Atenção (Dívida Técnica):** `viewer.html:68` ainda carrega `<script src="js/models.js"></script>`, que não existe mais após a refatoração para `js/models/*.js`. Veja [Dívidas Técnicas e Armadilhas](../04-Engenharia-e-Operacao/Dividas-Tecnicas-e-Armadilhas.md).

---

## Notas Relacionadas
- [Renderização PSX e Performance](../01-Arquitetura/Renderizacao-PSX-e-Performance.md)
- [Sangue, Gore e Desmembramento](../01-Arquitetura/Sangue-Gore-e-Desmembramento.md)
- [Playbooks de Tarefas](../04-Engenharia-e-Operacao/Playbooks-de-Tarefas.md)
