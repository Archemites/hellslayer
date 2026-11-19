---
title: Renderização PSX e Pipeline de Performance
type: architecture
tags:
  - architecture
  - rendering
  - psx
  - performance
  - presets
updated: 2026-11-18
source_files:
  - js/textures.js
  - js/level.js
  - js/models/core.js
  - js/game.js
  - js/game2.js
---

# 📺 Renderização PSX e Pipeline de Performance

O visual retrô de **HELLSLAYER** não é apenas filtro de imagem: é um pipeline completo pensado para manter estética de PlayStation 1 e alto FPS mesmo com centenas de gibs, chamas e geometria densa.

---

## 1. Estética PSX (`js/textures.js` & `js/game.js`)

- **Resolução interna reduzida:** controlada por `setInternalHeight(h)` (`js/game.js:407`) e escalada para o viewport via CSS (`image-rendering: pixelated` quando `pixelatedCanvas = true`). Padrão no preset `ALTO`: `360p` (presets vão de `120p` em `BATATA` até `720p` em `ULTRA`).
- **Vertex Snapping / Jitter PSX:** `psx(mat)` (`js/textures.js:10`) injeta shader hook no material (`onBeforeCompile`) arredondando coordenadas em clip-space usando `PSX_RES` (`setPsxJitter`: `'off' | 'soft' | 'normal' | 'extreme'`).
- **Texturas 100% procedurais (`TX`):** geradas em `<canvas>` 2D com PRNG determinístico (`seed = (seed * 16807) % 2147483647`), filtragem configurável via `TX.setFilter('nearest' | 'linear')` e cache por nome (`TX.get(name)`, `TX.mat(name, polyOffset)`).
- **SSAO opcional:** configurado via `setSSAO(q)` (`'off' | 'low' | 'high' | 'ultra'`, `js/game.js:421`).
- **Dupla Cena (Mundo + Viewmodel):** `scene`/`camera` renderizam o mundo e inimigos; `vmScene`/`vmCam` renderizam as armas em 1ª pessoa por cima sem clipping na parede (`renderScene` em `js/game.js:355` + `render` em `js/game2.js:6718`).

---

## 2. Otimizações de Geometria e Draw Calls

| Técnica | Onde está | Como funciona |
| :--- | :--- | :--- |
| **Sistema de Chunks 16×16** | `js/level.js` (`CHUNK_SIZE = 16`, `World.chunks`, `World.updateChunks`) | O mapa é particionado em células 16×16. Apenas chunks dentro do raio `World.renderChunks` (2–16) ficam visíveis. |
| **Merge de Chunks Estáticos** | `js/level.js:2564` (`mergeStaticChunks`) | Ao final de `buildMap`, funde meshes estáticos de mesmo material dentro de cada chunk com `mergeBufferGeometries`, reduzindo drasticamente draw calls. |
| **FOV Frustum Culling** | `js/game.js:236–354` (`updateCullFrustum`, `applyFovCulling`, `restoreFovCulling`) | Culla chunks e entidades fora do frustum real da câmera a cada frame antes de chamar `renderer.render`. |
| **Rig Baking (`bakeRig`)** | `js/models/core.js:601–752` (`bakeRig`, `cloneBakedRig`, `buildBakedCached`) | Funde sub-caixas estáticas dentro de cada junta (`head`, `torso`, `armL`, etc.) em uma única geometria com vertex colors e cacheia o template por chave (`buildBakedCached`). |
| **Chamas & Fumaça Instanciadas** | `js/level.js:1144–1524` (`getInstFlameMat`, `flushFlames`) | Todas as chamas/fumaças do mapa são agrupadas em `InstancedMesh` animados em shader com textura procedural de ruído. |
| **InstancedMesh de Sangue & Decals** | `js/game.js:773` (`makeIM`), `js/realblood.js`, `js/bloodstain.js` | Partículas, manchas no chão e respingos no corpo/armas usam instancing e pools (`partPool`, `swapRemove`) para evitar alocações por frame. |
| **Entity Render Distance Sync** | `js/game.js:4634` (`syncRenderDistanceEntities`), `js/game2.js:7012` (`syncPickupsRenderState`) | Sincroniza visibilidade de inimigos, camponeses, corpos e pickups com `renderDist` e `enemyCullDist`. |

---

## 3. Presets de Qualidade (`QUALITY_PRESETS` — `js/game2.js:5078–5212`)

Preset padrão no primeiro boot (`SETTINGS_DEFAULTS`): **`alto`**.

| Preset | `resH` | `renderDist` | `fogScale` | `ssao` | `lighting` | `worldDetail` | `psxJitter` | `goreQuality` | `particleScale` | `goreDur` | `dismember` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `batata` | 120 | 3 | 0.65 | `off` | `min` | `min` | `extreme` | `min` | 0.2 | 2s | ❌ |
| `muito_baixo` | 160 | 5 | 0.75 | `off` | `low` | `low` | `normal` | `very_low` | 0.4 | 5s | ✅ |
| `baixo` | 216 | 6 | 0.85 | `off` | `med` | `low` | `normal` | `low` | 0.6 | 10s | ✅ |
| `medio` | 270 | 8 | 1.00 | `low` | `med` | `med` | `normal` | `med` | 0.85 | 15s | ✅ |
| `alto` *(padrão)* | 360 | 10 | 1.00 | `high` | `high` | `high` | `normal` | `high` | 1.0 | 20s | ✅ |
| `muito_alto` | 540 | 13 | 1.25 | `high` | `high` | `high` | `soft` | `very_high` | 1.4 | 40s | ✅ |
| `ultra` | 720 | 16 | 1.50 | `ultra` | `ultra` | `ultra` | `soft` | `ultra` | 2.0 | 61s (∞) | ✅ |

---

## 4. Regras para Manter Performance ao Editar
1. **Nunca crie `new THREE.Vector3()` ou `new THREE.Box3()` dentro de loops por frame** — declare scratch vectors no escopo do módulo.
2. **Novos props repetidos em mapas** devem entrar no chunk via `addW(obj, refX, refZ)` para serem incluídos no culling e em `mergeStaticChunks`.
3. **Novos modelos de inimigos/NPCs** devem usar `buildBakedCached('chave', fn)` em `js/models/core.js`.
4. Ao trocar de mapa, `disposeWorldTree(root)` (`js/level.js:2665`) libera geometrias/materiais — evite vazar referências globais a meshes antigos do mapa anterior.

---

## Notas Relacionadas
- [Sangue, Gore e Desmembramento](Sangue-Gore-e-Desmembramento.md)
- [Modelos 3D e Animação](../02-Gameplay-e-Sistemas/Modelos-3D-e-Animacao.md)
- [UI, HUD, Opções e Persistência](UI-HUD-Opcoes-e-Persistencia.md)
