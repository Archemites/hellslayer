---
title: Capítulo 2 — A Floresta Infernal (Próximo)
tags:
  - hellslayer
  - campanha
  - capitulo-2
  - design
status: planejado
---

# 🌲 Capítulo 2 — A Floresta Infernal

> [!abstract] Gancho Direto da Beta 1
> Ao cruzar o portal na Ultra-Igreja, Nivaldo espera encontrar o Super-Papa Testus MMDCLXVI, mas cai em um bioma completamente diferente: **uma floresta retorcida no coração do Inferno**, onde árvores sangram seiva negra, cultistas caçam almas perdidas e a podridão de **Belzebub** começa a tomar conta. *(Final do Dia 1 → Início do Dia 2)*

---

## 1. Identidade Visual & Atmosfera (PSX)

- **Paleta:** Trocar o vermelho-alaranjado urbano do Cap. 1 por **verde-pântano doentio, roxo-névoa e troncos carvão** (`fog: 0x0d1c12`, céu estrelado profano ou copa densa fechada).
- **Novas Texturas Procedurais (`js/textures.js`):**
  - Casca de árvore retorcida com olhos/veias pulsantes
  - Solo de musgo infernal / lama sangrenta
  - Água/rio de lodo tóxico (dano contínuo se cair)
  - Madeira podre de pontes e cabanas de culto

---

## 2. Estrutura de Áreas (6 Zonas Enxutas)

1. **Área 1 — Clareira da Chegada:**
   - Nivaldo sai do portal; diálogo com o **Super-Anjo** explicando que Testus não está ali — o portal foi desviado pela magia da mata.
   - Combate introdutório contra **Camponeses/Cultistas da Mata** e **Diabretes**.
2. **Área 2 — O Bosque dos Enforcados:**
   - Passagem estreita com visibilidade reduzida por neblina e troncos. Emboscadas de **Caçadores Cultistas** à distância + **Enxames de Moscas**.
   - **Pickup de Nova Arma:** **Turíbulo em Chamas** (ou **Pregadeira Bento** — ver [[Arsenal e Balanceamento]]).
3. **Área 3 — O Pântano das Raízes:**
   - Arena aberta com ilhas e pontes de madeira sobre lodo tóxico (exige uso de **Dash** e **Pulo**).
   - Introdução do **Ente Corrompido (Lenha Maldita)** — inimigo pesado que bloqueia rotas e invoca espinhos no chão.
4. **Área 4 — Ruínas do Mosteiro Esquecido:**
   - Antiga capela engolida pela floresta. Horda mista: **Gárgulas**, **Padres**, **Guardas** e **Enxames**.
   - Recompensa de lore: inscrições revelando a localização do **Necro-Cristal** nas Forjas abaixo da mata.
5. **Área 5 — Trilha do Zumbido (Corredor de Tensão):**
   - A floresta fica tomada por moscas e carne putrefata; voz de **Belzebub** ecoa avisando que Nivaldo não sairá vivo.
6. **Área 6 — A Clareira Podre (Boss Fight):**
   - **Boss:** **Belzebub, O Senhor das Moscas e da Podridão** (ou seu Arauto Pestilento caso Belzebub fique para o Cap. 3 — recomendado enfrentar **Belzebub** aqui para dar peso real ao capítulo!).
   - **Mecânica do Boss:** Alterna entre voo (invocando enxames e cuspindo ácido) e investida terrestre. Quando atordoado pela **Sacra Cruz Papal**, fica exposto ao **Martelo de Demolição** e **Coração Ateu**.
   - **Desfecho:** Ao morrer, o chão da clareira desaba revelando as **Forjas do Ódio** (Cap. 3).

---

## 3. Novas Mecânicas de Gameplay

- [ ] **Terreno com Desnível / Plataformas:** Pontes sobre lodo tóxico (primeira expansão real da física XZ atual).
- [ ] **Árvores Destrutíveis / Cobertura Dinâmica:** Alguns troncos podres podem ser derrubados com o Martelo de Demolição para abrir atalhos ou esmagar inimigos.
- [ ] **Perigo Ambiental:** Lodo tóxico que dá dano leve e reduz velocidade se Nivaldo pisar fora das tábuas.

---

## 4. Checklist de Produção do Cap. 2

- [ ] Concluir [[Plano de Refatoracao Tecnica]] (suporte a `chapters/ch2.js`).
- [ ] Criar texturas da floresta em `textures.js` (`bark`, `moss`, `sludge`, `leaves`).
- [ ] Criar modelos em `models.js`: `cultist`, `ent`, `swarm`, `belzebub`.
- [ ] Implementar nova arma (Turíbulo ou Pregadeira Bento) + viewmodel.
- [ ] Construir arenas `f1` a `f6` com suporte a altura/pontes.
- [ ] Balancear spawns considerando que o jogador já entra com o arsenal completo do Cap. 1!

---

## 5. Notas Relacionadas
- [[Capitulo 1 - Nos Portoes do Inferno (Status Beta 1)]]
- [[Capitulos 3 e 4 - Arco Final (3 Dias)]]
- [[Bestiario e Bosses]]
- [[Arsenal e Balanceamento]]
