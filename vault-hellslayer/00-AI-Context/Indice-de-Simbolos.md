---
title: Índice de Símbolos e Regiões de Código
type: reference
tags:
  - ai-context
  - index
  - symbols
  - line-map
updated: 2026-11-18
source_files:
  - index.html
  - js/game.js
  - js/game2.js
  - js/level.js
  - js/audio.js
  - js/thrash.js
  - js/realblood.js
  - js/bloodstain.js
  - js/textures.js
  - js/models/core.js
---

# 📑 Índice de Símbolos e Regiões de Código

> Mapa atualizado em **2026-11-18**. Use estes intervalos de linha como ponto de partida e confirme com `rg -n` antes de editar.

---

## 1. `js/game.js` (~4.700 linhas) — Motor, Física, Gore, Inimigos e IA

| Região | Linhas aprox. | Símbolos Principais |
| :--- | :---: | :--- |
| **Render, FOV Culling & PSX** | `236–425` | `updateCullFrustum`, `isObjInFovFrustum`, `ensureChunkCullBox`, `applyFovCulling`, `restoreFovCulling`, `renderScene`, `updatePsxRes`, `resize`, `setInternalHeight`, `setPsxJitter`, `setPixelatedCanvas`, `setSSAO` |
| **Estado, Dificuldades & Armas** | `450–498` | `P`, `S`, `DIFFICULTIES`, `getDifficulty`, `WEAPONS`, `wcd`, `AMMO_MAX` |
| **Colisão, Plataformas & Raycast** | `501–660` | `groundAt`, `resolveCircle`, `ceilingAt`, `pointInWall`, `segHitsBox`, `los`, `clipCameraRay` |
| **Gore, Decals, Gibs & RealBlood Glue** | `722–1420` | `addCorpsePart`, `makeIM`, `setGoreDuration`, `setGoreImpact`, `setParticleScale`, `setGoreQuality`, `setDismember`, `setBleedJoints`, `setGibDrips`, `setEnemyCullDist`, `spawnRealStain`, `spawnBloodDecal`, `setBloodMode`, `updateRealBlood`, `bloodDrip`, `burst`, `bloodSpurt`, `pushGib`, `spawnGore`, `updateParts`, `clearParts` |
| **Ondas de Choque & Projéteis** | `1427–1528` | `spawnRing`, `updateRings`, `spawnProj`, `killProj`, `updateProjs`, `clearProjs` |
| **Definições de Inimigos (`ETYPES`)** | `1530–1555` | `FLASH`, `ETYPES`, `enemies`, `PART_ORDER` |
| **Desmembramento & Dano Visual** | `1556–2163` | `initEnemyLimbs`, `findHitPart`, `findHitPartRay`, `spawnSeveredLimbGib`, `addSplitTorsoAnatomy`, `makeEnemyHalves`, `severLimb`, `spawnFleshChunks`, `attachDanglingEye`, `attachGutsSpill`, `damageHeadVisual`, `damageLimbVisual`, `damageTorsoVisual`, `updateEnemyVisualDamage`, `deformGaliusHit` |
| **Ciclo de Vida de Inimigos & Glory** | `2164–2529` | `addBlobShadow`, `setBlobShadows`, `spawnEnemy`, `setFlash`, `setGloryGlow`, `enterGloryState`, `queueGloryCandidate`, `flushGloryQueue`, `bisectEnemy`, `decapEnemy`, `smashHeadEnemy`, `launchKickedEnemy`, `cleanupGaliusProps`, `removeEnemy`, `clearRoomEnemies`, `aliveInRoom`, `hurtPlayer`, `dmgEnemy` |
| **Camponeses (Peasants Aliados)** | `2530–2906` | `peasants`, `spawnPeasant`, `removePeasant`, `clearPeasants`, `spawnMapPeasants`, `hitPeasant`, `launchPeasantRagdoll`, `rescuePeasant`, `updatePeasant`, `setPeasantLabels`, `updatePeasantLabels` |
| **Morte, Ataques & Intros de Boss** | `2907–3194` | `killEnemy`, `addFaith`, `doEnemyAttack`, `spawnGaliusDroppedCross`, `ensureGaliusBloodBeam`, `updateGaliusIntro`, `updateMaximusIntro` |
| **Quebra de Pilares & Pathfinding A\*** | `3195–3370` | `isPillarBreaker`, `breakPillar`, `bossBreakPillars`, `bossResolve`, `navBlocked`, `navLos`, `bossLos`, `navFindPath`, `bossWaypoint` |
| **Combate Maximus, Update & Animação IA** | `3371–4633` | `updateEnemyVertical`, `updateMaximusPhaseTrans`, `updateMaximusCombat`, `updateEnemy`, `animEnemy` |
| **Render Distance & Exports Globais** | `4634–4700` | `syncRenderDistanceEntities`, `setRenderDistance`, `window.__HS`, `window.__HSAPI`, `window.__HSAPI.bind` |

---

## 2. `js/game2.js` (~7.852 linhas) — Player, Armas, 3P, Glory Kills, Campanha, HUD e Opções

| Região | Linhas aprox. | Símbolos Principais |
| :--- | :---: | :--- |
| **3ª Pessoa & Props de Glory Kill** | `29–762` | `isThirdPersonActive`, `toggleThirdPerson`, `nivaldoHands`, `ragdollBody`, `attachHangingSpine`, `gloryHitRip`, `gloryHitDecap`, `smashHeadFX`, `gloryHitHammer`, `gloryHitKick`, `mkGoldenCrossProp`, `mkTridentProp`, `spawnMeatPile`, `releaseRipHalves`, `updateGloryProps`, `endGlory`, `animateSlingParts`, `snapLeftHandToShaft` |
| **Animação de Nivaldo 3P** | `763–2069` | `resetNivaldoPose`, `updateNivaldo3P` |
| **Helpers DOM, Mira & Diálogos** | `2070–2244` | `el`, `setText`, `setW`, `show`, `fwd3`, `eyePos`, `getAimRay`, `getAimDir`, `getCrosshairAimPoint`, `getProjectileSpawn`, `say`, `baph`, `QUIPS`, `quip`, `setObj`, `later`, `fade` |
| **Pickups & Cura** | `2245–2368` | `pickups`, `mkPickupMesh`, `spawnPickup`, `clearPickups`, `spawnMapPickups`, `healPlayer`, `collect`, `updatePickups` |
| **Armas, Ataque, Alt, Kick & Rosário** | `2369–3353` | `selectWeapon`, `meleeAttack`, `demoSlam`, `throwCross`, `updateCross`, `hitGrabbedEnemy`, `attack`, `altAttack`, `updateWeapons`, `performKick`, `startKick`, `activateFaith`, `updateRosaryPhysics`, `updateVM` |
| **HUD, Ícones, Face, Radar & Seta** | `3354–3894` | `drawWeaponSlotIcon`, `buildSlots`, `updateSlots`, `drawFace`, `drawRadar`, `rankOf`, `updateNavArrow`, `updateHUD` |
| **Salas (`ROOMS`), Mapas & Checkpoints** | `3895–4122` | `ROOMS`, `startRoom`, `loadMap`, `showLevelComplete`, `finishLevelComplete`, `setCheckpoint`, `checkRooms` |
| **Boss Events, Impale, Bite & Cutscenes** | `4123–5059` | `setCinemaUI`, `spawnMaximus`, `maximusDead`, `startImpale`, `updateImpale`, `startGaliusBite`, `updateGaliusBite`, `updateCutscene`, `galiusEvent`, `goCrypt`, `tombSequence`, `spawnGaliusMeatPile`, `plantGaliusCross`, `ripSequence` |
| **Persistência, Presets & Fim de Jogo** | `5060–5304` | `SAVE_KEY`, `DEFAULT_BINDS`, `QUALITY_PRESETS`, `writeSave`, `refreshRecordUI`, `endGame` |
| **Grab & Glory Kill (Lógica)** | `5305–5560` | `findGloryTarget`, `isSmallEnemy`, `findGrabTarget`, `startGrab`, `releaseGrab`, `updateGrabbedEnemy`, `startGloryKill`, `updateGloryKill` |
| **Eventos, Morte, Fogo & Movimento Player** | `5561–5945` | `updateEvents`, `die`, `respawn`, `doGroundSlam`, `bindDown`, `updateFireHazard`, `updatePlayer` |
| **Câmera, Luz/Fog, Loop Principal & Título** | `5946–6764` | `getFogTargets`, `resetCamera`, `applyLightingProfile`, `updateCamera`, `updateLowLifeHeartbeat`, `tick`, `initTitleShowcase`, `updateTitleEnemy`, `tickTitle`, `render`, `frame` |
| **Input, Pause, Start, Opções & Modais** | `6765–7852` | `requestLock`, `pause`, `shouldBlockBrowserShortcut`, `devClear`, `startGame`, `applyRenderDistanceChange`, `detectMatchingPreset`, `applyCrosshairStyle`, `applySettingsToEngine`, `applyPreset`, `renderKeybindsTable`, `syncSettingsUI`, `openOptions`, `closeOptions`, `applyOptions`, `populateDifficulties`, `EPISODES`, `captureEpisodePreviews`, `populateEpisodes`, `populateSaveSlots`, `window.__game` |

---

## 3. `js/level.js` (~2.802 linhas) — Chunks, Terreno, Construção e Mapas

| Região | Linhas aprox. | Símbolos Principais |
| :--- | :---: | :--- |
| **Core `World`, Chunks & Terreno** | `6–204` | `CHUNK_SIZE`, `World`, `ENV`, `getGroundY`, `setTerrain`, `addPad`, `envAt` |
| **Primitivas de Geometria & Casas** | `205–1095` | `addW`, `tiledBox`, `wbox`, `wpillar`, `wterrainPatch`, `wterrain`, `flushTerrain`, `wfloor`, `wceil`, `hall`, `gablePrismGeo`, `addHouseWindow`, `house`, `populateHouseFurniture`, `addCropFence`, `populateCrops` |
| **Chamas Instanciadas & Props** | `1096–1738` | `getFlameGeo`, `getSmokeGeo`, `getInstFlameMat`, `getInstSmokeMat`, `flame`, `flushFlames`, `deadTree`, `crate`, `hay`, `lamp`, `barrelFire`, `scarecrow`, `fountain`, `makeGate`, `openGate`, `makeExitGate`, `unlockExitGate`, `addSkyPortal`, `addDistantChurch`, `addOuterHills`, `hillWall` |
| **Builders dos 8 Mapas** | `1742–2279` | `buildMapA1`, `buildMapA2`, `buildMapA3`, `buildMapA4`, `buildMapA5`, `buildMapA6Gate`, `openAltar`, `buildMapA6Nave`, `buildMapA6Crypt` |
| **Tabelas de Dados por Mapa** | `2281–2512` | `SPAWNS`, `PICKUPS`, `PEASANTS`, `MAP_BUILDERS` |
| **Otimização, Build & Update** | `2513–2802` | `mergeBufferGeometries`, `mergeStaticChunks`, `disposeWorldTree`, `buildMap`, `buildWorld`, `updateWorld` |

---

## 4. Módulos Especializados

- **`js/textures.js`** (~276L): `PSX_RES` (`L7`), `psx(mat)` (`L10`), `TX` (`L29`), `get`/`mat`/`skyTexture`/`setFilter` (`L234–273`).
- **`js/thrash.js`** (~720L): `window.ThrashMusic` (`L7`), `PRESETS` (`L11`), cadeias de áudio (`L94`), síntese guitarra/baixo/bateria (`L167–217`), tabela de 11 faixas (`L502–513`), `playDrumsForStyle`/`playStep`/`sched` (`L520–692`), controles (`L693–711`).
- **`js/audio.js`** (~405L): `SFX` (`L5`), `loadSample`/`playSample` (`L39–74`), fade de música (`L75–121`), `init` (`L140`), `tone`/`noise`/`vocalScream` (`L182–260`), `sched` (`L262`), `play`/volumes/cutscene (`L360–403`).
- **`js/realblood.js`** (~1.050L): Gotas e emissores (`L192–370`), atlas procedural de manchas (`L388–629`), mapa GPU/flow (`L777–1050`).
- **`js/bloodstain.js`** (~337L): Sangue progressivo em Nivaldo 3P e viewmodels (`prepareTarget` `L53`, `applyRecord` `L199`, `init` `L257`, `addBlood` `L279`, `applyToCross` `L288`, `update` `L297`, `reset` `L321`).
- **`js/models/core.js`** (~760L): `BX`, `MT`, `part`, `limb`, `bioHeart`, `humanoid`, `buildRosary`, `heartPulse`, `BUILD`, `bakeRig`, `cloneBakedRig`, `buildBakedCached`.
- **`js/models/*.js`**: `cross.js`, `diabrete.js`, `padre.js`, `nivaldo.js`, `galius.js`, `maximus.js`, `campones.js`, `gargula.js`, `guarda.js`, `demonio.js`, `camponesVivo.js`, `viewmodels.js`.
- **`index.html`** (~890L): `#hud` (`L13–65`), `#title` + modais (`L68–150`), `#pause` (`L151–175`), `#optionsModal` (`L177–835`), `#death`/`#levelComplete`/`#end` (`L837–865`), `<script>` (`L867–888`).
