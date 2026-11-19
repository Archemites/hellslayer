---
title: Registro de Decisões Arquiteturais (ADR)
type: adr
tags:
  - architecture
  - adr
  - decisions
updated: 2026-11-18
---

# 🏛️ Registro de Decisões Arquiteturais (ADR)

> Documenta **por que** o projeto foi construído desse jeito, evitando que uma IA "refatore" uma decisão intencional por desconhecimento de contexto.

---

## ADR-001: JS Vanilla sem Bundler (Scripts Sequenciais em `index.html`)
- **Decisão:** Manter carregamento direto via `<script>` + `vendor/three.min.js` sem Webpack/Vite/TypeScript.
- **Motivo:** Zero tempo de build em dev (`npm start` instantâneo), depuração direta no DevTools sem sourcemaps, empacotamento trivial no `electron-builder` e facilidade de abrir `index.html` diretamente.
- **Trade-off:** Exige disciplina rígida com ordem de `<script>` e namespaces globais (`TX`, `SFX`, `BUILD`, `World`, `window.__HS`, `window.__HSAPI`).
- **Regra para IAs:** Não migre para bundler/ESM a menos que o usuário peça explicitamente.

---

## ADR-002: Assets 3D e Texturas 100% Procedurais
- **Decisão:** Modelos (`js/models/*`), texturas (`js/textures.js`) e grande parte da música/SFX (`js/thrash.js`, `js/audio.js`) são gerados em código.
- **Motivo:** Coesão estética PSX absoluta, repositório minúsculo, iteração rápida via código (inclusive por IAs) e controle fino de juntas para desmembramento e dano anatômico progressivo.
- **Trade-off:** Exige otimizações explícitas (`bakeRig`, `buildBakedCached`, `mergeStaticChunks`, `InstancedMesh`) para evitar excesso de draw calls.

---

## ADR-003: Três Sistemas Complementares de Sangue (`game.js` + `realblood.js` + `bloodstain.js`)
- **Decisão:** Separar gore anatômico/gibs (`game.js`), física/fluxo GPU de sangue no cenário (`realblood.js`) e manchas progressivas no corpo/armas do jogador (`bloodstain.js`).
- **Motivo:** Cada camada tem custo de GPU/CPU diferente e pode ser escalada ou desligada de forma independente nos 7 presets de qualidade (`BATATA` → `ULTRA`).

---

## ADR-004: Motor Thrash Metal Híbrido (WebAudioFont + Fallback WebAudio)
- **Decisão:** Compor as 11 faixas como sequências estruturadas em `js/thrash.js` tocadas via WebAudioFont (quando online) com fallback sintetizado offline.
- **Motivo:** Permite intensidade dinâmica de combate (`combatBoost` em BPM e densidade de bateria) e ducking limpo em cutscenes sem inchar o `.exe` com dezenas de MB de MP3s.

---

## ADR-005: Chunks 16×16 + `mergeStaticChunks` + `colliderGrid`
- **Decisão:** Particionar cada mapa em chunks 16×16 (`CHUNK_SIZE = 16`), fundir geometria estática por chunk/material e indexar colisores em grade espacial.
- **Motivo:** Permite escalar a distância de renderização (`renderDist: 3..16`) e rodar até em hardware fraco (`BATATA`) mantendo mapas grandes como a Ultra-Igreja e os Campos da Perdição fluidos.

---

## Notas Relacionadas
- [Visão Geral e Stack](../01-Arquitetura/Visao-Geral-e-Stack.md)
- [Renderização PSX e Performance](../01-Arquitetura/Renderizacao-PSX-e-Performance.md)
- [Dívidas Técnicas e Armadilhas](Dividas-Tecnicas-e-Armadilhas.md)
