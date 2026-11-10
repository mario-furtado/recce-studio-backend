# FEAT-019 — Tripulações, propriedade e contexto autorizado

- **Descrição:** implementação exclusiva de UAC-P02 de `docs/product/USERS_ACCESS_TO_BE.md`.
- **Estado:** IN_REVIEW — implementação, QA e revisão concluídas; pronta para aprovação.
- **Perfil:** STANDARD, risco alto de autorização/persistência, com testes rigorosos da fronteira afetada. Sem DEEP global.
- **Data:** 2026-11-02.

## Objetivo, dependências e decisões

Uma conta ativa cria/controla várias tripulações. O criador é proprietário por ID imutável de conta, sem convite e sem privilégios atribuídos por nomes de piloto/navegador. Cada recurso mantém contexto estável e autorização no servidor.

UAC-P01/FEAT-018 existente é reutilizada; regressões de contas e sessões foram reexecutadas. **D11 foi aprovada explicitamente pelo utilizador:** viaturas, imagens e sistema base próprios por nova tripulação, sem partilha/cópia automática. O legado fica intacto; migração pertence a P03. Modelos, capa principal e regras pessoais continuam pessoais.

Inclui criação/listagem/seleção de novas crews, propriedade persistida, contexto central autorizado e utilização dos recursos existentes nesse contexto. Não implementa migração do legado, convites, leitores/READ, arquivo, transferência, monetização ou migração offline. O novo percurso fica sob `RECCE_CREWS_ENABLED=false` por omissão, como previsto no roadmap até compatibilidade P03/P09. Sem restart/migração da beta nesta fase.

## Análise e reprodução

Antes de implementar, leitura dos módulos confirmou que ApiAuthInterceptor retirava um único teamProfileId da conta e TenantContext o propagava para filtros de serviço/repositório. Não existiam propriedade multi-tripulação nem seleção autorizada. A especificação foi criada antes de código; ID019 reservado por criação exclusiva. D11 bloqueou apenas o trabalho dependente até à aprovação explícita.

Fronteiras mapeadas: bearer→conta ativa→propriedade persistida→contexto por pedido→consulta/mutação; relações rali/PEC/nota/viatura; ficheiros e estatísticas; UI com respostas tardias/troca de sessão; configurações pessoais e IndexedDB sem dimensão de crew. Não se alterou a beta para reproduzir a ausência da funcionalidade.

## Requisitos e solução

1. Tabela crews com proprietário imutável, chave de criação por conta e ID igual ao perfil novo reutilizado pelos filtros existentes. Perfil e crew criados na mesma transação; bloqueio da conta e unicidade owner/chave protegem concorrência/retry. Não se criam pessoas, viaturas ou fotografias fictícias.
2. API `/api/crews` lista só próprias crews e aceita na criação apenas nome, mais Idempotency-Key. Mesmo pedido/nome devolve a mesma crew; chave com outro nome devolve409; body de owner forjado é recusado.
3. `X-Crew-Id` seleciona contexto, sem conceder acesso. Servidor verifica sessão, proprietário e perfil gerido; contexto estranho/desconhecido404 uniforme, vazio/múltiplo400. Sem header mantém-se apenas o vínculo legado já existente; nova conta sem equipa nunca cai em default.
4. ApiAuthInterceptor usa o HandlerMethod realmente mapeado pelo Spring para reconhecer gestão de crews e bloqueio offline, evitando diferenças entre URL bruto e matrix parameters. `/auth/me` continua a devolver apenas a identidade própria.
5. Ralis/PECs/media/garagem/capas usam os filtros existentes. Notas PATCH/align passam a consultar ID+PEC e devolver404 uniforme para nota ausente/de outra PEC. A listagem filtrada de PECs preserva o contrato existente200[] para pai estrangeiro/inexistente, sem revelar conteúdo.
6. UI na página A minha conta: criar/abrir/sair, estado vazio/carregamento/erro/retry e contexto visível no workspace. Troca com recarregamento integral descarta caches/respostas antigas; guardas de saída existentes continuam a proteger rascunhos. Seleção por aba, vinculada à sessão; login/logout/offline limpam-na. Seleção antiga bloqueia pedidos de workspace, sem fallback silencioso.
7. Formulário vinculado à sessão de montagem: não publica pedidos nem aceita respostas tardias de outra sessão. Criação espera pela listagem válida; retry reutiliza chave para o mesmo nome normalizado, inclusive após espaços corrigidos.
8. Captura/rotas e sincronização offline de crews novas bloqueadas até P09. Sem adoção ou reatribuição de sessões antigas. Respostas de contexto novo no-store e erros de persistência na autorização sanitizados.

## Critérios de aceitação e resultados

| Critério | Verificação executada | Resultado |
| --- | --- | --- |
| AC1 / P02-AC1: conta sem crew cria duas e um rali em cada; é dona de ambas, sem convite e com listagens isoladas | CrewIsolationIntegrationTest.accountOwnsTwoIndependentContextsWithoutInviteOrFictionalResources; E2E crew-context | PASS |
| AC2 / P02-AC2: nome/email em piloto/copiloto não concede grants | sportingNamesAndSpoofedOwnershipNeverGrantAccess, body owner forjado e terceiro sem crew | PASS |
| AC3 / P02-AC3: header/body/seletor/IDs estrangeiros não revelam/mudam recursos, contagens ou ficheiros | foreignOrUnknownHeadersNeverFallbackAndMultipleHeadersAreRejected; countsStayInTheCrewButDictionaryRulesStayPersonal; matriz REST e E2E | PASS |
| AC4: pai A/filho B, nota de outra PEC ou viatura de B são recusados sem alterar vínculos | ownedCrewsStillCannotMixParentsChildrenNotesOrFiles; carsImagesAndBaseSystemBelongToTheSelectedCrew; notas/media existentes e foto real de fixture | PASS |
| AC5: retry/concorrência/respostas tardias/troca de sessão não duplicam nem mudam contexto | concurrentCreationAndRetriesAreAtomicAndKeysAreAccountBound; testes Angular de contexto/formulário; E2E reautenticação noutra sessão | PASS — incluindo cinco testes finais e dois E2E reexecutados após a última alteração |
| AC6: flag off ou sessão inválida/inativa falham de forma segura; percursos legados continuam | CrewFeatureDisabledIntegrationTest; invalidSessionsCannotUseCrewContextAndLegacyFallbackIsPreserved; auth/tenant/E2E | PASS |
| AC7: recursos próprios D11, configurações pessoais e legado/offline preservados | isolamento de carros/foto/base; regras pessoais; perfil ausente falha fechado; offline normal e matrix URI403 sem PEC/recibo criado; suites anteriores | PASS |

## Casos limite e erros

Contexto ausente/desconhecido/estrangeiro, conta inativa/expirada/revogada, nome vazio/com controlos/>100, chave ausente/reutilizada/concorrente, campos de owner forjados, IDs pai/filho cruzados, carro/foto/media estrangeiros, perfil ausente, cliente antigo, seleção/sessão alterada noutra aba e respostas fora de ordem. Sem fallback de autorização por nome, header arbitrário ou equipa default.

## Ficheiros desta fase

Novos:

- `src/main/java/org/example/entity/CrewEntity.java`
- `src/main/java/org/example/repository/CrewRepository.java`
- `src/main/java/org/example/service/CrewService.java`
- `src/main/java/org/example/controller/CrewController.java`
- `frontend/src/app/modules/core/services/crew-context.ts` e `crew-context.spec.ts`
- `frontend/src/app/modules/core/components/account-access/crew-manager.component.ts` e `crew-manager.component.spec.ts`
- `frontend/e2e/crew-context.spec.ts`
- `src/test/java/org/example/security/CrewIsolationIntegrationTest.java` e `CrewFeatureDisabledIntegrationTest.java`
- `docs/crews.md` e este documento.

Adaptados nesta fase:

- `ApiAuthInterceptor.java`, `TenantContext.java`, `PersonalAccountController.java`: conta/contexto/flag e fronteiras centrais.
- `TeamProfileEntity.java`, `TeamProfileService.java`: marcador anulável de crew nova e ausência de viatura fictícia, preservando legado.
- `NoteRepository.java`, `NoteExcelParserService.java`: fronteira nota/PEC em update/align.
- `src/main/resources/application.properties`: apenas nova flag de crews, sem alterar credenciais/configuração anterior.
- Frontend `auth.service.ts`, `auth.interceptor.ts`, `auth.guard.ts`, `personal-account.component.ts`, Sidebar HTML/TS e `main-layout.component.ts`: seleção, sessão, navegação, identidade do contexto e menu móvel.
- `frontend/e2e/personal-account.spec.ts`: copy de conta quando crews estão disponíveis; restantes asserções de P01 preservadas.
- `ApiAuthInterceptorAuditTest.java`, `E2eServer.java`: teste de erro sanitizado e ativação da flag apenas no harness isolado.
- `docs/product/USERS_ACCESS_TO_BE.md`: D11 aprovada e estado P02.

Restantes alterações FEAT-018 pré-existentes no checkout preservadas; não são atribuídas a esta fase. Sem dependências novas.

## Comandos e evidência

Ambiente executado: Windows, Node22, Chrome Headless156, Java11 com source/target8 do projeto, HTTP/JPA/H2 e armazenamento local isolados. Não executado P02 na instância beta Java8. Sem FACTORY_TICKET_ID, porque FEAT019 não é ticket de auditoria canónico.

```powershell
$env:FACTORY_RISK='high'
$env:FACTORY_MAVEN_TESTS='CrewIsolationIntegrationTest,CrewFeatureDisabledIntegrationTest,PersonalAccountIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest,NoteWorkflowIntegrationTest,RecceBookCoverIntegrationTest,NotebookPreferencesIntegrationTest,AuthTokenLifecycleAuditTest,AuthTokenSchemaUpgradeAuditTest,AuthTokenSettingsAuditTest,GpsMapIntegrationTest,TestUserBootstrapPersistenceAuditTest'
$env:QUALITY_TARGET_SPECS='src/app/modules/core/services/crew-context.spec.ts,src/app/modules/core/components/account-access/crew-manager.component.spec.ts,src/app/modules/core/components/account-access/account-access.component.spec.ts,src/app/modules/core/services/auth.service.spec.ts,src/app/modules/core/interceptors/auth.interceptor.spec.ts,src/app/modules/core/guards/auth.guard.spec.ts,src/app/modules/core/components/login/login.component.spec.ts,src/app/modules/core/shared/components/sidebar/sidebar.component.spec.ts'
node tools/run-quality-gate.mjs ticket AUTO
mvn.cmd compiler:compile compiler:testCompile "-Dtest=$env:FACTORY_MAVEN_TESTS" surefire:test
npm --prefix frontend run quality:standard
npm --prefix frontend run quality:fast
npm --prefix frontend run test:integration
npm --prefix frontend run audit:accessibility
mvn.cmd resources:resources
```

- Wrapper selecionou STANDARD: configuração, backend77/77, lint/typecheck, targeted74/74 e componentes201/201 PASS. E2E inicial falhou por sobreposição introduzida no menu móvel:25 passaram,1 falhou,7 não correram ao atingir limite global300s. Não foi classificada como baseline nem ocultada; relatório inicial FEAT-019-ticket.json/log preservado como FAIL anterior às correções.
- Correção de menu: sete acessos legados mantidos numa linha móvel com alvos mínimos44px e scroll quando necessário; identificação da crew movida para o conteúdo em vez de ocupar célula do menu. Sem alterar timeouts, asserts ou desativar cenários.
- QA adversarial reproduziu bypass por `/api/offline-recces;v=1/sync`: teste esperado403, observado200. FEAT-019-matrix-before.log. Correção usa HandlerMethod; backend final77/77 PASS,0 falhas/erros/skips, incluindo matrix URI, isolamento, persistência e regressões. FEAT-019-backend-final.log.
- Após correções, `quality:standard` do frontend PASS: targeted74/74, componentes201/201, runner3/3, **33/33 E2E**, build492.08kB abaixo de500kB. FEAT-019-frontend-final.log. O E2E novo inclui semicolon URI e mudança de sessão seguida de reseleção.
- Revisão subsequente do estado do formulário: `quality:fast`75/75 e componentes202/202 PASS; acessibilidade estática PASS; recursos Maven recompostos, sem restart. FEAT-019-frontend-reviewed-fast.log, FEAT-019-components-final.log, FEAT-019-accessibility.log, FEAT-019-resources.log. Última proteção de formulário de outra sessão: cinco testes5/5 PASS, typecheck e build492.08kB PASS; FEAT-019-last-manager.log, FEAT-019-last-typecheck.log e FEAT-019-last-build.log. Após essa alteração, E2E de conta e crews2/2 PASS em FEAT-019-final-account-e2e.log; restantes percursos sem código relevante alterado reutilizados do full33.
- Verificação visual real: FEAT-019-crews-desktop.png e FEAT-019-crews-mobile.png, capturadas e inspecionadas; segunda passagem corrigiu o footer móvel e mensagem contraditória da conta. Estado final móvel sem overflow horizontal, contexto visível, navegação/ações preservadas.
- Fecho documental: `node tools/validate-factory.mjs`, `node tools/compare-quality-baseline.mjs --validate` e `git diff --check` PASS. Logs FEAT-019-factory-final.log, FEAT-019-baseline-validate.log e FEAT-019-diff-check.log. Validação da baseline confirma formato, não aprovação de release nem reexecução da falha conhecida.
- Falhas iniciais de fixtures (nome de campo da nota e campos obrigatórios de rali) corrigidas sem alterar contratos de produto ou enfraquecer asserções. Logs FEAT-019-backend-initial.log/focused*.log preservados.

## QA e revisão

factory-qa: dois proprietários, terceiro sem acesso, conta sem equipa, flag off/inatividade, spoofing de header/body/IDs, nota de outra PEC, media/foto existentes, estatísticas, configurações pessoais, concorrência/retry, sessão trocada, URLs normalizadas pelo Spring e regressões de P01/legado/offline. factory-review: inspeção do diff e fluxos de autorização/persistência/erros/cache/estado de UI, com correção dos findings descritos. **Veredicto APPROVE WITH NOTES**, sem findings bloqueantes no diff final. Todos os critérios obrigatórios verificados; detalhes em `.factory-results/FEAT-019-qa-review.md`.

## Limitações e gates independentes

- TestUserBootstrapAuditTest tem falha anterior de defaults seguros, já observada na FEAT018 e registada na baseline. Configuração/asserções inalteradas; não se voltou a investigar/reexecutar essa falha nem se alteraram credenciais para a esconder. Continua bloqueante para release.
- Sem release completo, migração beta/PostgreSQL, S3, carga elevada, múltiplos processos ou leitor de ecrã real. Simulador de email no harness, sem SMTP real. Implementação compilada para8 mas ensaio novo executado em Java11.
- Rollout novo desativado por omissão até compatibilidade P03/P09; gestão offline multi-crew não entregue antecipadamente. Instruções em `docs/crews.md`.
- **TICKET_GATE: PASS / APPROVED**, avaliação final dos checks STANDARD e reexecuções afetadas após correções. Wrapper inicial **FAIL** preservado em FEAT-019-ticket.json/log; não se alterou o relatório original nem se fingiu outro run do wrapper. Backend final77, frontend STANDARD com E2E33, revalidação do formulário5/5 e browser2/2 aprovados; sem regressões introduzidas pendentes.
- **RELEASE_GATE: BLOCKED** pelo bloqueio conhecido de defaults seguros; release completo não executado nesta fase e não se infere aprovação global.

## Histórico

- 2026-11-02: PLANNED — documento e critérios criados antes de código com ID019 exclusivo; dependência D11 identificada.
- 2026-11-02: BLOCKED — D11 solicitada; apenas análise e validação documental, sem aprovação inferida.
- 2026-11-02: IN_PROGRESS — utilizador aprovou recursos próprios por nova tripulação; implementação limitada a P02, preservando legado e dados existentes.
- 2026-11-02: QA/revisão e gate STANDARD: fronteira nota/PEC, bypass matrix URL e menu móvel reproduzidos/corrigidos; backend77/77 e E2E33/33 finais PASS. Proteções adicionais de estado/sessão em revalidação.

- 2026-11-02: IN_REVIEW — validação/revisão concluídas: backend77/77, E2E33/33 e revalidação final2/2, Angular75/75 e202/202 mais cinco testes finais do formulário, build/typecheck/acessibilidade PASS. TICKET_GATE PASS; RELEASE_GATE BLOCKED por falha anterior independente. Sem outras fases, ativação beta, push, merge ou deploy.
