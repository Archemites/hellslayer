---
title: Sistema de Áudio e Motor Thrash Metal
type: architecture
tags:
  - architecture
  - audio
  - music
  - thrash-metal
  - webaudio
updated: 2026-11-18
source_files:
  - js/audio.js
  - js/thrash.js
  - soundeffect/
---

# 🎸 Sistema de Áudio e Motor Thrash Metal

O áudio do jogo é dividido em dois módulos complementares: **`SFX`** (`js/audio.js`) para efeitos, mixer e samples MP3, e **`window.ThrashMusic`** (`js/thrash.js`) para a trilha sonora dinâmica de 11 faixas.

---

## 1. `SFX` (`js/audio.js` — ~405 linhas)

### Camada de Samples Locais (`soundeffect/`)
Carregados via `loadSample(k, url)` e disparados por `playSample(k, rate, vol, useGoreVol)`:
- `soundeffect/gore/gore-explode.mp3`
- `soundeffect/gore/gore-gush.mp3`
- `soundeffect/impact/crossimpact/stab-2.mp3`
- `soundeffect/impact/cutimpact/knife-cut.mp3`
- `soundeffect/impact/generalimpact/body-impact.mp3`
- `soundeffect/lowlife/single-heatbeat.mp3` (batimento cardíaco acionado por `updateLowLifeHeartbeat` em `game2.js:6337`)

### Camada Sintetizada (Web Audio API)
- `tone(f, dur, type, vol, slideTo, delay, dest)` — osciladores para golpes, parry, pickups, portões, tiros.
- `noise(...)` — buffer de ruído filtrado para impactos, explosões, rajadas.
- `vocalScream(pitch)` — gritos sintetizados de demônios e camponeses (controláveis por `setScreams(on)`).

### Controles Públicos & Ducking
- **Volumes independentes:** `setVolume` (master), `setMusicVolume` (trilha), `setGoreVolume` (gore/impactos), `setMuted` / `toggleMute`, `setScreams`.
- **Intensidade dinâmica:** `SFX.setIntensity(v)` acelera/intensifica a bateria e os riffs conforme o combate esquenta.
- **Cutscene Ducking:** `SFX.setCutscene(active)` executa fade suave (`startMusicFade`) no volume da música durante cutscenes cinemáticas.
- **Troca de faixa:** `SFX.setTrack(id)` faz transição suave e delega para `window.ThrashMusic.setTrack(id)`.

---

## 2. `window.ThrashMusic` (`js/thrash.js` — ~720 linhas)

Motor sequenciador MIDI/WebAudio com **11 composições originais inspiradas em Thrash Metal**:
- **Soundfonts Online (WebAudioFont):** tenta carregar via CDN (`surikov.github.io/webaudiofont`) instrumentos Les Paul distorcida/drive, baixo FluidR3 e bateria (kick, snare, hi-hat, crash).
- **Fallback Offline Automático:** se estiver sem internet ou bloqueado, sintetiza guitarra (com curva `SOFT_CURVE` de saturação), baixo e bateria 100% via Web Audio API local sem erros.
- **Buses dedicados:** `guitarBus`, `bassBus`, `drumBus` com lookahead de `1.0s` (`LOOKAHEAD`).

### Tabela das 11 Faixas (`js/thrash.js:502–513`)

| Track ID | BPM Base | Combat Boost | Estilo de Bateria | Uso (`ROOMS` / Telas) |
| :--- | :---: | :---: | :---: | :--- |
| `title` | 140 | +10 | `title` | Tela de título / showcase |
| `ep1_a1` | 120 | +14 | `doom` | Ep. 1 · Área 1 — Bairro Alto |
| `ep1_a2` | 186 | +18 | `thrash` | Ep. 1 · Área 2 — Campos da Perdição |
| `ep1_a3` | 178 | +16 | `thrash` | Ep. 1 · Área 3 — Subúrbio Exterior |
| `ep2_a1` | 154 | +18 | `gallop` | Ep. 2 · Área 4 — Casarões dos Super-Ricos |
| `ep2_a2` | 186 | +16 | `thrash` | Ep. 2 · Área 5 — Avenida do Horror |
| `ep2_a3` | 170 | +16 | `gallop` | Reservada (Ep. 2 extra) |
| `ep3_gate` | 192 | +16 | `dbeat` | Ep. 3 · Área 6 — Portões da Ultra-Igreja |
| `ep3_maximus` | 156 | +16 | `gallop` | Boss: Sérgio Maximo |
| `ep3_nave` | 164 | +16 | `thrash` | Ep. 3 · Área 6 — Nave da Ultra-Igreja |
| `ep3_crypt` | 182 | +16 | `gallop` | Ep. 3 · Catacumbas (`crypt1/2/3`) |
| `ep3_galius` | 138 | +18 | `march` | Boss: Galius, o Super-Ateu (Fases 1 e 2) |

*(Nota: são 12 entradas no objeto de tracks contando `title` + 11 faixas de jogo).*

---

## Notas Relacionadas
- [UI, HUD, Opções e Persistência](UI-HUD-Opcoes-e-Persistencia.md)
- [Mapas, Campanha e Progressão](../02-Gameplay-e-Sistemas/Mapas-Campanha-e-Progressao.md)
- [Playbooks de Tarefas](../04-Engenharia-e-Operacao/Playbooks-de-Tarefas.md)
