# FEAT-014 — Redesign do Studio

- **Description:** Hierarquia dark/vermelho, ações agrupadas, área de revisão e painel dedicado de notas com edição contextual e proteção de rascunhos.
- **Status:** IN_REVIEW
- **Profile and reason:** STANDARD — layout e percursos de edição/navegação; sem alterações de contratos backend.

## Objective and scope
Implementar a proposta aprovada: rever → selecionar → editar → confirmar. O ecrã atual empilha cartões e ferramentas ocasionais; editar expande uma linha estreita da lista. Reutilizar os leitores, mapa, apresentação e PDF existentes. Não mudar regras de negócio nem persistência.

## Requirements
1. Cabeçalho compacto de PEC e ações secundárias agrupadas; toolbar Ficheiros / Sincronização / Caderno-PDF.
2. Desktop com revisão à esquerda e notas à direita, largura ajustável; velocidades junto do leitor.
3. Telemóvel com Vídeo / Mapa / Notas, preservando leitores, instante e seleção.
4. Lista compacta e acessível; editor dedicado com Conteúdo, Tempo e Apresentação progressiva, preview, Guardar/Cancelar.
5. Ações destrutivas no menu da nota, confirmação existente mantida; aviso ao abandonar rascunho.
6. Superfícies simples, contraste e foco visíveis, spacing 4/8/12/16/24, texto 14–16px, metadados 12–13px e alvos 44px.

## Acceptance criteria
1. Dado desktop, Studio mostra revisão e notas lado a lado, com largura ajustável sem overflow e sem perder contexto.
2. Dado viewport 360px, alternar Vídeo/Mapa/Notas preserva instante, seleção e instância do leitor; sem controlos cortados nem ações tapadas pela navegação móvel.
3. Ao abrir Ficheiros ou Sincronização, todas as ações anteriores continuam disponíveis, identificadas em português e com bloqueio em PEC concluída.
4. Ao selecionar/editar uma nota, a lista mantém a sua estrutura e o editor dedicado mostra conteúdo, tempo e preview; Guardar/Cancelar regressam à lista e preservam o contrato FEAT-013.
5. Dadas alterações não guardadas, mudar de nota/modo/rota pede confirmação; rejeitar mantém o rascunho, aceitar permite sair; gravação pendente bloqueia saída. Recarregar usa o aviso nativo.
6. Eliminar fica num menu próprio, mantém confirmação e nunca é a ação principal; navegação por teclado, foco visível, contraste e alvos táteis são verificados.
7. Persistência, permissões, mapa/tempo, importação e exportação/PDF passam regressões relevantes; erros conservam rascunhos e não há novas falhas no âmbito.

## Edge cases and expected errors
PEC inválida/concluída; sem media/GPS/notas; modelo indisponível; texto/tempo/estilos inválidos; erro HTTP; teclado móvel; zoom; saída de rascunho e save pendente. Preservar a proteção de gravação do reconhecimento ao alterar o guard partilhado.

## Components, dependencies and risks
PecsEditor (estado de vista e rascunho), PecDetail (cabeçalho/modos/saída), recceExitGuard (aceitar Promise além de boolean); CSS local, mesmos serviços, leitores e PDF. Nenhuma dependência nova, alteração backend ou migração. Risco: perder rascunho ao destruir o editor; recarregar media ao mudar de vista; quebrar seletores/percursos existentes.

## Technical decisions
CSS local e classes próprias evitam mexer no tema global. Esconder vistas via CSS mantém media/mapa vivos. Editor ocupa o painel de notas em vez de uma linha; rascunho continua nos campos existentes. ConfirmDialogService existente para abandono; ampliar o guard preservando o contrato boolean do reconhecimento. Breakpoint desktop 1100px. Range acessível ajusta proporção do painel sem preferências novas.

## Changed files
- `frontend/src/app/modules/features/pecs/pecs-editor/pecs-editor.component.{ts,html,css}` — estrutura, editor dedicado, vistas, largura e proteção de rascunhos.
- `frontend/src/app/modules/features/pecs/pec-detail/pec-detail.component.{ts,html,css}` — cabeçalho, ações da PEC e integração da saída por modo/estado.
- `frontend/src/app/modules/core/guards/recce-exit.guard.ts` — suporta confirmação assíncrona, preservando o boolean do reconhecimento.
- `frontend/src/app/modules/features/pecs/pecs-editor/recce-map.component.ts` e `frontend/src/app/modules/core/notebook/note-presentation-editor.component.ts` — estilos/targets acessíveis coerentes.
- `frontend/src/app/modules/features/tutorial/workflow-tour.steps.ts` e `workflow-demo.component.html` — instruções e exemplos alinhados com os novos nomes/acessos.
- `frontend/src/app/modules/features/pecs/pecs-editor/studio-redesign.component.spec.ts`, `frontend/src/app/accessibility.component.spec.ts` — testes de rascunhos, guard e nomes.
- `frontend/e2e/studio-redesign.spec.ts` — novo percurso desktop/móvel/teclado/media; `critical-journeys.spec.ts`, `notebook.spec.ts`, `recce-map.spec.ts`, `studio-note-editing.spec.ts` — seletores e acessos atualizados sem remover asserções.
- Este documento; logs/capturas em `.factory-results/`. Sem alteração backend, contratos, budgets ou dependências.

## Acceptance verification
| Criterion | Test/check | Executed result | Evidence |
| --- | --- | --- | --- |
| AC1 | Desktop 1440px: revisão/notas lado a lado; range altera largura; captura inspecionada | PASS | E2E FEAT-014; FEAT-014-studio-desktop.png |
| AC2 | 360/390px, mesmas instâncias media, instante/seleção; viewport 390x500 mantém ações acima da navegação | PASS | E2E FEAT-014; FEAT-014-studio-mobile.png; FEAT-014-studio-mobile-keyboard.png |
| AC3 | Ficheiros acessíveis, download Excel real, sincronização e regressão mapa/offset; bloqueios existentes mantidos | PASS | E2E FEAT-014/FEAT-003; testes de rotas e estado |
| AC4 | Editor dedicado, lista oculta intacta, preview, guardar/cancelar/reset, erro/repetição, reload e PDF | PASS | E2E FEAT-013/FEAT-014; note-editing.component.spec.ts |
| AC5 | Rejeitar/aceitar saída por nota, modo e rota; Voltar às notas protegido; beforeunload; pending save | PASS | studio-redesign.component.spec.ts (4/4); E2E FEAT-014 |
| AC6 | Eliminar via menu+confirmação; foco inicial/retorno, Shift+Tab, outline 3px e contraste >=4,5:1; botões primários vermelhos | PASS | E2E FEAT-014; auditoria estática e testes de acessibilidade |
| AC7 | Gate STANDARD completo e regressão FEAT-013; backend mantém isolamento/persistência; tutorial atualizado | PASS | FEAT-014-ticket.json; E2E 23/23; revisão APPROVE |

## Validation and review
STANDARD executado: backend 31/31, direcionados 46/46, integração 159/159, E2E 23/23 + runner 3/3 PASS; factory/lint/typecheck/build PASS. Revisão final de cor: 2/2 E2E PASS após build de produção; guard focado 4/4 PASS. Auditoria estática final PASS. Revisão técnica/visual APPROVE, sem achados bloqueantes pendentes.

## Problems and limitations
Simulação de teclado por redução de viewport não substitui teste físico em iOS/Android; testes em Chrome/Windows, sem matriz de browsers nem leitor de ecrã manual. Não foi executada release global. Instância beta e respetivos dados mantidos, sem reinício. Único aviso final de compilação: NG8113 preexistente em PecsListComponent; não relacionado nem bloqueante para este gate. Sem novas falhas conhecidas no âmbito validado. Aprovação visual do utilizador pendente.

## Independent gates
- **TICKET_GATE:** PASS / APPROVED — critérios 1–15 verificados; continuação dos controlos aprovada no gate STANDARD e revisão.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED — sem aprovação global de release.

## Implementation history
- 2026-10-29: PLANNED — critérios e plano definidos antes de implementar.
- Fases: 1 estrutura/cabeçalho; 2 lista/editor e proteção de rascunho; 3 responsividade/teclado; 4 QA/revisão/gate.

## Evidência intermédia
- Unitários/regressões direcionados: 39/39 PASS; acessibilidade/rascunhos: 11/11 PASS; auditoria estática PASS.
- Primeiro comando E2E não executou testes devido a interpretação de `|` pelo shim npm Windows; corrigido para regex `FEAT-01[34]`.
- Primeiro build bloqueou CSS 8,11 kB acima de 4 kB; orçamento mantido. Simplificação reduziu a 3,14 kB e os dois E2E passaram. Segunda revisão reutiliza utilities existentes e reduz CSS fonte a menos de 2 kB; validação final em curso.
- Desktop/móvel e viewport reduzido inspecionados: leitores preservados, editor próprio, Guardar/Cancelar acima da navegação móvel. Ajuste final alinha ações da lista na horizontal para maior densidade.

- 2026-10-29: IN_REVIEW — estrutura, editor, responsividade e proteção de rascunhos concluídos. E2E final 2/2 PASS; contraste ≥4,5:1 e foco verificados; CSS abaixo de 2 kB, sem aviso de tamanho. Gate STANDARD em execução.

- Primeiro gate STANDARD: backend 31/31, direcionados 46/46, integração 159/159 PASS; E2E 22 PASS + 1 FAIL. Única falha: teste FEAT-004 tentava clicar Configurar notas sem abrir Opções (novo acesso aprovado). PDF e persistência desse cenário já tinham sido verificados. Teste corrigido para abrir o menu, mantendo as asserções. Evidência: FEAT-014-ticket-first.log/json e 2026-10-29T10-44-34.741Z-ticket-standard/.
- Revisão atualizou o tutorial do Studio para os nomes Ficheiros/Sincronização/editor dedicado; exemplos continuam temporários. Segunda execução STANDARD com fontes/testes estabilizados inclui estes ajustes.

## Resultados finais e comandos
| Comando/check | Resultado executado | Evidência |
| --- | --- | --- |
| `npm --prefix frontend run test:targeted` com cinco specs Studio/recce/rotas | 39/39 PASS | `.factory-results/FEAT-014-focused.log` |
| Mesmo comando, accessibility.component.spec.ts + studio-redesign.component.spec.ts | 11/11 PASS | `FEAT-014-accessibility-tests.log` |
| Mesmo comando, studio-redesign.component.spec.ts após proteção de Voltar às notas | 4/4 PASS | `FEAT-014-review-focused.log` |
| `npm --prefix frontend run e2e:ci -- --grep 'FEAT-01[34]'` | Final pré-gate 2/2 PASS; pós-revisão de cor 2/2 PASS | `FEAT-014-final-focused-e2e.log`, `FEAT-014-color-review-e2e.log` |
| `node tools/run-quality-gate.mjs ticket AUTO` | STANDARD PASS (segunda execução); primeira falha de acesso ao menu registada acima | `FEAT-014-ticket.log`, `FEAT-014-ticket.json`, `2026-10-29T10-50-29.172Z-ticket-standard/` |
| `npm --prefix frontend run audit:accessibility` | PASS final | `FEAT-014-review-accessibility.log` |
| `mvn.cmd resources:resources compiler:compile` | PASS; recursos repostos após clean do gate; hash application.properties fonte/classes igual | `FEAT-014-main-resources.log` |
| `git diff --check -- <ficheiros do âmbito>` + revisão do diff/código/templates/estados | PASS / APPROVE | `FEAT-014-qa-review.md` |

Os nomes de evidência acima são relativos a `.factory-results/`. Ambiente Windows/Node22/Chrome Headless e backend H2 isolado, portas 18765/18766. Gate: `FACTORY_RISK=medium`; `FACTORY_MAVEN_TESTS=NoteWorkflowIntegrationTest,NotebookPreferencesIntegrationTest,GpsMapIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest`; `QUALITY_TARGET_SPECS` = studio-redesign, note-editing, media-map-sync, recce-mode, recce-routing component.spec.ts e accessibility.component.spec.ts. Não foi usado FEAT ID em FACTORY_TICKET_ID.

Build inicial final 476,74 kB (<500 kB); CSS Studio <2 kB sem aviso. A revisão visual final detetou neutralização do vermelho pela regra global de bg-slate-800: removida essa classe apenas de ações primárias/estados selecionados, preservando a regra global. E2E adicional confirma RGB(189,18,52) em Inserir/Guardar e contraste >=4,5:1; build de produção repetido pelo harness passou. Resultados restantes inalterados reutilizados segundo AGENTS.md.

- 2026-10-29: IN_REVIEW — 7/7 critérios, QA e revisão aprovados; proteção de Voltar às notas e cor final verificadas. Sem push, merge ou deploy. Aguarda aprovação visual do utilizador.

## Ajuste de continuidade — painéis contextuais (2026-10-29)
Pedido: abertura próxima do botão, foco visual inequívoco e fecho previsível. Problema confirmado em código: studio-menu usa position:absolute/top:100%/left:0 em relação à toolbar inteira; details só fecha no respetivo summary. Caderno/PDF também fica expandido inline.

### Critérios adicionais
8. Cada menu (Ficheiros/Sincronização/Opções/Ações da PEC/ações da nota) abre junto do acionador, reposicionando-se para caber no viewport em desktop/móvel.
9. Só um menu permanece aberto; clique fora, Escape e ação concluída fecham-no. Interagir com campos não o fecha nem descarta valores.
10. Abrir destaca painel/acionador e escurece discretamente o contexto; foco entra no painel, Escape devolve-o ao botão, saída por Tab fecha sem roubar foco. Respeitar reduced-motion.
11. Caderno/PDF abre em diálogo de primeiro plano, com fecho explícito/clique fora/Escape e retorno de foco; exportação e persistência continuam inalteradas.

Solução: componentes standalone reutilizáveis sobre Popover API/dialog nativos, mantendo summaries e contratos existentes. Perfil STANDARD; sem novas dependências, alterações backend ou dados beta. Testes planeados: geometria, dismiss, foco, exclusividade, edição de campos, preview/PDF e regressões dos percursos atuais.

- 2026-10-29: IN_PROGRESS — continuação da FEAT-014; critérios 8–11 UNVERIFIED até execução. Gates deste ajuste pendentes; evidência anterior preservada.

### QA intermédia do ajuste de painéis
- Typecheck PASS; unitários direcionados 27/27 PASS; E2E 5/5 PASS (menus + regressões de edição/caderno/PDF/layout); auditoria estática PASS.
- Primeiro teste unitário falhou por expressão ++ não suportada no template da fixture; corrigida sem alterar asserções. Primeiro E2E revelou saída do foco por Tab no diálogo; acrescentado ciclo explícito e região do caderno acessível por teclado. Repetição revelou stopPropagation na eliminação que impedia o menu de fechar: ações agora fecham em captura antes do handler, preservando confirmação e dados. Repetição final 5/5 PASS.
- Revisão visual: popup junto ao botão, fundo atenuado, acionador destacado e espaço limitado ao viewport. Cabeçalho da pré-visualização mantém Fechar visível ao deslocar. Código estabilizado para gate STANDARD.
- Novos ficheiros: core/shared/components/context-panel.component.ts, focus-panel.component.ts, context-panel.component.spec.ts e e2e/studio-panels.spec.ts. Integração em PecsEditor/PecDetail e tabstop no Notebook; adaptação dos testes para fecho de ações e novo diálogo. Sem alterações de dados/negócio.

### Fecho do ajuste — evidência executada
| Critério | Verificação | Resultado |
| --- | --- | --- |
| AC8 | Geometria relativa ao acionador, limites desktop/móvel, inversão acima e redimensionamento | PASS — unitários e E2E |
| AC9 | Clique fora, Escape, ação capturada antes de stopPropagation, exclusividade e preservação de valores sem escrita | PASS — unitários e E2E |
| AC10 | Foco inicial/retorno, Tab sai dos menus, backdrop, reduced-motion, descarte/confirmação preservados | PASS — unitários/E2E e capturas inspecionadas |
| AC11 | Caderno modal em desktop/móvel, ciclo Tab/Shift+Tab, Escape/clique fora, Fechar totalmente visível após scroll e PDF real | PASS — E2E de painéis + FEAT-004/FEAT-013 |

- `npm --prefix frontend run test:targeted` com context-panel, notebook, studio-redesign e accessibility specs: **27/27 PASS**, `.factory-results/FEAT-014-panels-focused.log`.
- `npm --prefix frontend run e2e:ci -- e2e/studio-panels.spec.ts e2e/studio-note-editing.spec.ts e2e/notebook.spec.ts e2e/studio-redesign.spec.ts`: **5/5 PASS**, `.factory-results/FEAT-014-panels-e2e.log`.
- `node tools/run-quality-gate.mjs ticket AUTO`: **STANDARD PASS**, backend **31/31**, direcionados **44/44**, integração **164/164**, E2E **24/24** + runner **3/3**, factory/lint/typecheck/build aprovados. `.factory-results/FEAT-014-panels-ticket.log`, `FEAT-014-panels-ticket.json`, `2026-10-29T12-13-00.880Z-ticket-standard/`.
- Gate com `FACTORY_RISK=medium`; Maven seleciona NoteWorkflowIntegrationTest,NotebookPreferencesIntegrationTest,GpsMapIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest. Angular seleciona context-panel, notebook, studio-redesign, note-editing, recce-mode e accessibility specs.
- `npm --prefix frontend run audit:accessibility`: **PASS** final, `.factory-results/FEAT-014-panels-accessibility.log`.
- `mvn.cmd resources:resources compiler:compile`: **PASS**, `.factory-results/FEAT-014-panels-main-resources.log`; recursos repostos após clean e hashes application.properties fonte/classes iguais. Instância beta não reiniciada.
- Bundle inicial **478,25 kB**, abaixo de 500 kB; sem novos avisos de CSS. Aviso NG8113 preexistente mantido, sem investigação repetida.
- Capturas inspecionadas: `.factory-results/FEAT-014-context-desktop.png`, `FEAT-014-context-mobile.png`. Auditoria/revisão: `.factory-results/FEAT-014-panels-qa-review.md`, **APPROVE**, sem achados bloqueantes pendentes.
- **TICKET_GATE: PASS / APPROVED**; **RELEASE_GATE: NOT_RUN / UNVERIFIED**. Validação Chrome/Windows e viewports móveis; Safari/Firefox/WebViews e teclado físico móvel não executados. Componentes requerem suporte moderno a Popover API/dialog nativos. Sem alteração de dados/negócio, push, merge ou deploy.
- 2026-10-29: **IN_REVIEW** — continuação pronta para validação visual; critérios 8–11 e regressões aprovados. Histórico anterior preservado.

## Continuidade — clareza dos controlos e ficheiros (2026-10-29)
Problema observado na captura: controlos nativos repetem texto do navegador; adicionar/substituir, eliminar e descarregar partilham quase o mesmo estilo; Caderno/PDF não explicita exportar e o menu de notas usa apenas reticências.

12. Painel Ficheiros organiza Vídeo/Áudio/GPS/Notas com estado, nome do ficheiro quando disponível e ação Adicionar/Substituir/Importar inequívoca; picker acessível por label/teclado, sem texto nativo redundante.
13. Ações de eliminação usam ícone+texto e estilo destrutivo contrastado, com confirmação mantida; menu de notas apresenta Ações e Eliminar nota, sem depender apenas da cor ou de reticências.
14. Barra apresenta Exportar PDF com ícone/destaque; Excel identifica exportação de notas existentes ou modelo vazio, reutilizando o endpoint atual. Preview, download e PDF mantêm comportamento.
15. Inputs, labels, estados e botões têm contraste/foco/targets consistentes; desktop/móvel sem cortes, bloqueios de PEC/rascunho preservados e nenhuma alteração a contratos/dados.

Solução prevista: componente de ficheiros local ao Studio reutiliza handlers atuais; styles isolados e utilities existentes, sem dependências nem mudanças globais de tema. Perfil STANDARD. QA: estados vazio/carregado/bloqueado, contraste, labels, confirmação/cancelamento, downloads reais, PDF e regressões de painéis/editor.
- 2026-10-29: IN_PROGRESS — requisitos 12–15 definidos antes da implementação.
- QA intermédia 12–15: unitários 16/16 PASS (ficheiros/painéis/acessibilidade). Uma asserção da fixture exigiu correção de tipagem null, sem alterar a condição verificada. Primeira regressão E2E passou PDF e edição, mas três testes não localizaram o rótulo exato por whitespace decorativo entre texto e novo ícone; markup normalizado preservando os rótulos e asserções. Registo: FEAT-014-controls-e2e-labels.log. Repetição em curso.

### Validação da clareza dos controlos
- 2026-10-29: IN_REVIEW — implementação estabilizada; E2E focado 6/6 PASS, incluindo eliminação real de áudio, cancelamento, downloads Excel/PDF, bloqueio de PEC concluída e conservação das notas. As três falhas anteriores por whitespace foram corrigidas no markup, mantendo as asserções.
- Capturas desktop e viewport móvel 360×800 inspecionadas: hierarquia e ações distinguíveis, picker com foco, nomes/estados visíveis; painel comprido desloca verticalmente no móvel. Exportar PDF permanece na toolbar; Excel está no grupo Ficheiros.
- Auditoria estática de acessibilidade PASS. Gate STANDARD final em execução. Evidência anterior permanece histórica, não substitui este gate.

| Critério adicional | Evidência dirigida executada | Resultado |
| --- | --- | --- |
| AC12 | studio-assets.component.spec.ts: vazio/carregado, nomes, labels/IDs/eventos; studio-controls.spec.ts: ficheiro real e teclado | PASS |
| AC13 | E2E: contraste >=4,5:1, ícone e confirmação/cancelamento/eliminação real de áudio; regressão do menu Eliminar nota | PASS |
| AC14 | E2E controls + notebook: download Excel, diálogo e impressão/PDF; modelo vazio coberto por unitário | PASS |
| AC15 | E2E desktop/móvel: targets, limites, foco, scroll e bloqueio de PEC concluída; regressões de rascunhos/editor; auditoria estática | PASS |

Ficheiros desta continuação: novo `studio-assets.component.ts` e respetivo spec; integração e estilos em `pecs-editor.component.{ts,html,css}`; variante destrutiva e reset de scroll em `context-panel.component.ts`; label Editar PEC no template `pec-detail`; texto do tutorial Studio; novo `e2e/studio-controls.spec.ts` e rótulos nos E2E notebook, studio-note-editing, studio-panels e studio-redesign. Sem alterações backend ou dependências.

Limitações: validação em Chrome/Windows e viewports móveis simulados; Safari/Firefox, dispositivos físicos e leitores de ecrã não executados. Painel de ficheiros usa deslocação vertical quando necessário. Excel conserva o contrato atual, sem transportar a personalização visual por ocorrência. Dados beta e utilizador de teste preservados; sem reinício da instância, push, merge ou deploy.

### Resultado final da continuação dos controlos
- `npm --prefix frontend run test:targeted` (studio-assets, context-panel e accessibility): **16/16 PASS**, `FEAT-014-controls-focused.log`.
- `npm --prefix frontend run e2e:ci -- e2e/studio-controls.spec.ts e2e/studio-panels.spec.ts e2e/studio-redesign.spec.ts e2e/studio-note-editing.spec.ts e2e/notebook.spec.ts`: **6/6 PASS**, `FEAT-014-controls-e2e.log`.
- `node tools/run-quality-gate.mjs ticket AUTO`: **STANDARD PASS**, backend **31/31**, Angular direcionados **31/31**, integração **168/168**, E2E **25/25** e runner **3/3**; factory/lint/typecheck/build PASS. Evidência: `.factory-results/FEAT-014-controls-ticket.log`, `FEAT-014-controls-ticket.json`, `2026-10-29T13-08-03.172Z-ticket-standard/`.
- Configuração do gate: `FACTORY_RISK=medium`; `FACTORY_MAVEN_TESTS=NoteWorkflowIntegrationTest,NotebookPreferencesIntegrationTest,GpsMapIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest`; `QUALITY_TARGET_SPECS` = studio-assets, context-panel, notebook, studio-redesign e accessibility specs. Sem FACTORY_TICKET_ID fictício.
- `npm --prefix frontend run audit:accessibility`: **PASS**, `FEAT-014-controls-accessibility.log`. `git diff --check -- <ficheiros do âmbito>`: **PASS**; apenas avisos de normalização LF/CRLF.
- Build: bundle inicial **478,58 kB** (<500 kB), sem novo aviso de CSS; aviso NG8113 de RouterLink preexistente, sem investigação adicional.
- `mvn.cmd resources:resources compiler:compile`: **PASS**, `FEAT-014-controls-main-resources.log`; recursos restaurados após clean do gate, hashes application.properties fonte/classes iguais. Backend beta não reiniciado.
- Revisão técnica **APPROVE**, sem achados bloqueantes pendentes: `.factory-results/FEAT-014-controls-qa-review.md`. Capturas desktop/móvel inspecionadas. Nenhuma nova regressão observada nos testes executados.
- **TICKET_GATE: PASS / APPROVED**; **RELEASE_GATE: NOT_RUN / UNVERIFIED**. Os resultados anteriores permanecem históricos; este é o resultado final da continuação 12–15.
- 2026-10-29: **IN_REVIEW**, 15/15 critérios verificados no âmbito dos testes documentados; pronto para aprovação visual do utilizador. Limitações de plataformas descritas acima. Sem push, merge ou deploy.
