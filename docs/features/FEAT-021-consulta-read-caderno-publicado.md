# FEAT-021 — Consulta READ e publicação do caderno

- **Estado:** IN_REVIEW
- **Roadmap:** UAC-P04
- **Perfil:** STANDARD, com testes específicos de autorização, privacidade e persistência.

## Objetivo e âmbito

Permitir a uma conta com concessão READ consultar um rali e as respetivas PECs, notas, GPS e media, incluindo quando concluído. O proprietário publica uma versão explícita do caderno por PEC. A consulta e a impressão usam essa versão.
P02 e P03 estão presentes no checkout. D01 aprovada em 2026-11-10: concessão por rali. D09 aprovada na mesma data: publicação explícita com estilos mínimos e aviso se indisponível. Nesta fase as concessões são preparadas em fixtures. Convites, gestão de concessões, revogação operacional e partilha pública pertencem a fases seguintes.

## Requisitos e critérios de aceitação

1. **AC1:** Dada uma concessão READ ativa, quando a conta abre o rali, incluindo um concluído, consulta as suas PECs, notas, GPS e media. Outra conta, outro rali da mesma tripulação e IDs cruzados ficam excluídos, também em pedidos media/range.
2. **AC2:** Dada uma versão publicada pelo proprietário, quando um leitor com preferências diferentes consulta e imprime, obtém o conteúdo, estilo e capas dessa versão. Preferências privadas e dicionário ficam fora do DTO. Uma PEC sem publicação informa o leitor. Consultar e imprimir não escrevem na base.
3. **AC3:** Dado um leitor, quando tenta publicar, editar, eliminar, importar, sincronizar, alterar estado/capa ou carregar media, a API recusa. Cabeçalhos e parâmetros forjados não ampliam acesso.
4. **AC4:** Dado um proprietário, quando publica a pré-visualização válida, a versão é guardada e pode ser atualizada explicitamente. Alterações posteriores no modelo pessoal ou nas notas não modificam a versão anterior. Pedidos inválidos conservam a última publicação.
5. **AC5:** Dados os fluxos anteriores de proprietário P02/P03 e uma conta sem tripulação, os primeiros mantêm a autorização existente e a segunda pode consultar os ralis que lhe foram concedidos.

## Casos limite e componentes

Rali/PEC inexistente, concessão inativa, conta sem contexto, PEC de outro rali, conteúdo sem publicação ou inválido e media indisponível. A lista contém apenas ralis concedidos. Rotas de consulta explícitas reutilizam os serviços de PEC/media após validar o par rali/PEC. O estado de leitura nunca cria um contexto utilizável para escrita. A publicação usa uma representação de saída limitada e validada, sem regras privadas reutilizáveis nem HTML recebido do cliente.

## Implementação e ficheiros

- `SharedRallyController`, `RallyReadGrantEntity` e repositório: consulta explícita com filtro por conta, rali e PEC, ligada à flag existente `recce.crews.enabled`. As rotas de escrita continuam a resolver o contexto de proprietário.
- `BookPublicationController`, `BookPublicationService`, entidade e repositório: versão por PEC, escrita transacional serializada pela PEC, validação estrutural, eliminação por chave estrangeira. O proprietário de tripulação gerida pode publicar também em ralis concluídos, porque a publicação não edita o rali ou as notas.
- Angular: área «Ralis partilhados comigo» a partir da conta. A consulta usa o mapa e a impressão existentes. O Studio publica os blocos da pré-visualização, sem regras, correspondências, descrições ou HTML. A API valida o formato antes de guardar.
- QA: `SharedRallyIntegrationTest`, fixture isolada em `E2eServer` e `frontend/e2e/shared-rally.spec.ts`.
- `FileStorageService` e `FileStorageResourceTest`: o recurso S3 obtém o tamanho sem consumir os bytes e abre um novo stream quando o conversor HTTP precisa de o ler. O teste simula o cliente S3.

## Validação

| Critério | Verificação planeada | Resultado |
| --- | --- | --- |
| AC1 | Integração HTTP de lista, âmbito, recurso e media, incluindo conclusão, HEAD e Range | PASS |
| AC2 | Integração de privacidade/persistência e exportação Playwright em PDF, incluindo revisão móvel | PASS |
| AC3 | Matriz HTTP de escritas diretas e falsificação de contexto | PASS |
| AC4 | Publicações concorrentes, rejeição de input inválido e independência de preferências | PASS |
| AC5 | Regressões P02/P03 e entrada real em conta só de leitura | PASS |

- Primeira passagem de `SharedRallyIntegrationTest`: 3/3, com H2 e media locais sintéticos. Log `.factory-results/FEAT-021-backend-first.log`.
- Compilação Java e typecheck Angular iniciais aprovados. O primeiro arranque do Playwright no sandbox encontrou uma recusa de loopback. A repetição isolada fora do sandbox passou.
- `npm --prefix frontend run e2e:ci -- shared-rally.spec.ts legacy-migration.spec.ts reccebook-cover.spec.ts`: 4/4. Confirmados a entrada da conta sem tripulação, o aviso sem publicação, o PDF de três páginas com a versão publicada e as regressões de migração/capas. A inspeção da captura móvel detetou recorte lateral nos painéis. A largura da grelha foi corrigida e o teste passou a medir o limite visual de cada painel. O gate repete a validação na versão corrigida.
- `FACTORY_RISK=high node tools/run-quality-gate.mjs ticket AUTO` selecionou STANDARD. Configuração Factory e backend aprovados: 97/97 com `FACTORY_MAVEN_TESTS`, incluindo quatro casos READ/publicação e um de S3 simulado. Log e relatório bruto: `.factory-results/FEAT-021-ticket.log` e `.factory-results/FEAT-021-ticket.json`.
- No mesmo gate, passaram lint, typecheck, 59 testes direcionados e 203 testes de componentes. A compilação Angular de produção lançada pelo harness Playwright também passou.
- Playwright no gate: 35/35 cenários reportados como aprovados, incluindo o PDF de três páginas e as medições a 390 px. O runner devolveu erro por ultrapassar o limite global de 300 segundos, incluindo o encerramento. O relatório bruto conserva o resultado FAIL. As capturas e o PDF estão em `.factory-results/FEAT-021-reader.png` e `.factory-results/FEAT-021-publication.pdf`.
- `mvn.cmd compiler:compile compiler:testCompile '-Dtest=SharedRallyIntegrationTest,FileStorageResourceTest' surefire:test`: 6/6 na última revisão, incluindo o novo caso que verifica mensagens de erro sem paths internos para ficheiros ausentes. Log `.factory-results/FEAT-021-reviewed-backend.log`.
- `npm --prefix frontend run build` e `git diff --check`: PASS. O build separado cobre o passo que o runner STANDARD não chegou a executar. Log `.factory-results/FEAT-021-build.log`.

## Revisão

- A fronteira de leitura resolve a concessão pela conta autenticada e pelo rali da rota antes de disponibilizar o contexto aos serviços. A relação PEC–rali é validada antes de consultar notas, GPS, media e publicação. As escritas continuam a exigir contexto de proprietário.
- O DTO de consulta não inclui paths de storage nem apresentação privada. O snapshot contém apenas página, capas e blocos visuais. A versão é protegida por lock na PEC e por chave estrangeira que elimina a publicação quando a PEC é eliminada.
- A revisão encontrou o recorte móvel e o consumo do stream no recurso S3. As correções preservam o scroll interno à escala real do caderno e separam a leitura de metadados da abertura do stream. As verificações usam H2 e media locais, com cliente S3 simulado.
- Veredicto: APPROVE WITH NOTES. Sem findings bloqueantes no âmbito da P04. A verificação S3 usa um cliente simulado e a execução global do Playwright mantém a limitação de tempo descrita.

## Gates

- **TICKET_GATE:** PASS no âmbito da feature. Os cinco critérios passaram e o browser aprovou o percurso de consulta e exportação. O runner STANDARD bruto devolveu FAIL pela limitação global de tempo do Playwright.
- **RELEASE_GATE:** BLOCKED. A limitação do runner permanece e AUD-SEC-005 continua na baseline. A release global e o audit de bootstrap não foram reexecutados nesta feature.
- O ensaio usou H2, armazenamento local e S3 simulado. A atribuição de concessões foi exercitada em fixtures isoladas.

## Histórico

- 2026-11-10: especificação criada antes do código, com as decisões D01 e D09 aprovadas.
- 2026-11-10: implementação e primeira verificação de API e browser concluídas. Revisão de largura móvel e leitura de recursos S3 incorporada.
- 2026-11-10: revisão verificou os erros de armazenamento e o gate registou o timeout global apesar de 35 cenários aprovados.
