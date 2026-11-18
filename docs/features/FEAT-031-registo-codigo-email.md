# FEAT-031 — Registo com código de verificação

- **Descrição:** Registo pessoal com formulário inicial completo, código de cinco minutos e email de boas-vindas.
- **Estado:** IN_REVIEW
- **Perfil:** STANDARD, com testes de autenticação, isolamento, persistência e recuperação.

## Objetivo e âmbito

O fluxo atual pede o email e recolhe os restantes dados através de um link. O novo registo recolhe todos os dados antes do envio e confirma o endereço na mesma página. A recuperação de password e os links de confirmação emitidos antes da mudança mantêm compatibilidade.

## Requisitos e critérios de aceitação

1. **AC1** — Dado um formulário válido com email, nome, data de nascimento e password, ao submeter, a interface mostra «Verifica o teu email» e identifica o destinatário. A conta só existe após confirmação e os dados pendentes guardam apenas o hash da password.
2. **AC2** — Dado um pedido pendente, introduzir ou colar o código correto antes de cinco minutos ativa a conta uma única vez e encaminha para o login. Código expirado, incorreto ou associado a outro pedido não ativa a conta.
3. **AC3** — O contador reflete o prazo e o reenvio funciona sem repetir os dados. Corrigir o email mantém os dados e invalida o código anterior. O reenvio e a validação têm limites persistentes.
4. **AC4** — O email de boas-vindas é enviado após a ativação. Uma falha de entrega mantém a conta ativa e permite iniciar sessão.
5. **AC5** — Validar dados inválidos, concorrência, pedidos para email já registado, recuperação e verificação de links legados já emitidos.

## Estados, componentes e decisões

Pending, expirado com reenvio possível, confirmado. Reutilizar AccountChallenge, o bloqueio de serialização na base, a quota por email/IP, o mailer SMTP e a configuração de contas. O prazo do código é de cinco minutos e o dos dados pendentes é de 30 minutos desde o último envio. O identificador aleatório fica em memória da página, o código fica associado a esse pedido e o segredo de confirmação não é guardado em claro. O envio de boas-vindas é secundário e ocorre depois da transação de criação. A migração é aditiva.

## QA e revisão

| Critério | Testes executados | Resultado |
| --- | --- | --- |
| AC1 | Formulário, ausência de conta ativa e password pendente em hash | PASS em Java, Angular e Chromium |
| AC2 | Limite de cinco minutos, associação ao pedido, utilização única e login | PASS em Java, Angular e Chromium |
| AC3 | Contador, correção, reenvio, invalidação do código anterior e quotas | PASS em Java, Angular e Chromium |
| AC4 | SMTP simulado, confirmação persistida antes do envio e login após falha de boas-vindas | PASS em Java e Chromium |
| AC5 | Datas e passwords inválidas, concorrência, contas existentes, links anteriores, recuperação e upgrade H2 | PASS em Java e Chromium nos percursos aplicáveis |

## Ficheiros alterados

Backend: AccountChallengeEntity e AccountChallengeRepository para persistência, PersonalAccountController e PersonalAccountService para emissão/validação, SmtpAccountMailer para confirmação e boas-vindas. Frontend: AccountAccessComponent, AuthService e auth.interceptor. Testes Spring, Angular e Playwright dos fluxos afetados. Documentação operacional em docs/personal-accounts.md.

### Comandos e evidência

| Comando | Resultado | Evidência |
| --- | --- | --- |
| `mvn -o resources:resources compiler:compile compiler:testCompile -Dtest=PersonalAccountIntegrationTest,RallyInvitationIntegrationTest,AuthTokenLifecycleAuditTest,SmtpAccountMailerTest surefire:test` | 38/38 | `.factory-results/FEAT-031-backend-final.log` |
| `mvn -o resources:resources compiler:testCompile -Dtest=AuthTokenSchemaUpgradeAuditTest surefire:test` | 2/2 | `.factory-results/FEAT-031-schema.log` |
| `npm --prefix frontend run test:targeted` com account-access, login e auth.interceptor | 42/42 | `.factory-results/FEAT-031-angular-final.log` |
| `node tools/run-quality-gate.mjs ticket AUTO` com `FACTORY_RISK=high` | STANDARD. Configuração, Java, lint, typecheck, Angular dirigido e integração (211/211) passaram. Playwright teve 28 sucessos, uma falha e 13 cenários por executar devido ao limite global. O build de produção usado pelo Playwright passou. | `.factory-results/FEAT-031-ticket.log`, `.factory-results/latest-ticket.json` |
| `npm --prefix frontend run e2e:ci -- personal-account.spec.ts crew-context.spec.ts rally-areas.spec.ts rally-invitations.spec.ts` | 5/5. Inclui o registo na interface com correção do email, novo código, rejeição do anterior, boas-vindas e login. | `.factory-results/FEAT-031-e2e-focused.log` |
| `git diff --check` | PASS | Verificação do diff |

Revisão dos fluxos afetados **APPROVE WITH NOTES**. Verificados emissão e controlo de quota, exposição de segredos, concorrência, compatibilidade e efeito de falhas SMTP. Corrigidos durante QA o uso de uma entidade já carregada na confirmação concorrente e o prazo apresentado após falha de envio do código. A feature fica em revisão até aprovação do gate STANDARD.

## Limitações e gates

- O teste SMTP usa loopback. A entrega real pelo Resend e a migração da base publicada ficam por verificar.
- O build usado pelo Playwright apresenta um aviso de tamanho inicial de 501,43 kB face ao limiar de 500 kB. A FEAT-030 já registava o mesmo aviso com 500,37 kB.
- O teste de partilha `shared-rally.spec.ts:15` falhou à espera do link «Ralis partilhados comigo» em `/account`, após login com conta pré-criada. O seletor já não corresponde ao componente no HEAD anterior à feature. O percurso falhado não utiliza o novo registo.
- A configuração local já tinha o registo ativo por omissão. Nas validações foi usada a variável de ambiente `RECCE_ACCOUNT_ENABLED=false` para o cenário genérico de registo fechado. Os testes dos fluxos de contas e o harness Chromium ativam explicitamente o registo nos ambientes isolados.
- **TICKET_GATE:** FAIL no runner STANDARD devido ao E2E de partilha e ao limite global do Playwright. Aprovação formal bloqueada.
- **RELEASE_GATE:** NOT_RUN.

## Histórico

- 2026-11-17 — PLANNED. Especificação criada antes da implementação.
- 2026-11-17 — IN_REVIEW. Implementação concluída para revisão. Java dirigido 38/38 e Angular dirigido 42/42 em ambiente com loopback autorizado.
- 2026-11-17 — Upgrade da tabela de desafios em H2 validado. Os dois testes de schema passaram.
- 2026-11-17 — Gate STANDARD executado. Percursos de registo, convites e recuperação passaram na primeira execução. Gate interrompido pelo E2E de partilha.
- 2026-11-17 — Cinco percursos Chromium diretamente afetados aprovados numa execução isolada. Aprovação formal mantém-se pendente.

