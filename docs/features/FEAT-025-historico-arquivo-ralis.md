# FEAT-025 — Histórico, arquivo e persistência da leitura

- **Estado:** COMPLETED
- **Roadmap:** UAC-P08
- **Perfil:** STANDARD, com testes direcionados de autorização, concorrência e persistência.

## Objetivo e requisitos

Disponibilizar histórico de ralis concluídos ou arquivados, próprios e partilhados, e preservar a leitura autorizada e o PDF publicado ao concluir, arquivar, restaurar ou reabrir. O arquivo é reversível, bloqueia alterações ao conteúdo e novas escritas por sincronização, e é independente de concessões, retenção e eliminação. D07 aprovada em 2026-11-10 para arquivo de ralis apenas, com estado anterior preservado e gestão reservada ao proprietário.

## Critérios de aceitação

1. **P08-AC1.** Dado um rali com leitor e caderno publicado, quando o proprietário conclui, arquiva, restaura e reabre, a concessão READ e o PDF continuam acessíveis. O arquivo repetido é idempotente; a restauração mantém o estado de trabalho anterior.
2. **P08-AC2.** Dado o histórico próprio e partilhado, quando o utilizador filtra por origem ou estado, vê apenas ralis autorizados, com origem, estado e destino corretos. Uma falha parcial permite ver a outra origem e repetir o carregamento.
3. **P08-AC3.** Dado um grant revogado ou recurso já eliminado, quando o leitor usa um link do histórico ou tenta imprimir, o servidor verifica o acesso atual e nega o recurso.
4. **P08-AC4.** Dado um rali arquivado, quando o proprietário tenta editar ou sincronizar, o servidor recusa novas escritas e a aplicação conserva os dados locais pendentes. Leitores e terceiros não arquivam nem restauram. A restauração devolve as capacidades do estado anterior.

## Dependências, decisões e riscos

P04 fornece concessões exatas por rali, rotas READ e caderno publicado. P06 fornece revogação e P07 está concluída com áreas e seleção de tripulação. A operação exige propriedade demonstrada pelo contexto da tripulação, incluindo legados migrados com proprietário. Os ralis anteriores sem arquivo conservam o comportamento atual. O histórico vai reutilizar as listas autorizadas. Uma marca de arquivo nullable e independente de DRAFT/COMPLETED permite preservar o estado. É necessário impedir corridas entre arquivo e escritas, bem como o envio de media numa sincronização retomada.

O arquivo de tripulações, políticas de retenção e os destinos offline multi-tripulação ficam fora desta fase.

## Implementação

- **Backend:** `RallyController`, `RallyEntity` e `RallyWriteGuard` guardam `archivedAt` num campo nullable e expõem operações idempotentes de arquivo/restauração. A capacidade é validada pelo proprietário da tripulação. A alteração de estado e as escritas de conteúdo serializam na mesma linha do rali.
- **Fronteiras:** `PecService`, `PecAssetService`, `NoteExcelParserService`, `RecceBookCoverController`, `BookPublicationService` e `OfflineRecceSyncService` verificam o arquivo antes de gravar. O replay de um recibo de sincronização fica suspenso enquanto o destino estiver arquivado. As operações de concessão continuam a usar o seu próprio estado.
- **Angular:** Histórico em `rally-history.component.ts` e atalhos de navegação. Listas, detalhe, Studio, caderno e sincronização apresentam capacidades e estados através dos dados do servidor. O histórico combina as duas listas autorizadas, com carregamento e recuperação separados, e liga aos URLs já protegidos.
- **Compatibilidade:** o histórico considera o rali arquivado antes do seu estado de trabalho. A estatística de eventos ativos exclui arquivados. Os ralis existentes começam com `archivedAt` nulo. Em ambientes que gerem o esquema externamente, a coluna nullable deve ser provisionada antes da aplicação.

Para a operação reversível, a implementação reutiliza a sessão ativa e acrescenta confirmação contextual. A proposta de reautenticação das operações destrutivas fica associada à transferência e à eliminação.

## Testes e revisão

| Critério | Verificação | Resultado |
| --- | --- | --- |
| AC1 | Integração HTTP/JPA e E2E de ciclo de estado com leitor e PDF | PASS |
| AC2 | E2E e testes de filtros, acesso e estados de carregamento | PASS |
| AC3 | Tentativas de abrir links e PDF após revogação ou eliminação em base isolada | PASS |
| AC4 | Escritas forçadas, sincronização, isolamento e ordenação concorrente | PASS |

### Evidência inicial

- `npm --prefix frontend run test:targeted` com os specs de gestão de ralis, sincronização offline e auth guard. **58/58**, incluindo conservação de áudio e metadados quando o arquivo ocorre entre o envio das notas e do áudio. Log `.factory-results/FEAT-025-angular-focused.log`.
- `mvn compiler:compile compiler:testCompile -Dtest=SharedRallyIntegrationTest,CrewIsolationIntegrationTest,NoteWorkflowIntegrationTest,GpsTimelineTest,PecAssetServiceXmlSecurityAuditTest surefire:test`. **37/38**, incluindo os testes da P08. Um erro da auditoria XML deveu-se à restrição de localhost e será repetido no gate local. Log `.factory-results/FEAT-025-backend-focused.log`.
- O primeiro E2E chegou à recuperação após falha parcial e bloqueou num seletor do teste. Foi ajustado para procurar o controlo pelo papel e nome acessíveis. Log `.factory-results/FEAT-025-e2e-focused.log`.
- `npm --prefix frontend run e2e:ci -- rally-history.spec.ts`. **1/1** após o ajuste. Inclui filtros, recuperação de uma origem em falha, consulta a 360 px por teclado, três páginas imprimíveis com a nota publicada, restauro e revogação. Log `.factory-results/FEAT-025-e2e-recheck.log` e captura `.factory-results/FEAT-025-history-mobile.png`.
- `node tools/run-quality-gate.mjs ticket AUTO`, com `FACTORY_RISK=high`. STANDARD. Configuração, lint, tipos, Java **56/56** e Angular direcionado **93/93** passaram. A auditoria XML passou com localhost disponível. Log `.factory-results/FEAT-025-ticket.log`.
- A integração Angular do mesmo gate passou **206/206**. Os três testes do runner E2E passaram. O Playwright executou **31/39** com sucesso, incluindo P08, e atingiu o limite global de 300 s. O wrapper registou FAIL. Relatório `.factory-results/FEAT-025-ticket.json`.
- `npm --prefix frontend run e2e:ci -- team-dashboard.spec.ts workflow-tours.spec.ts`. **8/8**. Ao combinar as execuções, passaram os 39 cenários distintos. Log `.factory-results/FEAT-025-e2e-complement.log`.
- `npm --prefix frontend run build`. PASS com aviso de 502,92 kB face ao orçamento inicial de 500 kB. O histórico foi adaptado para usar as diretivas de listas já presentes na aplicação. Log do primeiro build `.factory-results/FEAT-025-build.log`.
- Build após o ajuste de template **PASS**, 497,75 kB no bundle inicial. Log `.factory-results/FEAT-025-build-final.log`.
- `npm --prefix frontend run e2e:ci -- rally-history.spec.ts lazy-loading.spec.ts`. **2/2** após o ajuste de template. Log `.factory-results/FEAT-025-template-recheck.log`.

### Revisão

**Veredicto:** APPROVE WITH NOTES. Sem findings bloqueantes. O limite do runner foi tratado com execução complementar e a validação de produção permanece separada.

- A marca de arquivo é de leitura no DTO do rali. Os endpoints dedicados obtêm o rali pelo contexto autorizado e confirmam a propriedade antes da transição.
- As escritas verificam o estado persistido sob o mesmo bloqueio que o arquivo. A leitura de rali, media e publicação continua subordinada ao grant exato. Um rali irmão não entra no âmbito, e as escritas de um leitor continuam a ser recusadas.
- O histórico usa URLs autorizados e origens independentes. A captura a 360 px foi inspecionada e o percurso por teclado foi verificado no Playwright.
- A validação de persistência e concorrência foi executada em H2. A aplicação da coluna e o comportamento de bloqueio na base de dados de produção não foram ensaiados nesta fase.

## Gates independentes

- **TICKET_GATE:** PASS no âmbito da P08 após a execução complementar e a repetição dos checks do template final. O wrapper automático conserva o FAIL pelo limite de 300 s.
- **RELEASE_GATE:** BLOCKED pela falha conhecida [AUD-SEC-005](../ai/QUALITY_BASELINE.md). Execução do gate global nesta fase: NOT_RUN.

## Histórico

- 2026-11-10 — PLANNED. Dependências e D07 confirmadas.

- 2026-11-10 — IN_PROGRESS. Implementação iniciada.
- 2026-11-10 — IN_REVIEW. Percurso de arquivo, leitura e impressão validado no navegador. Gate STANDARD em execução.
- 2026-11-10 — IN_REVIEW. Gate automático interrompido pelo limite global do Playwright. Validação complementar em curso.
- 2026-11-10 — COMPLETED. Regressão E2E concluída em duas execuções, build final abaixo do orçamento e revalidação do histórico aprovada.
