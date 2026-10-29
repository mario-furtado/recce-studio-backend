# FEAT-010 — Arranque local do Main com recursos atualizados

- **Estado:** IN_REVIEW — correção local validada; disponível para utilização.
- **Perfil:** FAST — configuração/documentação, sem alteração de lógica de negócio.
- **Data:** 2026-10-28.

## Problema e causa confirmados
O processo27956 na8080 é org.example.Main iniciado pelo IntelliJ. O classpath contém target/classes, sem src/main/resources. A saída tinha apenas classes Java, sem application.properties/application.yml. O gate backend faz clean e executa compiler:compile/compiler:testCompile sem copiar recursos. O Make incremental pode continuar a considerar os recursos atualizados mesmo depois de terem sido removidos por esse clean externo.

O utilizador confirmou ausência de atualização mesmo após parar/executar novamente. A falta de DevTools explica apenas a ausência de reinício automático durante a execução; não é a correção para o problema confirmado após reinício.

## Objetivo e critérios
1. Main local define recursos/compilação como tarefa obrigatória antes de org.example.Main, na raiz correta.
2. Goals copiam versões atuais dos dois recursos; arranque equivalente do Main com o mesmo Java8 da IDE carrega ambos e responde200.
3. Configuração local seleciona loopback, base persistente/uploads existentes e bootstrapfalse, sem credenciais embutidas; validação não para a8080 nem altera dados reais.
4. Documentação explica a seleção de Main local, a preparação, a diferença entre backend e Angular4200 e a ausência de hot reload automático.

## Decisões e âmbito
Nova configuração partilhada .run/Main_local.run.xml. Main/workspace.xml existentes preservados. resources:resources compiler:compile prepara backend sem executar o lifecycle que recompila Angular. Essa preparação corre em cada arranque, recuperando também recursos removidos por QA.

Main local usa a base já existente .factory-results/local-beta/data/beta e respetivos uploads, sem mover dados. Bootstrap desativado preserva contas existentes. Bases em memória de outras configurações não são migradas automaticamente. Não acrescentados DevTools, bibliotecas ou alterações a properties/pom/Main/gates.

## Ficheiros alterados
- .run/Main_local.run.xml: Run/Debug partilhado, módulo/classe/raiz e tarefa Maven obrigatória.
- docs/local-development.md: utilização, dados persistentes e diagnóstico.
- Este documento: especificação, decisões e resultados.

## Verificação dos critérios
| Critério | Evidência executada | Resultado |
| --- | --- | --- |
| AC1 | XML analisado; identificador Maven.BeforeRunTask e atributos file/goal confirmados no plugin IntelliJ instalado via javap; goals reais executados | PASS |
| AC2 | Maven BUILD SUCCESS; hashes source/output iguais para properties/yml; Main com Dragonwell8 e classpath sem test-classes, health200 e trace confirma importação de ambos | PASS |
| AC3 | Args revistos: loopback/persistência/bootstrapfalse; teste em18767 com H2mem, terminou só processo temporário; instância8080 e base beta intactas | PASS |
| AC4 | Documento revisto com instruções de seleção, fallback e diferença frontend/backend | PASS |

## Comandos e resultados
- mvn.cmd resources:resources compiler:compile: PASS; dois recursos copiados, compilação verificada. Primeira tentativa na sandbox falhou por AccessDenied na cache Maven; reexecução autorizada fora da sandbox passou.
- .factory-results/FEAT-010-check.ps1: PASS; verifica XML, hashes e arranque/health/config trace; inicia e termina apenas o Main de validação18767, base H2 temporária em memória e bootstrapfalse.
- node tools/validate-factory.mjs: PASS.
- Revisão focalizada FAST: APPROVE; sem alterações de lógica, credenciais, permissões ou dados. Sem agentes independentes ou testes que apenas espelhem configuração.

Logs: .factory-results/FEAT-010-prepare.log, FEAT-010-check.log, FEAT-010-main-probe.log, FEAT-010-validation.json e FEAT-010-factory.log. Revisão em FEAT-010-review.md. Gates focados assentam nestas execuções; não foi corrido o wrapper global do workspace com alterações anteriores não relacionadas.

## Limitações
O botão Run dentro do IntelliJ não foi automatizado: verificaram-se o contrato do plugin instalado e a execução equivalente dos goals/Main. O utilizador tem de selecionar Main local; a configuração Main antiga mantém-se. A instância atual não foi reiniciada, não houve migração de bases em memória ou escrita na base beta. Sem suite global/release, push, merge ou deploy.

## Gates independentes
- **TICKET_GATE:** PASS / APPROVED — critérios locais verificados, revisão FAST aprovada.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED.

## Histórico
- 2026-10-28: PLANNED — diagnóstico confirmado e especificação antes de editar.
- 2026-10-28: IN_PROGRESS — configuração partilhada e documentação; recursos repostos e Main isolado validado.
- 2026-10-28: IN_REVIEW — QA/revisão FAST aprovadas; disponível em Main local.
