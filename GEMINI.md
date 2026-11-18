# GEMINI.md — Mapa do Projeto HELLSLAYER

> Guia de localização rápida para evitar leitura desnecessária de arquivos grandes e economizar tokens.

## 1. Regras de Ouro (Economia de Tokens)
1. **Nunca leia arquivos inteiros** de `js/game.js` (~3.0k linhas), `js/game2.js` (~4.7k linhas), `js/level.js` (~1.7k linhas), `js/realblood.js` (~1.0k linhas) ou `style.css` (~1.0k linhas) sem necessidade.
2. **Busque antes de ler**: use `rg -n "<termo>" js/` para achar a linha exata e leia apenas o bloco necessário com `StartLine`/`EndLine` (~50–150 linhas).
3. **Ignore pastas/binários pesados**: `node_modules/`, `dist/`, `.git/`, `.obsidian/`, `HELLSLAYER.exe`, `cinzel.zip`.
4. **Sem bundler**: o projeto roda direto em Electron + Three.js (`vendor/three.min.js`) via `<script>` em `index.html`. Não há `import`/`export` ES modules.

---

## 2. Stack & Comandos
- **Runtime**: Electron (`^45.3.3`), Three.js (`vendor/three.min.js`), HTML/CSS/JS Vanilla.
- **Executar em dev**: `npm start` (`electron .`)
- **Build portátil Windows**: `npm run dist` (gera `dist/HELLSLAYER.exe` e copia para `HELLSLAYER.exe` na raiz).

---

## 3. Estrutura de Diretórios
```text
hellslayer/
├── index.html          # DOM do HUD, telas (título, pause, morte, fim), modal de opções e ordem dos <script>
├── style.css           # Estilos do HUD, overlays, modais e menu de opções (1039 linhas)
├── package.json        # Scripts Electron e config do electron-builder
├── electron/
│   ├── main.js         # Janela principal (1280x720, sem menu, singleInstanceLock, IPC app:quit)
│   └── preload.js      # Bridge mínima para o renderer
├── js/                 # Código do jogo (ordem de carregamento no index.html abaixo)
├── vendor/three.min.js # Three.js empacotado localmente
├── fonts/              # Cinzel, CinzelDecorative, EBGaramond, Nothing Inside
├── soundeffect/        # Samples MP3: gore/ (explode, gush) e impact/ (stab-2, knife-cut, body-impact)
├── soundtrack/         # Diretório de trilhas sonoras
└── plano/              # Documentação de design, lore, auditoria e roadmap (Obsidian)
```

---

## 4. Ordem de Carregamento & Comunicação Entre Módulos
Os scripts são carregados em sequência no final de `index.html` (`L818-825`):

1. `vendor/three.min.js` → Global `THREE`
2. `js/textures.js` → Globais `PSX_RES`, `psx()`, `TX`
3. `js/audio.js` → Global `SFX`
4. `js/realblood.js` → Global `window.RealBlood`
5. `js/models.js` → Global `BUILD` (e helpers `BX`, `MT`, `part`, `limb`, `humanoid`)
6. `js/level.js` → Globais `World`, `ENV`, `SPAWNS`, `PICKUPS`, `PEASANTS`, `MAP_BUILDERS`, `buildMap()`, `buildWorld()`, `updateWorld()`
7. `js/game.js` → Motor, render, física, gore, inimigos; expõe `window.__HS` e `window.__HSAPI` (`L2990-3005`)
8. `js/game2.js` → IIFE que consome `window.__HS` e `window.__HSAPI` (`A`); controla jogador, armas, HUD, história, câmera, loop principal e opções.

---

## 5. Índice Detalhado por Arquivo

### `electron/main.js` (66 linhas) & `electron/preload.js` (5 linhas)
- Single instance lock, `BrowserWindow` (`1280x720`, `min 960x540`), `Menu.setApplicationMenu(null)`, `ipcMain.on('app:quit')`.

### `index.html` (~825 linhas)
- `L13-62`: `#hud` (área/objetivo, style rank, bossbar, FPS, crosshair, hitmarker, mensagens, vida/fé/dash, slots de armas/munição).
- `L68-149`: Tela de título (`#title`), modais de capítulo (`#titleChapterModal`), episódio (`#titleEpisodeModal`), load (`#titleLoadModal`), saída (`#titleExitModal`).
- `L151-175`: Overlay de pause (`#pause`).
- `L177-787`: `#optionsModal` (menu estilo Valve) com 6 abas `data-pane`: `video` (`L215`), `gore` (`L416`), `game` (`L498`), `mouse` (`L629`), `audio` (`L712`), `keyboard` (`L767`).
- `L788-817`: Overlays `#death`, `#levelComplete`, `#end`.
- `L818-825`: Tags `<script>`.

### `js/textures.js` (276 linhas)
- `PSX_RES` (`L7`), shader/material helper `psx(mat)` (`L10`).
- Geração procedural de texturas pixeladas (`makers` a partir de `L51`), cache `TX.get(name)` (`L234`), `TX.mat(name, polyOffset)` (`L240`), `TX.skyTexture()` (`L258`), `TX.setFilter(mode)` (`L273`).

### `js/audio.js` (~295 linhas)
- `SFX` IIFE (`L5`): WebAudio synthesizer + samples de `soundeffect/`.
- `SAMPLE_URLS` (`L8`), `loadSample`/`playSample` (`L31-65`), `tone`/`noise`/`vocalScream` (`L85-164`), sequenciador de música procedural `playStep`/`sched` (`L168-225`), controles públicos `play`, `setIntensity`, `setVolume`, `setMusicVolume`, `setGoreVolume`, `setScreams` (`L280-292`).

### `js/realblood.js` (~1050 linhas)
- Sistema de sangue realista em GPU/Instanced (`window.RealBlood`):
  - Partículas e emissores: `add`, `emitDrop`, `updateEmitters`, `land`, `syncEnv` (`L192-360`).
  - Atlas procedural de manchas: `buildStainAtlas`, `initStains` (`L391-620`).
  - Mapa de fluxo / render targets: `initMap`, `flushSplats`, `flowStep`, `startJob`/`stepJob`/`finishJob`, `mapUpdate` (`L768-1031`).

### `js/models.js` (~790 linhas)
- Builders de geometria voxel/low-poly (`BX`, `MT`, `part`, `limb`, `humanoid` em `L6-126`).
- Modelos: `buildDiabrete` (`L127`), `buildPadre` (`L150`), `buildNivaldo` (`L174`), `buildGalius` (`L413`), `buildViewmodels` (`L554`), `buildThrownCross` (`L784`). Expostos via `BUILD` (`L507`).

### `js/level.js` (~1720 linhas)
- `World` (`L8`), `ENV` (`L158`), terreno & colisão de altura (`getGroundY`, `setTerrain`, `addPad` em `L164-200`).
- Primitivas de construção: `wbox`, `wterrainPatch`, `wterrain`, `wfloor`, `wceil`, `hall`, `house`, `flame`, `deadTree`, `crate`, `lamp`, `fountain`, `makeGate`/`openGate`, `makeExitGate`/`unlockExitGate` (`L214-720`).
- Mapas do Capítulo 1: `buildMapA1` (`L726`), `buildMapA2` (`L795`), `buildMapA3` (`L855`), `buildMapA4` (`L909`), `buildMapA5` (`L961`), `buildMapA6Gate` (`L1008`), `buildMapA6Nave` (`L1088`), `buildMapA6Crypt` (`L1205`).
- Tabelas de dados por mapa: `SPAWNS` (`L1262`), `PICKUPS` (`L1399`), `PEASANTS` (`L1443`), `MAP_BUILDERS` (`L1483`).
- Otimização & build: `mergeBufferGeometries` (`L1494`), `mergeStaticChunks` (`L1545`), `buildMap` (`L1640`), `buildWorld` (`L1692`), `updateWorld` (`L1706`).

### `js/game.js` (~3010 linhas)
- **Render, PSX & Culling**: `updateCullFrustum`..`setSSAO` (`L236-421`).
- **Colisão & Raycast 2D**: `groundAt`, `resolveCircle`, `pointInWall`, `segHitsBox`, `los` (`L486-570`).
- **Gore, Decals, Gibs & Partículas**: `addCorpsePart`..`clearParts` (`L602-1278`). Inclui `setGoreDuration`, `setGoreQuality`, `setBloodMode`, `spawnBloodDecal`, `spawnGore`, `updateParts`.
- **Projéteis & Ondas de Choque**: `spawnRing`/`updateRings`, `spawnProj`/`updateProjs`/`clearProjs` (`L1279-1380`).
- **Desmembramento & Limbos**: `initEnemyLimbs`, `findHitPart`, `findHitPartRay`, `makeEnemyHalves`, `severLimb` (`L1408-1731`).
- **Inimigos & IA**: `spawnEnemy`, `enterGloryState`, `bisectEnemy`, `decapEnemy`, `smashHeadEnemy`, `dmgEnemy`, `killEnemy`, `doEnemyAttack`, `updateEnemy`, `animEnemy` (`L1747-2940`).
- **Camponeses (Peasants)**: `spawnPeasant`, `hitPeasant`, `rescuePeasant`, `updatePeasant`, `updatePeasantLabels` (`L2054-2427`).
- **Render Distance & API Global**: `syncRenderDistanceEntities`, `setRenderDistance`, `window.__HS`, `window.__HSAPI` (`L2941-3005`).

### `js/game2.js` (~4763 linhas)
- **3ª Pessoa & Glory Kills (animação/props)**: `NIVALDO_3P`, `TP_CAM`, `attachHangingSpine`, `gloryHitRip`/`Decap`/`Hammer`/`Kick`, `updateGloryProps`, `updateNivaldo3P` (`L13-945`).
- **Helpers & Mensagens**: `el`, `setText`, `setW`, `show`, `fwd3`, `eyePos`, `say`, `baph`, `setObj`, `fade` (`L947-986`).
- **Pickups**: `mkPickupMesh`, `spawnPickup`, `spawnMapPickups`, `collect`, `updatePickups` (`L987-1097`).
- **Armas & Combate**: `selectWeapon`, `meleeAttack`, `demoSlam`, `throwCross`/`updateCross`, `attack`, `doParry`, `altAttack`, `performKick`/`startKick`, `activateFaith`, `updateVM` (`L1098-1776`).
- **HUD & Radar**: `buildSlots`, `updateSlots`, `drawFace`, `drawRadar`, `rankOf`, `updateHUD` (`L1777-1988`).
- **Progressão, Salas, Bosses & Cutscenes**: `startRoom`, `loadMap`, `showLevelComplete`, `setCheckpoint`, `checkRooms`, `spawnMaximus`/`maximusDead`, `updateCutscene`, `galiusEvent`, `goCrypt`, `tombSequence`, `ripSequence`, `writeSave`, `endGame` (`L1989-2597`).
- **Grab & Glory Kill (lógica)**: `findGloryTarget`, `findGrabTarget`, `startGrab`/`releaseGrab`/`updateGrabbedEnemy`, `startGloryKill`/`updateGloryKill` (`L2598-2811`).
- **Eventos, Morte & Player**: `updateEvents`, `die`, `respawn`, `doGroundSlam`, `updatePlayer` (`L2812-3127`).
- **Câmera, Iluminação & Loop Principal**: `getFogTargets`, `applyLightingProfile`, `updateCamera`, `tick`, `initTitleShowcase`/`tickTitle`, `render`, `frame` (`L3128-3727`).
- **Input, Pause, Opções & Modais**: `requestLock`, `pause`, `shouldBlockBrowserShortcut`, `startGame`, `applySettingsToEngine`, `applyPreset`, `renderKeybindsTable`, `syncSettingsUI`, `openOptions`/`closeOptions`/`applyOptions`, `populateEpisodes`, `populateSaveSlots` (`L3728-4680+`).

---

## 6. Documentação de Projeto (`plano/`)
Consulte estes arquivos quando precisar de contexto de design, lore ou roadmap (sem precisar ler o código inteiro):
- `plano/00 - Dashboard (MOC).md` — Índice geral do planejamento
- `plano/01 - Avaliacao Profunda/Auditoria Tecnica do Projeto Atual (Beta 1).md`
- `plano/01 - Avaliacao Profunda/Avaliacao de Game Design e Mercado.md`
- `plano/02 - Lore e Universo/Biblia do Universo e Cronologia.md`
- `plano/02 - Lore e Universo/Personagens e Faccoes.md`
- `plano/03 - Game Design/Arsenal e Balanceamento.md`
- `plano/03 - Game Design/Bestiario e Bosses.md`
- `plano/03 - Game Design/Core Loop, Movimento e Super-Fe.md`
- `plano/04 - Campanha e Level Design/Capitulo 1 - Nos Portoes do Inferno (Status Beta 1).md`
- `plano/04 - Campanha e Level Design/Capitulo 2 - A Floresta Infernal (Proximo).md`
- `plano/04 - Campanha e Level Design/Capitulos 3 e 4 - Arco Final (3 Dias).md`
- `plano/05 - Arquitetura e Roadmap/Plano de Refatoracao Tecnica.md`
- `plano/05 - Arquitetura e Roadmap/Roadmap de Producao (Fases e Milestones).md`

---

## 7. Guia Rápido: Onde Mexer
| Quero alterar... | Arquivo | Seção / Função |
|---|---|---|
| Armas, dano, parry, kick, fé | `js/game2.js` | `L1098-1776` (`attack`, `doParry`, `altAttack`, `performKick`) |
| Movimento do player, dash, slam | `js/game2.js` | `L2941-3127` (`doGroundSlam`, `updatePlayer`) |
| IA, spawn e dano de inimigos | `js/game.js` | `L1747-2940` (`spawnEnemy`, `dmgEnemy`, `updateEnemy`) |
| Desmembramento e gibs | `js/game.js` | `L1408-1731` (`findHitPartRay`, `severLimb`) |
| Glory Kills (animação 3P / lógica) | `js/game2.js` | `L119-880` (props/3P) e `L2598-2811` (alvo/grab/execução) |
| Sangue realista (partículas/fluxo) | `js/realblood.js` | `L192-360` (gotas) e `L768-1031` (mapa/manchas) |
| Geometria de mapas, spawns, pickups | `js/level.js` | `buildMapA1..A6Crypt` (`L726-1260`), `SPAWNS`/`PICKUPS` (`L1262-1482`) |
| Modelos 3D voxel/low-poly | `js/models.js` | `BUILD` (`L127-790`) |
| Texturas procedurais / PSX | `js/textures.js` | `makers` (`L51-233`), `TX` (`L234-275`) |
| Sons, música procedural, volumes | `js/audio.js` | `SFX` (`L5-292`) |
| HUD, menus, opções, keybinds | `index.html` + `style.css` + `js/game2.js` | HTML `L13-817`, JS `L1777-1988` e `L3977-4630` |
| Janela Electron / Build `.exe` | `electron/main.js` + `package.json` | `createWindow`, `build` |
