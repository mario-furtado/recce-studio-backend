# FEAT-016 — Gestão de ralis e PECs

- **Description:** Redesign local de Ralis & PECs e Detalhes do Rali, compacto e consistente com identidade dark/vermelho.
- **Status:** IN_REVIEW
- **Profile and reason:** STANDARD, pedido explícito; percursos de gestão e navegação com preservação dos contratos.

## Objective and scope
Reduzir ruído, altura e containers nos dois ecrãs. Manter tipografia, textura e tokens globais. Preservar filtros, formulário/logo/carro/classe, criação/edição/eliminação, consulta e continuação de PECs, conclusão/reabertura de rali e modo offline. Não alterar backend, autorizações, persistência, cálculos ou significado dos estados. Preservar integralmente as alterações prévias da FEAT-015.

## Requirements and design decisions
- Cabeçalhos compactos com título e ação principal. Pesquisa/estado sempre acessíveis; piso/ano/carro/classe num painel de filtros avançados com indicação dos filtros aplicados. Mesma lógica de filtragem e reset existentes.
- Ralis em linhas compactas com logo/iniciais, nome, ano, localização, piso, carro/classe, estado e contagem real. Nome como link e acesso explícito Ver Rali e PECs; editar/eliminar fora da navegação, sem card clicável.
- Detalhes com título/metadados/estado uma vez e faixa de três métricas reais. Uma única criação de PEC junto da lista; vazio indica essa ação sem duplicá-la.
- PECs em linhas: número/nome em destaque, distância/notas/estado/data real, acesso principal ao percurso existente, editar/eliminar separados. DRAFT conserva destino /recce/:id e a sugestão de reconhecimento; restantes estados preservados.
- Terminar Rali acessível com peso secundário e confirmação via ConfirmDialogService; cancelar não escreve. Reabrir mantém comportamento/API existente.
- Reutilizar tokens/buttons e FocusPanelComponent para criação de PEC; CSS partilhado apenas destes dois ecrãs. Sem refatorização global ou dependências.

## Acceptance criteria
1. Given lista carregada, then cabeçalho compacto e ralis com metadados reais/estado/contagem, sem altura mínima que preencha espaço vazio; cada nome/acesso abre apenas o rali escolhido.
2. Given pesquisa/estado e filtros avançados, when combinados/ocultados/limpos, then lógica e valores existentes preservados; avançados acessíveis por teclado com aria-expanded/controls.
3. Given pedidos pendentes, vazio, resultados filtrados vazios ou erro, then estados distintos; retry no erro e limpar pesquisa/filtros sem criar dados nem confundir falha com vazio. Offline mantém restrições e acesso existente.
4. Given criar/editar/eliminar rali, then todos os campos/logo e contratos são preservados; editar/eliminar não navegam e eliminar mantém confirmação.
5. Given detalhes carregados, then cabeçalho compacto mostra título/piso/carro/classe/estado uma vez, e métricas PECs/km/notas refletem dados reais sem cartões individuais.
6. Given lista de PECs vazia/filtrada/preenchida ou rali concluído, then existe uma única ação principal de criação (bloqueada quando concluído), nomes/ações/estados legíveis e percursos/edição/eliminação mantidos sem navegação acidental.
7. Given Terminar Rali, when cancelado, then nenhum PUT; when confirmado, then mesma transição existente e bloqueios de gestão; reabertura mantém funcionalidades.
8. Given desktop1440, tablet768 e móvel360, then sem overflow horizontal, alvos >=44px, labels/foco e navegação por teclado utilizáveis; diálogo de criação com Escape/foco/fecho e regressões dos tutoriais/criação preservadas.

## Edge cases and expected errors
Nomes longos, zero/um/vários ralis e PECs, logos ausentes, carro sem associação ou eliminado, filtros avançados persistentes quando recolhidos, rali e PEC concluídos, carregamento/falha de rali ou PECs, ações canceladas e erros de gravação. Não apresentar valores de placeholder como dados reais durante carregamento.

## Components, dependencies and risks
PecsListComponent/RallyDetailComponent, serviços existentes inalterados, Router/Forms, ConfirmDialog e FocusPanel. Risco de cliques acidentais, filtros inacessíveis no móvel, ações duplicadas ou removidas e testes/tutorial dependentes de markup. Isolamento permanece nos endpoints existentes; nenhuma nova origem/dado partilhado.

## Changed files
- `frontend/src/app/modules/features/pecs/pecs-list/pecs-list.component.{ts,html}`: layout, filtros/estados e foco do formulário.
- `frontend/src/app/modules/features/pecs/rally-detail/rally-detail.component.{ts,html}`: layout, estados, confirmação e diálogo de criação.
- `frontend/src/app/modules/features/pecs/rally-management.css`: estilos locais partilhados, sem alterar tema global.
- `frontend/src/app/modules/features/pecs/rally-management.component.spec.ts`: oito regressões de estados/filtros/ações/contratos.
- `frontend/e2e/rally-management.spec.ts`: comparação visual e percurso real de gestão.
- `frontend/e2e/critical-journeys.spec.ts`: navegação pelo novo link explícito da PEC, mantendo asserções existentes.
- `frontend/src/app/modules/features/tutorial/workflow-demo.component.html`: preview inline explícito para o mesmo formulário, sem modal na árvore inert.
- Este documento. Alterações anteriores de FEAT-015 preservadas e não incluídas no âmbito de implementação.

## Acceptance verification
| Criterion | Planned validation | Actual result |
| --- | --- | --- |
| AC1 | E2E visual antes/depois, metadata real e acesso por nome/ação; revisão de linhas sem min-height artificial | PASS |
| AC2 | Unitário combina todos os filtros e preserva valores recolhidos; E2E alterna/pesquisa/limpa e verifica aria/foco/Enter | PASS |
| AC3 | Unitários com HTTP pendente/500/retry/vazio/no matches e offline; E2E pesquisa sem resultados | PASS |
| AC4 | E2E criar/editar rali, cancelar eliminação sem navegar; confirmação/handlers preservados; campos/logo revistos | PASS |
| AC5 | Unitário: três métricas reais sem metric-tile; comparação visual e soma de km/notas | PASS |
| AC6 | Unitário/E2E: criação única, vazio, pesquisa, edição validada, bloqueios, navegação, eliminação e reload | PASS |
| AC7 | Unitário/E2E: cancelar sem PUT, confirmar mesmo payload/status, bloquear e reabrir | PASS |
| AC8 | Capturas1440/768/360, overflow/targets/foco/Enter/Escape e12 E2E dirigidos + suite final28, acessibilidade estática | PASS |

## Validation and review
factory-qa e factory-review no mesmo fluxo, sem agentes. Testes direcionados antes de um gate STANDARD estabilizado: `node tools/run-quality-gate.mjs ticket AUTO`, FACTORY_RISK=medium, QUALITY_TARGET_SPECS dos módulos e regressões relacionadas. Sem DEEP/release/auditorias globais. Logs em .factory-results/.

## Problems and limitations
Antes da implementação: cards/lista sem estados de carregamento/vazio, PEC com navegação em div inteira, criação redundante e conclusão imediata sem confirmação. Capturas e resultados ainda não executados. Chrome/viewports locais previstos, hardware/outros browsers por validar.

## Independent gates
- **TICKET_GATE:** PASS / APPROVED — critérios9–13 e regressões da terceira iteração aprovados; histórico anterior preservado.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED.

## Implementation history
- 2026-10-29: PLANNED, especificação antes do código. Raiz e AGENTS confirmados; mudanças FEAT-015 existentes preservadas.- Reprodução visual antes da alteração: E2E1/1 PASS, .factory-results/FEAT-016-before.log; capturas list/detail-before desktop/móvel e detalhe tablet. Confirmadas as redundâncias descritas.
- Compatibilidade com tutorial: demonstração usa os componentes reais numa árvore inert. O diálogo nativo da criação será substituído por apresentação inline apenas nessa demonstração explícita, reutilizando o mesmo template e sem alterar handlers/dados.
- Implementação: cabeçalhos/linhas compactos, filtros avançados recolhidos, estados carregamento/erro/vazio, três métricas e uma criação de PEC. Contratos/regras existentes mantidos; confirmação precede apenas a mesma operação de conclusão.
- QA dirigida: unitários27/27 PASS, E2E12/12 PASS (rally-management, critical-journeys e workflow-tours), auditoria estática acessibilidade PASS. Capturas antes/depois desktop/móvel e detalhe tablet inspecionadas, sem overflow observado.
- Revisão de teclado acrescentou foco no Nome do rali ao abrir/criar/editar e retorno ao acionador ao cancelar/guardar; E2E final verifica explicitamente esse foco. Sem alteração de persistência. IN_REVIEW para gate final STANDARD.
- Primeiro gate falhou nos direcionados:25 PASS/2 FAIL por acentos corrompidos no script do ajuste de foco (leitura Python pela code page Windows em vez de UTF-8). Codificação reposta nos ficheiros afetados e no documento; asserções mantidas. Não classificado como falha global/baseline. Evidência: FEAT-016-ticket-first.log/json, 2026-10-29T16-48-33.117Z-ticket-standard/. Nova execução completa após correção.

## Resultados finais executados
| Comando/check | Resultado real | Evidência em .factory-results/ |
| --- | --- | --- |
| `RECCE_VISUAL_PHASE=before npm --prefix frontend run e2e:ci -- e2e/rally-management.spec.ts` (captura, antes do redesign) | 1/1 PASS | FEAT-016-before.log; capturas *-before-* |
| `npm --prefix frontend run test:targeted` com rally-management/accessibility/workflow-tour specs | 27/27 PASS | FEAT-016-focused.log; confirmação no gate final |
| `npm --prefix frontend run e2e:ci -- e2e/rally-management.spec.ts e2e/critical-journeys.spec.ts e2e/workflow-tours.spec.ts` | 12/12 PASS | FEAT-016-e2e.log |
| `npm --prefix frontend run audit:accessibility` | PASS | FEAT-016-accessibility.log |
| `node tools/run-quality-gate.mjs ticket AUTO` | STANDARD PASS, config/lint/typecheck, direcionados27/27, integração182/182, E2E28/28 + runner3/3 e build | FEAT-016-ticket.log/json; 2026-10-29T17-02-50.286Z-ticket-standard/ |
| Revisão factory-review + `git diff --check -- <âmbito>` | APPROVE / PASS; só avisos LF/CRLF | FEAT-016-qa-review.md |

Gate com `FACTORY_RISK=medium`, `QUALITY_TARGET_SPECS=src/app/modules/features/pecs/rally-management.component.spec.ts,src/app/accessibility.component.spec.ts,src/app/modules/features/tutorial/workflow-tour.component.spec.ts`. Sem FEAT ID em FACTORY_TICKET_ID. Perfil frontend/factory; nenhum teste Maven específico ou gate de release executado, pois não há alterações backend/contratos.

Build final: bundle inicial **485,81 kB** (<500 kB), sem avisos de CSS e sem alterar budgets/dependências. Falha intermédia de UTF-8 corrigida e preservada no histórico; nenhuma nova falha permanece nos checks executados. Foco do formulário e regressões de tutorial aprovados no gate final.

### Comparação visual
Capturas inspecionadas com fixtures realmente criadas pela API isolada, sem alterações à base beta:
- Lista: `FEAT-016-list-before-desktop.png` / `FEAT-016-list-after-desktop.png`; versões mobile360 com os mesmos prefixos.
- Detalhes: `FEAT-016-detail-before-desktop.png` / `FEAT-016-detail-after-desktop.png`; versões mobile360 e tablet768.
- Antes: cabeçalho grande, filtros em superfície dedicada, cartão alto, quatro cartões de métricas e duas criações de PEC.
- Depois: cabeçalho curto, filtros frequentes/avançados, linha compacta com estado/metadados/ações, três métricas sem cartões e uma criação. Nenhum espaço preenchido com métricas ou atividade fictícias. Totais da lista podem variar entre capturas devido aos outros cenários isolados; o rali de comparação e respetiva PEC têm os mesmos dados.

### Fecho e limitações
**IN_REVIEW**, 8/8 critérios verificados no âmbito documentado, pronto para revisão visual. Revisão final **APPROVE**, sem achados bloqueantes pendentes ou regressões observadas no âmbito. **TICKET_GATE: PASS / APPROVED**; **RELEASE_GATE: NOT_RUN / UNVERIFIED**.
Chrome/Windows e viewports simulados; Safari/Firefox, dispositivos físicos e leitores de ecrã reais não executados. Contraste inspecionado visualmente com os tokens existentes; não constitui auditoria WCAG completa. Não se inferiu aprovação global de release. Sem push, merge, deploy, alterações aos dados beta ou reinício do backend local.
- 2026-10-29: implementação, QA, revisão e gate concluídos; documentação/evidência atualizadas.

## Terceira iteração — composição dos detalhes do rali
2026-10-29, IN_PROGRESS. Pedido: corrigir perda de coesão/densidade na segunda iteração, sem regressar ao layout original. Perfil STANDARD, layout/percursos responsivos. Âmbito exclusivo RallyDetail: HTML, CSS local, ligação do styleUrl e testes; preservar a lista Ralis & PECs e alterações prévias.

### Diagnóstico e decisões
Breadcrumb no resumo em vez de Voltar separado; identidade e faixa de métricas dentro de uma única superfície com separadores subtis, evitando cartões internos. Conteúdo com max-width1080px e intervalos16px; lista próxima do resumo. PECs em grelha com largura máxima520px por cartão, metadados compactos, ação principal vermelha e secundárias de44px com ícone/título/nome acessível. Sem novos efeitos, dados, estados ou mudanças de negócio.

### Critérios adicionais, definidos antes da implementação
9. Cabeçalho contém breadcrumb Ralis & PECs, identidade/estado e três métricas reais integradas, distribuídas e separadas subtilmente; sem botão Voltar fora da estrutura quando os dados estão carregados.
10. Resumo/lista partilham max-width1080px e ficam próximos; cartão PEC <=520px no desktop, sem alongamento artificial quando existe apenas um.
11. Ação principal mantém vermelho e destino; editar/eliminar são ações proporcionais, separadas e acessíveis, com targets>=44px; preservar formulário, confirmação, conclusão/reabertura e bloqueios existentes.
12. Zero, uma e várias PECs têm composição coerente sem overflow a1440/768/360px; nomes longos legíveis, formulário e diálogo utilizáveis por teclado.
13. Capturar/inspecionar composição em desktop/tablet/móvel e fazer segunda passagem; ausência de alterações ao layout da lista, lógica, API, dados ou autorizações. Registar resultados e limites reais.

Plano: testes existentes de gestão/a11y/tutorial + E2E novo de composição com dados reais, capturas0/1/várias PECs e verificação de geometria/targets/rotas; revisão do diff local. Critérios9–13 UNVERIFIED até execução. TICKET_GATE desta continuação UNVERIFIED; RELEASE_GATE NOT_RUN.
- Primeira passagem executada: direcionados27/27 PASS, E2E10/10 PASS (composição0/1/3, gestão e tutoriais). Capturas v3 desktop/móvel/tablet inspecionadas; cartões <=520px, conteúdo <=1080px, resumo/lista com gap16px e targets>=44px verificados.
- Segunda passagem visual: identificada altura adicional na barra de pesquisa; etiqueta alinhada lateralmente ao campo, mantendo label visível e aria-label, para aproximar ainda mais a lista do resumo. Sem alterações funcionais. Nova validação pelo gate final STANDARD. Estado IN_REVIEW.

### Resultado final da terceira iteração
| Critério | Verificação executada | Resultado |
| --- | --- | --- |
| AC9 | E2E: breadcrumb dentro do resumo, métricas reais0/1/3; inspeção visual da faixa distribuída com separadores | PASS |
| AC10 | Geometria nos9 cenários: root<=1080px, cartões<=520px, resumo/lista<=24px; segunda passagem reduz altura do toolbar | PASS |
| AC11 | Ícones com title/aria-label, targets>=44px, edição real/cancelamento de eliminação e regressões de criação/conclusão/reabertura/rotas | PASS |
| AC12 | Zero/uma/três PECs, nome longo,1440/768/360px, overflow e controlos; formulário/diálogo e tutoriais regressados | PASS |
| AC13 | Capturas e inspeção em duas passagens; diff limitado ao detalhe e testes/documento, lógica/serviços/lista preservados | PASS |

| Comando/check | Resultado real | Evidência em .factory-results/ |
| --- | --- | --- |
| `npm --prefix frontend run test:targeted` (rally-management, accessibility e workflow-tour specs) | 27/27 PASS | FEAT-016-v3-focused.log |
| `npm --prefix frontend run e2e:ci -- e2e/rally-detail-composition.spec.ts e2e/rally-management.spec.ts e2e/workflow-tours.spec.ts` | 10/10 PASS antes da segunda passagem; respetivos cenários repetidos no gate final | FEAT-016-v3-e2e.log |
| `npm --prefix frontend run audit:accessibility` | PASS | FEAT-016-v3-accessibility.log |
| `node tools/run-quality-gate.mjs ticket AUTO` | STANDARD PASS: config/lint/typecheck, direcionados27/27, integração182/182, E2E29/29 + runner3/3, build | FEAT-016-v3-ticket.log/json; 2026-10-29T17-45-11.269Z-ticket-standard/ |
| `git diff --check -- <âmbito>` / factory-review | PASS / APPROVE | FEAT-016-v3-qa-review.md |

Configuração: FACTORY_RISK=medium; QUALITY_TARGET_SPECS iguais aos três specs acima; scope frontend/factory; sem FACTORY_TICKET_ID fictício. Build inicial485,72kB (<500), sem avisos CSS, sem modificar budgets/dependências. Nenhuma nova falha observada nos checks desta continuação. Sem DEEP, auditoria global ou release.

Ficheiros desta terceira iteração: `frontend/src/app/modules/features/pecs/rally-detail/rally-detail.component.html` (composição), `.css` (estilos locais), `.ts` (apenas ligação do styleUrl), `frontend/e2e/rally-detail-composition.spec.ts` (novo), e este documento. O stylesheet/lista partilhados e todos os handlers permanecem como estavam no início desta continuação; alterações anteriores preservadas.

Capturas finais: `FEAT-016-v3-{0,1,3}-{desktop,tablet,mobile}.png`, nove combinações com dados criados pela API isolada. Inspecionadas composições desktop1/3, tablet0 e móvel1/3; verificados limites automaticamente nas nove. Segunda passagem inspecionou novamente desktop3/móvel1 após alinhar a pesquisa; não foram identificados novos bloqueantes visuais. Capturas anteriores permanecem no histórico.

Revisão final **APPROVE**. Estado **IN_REVIEW**, critérios9–13 verificados e prontos para aprovação visual; resultados1–8 da iteração anterior preservados. **TICKET_GATE: PASS / APPROVED**; **RELEASE_GATE: NOT_RUN / UNVERIFIED**.
Limitações: Chrome/Windows e viewports móveis/tablet simulados; browsers alternativos, dispositivos físicos e leitores de ecrã reais não executados. Inspeção visual e auditoria estática não equivalem a auditoria WCAG completa. Sem mudanças de negócio/autorização/persistência, dados beta, reinício do backend, push, merge ou deploy.
- 2026-10-29: terceira iteração concluída, segunda passagem visual aplicada, QA/revisão/gate/documentação atualizados.

## Continuação — foco exclusivo na edição do rali
2026-10-29, perfil FAST: correção pequena e isolada de visibilidade/foco, sem alteração de gravação ou filtros. Problema confirmado: formulário inline e lista continuam visíveis em simultâneo, duplicando o rali em edição.
AC14: ao criar/editar, ocultar o bloco de resultados (incluindo estados vazios), sem destruir dados/filtros; ao cancelar/guardar, voltar a apresentá-lo e devolver foco ao acionador após atualização visual; erro de gravação mantém o formulário aberto. Regressões dirigidas: unitário e E2E de criar/editar/cancelar/guardar. TICKET_GATE desta continuação UNVERIFIED até executar; histórico anterior preservado.
- Implementado AC14: bloco de resultados oculto por hidden durante criar/editar; dados/filtros e identidade DOM preservados. Retorno de foco após renderização, com trackBy do ID do rali para preservar o botão quando a resposta de gravação substitui o objeto. Nenhuma alteração de endpoint/payload/regra de negócio.
- Primeiro unitário expôs perda do acionador após guardar por recriação do cartão; corrigida pela identidade estável do ID, mantendo a asserção de foco. Primeiro gate15 PASS/1 FAIL preservado em FEAT-016-edit-focus-ticket-first.log/json.
- `node tools/run-quality-gate.mjs ticket FAST`: PASS, factory/config/lint/typecheck e direcionados16/16 (rally-management + accessibility), QUALITY_TARGET_SPECS explícitos. Evidência FEAT-016-edit-focus-ticket.log/json.
- `npm --prefix frontend run e2e:ci -- e2e/rally-management.spec.ts`: 2/2 PASS, incluindo ocultar ao editar, cancelar/devolver foco e guardar/voltar a apresentar dados atualizados; build de produção do harness PASS. Evidência FEAT-016-edit-focus-e2e.log.
- Revisão FAST focalizada e diff --check PASS; sem achados pendentes. AC14 PASS; TICKET_GATE PASS / APPROVED; RELEASE_GATE NOT_RUN / UNVERIFIED. Estado IN_REVIEW, histórico anterior preservado. Sem push/merge/deploy ou alterações aos dados beta.
