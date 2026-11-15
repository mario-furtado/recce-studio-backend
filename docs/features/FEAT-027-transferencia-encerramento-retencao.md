# FEAT-027 — Transferência, encerramento e retenção

- **Roadmap:** UAC-P10
- **Estado:** BLOCKED
- **Perfil:** STANDARD, com regressões de autorização, persistência e restauro.

## Objetivo e âmbito

Transferir a propriedade sem copiar o projeto. Permitir desativar e recuperar a conta, exportar os dados e gerir a eliminação definitiva de forma assistida. As funcionalidades comerciais ficam para a P11.

## Requisitos e critérios de aceitação

1. **P10-AC1:** Dado um pedido feito pelo proprietário após reautenticação, quando o destinatário verificado o aceita após reautenticação, existe um único proprietário, com os mesmos IDs, recursos e concessões READ. O antigo dono deixa de ter gestão. Terceiros, pedidos obsoletos e aceitações concorrentes não criam acesso.
2. **P10-AC2:** Dada uma conta com tripulações, quando o titular confirma a desativação, a sessão deixa de funcionar, as escritas ficam bloqueadas e os leitores autorizados mantêm acesso. O titular pode provar a identidade e reativar a conta. Sem promoção automática ou cascata.
3. **P10-AC3:** Dado um pedido legítimo, o titular pode exportar e recuperar durante 30 dias. A eliminação é assistida após o prazo, resolução de dependências e prova de restauro, incluindo media. Operações rastreáveis, com aviso sobre cópias descarregadas e sem limpeza automática de backups.

## Decisões técnicas e dependências

D03, D04 e D05 aprovadas em 2026-11-11. P03, P06 e P08 fornecem migração, revogação e arquivo. A P03 ensaiou restauro de base H2 e media local em isolamento. Falta prova representativa para eliminação definitiva e restauro reconciliado com escritas e revogações posteriores.

| Fronteira | Dependentes a verificar |
| --- | --- |
| Conta | Sessão, credenciais, desafios de recuperação, regras de notas, modelo do caderno e preferências pessoais. |
| Tripulação | Proprietário atual e recibo histórico da P03, perfil, carros, logótipos, ralis, PECs, notas, publicações, anexos e destinos offline. |
| Acessos | Convites pendentes, concessões por rali, histórico de concessão/revogação, notificações derivadas e recibos de sincronização. |
| Restauro | Registos relacionais e referências por ID, ficheiros locais e objetos S3. A autorização atual tem de prevalecer sobre concessões revogadas no backup. |

Verificar também pedidos repetidos, proprietário ou destinatário inativo, múltiplas tripulações, reautenticação errada, interrupção e concorrência. A propriedade sobre a tripulação é distinta da autoria e dos dados locais guardados pelo utilizador.

- **Transferência:** transação com bloqueios de conta e tripulação. O pedido expira em sete dias, admite cancelamento e fica inválido se as credenciais do remetente mudarem. A aceitação mantém o ID da tripulação e regista a decisão. Cancela convites READ ainda pendentes, preserva grants existentes e mantém o recibo P03 ligado ao proprietário original. A interface e a criação de pedidos dependem de `RECCE_CREW_TRANSFER_ENABLED`, desligada por omissão.
- **Desativação:** exige conta com email verificado, reautenticação e recuperação configurada. A prova por email reutiliza o fluxo de reposição da password. Um link emitido antes da desativação fica inválido. A marca de desativação voluntária distingue a conta recuperável de uma conta suspensa.
- **Rollback:** a ferramenta de migração exige a capacidade `Recce-Account-Lifecycle` em artefactos de rollback quando já existem pedidos de transferência ou contas autodesativadas.
- **Eliminação assistida pendente:** o titular deve poder exportar os recursos autorizados antes da operação. O prazo de 30 dias pertence ao pedido de eliminação. Para fechar o critério, é necessário ensaiar a retenção, comprovar a cópia consistente de base e media no ambiente alvo e reconciliar alterações de propriedade e revogações posteriores ao backup. O restauro da P03 demonstra a mecânica em H2 e disco local.

## Verificação dos critérios

| Critério | Teste | Resultado |
| --- | --- | --- |
| P10-AC1 | Dupla reautenticação, terceiro recusado, aceitação concorrente e repetida, convite pendente cancelado, rali e grant preservados, contexto migrado e transferência pela interface | PASS para os percursos executados. Corridas com escritas já em curso não cobertas em todas as rotas. |
| P10-AC2 | Revogação da sessão, bloqueio de novas escritas, manutenção de READ, prova de recuperação, replay recusado e reativação pela interface | PASS para desativação e reativação. Fecho definitivo pendente. |
| P10-AC3 | Exportação autorizada, prazo, retenção de media, ensaio de restauro e prova de não reativação de acessos | UNVERIFIED. Implementação pendente. |

## Validação e revisão

- Regresso às dependências P03/P06/P08 no checkout atual. 34 testes H2 passaram com `mvn -o compiler:compile compiler:testCompile -Dtest=LegacyCrewMigrationToolTest,LegacyCrewMigrationIntegrationTest,SharedRallyIntegrationTest surefire:test`. Log `.factory-results/FEAT-027-dependencies.log`.
- Primeira regressão de implementação. 70 testes passaram com `mvn -o compiler:compile compiler:testCompile -Dtest=PersonalAccountIntegrationTest,LegacyCrewMigrationIntegrationTest,LegacyCrewMigrationToolTest,SharedRallyIntegrationTest,RallyInvitationIntegrationTest,CrewIsolationIntegrationTest surefire:test`. Log `.factory-results/FEAT-027-backend.log`. Esta passagem precedeu os testes adicionais de migração e rollback.
- `npm --prefix frontend run typecheck` passou. 36 testes passaram no Chrome Headless com `npm --prefix frontend run test:targeted` nos specs de conta, tripulação e interceptor. Log `.factory-results/FEAT-027-angular.log`. Esta passagem precedeu o teste adicional de desativação.
- `node tools/run-quality-gate.mjs ticket AUTO`, com `FACTORY_RISK=high`, selecionou STANDARD. Configuração Factory, lint e typecheck passaram. Passaram 72 testes Maven, 37 testes Angular dirigidos e 210 testes de integração Angular. Os alvos Maven foram os seis da primeira regressão. Os alvos Angular foram conta, recuperação, tripulação e interceptor. Log `.factory-results/FEAT-027-ticket.log`.
- `mvn -o compiler:compile compiler:testCompile -Dtest=PersonalAccountIntegrationTest surefire:test` passou 16/16 após acrescentar a verificação explícita do cancelamento de um convite READ pendente. Log `.factory-results/FEAT-027-final-account.log`.
- O runner E2E aprovou os três testes de contrato e 39 de 40 cenários Playwright, incluindo a FEAT-027 em 10,7 s. A suite atingiu o limite global de 300 s. O relatório bruto `.factory-results/FEAT-027-ticket.json` mantém o FAIL. A compilação Angular de produção do próprio E2E terminou com sucesso em `.factory-results/e2e/frontend-build.log`.
- `npm --prefix frontend run e2e:ci -- workflow-tours.spec.ts --grep "offline guides and invalid routes"` aprovou 1/1. Os 40 cenários foram verificados em duas passagens. Log `.factory-results/FEAT-027-e2e-complement.log`.

## Ficheiros alterados

- `docs/product/USERS_ACCESS_TO_BE.md` e este documento registam as decisões e o progresso da P10.
- `CrewController`, `CrewTransferService`, `CrewTransferEntity`, `CrewTransferRepository`, `CrewEntity`, `CrewRepository` e `CrewService` implementam a transferência e a resolução do proprietário atual.
- `LegacyMigrationAccess`, `AuthService`, `LegacyCrewMigrationTool` e `pom.xml` mantêm a proveniência e a compatibilidade da autorização.
- `RallyInvitationService` e `RallyInvitationRepository` fecham convites pendentes e sincronizam a verificação da propriedade com alterações de convites.
- `PersonalAccountController`, `PersonalAccountService` e `AuthUserEntity` implementam a desativação e a recuperação verificadas. `application.properties` define a configuração da transferência.
- Componentes Angular de conta, recuperação e tripulações, testes Angular, testes de integração Java e percurso Playwright de conta.

## Limitações e revisão

- D05 continua por implementar. Faltam o pacote de exportação, o pedido persistido com janela de recuperação de 30 dias e a eliminação assistida com prova de restauro. Os mecanismos de eliminação já existentes para rali e PEC não foram alterados.
- O ensaio P03 só cobre H2 e disco local. O restauro da FEAT-027 precisa de um ensaio com o armazenamento alvo que preserve alterações de propriedade e revogações posteriores ao backup.
- Revisão STANDARD do diff, incluindo reautenticação, bloqueios concorrentes, retenção dos grants e compatibilidade do recibo de migração. A cobertura executada verifica pedidos iniciados após a troca de proprietário ou a desativação. Operações de escrita que já estivessem em curso no momento da transição não foram ensaiadas em todas as rotas.
- A desativação voluntária depende de email verificado e recuperação configurada. O envio foi simulado.
- Veredicto de revisão da feature completa: BLOCKED enquanto o P10-AC3 estiver pendente.

## Gates independentes

- **TICKET_GATE:** BLOCKED. P10-AC3 por implementar e validar. O runner automático registou FAIL por limite de tempo global do Playwright.
- **RELEASE_GATE:** NOT_RUN (UNVERIFIED). A baseline de release continua a registar AUD-SEC-005.

## Histórico

- 2026-11-11 — Especificação criada após aprovação das decisões e validação dirigida das dependências.
- 2026-11-11 — Transferência e desativação implementadas. Execução do gate STANDARD e revisão.
- 2026-11-11 — Validação complementar do último cenário Playwright concluída. Feature bloqueada por implementação e validação pendentes de D05.
