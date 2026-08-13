# Recce Studio Design System

## Direcao

Recce Studio deve parecer software interno de uma equipa oficial de WRC em 2026: uma ferramenta de competicao para pilotos, copilotos e equipas de apoio durante reconhecimentos. A interface deve lembrar telemetria, roadbooks, instrumentacao automovel e engenharia, sem parecer uma startup, um dashboard SaaS generico ou uma app gaming.

Pergunta guia: se a FIA encomendasse um software de reconhecimentos para equipas oficiais do WRC em 2026, como seria a interface?

Anti-referencia explicita: dashboards SaaS. A interface nao deve vender produto, encantar por efeitos ou parecer uma landing page embutida. Deve parecer uma ferramenta operacional usada por uma equipa em parque de assistencia, dentro do carro ou numa sala tecnica.

## Principios

- Informacao antes de expressao visual.
- Precisao, confianca e rapidez de leitura acima de decoracao.
- UX, navegacao e estrutura de paginas mantidas.
- Identidade criada por tipografia, grelha, ritmo, labels tecnicas e consistencia.
- Cores usadas semanticamente: accent para acao principal, verde para sucesso, amarelo para aviso, vermelho para perigo.
- Nada de neon, glassmorphism, gradients chamativos, sombras fortes, cantos demasiado arredondados ou botoes desproporcionais.
- Rally subtil: numeracao de PECs, linhas finas de roadbook, separadores tecnicos, badges compactos e grelha funcional.
- Ritmo operacional: tudo deve parecer preparado para leitura rapida sob pressao.
- Linguagem de competicao: controlos compactos, estados inequivocos, dados tabulares e superficies robustas.
- Zero ornamento obvio: nao usar carros, pneus, bandeiras, neon ou decoracao sem funcao.

## Paleta

### Base Escura

- Background: `#080b10`
- Background secondary: `#0c1118`
- Surface: `#101722`
- Elevated surface: `#151e2b`
- Surface hover: `#1a2533`
- Border: `#263241`
- Border strong: `#354456`
- Text primary: `#f4f7fb`
- Text secondary: `#a8b3c2`
- Text muted: `#6f7d8d`

### Base Clara

- Background: `#f5f6f8`
- Background secondary: `#ebeef2`
- Surface: `#ffffff`
- Elevated surface: `#f8fafc`
- Surface hover: `#eef2f6`
- Border: `#d7dde5`
- Border strong: `#b8c2cf`
- Text primary: `#141922`
- Text secondary: `#4b5565`
- Text muted: `#7a8492`

### Semantica

- Accent: `#3b82f6` por defeito; variantes permitidas: `#d21f32` e `#1f8f5f`
- Success: `#1f8f5f`
- Warning: `#c8841a`
- Danger: `#c92a3a`

## Tipografia

Fonte: Inter/System UI.

- Page title: 24/32, 800
- Section title: 16/24, 750
- Card title: 14/20, 700
- Body: 14/20, 500
- Metadata: 12/16, 600
- Label tecnica: 11/16, 700, uppercase

Hierarquia deve vir sobretudo de tamanho, peso, spacing e alinhamento.

Numeros, tempos, distancias, contagens e codigos usam leitura tabular/monospace sempre que possivel, aproximando a UI de telemetria e instrumentacao.

## Espacamento

Base 4px.

- 4: micro spacing
- 8: padding interno de controlos
- 12: grupos compactos
- 16: cards compactos
- 24: secoes
- 32: blocos principais

## Radius

- SM: 4px
- MD: 6px
- LG: 8px
- XL: 10px apenas em superficies grandes

Evitar pills grandes. Badges podem ser compactos.

## Sombras

- Cards: `0 1px 2px rgba(0, 0, 0, 0.2)`
- Panels/overlays: `0 12px 28px rgba(0, 0, 0, 0.22)`

Sombras nao devem ser elemento de identidade.

## Estados

- Hover: mudanca subtil de surface e border.
- Selected: indicador lateral/inset com accent.
- Focus: outline fino via accent soft.
- Disabled: opacidade reduzida, sem cor forte.
- Danger: apenas eliminar/erro.
- Success: apenas concluir/confirmar.
- Warning: apenas estados pendentes/risco.

## Layout

Manter sidebar, header, listas, cards e formularios existentes. A grelha deve ser funcional e tecnica, com linhas discretas inspiradas em roadbook/telemetria. Nada de reorganizar fluxos.

As paginas devem parecer folhas tecnicas vivas: blocos bem delimitados, labels curtas, dados alinhados e separadores que ajudam a navegar informacao. A densidade deve ser profissional, nao apertada.

No tema principal, a navegacao deve funcionar como painel/cockpit escuro e a area de trabalho como documento tecnico claro. Isto cria hierarquia imediata sem depender de efeitos ou cores berrantes.

## Componentes

### Cards

Fundos simples, borda subtil, pouca sombra, radius curto. Usar divisorias apenas quando ajudam leitura.

Cards de metricas devem comportar-se como instrumentos: label pequena, valor dominante, numerais tabulares e pouca cor.

Evitar containers dentro de containers. Quando uma subsecao vive dentro de um painel, ela deve parecer linha tecnica/inset, nao outro cartao completo.

### Botoes

Primario usa accent. Conclusao usa success. Eliminacao usa danger. Secundario usa surface. Altura normal entre 36px e 44px.

### Inputs e Selects

Mesmo fundo da surface elevada, borda clara, foco visivel. Selects devem respeitar tema escuro/claro.

### Badges

Compactos, uppercase quando forem estados, sem excesso de cor. PECs podem ter numeracao tecnica.

### Modais

Superficie elevada, borda clara, sombra baixa. Sem blur decorativo.

### Sidebar

Instrumental e silenciosa. Ativo com indicador tecnico, nao com bloco chamativo.

A sidebar deve parecer um painel de navegacao de software interno, com codigos curtos e estado ativo claro.

### Header

Headers devem parecer capas de documentos tecnicos/roadbook: fortes na tipografia, discretos na cor.

### Icones

Usar um unico estilo minimalista. Evitar emojis e simbolos obvios como carros, pneus ou bandeiras.
