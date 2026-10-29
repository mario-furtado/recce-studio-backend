# FEAT-008 — Notas com ajuda progressiva

- **Estado:** IN_REVIEW — implementação e validações concluídas; aguarda aprovação.
- **Perfil:** STANDARD — interface e percursos de configuração/tutorial.
- **Descrição:** Reduzir a carga visual permanente sem retirar informação ou esconder erros.
- **Data:** 2026-10-25.

## Objetivo e âmbito
A captura do utilizador e os templates confirmavam cabeçalho alto, parágrafos repetidos, títulos/ações duplicados e vários editores antes das tarefas habituais. Otimizada a página para visitas frequentes, com informação a pedido. Não foram alteradas regras, modelo persistido, permissões, serviços ou APIs.

## Requisitos e critérios de aceitação
1. A página abre com cabeçalho compacto e ações, sem parágrafos introdutórios permanentes; Ajuda revela orientação e entrada no tutorial.
2. Dicionário, Apresentação e Caderno mantêm ações e etiquetas de âmbito. Sistema base da equipa fica recolhido por defeito, abrindo explicitamente para editar.
3. Apresentação começa pelo seletor e mostra apenas o símbolo selecionado; ajuda explica detalhes a pedido, sem apagar estilos ou rascunhos ao alternar.
4. Recarregar/repor ficam em Mais opções; falhas de carga/guardar e avisos de overflow continuam visíveis e acionáveis, fora da ajuda recolhida.
5. Ajuda e opções funcionam por teclado e em móvel; tutorial, persistência e PDF mantêm-se funcionais. Inspeção visual desktop/móvel e regressões direcionadas.

## Estratégia e decisões
- Essencial sempre visível: título, áreas, âmbito, seletor, campos, guardar e feedback de erro.
- Contexto a pedido: Ajuda geral e ajuda da área, com details/summary nativos fechados por defeito.
- Ações menos frequentes: Mais opções contém recarregar, repor e apresentações históricas; nenhuma foi eliminada.
- Cabeçalho local compacto; etiquetas Pessoal/Partilhado com a equipa substituem explicações repetidas. Não houve alteração do âmbito.
- O editor projeta apenas o símbolo selecionado; todos os estilos continuam no modelo. Sem persistir preferências de ajuda, novos dados ou dependências.
- Demonstração mantém sistema base aberto para o destaque. Ajuda geral conserva o aviso para guardar rascunhos antes de navegar ao tutorial.

## Casos limite e erros
Ajuda não depende de hover e abre por teclado. Mensagens de carga, erro e sucesso ficam fora dos detalhes. Repetição de carregamento após falha permanece visível. Mudar símbolo/área ou abrir ajuda não grava nem perde estilos. No móvel, ações e áreas quebram linha; a página não transborda horizontalmente. Pré-visualização continua a usar o renderer real, sem alterar a paginação ou imprimir automaticamente.

## Componentes, dependências e riscos
Templates/CSS locais de Notes e NotebookSettings, filtragem visual por seleção e percursos E2E afetados. Riscos revistos: controlos ocultos sem acesso, tutorial com alvo fechado, rascunhos perdidos, foco, carga/erros e renderização do caderno. Backend e schema intactos; dados e alterações anteriores preservados.

## Ficheiros alterados
- frontend/src/app/modules/features/notes/notes.component.html, .ts e novo .css: cabeçalho, ajuda, sistema base recolhido, etiquetas e texto contextual.
- frontend/src/app/modules/core/notebook/notebook-settings.component.html, .ts e novo .css: seletor/editor único, ajuda por área, opções secundárias e feedback.
- frontend/src/app/modules/core/notebook/notebook-dictionary.component.spec.ts: seleção explícita, ajuda fechada e conservação de estilos/rascunhos.
- frontend/e2e/notes-layout.spec.ts (novo): layout, teclado, ajuda, sem gravações automáticas e capturas desktop/móvel.
- frontend/e2e/note-settings.spec.ts, notebook.spec.ts, notebook-dictionary.spec.ts e notes-tour.spec.ts: abrir as secções a pedido, mantendo as asserções de persistência, histórico, tutorial e PDF.
- docs/e2e.md e este documento: âmbito e resultados reais.

## Verificação dos critérios
| Critério | Teste/check executado | Resultado |
| --- | --- | --- |
| AC1 | TestBed: Ajuda fechada/conteúdo invisível; E2E: cabeçalho desktop <120px, Ajuda por Enter e tutorial disponível | PASS |
| AC2 | E2E centralização: abrir sistema base e guardar só noteSystem; etiquetas e três áreas mantidas | PASS |
| AC3 | TestBed/E2E: nenhum editor sem seleção, um editor por símbolo e tamanho115 preservado ao alternar | PASS |
| AC4 | Código revisto: alertas fora da ajuda, carga falhada mantém botão de repetição; unit HTTP/503 e E2E de erro/paginação mantidos; Mais opções operável | PASS |
| AC5 | E2E real: teclado, móvel390×844 sem overflow horizontal, tutorial completo, histórico/persistência e PDF real | PASS |

## Validações executadas
Windows, Node22, Chrome Headless, Maven e backend HTTP/JPA/H2 isolado em18765, frontend compilado em18766. Instância beta e base de dados não reiniciadas/alteradas.

```powershell
$env:FACTORY_RISK='medium'
$env:FACTORY_MAVEN_TESTS='NotebookPreferencesIntegrationTest,NoteWorkflowIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest'
$env:QUALITY_TARGET_SPECS='src/app/modules/core/notebook/notebook-dictionary.component.spec.ts,src/app/modules/core/notebook/notebook.component.spec.ts,src/app/modules/features/notes/notes.component.spec.ts,src/app/modules/features/tutorial/notes-tour.component.spec.ts,src/app/accessibility.component.spec.ts'
node tools/run-quality-gate.mjs ticket AUTO
npm --prefix frontend run audit:accessibility
```

PATH incluiu Node22 local, Git e Maven; CHROME_BIN usou o Chrome instalado. Evidência detalhada em .factory-results/.

| Check | Resultado real | Evidência |
| --- | --- | --- |
| Ticket AUTO → STANDARD | PASS; configuração, backend, lint, typecheck, direcionados, integração, E2E e build | FEAT-008-ticket.log; FEAT-008-ticket.json |
| Backend selecionado | 23/23, zero falhas/erros/skips | 2026-10-25T13-31-56.802Z-ticket-standard/backend-test.log |
| Direcionados / integração | 36/36 e133/133 | Mesmo diretório: frontend-test-targeted.log e frontend-test-integration.log |
| E2E / wrapper | 13/13 e3/3, sem skips | Mesmo diretório: frontend-test-e2e.log |
| Build produção | PASS; inicial475.82kB, abaixo do aviso500kB | Mesmo diretório: frontend-build.log |
| Auditoria estática de acessibilidade | PASS | FEAT-008-accessibility.log |
| Revisão e inspeção visual | APPROVE; sem bloqueios | FEAT-008-qa-review.md; FEAT-008-desktop.png; FEAT-008-mobile.png |

## QA, problemas encontrados e revisão
factory-qa e factory-review no mesmo fluxo, sem agentes. Primeira execução direcionada20/21: uma asserção usava a geometria dos parágrafos dentro de details fechado como sinal de visibilidade. O Chromium mantém geometria de conteúdo que não pinta; trocada pela API checkVisibility, mantendo a exigência de conteúdo invisível. O E2E também verifica a altura efetiva do cabeçalho. Gate STANDARD integralmente aprovado depois; nenhuma asserção funcional desativada ou enfraquecida.

Verificados estados, seleção, estilos preservados, ausência de gravações, ajuda nativa/teclado, tutorial, foco, alertas, âmbito e CSS local. Capturas desktop/móvel inspecionadas. Não foram observadas novas regressões nos testes executados.

## Limitações
Sem leitores de ecrã reais, outros navegadores, impressora física ou validação de service worker. Aviso preexistente NG8113 de RouterLink não utilizado em PecsListComponent mantido. Sem gate global de release/DEEP, push, merge ou deploy.

## Gates independentes
- **TICKET_GATE:** PASS / APPROVED —5/5 critérios verificados, STANDARD e revisão aprovados.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED — validação global não executada.

## Histórico
- 2026-10-25: PLANNED — documento criado exclusivamente antes de implementar, com base na captura e no código.
- 2026-10-25: IN_PROGRESS — ajuda progressiva, editor selecionado e testes; asserção de visibilidade corrigida para o comportamento nativo.
- 2026-10-25: IN_REVIEW — STANDARD PASS, revisão e capturas aprovadas; aguarda aprovação do utilizador.
