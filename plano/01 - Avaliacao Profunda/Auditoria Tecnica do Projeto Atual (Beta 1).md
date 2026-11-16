---
title: Auditoria Técnica do Projeto Atual (Beta 1)
tags:
  - hellslayer
  - codigo
  - auditoria
  - threejs
status: concluido
---

# 🛠️ Auditoria Técnica do Projeto Atual (Beta 1)

Esta nota documenta **exatamente o que já existe** no repositório (`c:\Users\T7 - Guilherme\Documents\hellslayer`) e avalia a base técnica antes de expandir para o Capítulo 2+.

---

## 1. Inventário de Arquivos Existentes

| Arquivo               | Tamanho | Responsabilidade Atual                                                                                                                             | Avaliação                                                                               |
| :-------------------- | :-----: | :------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| `index.html`          | 4,0 KB  | Estrutura do DOM: HUD completa (radar, face, style rank, bossbar, vitals, slots) + telas de título, pausa, morte e fim da Beta 1.                  | ✅ Limpo e funcional.                                                                    |
| `style.css`           | 6,9 KB  | Estilização retro/PSX do HUD, overlays, barras de Vida/Fé/Dash, crosshair e hitmarker.                                                             | ✅ Bem resolvido visualmente.                                                            |
| `vendor/three.min.js` | 607 KB  | Biblioteca Three.js embarcada localmente (sem depender de CDN ou bundler).                                                                         | ✅ Ótimo para portabilidade e offline.                                                   |
| `js/textures.js`      | 9,3 KB  | Gerador procedural de texturas em `<canvas>` (`TX`) + shader/material PSX (`PSX_RES = 480x270`, vertex/pixel snapping).                            | ✅ Excelente identidade visual com zero assets externos.                                 |
| `js/audio.js`         | 7,5 KB  | Sintetizador Web Audio API (`SFX`) com trilha/intensidade dinâmica (`SFX.setIntensity`) e efeitos sonoros de armas/bosses.                         | ✅ Funciona sem arquivos `.mp3/.wav`, mas pode ganhar camadas/variação.                  |
| `js/models.js`        | 14,2 KB | Construtor procedural de rigs 3D em blocos (`humanoid`, `buildDiabrete`, `buildPadre`, `BUILD`) + 7 viewmodels em 1ª pessoa + Cruz arremessável.   | ✅ Muito prático para prototipar novos inimigos rápido.                                  |
| `js/level.js`         | 22,5 KB | Geometria, colliders AABB (`World.colliders`), portões, decoração, spawns (`SPAWNS`) e pickups (`PICKUPS`) de todo o Cap. 1.                       | ⚠️ Acoplado ao Cap. 1 e coordenadas globais hardcoded.                                  |
| `js/game.js`          | 26,8 KB | Loop base, cenas (`scene` + `vmScene`), física/colisão circular (`resolveCircle`), definição de `WEAPONS`, estado `P` e `S`, IA inimiga/projéteis. | ⚠️ Mistura engine genérica com regras do Cap. 1.                                        |
| `js/game2.js`         | 44,5 KB | HUD, pickups, lógica de ataque das armas, `ROOMS`, cutscenes (`tombSequence`, `ripSequence`, `galiusEvent`), `updateEvents`, `tick` e `startGame`. | ⚠️ Arquivo muito grande (977 linhas) com toda a máquina de estados do Cap. 1 hardcoded. |

---

## 2. O que Já Funciona na Beta 1 (Checklist Real)

- [x] **Renderização PSX em 270p** com duas cenas separadas (`scene` do mundo + `vmScene` para armas em 1ª pessoa sem clipping na parede).
- [x] **Movimentação completa**: WASD, pulo, colisão circular contra caixas AABB, dash com cooldown, bobbing de câmera, FOV kick e screen shake.
- [x] **Sistema de Armas Completo (0–6)**:
  - `0` Punhos (`fists`)
  - `1` Martelo de Obras (`hammer`)
  - `2` Funda (`sling`) com munição de pedras (`rocks`, max 80)
  - `3` Foice (`scythe`) com ataque em arco (`sweep: true`)
  - `4` Martelo de Demolição (`demo`) com AoE slam (`aoe: 6.5`)
  - `5` Sacra Cruz Papal (`cross`) com arremesso no clique esquerdo e golpe/recall no botão direito
  - `6` Coração Ateu (`heart`) com disparo rápido de sangue (`blood`, max 100)
- [x] **Modo Super-Fé (`Q`)**: dura 10s, acelera movimento (`8.2 -> 10`), reduz cooldown em 30% (`cdMul = 0.7`), aumenta FOV e muda iluminação para dourado.
- [x] **HUD Completa**: Radar 2D, Rosto reativo do Nivaldo (`24x24` canvas), Style Rank, Contador de Chacina e Tempo, Barra de Boss, Legendas de Nivaldo / Baphomet / Romulus III / Super-Anjo.
- [x] **Campanha do Capítulo 1 Inteiras**: Zonas 1–3, Zonas 4–5, Maximus + cutscene de aríete, Ultra-Igreja, Galius Fase 1, Catacumbas, Romulus III, Galius Fase 2, arrancamento do Coração, esmagamento pela Cruz Dourada e Portal da Floresta.
- [x] **Atalhos de Dev**: `F1` (todas as armas), `F2` (god mode), `F3` (limpa sala atual).

---

## 3. Dívidas Técnicas e Gargalos para o Capítulo 2+

> [!danger] O que vai travar o projeto se não for refatorado antes do Cap. 2

1. **Coordenadas e Salas Hardcoded (`level.js` + `game2.js`):**
   - Hoje `z1` até `z6` vivem no mesmo espaço global (`z = 0` até `z = -300` e `x = 300` para a cripta) e `updateEvents()` verifica posições mágicas (`pz < -84`, `px > 200 && pz < -46`).
   - **Risco:** Adicionar o Capítulo 2 no mesmo arquivo vai transformar `level.js` e `game2.js` em um espaguete difícil de manter.
2. **Acoplamento `game.js` <-> `game2.js` via `window.__HS` e `window.__HSAPI`:**
   - A divisão atual foi feita para quebrar o arquivo por tamanho, não por responsabilidade.
   - **Solução:** Separar por domínio real: `engine.js`, `weapons.js`, `enemies.js`, `hud.js`, `story.js`, `chapters/ch1.js`, `chapters/ch2.js`.
3. **Física Apenas 2D/Plana (`y = 0` predominante):**
   - A colisão `resolveCircle` trata tudo no plano XZ, com suporte limitado a altura/plataformas.
   - **Impacto:** Na Floresta Infernal (Cap. 2) e nas próximas fases, desníveis, pontes, ravinas e plataformas elevadas vão enriquecer muito o level design.
4. **Ausência de Persistência (`localStorage`) e Menu de Capítulos:**
   - Ao terminar ou fechar a aba, não há seleção de capítulo, configurações de mouse/áudio ou recordes salvos (melhor tempo / maior rank).

---

## 4. Notas Relacionadas
- [[Plano de Refatoracao Tecnica]]
- [[Capitulo 1 - Nos Portoes do Inferno (Status Beta 1)]]
- [[Roadmap de Producao (Fases e Milestones)]]
