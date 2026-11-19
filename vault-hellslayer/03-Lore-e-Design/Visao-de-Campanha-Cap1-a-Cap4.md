---
title: Visão de Campanha — Capítulos 1 a 4
type: design
tags:
  - design
  - campaign
  - chapter-1
  - chapter-2
  - chapter-3
  - chapter-4
updated: 2026-11-18
source_files:
  - plano/04 - Campanha e Level Design/Capitulo 1 - Nos Portoes do Inferno (Status Beta 1).md
  - plano/04 - Campanha e Level Design/Capitulo 2 - A Floresta Infernal (Proximo).md
  - plano/04 - Campanha e Level Design/Capitulos 3 e 4 - Arco Final (3 Dias).md
---

# 🗺️ Visão de Campanha — Capítulos 1 a 4

## 1. Capítulo 1 — Nos Portões do Inferno ✅ (Jogável na Beta 1)
- **Estrutura implementada:** 3 Episódios (`Às Margens do Inferno`, `Descendo ao Horror`, `A Ultra-Igreja`), 8 mapas (`a1`–`a6_crypt`), 13 `ROOMS`, 7 armas completas, camponeses resgatáveis, Maximus (2 fases + aríete), Catacumbas + Romulus III, Galius 1 & 2 (`ripSequence` + Coração Ateu) e portal para o Cap. 2.
- Detalhamento técnico completo em [Mapas, Campanha e Progressão](../02-Gameplay-e-Sistemas/Mapas-Campanha-e-Progressao.md).

---

## 2. Capítulo 2 — A Floresta Infernal 🔜 (Próximo Grande Marco)

### Gancho Narrativo & Identidade Visual
Ao atravessar o portal na Ultra-Igreja, Nivaldo cai em uma floresta retorcida no coração do Inferno (final do Dia 1 → Dia 2), tomada pela podridão de **Belzebub**.
- **Paleta:** verde-pântano doentio, roxo-névoa e troncos carvão (`fog: 0x0d1c12`), quebrando o vermelho urbano do Cap. 1.
- **Novas texturas procedurais (`js/textures.js`):** `bark` (casca com veias/olhos), `moss` (musgo/lama sangrenta), `sludge` (lodo tóxico animado), `leaves` / madeira podre.

### 6 Áreas Planejadas (`f1`–`f6`)
1. **`f1` — Clareira da Chegada:** diálogo com o Super-Anjo; combate introdutório com Cultistas da Mata e Diabretes.
2. **`f2` — Bosque dos Enforcados:** neblina fechada, emboscadas de Caçadores Cultistas e Enxames de Moscas; pickup da nova arma (**Turíbulo em Chamas** ou **Pregadeira Bento**).
3. **`f3` — Pântano das Raízes:** ilhas e pontes sobre lodo tóxico (dano contínuo + lentidão fora das tábuas); introdução do **Ente Corrompido (Lenha Maldita)**.
4. **`f4` — Ruínas do Mosteiro Esquecido:** horda mista + lore revelando o **Necro-Cristal** nas Forjas abaixo da mata.
5. **`f5` — Trilha do Zumbido:** corredor de tensão com provocações de **Belzebub**.
6. **`f6` — A Clareira Podre (Boss Fight):** **Belzebub, O Senhor das Moscas e da Podridão** (alterna voo/enxames/ácido e investida terrestre; vulnerável a atordoamento pela Sacra Cruz Papal). Ao morrer, o chão desaba rumo às Forjas do Ódio.

### Novas Mecânicas do Cap. 2
- Lodo tóxico ambiental (extensão do padrão de `updateFireHazard`).
- Árvores/troncos podres destrutíveis (extensão do padrão de `World.pillars` / `breakPillar`).
- Balanceamento assumindo que o jogador entra com as 7 armas do Cap. 1.

---

## 3. Capítulo 3 — As Forjas do Ódio (Dia 2 — Planejado)
- **Tema:** indústria gótica infernal (rios de lava/ferro derretido, bigornas colossais, tanques de carne onde Baphomet criou Galius).
- **Novos inimigos:** Ferreiros Demoníacos, Nefilins Incompletos (explosivos).
- **Nova arma:** **Pregadeira Bento** (espingarda de pregos de prata abençoados; disparo em rajada + tiro perfurante).
- **Boss — Baphomet, O Arquiteto Profano:** arena circular com pilares rúnicos; teleporte, pentagramas explosivos e invocação de híbridos. Nivaldo derruba os pilares com o Martelo de Demolição sobre ele.

---

## 4. Capítulo 4 — O Trono do Super-Papa (Dia 3 — Clímax Final)
- **Tema:** versão invertida e profanada do **Super-Vaticano** no topo do Inferno; o céu mostra a contagem regressiva do 3º Dia.
- **Clímax em 2 Atos:**
  1. **Satanás (Guardião do Cristal):** duelo de altíssima velocidade testando Dash, Parry, Kick, Cruz, Coração e Martelo.
  2. **Super-Papa Testus MMDCLXVI & O Necro-Cristal:**
     - Fase 1: quebrar as **3 âncoras de ódio** que tornam Testus invulnerável.
     - Fase 2: abominação colossal; **Super-Fé** recarrega mais rápido graças às orações do Alto-Conselho na Terra.
     - Finalização: cravar a Sacra Cruz Papal no Necro-Cristal e esmagar Testus com o Martelo de Demolição.
- **Epílogo:** Nivaldo volta ao Bairro Alto com sua colher de pedreiro: *"Agora sim. Hora de levantar esses muros de novo."*

---

## Notas Relacionadas
- [Universo, Cronologia e Personagens](Universo-Cronologia-e-Personagens.md)
- [Design, Pilares e Balanceamento](Design-Pilares-e-Balanceamento.md)
- [Roadmap e Milestones](../04-Engenharia-e-Operacao/Roadmap-e-Milestones.md)
