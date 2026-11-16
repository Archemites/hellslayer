---
title: Plano de Refatoração Técnica
tags:
  - hellslayer
  - arquitetura
  - refatoracao
  - threejs
status: planejado
---

# 🏗️ Plano de Refatoração Técnica (Preparação para Cap. 2+)

Antes de escrever uma única linha do Capítulo 2, é fundamental desacoplar o código da Beta 1 para que cada capítulo seja um módulo independente, fácil de testar e manter.

---

## 1. Arquitetura Atual vs. Arquitetura Alvo

### Atual (Beta 1)
- `js/game.js` + `js/game2.js` divididos arbitrariamente via `window.__HS` e `window.__HSAPI`.
- `js/level.js` mistura helpers geométricos (`wbox`, `hall`, `house`) com os dados hardcoded do Capítulo 1 (`buildZone1..3`, `SPAWNS`, `PICKUPS`).
- `updateEvents()` em `game2.js` contém `if (S.stage === 'z1done' && pz < -84 ...)` diretamente no loop principal.

### Arquitetura Alvo (Modular por Responsabilidade)

```
js/
├── core/
│   ├── engine.js        # Renderer PSX, câmeras, loop principal, input, resize
│   ├── physics.js       # resolveCircle, suporte a plataformas/altura (y), raycast
│   ├── audio.js         # SFX WebAudio (evolução do atual)
│   └── save.js          # localStorage: capítulos desbloqueados, configs, recordes
├── world/
│   ├── textures.js      # Gerador procedural (suporte a paletas por capítulo)
│   ├── geoBuilder.js    # wbox, wfloor, wceil, hall, house, gate, trigger
│   └── models.js        # Builder de rigs + catálogo de inimigos e viewmodels
├── gameplay/
│   ├── player.js        # Movimento, dash, ground slam, Super-Fé, dano/cura
│   ├── weapons.js       # Definições de WEAPONS, ataques, projéteis, Sacra Cruz
│   ├── enemies.js       # IA modular por tipo (melee, flyer, caster, boss)
│   └── hud.js           # Radar, face, style rank, legendas, bossbar, menus
└── chapters/
    ├── chapter1.js      # Dados, geometria, triggers, cutscenes e spawns do Cap. 1
    ├── chapter2.js      # Dados e eventos do Cap. 2 (Floresta Infernal)
    └── ...
```

---

## 2. Mudanças Técnicas Prioritárias (Ordem de Execução)

### Passo 1: Contrato de Capítulo (`ChapterDefinition`)
Cada capítulo exporta (ou registra em `window.CHAPTERS`) um objeto padronizado:
- `id`: `'ch1'`, `'ch2'`, etc.
- `title`, `subtitle`, `fogColor`, `skyType`
- `startPos`: `{ x, y, z, yaw }`
- `build(worldApi)`: constrói geometria, colliders, gates e triggers
- `rooms`: mapa de salas, objetivos e spawns
- `pickups`: lista de pickups iniciais
- `onUpdate(dt, state)`: eventos/cutscenes específicos daquele capítulo

### Passo 2: Sistema Genérico de Triggers & Salas
- Substituir os `if (pz < -84)` hardcoded por **Trigger Boxes** declarativos (`{ x1, z1, x2, z2, once: true, onEnter: ... }`).
- Isso permite criar qualquer sala ou emboscada nova sem tocar no loop principal do jogo!

### Passo 3: Suporte a Altura (`y`) e Plataformas
- Adicionar propriedade `yMin` / `yMax` nos colliders de piso/plataforma para permitir pontes sobre o pântano tóxico no Cap. 2, escadas e arenas com múltiplos níveis.

### Passo 4: Persistência e Configurações (`save.js`)
- Salvar em `localStorage`:
  - Capítulos desbloqueados + arsenal carregado entre capítulos
  - Sensibilidade do mouse, volume master/SFX, FOV
  - Melhor tempo e melhor Style Rank por capítulo

---

## 3. Notas Relacionadas
- [[Auditoria Tecnica do Projeto Atual (Beta 1)]]
- [[Roadmap de Producao (Fases e Milestones)]]
- [[Capitulo 2 - A Floresta Infernal (Proximo)]]
