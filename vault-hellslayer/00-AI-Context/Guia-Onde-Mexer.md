---
title: Guia Rápido — Onde Mexer
type: reference
tags:
  - ai-context
  - quick-reference
  - routing
updated: 2026-11-18
---

# 🎯 Guia Rápido: Onde Mexer

> Tabela de roteamento direto para encontrar o arquivo e o bloco certo sem explorar o repositório às cegas.

| O que você quer alterar... | Arquivo(s) | Funções / Constantes | Cuidados / Efeitos Colaterais |
| :--- | :--- | :--- | :--- |
| **Stats de arma (dano, cooldown, alcance)** | `js/game.js` | `WEAPONS` (`L485`), `AMMO_MAX` (`L497`) | Conferir `altAttack` em `js/game2.js` (`L2722`) que pode ter dano hardcoded. |
| **Ataque primário, secundário, parry, cruz** | `js/game2.js` | `meleeAttack`, `demoSlam`, `throwCross`, `attack`, `altAttack` (`L2389–2832`) | Checar feedback de sangue (`BloodStain.addBlood`) e hitstop. |
| **Chute (`Q`), Super-Fé (`V`), Ground Slam (`Ctrl`)** | `js/game2.js` | `performKick`/`startKick` (`L2833`), `activateFaith` (`L2919`), `doGroundSlam` (`L5695`) | Teclas padrão vêm de `DEFAULT_BINDS` (`L5063`). |
| **Agarrar (`F`) e Glory Kills (lógica + animação 3P)** | `js/game2.js` | Lógica: `L5305–5560` · Animação/props: `L29–762` | Glory Kill altera câmera para 3P temporariamente (`endGlory` restaura estado). |
| **Movimento do player, dash, pulo, fogo** | `js/game2.js` | `updatePlayer` (`L5741`), `updateFireHazard` (`L5718`) | Colisão real vem de `resolveCircle`/`groundAt`/`ceilingAt` em `js/game.js`. |
| **Stats de inimigos e bosses** | `js/game.js` | `ETYPES` (`L1531`) | Escalonamento por dificuldade usa `getDifficulty()` (`spawnMul`, `dmgMul`). |
| **IA de inimigos, Maximus 2 fases, Galius** | `js/game.js` | `updateMaximusCombat` (`L3448`), `updateEnemy` (`L3700`), `animEnemy` (`L4109`) | Bosses usam `navFindPath` (`L3270`) e `bossBreakPillars` (`L3225`). |
| **Cutscenes de boss (Maximus, Galius, Tumba, Rip)** | `js/game2.js` | `spawnMaximus`..`ripSequence` (`L4158–5273`) | Usa `setCinemaUI`, `SFX.setCutscene(true)` e `captureCutsceneCamStart`. |
| **Desmembramento, gibs, dano visual progressivo** | `js/game.js` | `initEnemyLimbs`..`deformGaliusHit` (`L1562–2163`) | Depende da hierarquia de juntas dos modelos em `js/models/*`. |
| **Camponeses aliados (resgate, fuga, ragdoll)** | `js/game.js` + `js/level.js` | `spawnPeasant`..`updatePeasantLabels` (`L2533–2906`) + `PEASANTS` (`level.js:2462`) | `PEASANTS` define spawns por mapa. |
| **Sangue realista (gotas, atlas, fluxo GPU)** | `js/realblood.js` + `js/game.js` | `RealBlood` + glue em `game.js:902–1056` | Respeitar `bloodMode === 'realistic'` e caps de qualidade. |
| **Sangue progressivo em Nivaldo e armas** | `js/bloodstain.js` | `init`, `addBlood`, `applyToCross`, `update` | Usa `InstancedMesh` em `UNIT_BOX` e `userData.isArm`. |
| **Geometria de mapas, portões, iluminação de ambiente** | `js/level.js` | `ENV` (`L162`), `buildMapA1`..`buildMapA6Crypt` (`L1742–2279`) | Respeitar `x1 < x2`, `z1 < z2` e `CHUNK_SIZE = 16`. |
| **Spawns de inimigos e pickups por mapa** | `js/level.js` | `SPAWNS` (`L2281`), `PICKUPS` (`L2418`), `PEASANTS` (`L2462`) | Salas devem casar com `ROOMS` em `js/game2.js:3895`. |
| **Episódios e previews da tela de título** | `js/game2.js` | `EPISODES` (`L7526`), `captureEpisodePreviews` (`L7564`) | Cada episódio define `owned` (array de 7 booleanos) e `cleared`. |
| **Modelos 3D (personagens, inimigos, viewmodels)** | `js/models/*.js` | `core.js`, `nivaldo.js`, `viewmodels.js`, etc. | Manter nomes das juntas; usar `buildBakedCached` para performance. |
| **Texturas procedurais & efeito PSX** | `js/textures.js` | `psx`, `TX.get`, `TX.mat`, `TX.skyTexture` | Texturas são geradas em `<canvas>` com PRNG determinístico. |
| **Efeitos sonoros e samples MP3** | `js/audio.js` + `soundeffect/` | `SFX`, `FX`, `SAMPLE_URLS` | Manter fallback sintetizado caso sample não carregue. |
| **Trilha Thrash Metal (11 faixas)** | `js/thrash.js` | `PRESETS`, tabela de tracks (`L502–513`), `playStep` | Carrega WebAudioFont online com fallback WebAudio offline. |
| **HUD, radar, rosto do Nivaldo, seta de objetivo** | `index.html` + `style.css` + `js/game2.js` | `updateHUD`, `drawFace`, `drawRadar`, `updateNavArrow` (`L3354–3894`) | `setText`/`setW` fazem diff em cache (`__v`/`__w`) para não causar reflow. |
| **Menu de Opções (Valve), Presets, Keybinds, Save** | `index.html` + `js/game2.js` | `#optionsModal` + `QUALITY_PRESETS` (`L5078`), `applySettingsToEngine` (`L7066`) | Persistido em `localStorage` (`hellslayer_save_v1`). |
| **Janela Electron, IPC e build `.exe`** | `electron/main.js`, `electron/preload.js`, `package.json` | `createWindow`, `ipcMain.on('app:quit')`, `build` | `npm run dist` empacota tudo listado em `package.json -> build.files`. |

---

## Notas Relacionadas
- [Índice de Símbolos](Indice-de-Simbolos.md)
- [Playbooks de Tarefas](../04-Engenharia-e-Operacao/Playbooks-de-Tarefas.md)
