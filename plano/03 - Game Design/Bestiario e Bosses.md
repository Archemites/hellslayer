---
title: Bestiário e Bosses
tags:
  - hellslayer
  - inimigos
  - bosses
status: ativo-beta1
---

# 👹 Bestiário e Bosses

## 1. Inimigos Comuns (Já Implementados em `js/models.js` & `js/level.js`)

| Inimigo | Onde Aparece | Comportamento & Papel em Arena | Counter Ideal | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Camponês Endemoniado** (`campones`) | Bairro Alto (`z1`), Cidade Baixa (`z2`), Cripta (`z5`) | Horda melee frágil, corre em linha reta (alguns com forcado). Fonte fácil de Sangue/Style. | Punhos, Foice | ✅ |
| **Diabrete** (`diabrete`) | Bairro Alto (`z1`), Igreja (`z4a`), Cripta (`z5a`) | Pequeno, ágil e irritante, aparece em bandos e ataca em ângulos variados. | Funda, Foice, Cruz | ✅ |
| **Guarda Endemoniado** (`guarda`) | Cidade Baixa (`z2`), Cripta (`z5b`) | Humanoide blindado com capacete e espada. Mais resistente que o camponês. | Martelo de Obras, Demolição | ✅ |
| **Gárgula** (`gargula`) | Cidade Baixa (`z2`), Igreja (`z4a`) | Inimigo aéreo com asas. Pressiona o jogador a olhar para cima e gerenciar munição. | Funda, Sacra Cruz, Coração | ✅ |
| **Demônio Maior** (`demonio`) | Cidade Baixa (`z2`), Igreja (`z4a`) | Tanque musculoso com chifres e cauda. Alta vida e dano pesado no corpo-a-corpo. | Martelo de Demolição, Super-Fé | ✅ |
| **Padre Endemoniado** (`padre`) | Ultra-Igreja (`z4a`), Cripta (`z5b`) | Inimigo atirador/conjurador à distância. Obriga o jogador a usar o Dash e priorizar alvos. | Funda, Sacra Cruz | ✅ |

---

## 2. Bosses do Capítulo 1 (Implementados)

### 🛡️ Maximus — Líder da Super-Guarda Real (`z3`)
- **Conceito:** Guardião corrompido dos portões da Ultra-Igreja, armado com espada longa e escudo.
- **Mecânica:** Duelo direto em arena aberta na entrada da igreja.
- **Desfecho Canônico:** Esmigalhado por Nivaldo e usado como **aríete humano** para arrombar a porta da Ultra-Igreja.

### 🗿 Galius — O Super-Ateu Nefilim (`z4b` e `z6`)
- **Conceito:** Colosso artificial criado por Baphomet que arranca a **Super-Cruz Dourada** decorativa da igreja para usar como arma.
- **Fase 1 (`z4b`):** Invulnerável às armas comuns de Nivaldo -> força a fuga pela fenda para as Catacumbas.
- **Fase 2 (`z6`):** Vulnerável à **Sacra Cruz Papal**, que atordoa e quebra seus joelhos -> permite arrancar seu **Coração Ateu** e esmagá-lo sob a Super-Cruz Dourada.

---

## 3. Novos Inimigos & Bosses Planejados (Capítulos 2–4)

### Capítulo 2 — A Floresta Infernal
- **Lenha Maldita / Ente Corrompido:** Árvore demoníaca lenta que invoca raízes no chão (exige pulo/dash) e bloqueia passagens.
- **Caçador / Cultista da Mata:** Atira flechas ou projéteis rápidos entre as árvores (emboscada).
- **Enxame de Moscas Infernais:** Nuvens rápidas ligadas a **Belzebub** (ótimas para limpar com Foice ou Turíbulo).
- **Boss do Cap. 2 — O Arauto de Belzebub (ou o próprio Belzebub):** Senhor das Pragas na clareira podre; alterna entre voar/invocar enxames e investir no chão.

### Capítulo 3 — As Forjas do Ódio
- **Ferreiro Demoníaco:** Carrega bigorna/martelo incandescente; solta ondas de fogo no chão.
- **Nefilim Incompleto:** Protótipos falhos de Galius em tanques de sangue — mais fracos, porém explosivos ao morrer.
- **Boss do Cap. 3 — Baphomet, O Arquiteto Profano:** Boss ágil de magia ritualística, teleporte, invocação de círculos no chão e diálogos provocativos (finalmente pagando pelo que falou no Cap. 1!).

### Capítulo 4 — O Trono do Super-Papa
- **Cardeais Corrompidos:** Versão elite dos Padres Endemoniados, com escudos de energia profana quebráveis pela Sacra Cruz.
- **Boss Final (2 Fases):**
  1. **Satanás** (guardando o Necro-Cristal, ataques de fogo e velocidade extrema).
  2. **Super-Papa Testus MMDCLXVI, Imperador do Inferno** (usando o poder do Necro-Cristal; exige destruir os pilares do cristal durante a luta para expor sua forma final).

---

## 4. Notas Relacionadas
- [[Personagens e Faccoes]]
- [[Arsenal e Balanceamento]]
- [[Capitulo 2 - A Floresta Infernal (Proximo)]]
- [[Capitulos 3 e 4 - Arco Final (3 Dias)]]
