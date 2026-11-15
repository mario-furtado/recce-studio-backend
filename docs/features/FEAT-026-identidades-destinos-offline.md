# FEAT-026 — Identidades e destinos offline

- **Estado:** COMPLETED
- **Roadmap:** UAC-P09
- **Perfil:** STANDARD com verificações dirigidas de isolamento, persistência e retoma.

## Objetivo e dependências

P01 fornece identidade de conta, P02 seleção de tripulação e P03 o contexto migrado. P08 protege ralis arquivados. A P09 liga uma captura à identidade estável e ao contexto que a criou, fixa o destino antes do primeiro envio e revalida o recibo e o áudio. D10 condiciona qualquer adoção. Registos locais sem prova de titularidade serão preservados em quarentena; sessões anónimas novas continuam disponíveis apenas no modo offline explícito.

## Critérios de aceitação

1. Uma sessão de A e o respetivo áudio só ficam acessíveis à conta titular no contexto de A. Mudar de email na mesma conta conserva acesso. Trocar de conta ou tripulação não altera a captura.
2. Depois de fixado o destino, repetir com outra PEC ou tripulação não devolve o recibo nem cria outra PEC. Repetições autorizadas usam o mesmo recibo. O servidor volta a verificar o destino existente e o estado do rali.
3. Falha, reinício ou troca de sessão entre notas e áudio preserva a gravação. O áudio usa o recibo autorizado e a limpeza local ocorre após conclusão.
4. A atualização preserva sessões legadas e Blobs, sem atribuição ao próximo login. Adoção assistida fica condicionada a D10.

## Validação

| Critério | Evidência | Resultado |
| --- | --- | --- |
| AC1 | IndexedDB real com contas e tripulações diferentes e mudança de email. Troca de A para B no navegador. | PASS |
| AC2 | Integração HTTP/JPA de repetição, isolamento, concorrência e recibo ultrapassado | PASS |
| AC3 | Retoma, áudio, transações e percurso no navegador | PASS |
| AC4 | Abertura de IndexedDB legado com verificação dos registos e dos bytes originais | PASS |

## Implementação

- O login fornece o identificador estável da conta. A captura associa-o à tripulação selecionada ou à área de trabalho legada. O IndexedDB abre a versão 2 sem alterar dados legados, e grava sessão e áudio na mesma transação.
- Lista offline, reconhecimento e Studio usam o mesmo protocolo. A transação local fixa o destino antes do envio e guarda o ID do recibo. O upload usa o recibo e a mesma conta e tripulação. Sem Web Locks, a atualização de estado é atómica e a tentativa tem um prazo de recuperação.
- A API valida conta e tripulação do pedido, bloqueia a linha da conta durante a criação/repetição e revalida a sessão e o estado do destino. Clientes antigos continuam no contexto legado. Um recibo antigo sem destino original persistido só é recuperado pela PEC exata e pela conta identificada no recibo legado. Um recibo ultrapassado por outro reconhecimento na mesma PEC não pode substituir o áudio. O upload repete com o mesmo resultado e preserva o ficheiro anterior se a transação reverter.
- Capturas anónimas continuam acessíveis apenas no modo offline explícito deste dispositivo. A recuperação assistida de capturas sem identidade verificável continua dependente da D10. Uma sessão de autenticação iniciada com uma versão anterior pode precisar de novo login para receber a identidade estável.
- A validação utiliza H2 e armazenamento de ficheiros local. A aplicação das colunas nullable e o comportamento em PostgreSQL/S3 ficam por verificar num ambiente representativo. O isolamento local aplica-se aos fluxos da aplicação no mesmo perfil do navegador.

### Evidência inicial

- `mvn compiler:compile compiler:testCompile -Dtest=CrewIsolationIntegrationTest,TenantIsolationAuditTest,LegacyCrewMigrationIntegrationTest,SharedRallyIntegrationTest,GpsMapIntegrationTest surefire:test` passou **47/47** na primeira versão do protocolo. Log `.factory-results/FEAT-026-backend-focused.log`.
- `npm --prefix frontend run test:targeted` passou **83/83** na repetição focada, incluindo IndexedDB versão 1, Blobs e isolamento de contexto. A primeira execução detetou uma leitura do Studio após troca de conta, entretanto corrigida. Logs `.factory-results/FEAT-026-angular-focused.log` e `.factory-results/FEAT-026-angular-recheck.log`.
- O primeiro E2E passou os dois casos de navegação offline e parou num seletor com capitalização diferente no percurso de gravação. A repetição usa os nomes acessíveis do ecrã. Log `.factory-results/FEAT-026-e2e-focused.log`.
- O segundo ensaio mostrou que terminar imediatamente podia produzir uma captura sem áudio no dispositivo simulado. O E2E final espera um evento de áudio não vazio do Chromium. `npm --prefix frontend run e2e:ci -- crew-context.spec.ts` passou **1/1**, com falha induzida no primeiro upload, isolamento em B, retoma em A, recibo reutilizado e uma única PEC no servidor. Logs `.factory-results/FEAT-026-e2e-recheck.log` e `.factory-results/FEAT-026-e2e-audio.log`.
- `node tools/run-quality-gate.mjs ticket AUTO` com `FACTORY_RISK=high`. Configuração, lint, tipos, Java **56/56**, Angular direcionado **120/120** e integração Angular **208/208** passaram. Log `.factory-results/FEAT-026-ticket.log`.
- Reexecução Java após rever a fase de áudio e os recibos ultrapassados. **49/49** em `CrewIsolationIntegrationTest,TenantIsolationAuditTest,LegacyCrewMigrationIntegrationTest,SharedRallyIntegrationTest,GpsMapIntegrationTest`. Log `.factory-results/FEAT-026-backend-recheck.log`.
- O spec de armazenamento e sincronização offline passou **37/37** após reforçar a verificação entre duas instâncias sem Web Locks. Log `.factory-results/FEAT-026-store-final.log`.
- O runner E2E aprovou **28/39** e atingiu o limite global de 300 segundos. O relatório automático conserva FAIL com 11 cenários por executar. Relatório `.factory-results/FEAT-026-ticket.json`.
- `npm --prefix frontend run e2e:ci -- crew-context.spec.ts offline-navigation.spec.ts studio-note-editing.spec.ts studio-panels.spec.ts studio-redesign.spec.ts team-dashboard.spec.ts workflow-tours.spec.ts` passou **14/14**, incluindo os 11 cenários em falta e a repetição dos três fluxos offline. Total de **39 cenários distintos** aprovados. Log `.factory-results/FEAT-026-e2e-complement.log`.
- `npm --prefix frontend run build` passou com **499,91 kB** no bundle inicial. Log `.factory-results/FEAT-026-build.log`.

### Revisão

**Veredicto:** APPROVE WITH NOTES. Os critérios de aceitação foram verificados com os checks complementares. A validação em PostgreSQL/S3 e a adoção de capturas sem titular verificável permanecem pendentes.

- O servidor deriva a autorização da sessão e do contexto autorizado. Campos enviados pelo cliente confirmam a vinculação esperada. Recibos e uploads recusam perda de acesso, alterações de destino, recursos arquivados, concluídos ou eliminados e recibos ultrapassados.
- A gravação local permanece com o titular original após falhas de upload, transações abortadas ou troca de conta. A gravação e o Blob são inseridos ou removidos atomicamente.
- A captura autenticada exige que a tripulação já esteja escolhida. Sem uma PEC conhecida, a escolha do destino é feita na sincronização, dentro dessa tripulação.

## Gates

- **TICKET_GATE:** PASS no âmbito da P09. O wrapper automático conserva o FAIL pelo limite global do Playwright.
- **RELEASE_GATE:** BLOCKED pela falha conhecida [AUD-SEC-005](../ai/QUALITY_BASELINE.md). Gate global nesta fase: NOT_RUN.

## Histórico

- 2026-11-11 — PLANNED.

- 2026-11-11 — IN_PROGRESS.
- 2026-11-11 — IN_REVIEW. Captura e retoma verificadas no navegador. Gate STANDARD em execução.
- 2026-11-11 — IN_REVIEW. Gate automático interrompido pelo limite global do Playwright. Verificações complementares em execução.
- 2026-11-11 — COMPLETED. Regressões complementares e build passaram.
