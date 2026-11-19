---
title: UI, HUD, Menu de Opções e Persistência
type: architecture
tags:
  - architecture
  - ui
  - hud
  - options
  - persistence
updated: 2026-11-18
source_files:
  - index.html
  - style.css
  - js/game2.js
---

# 🖥️ UI, HUD, Menu de Opções e Persistência

Toda a interface usa **HTML/CSS nativo sobreposto ao `<canvas>` WebGL**, sem frameworks frontend, com cache de DOM (`el`, `setText`, `setW` em `js/game2.js:2070–2073`) para evitar reflows desnecessários a 60 FPS.

---

## 1. Mapa de Telas e Overlays (`index.html`)

| Elemento DOM | Linhas aprox. | Função |
| :--- | :---: | :--- |
| `#hud` | `13–65` | Área/objetivo, Style Rank, barra de Boss, contador de FPS, mira customizável + hitmarker, caixa de diálogos (`say`/`baph`), rosto animado do Nivaldo (`drawFace`), radar (`drawRadar`), barras de Vida/Armadura/Fé/Dash, slots das 7 armas com ícones desenhados em `<canvas>` (`drawWeaponSlotIcon`). |
| `#title` + modais | `68–150` | Tela inicial sobre cena 3D viva (`initTitleShowcase` / `tickTitle`): `#titleChapterModal`, `#titleEpisodeModal` (3 episódios com thumbnails capturadas em tempo real por `captureEpisodePreviews`), `#titleLoadModal` (saves), `#titleExitModal`. |
| `#pause` | `151–175` | Overlay de pausa (ESC), acesso rápido a Opções, Reiniciar e Voltar ao Título. |
| `#optionsModal` | `177–835` | Menu estilo **Valve** com 6 abas (`data-pane`): `video`, `gore`, `game`, `mouse`, `audio`, `keyboard`. Possui snapshot/dirty state (`cloneSettingsSnapshot`, `markOptionsDirty`, OK / Cancelar / Aplicar / Restaurar Padrões). |
| `#death` | `837–841` | Tela de morte (`respawnBtn` / tecla `R`). |
| `#levelComplete` | `843–858` | Tela de fim de área com estatísticas (Chacina/Kills, Estilo %, Tempo, Rank Final) e avanço com `[ESPAÇO]`. |
| `#end` | `860–865` | Tela de conclusão da Beta 1 com gancho para o Capítulo 2 (*A Floresta Infernal*). |

> [!tip] Texturas Procedurais na UI
> Em `js/game2.js:7553–7561`, o jogo exporta `stone`, `church` e `brick` de `TX.get(...)` via `toDataURL()` para variáveis CSS (`--tex-stone`, `--tex-church`, `--tex-brick`), mantendo a UI com a mesma textura PSX do mundo 3D.

---

## 2. Abas do `#optionsModal` (Estilo Valve)

| Aba (`data-pane`) | Controles Principais |
| :--- | :--- |
| **`video`** | Preset de qualidade (`batata`..`ultra`), resolução interna (`resH`), distância de renderização (`renderDist`), `fogScale`, `ssaoQuality`, `lightingQuality`, `worldDetail`, `blobShadows`, `psxJitter`, `texFilter`, `pixelatedCanvas`, `fov`, `fpsCap`. |
| **`gore`** | `bloodMode` (`realistic`/`classic`), `goreQuality`, `particleScale`, `goreDur`, `goreImpact`, `dismember`, `bleedJoints`, `gibDrips`. |
| **`game`** | `bob`, `roll`, `shake`, `hitstop`, `vmBob`, `screenFlash`, `showVM`, `showRadar`, `showFace`, `showStyle`, `quips`, `peasantLabels`, `showFps`. |
| **`mouse`** | `sens`, `invertY`, `rawInput`, `chStyle`, `chColor`, `chSize`, `showHitmarker`. |
| **`audio`** | `vol` (master), `musicVol`, `goreVol`, `screams`, `muted`. |
| **`keyboard`** | Tabela interativa (`renderKeybindsTable`, `setBindKey`) para redefinir os 13 comandos de `DEFAULT_BINDS`. |

---

## 3. Persistência (`localStorage`)

- **Chave única:** `SAVE_KEY = 'hellslayer_save_v1'` (`js/game2.js:5062`).
- **Conteúdo salvo (`SAVE`):**
  - Todas as configurações de `SETTINGS_DEFAULTS` + `binds`.
  - Recordes: `bestTime`, `bestKills`, `bestRank`, `ch2Unlocked`.
  - Slots de progresso de campanha (gerenciados por `populateSaveSlots`, `writeSave`).
- **Segurança contra atalhos de navegador/Electron:** `shouldBlockBrowserShortcut(e)` (`js/game2.js:6863`) e `lockReservedKeys()` (`L6765`) bloqueiam `Ctrl+W`, `Ctrl+R`, `Tab`, etc., durante pointer lock para evitar fechar o jogo acidentalmente ao agachar/correr.

---

## 4. Seletor de Dificuldade (`DIFFICULTIES` — `js/game.js:469–476`)

| ID | Nome | `spawnMul` | `dmgMul` |
| :---: | :--- | :---: | :---: |
| `0` | Melzinho na Chupeta | `0.50×` | `0.35×` |
| `1` | Fácil | `0.75×` | `0.65×` |
| `2` | **Normal** *(padrão)* | `1.00×` | `1.00×` |
| `3` | Difícil | `1.35×` | `1.40×` |
| `4` | Muito Difícil | `1.75×` | `1.85×` |
| `5` | **PARAINFERNÁLIA!!!** | `2.25×` | `2.50×` |

---

## Notas Relacionadas
- [Renderização PSX e Performance](Renderizacao-PSX-e-Performance.md)
- [Combate, Armas e Controles](../02-Gameplay-e-Sistemas/Combate-Armas-e-Controles.md)
- [Playbooks de Tarefas](../04-Engenharia-e-Operacao/Playbooks-de-Tarefas.md)
