---
title: "Template — Especificação de Feature"
type: template
tags:
  - template
  - feature-spec
updated: 2026-11-18
---

# ✨ Feature Spec — `<Nome da Feature>`

## 1. Objetivo e Valor no Jogo
- **Problema / Motivação:**
- **Como se encaixa no tom e core loop de HELLSLAYER:**

## 2. Escopo Técnico (Arquivos e Símbolos)
- [ ] `index.html` — (ex.: novo `<script>`, controle no `#optionsModal` ou elemento no `#hud`)
- [ ] `style.css` —
- [ ] `js/...` — funções/constantes exatas a alterar:
- [ ] Novos globais ou entradas em `window.__HSAPI` / `window.__HSAPI.bind`:

## 3. Impacto em Sistemas Transversais
- **Performance / GC (60 FPS):** aloca vetores no loop? Usa `bakeRig` / `InstancedMesh`?
- **Presets de Qualidade (`BATATA`..`ULTRA`):** precisa degradar em presets baixos?
- **Câmera 1P / 3P e Glory Kills:** funciona nos dois modos?
- **Save / Persistência (`hellslayer_save_v1`):** retrocompatível com saves antigos?

## 4. Critérios de Aceite & Validação
- [ ] `node --check` em todos os arquivos JS alterados
- [ ] Testado em `npm start` (dev) sem erros no DevTools
- [ ] Vault (`vault-hellslayer/`) atualizado se houver novos símbolos/arquivos
