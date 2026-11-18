# FEAT-030 — Registo e dados pessoais da conta

- **Estado:** IN_REVIEW
- **Perfil:** STANDARD com testes de autenticação, privacidade e persistência.

## Objetivo e critérios de aceitação

1. Dado que o envio está configurado, o pedido de registo recebe só o email e envia um link de uso único. Só é criada uma conta após confirmação válida e submissão de nome, data de nascimento e password.
2. Dados inválidos, pedido com campos indevidos, link expirado ou repetido não criam conta. Um erro de validação pode ser corrigido com o mesmo link ainda válido.
3. O link abre a configuração na aplicação. Depois da configuração, o utilizador regressa ao login, entra e consulta os seus dados.
4. A conta autenticada pode corrigir nome e data de nascimento. O backend identifica o titular pela sessão. Leitura e escrita dos dados são privadas e as contas anteriores continuam a funcionar.
5. A recuperação de password mantém-se separada, com a mesma regra de não alterar o perfil. O registo respeita a ativação SMTP existente.

## Âmbito e decisões

- Reutilizar FEAT-018. Guardar nome e data apenas na conta, após prova de controlo do email. O endereço, a password e os dados pessoais ficam fora dos links e da cache do frontend.
- Validar nome com limite de 120 caracteres e datas reais em formato ISO até hoje. Não estabelecer idade mínima ou pedir outros dados sem uma necessidade de produto. As colunas novas aceitam nulo para contas anteriores.
- Para as contas existentes, a secção Dados pessoais permite preencher os campos em falta. A alteração de email permanece fora do âmbito e a password mantém o percurso de recuperação existente.
- Validar com SMTP de ensaio e browser isolado. O envio real depende de domínio verificado, URL público e credenciais Resend do ambiente.

## Alterações, testes e revisão

- Backend: `AuthUserEntity`, `PersonalAccountService` e `PersonalAccountController`. Duas colunas anuláveis e validação no servidor. A atualização usa a sessão autenticada e confirma a validade novamente sob bloqueio da conta.
- Frontend: formulários de confirmação e de dados pessoais nos componentes de acesso e de conta. O estado mostrado é descartado se a sessão local mudar. A resposta de dados pessoais usa `Cache-Control: no-store`.
- Testes: suites Java de conta e convites, componente de acesso e percursos Playwright que criam contas.
- Compatibilidade de publicação: frontend e backend devem ser atualizados em conjunto, porque a confirmação de um novo registo passa a exigir nome e data. As contas já criadas não têm de repetir o registo.

### Execução

- `mvn -o compiler:compile compiler:testCompile -Dtest=PersonalAccountIntegrationTest,RallyInvitationIntegrationTest,SmtpAccountMailerTest,LegacyCrewMigrationIntegrationTest surefire:test` passou 36/36 em Java 8 e H2. O teste SMTP verifica o link enviado por um servidor local de ensaio. O teste de conta cobre data inválida, link reutilizável após erro, persistência, isolamento entre titulares e sessão revogada. Log `.factory-results/FEAT-030-backend.log`.
- `npm --prefix frontend run test:targeted` com os specs de acesso, conta, login e interceptor passou 41/41. Log `.factory-results/FEAT-030-angular.log`.
- `npm --prefix frontend run factory:validate`, `lint` e `typecheck` passaram. `npm --prefix frontend run test:integration` passou 210/210. Logs `.factory-results/FEAT-030-*.log`.
- `npm --prefix frontend run e2e:ci -- personal-account.spec.ts crew-context.spec.ts rally-invitations.spec.ts rally-areas.spec.ts`: 4/5 na primeira passagem. O registo com nome/data, o retorno ao login e a edição persistente passaram. O cenário de ralis procurava o nome antigo do link de partilhas. O seletor foi atualizado preservando as asserções do percurso. Log `.factory-results/FEAT-030-e2e.log`.
- `npm --prefix frontend run e2e:ci -- rally-areas.spec.ts`: 1/1. Os cinco percursos dirigidos passaram em duas execuções. Log `.factory-results/FEAT-030-rally-areas-recheck.log`.
- Build de produção concluído pelo runner E2E. Aviso de tamanho inicial de 500,37 kB face ao limiar de aviso de 500 kB.
- Ensaio SMTP complementar com Mailpit em loopback, H2 em memória e frontend de ensaio separado. O Chrome pediu um link para um endereço fictício, abriu o link da mensagem recebida, completou os dados, voltou ao login e entrou na conta. Log `.factory-results/registration-preview/verification-final.log`. A instalação habitual na porta 8080 continuou com o registo fechado.

### Revisão

- Os dados pessoais não fazem parte do pedido inicial de registo, do email, do token ou da resposta de login. Só são lidos e atualizados pelos endpoints da sessão atual. Os campos enviados não aceitam identificação de outra conta.
- A validação acontece antes da gravação e do consumo da prova. A reposição de password rejeita os novos campos e não altera o perfil.
- A entrega real via Resend e a atualização de esquema na base de publicação ficaram por validar. O backend local só abre o fluxo com a configuração de email ativa.
- Parecer técnico: APPROVE. Critérios 1 e 2 cobertos por H2 e simulador SMTP. Critérios 3 a 5 cobertos por H2, testes Angular e Playwright. Implementação em revisão para aprovação do utilizador.

## Gates

- **TICKET_GATE:** PASS no âmbito da validação STANDARD dirigida, com email de ensaio. O runner integral do repositório ficou por executar.
- **RELEASE_GATE:** NOT_RUN (UNVERIFIED).

## Histórico

- Especificação criada antes da implementação.
- Registo e edição implementados e verificados. Revisão concluída e entrega para aprovação.
