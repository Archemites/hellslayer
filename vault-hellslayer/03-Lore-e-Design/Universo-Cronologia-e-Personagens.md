---
title: Universo, Cronologia e Personagens (Bíblia Canônica)
type: lore
tags:
  - lore
  - universe
  - characters
  - canon
updated: 2026-11-18
source_files:
  - plano/02 - Lore e Universo/Biblia do Universo e Cronologia.md
  - plano/02 - Lore e Universo/Personagens e Faccoes.md
---

# 📖 Universo, Cronologia e Personagens

> Consolidação canônica do universo de **HELLSLAYER (`PARAINFERNÁLIA`)** para manter consistência de tom, diálogos, quips, arte e eventos em qualquer tarefa futura.

---

## 1. Cronologia Oficial

- **Ano 0 D.S.C. (Depois de Super-Cristo):** O primeiro Super-Papa, **Romulus I**, pede a Deus que abençoe a relíquia **Sacra Cruz Papal**.
- **Era das Guerras Sacras:** **Romulus III** empunha a Sacra Cruz Papal contra as forças das trevas e é sepultado com ela na Câmara Sacra sob a Ultra-Igreja.
- **Ano 666 D.S.C. (Presente):**
  1. O atual Super-Papa, **Testus MMDCLXVI (2666)**, desaparece e é corrompido por **Satanás**, tornando-se o **Imperador do Inferno** com Super-Poderes Demoníacos.
  2. Com **Baphomet**, **Satanás** e **Belzebub**, Testus reúne todas as preces satânicas da humanidade e canaliza o **Necro-Cristal** (nascido do acúmulo de ódio no Inferno) para abrir o **Portal Maligno**.
  3. Os mundos colidem: a cidade da Ultra-Igreja é engolida pelo Inferno.
  4. Após **7 dias de Super-Reza**, o Alto-Conselho da Super-Igreja invoca um **Super-Anjo Mensageiro**, que recruta **Nivaldo Cruz**.

---

## 2. A Regra dos 3 Dias (Estrutura da Campanha)

Nivaldo tem **3 dias** para:
1. Matar o Super-Papa corrompido **Testus MMDCLXVI** (permitindo eleger um novo Super-Papa).
2. Fechar o **Portal Maligno**.
3. Destruir o **Necro-Cristal** antes que a Terra seja totalmente contaminada.

| Dia | Capítulo | Arco Narrativo |
| :---: | :--- | :--- |
| **Dia 1** | **Cap. 1 — Nos Portões do Inferno** *(Jogável na Beta 1)* | Pacificar a cidade engolida, derrotar Sérgio Maximo e Galius, recuperar a Sacra Cruz Papal e entrar no portal. |
| **Dia 1 → 2** | **Cap. 2 — A Floresta Infernal** *(Próximo)* | Atravessar a mata distorcida após o portal desviado e enfrentar **Belzebub**. |
| **Dia 2** | **Cap. 3 — As Forjas do Ódio** | Invadir a indústria infernal onde o Necro-Cristal foi condensado e derrotar **Baphomet**. |
| **Dia 3** | **Cap. 4 — O Trono do Super-Papa** | Quebrar o Necro-Cristal, derrotar **Satanás** e executar **Testus MMDCLXVI**. |

---

## 3. Conceitos e Tom Narrativo ("Sincerão Épico")

- **Tom obrigatório:** o mundo leva seus absurdos completamente a sério — nunca faça piada metalinguística quebrando a quarta parede. Nivaldo fala como um pedreiro devoto revoltado com a obra mal feita do Inferno (*"O alicerce do inferno tá fofo"*, *"Vou rebocar essa tua cara!"*, *"Cimento e oração!"*).
- **Super-Fé:** energia espiritual literal que concede força/velocidade sobre-humanas e controle sobre relíquias (como chamar a Sacra Cruz Papal de volta).
- **Necro-Cristal:** motor profano de ódio puro que sustenta o Portal Maligno.

---

## 4. Personagens & Facções

### Forças da Super-Igreja (Aliados)
- **Nivaldo Cruz (Protagonista):** Pedreiro descendente de imigrantes africanos, morador do Bairro Alto, **2,30m e ~450kg**, devoto inabalável, cabelo preto (mullet/cacheado) e barba, peito nu musculoso, corrente de ouro com cruz, calça cargo e coturnos. ✅ Implementado (`js/models/nivaldo.js`, `QUIPS` em `js/game2.js:2229`).
- **Super-Papa Romulus I & Romulus III:** Criador e antigo portador da Sacra Cruz Papal. O Super-Fantasma de Romulus III concede a Cruz a Nivaldo nas Catacumbas. ✅ Implementado (`tombSequence`).
- **Super-Anjo Mensageiro:** Recruta e guia Nivaldo (revela o portal pós-Galius e explica o desvio na Floresta Infernal).
- **Camponeses Vivos:** Civis encurralados nos bairros que Nivaldo pode resgatar (`BUILD.camponesVivo`). ✅ Implementado.

### Antagonistas & Bosses
- **Sérgio Maximo — Líder da Super-Guarda Real (Cap. 1):** Guardião dos portões da Ultra-Igreja corrompido por Baphomet. Derrotado em luta de 2 fases com Flamberge e usado como aríete na porta da igreja. ✅ Implementado.
- **Galius — O Super-Ateu (Cap. 1):** Nefilim híbrido criado por Baphomet. Empunha a Super-Cruz Dourada como porrete; imune a armas comuns (Fase 1), derrotado pela Sacra Cruz Papal (Fase 2), tem o **Coração Ateu** arrancado e é esmagado sob a própria cruz. ✅ Implementado.
- **Belzebub (Cap. 2 — Planejado):** Senhor das moscas e da podridão na Floresta Infernal.
- **Baphomet (Cap. 3 — Planejado):** Arquiteto profano que provoca Nivaldo desde o Cap. 1 e fabrica híbridos nas Forjas do Ódio.
- **Satanás (Cap. 4 — Planejado):** Guardião do Necro-Cristal antes do trono final.
- **Super-Papa Testus MMDCLXVI (Cap. 4 — Planejado):** Antagonista final, Imperador do Inferno.

---

## Notas Relacionadas
- [Visão de Campanha (Cap. 1–4)](Visao-de-Campanha-Cap1-a-Cap4.md)
- [Design, Pilares e Balanceamento](Design-Pilares-e-Balanceamento.md)
- [Bestiário e Bosses (Código)](../02-Gameplay-e-Sistemas/Bestiario-e-Bosses-Codigo.md)
