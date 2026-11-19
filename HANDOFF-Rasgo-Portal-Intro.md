# Handoff: refazer o cenário do portal na cutscene inicial (Ato 2)

> **Pedido do usuário (literal):** "durante a cutscene inicial, quando nivaldo vai pular no portal para o inferno, quero que você analise e refaça o cenário, capturando a essência de ter um rasgo na realidade que leva ao inferno e que você reimagine com uma render absurda de bonita, seguindo o estilo, sem formas básicas como cubos ou pirâmides, mas tudo modeladinho dahora"
>
> **Status:** análise concluída e design fechado. **Nenhum arquivo de código foi editado ainda.** Git está limpo em `main` (último commit `5cf49a2`).

---

## 1. Regras do projeto (resumo de `vault-hellslayer/00-AI-Context/Regras-para-IAs.md`)

- **Não** leia `js/game.js`, `js/game2.js` e `js/level.js` inteiros: use grep e leia só janelas de 50 a 150 linhas.
- **Sem ES Modules e sem bundler.** Tudo é `<script>` clássico em `index.html`. Um script novo precisa ser registrado na ordem certa.
- Textos e comentários em **pt-BR**, no tom "sincerão épico".
- Coordenadas: `Y` para cima e **`-Z` é a frente** (`yaw = 0` olha para `-Z`).
- Materiais devem passar por `psx(mat)` (vertex snap PS1). Em ShaderMaterial custom, o snap tem que ser feito à mão (seção 6).
- Nada de `new THREE.Vector3()` dentro do loop por frame: use vetores scratch.
- Depois de editar, rode `node --check js/<arquivo>.js`. Se criar um JS novo, atualize `vault-hellslayer/00-AI-Context/Mapa-de-Modulos-e-Globais.md` (seção 1, ordem dos `<script>`).

## 2. Stack e render

- **three.js r147** (`vendor/three.min.js`). Renderer: `antialias:false, stencil:false`, `autoClear = false` (`js/game.js:18-19`). Câmera: `PerspectiveCamera(75, 16/9, 0.25, 520)`. A cutscene força `camera.far = 480`.
- A resolução interna é baixa (padrão 360p, `setInternalHeight` em `js/game.js:425`) e o CSS escala com pixelated. Por isso silhueta, cor, luz e atmosfera pesam mais que detalhe fino.
- `PSX_RES` é um `const` global em `js/textures.js:7` (`{ value: Vector2 }`) e fica acessível pelo nome em outros scripts clássicos. `psx(mat)` (`js/textures.js:10`) troca `#include <project_vertex>` via `onBeforeCompile` e define `customProgramCacheKey = () => 'psx'`.
  - **Atenção:** `psx()` **sobrescreve** `onBeforeCompile`. Para combinar com outros patches (vento, glow), escreva um patch próprio que já inclua o snap.
- `MT(color, opts)` e `BX(w,h,d)` ficam em `js/models/core.js` e são os helpers de caixa. **Não** use no cenário novo (o usuário quer fim das caixas).
- Lambert do r147 é **per-fragment**. Chunks confirmados no vendor:
  - vert: `#include <begin_vertex>`, `#include <project_vertex>`, `#include <worldpos_vertex>`
  - frag: `vec3 totalEmissiveRadiance = emissive;` …depois `#include <emissivemap_fragment>`, onde dá para injetar glow somando em `totalEmissiveRadiance`.
- Num ShaderMaterial, quando o objeto é `InstancedMesh`, o prefixo já declara `attribute mat4 instanceMatrix` (com `USE_INSTANCING`). Com `setColorAt`, também declara `instanceColor` (`USE_INSTANCING_COLOR`).
- Existe um `mergeBufferGeometries(geos)` global em `js/level.js:2720`. Ele junta só position, normal, uv e index, **não** cor. Para vertex colors e atributos custom, escreva um merge próprio.
- Preview: `.claude/launch.json` tem `hellslayer-static` (`python -m http.server 8765`). O título abre em `http://localhost:8765/`. `?autostart` **pula** a intro (`js/game2.js:8403`).

## 3. Como a cutscene funciona hoje (`js/introCutscene.js`, 1832 linhas)

- IIFE que expõe `window.IntroCutscene = { start, stop, skip, update, render, isActive }` (linha ~1824).
- Tempos: `ACT2_TIME = 25.0`, `ACT3_TIME = 42.2`, `TOTAL_DUR = 56.8`. O Ato 2 dura 17,2 s (`a2t = t - 25`).
- Integração com o jogo (`js/game2.js`):
  - `startGame` chama `IntroCutscene.start({ camera, worldScene: scene, spawnPos, playerEye, renderWorld: A.renderScene, say, setCinemaUI, onComplete })` (`~8407`).
  - O tick chama `IntroCutscene.update(dt, camera)` (`~7620`) e o render chama `IntroCutscene.render(r, camera)` (`~8046`).
- Helpers internos: `mkGeo(g)` e `mkMat(m)` registram para dispose (e `mkMat` aplica `psx`). `addBox` usa `BX/MT`. `hideNivaldoWeapons(rig)`.
- `start()` cria `scene = new THREE.Scene()` com `act1Group = buildAct1()` e `act2Group = buildAct2()`.
- `setAct(2)` define `scene.background = 0xe87b35` e `scene.fog = Fog(0xe6803c, 105, 360)`.
- `render()`: nos atos 1 e 2 faz `renderer.setRenderTarget(null); renderer.clear(); renderer.render(scene, camera)`. No ato 3 renderiza o mapa real.
- `stop()` faz dispose de `ownedGeos/ownedMats` e zera as referências. Se adicionar estado novo, **zere aqui também**.

### `buildAct2()` (linhas 358–970), o que existe hoje (tudo a substituir)
- Luzes: Ambient `0x8a543c` 0.9, Hemisphere, sol direcional `0xff9438` em (110,38,-55), fill.
- Céu: esfera com textura de gradiente em canvas, sol em esfera, halo em plano.
- Nuvens: **dodecaedros** (`clouds[]`, andam em x no update).
- Terreno: `fieldHeight(x,z)` (linhas 441–473), plano 320×175 com vertex colors, platô em 26.15 em volta do Nivaldo, estradinha senoidal `x = sin(z*0.055)*3.2`, barranco em `edgeZ = -2.4 - sin(x*0.09)*2.2 - cos(x*0.21)*0.9`.
- Montanhas: **cones**. Árvores: **cilindro + cones/dodecaedros**. Pedras: dodecaedros. Cerca, flores e capela: **caixas**.
- Portal: parede de montanha (`RingGeometry`) com **túnel cilíndrico** em `TUN = (0, 20, -44)`, R=25, anéis **torus** dentro e pedras em volta. Câmara do inferno: esfera em (0,-18,-210), chão em `HELL_Y = -68`, rios de lava em caixa, 64 casas em **caixa**, fogo em **caixa**, brasas em **caixa**.
- Nivaldo: `nivaldo2 = BUILD.nivaldo()` em **(0, 26.18, -0.4)**, `rotation.y = PI` (olha para -Z). Tem `crossGlowMesh`/`crossGlowLight` no `chestGroup` e `faithSparks` (caixinhas de 0.055, podem virar icosaedro ou Points).

### `updateAct2()` (linhas 1376–1559): linha do tempo, falas e câmera
| a2t | Evento | Câmera |
|---|---|---|
| 0–8.2 | SFX portal/roar; título "CIDADE NATAL DE NIVALDO / PORTAL DO INFERNO · DIA 1 DE 3" (1.4–5.2) | Zoom out atrás do Nivaldo: pos (0,28.15,2.45) até (sin(.7)*1.8, 45.5, 25.5); look (0,27,-22) até (0,12,-98) com easeOutCubic; fov 56→74 |
| 8.2–13.3 | aperta a cruz (grip), SFX faith 8.6, fala **"Que o Super-Senhor esteja comigo."** em 9.2 | Close **na frente** dele olhando para +Z: pos (1.55→1.15, 27.9, -2.55→-2.15), look (0,27.78,-0.35), fov 46→42. O fundo é o **campo atrás dele** |
| 13.3–14.0 | agacha e dá impulso | Lateral: pos (3.6→4.4, 28.2→29.1, 2.2→3.2), look no Nivaldo |
| 14.0–17.1 | Mergulho Superman: `j=(a2t-14)/3.1`, `nivPos.z = lerp(-1.15,-78, lerp(j,je,0.45))`, `y = lerp(26.1,12,je) + sin(j*PI)*4.8` | Segue por trás: pos (lerp(4.4,1.8), nivPos.y+3.4→2.2, nivPos.z+7→5.8), look (0, lerp(nivPos.y,-10,f*.55), lerp(nivPos.z-12,-110,f)), fov 64→88 |
| 16.5→ | flash `#ff4218` (overlay DOM `#flash`) | Corta para o Ato 3 em 17.2 |

A pose e a animação do rig do Nivaldo já estão afinadas: **mexa só no destino e no tempo do mergulho**.

### Ato 3 (linhas 979–1094, `buildAct3Overlay`)
Há um portal no céu do mapa a1 feito de `CircleGeometry` + 3 **TorusGeometry** (`skyPortalRings`). Está fora do escopo pedido, mas é o "outro lado" do mesmo rasgo. Vale **oferecer** ao usuário refazer reaproveitando o construtor do rasgo. O mapa a1 já tem um grande anel vermelho no céu (ver `assets/previews/a1.jpg`).

---

## 4. Design aprovado para implementar

### Conceito
Fim de tarde dourado. Nivaldo está na ponta de um promontório de grama sobre um vale. A uns 78 m, um **rasgo vertical colossal na realidade** paira sobre o vale. As bordas são rasgadas e **queimam como papel ou filme** (linha incandescente branco-amarela, faixa de brasas, carvão que se desfaz em farrapos), e as abas se curvam em 3D. **Pela fenda se vê o Inferno**: céu carmesim com vórtice de nuvens, um **eclipse negro com coroa vermelha** bem no centro da janela e, lá embaixo, a cidade natal pegando fogo, com rios de lava e colunas de fumaça.

Em volta do rasgo a realidade se estilhaça:
- **Rachaduras vermelhas brilhantes no céu** irradiando da fenda.
- **Cacos flutuantes**: a frente mostra pedaços do céu, o verso mostra o inferno.
- Pedras, torrões de grama e árvores arrancadas espiralando para dentro.
- Folhas e poeira sugadas; brasas saindo da borda.
- O chão do vale perto da base fica carbonizado, com **rachaduras de lava** avançando em "dedos" até o penhasco.
- A grama do campo inteiro **se inclina na direção do rasgo**.

### Posições e escala (mundo do Ato 2)
- Nivaldo continua em (0, 26.18, -0.4). Platô em y=26.15. A borda do penhasco fica em z≈-3 (a ideia era transformar o platô num promontório, com a borda recuando para +Z nas laterais, ex.: `edgeZ = -3 + max(0,|x|-6)*0.35 + sin(x*0.3)*0.6`).
- Penhasco cai cerca de 34 m até o **fundo do vale em y≈-8**. Paredes laterais sobem em colinas para emoldurar o rasgo. O vale segue até z≈-280.
- **Rasgo:** centro `R = (0, 24, -78)`, altura ~68 (y de -10 a 58), meia-largura máxima ~15. Formato de lente vertical com jag em várias frequências, leve curva em S e `rotation.z ≈ 0.08`. **Plano do rasgo em z = -78**, sem bojo, para o teste de travessia ficar simples.
- Sol: baixo à direita, um pouco à frente, direção ≈ normalize(0.8, 0.18, -0.55). No zoom out aparecem os dois, sol à direita e rasgo no centro.

### Truque técnico central: janela para o inferno
- **`hellScene` separada** (THREE.Scene) com o conteúdo do inferno **nas mesmas coordenadas do mundo**, atrás do plano do rasgo (tudo com z < -90).
- Um `WebGLRenderTarget` do tamanho do drawing buffer (NearestFilter, com depth), redimensionado quando o tamanho muda. A cada frame do Ato 2:
  1. `setRenderTarget(hellRT)`, clear, `render(hellScene, camera)` com a **mesma câmera**. Isso dá parallax perfeito.
  2. `setRenderTarget(null)`, clear, `render(scene, camera)`. A **membrana** do rasgo é opaca, escreve depth e amostra `hellRT` por `gl_FragCoord.xy / uRes` (uRes = tamanho do drawing buffer). No shader: distorção nas bordas, aberração cromática perto da borda, brilho quente na borda e ondulações.
- **Travessia da câmera:** se `camera.position.z < -78.5`, renderize **só a `hellScene`** direto na tela.
- **Nivaldo atravessando:** quando `nivaldo2.root.position.z < -76`, faça `hellScene.add(nivaldo2.root)` antes do passe do RT e `act2Group.add(nivaldo2.root)` depois. Na passada principal a membrana esconde a parte de trás e o RT mostra o corpo inteiro na mesma posição de tela, então fica sem emenda. A hellScene precisa de luzes próprias para o Lambert dele (Ambient vermelho, Hemisphere escuro/laranja, direcional laranja de baixo).
- Domos de céu (main ~420, hell ~450) devem **seguir `camera.position`** a cada frame. O shader usa `normalize(worldPos - cameraPosition)`.

### Novo tempo do mergulho (para atravessar antes do flash)
- `j = clamp((a2t-14.0)/2.5, 0, 1)`, `nivPos.z = lerp(-1.15, -96, lerp(j, je, 0.45))`, `nivPos.y = lerp(26.1, 22, je) + sin(j*PI)*4.8*(1-j*0.5)`.
  - Nivaldo cruza z=-78 em ~a2t 16.16 e a câmera em ~16.27.
- Câmera seguindo: `follow = clamp((a2t-14.15)/2.4,0,1)`, look `(0, lerp(nivPos.y, 0, follow*0.6), lerp(nivPos.z-12, -130, follow))`.
- **Flash começa em 16.55** (antes era 16.5).
- Shot 1: trocar os alvos do look para `(0,27,-40)` até `(0,20,-80)` para o rasgo ficar centralizado. As contas de enquadramento conferem com fov 56→74.

### Arquitetura sugerida
- **Arquivo novo `js/introRift.js`** (IIFE, `window.IntroRift`), registrado em `index.html` **antes** de `js/introCutscene.js` (linha 972). Atualizar o vault.
- API: `IntroRift.build({ mkGeo, mkMat })` retorna `{ group, hellScene, riftZ, update(t, dt, camera), render(renderer, camera, mainScene, crossingObj, parentGroup), dispose() }`.
- Em `introCutscene.js`:
  - `buildAct2()`: troque todo o cenário e portal por `rift = IntroRift.build(...)`, `g.add(rift.group)`. Mantenha o Nivaldo, o crossGlow e os faithSparks (de preferência sem caixas).
  - `updateAct2()`: remova as atualizações de clouds, tunnelWallTex, portalRings, portalDebris, fires e embers. Chame `rift.update`. Aplique o novo mergulho e a nova câmera.
  - `render()`: no ato 2, delegue para `rift.render(...)`.
  - `stop()`: `rift.dispose()` e `rift = null`.
  - `setAct(2)`: fog quente casando com a cor do horizonte do céu (ex.: `Fog(0xf0a868, 120, 460)`).
  - Opcional para depurar: `IntroCutscene.seek(seconds)` que só define `t`. As falas passadas disparam de uma vez, o que é aceitável em dev. Assim dá para pular direto para `t = 25 + x` e tirar screenshots.

### Lista de peças a modelar (nada de caixa, cone ou pirâmide crus)
Bases paramétricas (icosaedro, lathe, extrude) **deslocadas por ruído** são aceitáveis. O que importa é o resultado parecer orgânico.

**Mundo dourado (scene principal)**
1. **Céu (ShaderMaterial, BackSide, depthWrite false, renderOrder -1):**
   - Gradiente de fim de tarde: zênite violeta-azulado, meio pêssego, horizonte dourado (igual à fog).
   - Disco e halo do sol.
   - Nuvens fbm projetadas (`d.xz/(d.y+0.12)`), topo dourado e base lavanda-rosa, **girando em espiral em volta da direção do rasgo**.
   - "Hematoma" carmesim perto do rasgo.
   - **Rachaduras**: voronoi (F2−F1) em projeção gnomônica em volta de `uRiftDir`, até ~57°, com flicker e cor branco→laranja→vermelho.
2. **Cordilheiras distantes:** 3 anéis de cumeeiras (strips com ruído ridged) nos raios 250, 320 e 380, com perspectiva atmosférica baked nos vertex colors, crista dourada, MeshBasic sem fog.
3. **Terreno:**
   - Grade custom **mais densa perto do penhasco e do herói** (remapeamento não linear de x e z).
   - Vertex colors: grama com variação de ruído, estradinha de terra, penhasco com **estratos** por altura (ferrugem, ocre, cinza), vale verde-escuro virando carvão perto do rasgo.
   - Atributo `aCorrupt`. Lambert patchado com psx + **rachaduras de lava no fragment** via `vWPos` (ridged ou voronoi) mascaradas por `aCorrupt`, pulsando.
4. **Afloramentos de rocha** encravados no penhasco para quebrar o heightfield: rochas grandes alongadas na horizontal, com estratos.
5. **Grama instanciada** (~9000 tufos de 3 lâminas afinadas e curvas, atributo `aH`):
   - ShaderMaterial com psx snap, vento inclinando para -Z (rasgo) com rajadas, cor raiz→ponta dourada e fog manual.
   - Pular a estradinha e a borda.
6. **Flores instanciadas:** caule + leque de 5 pétalas + miolo (`aPetal`), cor por `instanceColor` (branco, amarelo, papoula, lavanda).
7. **Árvores esculpidas** (5 a 6 templates, InstancedMesh, Lambert patchado com vento via atributo `aSway`):
   - Carvalho: tronco tubo afinado e curvo com raízes, galhos, 5 a 9 cachos de icosaedro deslocado, **normais "blob"** (`normalize(v - centro)` misturado com up), vertex color escuro embaixo e dourado no topo voltado ao sol.
   - Pinheiro: camadas de "saias" serrilhadas caídas, fechadas por baixo.
   - Arbusto.
8. **Pedras:** icosaedro deslocado, flat shading, musgo nas faces de cima.
9. **Cerca rústica** ao longo da estradinha (postes lavrados afinados e tortos, trilhos de tora com leve barriga).
10. **Capela rural** ao fundo em (-46, y, 34), visível no close do shot 2: paredes caiadas irregulares, telhado de duas águas com beiral, torre com cúpula em lathe, cruz, janelas quentes. Pode ser simples, mas modelada.
11. **Rasgo:**
    - Contorno de ~96 pontos.
    - **Membrana** (anéis do centro à borda, atributo `aEdge`) com o shader da janela.
    - **Borda queimada**: ribbon para fora com linhas v = 0, .15, .4, .7, 1. Largura 1.2 a 4.7 com ruído, curl em z por aba (para a câmera ou para o inferno). Shader: linha quente → brasas → carvão, `discard` além da frente de queima (farrapos nítidos estilo PSX, opaco, sem sort). Fagulhas.
    - Alguns **filamentos de realidade esticados** (tubos finos aditivos em catenária) só perto das pontas de cima e de baixo, porque o centro é onde o Nivaldo passa.
12. **Halo** aditivo alongado atrás da membrana (z = -79). A membrana o esconde por dentro e ele brilha em volta. Leque de **raios de luz** saindo da fenda e brilho no chão da base.
13. **Cacos de realidade** (~70, InstancedMesh, triângulos irregulares com espessura):
    - Frente: amostra o céu com direção levemente deslocada (compartilhar o GLSL do céu).
    - Verso: amostra o `hellRT`.
    - Borda brilhante. Orbitam, giram e são sugados (CPU atualiza as matrizes).
14. **Detritos:** pedras e torrões (pedra com topo de grama e raízes) + 2 árvores arrancadas, espiralando da base para dentro. Lajes de chão arrancadas e inclinadas em volta da base.
15. **Partículas** (THREE.Points, animação na GPU por tempo, sem CPU):
    - brasas da borda (para fora e para cima);
    - folhas e poeira sugadas em espiral para o centro;
    - pólen dourado perto do Nivaldo.
    - `gl_PointSize = clamp(k*uRes.y/-mv.z, 1, 6)`, disco suave, aditivo.
16. **Luzes:**
    - Sol direcional dourado.
    - Hemisphere quente.
    - **Direcional vermelho-alaranjado vindo do rasgo para +Z** (~1.1, 0xff3a1a), que acende o rosto do Nivaldo no shot 2 e a face do penhasco.
    - PointLight na base do rasgo (distance ~90) com flicker.

**Inferno (hellScene)**
1. **Céu do inferno:**
   - Zênite preto-vermelho, carmesim, horizonte laranja em brasa.
   - **Vórtice** de nuvens em espiral acima da cidade (`uVortex ≈ normalize(0,0.55,-1)`), escuro, com bordas iluminadas de baixo.
   - **Eclipse** negro com coroa vermelha em `normalize(0,0.14,-1)`, centralizado na janela vista pelo Nivaldo.
   - Relâmpagos via `uFlash`.
2. **Chão** em y≈-70, de z -90 a -560 e x ±400:
   - Basalto em vertex colors baked.
   - **Rio de lava** analítico no fragment (`riverX(z) = sin(z*0.012)*60 + sin(z*0.031)*18`, canal rebaixado no JS com a mesma função) com fluxo fbm animado e luz nas margens.
   - Rachaduras voronoi brilhando fraco. Fog carmesim manual.
3. **Agulhas e penhascos** (rocha esticada torcida) + silhueta de montanhas no horizonte com borda vermelha.
4. **Cidade natal** (z -170 a -360, fora do rio):
   - ~70 casas instanciadas de 3 templates: parede de gable extrudada irregular, telhado de duas águas com espessura e beiral, chaminé, janelas emissivas. Algumas inclinadas ou quebradas.
   - **Igreja** com nave e **campanário gótico em lathe** com anéis, torto, cruz no topo.
   - Shader unlit com luz de fogo vinda de baixo.
5. **Fogo:** billboards cilíndricos instanciados com shader de chama fbm, aditivo (~40 nos telhados + fogueiras grandes).
6. **Fumaça:** billboards altos escuros, iluminados de laranja por baixo, inclinados e subindo para o vórtice.
7. **Brasas** subindo (Points).
8. Luzes para o Lambert do Nivaldo quando ele atravessa.

### GLSL a compartilhar (strings JS)
- Snap PSX:
  ```glsl
  uniform vec2 uRes;
  vec4 psxSnap(vec4 p){
    if(p.w>0.0){ vec4 s=p; s.xyz/=s.w; s.xy=floor(s.xy*uRes*0.5+0.5)/(uRes*0.5); s.xyz*=p.w; return s; }
    return p;
  }
  ```
  com `uRes = PSX_RES` (fallback `{value:new THREE.Vector2(480,270)}` se `typeof PSX_RES === 'undefined'`).
- Ruído de valor 2D e 3D, fbm, voronoi F1/F2. Função de céu dourado reutilizável (céu + cacos).
- Patch de Lambert (`patchLambert(mat, {wind, cracks})`) que já inclui o snap, com `customProgramCacheKey` único por combinação de opções.
- Posição de mundo no vertex: considerar `instanceMatrix` em `#ifdef USE_INSTANCING`.

### Orçamento de performance (estimado e aceitável)
- Passe principal: terreno ~20k tris, grama ~135k, árvores ~35k e o resto pequeno.
- Passe do inferno: ~40k.
- Tudo em 360p. Zero alocação por frame: vetores scratch e partículas animadas na GPU.

---

## 5. Checklist para quem continuar
1. Criar `js/introRift.js` conforme a seção 4 e registrar em `index.html` antes de `js/introCutscene.js`.
2. Fazer a integração em `js/introCutscene.js` (buildAct2, updateAct2, render, stop, setAct, mergulho e câmera novos, `seek` opcional).
3. `node --check js/introRift.js js/introCutscene.js`.
4. Testar com o preview `hellslayer-static`: começar um jogo novo sem `?autostart` (ou usar `seek`), passar pelos 4 shots do Ato 2, conferir o console sem erros, tirar screenshots (zoom out, close do Nivaldo com luz vermelha, mergulho, travessia para o inferno) e checar a transição para o Ato 3.
5. Atualizar `vault-hellslayer/00-AI-Context/Mapa-de-Modulos-e-Globais.md` (ordem dos scripts e o global `window.IntroRift`).
6. Oferecer ao usuário refazer o portal do céu do Ato 3 (`buildAct3Overlay`, os toros) reaproveitando o rasgo.
7. **Não** commitar sem o usuário pedir.
