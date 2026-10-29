# FEAT-002 — Navegação consistente da sessão offline

- **Descrição:** desativar Notas em modo offline e usar Reconhecimentos Offline como entrada da sessão offline.
- **Estado:** IN_REVIEW
- **Perfil:** STANDARD — alteração de navegação e estados de autenticação/interface, com regressão direcionada e E2E.

## Objetivo e âmbito

Garantir uma entrada previsível em `/offline-recces` e impedir que a aba Notas sugira uma funcionalidade indisponível offline. Manter Tutorial, reconhecimentos locais e o início de um novo reconhecimento acessíveis. Preservar o comportamento online, a gravação e a persistência existentes.

## Requisitos

- RF1: a entrada explícita offline, a retoma de uma sessão offline no login e a mudança manual para modo offline conduzem à lista de reconhecimentos offline, independentemente de existirem sessões locais.
- RF2: Notas permanece visível, mas desativada e identificada como indisponível offline, sem navegação por rato ou teclado. Volta a estar disponível online.
- RF3: acessos diretos a `/notes` em modo offline continuam protegidos pelo guard e regressam à lista; Tutorial e gravação local mantêm-se acessíveis.
- RNF1: reutilizar os estados e guard existentes; sem dependências novas, alterações de API, dados locais ou regras de autorização.
- RNF2: preservar alterações anteriores presentes na árvore de trabalho; não fazer push, merge ou deploy.

## Critérios de aceitação

1. Dado o login, quando se escolhe reconhecimento offline ou se submete sem rede, então o destino é `/offline-recces`.
2. Dada uma sessão offline retomada no login ou uma mudança online → offline, quando entra nesse modo, então abre `/offline-recces`, incluindo lista vazia ou armazenamento indisponível.
3. Dado o modo offline, quando se apresenta Notas, então está visual e semanticamente desativada, sem href/navegação nem foco por Tab; ao regressar a online, o link `/notes` é reposto.
4. Dado o modo offline, quando se visita `/notes` diretamente, então o guard redireciona para `/offline-recces`; Tutorial e novo reconhecimento continuam acessíveis.
5. Dada autenticação online, quando entra sem trabalho local, então mantém o destino normal; com trabalho local mantém o encaminhamento existente para `/offline-recces`.

## Casos limite e erros

Lista vazia e falha IndexedDB não devem mudar o destino offline. Recarregar/retomar login offline deve manter o destino. Não confundir sessão offline explícita com simples perda de rede numa sessão online. A gravação em curso continua sujeita ao guard de saída existente. Sem alterações à propriedade ou sincronização de sessões.

## Componentes, dependências e riscos

LoginComponent, SidebarComponent, AuthService (estado existente), SharedProperties (modo existente) e authGuard. Riscos: encaminhamento online involuntário, link ainda acionável por teclado e perda de acesso ao reconhecimento/tutorial. Backend e persistência fora do âmbito.

## Decisões técnicas

Confirmado no código inicial: `enterOffline()` abria `/recce-mode`; retoma sem trabalho local e erro do armazenamento usavam o mesmo destino; o link Notas estava sempre ativo, apesar de o guard já bloquear `/notes` offline. Reutilizado `/offline-recces`, RouterLink desativado com null e atributos acessíveis, sem modificar o guard. A revisão acrescentou `role="link"`: quando se remove href, a âncora deixa de ter semântica implícita de link, pelo que é necessário mantê-la explicitamente para apresentar Notas como link desativado.

## Ficheiros alterados

- `frontend/src/app/modules/core/components/login/login.component.ts` e `.spec.ts`: destino único offline, sem dependência da leitura de sessões; regressões de entrada/retoma e online.
- `frontend/src/app/modules/core/shared/components/sidebar/sidebar.component.ts`, `.html` e `.spec.ts`: Notas desativada offline e destino da alternância; testes DOM e estado.
- `frontend/src/app/modules/core/guards/auth.guard.spec.ts`: regressão da fronteira offline, sem alteração do guard.
- `frontend/e2e/offline-navigation.spec.ts`: percursos reais de entrada, navegação e alternância offline/online.
- Este documento, criado antes da implementação. Restantes alterações existentes fora do âmbito preservadas.

## Verificação dos critérios

| Critério | Teste/check previsto | Resultado | Evidência |
| --- | --- | --- | --- |
| 1 | Login: entrada explícita e submit sem rede; E2E: entrada pelo botão offline | PASS | FEAT-002-after.log; FEAT-002-review-e2e.log |
| 2 | Login: retoma com armazenamento vazio/pendente/indisponível sem leitura bloqueante; sidebar: online → offline; E2E: retoma via login e alternância | PASS | FEAT-002-after.log; FEAT-002-review-targeted.log; FEAT-002-review-e2e.log |
| 3 | DOM: desativação, href removido, tabindex -1 e menu recolhido; E2E: papel/nome acessível, teclado, click sem navegação e reposição online | PASS | FEAT-002-review-targeted.log; FEAT-002-review-e2e.log |
| 4 | Guard: sessão offline e conta online em modo offline, URL direta/query, Tutorial/lista/gravação; E2E: Tutorial, novo reconhecimento e bookmark | PASS | FEAT-002-after.log; FEAT-002-review-e2e.log |
| 5 | Login: online vazio/pendente/erro; E2E: login real, percursos online e regresso a online | PASS | FEAT-002-after.log; gate STANDARD e FEAT-002-review-e2e.log |

## Validação e revisão

Reprodução executada antes da correção: 26 testes direcionados, 8 FAIL / 18 PASS. Confirmados destinos `/recce-mode` em vez de `/offline-recces` na entrada/retoma/alternância e ausência do contrato acessível desativado de Notas. Evidência: `.factory-results/FEAT-002-before.log`.

Após correção: `QUALITY_TARGET_SPECS` selecionou login, sidebar, auth.guard, offline-recces e recce-mode; `node tools/run-targeted-tests.mjs`: PASS, 73/73 em Chrome Headless 156 / Node 22.23.4, fora da sandbox para permitir lançamento do navegador. Evidência: `.factory-results/FEAT-002-after.log`.

`FACTORY_RISK=medium node tools/run-quality-gate.mjs ticket AUTO`: STANDARD, PASS em configuração, backend (73/73), lint, typecheck app/spec/E2E, testes direcionados (73/73), integração (95/95), E2E reais Chromium/API/H2 (6/6) e controlos do runner E2E (3/3), build de produção. O runner incluiu backend devido à árvore de trabalho anterior, sem alterações Java nesta feature. `FACTORY_TICKET_ID` e `FACTORY_MAVEN_TESTS` removidos do ambiente; sem ticket de auditoria associado. Logs: `.factory-results/FEAT-002-ticket.log`, snapshot `FEAT-002-initial-ticket.json` e `.factory-results/2026-10-23T14-39-23.805Z-ticket-standard/`.

Após ajuste de semântica na revisão: `QUALITY_TARGET_SPECS=src/app/modules/core/shared/components/sidebar/sidebar.component.spec.ts node tools/run-targeted-tests.mjs`: PASS, 5/5; `npm --prefix frontend run typecheck`: PASS; `npm --prefix frontend run e2e:ci -- --grep FEAT-002`: PASS, 2/2, com rebuild de produção pelo harness e validação da semântica acessível no navegador. Logs: `.factory-results/FEAT-002-review-targeted.log`, `FEAT-002-review-typecheck.log`, `FEAT-002-review-e2e.log` e `.factory-results/e2e/frontend-build.log`. Restantes resultados STANDARD inalterados são reutilizados; não se afirma uma segunda execução integral do gate após esse ajuste.

`git diff --check` no âmbito da feature: PASS (avisos LF/CRLF apenas). Revisão final `factory-review`: APPROVE; sem findings bloqueantes ou novas regressões observadas. QA/revisão detalhados em `.factory-results/FEAT-002-qa-review.md`. Estado IN_REVIEW para aprovação do utilizador; todos os critérios técnicos obrigatórios verificados.

## Problemas e limitações

Alterações anteriores de AUD-PERF-001, FEAT-001 e configuração local não pertencem a esta feature e foram preservadas. Consultada a baseline: falha conhecida AUD-DEP-001 (0 critical, 15 high, 4 moderate) mantém-se bloqueante para release; sem nova auditoria de dependências ou investigação dessa assinatura.

E2E usa modo offline explícito com rede local disponível, monitorizando ausência de pedidos à API durante o percurso offline. Não valida arranque sem rede com service worker/cache (service workers bloqueados no harness), dispositivos móveis reais, gravação física ou leitores de ecrã reais. Nenhuma alteração de persistência, propriedade local ou sincronização.

## Gates independentes

- **TICKET_GATE:** PASS → APPROVED — STANDARD aprovado, revalidação direcionada do ajuste final aprovada e revisão APPROVE.
- **RELEASE_GATE:** NOT_RUN → UNVERIFIED — sem execução global; a falha conhecida de dependências continua bloqueante para release.

## Histórico

- 2026-10-23: PLANNED — especificação criada antes de alterar código; próximo ID após FEAT-001.
- 2026-10-23: IN_PROGRESS — regressões escritas e executadas antes da correção: 8 falhas reproduzidas.
- 2026-10-23: IN_REVIEW — correção implementada, 73/73 testes direcionados aprovados; gate STANDARD e revisão final em curso.
- 2026-10-23: STANDARD aprovado; revisão reforçou semântica acessível do link desativado e iniciou revalidação direcionada dessa alteração.
- 2026-10-23: revalidação final aprovada (sidebar 5/5, typecheck, E2E 2/2 com rebuild); QA/revisão concluídos. IN_REVIEW, pronta para aprovação do utilizador. Sem push, merge ou deploy.
