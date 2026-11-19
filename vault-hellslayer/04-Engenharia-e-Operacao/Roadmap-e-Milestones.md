---
title: Roadmap e Milestones (Status Real Atualizado)
type: roadmap
tags:
  - roadmap
  - milestones
  - planning
updated: 2026-11-18
source_files:
  - plano/05 - Arquitetura e Roadmap/Roadmap de Producao (Fases e Milestones).md
  - plano/05 - Arquitetura e Roadmap/Plano de Refatoracao Tecnica.md
---

# 🗓️ Roadmap e Milestones — HELLSLAYER

> Status sincronizado com o estado real do repositório em **2026-11-18**.

---

## Fase 0 — Polimento da Beta 1 & Sistemas Viscerais ✅ CONCLUÍDA
- [x] Capítulo 1 completo dividido em **3 Episódios**, **8 mapas** (`a1`–`a6_crypt`) e **13 salas (`ROOMS`)**
- [x] 7 armas com ataques secundários no botão direito + Parry + Chute (`Q`) + Super-Fé (`V`) + Ground Slam (`Ctrl`) + Grab/Glory Kills (`F`)
- [x] Boss **Maximus** reformulado (Flamberge, 2 fases, física de rosário, empalamento, cutscene da porta)
- [x] Boss **Galius** completo (Fase 1 imune, Catacumbas + Romulus III, Fase 2 com mordida/blood beam, `ripSequence`)
- [x] **3 camadas de sangue/gore:** Desmembramento/dano visual (`game.js`), `RealBlood` GPU (`realblood.js`) e `BloodStain` progressivo (`bloodstain.js`)
- [x] **Motor Thrash Metal** com 11 faixas dinâmicas (`js/thrash.js`) + samples MP3 + SFX (`js/audio.js`)
- [x] **Menu de Opções estilo Valve** (6 abas, 7 presets de `BATATA` a `ULTRA`, keybinds reconfiguráveis, 6 dificuldades, saves em `localStorage`)
- [x] **Empacotamento Electron portátil** (`HELLSLAYER.exe` via `npm run dist`)
- [x] **Refatoração modular de modelos 3D** (`js/models/*` com `bakeRig` e `buildBakedCached`)
- [x] **Sistema de Chunks 16×16**, `mergeStaticChunks`, FOV Culling e Pathfinding A\* para bosses

---

## Fase 1 — Desacoplamento Multi-Capítulo 🟡 EM ANDAMENTO
- [x] Extração de `js/models/` (13 módulos)
- [x] Extração de `js/thrash.js` e `js/bloodstain.js`
- [ ] Corrigir `viewer.html` (apontar para `js/models/core.js` + `js/models/nivaldo.js`)
- [ ] Fatiar `js/game2.js` (~7.8k linhas) em módulos coesos (`glory.js`, `hud.js`, `options.js`, `player.js`, `chapters/ch1.js`)
- [ ] Extrair registro declarativo de capítulos (`ChapterRegistry`) para carregar Cap. 1 e Cap. 2 de forma isolada
- [ ] **Critério de aceite:** Jogar Episódios 1–3 do início ao fim sem regressões após o split

---

## Fase 2 — Capítulo 2: A Floresta Infernal (Beta 2) 🔜 PRÓXIMO
- [ ] Novas texturas em `js/textures.js` (`bark`, `moss`, `sludge`, `leaves`) e ambiente `ENV.forest`
- [ ] Novos modelos em `js/models/`: `cultist`, `ent`, `swarm`, `belzebub`
- [ ] Nova arma temática: **Turíbulo em Chamas** (slot 8) + viewmodel + 3P + `BloodStain`
- [ ] Mapas `f1`–`f6` com pontes sobre lodo tóxico, troncos destrutíveis e clareira do boss **Belzebub**
- [ ] Novas faixas de trilha em `js/thrash.js` para a Floresta Infernal
- [ ] Balanceamento para jogador iniciando com o arsenal completo do Cap. 1

---

## Fase 3 — Capítulos 3 e 4: Arco Final (Dias 2 e 3)
- [ ] **Cap. 3 — As Forjas do Ódio:** bioma industrial-gótico, Ferreiros Demoníacos, Nefilins Incompletos, **Pregadeira Bento**, boss **Baphomet**
- [ ] **Cap. 4 — O Trono do Super-Papa:** Super-Vaticano invertido, contagem regressiva do 3º Dia, boss **Satanás**, mecânica do **Necro-Cristal** e boss final **Testus MMDCLXVI**
- [ ] Prólogo jogável/slides PSX e Epílogo da reconstrução

---

## Fase 4 — Acabamento & Lançamento Público
- [ ] Modo Arena Infinita / Horda reutilizando arenas prontas
- [ ] Conquistas locais e placar de melhor tempo/rank por capítulo
- [ ] QA multi-resolução, balanceamento das 6 dificuldades e distribuição (Itch.io / Steam / Portable)

---

## Notas Relacionadas
- [Visão de Campanha (Cap. 1–4)](../03-Lore-e-Design/Visao-de-Campanha-Cap1-a-Cap4.md)
- [Dívidas Técnicas e Armadilhas](Dividas-Tecnicas-e-Armadilhas.md)
- [Playbooks de Tarefas](Playbooks-de-Tarefas.md)
