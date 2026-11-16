---
title: Capítulo 1 — Nos Portões do Inferno (Status Beta 1)
tags:
  - hellslayer
  - campanha
  - capitulo-1
status: implementado-beta1
---

# ⛪ Capítulo 1 — Nos Portões do Inferno (Status Beta 1)

Este documento cruza o **roteiro original do Capítulo 1** com o que **já está implementado** em `js/level.js` e `js/game2.js`, destacando o que falta apenas polir.

---

## 1. Mapeamento Lore vs. Código Atual

| Seção da Lore | Sala no Código | O que Acontece | Status |
| :--- | :---: | :--- | :---: |
| **Áreas 1–3: Parte Alta da Cidade** | `z1` | Bairro pobre longe da igreja. Camponeses Endemoniados + Diabretes. Nivaldo encontra a **Funda** em sua casinha e a **Foice** perto da plantação. | ✅ Jogável |
| **Áreas 4–5: Parte Baixa da Cidade** | `z2` | Casarões dos Super-Ricos, ninhos, Guardas Endemoniados, Gárgulas e Demônios Maiores. **Martelo de Demolição** escondido na região. | ✅ Jogável |
| **Portão da Ultra-Igreja** | `z3` | Duelo contra **Maximus**. Ao derrotá-lo, cutscene automática usa o cadáver de Maximus como aríete para arrombar a porta (`openGate('door')`). | ✅ Jogável |
| **Interior da Ultra-Igreja** | `z4a` | Mega-estrutura tomada por Demônios Maiores, Diabretes, Gárgulas e Padres Endemoniados. | ✅ Jogável |
| **Aparição de Galius** | `z4b` | Parede explode (`World.breakWall`), Baphomet fala, Galius entra com a Super-Cruz Dourada, martelo não faz cócegas, o altar se abre no meio (`World.altar`) revelando a escadaria para a cripta. | ✅ Jogável |
| **Catacumbas & Câmara Sacra** | `z5a`, `z5b` | Descida às catacumbas (`x=300`), combate com Diabretes, Padres, Guardas e Camponeses. Interação `[E]` com o Super-Fantasma de **Romulus III** e coleta da **Sacra Cruz Papal**. | ✅ Jogável |
| **Retorno & Morte de Galius** | `z6` | Nivaldo fura o teto, retorna à catedral, atordoa Galius com a Cruz, arranca o **Coração Ateu** (`[E]`), esmaga Galius sob a Super-Cruz Dourada e recebe o portal do Super-Anjo. | ✅ Jogável |

---

## 2. Polimentos Recomendados para a Versão Final do Cap. 1

Mesmo estando 100% jogável na Beta 1, o Capítulo 1 ganha muito com pequenos ajustes antes de ir para o Capítulo 2:

- [ ] **Introdução / Prólogo Jogável ou Tela Animada:** Hoje o Prólogo está resumido em 3 linhas no `index.html`. Adicionar uma sequência de 3–4 slides curtos estilo PSX (ou narração em texto com som de sino) ao clicar em "Entrar no Inferno" dá muito mais peso à missão dos 3 dias.
- [ ] **Sinalização de Objetivos na Cidade Baixa (`z2`):** Garantir que o jogador não se perca procurando os últimos inimigos escondidos nos "ninhos" (o radar ajuda, mas setas/marcadores sutis ou sons de respiração/rugido facilitam limpar a sala).
- [ ] **Feedback da Fenda (`z4b`):** Quando Galius aparece e é invulnerável, deixar ainda mais óbvio visualmente (faiscas de "IMUNE!" ou som metálico + seta no HUD apontando para a fenda no chão).
- [ ] **Ajuste de Colisão/Hitstop:** Aplicar o hitstop e som de impacto melhorado nos ataques de Martelo e Sacra Cruz.

---

## 3. Notas Relacionadas
- [[Auditoria Tecnica do Projeto Atual (Beta 1)]]
- [[Capitulo 2 - A Floresta Infernal (Proximo)]]
- [[Arsenal e Balanceamento]]
