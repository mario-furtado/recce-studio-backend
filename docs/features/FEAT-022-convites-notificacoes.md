# FEAT-022 — Convites de leitura e notificações

- **Estado:** COMPLETED
- **Roadmap:** UAC-P05
- **Perfil:** STANDARD, com testes de privacidade, isolamento, concorrência e persistência.

## Objetivo e âmbito

O proprietário de um rali de tripulação gerida envia um convite READ a um endereço exato. O destinatário verificado encontra o alerta na aplicação, lê o âmbito e aceita ou recusa. A aceitação é a única operação desta fase que pode criar uma concessão. P01 fornece identidade e verificação. P04 fornece concessões por rali, de acordo com D01, e mantém o caderno publicado conforme D09. A P06 continua a preceder a abertura pública.

## Critérios de aceitação

1. **AC1:** O proprietário envia um convite cujo âmbito imutável é apenas o rali indicado. Só a conta destinatária verificada pode decidir. A aceitação e a concessão são atómicas. Leitores e outros proprietários ficam excluídos.
2. **AC2:** Duplicados em aberto mantêm prazo e alerta. Convites expirados, recusados e cancelados não dão acesso. A aceitação repetida mantém a mesma concessão. A corrida entre aceitar e cancelar tem um único vencedor.
3. **AC3:** Consultar ou marcar uma notificação como lida mantém o acesso inalterado. A caixa é pessoal e o detalhe apresenta o estado atual do convite.
4. **AC4:** Para um endereço sem conta, a API aceita o pedido sem revelar existência nem criar uma conta. Depois de verificar o endereço dentro do prazo, a conta correta pode aceitar. Um convite associado a um ID não passa para outra conta com o mesmo email.
5. **AC5:** A funcionalidade exige habilitação explícita num ambiente controlado. Com a flag desligada, P01/P04 continuam utilizáveis e o fluxo de convites fica indisponível.

## Limites e decisões

D06 aprovada em 2026-11-10. Entrega na aplicação após verificação do endereço, prazo de sete dias, um convite pendente por rali e endereço, e dez novos convites por proprietário numa janela móvel de 24 horas. A flag `recce.invitations.enabled` fica desligada por omissão. O cancelamento nesta fase aplica-se a convites pendentes. A retirada de uma concessão ativa e o painel de acessos pertencem à P06.

## Componentes, fronteiras e validação

- `RallyInvitationController`, `RallyInvitationService` e respetivos modelos/repositórios. O alerta deriva do próprio convite. A caixa e a contagem por ler são pessoais e sem cache. O detalhe mostra o rali e o nome da tripulação no momento do envio.
- `ApiAuthInterceptor` e camada Angular de autenticação. As rotas resolvem a conta da sessão e autorizam o rali no backend, independentemente da tripulação selecionada.
- `RallyReadGrantRepository` e autorização P04. A decisão bloqueia o rali, relê o estado e grava a aceitação e o grant na mesma transação. Uma concessão nova guarda o ID do convite e a data de emissão. Uma concessão existente conserva a origem e uma inativa mantém-se inativa. A quota bloqueia a conta do proprietário e sobrevive à eliminação do rali.
- Angular: sino, caixa e detalhe em `/notifications`, formulário e histórico de envios no rali. O sino pede apenas a contagem, a cada 30 segundos e após uma decisão. O cronómetro não bloqueia a estabilidade do service worker.
- Um endereço ainda sem conta vê o pendente após verificação. A primeira leitura explícita ou decisão fixa o ID da conta. Um convite ainda sem ID e já expirado ou cancelado deixa de estar disponível para associação.

## Validação inicial

- `mvn.cmd resources:resources compiler:compile compiler:testCompile '-Dtest=RallyInvitationIntegrationTest,SharedRallyIntegrationTest,PersonalAccountIntegrationTest' surefire:test`: 26/26 na primeira passagem. Log `.factory-results/FEAT-022-backend-focused.log`.
- Compilação Java e typecheck iniciais passaram.
- `npm --prefix frontend run e2e:ci -- rally-invitations.spec.ts shared-rally.spec.ts personal-account.spec.ts legacy-migration.spec.ts`: 4/4. Inclui envio antes do registo, prova de verificação na caixa simulada, leitura do alerta sem acesso e abertura do rali após aceitação. Captura móvel inspecionada em `.factory-results/FEAT-022-invitation-mobile.png`. Log `.factory-results/FEAT-022-e2e.log`.
- `FACTORY_RISK=high node tools/run-quality-gate.mjs ticket AUTO`: STANDARD. Configuração Factory, Maven 69/69, lint e typecheck passaram. O teste Angular direcionado ficou 52/53 porque a simulação do detalhe do rali deixava por responder o novo GET de convites. O teste passou a esperar esse GET e verifica que o painel fica oculto quando a API devolve 403, conservando as asserções anteriores. Relatório bruto `.factory-results/FEAT-022-ticket.json`.
- `npm --prefix frontend run quality:standard` repete a validação Angular com a simulação corrigida. Os resultados Maven válidos são reutilizados.
- Após a revisão de origem da concessão, `mvn.cmd '-Dtest=RallyInvitationIntegrationTest,SharedRallyIntegrationTest' surefire:test`: 13/13, usando as classes recompiladas pelo harness. Confirma a origem da nova concessão e a preservação dos grants existentes. Log `.factory-results/FEAT-022-reviewed-backend.log`.
- A passagem Angular aprovou 53/53 testes direcionados e 203/203 de componentes. No Playwright, a composição do rali detetou um intervalo de 32 px onde o limite era 24 px. O host do painel oculto contava como elemento do layout. O painel foi integrado no resumo e a asserção original foi conservada.
- A mesma passagem terminou com 29/36 no browser. Além da composição do rali, seis tutoriais detetaram pedidos do sino ao recarregar a demonstração. A configuração das rotas identifica agora as demonstrações para manter o sino fora delas. O percurso de convites passou nessa passagem.
- Após as correções, `npm --prefix frontend run test:targeted`: 53/53. `npm --prefix frontend run e2e:ci -- rally-detail-composition.spec.ts rally-management.spec.ts rally-invitations.spec.ts workflow-tours.spec.ts notes-tour.spec.ts`: 12/12. Os sete cenários anteriormente falhados passaram com as asserções originais. No conjunto, os 36 cenários distintos tiveram evidência de aprovação. Logs `.factory-results/FEAT-022-frontend-reviewed.log` e `.factory-results/FEAT-022-e2e-reviewed.log`.
- `npm --prefix frontend run build` e `git diff --check`: PASS. Log `.factory-results/FEAT-022-frontend-build.log`.

| Critério | Verificação | Resultado |
| --- | --- | --- |
| AC1 | Integração HTTP e percurso no browser de envio até consulta P04 | PASS |
| AC2 | Máquina de estados, relógio controlado, deduplicação e corrida | PASS |
| AC3 | Isolamento da caixa e marcação sem efeitos de autorização | PASS |
| AC4 | Respostas equivalentes, conta posterior verificada e vínculo imutável | PASS |
| AC5 | Flag desligada e regressões P01/P04 | PASS |

## Revisão

- O backend verifica a identidade verificada e o rali imutável antes da decisão. A aceitação relê a propriedade e o estado depois de adquirir o lock do rali. A repetição não recria a concessão e o grant inativo mantém-se inativo.
- O resultado de envio não contém ID da conta, existência da conta nem dados de entrega. A caixa mostra só metadados do rali e da origem. A consulta e marcação de leitura não alteram permissões.
- A quota é persistida por proprietário fora do ciclo de vida do rali. O teste elimina o rali depois de atingir o limite e confirma que outro rali do mesmo proprietário continua limitado.
- Veredicto: APPROVE. Os problemas de integração, espaçamento e isolamento de demonstrações foram corrigidos e os testes afetados passaram. Os ensaios usaram H2 local e uma caixa simulada para a verificação P01.

## Gates

- **TICKET_GATE:** PASS no âmbito da P05, sustentado pelos resultados STANDARD e pelas repetições dirigidas depois das correções. Os relatórios originais conservam as falhas das primeiras execuções.
- **RELEASE_GATE:** BLOCKED por AUD-SEC-005 na baseline. O gate de release global e a auditoria de bootstrap não foram reexecutados nesta feature.
- A abertura pública dos convites continua dependente da P06. Em configuração normal a flag fica desligada. A P05 inclui apenas o cancelamento de convites pendentes.

## Histórico

- 2026-11-10: especificação criada antes do código. P01/P04 confirmadas no checkout e decisão D06 solicitada.
- 2026-11-10: D06 aprovada e implementação iniciada.
- 2026-11-10: testes HTTP iniciais e percurso Playwright móvel aprovados, revisão de concorrência, privacidade e comportamento do sino concluída.
- 2026-11-10: repetições confirmaram as correções da composição do rali e dos pedidos durante tutoriais. Os critérios da P05 ficaram aprovados.
