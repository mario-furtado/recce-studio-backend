# FEAT-028 — Validação das hipóteses comerciais

- **Roadmap:** UAC-P11
- **Estado:** IN_REVIEW
- **Perfil:** FAST para o simulador local isolado, com browser dirigido e regressão H2 da fronteira READ.

## Objetivo e âmbito

Comparar a compreensão e a preferência pelo modelo por rali e pelo modelo anual. A experiência usa cenários fictícios e trata ambos como hipóteses. Preços, cobrança, quotas, renovação e habilitações reais ficam fora da entrega.

## Requisitos e critérios de aceitação

1. **Piloto:** dado um participante, quando compara as duas hipóteses, identifica a unidade de pagamento de cada uma e pode escolher uma, nenhuma ou indicar indecisão. A experiência distingue cenários fictícios de condições comerciais disponíveis.
2. **P11-AC1:** dado um leitor com READ concedido e caderno publicado, quando consulta o rali ou exporta o caderno, mantém o percurso atual sem subscrição própria. Um terceiro continua sem acesso.
3. **P11-AC2:** dada uma alteração de estado comercial no cenário fictício, quando o participante simula a ativação ou expiração, a propriedade, os grants, os dados e as revogações reais mantêm-se. No cenário, uma opção comercial não concede permissões de colaboração.
4. **P11-AC3:** dada a política D08 aprovada para o piloto, quando expira a hipótese simulada, o proprietário e o leitor autorizado mantêm consulta e exportação. O acesso revogado continua indisponível. As operações futuras de escrita ficam por definir.

## Casos limite

Sem preferência, atividade esporádica, escolha anual por várias participações, exportação sem publicação, READ revogado, acesso de terceiro e recarregamento durante uma simulação. Os cenários nunca reutilizam registos nem credenciais reais.

## Dependências e decisões

- Em 2026-11-11 foi aprovada a D08 para o piloto. Uma expiração simulada mantém consulta e exportação já autorizadas, incluindo para leitores. Uma revogação mantém-se. Quotas e novas criações continuam por definir.
- O piloto aprovado é local, sem pagamentos nem recolha automática. A avaliação é moderada, com resultados agregados. O HTML funciona fora da aplicação e usa controlos nativos e dados em memória.
- P04/P06/P08 fornecem READ por rali, caderno publicado, revogação e arquivo. A validação da FEAT-027 executou as regressões destas fronteiras. A P10 permanece bloqueada pela exportação de conta, recuperação e eliminação definitiva.
- A ordem de rollout recomendada mantém P10 antes de P11. Um piloto isolado pode produzir evidência de compreensão sem depender da execução do fecho de conta. Qualquer exposição pública requer revisão das dependências e regras comerciais.

## Verificação

| Critério | Teste/check | Resultado |
| --- | --- | --- |
| Piloto | Comparação por teclado e mobile, escolhas neutras, reinício e recarregamento | PASS técnico no Chrome a 360 px. Compreensão e preferência por medir com participantes. |
| P11-AC1 | Regressão de consulta, caderno publicado, acesso de terceiro e revogação | PASS no comportamento existente. |
| P11-AC2 | Dois modelos, dois estados e quatro perfis. O browser confirma zero pedidos de rede e nenhum erro de execução no cenário de acesso. | PASS no piloto. |
| P11-AC3 | Consulta e exportação mantidas para proprietário e leitor autorizado. Revogado e terceiro continuam sem acesso. | PASS no piloto segundo a D08 aprovada. |

## Protocolo de avaliação do piloto

1. Apresentar as duas hipóteses, sem preços, em ordens alternadas entre sessões. Usar um cenário com participação num único rali e outro com vários ralis durante o ano. Pedir ao participante que explique em que unidade escolheria pagar e porquê.
2. Mostrar os cenários de proprietário, leitor autorizado e leitor revogado. Pedir ao participante que preveja quem pode consultar e exportar antes e depois da expiração simulada. Confirmar a interpretação sem sugerir a resposta.
3. Oferecer as escolhas «Por rali», «Anual», «Nenhum» e «Ainda não sei». Separar a preferência da compreensão. Uma escolha indica intenção declarada, sem compromisso comercial.
4. Se a avaliação moderada for aprovada, pedir consentimento antes da sessão. Registar apenas contagens agregadas de escolhas e respostas corretas por cenário, com o número de respostas válidas. Sem emails, identificadores, gravações, texto livre ou recolha automática.

## Validação e revisão

- `mvn -o compiler:compile compiler:testCompile -Dtest=SharedRallyIntegrationTest surefire:test`: 14/14 em H2. Verifica grant limitado a um rali, caderno publicado, acesso de terceiro, revogação e arquivo. Log `.factory-results/FEAT-028-read-regression.log`.
- `npm --prefix frontend run factory:validate`: PASS. Log `.factory-results/FEAT-028-factory.log`.
- Evidência anterior reutilizada para o PDF. O Playwright da FEAT-027 aprovou o cenário `FEAT-021 reader opens only the granted rally and exports the owner publication`. Nenhum ficheiro desse percurso foi alterado pela FEAT-028.
- `npm --prefix frontend run e2e:ci -- commercial-preview.spec.ts`: 2/2. O primeiro teste percorre 16 combinações. O segundo verifica teclado, largura de 360 px, escolha opcional, reinício e recarregamento. Log final `.factory-results/FEAT-028-preview-verified.log`. Os logs das primeiras passagens conservam as falhas de carregamento e reinício.
- `node tools/run-quality-gate.mjs ticket AUTO`: PASS, perfil FAST com `FACTORY_RISK=low`, `FACTORY_MAVEN_TESTS=SharedRallyIntegrationTest` e `QUALITY_TARGET_SPECS=src/app/modules/core/interceptors/auth.interceptor.spec.ts`. Passaram configuração Factory, 14 testes Maven, lint, typecheck e 25 testes Angular. Relatório `.factory-results/FEAT-028-ticket.json`.
- A preferência comercial ainda não foi medida com participantes.

**Revisão do piloto:** APPROVE. A interface só lê os controlos locais e escreve texto no DOM. A política de conteúdo impede ligações e submissões, e restringe o script ao hash da versão revista. Nenhuma rota, autorização ou persistência da aplicação participa na simulação. Alterações ao script requerem atualizar o respetivo hash.

## Ficheiros alterados

- `docs/product/prototypes/p11-commercial-preview.html` disponibiliza o simulador local. Abrir o ficheiro diretamente no browser, sem iniciar o backend ou a aplicação.
- `frontend/e2e/commercial-preview.spec.ts` cobre os 16 cenários de acesso, teclado, mobile, preferências, reinício e isolamento do simulador.
- `docs/product/USERS_ACCESS_TO_BE.md` regista a aprovação da D08 para o piloto.
- Este documento especifica o piloto, a avaliação moderada e os resultados.

## Gates independentes

- **TICKET_GATE:** PASS para a implementação do piloto local. A validação das hipóteses com participantes continua UNVERIFIED.
- **RELEASE_GATE:** NOT_RUN (UNVERIFIED).

## Histórico

- 2026-11-11 — Especificação inicial e confirmação das dependências antes da implementação.
- 2026-11-11 — D08 aprovada para o piloto local. Implementação iniciada.
- 2026-11-11 — Simulador e testes de browser criados. A primeira execução Playwright falhou ao carregar o spec em CommonJS. Foi corrigida a resolução do caminho do ficheiro.
- 2026-11-11 — O teste mobile encontrou um conflito entre o ID do botão e o método nativo de reinício do formulário. Corrigido e submetido a nova verificação.
- 2026-11-11 — Browser e gate FAST aprovados. Piloto em revisão de produto, a aguardar as sessões moderadas.
