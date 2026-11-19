---
title: Combate, Arsenal e Controles (Estado Real do Código)
type: gameplay
tags:
  - gameplay
  - combat
  - weapons
  - controls
  - glory-kill
updated: 2026-11-18
source_files:
  - js/game.js
  - js/game2.js
  - js/models/viewmodels.js
---

# ⚔️ Combate, Arsenal e Controles

> Todos os valores abaixo foram verificados diretamente em `WEAPONS` (`js/game.js:485–497`) e `DEFAULT_BINDS` (`js/game2.js:5063–5077`).

---

## 1. Tabela das 7 Armas (`WEAPONS`)

| Slot | ID | Nome no HUD | Inicial? | Tipo / Munição | Dano Base | Cooldown | Alcance / AoE | Ataque Secundário (Botão Dir.) |
| :---: | :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | `fists` | PUNHOS | ✅ | Melee (`combo` + `upper`) | `16` | `0.30s` | `3.6u` | **Parry de Pedreiro:** rebate projéteis, interrompe windup, cura e dá Fé |
| **2** | `hammer` | MARTELO DE OBRAS | ✅ | Melee | `36` | `0.62s` | `4.8u` | **Arremesso de Tijolo:** projétil pesado sem gastar munição |
| **3** | `sling` | ESTILINGUE | ❌ | Ranged (`rocks`, máx 80) | `24` | `0.48s` | Projétil | **Pedrada de Davi:** disparo pesado (consome 3 pedras, alto stun) |
| **4** | `scythe` | FOICE | ❌ | Melee (`sweep`, combo) | `30` | `0.72s` | `6.0u` | **Ceifa Sangrenta:** golpe amplo que puxa alvos e extrai sangue |
| **5** | `demo` | MARTELO DE DEMOLIÇÃO | ❌ | Slam AoE (`demoSlam`) | `120` | `1.50s` | `6.5u` AoE | **Onda Sísmica:** slam frontal seguido de ondas de choque |
| **6** | `cross` | SACRA CRUZ PAPAL | ❌ | Bumerangue (`throwCross`) | `34` | `0.25s` | Bumerangue | **Recall / Golpe Sagrado:** chama a cruz de volta instantaneamente |
| **7** | `heart` | CORAÇÃO ATEU | ❌ | Ranged (`blood`, máx 100) | `13` | `0.15s` | Projétil | **Rajada Arterial:** disparo shotgun de sangue |

> [!note] Nome na UI vs. Docs antigos
> No código atual, o slot 3 chama-se **`ESTILINGUE`** (`id: 'sling'`), embora docs legados também o chamem de "Funda".

---

## 2. Mecânicas Extras de Combate (`js/game2.js`)

| Mecânica | Tecla Padrão | Funções no Código | Comportamento |
| :--- | :---: | :--- | :--- |
| **Chute** | `Q` (`kick`) | `startKick` (`L2909`), `performKick` (`L2833`), `launchKickedEnemy` (`game.js:2336`) | Chute rápido independente da arma equipada; arremessa inimigos e pode finalizar/empurrar em perigos. |
| **Super-Fé** | `V` (`faith`) | `activateFaith` (`L2919`), `addFaith` (`game.js:2968`) | Ativa modo Super-Fé quando a barra enche (mais velocidade, cooldown reduzido, tint dourado). |
| **Agarrar (Grab)** | `F` (`glory`) | `findGrabTarget`, `startGrab`, `releaseGrab`, `updateGrabbedEnemy`, `hitGrabbedEnemy` (`L5325–5428`) | Em inimigos pequenos (`isSmallEnemy`), Nivaldo agarra o inimigo com uma mão e pode espancá-lo ou arremessá-lo. |
| **Glory Kill** | `F` (`glory`) | `findGloryTarget`, `startGloryKill`, `updateGloryKill` (`L5305–5560`) + props 3P (`L134–719`) | Em inimigos em estado glory (`enterGloryState` / `setGloryGlow`), alterna para câmera cinemática 3P e executa animações brutais (`gloryHitRip`, `gloryHitDecap`, `gloryHitHammer`, `gloryHitKick`), curando e derramando sangue/gibs. |
| **Ground Slam** | `Ctrl` (`slam`) no ar | `doGroundSlam` (`L5695`) | Queda de 450 kg com dano sísmico em área ao atingir o chão. |
| **Dash** | `Shift` (`dash`) | `updatePlayer` (`L5741`) | Esquiva rápida direcional com barra própria no HUD. |
| **Interagir / Resgatar** | `E` (`use`) | `updateEvents` (`L5561`), `rescuePeasant` (`game.js:2640`) | Interage com gatilhos, túmulo e resgata camponeses vivos. |
| **Câmera 3ª Pessoa** | Toggle (`toggleThirdPerson`) | `isThirdPersonActive`, `toggleThirdPerson`, `updateNivaldo3P` (`L29–2069`) | Permite visualizar o modelo completo de Nivaldo em 3P; também ativada automaticamente em Glory Kills e cutscenes. |

---

## 3. Controles Padrão (`DEFAULT_BINDS` — `js/game2.js:5063–5077`)

| Ação (`bind` key) | Tecla Padrão | Descrição |
| :--- | :---: | :--- |
| `forward` / `back` / `left` / `right` | `W` / `S` / `A` / `D` | Movimento |
| `jump` | `Space` | Pulo |
| `dash` | `ShiftLeft` | Dash |
| `slam` | `ControlLeft` | Ground Slam (no ar) |
| `use` | `KeyE` | Interagir / Resgatar |
| `glory` | `KeyF` | Glory Kill / Agarrar |
| `kick` | `KeyQ` | Chute |
| `faith` | `KeyV` | Ativar Super-Fé |
| `respawn` | `KeyR` | Tentar de novo |
| `mute` | `KeyM` | Silenciar áudio |
| *(Fixos)* | `Mouse0` / `Mouse2` / `1–7` / `Wheel` / `ESC` | Ataque, Alt, Troca de arma, Pausa |
| *(Dev)* | `F1` / `F2` / `F3` | Arsenal completo / Modo Deus / Limpar sala atual (`devClear`) |

> [!warning] Atenção ao ler docs antigos de `plano/`
> Documentos antigos em `plano/` citavam `Q` para Super-Fé. No código atual, **`Q` é Chute** e **`V` é Super-Fé** (ambos reconfiguráveis na aba Teclado do `#optionsModal`).

---

## 4. Pipeline de Mira e Projéteis (`js/game2.js:2076–2203`)
- `getAimRay` / `getAimDir`: calcula raio da mira considerando câmera 1P ou 3P.
- `getCrosshairAimPoint`: resolve o ponto exato sob o crosshair (para projéteis convergirem corretamente tanto em 1P quanto em 3P).
- `getProjectileSpawn(weaponId, ...)`: ponto de saída do projétil alinhado ao viewmodel ou mão 3P.
- `BloodStain.addBlood(...)`: acionado em impactos melee/glory para sujar progressivamente Nivaldo e a arma ativa.

---

## Notas Relacionadas
- [Bestiário e Bosses (Código)](Bestiario-e-Bosses-Codigo.md)
- [Sangue, Gore e Desmembramento](../01-Arquitetura/Sangue-Gore-e-Desmembramento.md)
- [Design, Pilares e Balanceamento](../03-Lore-e-Design/Design-Pilares-e-Balanceamento.md)
