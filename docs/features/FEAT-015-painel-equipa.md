# FEAT-015 — Painel de equipa

- **Description:** Perfil/Equipa compacto, garagem centrada na viatura ativa, indicadores legíveis e PECs recentemente atualizadas com dados reais.
- **Status:** IN_REVIEW
- **Profile and reason:** STANDARD — alteração local de apresentação e percursos de gestão existentes; nova leitura de atividade sem escrita nem contratos backend.

## Objective and scope
Manter tema, tipografia e fundo atuais. Reduzir altura do cabeçalho, containers e ruído visual. Preservar perfil, logo, garagem, fotografias, seleção, criação/edição/eliminação, unidade e estatísticas. Não alterar regras de negócio, unidade armazenada, cálculos de distâncias ou sistema de notas.

## Requirements
1. Identidade da equipa e tripulação num cabeçalho compacto; uma entrada Editar Perfil.
2. Viatura ativa primeiro, fotografia real/fallback explícito, classe e notas; outras viaturas mais compactas, seleção acessível por botão.
3. Estatísticas como três números/legendas numa superfície, sem cartões individuais. TotalKm permanece em km como na API.
4. Unidade apenas nas definições dentro da edição do perfil, guardada pelo PATCH existente.
5. Área de atividade com até cinco PECs com updatedAt válido, data real e ligação à PEC; vazio, carregamento e erro distintos.
6. Inputs com labels visíveis, foco e targets >=44px, hierarquia sem containers decorativos aninhados, desktop/móvel sem overflow.

## Acceptance criteria
1. Given perfil carregado, when apresentado, then cabeçalho identifica equipa/piloto/copiloto com logo de 64px e ação Editar Perfil; nomes longos não causam overflow a 360px.
2. Given garagem com viatura ativa, then esta surge primeiro e destacada com fotografia quando disponível; sem fotografia ou viatura ativa há fallback honesto. Selecionar outra mantém API/comportamento.
3. Given estatísticas da API, then os três valores reais são apresentados sem metric-tile/cards individuais nem conversão implícita de km.
4. Given Editar Perfil, then dados, logo e unidade estão acessíveis com labels; Guardar/Cancelar mantêm persistência e não alteram noteSystem.
5. Given PECs com datas, then atividade mostra até cinco mais recentes com nome/rali/data e link correto; datas inválidas/ausentes não geram eventos; vazio e falha são explícitos, sem dados fictícios.
6. Given gestão da garagem, then criar, editar, selecionar, foto e eliminar com confirmação continuam funcionais e disponíveis por teclado.
7. Given desktop e viewport 360px, then layout legível sem scroll horizontal, controlos >=44px e foco visível; regressões de notas/tutorial não são introduzidas.

## Edge cases and expected errors
Equipa/garagem vazias, tripulação por definir, nomes longos, ausência/falha de fotos, falha de perfil/estatísticas (mensagens atuais), falha de atividade com retry local, datas inválidas, PECs no mesmo dia sem inventar ordenação temporal mais fina. Falhas de gravação mantêm fluxo atual.

## Components, dependencies and risks
TeamProfileComponent, TeamProfileService inalterado, RallyService e modelos Pec/Rally existentes. Atividade só lê endpoints autenticados já isolados pelo backend; não inclui sessões offline de outras contas nem dados locais. Riscos: seleção acidental ao editar um carro, perda de campos/ações e overflow; cobrir unitários/E2E.

## Technical decisions
- Apenas HTML/CSS local e projeção readonly no componente; reutilizar glass-panel, themed-input, soft/accent/danger-button e ConfirmDialogService. Sem dependências.
- Unidade permanece da equipa, na mesma entidade/PATCH; deslocada visualmente para Definições do perfil em edição, sem criar preferência paralela.
- Atividade representa exclusivamente PECs atualizadas, não audit log. API fornece data ao dia, sem hora/autor; usar rótulo explícito. Endpoints existentes exigem uma leitura de ralis e uma por rali com PECs, concorrência limitada a quatro; guardar apenas cinco resultados finais. Sem endpoint novo neste redesign.
- Garagem ordena ativa primeiro sem mutar dados; seleção por botão próprio, evitando card inteiro clicável e cliques acidentais em ações.

## Changed files
Alterados: `frontend/src/app/modules/features/team-profile/team-profile.component.{ts,html,css}` (layout e projeção readonly); `team-profile.component.spec.ts` (novo); `frontend/e2e/team-dashboard.spec.ts` (novo); `frontend/src/app/modules/features/tutorial/workflow-tour.steps.ts` (localização da unidade).

## Acceptance verification
| Criterion | Test/check and scenario | Executed result | Evidence |
| --- | --- | --- | --- |
| AC1 | E2E: equipa/tripulação, cabeçalho desktop <150px, viewport360; revisão de overflow-wrap para nomes longos | PASS | FEAT-015-e2e.log e capturas |
| AC2 | Unitário: ativa primeiro sem mutação; E2E: seleção/fotografia real/reload; estados sem fotografia/sem ativa no template | PASS | FEAT-015-focused.log, E2E |
| AC3 | Unitário: valores da API e km preservados com preferência milhas; ausência de metric-tile | PASS | FEAT-015-focused.log |
| AC4 | Unitário: cancelamento/unidade/PATCH sem noteSystem; E2E: guardar/reload e isolamento das notas; logo mantém handler e picker acessível | PASS | FEAT-015-focused.log, E2E e revisão |
| AC5 | Unitário: datas válidas/ordem/cap5, vazio, loading/erro/retry/cancelamento; E2E final compara links reais da lista | PASS | Gate STANDARD final 2026-10-29T15-09-26.875Z-ticket-standard |
| AC6 | Unitário: edição não seleciona e confirmação obrigatória; E2E real criar/editar/selecionar/foto/cancelar/eliminar/reload | PASS | FEAT-015-e2e.log |
| AC7 | Angular accessibility/notes/workflow-tour, auditoria estática, desktop/móvel/targets e foco/Enter no primeiro gate | PASS | FEAT-015-focused.log, FEAT-015-accessibility.log, gate |

## Validation and review
Testes direcionados antes do gate `node tools/run-quality-gate.mjs ticket AUTO` (FACTORY_RISK=medium, QUALITY_TARGET_SPECS específico). factory-qa e factory-review no mesmo fluxo. Sem auditorias globais/release DEEP.

## Problems and limitations
Atividade depende da precisão/cobertura de updatedAt existente; não garante registo de todas as edições de notas nem ordem dentro do mesmo dia. Não inventar informação ausente. Navegadores/dispositivos por validar registados no fecho.

## Independent gates
- **TICKET_GATE:** PASS / APPROVED — 7/7 critérios verificados, regressões e revisão aprovadas.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED.

## Implementation history
- 2026-10-29: PLANNED — especificação criada antes de alterar código; raiz/regras confirmadas, árvore de trabalho inicialmente limpa. Diagnóstico em código: cabeçalho 96px + padding32, cartões de métricas e coluna Unidades sem outro conteúdo.
### Evidência intermédia
- 2026-10-29: IN_PROGRESS — layout e projeção de atividade implementados; handlers de persistência/API da equipa preservados. Tutorial atualizado para localizar a unidade em Editar Perfil.
- `npm --prefix frontend run test:targeted` com team-profile, accessibility, notes e workflow-tour specs: **31/31 PASS**. Primeiro arranque bloqueou por tipagem incompleta da fixture de rali, corrigida com objeto completo; log preservado em `.factory-results/FEAT-015-focused-initial.log`.
- `npm --prefix frontend run audit:accessibility`: **PASS** (`FEAT-015-accessibility.log`).
- Primeiro E2E: regressão de notas PASS; gestão de perfil/carro/foto/atividade passou até à medição dos targets. A query por role button incluía inputs file ocultos, medindo o input em vez do label visível; corrigida para medir botões e labels acionáveis, mantendo >=44px. `FEAT-015-e2e-initial.log` preservado. Repetição em curso.
- Capturas desktop/móvel inspecionadas; superfície de métricas e atividade usam dados reais. Adicionado estado explícito sem viatura ativa. Fotografia usada no E2E é um pequeno PNG de teste carregado pela API, não um asset fictício da aplicação.
- Repetição E2E focada: **2/2 PASS**, `FEAT-015-e2e.log`; confirmação/cancelamento/eliminação real, criação/edição/seleção/foto, perfil/unidade, dados preservados após reload e targets/overflow aprovados. Acrescentada asserção explícita de foco e entrada por Enter para o gate final.
- 2026-10-29: IN_REVIEW — revisão técnica do âmbito sem achados bloqueantes; critérios e resultados finais pendentes do gate STANDARD. Nenhuma alteração de lógica de negócio, serviços/API ou dependências.
- Primeiro gate STANDARD: config/lint/typecheck/direcionados31/31/integração174/174 PASS; E2E25 PASS +1 FAIL (novo teste assumia que a PEC criada ficaria sempre entre as cinco no mesmo dia). Dados reais de cenários anteriores e desempate por ID podem excluí-la legitimamente. Corrigido o teste para verificar lista completa esperada a partir da API, incluindo limite/ordem/nomes/links; nenhuma alteração ao código do produto ou enfraquecimento do limite. Evidência preservada em FEAT-015-ticket-first.log/json e 2026-10-29T14-58-31.459Z-ticket-standard/. Build final desse gate não executado por fail-fast; build do harness passou.
- Segundo gate: direcionados31/31 e integração174/174 PASS; novo E2E de equipa PASS, incluindo foco/Enter e lista exata da API; E2E25 PASS +1 FAIL no teste FEAT-003 de vídeo (readyState0 em vez de >=2 dentro de5s). Esse cenário tinha passado no primeiro gate e não existe alteração de Studio/media neste diff. Baseline consultada: sem assinatura ativa para este timeout; não classificado automaticamente como falha conhecida. Nova execução para verificar repetibilidade sem alterar/ignorar o teste. Evidência: FEAT-015-ticket-second.log/json, 2026-10-29T15-03-39.568Z-ticket-standard/.

## Resultado final executado
| Comando/check | Perfil/ambiente | Resultado | Evidência em .factory-results/ |
| --- | --- | --- | --- |
| `npm --prefix frontend run test:targeted` (team-profile, accessibility, notes, workflow-tour specs) | STANDARD / Windows, Node22, Chrome Headless | 31/31 PASS | FEAT-015-focused.log |
| `npm --prefix frontend run e2e:ci -- e2e/team-dashboard.spec.ts e2e/note-settings.spec.ts` | Backend H2 isolado18765, frontend18766 | 2/2 PASS; foco/Enter e fixture partilhada também verificados no gate final | FEAT-015-e2e.log |
| `node tools/run-quality-gate.mjs ticket AUTO` | FACTORY_RISK=medium, QUALITY_TARGET_SPECS iguais aos quatro acima; scope frontend/factory | STANDARD PASS: config, lint, typecheck, direcionados31/31, integração174/174, E2E26/26 + runner3/3, build | FEAT-015-ticket.log/json; 2026-10-29T15-09-26.875Z-ticket-standard/ |
| `npm --prefix frontend run audit:accessibility` | Estático, complementado por browser/teclado | PASS | FEAT-015-accessibility.log |
| `git diff --check` e revisão técnica/visual | Diff local completo, estados/ações/contratos e capturas desktop/móvel | PASS; revisão APPROVE WITH NOTES | FEAT-015-qa-review.md, FEAT-015-desktop.png, FEAT-015-mobile.png |

- Bundle inicial **487,61 kB**, abaixo do warning budget500kB; sem aviso de CSS. Aviso NG8113 RouterLink preexistente, sem investigação repetida. Sem dependências ou budgets alterados.
- O timeout readyState do vídeo não se repetiu no gate final, sem qualquer alteração ao teste/código de media. É uma ocorrência intermitente observada, causa não determinada; não é apresentada como bug corrigido nem removida do histórico. Sem regressão de produto identificada no âmbito da feature.
- Revisão final: **APPROVE WITH NOTES**, nota sobre a ocorrência no teste de vídeo e os limites da atividade/das plataformas. Testes backend específicos, auditorias globais e release não executados, pois o âmbito é frontend e não altera regras/contratos/autorização. Não foi usado FACTORY_TICKET_ID fictício.
- Limites de validação: Chrome/Windows, desktop e viewport móvel360px; sem Safari/Firefox, leitores de ecrã reais ou dispositivos físicos. Atividade não é audit log e não distingue hora/autor no mesmo dia; API atual implica ler PECs por rali não vazio (concorrência4).
- **TICKET_GATE: PASS / APPROVED**; **RELEASE_GATE: NOT_RUN / UNVERIFIED**. Nenhuma aprovação global de release inferida.
- 2026-10-29: **IN_REVIEW**, 7/7 critérios verificados no âmbito documentado; pronto para aprovação visual. Sem push, merge, deploy, alterações da base beta ou reinício do backend local. Logs extensos preservados, incluindo as execuções com falhas intermédias.
