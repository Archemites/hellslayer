---
title: Playbooks de Tarefas Comuns (Receitas para IAs)
type: playbook
tags:
  - engineering
  - playbook
  - how-to
  - ai-context
updated: 2026-11-18
---

# 🧰 Playbooks de Tarefas Comuns

> Checklists exatos passo-a-passo para as tarefas mais frequentes no projeto sem esquecer nenhum arquivo acoplado.

---

## Playbook 1 — Adicionar uma Nova Arma

1. **`js/game.js` (`WEAPONS`, `L485`):** adicione o objeto `{ id, vm, name, short, owned, melee/ammo, range, dmg, cd, dur, ... }`. Se usar nova munição, adicione o campo em `P` (`L451`) e em `AMMO_MAX` (`L497`).
2. **`js/models/viewmodels.js` (`buildViewmodels`):** crie o viewmodel com chave igual a `w.vm`. Marque nós de braço com `userData.isArm = true` para funcionar com `BloodStain`.
3. **`js/models/nivaldo.js` + `js/game2.js` (`updateNivaldo3P`):** adicione o prop 3ª pessoa na mão do Nivaldo e sua pose de ataque.
4. **`js/bloodstain.js` (`state.weapons`, `L21`):** registre `<id>: 0` para sangue progressivo.
5. **`js/game2.js`:**
   - Lógica de disparo primário em `attack(w)` (`L2621`) e secundário em `altAttack()` (`L2722`).
   - Animação 1ª pessoa em `updateVM(dt)` (`L3062`).
   - Ícone do slot no HUD em `drawWeaponSlotIcon(...)` (`L3354`).
   - Se for obtida via pickup, adicione caso em `mkPickupMesh` (`L2246`) e `collect` (`L2321`), e ajuste arrays `owned` em `EPISODES` (`L7526`).
6. **Validação:** rode `node --check js/game.js`, `node --check js/game2.js`, `node --check js/models/viewmodels.js`, `node --check js/bloodstain.js` e teste `F1` no jogo.

---

## Playbook 2 — Adicionar um Novo Inimigo ou Boss

1. **`js/models/<novo>.js`:** crie `build<Novo>()` usando `humanoid(...)` / `part` / `limb` de `js/models/core.js` e envolva em `buildBakedCached('<novo>', ...)`. Exporte `BUILD.<novo> = build<Novo>;`.
2. **`index.html` (`L872–884`):** adicione `<script src="js/models/<novo>.js"></script>` **depois** de `js/models/core.js` e **antes** de `js/level.js`.
3. **`js/game.js`:**
   - Adicione a definição em `ETYPES` (`L1531`): `model`, `hp`, `hpRange`, `speed`, `r`, ataques (`melee`/`ranged`/`charge`/`stomp`), `pts`, `faith`, `blood`, `boss`/`flying`/`mass`.
   - Se tiver comportamento especial (boss/fases/ataques únicos), adicione em `updateEnemy` (`L3700`), `doEnemyAttack` (`L2974`) e `animEnemy` (`L4109`).
   - Verifique compatibilidade de juntas com `initEnemyLimbs` (`L1562`).
4. **`js/level.js` (`SPAWNS`, `L2281`):** adicione spawns do novo inimigo na(s) sala(s) desejada(s).
5. **Validação:** `node --check` em todos os arquivos tocados + teste de desmembramento e Glory Kill.

---

## Playbook 3 — Adicionar um Novo Mapa / Área

1. **`js/textures.js` (se houver novo bioma):** adicione novas texturas procedurais em `makers` (`L51`).
2. **`js/level.js`:**
   - Se novo ambiente de iluminação/fog, adicione entrada em `ENV` (`L162`) e em `getFogTargets` (`js/game2.js:5946`).
   - Crie `buildMap<Id>()` respeitando `x1 < x2`, `z1 < z2`, `setTerrain`/`addPad`, `addW`, `makeExitGate`.
   - Registre em `MAP_BUILDERS` (`L2502`).
   - Adicione entradas em `SPAWNS` (`L2281`), `PICKUPS` (`L2418`) e `PEASANTS` (`L2462`).
3. **`js/thrash.js` (opcional):** adicione nova faixa no mapa de tracks (`L502`).
4. **`js/game2.js`:**
   - Registre a(s) sala(s) em `ROOMS` (`L3895`) com `name`, `obj`, `track` e `onClear()`.
   - Conecte a transição no `makeExitGate` do mapa anterior ou adicione um novo bloco em `EPISODES` (`L7526`).
5. **Validação:** confira colisão de bordas, chunks visíveis no spawn e ausência de softlock ao limpar a sala (`F3`).

---

## Playbook 4 — Adicionar uma Nova Opção no Menu Valve (`#optionsModal`)

1. **`index.html` (`L177–835`):** adicione o controle (`input`/`select`/`checkbox`) na aba `data-pane` correspondente.
2. **`js/game2.js`:**
   - Valor padrão em `SETTINGS_DEFAULTS` (`L5218`) — e em `QUALITY_PRESETS` + `PRESET_KEYS` (`L5078–5217`) se for opção de preset gráfico/gore.
   - Aplicação no motor em `applySettingsToEngine(cfg)` (`L7066`).
   - Sincronização visual em `syncSettingsUI(cfg)` (`L7224`).
   - Listener de input em `bindOpt(...)` (`L7391+`), chamando `markOptionsDirty()`.
3. **Validação:** teste **Aplicar**, **Cancelar** (reverte snapshot), **OK** (persiste em `hellslayer_save_v1`) e **Restaurar Padrões**.

---

## Playbook 5 — Adicionar um Novo Efeito Sonoro ou Sample MP3

1. Coloque o `.mp3` em `soundeffect/<categoria>/` (já incluso em `package.json -> build.files`).
2. **`js/audio.js`:**
   - Registre a URL em `SAMPLE_URLS` (`L8`) para pré-carregar via `loadSample`.
   - Adicione o efeito em `FX.<nome>` combinando `playSample(...)` + fallback sintetizado (`tone`/`noise`).
3. Dispare no gameplay com `SFX.play('<nome>', arg)`.

---

## Notas Relacionadas
- [Guia: Onde Mexer](../00-AI-Context/Guia-Onde-Mexer.md)
- [Regras para IAs](../00-AI-Context/Regras-para-IAs.md)
- [Dívidas Técnicas e Armadilhas](Dividas-Tecnicas-e-Armadilhas.md)
