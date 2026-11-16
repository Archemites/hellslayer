---
title: Roadmap de Produção (Fases e Milestones)
tags:
  - hellslayer
  - roadmap
  - producao
status: ativo
---

# 🗓️ Roadmap de Produção — HELLSLAYER

Plano prático dividido em fases incrementais para levar o jogo da **Beta 1 atual** até a **campanha completa dos 3 Dias**.

---

## Fase 0 — Polimento da Beta 1 (Game Feel) ✅ CONCLUÍDA
**Objetivo:** Deixar o combate do Capítulo 1 ainda mais visceral antes de multiplicar conteúdo.
- [x] Adicionar **Hitstop** reforçado e avanço frontal no Martelo de Demolição.
- [x] Adicionar **Parry de Projétil** nos Punhos (Slot 1, botão direito) + ataques secundários para todas as 7 armas.
- [x] Adicionar **Ground Slam / Queda de 450 kg** (`Ctrl` ou `C` no ar) com dano sísmico em área.
- [x] Melhorar sinalização visual e sonora na **Fase 1 do Galius** (som metálico `clang`, faíscas e aviso claro de `IMUNE`).
- [x] Corrigir bug de teleporte vertical da Gárgula durante o ataque melee (mergulho suave).
- [x] Anti-softlock nas salas: quando restam `<= 3` inimigos, eles entram em aggro e o radar aponta para o mais próximo.
- [x] Adicionar menu de **Configurações** (sensibilidade do mouse e volume) + salvamento de recordes em `localStorage`.

---

## Fase 1 — Refatoração Multi-Capítulo
**Objetivo:** Desacoplar o código sem quebrar nada do que já funciona na Beta 1.
- [ ] Separar `game.js` + `game2.js` nos módulos definidos em [[Plano de Refatoracao Tecnica]].
- [ ] Extrair o Capítulo 1 inteiro para `chapters/chapter1.js` usando Trigger Boxes genéricos.
- [ ] Adicionar suporte a **plataformas/desníveis (`y`)** na colisão do jogador.
- [ ] Criar **Seletor de Capítulos** na tela inicial + persistência em `localStorage` (`save.js`).
- [ ] **Critério de Aceite:** Jogar o Capítulo 1 do início ao fim após a refatoração sem nenhum bug novo.

---

## Fase 2 — Capítulo 2: A Floresta Infernal (Beta 2)
**Objetivo:** Entregar o segundo capítulo completo continuando o gancho da Beta 1.
- [ ] Implementar paleta e texturas procedurais da Floresta (`textures.js`).
- [ ] Implementar modelos e IA de **Cultista da Mata**, **Ente Corrompido**, **Enxame** e boss **Belzebub**.
- [ ] Implementar nova arma temática (**Turíbulo em Chamas** ou **Pregadeira Bento**).
- [ ] Construir áreas `f1`–`f6` com pontes sobre lodo tóxico e clareira do boss.
- [ ] Playtest focado em ritmo e economia de munição/vida.

---

## Fase 3 — Capítulos 3 e 4: Arco Final (3 Dias)
**Objetivo:** Fechar a campanha completa e derrotar Testus MMDCLXVI.
- [ ] **Cap. 3 (As Forjas do Ódio):** Bioma industrial-infernal, **Baphomet** como boss, arma/upgrade final de pedreiro.
- [ ] **Cap. 4 (O Trono do Super-Papa):** Super-Vaticano profanado, **Satanás**, mecânica do **Necro-Cristal** e boss final **Testus MMDCLXVI**.
- [ ] Tela de **Prólogo** (introdução animada/slides PSX) e **Epílogo** (Nivaldo reconstruindo a cidade).

---

## Fase 4 — Acabamento, Áudio & Lançamento
**Objetivo:** Preparar para distribuição pública (Itch.io / Web / Electron ou Steam).
- [ ] Expandir `audio.js` com variação de faixas por capítulo (órgão distorcido na igreja, percussão ritual na floresta, metal industrial nas forjas).
- [ ] Modo **Arena Infinita / Horda** usando as arenas já prontas para rejogabilidade.
- [ ] Conquistas locais / placar de melhor tempo e Style Rank por capítulo.
- [ ] Empacotamento e testes em múltiplos navegadores/resoluções.

---

## Notas Relacionadas
- [[00 - Dashboard (MOC)]]
- [[Plano de Refatoracao Tecnica]]
- [[Avaliacao de Game Design e Mercado]]
