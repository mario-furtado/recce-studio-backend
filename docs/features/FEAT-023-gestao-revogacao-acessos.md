# FEAT-023 — Gestão e revogação de acessos

- **Estado:** COMPLETED
- **Roadmap:** UAC-P06
- **Perfil:** STANDARD, com testes focados de autorização, concorrência, persistência e pedidos de media.

## Objetivo e âmbito

O proprietário gere os convites pendentes e as concessões READ do próprio rali. Cancelar mantém o histórico do convite. Revogar retira o acesso remoto e mantém a aceitação histórica. P04 verifica a concessão ativa em cada pedido de leitura e P05 regista a origem da concessão e serializa as decisões pelo rali. O estado atual não dispõe de operação de revogação e apresenta o convite aceite como utilizável sem consultar a concessão.

D01 limita a concessão ao rali. D06 continua a definir a entrega e o prazo do convite. D05 permanece pendente para retenção e eliminação definitivas. Os eventos desta fase são persistidos com os IDs, ação e data necessários. A revogação regista uma categoria de motivo, sem texto livre. Mantém-se a configuração de exposição existente.

## Critérios de aceitação

1. **AC1:** O proprietário cancela um convite pendente e o destinatário não o consegue aceitar depois. A corrida aceitar/cancelar tem um único vencedor. O histórico distingue cancelado e recusado.
2. **AC2:** O proprietário revoga uma concessão pelo par rali/concessão. Após commit, novos pedidos a rali, PEC, notas, GPS, caderno, áudio e vídeo, incluindo HEAD/Range e links antigos, são recusados. Outros ralis e o acesso do proprietário mantêm-se.
3. **AC3:** O convite fica aceite no histórico e a caixa apresenta o acesso revogado. Repetir aceitação, leitura, envio ou revogação não restaura a concessão nem duplica eventos. A interface confirma o efeito e comunica os limites de downloads, bytes já recebidos e pedidos em curso.
4. **AC4:** Leitor e terceiro não podem gerir acessos. IDs de ralis/concessões cruzados são recusados. Sync e upload continuam protegidos pelas regras de proprietário, incluindo após revogação.
5. **AC5:** O histórico do rali regista ações novas com ator, alvo, data e motivo de revogação. Convites e concessões preexistentes continuam compatíveis. O proprietário pode revogar com o envio de novos convites pausado.

## Componentes, fronteiras e testes

- Backend: `RallyAccessService`, `RallyInvitationController`, `RallyInvitationService`, concessões P04 e `RallyAccessEventEntity`/repositório. A revogação usa o mesmo lock do rali que as decisões P05. A leitura P04 continua a verificar o estado ativo persistido. Novos eventos guardam IDs, ação e data. O histórico anterior continua nas linhas de convites, sem inventar eventos retroativos.
- Angular: painel de concessões e histórico no resumo do rali, confirmação do cancelamento e da revogação, estado efetivo no convite e autorização `HEAD` antes de imprimir um caderno partilhado. Uma negação no caderno limpa a pré-visualização e os URLs de media do ecrã.
- A revogação mantém a sessão e os outros ralis. A interface explica os limites sobre dados entregues e pedidos em curso. Os endpoints servem media pelo backend e mantêm `Cache-Control: no-store`. A configuração do service worker cacheia apenas a aplicação e os assets públicos.

## Validação inicial

- Compilação Java e TypeScript iniciais passaram. O primeiro ensaio de integração detetou uma resolução ambígua do atributo JPA do destinatário. A consulta foi tornada explícita. A repetição focada Maven passou 15/15. Logs `.factory-results/FEAT-023-backend-focused.log` e `.factory-results/FEAT-023-backend-reviewed.log`.
- `npm --prefix frontend run e2e:ci -- rally-access.spec.ts rally-invitations.spec.ts shared-rally.spec.ts rally-detail-composition.spec.ts`: 2/4 na primeira passagem. A barra móvel sobrepunha o alvo no cenário de revogação e o preflight CORS não admitia HEAD no percurso de impressão autorizado. Foi declarado HEAD explicitamente e o teste centra o botão com scroll, sem forçar o clique. A repetição `npm --prefix frontend run e2e:ci -- rally-access.spec.ts shared-rally.spec.ts` passou 2/2. Logs `.factory-results/FEAT-023-e2e.log` e `.factory-results/FEAT-023-e2e-reviewed.log`.
- `FACTORY_RISK=high node tools/run-quality-gate.mjs ticket AUTO`: perfil STANDARD. Aprovaram configuração Factory, 73 testes Maven, lint, typecheck, 65 testes Angular direcionados e 203 de componentes. Playwright aprovou 30 cenários, incluindo a P06, e atingiu o limite global de 300 segundos antes dos sete tutoriais. O runner bruto preserva FAIL. Logs `.factory-results/FEAT-023-ticket.log` e `.factory-results/FEAT-023-ticket.json`.
- `mvn.cmd compiler:compile compiler:testCompile '-Dtest=SharedRallyIntegrationTest,RallyInvitationIntegrationTest' surefire:test`: 16/16 após uniformizar o 404. Inclui revogações concorrentes e origem do convite no histórico. Log `.factory-results/FEAT-023-backend-final.log`.
- `mvn.cmd '-Dtest=CrewFeatureDisabledIntegrationTest' surefire:test`: 1/1 sobre as classes recompiladas pelo harness. Com tripulações desligadas a API recusa a gestão antes de resolver o rali. Log `.factory-results/FEAT-023-flag-final.log`.
- `npm --prefix frontend run e2e:ci -- workflow-tours.spec.ts`: 7/7. Em conjunto com o gate, há 37/37 cenários distintos aprovados. Log `.factory-results/FEAT-023-e2e-complement.log`.
- `npm --prefix frontend run build` e `git diff --check`: PASS. Log `.factory-results/FEAT-023-build.log`.

| Critério | Evidência planeada | Resultado |
| --- | --- | --- |
| AC1 | Integração P05 de estados e corrida | PASS |
| AC2 | Matriz HTTP antes/depois e outro rali | PASS |
| AC3 | Repetição, caixa, histórico e browser | PASS |
| AC4 | Autorizações, recursos cruzados e sync/upload | PASS |
| AC5 | Auditoria, compatibilidade e flag | PASS |

## Revisão

- Autorização de gestão pela conta autenticada e pelo rali. Ralis alheios e inexistentes devolvem o mesmo 404, e o contexto explícito de outra tripulação não autoriza revogar.
- Transação de revogação e decisões P05 usam o mesmo lock do rali. A concessão fica inativa e a aceitação histórica mantém-se. Os IDs de conta, rali, concessão e convite são suficientes para rastrear a operação. Os eventos não guardam endereços, tokens ou conteúdo da PEC.
- A coluna `active` mantém o contrato da P04 e da P05. O replay P05 foi testado. O rollback para um binário anterior não foi ensaiado. A validação usa H2 e media locais.
- O percurso partilhado não emite URLs de media autónomos. O caderno é revalidado com HEAD antes de iniciar a impressão. O aviso de confirmação cobre os limites de bytes e ficheiros já entregues.
- Veredicto: APPROVE WITH NOTES. Os cinco critérios passaram. O timeout global ficou registado e os cenários em falta foram concluídos separadamente.

## Gates

- **TICKET_GATE:** PASS no âmbito da P06. O runner bruto mantém FAIL pelo limite de tempo do Playwright. Os sete cenários que ficaram por executar e o build passaram separadamente.
- **RELEASE_GATE:** BLOCKED. O timeout do runner e a falha conhecida AUD-SEC-005 continuam registados. O gate global de release e a auditoria de bootstrap não foram reexecutados nesta feature.

## Histórico

- 2026-11-10: especificação criada antes do código. P04/P05 e as decisões aplicáveis confirmadas.
- 2026-11-10: implementação, revisão da fronteira de impressão e repetição Playwright dirigida.
- 2026-11-10: regressão e build concluídos em passagens complementares. Critérios P06 aprovados.
