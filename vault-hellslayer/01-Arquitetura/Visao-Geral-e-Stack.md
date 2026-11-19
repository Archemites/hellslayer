---
title: Visão Geral e Stack Técnica
type: architecture
tags:
  - architecture
  - stack
  - electron
  - threejs
updated: 2026-11-18
source_files:
  - package.json
  - electron/main.js
  - electron/preload.js
  - index.html
---

# 🏗️ Visão Geral e Stack Técnica

## 1. Stack e Dependências

| Camada | Tecnologia | Detalhes |
| :--- | :--- | :--- |
| **Desktop Wrapper** | Electron `^45.3.3` | `electron/main.js` (janela `1280×720`, min `960×540`, `Menu.setApplicationMenu(null)`, `singleInstanceLock`, `autoplay-policy=no-user-gesture-required`, `backgroundThrottling: false`) |
| **IPC / Segurança** | `contextBridge` (`electron/preload.js`) | `contextIsolation: true`, `nodeIntegration: false`, expõe `window.electronAPI = { isElectron: true, quit() }` |
| **Render 3D** | Three.js (`vendor/three.min.js`) | Empacotado localmente, sem CDN obrigatória |
| **Linguagem / UI** | HTML5 + CSS3 + JS ES6+ Vanilla | **Sem bundler** (sem Webpack/Vite/Babel) e sem ES modules |
| **Áudio** | Web Audio API + WebAudioFont + MP3 | Síntese procedural (`SFX`), 11 faixas Thrash (`ThrashMusic`), samples locais em `soundeffect/` |
| **Empacotamento** | `electron-builder` `^26.18.0` | Target `portable` Windows → `dist/HELLSLAYER.exe` copiado para `HELLSLAYER.exe` |

---

## 2. Estrutura Real do Repositório

```text
hellslayer/
├── index.html              # DOM completo (HUD, menus, modal Valve, overlays) + ordem dos <script>
├── style.css               # Estilos retro/góticos + modal Valve (~1.039 linhas)
├── viewer.html             # Visualizador 3D isolado do Nivaldo (⚠️ ver dívidas técnicas)
├── package.json            # Metadados ("CABRUNCO — Beta 1"), scripts start/dist e build.files
├── electron/
│   ├── main.js             # Ciclo de vida da janela Electron e IPC app:quit
│   └── preload.js          # Bridge segura window.electronAPI
├── js/
│   ├── textures.js         # Shader PSX (psx()) + gerador procedural de texturas (TX)
│   ├── thrash.js           # Motor de 11 faixas Thrash Metal (window.ThrashMusic)
│   ├── audio.js            # SFX procedural, samples MP3, ducking de cutscene e mixer (SFX)
│   ├── realblood.js        # Sangue realista GPU: gotas, atlas procedural e fluxo (window.RealBlood)
│   ├── bloodstain.js       # Sangue progressivo em Nivaldo 3P e viewmodels (window.BloodStain)
│   ├── models/             # Arquitetura modular de modelos 3D (13 arquivos)
│   │   ├── core.js         # BX, MT, part, limb, humanoid, buildRosary, bioHeart, bakeRig, BUILD
│   │   ├── cross.js        # buildPapalCrossMesh, buildThrownCross
│   │   ├── viewmodels.js   # buildViewmodels (as 7 armas + mãos 1ª pessoa)
│   │   └── *.js            # campones, camponesVivo, demonio, diabrete, galius, gargula, guarda, maximus, nivaldo, padre
│   ├── nivaldo.js          # Modelo alternativo de arte de referência (usado só em viewer.html)
│   ├── level.js            # Sistema de chunks 16×16, terreno, construções, 8 mapas, SPAWNS/PICKUPS/PEASANTS
│   ├── game.js             # Motor 3D, culling, colisão, gore, desmembramento, inimigos, bosses, AI
│   └── game2.js            # Player, armas, 3P, Glory Kills, HUD, campanha/cutscenes, loop principal, opções
├── vendor/three.min.js     # Three.js local
├── assets/                 # baphomet-sigil.png
├── fonts/                  # Cinzel, CinzelDecorative, EBGaramond, Nothing Inside, Silkscreen, VT323
├── soundeffect/            # MP3s de gore/, impact/ (cross, cut, general) e lowlife/ (heartbeat)
├── soundtrack/             # Diretório reservado para trilhas sonoras
├── plano/                  # Documentação legada de design/lore em Obsidian
└── vault-hellslayer/       # ESTE VAULT — documentação completa e atualizada para IAs e humanos
```

---

## 3. Comandos de Operação

| Ação | Comando | Observação |
| :--- | :--- | :--- |
| **Rodar em dev** | `npm start` | Abre Electron carregando `index.html` |
| **Validar sintaxe JS** | `node --check js/game2.js` | Checagem rápida sem abrir o app |
| **Gerar `.exe` portátil** | `npm run dist` | Gera `dist/HELLSLAYER.exe` e copia para a raiz |

> [!note] Compatibilidade com Build Portátil
> Qualquer nova pasta de assets criada na raiz precisa ser listada em `package.json → build.files` para entrar no `HELLSLAYER.exe`.

---

## 4. Ciclo de Boot (Inicialização)

1. Electron abre `index.html` com `autoplay-policy=no-user-gesture-required`.
2. Scripts carregam na ordem fixa (`three.min.js` → `textures` → `thrash` → `audio` → `realblood` → `models/*` → `bloodstain` → `level` → `game` → `game2`).
3. `game.js` cria `renderer`, `scene`, `camera`, `vmScene`, `vmCam`, `VMS`, inicializa `RealBlood` e publica `window.__HS` / `window.__HSAPI`.
4. `game2.js` consome `window.__HS` / `window.__HSAPI`, faz `window.__HSAPI.bind(...)`, carrega `SAVE` do `localStorage` (`hellslayer_save_v1`), aplica configurações (`applySettingsToEngine`), prepara `BloodStain.init(...)`, inicializa o showcase 3D da tela de título (`initTitleShowcase`) e inicia o `requestAnimationFrame(frame)`.

---

## Notas Relacionadas
- [Mapa de Módulos e Globais](../00-AI-Context/Mapa-de-Modulos-e-Globais.md)
- [Renderização PSX e Performance](Renderizacao-PSX-e-Performance.md)
- [Dívidas Técnicas e Armadilhas](../04-Engenharia-e-Operacao/Dividas-Tecnicas-e-Armadilhas.md)
