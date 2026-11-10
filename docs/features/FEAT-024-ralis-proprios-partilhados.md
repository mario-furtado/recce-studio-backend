# FEAT-024 — Ralis próprios, partilhados e seleção de tripulação

- **Estado:** COMPLETED
- **Roadmap:** UAC-P07
- **Perfil:** STANDARD, com verificações específicas de autorização, privacidade e preservação de rascunhos.

## Objetivo e âmbito

Ligar as listas de ralis próprios e partilhados à seleção de tripulação e à preparação do primeiro rali. Antes da implementação, a lista própria não indicava o acesso a ralis partilhados nem tinha uma ação direta para mudar de tripulação. A vista partilhada podia ficar aberta até um pedido posterior detetar uma revogação.

## Requisitos e critérios de aceitação

1. **P07-AC1.** Dado um proprietário de A com acesso READ a B, ao alternar as listas e a tripulação vê a origem e as ações adequadas a cada rali. Contagens e filtros excluem ralis de outros contextos e uma escrita forçada em B é rejeitada. Uma falha numa lista permite abrir a outra e repetir o carregamento.
2. **P07-AC2.** Dada uma conta nova e verificada, consegue criar e selecionar uma tripulação simples e guardar o primeiro rali sem enviar convites ou criar uma segunda conta. As flags e o percurso legado são respeitados.
3. **P07-AC3.** Dado um link partilhado para B com A ativo, só o leitor autorizado vê B. O link não troca a tripulação, não afeta dados locais nem abre o editor. A navegação a partir de um formulário de rali com um rascunho exige decisão explícita. Após revogação, revalidar ao voltar ao ecrã ou a pedido retira o conteúdo apresentado.
4. **P07-AC4.** Os controlos e estados vazio, carregamento, erro e recuperação são utilizáveis por teclado e em viewport móvel e desktop.

## Dependências e decisões

Reutilizar a seleção P02, compatibilidade P03, consulta por rali e publicação P04, inbox P05 e revogação P06. Os ensaios usam contextos migrados sintéticos e contas isoladas. A origem mostrada distingue área própria e partilhada sem divulgar o perfil privado de outra tripulação. Os destinos offline multi-contexto continuam dependentes da P09.

As áreas têm rotas e carregamentos independentes. A lista própria só oferece atalhos de tripulação quando a capacidade existente está ativa. A conta usa o seletor e a criação já existentes. Em consulta, o contexto de escrita mantém-se guardado e a interface identifica a origem como partilhada. A confirmação de saída protege formulários de rali em navegação interna, e a troca de contexto espera pela conclusão de um pedido de gravação.

Os pedidos HEAD de rali e PEC reutilizam as verificações exatas da consulta READ, sem carregar notas, ficheiros ou caderno. A vista revalida ao voltar a estar visível ou através de «Verificar acesso». Quando a verificação falha, limpa o conteúdo e liberta os ficheiros em memória, mantendo a opção de recuperação.

## Ficheiros alterados

- Angular: `app.routes.ts`, `personal-account.component.ts`, `crew-manager.component.ts`, `main-layout.component.ts`, `rally-area-nav.component.ts`, `pecs-list.component.{ts,html}`, `shared-rallies.component.{ts,html}`, `workflow-demo.component.html`.
- Backend: `SharedRallyController.java`.
- Regressões: `rally-management.component.spec.ts`, `SharedRallyIntegrationTest.java`, `frontend/e2e/rally-areas.spec.ts`.

## Validação e revisão

| Critério | Verificação executada | Resultado |
| --- | --- | --- |
| AC1 | E2E com conta proprietária e leitora, mudança de tripulação, erro de uma lista e tentativa de escrita | PASS |
| AC2 | E2E de registo verificado, criação e primeiro rali sem convites; regressão de flags no backend | PASS |
| AC3 | E2E de rascunho, ligação direta, revogação e isolamento; testes de autorização HEAD | PASS |
| AC4 | E2E desktop e móvel a 360 px, entrada por teclado e recuperação após HTTP 503 | PASS |

| Comando | Resultado | Evidência em `.factory-results/` |
| --- | --- | --- |
| `npm --prefix frontend run typecheck` | PASS | `FEAT-024-typecheck.log` |
| `npm --prefix frontend run test:targeted`, quatro specs de ralis, guard, contexto e tripulações | 33/33 | `FEAT-024-angular-focused.log` |
| `mvn -Dtest=SharedRallyIntegrationTest,RallyInvitationIntegrationTest,CrewFeatureDisabledIntegrationTest,CrewIsolationIntegrationTest,ApiAuthInterceptorAuditTest surefire:test` | 34/34 | `FEAT-024-backend-focused.log` |
| `npm --prefix frontend run e2e:ci -- rally-areas.spec.ts` | 1/1 com Chromium, API e H2 isolados | `FEAT-024-e2e-focused-retry.log`, `FEAT-024-read-mobile.png` |
| `node tools/run-quality-gate.mjs ticket AUTO`, com `FACTORY_RISK=medium` | STANDARD. Factory, backend 42/42, lint, tipos e testes dirigidos 58/58 passaram. Integração 200/204 na primeira execução. | `FEAT-024-ticket.log`, `FEAT-024-ticket-initial.json` |
| `npm --prefix frontend run quality:fast` e `npm --prefix frontend run test:integration`, após correção | Lint, tipos, 77/77 direcionados e 204/204 de integração | `FEAT-024-final-frontend-fast.log`, `FEAT-024-final-integration.log` |
| `node --test tools/run-e2e.test.mjs` | 3/3 | `FEAT-024-final-e2e-wrapper.log` |
| `CI=true npm --prefix frontend run e2e:ci -- --global-timeout=480000` | 37/38. Passaram P07, revogação, percursos legados, offline, Studio e tutoriais. Falhou uma asserção da mensagem da conta na P01. | `FEAT-024-final-e2e.log` |
| `CI=true npm --prefix frontend run e2e:ci -- personal-account.spec.ts crew-context.spec.ts rally-areas.spec.ts shared-rally.spec.ts rally-access.spec.ts` | 5/5 após repor a mensagem. Cobertura final de 38 cenários distintos entre as duas execuções. | `FEAT-024-account-recheck.log` |
| `npm --prefix frontend run build` | PASS | `FEAT-024-final-build.log` |

**Revisão:** APPROVE WITH NOTES. A revisão verificou a separação entre o cabeçalho de tripulação nos pedidos de trabalho e a conta nos pedidos READ. As verificações de rali, pertença da PEC e permissão de impressão continuam no servidor. O formulário ignora cliques repetidos durante o pedido de gravação e protege a troca de área com alterações por guardar. A navegação obrigatória para offline mantém o comportamento anterior. A captura a 360 px mostrou os atalhos em várias linhas sem corte lateral. O resultado do gate inicial foi preservado e os checks afetados foram aprovados em reexecuções separadas.

## Problemas e limitações

A migração da beta continua dependente de um manifesto aprovado. O rollout de destinos offline é posterior. A revalidação por visibilidade ou ação explícita não oferece notificação em tempo real com o ecrã continuamente visível.

As primeiras tentativas de E2E foram bloqueadas pelo acesso a localhost no ambiente restrito e por uma porta retida pelo processo de teste anterior. A execução local autorizada com a porta libertada passou. Uma invocação inicial de `mvn test` também parou na cache do plugin frontend. A validação Java usou os objetivos específicos que o gate da Factory aplica.

A primeira integração Angular detetou três pedidos de conta indevidos no tutorial simulado e uma leitura de sessão durante a criação de um componente de teste. A demonstração passou a usar explicitamente o modo de exemplo, e a leitura de sessão foi movida para a inicialização do ecrã real. As verificações frontend afetadas foram repetidas, reutilizando os 42 testes Java do gate. O E2E completo usou o mesmo conjunto de cenários com 480 s de limite global na linha de comando, devido ao limite global atingido na P06.

O E2E de registo e recuperação da conta detetou uma alteração à mensagem de seleção de tripulação. A mensagem anterior foi reposta; a indicação nova para o primeiro rali continua na lista vazia de tripulações.

## Quality Gates

- **TICKET_GATE:** PASS no âmbito da P07 após correções e reexecução dos checks afetados. O relatório da primeira invocação automática conserva o FAIL inicial.
- **RELEASE_GATE:** BLOCKED pela falha conhecida [AUD-SEC-005](../ai/QUALITY_BASELINE.md). Execução do gate global nesta fase: NOT_RUN.

## Histórico

- 2026-11-10 — PLANNED. Especificação registada antes da implementação.

- 2026-11-10 — IN_PROGRESS. Implementação iniciada.
- 2026-11-10 — IN_REVIEW. Fluxo completo reproduzido no navegador e regressões direcionadas aprovadas.
- 2026-11-10 — IN_REVIEW. Integração detetou problemas de inicialização da demonstração e do componente. Correção aplicada e revalidação frontend iniciada.
- 2026-11-10 — IN_REVIEW. Todos os testes Angular de integração passaram após a correção. E2E completo em execução.
- 2026-11-10 — IN_REVIEW. E2E completo concluiu 37/38. Mensagem anterior da conta reposta e repetição dos fluxos afetados iniciada.
- 2026-11-10 — COMPLETED. Repetição E2E 5/5, build de produção aprovado e revisão fechada.
