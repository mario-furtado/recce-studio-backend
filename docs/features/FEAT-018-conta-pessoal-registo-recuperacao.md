# FEAT-018 — Conta pessoal, registo verificado e recuperação

- **Descrição:** implementar apenas UAC-P01 de `docs/product/USERS_ACCESS_TO_BE.md`.
- **Estado:** IN_REVIEW — implementação, QA e revisão concluídas; pronta para apreciação do utilizador.
- **Perfil:** STANDARD, com testes rigorosos de autenticação, privacidade e persistência; sem DEEP global.
- **Data:** 2026-11-02.

## Objetivo e âmbito

Permitir uma identidade pessoal sem equipa obrigatória, com registo por email, verificação, login e recuperação de password. O comportamento anterior foi localizado no código: registo HTTP proibido, serviço interno criava equipa e autenticação exigia vínculo de equipa. Não se criou uma conta nem se alterou a beta para reproduzir esse estado.

Inclui UI de acesso e destino `/account`, compatibilidade das contas legadas e proteção dos recursos existentes. Não inclui P02, criação de tripulações, convites, novas permissões, arquivo, monetização ou migração offline. Novas contas não recebem equipa, carros ou acesso a ralis alheios.

## Requisitos e decisões aprovadas

O utilizador aprovou explicitamente D12 para esta fase: email verificado antes do primeiro login novo; passwords de 12–128 caracteres; uma sessão por conta, duração predefinida de 8h; recuperação revoga sessão; provas de verificação 24h e recuperação 30min; 5 pedidos por email/IP em 15min. Aprovou SMTP por ambiente, sem emails reais e fluxos públicos desativados até configuração. Isto não aprova outras decisões do roadmap.

1. Registo começa apenas com email; a password é definida com prova válida. Evita pré-registo de terceiros com password escolhida por atacante.
2. Respostas condicionais uniformes para contas existentes/inexistentes/inativas; quotas persistentes por operação e por email/IP remoto. Registo e reenvio partilham quota; login, confirmação e recuperação têm operações próprias. `X-Forwarded-For` arbitrário não altera a identidade do IP.
3. Provas aleatórias de 256 bits, finalidade/prazo/uso único; só o hash é persistido. Link em fragmento, removido pela UI; confirmação por POST, sem tokens em query, armazenamento local ou API pública.
4. Recuperação vinculada ao ID/versão da credencial; revoga sessão e provas anteriores. Coordenador de base e bloqueio de utilizador protegem concorrência. Limpeza oportunista remove apenas provas expiradas e janelas antigas.
5. Passwords novas usam formato versionado SHA-256+BCrypt, evitando o limite de 72 bytes. Hashes BCrypt legados permanecem legíveis. Login não corta espaços nem aplica retroativamente uma política de criação.
6. Contas legadas preservam ID, equipa, credenciais e dados. `emailVerified` nulo significa legado, sem afirmar verificação. Flag false impede autenticação.
7. Identidade pessoal verificada pode consultar a própria conta; API de equipa/media continua a exigir equipa autorizada. Flags locais controlam navegação, nunca permissões.
8. Transporte exige configuração explícita, HTTPS público e SMTP com TLS/SSL fora de loopback. Falha de envio invalida a prova, sem anunciar entrega confirmada nem expor erro do fornecedor. Sem fallback com tokens públicos.

## Critérios de aceitação

1. **AC1:** Given email novo, When pede registo e confirma prova válida, Then existe conta autenticável com ID estável, sem criar equipa/carros/ralis, e a própria identidade pode ser consultada.
2. **AC2:** Given conta não verificada ou prova inválida/expirada/usada/de outra finalidade, When tenta autenticar/confirmar, Then não obtém sessão nem altera credenciais indevidamente.
3. **AC3:** Given recuperação válida, When confirma nova password, Then revoga sessão anterior e provas anteriores; pedidos concorrentes só conseguem uma alteração.
4. **AC4:** Given endereços existentes/inexistentes/inativos e pedidos repetidos, When pede registo/reenvio/reset/login, Then não enumera contas, aplica limites aprovados e não sobrescreve contas por terceiros.
5. **AC5:** Given conta legada ou conta pessoal nova, When entra/valida/sai/acede a recursos, Then preserva dados legados e isolamento de equipa/media; nova conta não herda acesso de equipa.
6. **AC6:** Given UI de acesso, When percorre registo/verificação/login/recuperação e erros, Then consegue corrigir/concluir sem expor provas nem navegar para espaço de equipa inexistente; desktop e móvel mantêm interface utilizável.
7. **AC7:** Given configuração ausente ou falha de envio, When pede fluxo público, Then falha de forma segura ou responde condicionalmente sem confirmar entrega, sem prova utilizável não enviada; repetição respeita limites.

## Casos limite, dependências e riscos

Email normalizado, mailbox única sem CRLF/lista/display name; campos extra e ownership forjado; passwords Unicode, 12/128/129 caracteres, diferenças após byte72 e espaços; expiração no instante limite; replay e finalidade trocada; reset emitido antes de a conta existir; contas inativas/legadas; falhas SMTP/DB; quota e concorrência. Dependência nova: starter-mail gerido pelo Spring Boot. Backend Spring/Maven na raiz e frontend Angular em `frontend/`.

UI reutiliza os estilos dark/red, formulários com labels, estados de carregamento/erro, links de retorno e menu existente. Conta sem equipa tem destino explícito, sem duplicar Logout. Não reiniciar a beta nem executar migrações reais nesta tarefa.

## Ficheiros alterados

- `docs/ai/QUALITY_BASELINE.md`
- `docs/features/FEAT-018-conta-pessoal-registo-recuperacao.md`
- `docs/personal-accounts.md`
- `docs/product/USERS_ACCESS_TO_BE.md`
- `frontend/e2e/personal-account.spec.ts`
- `frontend/src/app/app.routes.ts`
- `frontend/src/app/modules/core/components/account-access/account-access.component.spec.ts`
- `frontend/src/app/modules/core/components/account-access/account-access.component.ts`
- `frontend/src/app/modules/core/components/account-access/personal-account.component.ts`
- `frontend/src/app/modules/core/components/login/login.component.html`
- `frontend/src/app/modules/core/components/login/login.component.spec.ts`
- `frontend/src/app/modules/core/components/login/login.component.ts`
- `frontend/src/app/modules/core/guards/auth.guard.spec.ts`
- `frontend/src/app/modules/core/guards/auth.guard.ts`
- `frontend/src/app/modules/core/interceptors/auth.interceptor.spec.ts`
- `frontend/src/app/modules/core/interceptors/auth.interceptor.ts`
- `frontend/src/app/modules/core/services/auth.service.ts`
- `frontend/src/app/modules/core/shared/components/sidebar/sidebar.component.html`
- `frontend/src/app/modules/core/shared/components/sidebar/sidebar.component.spec.ts`
- `frontend/src/app/modules/core/shared/components/sidebar/sidebar.component.ts`
- `frontend/src/index.html`
- `pom.xml`
- `src/main/java/org/example/controller/ApiExceptionHandler.java`
- `src/main/java/org/example/controller/AuthController.java`
- `src/main/java/org/example/controller/PersonalAccountController.java`
- `src/main/java/org/example/controller/SpaForwardController.java`
- `src/main/java/org/example/entity/AccountChallengeEntity.java`
- `src/main/java/org/example/entity/AccountRateLimitEntity.java`
- `src/main/java/org/example/entity/AuthUserEntity.java`
- `src/main/java/org/example/repository/AccountChallengeRepository.java`
- `src/main/java/org/example/repository/AccountRateLimitRepository.java`
- `src/main/java/org/example/repository/AuthUserRepository.java`
- `src/main/java/org/example/service/AccountFlowException.java`
- `src/main/java/org/example/service/AccountMailer.java`
- `src/main/java/org/example/service/AccountPasswords.java`
- `src/main/java/org/example/service/AccountRateLimiter.java`
- `src/main/java/org/example/service/AuthService.java`
- `src/main/java/org/example/service/PersonalAccountService.java`
- `src/main/java/org/example/service/SmtpAccountMailer.java`
- `src/main/resources/application.properties`
- `src/test/java/org/example/e2e/E2eServer.java`
- `src/test/java/org/example/security/AuthTokenLifecycleAuditTest.java`
- `src/test/java/org/example/security/PersonalAccountIntegrationTest.java`
- `src/test/java/org/example/service/SmtpAccountMailerTest.java`

## Validação por critério

| Critério | Provas executadas | Resultado |
| --- | --- | --- |
| AC1 | PersonalAccountIntegrationTest: criação sem equipa/carros, identidade própria, prazo8h; E2E pessoal | PASS |
| AC2 | finalidade, expiração/uso único, flag não verificada, password12/128/129/Unicode/espaços/byte72 | PASS |
| AC3 | reset/versão/sessão, replay, expiração, concorrência de duas provas | PASS |
| AC4 | respostas uniformes/inatividade, quotas email/IP/socket/login, janela e corpos inválidos | PASS |
| AC5 | testes pessoais, lifecycle/schema/settings, tenant/interceptor, persistência bootstrap e regressões E2E | PASS no âmbito; defaults bootstrap falham anteriormente |
| AC6 | Angular65/65, componentes198/198, E2E32/32 incluindo percurso pessoal; desktop1280 e móvel360 inspecionados | PASS |
| AC7 | configuração ausente/envio simulado falhado, SMTP simulator2/2 | PASS; sem entrega real |

Todos os sete critérios obrigatórios foram verificados nos ambientes isolados descritos. Nenhuma fase posterior foi implementada.

Correspondência com o roadmap: **P01-AC1 → AC1/AC5** (identidade sem equipa e compatibilidade); **P01-AC2 → AC2/AC3** (prova válida, recuperação e revogação); **P01-AC3 → AC4/AC7** (antienumeração, limites e falhas de envio). D12 e transporte não são dependências de produto pendentes: a política foi aprovada; configurar/validar SMTP real continua necessário antes da ativação pública.

## Comandos e resultados reais

Ambiente: Windows, Java8/Maven, Node22, Chrome Headless156, H2 isolado e emails simulados. Sem FACTORY_TICKET_ID (FEAT018 não é ticket canónico). Logs em `.factory-results/`.

```powershell
$env:FACTORY_RISK='high'
$env:FACTORY_MAVEN_TESTS='PersonalAccountIntegrationTest,SmtpAccountMailerTest,AuthTokenLifecycleAuditTest,AuthTokenSchemaUpgradeAuditTest,AuthTokenSettingsAuditTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest,TestUserBootstrapAuditTest,TestUserBootstrapPersistenceAuditTest'
$env:QUALITY_TARGET_SPECS='src/app/modules/core/components/account-access/account-access.component.spec.ts,src/app/modules/core/services/auth.service.spec.ts,src/app/modules/core/interceptors/auth.interceptor.spec.ts,src/app/modules/core/guards/auth.guard.spec.ts,src/app/modules/core/components/login/login.component.spec.ts,src/app/modules/core/shared/components/sidebar/sidebar.component.spec.ts'
node tools/run-quality-gate.mjs ticket AUTO
npm --prefix frontend run quality:standard
mvn.cmd resources:resources compiler:compile compiler:testCompile '-Dtest=PersonalAccountIntegrationTest,SmtpAccountMailerTest,AuthTokenLifecycleAuditTest,AuthTokenSchemaUpgradeAuditTest,AuthTokenSettingsAuditTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest,TestUserBootstrapPersistenceAuditTest' surefire:test
npm --prefix frontend run factory:validate
npm --prefix frontend run audit:accessibility
node tools/compare-quality-baseline.mjs --validate
git diff --check
```

- **Wrapper STANDARD:** Factory config PASS; backend80 testes:71 aprovados,2 falhas e7 erros,0 skips, exclusivamente9 casos de TestUserBootstrapAuditTest. Fail-fast interrompeu antes do frontend. Log/JSON originais preservados em FEAT-018-ticket.log/json; não foram convertidos para PASS.
- **Falha anterior confirmada:** HEAD `3e62646` já define omissão true para RECCE_TEST_USER_ENABLED e credenciais locais. A feature só acrescenta propriedades conta/SMTP. Prova sanitizada FEAT-018-preexisting-config.json; configuração/credenciais e asserções preservadas. Baseline atualizada após execução real, sem repetir investigação global. Não constitui falha do fluxo pessoal, mas bloqueia release.
- **Continuação STANDARD do frontend:** lint/typecheck PASS; targeted65/65; integração198/198; runner3/3; E2E Chromium/API/H2 **32/32 PASS**; build PASS, initial489.73kB abaixo do warning500kB. FEAT-018-frontend-standard.log. Inclui Studio, caderno/capas, ralis, perfil, tutorial e offline, além do percurso novo.
- **Reexecução backend após revisão/correção:**42/42 PASS,0fail/error/skip nas8 classes explicitadas; inclui13 testes pessoais e2 SMTP. FEAT-018-backend-reviewed.log. Auditoria inalterada de defaults reutilizada como falha conhecida, sem a retirar da conclusão global. Recursos recompostos para execução normal do Main; nenhum backend beta reiniciado.
- **Factory validate, acessibilidade estática e baseline validate:** PASS; FEAT-018-factory-final.log, FEAT-018-accessibility-final.log e FEAT-018-baseline-validate.log. `git diff --check` PASS. Comparador de release completo não executado porque exige DEEP e não havia pedido de release; não se fabricou um relatório de release.
- **Verificação visual:** FEAT-018-personal-desktop.png e FEAT-018-recovery-mobile.png, capturadas pelo E2E e inspecionadas. Móvel sem overflow horizontal; formulário com labels/retorno/erro e foco visível. Auditoria estática não substitui leitor de ecrã real.

## QA e revisão

factory-qa aplicado às fronteiras de identidade/equipa/media, provas, recuperação, abuso/concorrência JPA/H2 e fluxos Angular/browser. factory-review inspecionou diff, autorização, persistência, compatibilidade, segredos/erros e força dos testes. **APPROVE WITH NOTES**, sem findings bloqueantes no diff final. Relatório: `.factory-results/FEAT-018-qa-review.md`.

Correções durante validação: fixture sem transação, preservação do contrato403/401 legado e teste SMTP MIME descodificado. Restrição de conexão loopback foi reexecutada com autorização. A revisão também encontrou criação de password com espaços incompatível com login; corrigido e testado sem truncar credenciais nem enfraquecer asserções. Logs iniciais FEAT-018-backend-initial.log, FEAT-018-backend-focused.log e FEAT-018-backend-focused-final.log preservados.

## Problemas e limitações

- Configuração legada de utilizador de testes reprova a auditoria de defaults seguros e bloqueia release. Não se alterou nesta feature.
- SMTP externo/DNS/entrega real, PostgreSQL, migração beta, carga elevada, múltiplos processos e matriz de browsers não executados. Teste SMTP usa servidor loopback; E2E usa caixa de correio simulada de classpath de testes, chave efémera e quota1000 apenas no harness; integração usa limite real5.
- Bloqueio coordenador global serializa confirmação/contagem: simples para carga inicial, sem garantia de capacidade em escala. IP é o do socket; publicação atrás de proxy requer configuração confiável própria.
- Registo/recuperação continuam desativados por omissão. Instruções: `docs/personal-accounts.md`. Configuração válida não significa entrega validada.

## Gates independentes

- **TICKET_GATE: PASS / APPROVED**, por avaliação focalizada segundo AGENTS: AC1–7 verificados, regressões afetadas PASS e revisão aprovada. **Wrapper bruto FAIL** por9 falhas anteriores independentes de defaults seguros, registadas na baseline; a aprovação da feature não altera esse resultado nem desativa testes.
- **RELEASE_GATE: FAIL / BLOCKED**, pela auditoria obrigatória de defaults seguros executada e falhada. Comando de release completo não executado; não se afirma prontidão global.

## Histórico

- 2026-11-02: documento PLANNED criado antes de código com ID018 único; produto/transporte bloquearam trabalho dependente.
- 2026-11-02: aprovação explícita D12/SMTP recebida; IN_PROGRESS; implementada apenas UAC-P01 e testes direcionados.
- 2026-11-02: QA intermédio/revisão, correção de casos limite e gate STANDARD; falha anterior registada sem alterar configuração alheia. Continuação de verificações afetadas em curso.

- 2026-11-02: IN_REVIEW —42/42 backend afetados,65/65 targeted,198/198 integração,32/32 E2E, build/config/acessibilidade aprovados; revisão APPROVE WITH NOTES. TICKET aprovado no âmbito, release bloqueado independentemente. Sem SMTP real nem reinício beta.
- 2026-11-02: pedido repetido de implementação de UAC-P01 reconciliado com esta entrega existente. Reutilizadas evidências QA/review válidas da sessão, sem alteração de código nem nova execução das suites. Roadmap atualizado com estado/link e correspondência explícita P01-AC1–3. Nenhuma feature duplicada ou fase antecipada; verificação documental Factory e diff registada em FEAT-018-continuation-check.log.

## Suporte local após entrega — 2026-11-02

Após o utilizador comunicar que não conseguia entrar, confirmou-se ausência de serviço backend na porta8080 e ausência de listener frontend4200. Recuperação operacional FAST, sem alterações de código: atualizado classpath Maven (incluindo mail), executado `.factory-results/local-beta/start-current.ps1` com as credenciais locais existentes, sem as expor. O script fez backup da base persistente antes do arranque e manteve bootstrap desativado; não criou/resetou a conta nem eliminou dados. Frontend iniciado apenas após confirmar porta4200 livre.

Verificações reais: health backend200, página `/login`200, autenticação da conta existente, validação da sessão e correspondência do perfil aprovadas. Evidência: `.factory-results/local-beta/FEAT-018-support-verified.json`, `FEAT-018-support-start.log` e `FEAT-018-classpath.log`. Não foram enviados emails reais nem alterada a política aprovada; os gates de implementação/release acima mantêm os seus resultados. Esta recuperação da beta foi posterior à entrega da feature, a pedido do utilizador.
