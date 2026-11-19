---
title: HELLSLAYER (PARAINFERNÁLIA) — Vault Central (MOC)
type: moc
tags:
  - hellslayer
  - parainfernalia
  - moc
  - ai-context
  - index
updated: 2026-11-18
project_version: Beta 1 (0.1.0)
---

# 🔥 HELLSLAYER (`PARAINFERNÁLIA`) — Vault de Engenharia, Design e Contexto para IAs

> **Ponto de entrada universal** para qualquer IA (Claude, Gemini, Codex, Cursor, Copilot) e para desenvolvedores humanos no **GitHub** e no **Obsidian**.
> Todos os links deste vault usam Markdown relativo (compatível simultaneamente com **GitHub**, **Obsidian Graph/Backlinks** e agentes CLI).

---

## 🎯 O que é este projeto?

**HELLSLAYER** (título de produto `PARAINFERNÁLIA — Beta 1`) é um *boomer shooter* FPS com estética **PSX / retro-3D** construído em **Electron + Three.js Vanilla (sem bundler)**, onde **Nivaldo Cruz** — um pedreiro de 2,30m e 450kg armado de Super-Fé — tem **3 dias** para atravessar o Inferno, destruir o **Necro-Cristal** e derrotar o corrompido **Super-Papa Testus MMDCLXVI**.

| Atributo | Valor Atual |
| :--- | :--- |
| **Runtime** | Electron `^45.3.3` + Three.js (`vendor/three.min.js`), HTML/CSS/JS Vanilla |
| **Bundler / Módulos** | **Nenhum** (`<script>` sequenciais em `index.html`, globais no `window`) |
| **Executar em dev** | `npm start` (`electron .`) |
| **Build portátil Windows** | `npm run dist` (gera `dist/HELLSLAYER.exe` e copia para a raiz) |
| **Conteúdo jogável** | Capítulo 1 completo — 3 Episódios, 8 Mapas (`a1`–`a6_crypt`), 13 `ROOMS`, 7 Armas, 2 Bosses (`Maximus`, `Galius 1/2`), 11 Faixas Thrash Metal |

---

## 🧭 Roteamento Rápido para IAs (Leia Só o que Precisa)

Antes de abrir qualquer arquivo `.js` gigante (`game.js` tem **4.528 linhas**; `game2.js` tem **7.621 linhas**; `level.js` tem **2.456 linhas**), passe por aqui:

| Se a tarefa for sobre... | Leia primeiro | Depois vá para |
| :--- | :--- | :--- |
| **Entender regras e economizar tokens** | [Regras para IAs](00-AI-Context/Regras-para-IAs.md) | [Mapa de Módulos e Globais](00-AI-Context/Mapa-de-Modulos-e-Globais.md) |
| **Achar exatamente em qual linha mexer** | [Guia: Onde Mexer](00-AI-Context/Guia-Onde-Mexer.md) | [Índice de Símbolos](00-AI-Context/Indice-de-Simbolos.md) |
| **Armas, dano, parry, kick, slam, grab, glory kill** | [Combate, Armas e Controles](02-Gameplay-e-Sistemas/Combate-Armas-e-Controles.md) | `js/game.js`, `js/game2.js` |
| **Inimigos, IA, camponeses, Maximus, Galius** | [Bestiário e Bosses (Código)](02-Gameplay-e-Sistemas/Bestiario-e-Bosses-Codigo.md) | `js/game.js`, `js/models/*` |
| **Mapas, geometria, chunks, spawns, progressão** | [Mapas, Campanha e Progressão](02-Gameplay-e-Sistemas/Mapas-Campanha-e-Progressao.md) | `js/level.js`, `js/game2.js` |
| **Modelos 3D, rigs, bakeRig, Nivaldo 3P, rosário** | [Modelos 3D e Animação](02-Gameplay-e-Sistemas/Modelos-3D-e-Animacao.md) | `js/models/*`, `js/game2.js` |
| **Render PSX, performance, culling, SSAO, presets** | [Renderização PSX e Performance](01-Arquitetura/Renderizacao-PSX-e-Performance.md) | `js/textures.js`, `js/game.js`, `js/level.js` |
| **Colisão, física Y, pathfinding A\* de bosses** | [Física, Colisão e Navegação](01-Arquitetura/Fisica-Colisao-e-Navegacao.md) | `js/level.js`, `js/game.js` |
| **Sangue realista, manchas, gore, desmembramento** | [Sangue, Gore e Desmembramento](01-Arquitetura/Sangue-Gore-e-Desmembramento.md) | `js/realblood.js`, `js/bloodstain.js`, `js/game.js` |
| **SFX, samples MP3 e Thrash Metal (11 faixas)** | [Áudio e Thrash Metal](01-Arquitetura/Audio-e-Thrash-Metal.md) | `js/audio.js`, `js/thrash.js` |
| **HUD, menus, modal Valve, keybinds, save** | [UI, HUD, Opções e Persistência](01-Arquitetura/UI-HUD-Opcoes-e-Persistencia.md) | `index.html`, `style.css`, `js/game2.js` |
| **Lore, história, Cap. 2–4, balanceamento** | [Universo, Cronologia e Personagens](03-Lore-e-Design/Universo-Cronologia-e-Personagens.md) | [Visão de Campanha (Cap. 1–4)](03-Lore-e-Design/Visao-de-Campanha-Cap1-a-Cap4.md) |
| **Adicionar conteúdo novo (receitas prontas)** | [Playbooks de Tarefas](04-Engenharia-e-Operacao/Playbooks-de-Tarefas.md) | [Dívidas Técnicas e Armadilhas](04-Engenharia-e-Operacao/Dividas-Tecnicas-e-Armadilhas.md) |

---

## 📂 Mapa Completo do Vault

### `00-AI-Context/` — Navegação & Eficiência para Agentes
- [Regras para IAs](00-AI-Context/Regras-para-IAs.md) — Protocolo de leitura cirúrgica, convenções e validação.
- [Mapa de Módulos e Globais](00-AI-Context/Mapa-de-Modulos-e-Globais.md) — Ordem de carregamento em `index.html` e contrato entre scripts.
- [Índice de Símbolos](00-AI-Context/Indice-de-Simbolos.md) — Mapa atualizado de funções e intervalos de linha por arquivo.
- [Guia: Onde Mexer](00-AI-Context/Guia-Onde-Mexer.md) — Tabela rápida tarefa → arquivo → função → cuidados.

### `01-Arquitetura/` — Motores e Infraestrutura
- [Visão Geral e Stack](01-Arquitetura/Visao-Geral-e-Stack.md) — Electron, Three.js, empacotamento, estrutura de pastas.
- [Renderização PSX e Performance](01-Arquitetura/Renderizacao-PSX-e-Performance.md) — 270p, `psx()`, chunks 16×16, culling, `mergeStaticChunks`, `bakeRig`, presets.
- [Física, Colisão e Navegação](01-Arquitetura/Fisica-Colisao-e-Navegacao.md) — Eixo `-Z`, `groundAt`/`ceilingAt`, `resolveCircle`, `colliderGrid`, A\* (`navFindPath`).
- [Áudio e Thrash Metal](01-Arquitetura/Audio-e-Thrash-Metal.md) — `SFX` + `ThrashMusic` (11 trilhas WebAudioFont/fallback) + samples MP3.
- [Sangue, Gore e Desmembramento](01-Arquitetura/Sangue-Gore-e-Desmembramento.md) — `RealBlood`, `BloodStain` e pipeline de gibs/membros em `game.js`.
- [UI, HUD, Opções e Persistência](01-Arquitetura/UI-HUD-Opcoes-e-Persistencia.md) — DOM, modal Valve (6 abas), dificuldades, episódios, `localStorage`.

### `02-Gameplay-e-Sistemas/` — Regras Reais do Jogo (Código Atual)
- [Combate, Armas e Controles](02-Gameplay-e-Sistemas/Combate-Armas-e-Controles.md) — 7 armas, golpes secundários, Parry, Kick, Slam, Grab, Glory Kill, Super-Fé.
- [Bestiário e Bosses (Código)](02-Gameplay-e-Sistemas/Bestiario-e-Bosses-Codigo.md) — `ETYPES`, camponeses aliados, Maximus (2 fases), Galius 1 & 2.
- [Modelos 3D e Animação](02-Gameplay-e-Sistemas/Modelos-3D-e-Animacao.md) — Pasta modular `js/models/*`, Nivaldo 3P, física de rosário, `viewer.html`.
- [Mapas, Campanha e Progressão](02-Gameplay-e-Sistemas/Mapas-Campanha-e-Progressao.md) — 8 mapas, 13 `ROOMS`, 3 `EPISODES`, spawns, pickups, cutscenes.

### `03-Lore-e-Design/` — Universo, Visão e Futuro
- [Universo, Cronologia e Personagens](03-Lore-e-Design/Universo-Cronologia-e-Personagens.md) — Ano 666 D.S.C., 3 Dias, Necro-Cristal, facções e personagens.
- [Visão de Campanha (Cap. 1–4)](03-Lore-e-Design/Visao-de-Campanha-Cap1-a-Cap4.md) — Cap. 1 (Beta 1), Cap. 2 (Floresta Infernal), Cap. 3 & 4 (Arco Final).
- [Design, Pilares e Balanceamento](03-Lore-e-Design/Design-Pilares-e-Balanceamento.md) — Core Loop, pilares, sinergias, futuras armas e posicionamento.

### `04-Engenharia-e-Operacao/` — Manutenção e Evolução
- [Dívidas Técnicas e Armadilhas](04-Engenharia-e-Operacao/Dividas-Tecnicas-e-Armadilhas.md) — Gotchas reais do código (inclui `viewer.html`, tamanho de `game2.js`, etc.).
- [Playbooks de Tarefas](04-Engenharia-e-Operacao/Playbooks-de-Tarefas.md) — Passo-a-passo para adicionar arma, inimigo, mapa, modelo, som ou opção.
- [Roadmap e Milestones](04-Engenharia-e-Operacao/Roadmap-e-Milestones.md) — Fases 0–4 com status real atualizado.
- [Registro de Decisões (ADR)](04-Engenharia-e-Operacao/Registro-de-Decisoes-ADR.md) — Decisões arquiteturais e seus trade-offs.

### `05-Templates/` — Padronização de Trabalho
- [Template: Spec de Feature](05-Templates/Template-Feature-Spec.md)
- [Template: Bug Report & Diagnóstico](05-Templates/Template-Bug-Report.md)
- [Template: Handoff de Sessão entre IAs](05-Templates/Template-Session-Handoff.md)

---

## 🔄 Relação com Documentos Legados do Repositório

- `../GEMINI.md` — Resumo rápido anterior (algumas linhas/arquivos já ficaram defasados após o refactor de `js/models/` e crescimento de `game.js`/`game2.js`). **Este vault (`vault-hellslayer/`) é a fonte de verdade atualizada.**
- `../plano/` — Documentação original de planejamento em Obsidian. Todo o conteúdo canônico de lore, campanha e design foi preservado e integrado em `03-Lore-e-Design/` e `04-Engenharia-e-Operacao/` com correções de alinhamento ao código atual.
