# FEAT-029 — Conta e partilhas de ralis

- **Estado:** COMPLETED no âmbito entregue
- **Perfil:** STANDARD. A lista nova precisa de testes de propriedade e privacidade.

## Objetivo, âmbito e critérios

1. A página A minha conta agrupa conta e segurança, subscrição e partilhas. Conserva a gestão de tripulações e a recuperação de acesso.
2. O proprietário consulta os ralis com acesso ativo ou convite pendente em todas as suas tripulações, incluindo concluídos e arquivados, com opção de listar os restantes para convidar. Leitores e terceiros não recebem metadados próprios da gestão.
3. A mesma interface de convites e acessos serve a conta e os detalhes do rali. O proprietário pode revogar depois de arquivar, com confirmação que identifica pessoa, rali e efeito sobre a exportação. Downloads prévios permanecem no dispositivo.
4. Subscrição apresenta o estado de disponibilidade atual. O piloto P11 não dá acesso a gestão ou cancelamento reais. A ligação a faturação depende da política comercial e da funcionalidade própria.

## Casos limite e dependências

Sem ralis, sem partilhas, convites expirados, falha e repetição, paginação, transferências, flags de tripulação e de convites. Reutilizar a autoridade do proprietário e os endpoints de convite, cancelamento e revogação. A listagem não altera autorizações ou estado dos ralis.

## Validação e gates

- `mvn -o compiler:compile compiler:testCompile -Dtest=SharedRallyIntegrationTest,RallyInvitationIntegrationTest surefire:test`: 23/23 em H2. Log `.factory-results/FEAT-029-backend.log`.
- `npm --prefix frontend run e2e:ci -- rally-access.spec.ts personal-account.spec.ts`: 3/3. Inclui build Angular de produção, registo/recuperação, transferência de tripulação, convite enviado pela conta, revogação depois do arquivo e recusa de exportação num caderno que já estava aberto. Log `.factory-results/FEAT-029-e2e.log`.
- `npm --prefix frontend run factory:validate`, `lint` e `typecheck`: PASS. `npm --prefix frontend run test:targeted` com os specs de conta pessoal e interceptor: 26/26. Logs `.factory-results/FEAT-029-*.log`.
- Primeira integração Angular: 209/210. O caso de conta sem espaço detetou a ausência da indicação «Ainda não tens uma tripulação associada». A mensagem foi reposta em Partilhas. Repetição de `npm --prefix frontend run test:integration`: 210/210. Logs `.factory-results/FEAT-029-test-integration.log` e `.factory-results/FEAT-029-test-integration-recheck.log`.
- A confirmação do build final em `frontend/dist` terminou com EPERM ao criar `browser/assets/brand`. `npm --prefix frontend run build -- --output-path ../.factory-results/FEAT-029-dist`: PASS. Logs `.factory-results/FEAT-029-build.log` e `.factory-results/FEAT-029-build-recheck.log`.
- **TICKET_GATE:** PASS na validação STANDARD dirigida com os comandos acima, aplicada ao âmbito da feature.
- **RELEASE_GATE:** NOT_RUN (UNVERIFIED). O runner global não foi executado.

## Alterações

- `PersonalAccountComponent` e `AccountSharingComponent` apresentam a conta e a vista de partilhas. `RallyAccessComponent` e `RallyInvitationsComponent` servem ambos os ecrãs.
- `RallyInvitationController`, `RallyAccessService`, `RallyRepository` e `InvitationApi` expõem o sumário paginado, isolado pelo ID da conta autenticada e validado pela autorização existente de tripulação. O sumário devolve contagens, sem emails ou IDs dos leitores.
- Testes de integração Java e percurso Playwright de convite e revogação com PDF já aberto.

## Revisão

- O sumário recebe a identidade exclusivamente do contexto autenticado e resolve a propriedade de cada tripulação com a mesma autorização usada pelos detalhes. A data atual é calculada no servidor para excluir convites expirados.
- Convites, cancelamentos e revogações usam os mesmos endpoints nos dois ecrãs. O sumário é atualizado ao fechar a gestão de um rali.
- Revisto o diff da feature. A alteração existente na barra lateral fica fora deste âmbito.
- Inspeção da captura desktop do Playwright em `.factory-results/FEAT-018-personal-desktop.png`. Confirmados os títulos, o estado de subscrição, o estado vazio de partilhas e a preservação da gestão de tripulações.
- Parecer: APPROVE. Critérios 1 e 4 verificados em Playwright e na regressão Angular. Critérios 2 e 3 verificados em H2 e Playwright. Nenhuma regressão introduzida ficou em aberto.

## Limitações

- A gestão real de subscrição depende da implementação de faturação.
- A gestão de partilhas usa `RECCE_CREWS_ENABLED` e tripulações geridas. O envio e cancelamento de novos convites continuam a depender de `RECCE_INVITATIONS_ENABLED`. Instâncias legadas que operam com as flags desativadas veem a secção e a informação de indisponibilidade.

## Histórico

- 2026-11-15 — Especificação criada antes da alteração da aplicação.
- 2026-11-15 — Conta e partilhas implementadas. Convite e revogação pós-arquivo verificados em Chromium.
- 2026-11-15 — Estado sem tripulação reposto. Suite Angular e build final aprovados.
