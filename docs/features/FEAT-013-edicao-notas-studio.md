# FEAT-013 — Edição e apresentação por nota no Studio

- **Description:** Editar conteúdo, avisos, instante e estilo por ocorrência numa nota da PEC, com pré-visualização e exportação PDF consistente.
- **Status:** IN_REVIEW
- **Profile and reason:** STANDARD — frontend/backend e persistência; testes rigorosos de autorização, isolamento e compatibilidade.

## Objective and scope
Studio já edita texto, observações e instante (incluindo alinhamento opcional das seguintes), mas não persiste apresentação individual. Reutilizar esse fluxo, mantendo o modelo pessoal e dicionário intactos. Inclui estilo por elemento nesta ocorrência: posição, tamanho 50–150%, negrito, sublinhado e destaque; guardar/cancelar e repor modelo. Não inclui alteração global de símbolos, Excel com estilos ou gravação offline.

## Requirements
1. Edição explícita por nota, pré-visualização e Guardar/Cancelar.
2. Apresentação opcional por ocorrência, sem modificar outras notas ou o modelo.
3. Persistência na PEC e aplicação no Studio, caderno e PDF.
4. Repor apresentação do modelo é uma edição que só persiste ao guardar.
5. Validação dos dados visuais no servidor; regras existentes de proprietário e PEC concluída mantidas.
6. Alterar texto repõe os ajustes visuais do rascunho, com aviso explícito, para não aplicar estilos a elementos errados. Erro de gravação preserva rascunho.

## Acceptance criteria
1. Dada uma nota, Editar mostra texto, avisos, instante e pré-visualização; Cancelar preserva dados guardados.
2. Dada uma sequência com símbolos repetidos, alterar um elemento afeta apenas essa ocorrência nessa nota.
3. Ao guardar e recarregar, conteúdo, instante e ajustes visuais persistem e coordenadas não se perdem.
4. Caderno e PDF apresentam os mesmos ajustes; conteúdo que não cabe continua a bloquear impressão explicitamente.
5. Repor modelo remove apenas personalizações da nota ao guardar; dicionário/modelo e outras notas permanecem intactos.
6. Valores inválidos são rejeitados sem escrita parcial; conta alheia e PEC concluída não podem editar; clientes antigos e notas sem personalização continuam funcionais.
7. Erro HTTP conserva rascunho e permite repetir; alterações de texto não transferem estilos para elementos diferentes; controlos têm nomes acessíveis e não dependem de hover.

## Edge cases and expected errors
Texto vazio, instante inválido, tamanho/posição inválidos, JSON desconhecido/excessivo, símbolos repetidos, nota sem modelo carregado, falha HTTP, PEC bloqueada e outra conta. Não interpretar HTML/CSS fornecido pelo utilizador. Sem mudanças em autorização ou dicionários.

## Components, dependencies and risks
PecsEditor, composição/medição/impressão do Notebook, contrato Note/Alignment, NoteEntity e NoteExcelParserService. Coluna nullable adicional em notes; preservar dados existentes. Os estilos pertencem à PEC (mesmo âmbito da nota), não às preferências pessoais. Dependência nova: nenhuma.

## Technical decisions
Documento visual JSON versionado e limitado guardado por nota. Chave de elemento = correspondência literal + número da ocorrência; texto de origem impede reaplicação a conteúdo diferente. Guardar estilos por ocorrência evita copiar e congelar todo o modelo. Campos visuais permitidos explicitamente; texto sempre renderizado com interpolação Angular. Compatibilidade do endpoint de alinhamento distingue campo ausente de reset explícito.

## Changed files
- Backend: `src/main/java/org/example/entity/NoteEntity.java`, `dto/NoteAlignmentDTO.java`, `service/NoteExcelParserService.java`, `service/NotePresentationValidator.java` — campo nullable, contrato e validação/persistência.
- Frontend core: `models/rally.ts`, `services/pecs.service.ts`, `notebook/notebook.model.ts`, `note-presentation.ts`, `note-presentation-editor.component.ts`, `note-display.component.ts`, `notebook.component.ts` — contrato e composição partilhada.
- Studio: `frontend/src/app/modules/features/pecs/pecs-editor/pecs-editor.component.ts` e `.html` — edição, preview, guardar/cancelar, indicador, reset e layout móvel.
- Testes: `src/test/java/org/example/controller/NoteWorkflowIntegrationTest.java`, `frontend/src/app/modules/core/notebook/note-presentation.component.spec.ts`, `frontend/src/app/modules/features/pecs/pecs-editor/note-editing.component.spec.ts`, `frontend/e2e/studio-note-editing.spec.ts`.
- Documento permanente: este ficheiro. Não foram alterados dicionários, preferências globais, dependências ou configurações de autenticação.

## Acceptance verification
| Criterion | Test/check | Executed result | Evidence |
| --- | --- | --- | --- |
| AC1 | Edição/cancelamento em unitários e E2E com formulário real | PASS | FEAT-013-focused.log; FEAT-013-review-e2e.log |
| AC2 | Dois ATT: apenas ocorrência 2 personalizada, uma segunda nota intacta | PASS | NoteWorkflowIntegrationTest; note-presentation.component.spec.ts; E2E |
| AC3 | HTTP/JPA + reload real; texto/tempo/estilo/latitude/longitude | PASS | FEAT-013-backend-focused.log; FEAT-013-review-e2e.log |
| AC4 | Composição comum; overflow bloqueia impressão; ajuste explícito para 4 linhas e PDF real inspecionado | PASS | FEAT-013-review-e2e.log; FEAT-013-studio-note.pdf; FEAT-013-studio-note-page.png |
| AC5 | Repor+Cancelar mantém estilo; Repor+Guardar limpa apenas a nota; snapshots de outra nota/modelo/dicionário | PASS | E2E e HTTP/JPA |
| AC6 | Payload inválido não altera tempos/notas; conta alheia 404; PEC concluída 400; legado e reset explícito | PASS | FEAT-013-backend-focused.log; backend-test.log no gate |
| AC7 | Erro 503 e repetição, bloqueio de save duplicado, texto repõe estilo, nomes acessíveis e formulário móvel | PASS | FEAT-013-focused.log; FEAT-013-review-e2e.log; FEAT-013-accessibility.log |

## Validation and review
Reprodução executada: 1 teste HTTP/JPA falhou porque presentationJson era ignorado (FEAT-013-before.log). Após correção: backend 6/6 PASS; Angular direcionado 25/25 PASS; typecheck e acessibilidade PASS. E2E direcionado 1/1 PASS, incluindo PDF real, erro/repetição, cancelamento, reset e preservação de outra nota/dicionário/modelo. Gate AUTO STANDARD PASS: backend 31/31, direcionados 37/37, integração 155/155, E2E 22/22 + runner 3/3, factory/lint/typecheck/build aprovados. Ajuste visual final validado depois num novo E2E 1/1 PASS; evidência anterior inalterada reutilizada. QA/revisão seguem factory-qa e factory-review.

## Problems and limitations
PDF usa impressão do navegador. Excel continua exportação de conteúdo sem estilos. Testes executados em H2/servidores isolados; instância beta e respetivos dados não foram alterados. Para usar a funcionalidade na instância já aberta, reiniciar o backend atualizado. A coluna nullable foi validada em H2; migração PostgreSQL/produção não executada. Aviso preexistente NG8113 (RouterLink) permanece; não bloqueou build. Sem novas regressões detetadas no âmbito validado. Aprovação funcional do utilizador pendente.

## Independent gates
- **TICKET_GATE:** PASS / APPROVED — 7/7 critérios e revisão APPROVE.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED — release global não executada.

## Implementation history
- 2026-10-28: PLANNED — especificação antes da implementação.

- 2026-10-28: IN_PROGRESS — reprodução confirmada; campo nullable por nota, validação allowlist, edição por ocorrência e composição comum Studio/PDF implementados.


### Registo de validação intermédia
- `.factory-results/FEAT-013-before.log`: reprodução real FAIL — apresentação enviada ignorada pela API.
- `.factory-results/FEAT-013-backend-focused.log`: 6/6 PASS; persistência/reset/compatibilidade, atomicidade, conta alheia e PEC concluída.
- `.factory-results/FEAT-013-focused.log`: 25/25 PASS; composição por ocorrência, Notebook, edição/cancelar/erro/repetição, regressão mapa/tempo.
- `.factory-results/FEAT-013-typecheck.log`, `FEAT-013-accessibility.log`: PASS.
- E2E inicial bloqueou no rótulo exato do seletor; acrescentadas etiquetas explícitas (`FEAT-013-focused-e2e-before-label-fix.log`). Segunda tentativa encontrou uma asserção incorreta por ordem DOM: posições na grelha reordenam o HTML. Corrigida a identificação por tamanho e preservadas as verificações de uma única ocorrência (`FEAT-013-focused-e2e-before-order-fix.log`). Repetição final PASS (FEAT-013-focused-e2e.log). O cenário confirmou também bloqueio correto por falta de espaço com 8 linhas; uma alteração explícita da configuração para 4 linhas permitiu exportar sem cortar/reduzir conteúdo.


- 2026-10-28: IN_REVIEW — E2E completo PASS; PDF gerado e conteúdo lido (1 página). Revisão visual móvel identificou formulário estreito; campos passam a ocupar uma linha inteira e o E2E verifica a largura relativa. Gate STANDARD em execução com esta correção.


### Comandos e resultados finais
| Comando | Resultado | Evidência |
| --- | --- | --- |
| `mvn.cmd compiler:compile compiler:testCompile -Dtest=NoteWorkflowIntegrationTest#occurrencePresentationSurvivesReloadAndAlignmentWithoutAffectingOtherNotes surefire:test` antes da correção | FAIL esperado: campo ignorado | `.factory-results/FEAT-013-before.log` |
| `mvn.cmd compiler:compile compiler:testCompile -Dtest=NoteWorkflowIntegrationTest surefire:test` | 6/6 PASS | `.factory-results/FEAT-013-backend-focused.log` |
| `npm --prefix frontend run test:targeted` (QUALITY_TARGET_SPECS = note-presentation, notebook, note-editing e media-map-sync component.spec.ts) | 25/25 PASS | `.factory-results/FEAT-013-focused.log` |
| `npm --prefix frontend run typecheck` e `npm --prefix frontend run audit:accessibility` | PASS | `FEAT-013-typecheck.log`, `FEAT-013-accessibility.log` em `.factory-results/` |
| `npm --prefix frontend run e2e:ci -- --grep FEAT-013` | Final 1/1 PASS; repetição após ajuste móvel 1/1 PASS | `.factory-results/FEAT-013-focused-e2e.log`, `FEAT-013-review-e2e.log` |
| `node tools/run-quality-gate.mjs ticket AUTO` | STANDARD PASS | `.factory-results/FEAT-013-ticket.log`, `FEAT-013-ticket.json`, `2026-10-28T18-12-06.275Z-ticket-standard/` |
| `mvn.cmd resources:resources compiler:compile` | PASS; recursos repostos após clean do gate | `.factory-results/FEAT-013-main-resources.log` |
| Revisão técnica/visual do âmbito e `git diff --check -- <ficheiros alterados>` | APPROVE; sem achados bloqueantes | `.factory-results/FEAT-013-qa-review.md` |

Ambiente: Windows, Node 22, Maven/Java compatível com Java 8, Chrome Headless; E2E em 18765/18766. Gate com `FACTORY_RISK=medium`; `FACTORY_MAVEN_TESTS=NoteWorkflowIntegrationTest,NotebookPreferencesIntegrationTest,GpsMapIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest`; `QUALITY_TARGET_SPECS` seleciona os quatro specs acima e `auth.guard.spec.ts`. Sem FACTORY_TICKET_ID (feature, não ticket de auditoria).

Bundle inicial final: 476,01 kB, abaixo do aviso de 500 kB. O build final contém o ajuste móvel; o E2E inicial do gate usava a compilação anterior, pelo que foi repetido o cenário afetado depois da estabilização, incluindo a asserção de largura do formulário e inspeção da imagem atualizada. Restantes resultados válidos reutilizados conforme AGENTS.md.

- 2026-10-28: IN_REVIEW — 7/7 critérios verificados; QA e revisão APPROVE, aguardando aprovação do utilizador. Sem push, merge ou deploy.
