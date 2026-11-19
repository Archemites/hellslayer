---
title: Dívidas Técnicas, Armadilhas e Gotchas Conhecidos
type: operations
tags:
  - engineering
  - tech-debt
  - gotchas
  - refactoring
updated: 2026-11-18
source_files:
  - viewer.html
  - js/game.js
  - js/game2.js
  - js/level.js
  - GEMINI.md
---

# ⚠️ Dívidas Técnicas, Armadilhas e Gotchas Conhecidos

> Leia esta nota antes de refatorar ou depurar problemas estranhos — ela economiza horas de investigação para qualquer IA.

---

## 1. Dívidas Técnicas Atuais (Verificadas no Código)

| Severidade | Item | Detalhes & Impacto | Solução Recomendada |
| :---: | :--- | :--- | :--- |
| 🔴 **Alta** | **`js/game2.js` (~7.852L) e `js/game.js` (~4.700L) monolíticos** | Concentram player, armas, 3P/Glory Kills (~2.000L), HUD, cutscenes, opções, modais e campanha do Cap. 1 no mesmo IIFE. Dificulta isolar Cap. 2+ e aumenta risco de regressões. | Extrair em módulos vanilla sem bundler (seguindo o sucesso da refatoração de `js/models/`): `js/hud.js`, `js/options.js`, `js/glory.js`, `js/chapters/ch1.js`. |
| 🟠 **Média** | **`viewer.html` quebrado após refactor de `js/models/`** | `viewer.html:68` ainda referencia `<script src="js/models.js"></script>`, arquivo que foi substituído por `js/models/core.js` + `js/models/*.js`. Além disso, `js/nivaldo.js` (~759L) na raiz existe duplicado em relação a `js/models/nivaldo.js`. | Atualizar `<script>` em `viewer.html` para `js/models/core.js` + `js/models/nivaldo.js` (e decidir se `js/nivaldo.js` é arquivado ou fundido). |
| 🟠 **Média** | **Acoplamento de campanha do Cap. 1 em `game2.js` e `level.js`** | `ROOMS`, `EPISODES`, `spawnMaximus`, `galiusEvent`, `goCrypt`, `tombSequence`, `ripSequence` vivem hardcoded dentro de `game2.js`, enquanto `MAP_BUILDERS`/`SPAWNS`/`PICKUPS`/`PEASANTS` vivem em `level.js`. | Criar registro de capítulos (`ChapterRegistry`) antes de iniciar o Cap. 2 (*A Floresta Infernal*). |
| 🟡 **Baixa** | **Nome de marca duplo (`hellslayer` vs. `CABRUNCO`)** | Repositório, `SAVE_KEY` (`hellslayer_save_v1`) e binário (`HELLSLAYER.exe`) usam `HELLSLAYER`, enquanto `package.json -> productName` e janela Electron exibem `CABRUNCO — Beta 1`. | Manter `SAVE_KEY` inalterado para não apagar saves de jogadores; alinhar título de janela/build quando o branding final for fechado. |
| 🟡 **Baixa** | **Docs legados desatualizados (`GEMINI.md` e `plano/`)** | `GEMINI.md` lista contagens de linha antigas (~3k/4.7k) e `js/models.js` monolítico; `plano/` cita `Q` para Super-Fé (hoje é `V`, e `Q` é Chute). | Usar `vault-hellslayer/` como fonte única de verdade e manter `GEMINI.md` apontando para ele quando desejar. |
| 🟡 **Baixa** | **`.obsidian/workspace.json` versionado no git** | Sempre gera diff ruidoso ao abrir o Obsidian. | Adicionar `.obsidian/workspace.json` ao `.gitignore` se quiser commits mais limpos. |

---

## 2. Armadilhas Clássicas (Gotchas para IAs)

1. **Quebrar a ordem dos `<script>` em `index.html`:**
   - `js/models/*.js` dependem de `js/models/core.js` (que define `BUILD`).
   - `js/audio.js` usa `window.ThrashMusic` (`js/thrash.js` precisa vir antes).
   - `js/game2.js` precisa ser o último script.
2. **Esquecer `window.__HSAPI.bind(...)`:**
   - Funções como `die`, `say`, `quip`, `spawnPickup`, `startImpale` e `startGaliusBite` são usadas em `game.js`, mas definidas em `game2.js` e injetadas via `bind`. Se criar nova função em `game2.js` chamada por `game.js`, adicione-a ao `bind`.
3. **Renomear juntas de rigs em `js/models/*`:**
   - `animEnemy`, `initEnemyLimbs`, `severLimb`, `updateNivaldo3P` e `BloodStain` acessam diretamente propriedades como `.head`, `.armL`, `.torso`, `.userData.isArm`. Renomear quebra animações e desmembramento silenciosamente.
4. **Câmera 3P vs. 1P e `getAimRay`:**
   - Nunca dispare projéteis direto de `camera.position` sem passar por `getCrosshairAimPoint` / `getProjectileSpawn` (`js/game2.js:2101–2203`), ou a mira ficará torta na 3ª pessoa e em Glory Kills.
5. **WebAudioFont offline (`js/thrash.js`):**
   - `ThrashMusic` tenta baixar soundfonts de `surikov.github.io` (pode falhar offline ou em sandboxes). O fallback WebAudio local já cobre isso — nunca torne o jogo dependente de `isOnlineMidiReady() === true`.
6. **Electron vs. Navegador:**
   - `window.electronAPI` só existe rodando no Electron. Sempre faça guarda `if (window.electronAPI && window.electronAPI.quit)`.
7. **Garbage Collection em loops a 60 FPS:**
   - Nunca aloque `new THREE.Vector3()`, `new THREE.Matrix4()`, `new THREE.Box3()` ou materiais dentro de `tick`, `updateEnemy`, `updateParts` ou `updatePlayer`.

---

## Notas Relacionadas
- [Regras para IAs](../00-AI-Context/Regras-para-IAs.md)
- [Mapa de Módulos e Globais](../00-AI-Context/Mapa-de-Modulos-e-Globais.md)
- [Roadmap e Milestones](Roadmap-e-Milestones.md)
- [Registro de Decisões (ADR)](Registro-de-Decisoes-ADR.md)
