# FEAT-012 — Tutoriais de equipa e reconhecimentos offline

- **Description:** Dois percursos guiados na secção Tutorial, com exemplos temporários.
- **Status:** IN_REVIEW
- **Profile and reason:** STANDARD — novos percursos de interface e fronteiras de navegação/dados locais.

## Objective and scope
O catálogo atual só oferece rali, PEC, reconhecimento e Studio. Acrescentar Perfil da Equipa e Reconhecimentos offline, reutilizando o motor de passos e sem alterar regras de negócio.

## Requirements
1. Explicar equipa, tripulação, garagem, unidades e guardar/cancelar.
2. Explicar sessões locais, rascunhos, destino, sincronização, recuperação/áudio em falta e eliminação.
3. Exemplos identificados como simulação, sem consultar dados reais, escrever em IndexedDB ou aceder a dispositivos.
4. Preservar Anterior/Próximo/Sair, teclado, móvel, recarregamento e limites offline.

## Acceptance criteria
1. Dado o catálogo, ao abrir cada novo tutorial surge o percurso correspondente e o contador correto.
2. Ao avançar no perfil, destacam-se identidade, tripulação, garagem, unidades e guardar/cancelar, com distinção entre dados de equipa e regras pessoais.
3. Ao avançar no offline, explicam-se rascunhos/continuação, escolha de PEC, sincronização, erros de áudio e eliminação com confirmação.
4. Dado qualquer percurso, completar, voltar, sair e recarregar funcionam em desktop/móvel e teclado sem navegação inesperada.
5. Ao percorrer os exemplos online/offline, configurações reais e armazenamento permanecem intactos; não há pedidos de dados nem acesso a dispositivos.
6. Ao experimentar online, equipa abre /team-profile e offline abre /offline-recces; em modo offline ambos terminam apenas em /offline-recces.

## Edge cases and expected errors
Rotas desconhecidas mantêm a mensagem existente. Recarregar reinicia o exemplo; voltar não duplica dados. Falta de áudio/sincronização são explicações simuladas, nunca erros reais provocados.

## Components, dependencies and risks
Catálogo workflowGuides, demonstração inert e navegação WorkflowTour; testes unitários e Playwright existentes. Risco principal: acesso acidental ao perfil/IndexedDB ou saída para rota restrita em modo offline.

## Technical decisions
Simulações explícitas e inertes para os dois percursos: evitam instanciar componentes que carregam a equipa ou recuperam sessões locais no arranque. Sem dependências novas. Dicionário/regras e modelo continuam pessoais; apenas sistema base partilhado.

## Changed files
Alterados: workflow-tour.steps.ts, workflow-tour.component.ts, workflow-demo.component.html, workflow-tour.component.spec.ts e e2e/workflow-tours.spec.ts; este documento.

## Acceptance verification
| Criterion | Test/check | Executed result | Evidence |
| --- | --- | --- | --- |
| AC1 | Catálogo e contadores de 6/7 passos; unitários e E2E dos dois percursos | PASS | FEAT-012-focused.log; FEAT-012-focused-e2e.log |
| AC2 | Conteúdo conferido com perfil real; E2E da garagem e percurso completo | PASS | FEAT-012-qa-review.md; FEAT-012-focused-e2e.log |
| AC3 | Estados, destino, recuperação, áudio em falta e confirmação; E2E completo | PASS | FEAT-012-focused-e2e.log |
| AC4 | Anterior/Próximo, reload, Escape, foco e viewport desktop/móvel | PASS | FEAT-012-focused-e2e.log; imagens FEAT-011-team/offline-desktop/mobile.png |
| AC5 | HTTP/snapshots/armazenamento e sondas de IndexedDB/dispositivos online/offline | PASS | FEAT-012-focused-e2e.log |
| AC6 | Destinos fixos online em unitários; saída offline nos seis percursos em E2E | PASS | FEAT-012-focused.log; FEAT-012-focused-e2e.log |

## Validation and review
Testes direcionados: 19/19 PASS (Chrome Headless; primeiro arranque limitado pela sandbox, repetição autorizada fora da sandbox). E2E direcionados: 3/3 PASS. Auditoria estática de acessibilidade: PASS. Gate AUTO selecionou STANDARD: backend 24/24, direcionados 38/38, integração 148/148, E2E 21/21 e verificações do runner 3/3 PASS. Factory, lint, typecheck e build PASS. Bundle inicial 475,94 kB, abaixo do aviso de 500 kB.

## Problems and limitations
Simulação educativa; não testa gravação, uploads nem hardware real. Não é preparação de release. Mantém-se o aviso preexistente NG8113 (RouterLink em PecsListComponent); não bloqueou o build. Chrome exigiu execução fora da sandbox; a repetição passou. Não houve novas regressões detetadas no âmbito validado. Aprovação funcional do utilizador pendente.

## Independent gates
- **TICKET_GATE:** PASS / APPROVED — 6/6 critérios verificados; gate STANDARD e revisão APPROVE.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED — validação global de release não executada.

## Implementation history
- 2026-10-28: PLANNED — especificação criada antes de implementar.

- 2026-10-28: IN_PROGRESS — catálogo, simulações inertes, destinos fixos e testes implementados.
- 2026-10-28: IN_REVIEW — iniciadas QA e revisão com factory-qa e factory-review.



### Comandos e evidência executada
- `QUALITY_TARGET_SPECS=...workflow-tour.component.spec.ts,...notes-tour.component.spec.ts npm --prefix frontend run test:targeted`: 19/19 PASS; `.factory-results/FEAT-012-focused.log`.
- `npm --prefix frontend run e2e:ci -- --grep 'FEAT-012|offline guides'`: 3/3 PASS; `.factory-results/FEAT-012-focused-e2e.log`.
- `FACTORY_RISK=medium FACTORY_MAVEN_TESTS=NotebookPreferencesIntegrationTest,NoteWorkflowIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest QUALITY_TARGET_SPECS=src/app/modules/features/tutorial/workflow-tour.component.spec.ts,src/app/modules/features/tutorial/notes-tour.component.spec.ts,src/app/modules/core/guards/auth.guard.spec.ts,src/app/accessibility.component.spec.ts node tools/run-quality-gate.mjs ticket AUTO`: STANDARD PASS; `.factory-results/FEAT-012-ticket.log`, `FEAT-012-ticket.json` e `2026-10-28T17-19-25.845Z-ticket-standard/`.
- `npm --prefix frontend run audit:accessibility`: PASS; `.factory-results/FEAT-012-accessibility.log`.
- `git diff --check -- <ficheiros do âmbito>`: PASS; revisão inclui leitura dos ficheiros untracked.
- `mvn.cmd resources:resources compiler:compile`: PASS; repõe recursos removidos pelo clean do gate; `.factory-results/FEAT-012-main-resources.log`. Instância beta não reiniciada nem base de dados alterada.
- Revisão técnica e visual: **APPROVE**, sem achados bloqueantes; `.factory-results/FEAT-012-qa-review.md`.
- 2026-10-28: IN_REVIEW — implementação, 6/6 critérios, QA e revisão aprovados; aguarda aprovação do utilizador. Sem push, merge ou deploy.
