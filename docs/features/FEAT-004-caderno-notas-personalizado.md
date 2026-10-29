# FEAT-004 — Caderno de notas personalizado

- **Description:** Dicionário visual pessoal, blocos de notas configuráveis e caderno paginado exportável para PDF.
- **Status:** IN_REVIEW
- **Profile:** STANDARD — interface, persistência pessoal, isolamento e risco de omitir informação impressa.

## Objetivo e âmbito
Configurar no perfil um modelo pessoal editável e reutilizá-lo na edição de notas e no caderno. O dicionário de voz existente e o texto original das notas mantêm-se compatíveis. Estado atual observado: dicionário frase/símbolo existente, Studio apresenta texto simples e exportação Excel; não existe composição visual nem caderno paginado.

## Requisitos
1. Dicionário pessoal com correspondência, significado, símbolo, papel, associação ao bloco anterior/seguinte/independente e estilo.
2. Nove posições por bloco, tamanho relativo, negrito, sublinhado e destaque; múltiplos blocos por linha. Nenhum significado universal atribuído a símbolos desconhecidos.
3. A4/A5, orientação, margens, linhas/página, separadores e tamanho de letra no perfil autenticado.
4. Pré-visualização real e distribuição automática de blocos por linhas/páginas; impedir exportação quando um bloco ou altura exceder a área. Nunca truncar nem reduzir fonte automaticamente.
5. Exportação pela impressão nativa do navegador, com opção Guardar como PDF; sem nova dependência ou serviço externo. O utilizador confirma destino e opções do diálogo. Pré-visualização e impressão usam o mesmo DOM/estilos.
6. Preferências guardadas no servidor por conta; erros explícitos, sem migração silenciosa de definições de outras contas.

## Critérios de aceitação
1. Given utilizador autenticado, when edita e guarda o modelo, then recarregar recupera dicionário, estilos e página.
2. Given duas contas (mesmo que da mesma equipa), when guardam modelos diferentes, then não conseguem ler nem alterar o modelo alheio; anónimos recebem 401.
3. Given E6++ nt e modelo configurado, when pré-visualiza, then E6 fica no centro, ++ superior direito e nt inferior direito; posição e estilo são editáveis.
4. Given D6 > E3 60 ATT E1 NC, when compõe, then preserva todos os elementos, agrupa apenas segundo regras configuradas e apresenta múltiplos blocos. Texto desconhecido permanece legível.
5. Given notas existentes ou edição em curso no Studio, when usa o modelo, then mostra a composição sem alterar texto, observações, GPS ou tempos originais.
6. Given sequência longa, when excede a largura, then distribui blocos por mais linhas, respeita linhas/página e separadores. Notas e observações permanecem completas.
7. Given configuração fora dos limites, when guarda, then rejeita-a sem substituir o modelo anterior; given bloco demasiado grande para a página, when tenta exportar, then apresenta erro acionável e bloqueia a impressão sem cortar texto ou diminuir fonte.
8. Given caderno válido, when imprime/guarda PDF, then páginas mantêm dimensões e disposição da pré-visualização e excluem a interface de controlo.

## Casos limite e erros
Dicionário vazio, símbolos Unicode e HTML literal; correspondências sobrepostas resolvidas pela mais longa; regra duplicada rejeitada; modificador sem curva permanece visível; quebras explícitas preservadas; notas vazias, observações longas, excesso de largura/altura, indisponibilidade do backend. Alterações ao modelo não reescrevem notas guardadas. Configuração limitada em tamanho e enums no servidor.

## Componentes, dependências e riscos
Endpoint autenticado pessoal; entidade separada de preferências; componente de configuração no perfil; compositor reutilizável e caderno no Studio. Riscos: fuga entre contas, associação incorreta de modificadores, sobreposição, paginação e diferenças de impressão. Sem alteração das regras de condução, reconhecimento ou vídeo/GPS. Não reiniciar backend local existente com H2 em memória.

## Decisões técnicas
Modelo versionado JSON validado; identidade obtida exclusivamente da autenticação. Sem cache partilhada; respostas de preferências usam no-store, incluindo modelo inexistente. Modelo inicial é sugestão editável, não interpretação universal. Associação de modificadores é explícita e limitada à sequência contígua: quebra de linha ou elemento independente/desconhecido interrompe a associação. Regras são literais, sensíveis a maiúsculas e limitadas a 250 elementos; posições/estilos são valores validados, nunca HTML/CSS livre. Preferências válidas podem ser guardadas independentemente do texto usado na amostra; a verificação de encaixe aplica-se ao caderno a imprimir. Impressão local sem envio de notas a terceiros. Etapas: persistência/compositor; configuração e Studio; paginação/impressão; QA/revisão.

## Ficheiros alterados
- Backend: `NotebookPreferencesEntity`, `NotebookPreferencesRepository`, `NotebookPreferencesController`, `NotebookPreferencesValidator` e `NotebookPreferencesIntegrationTest`.
- Frontend: `core/notebook/notebook.model.ts`, `notebook.service.ts`, `note-display.component.ts`, `notebook.component.ts`, `notebook-settings.component.ts/.html`, specs do modelo/componente, integração em `team-profile.component.ts/.html` e `pecs-editor.component.ts/.html`.
- Testes de regressão adaptados sem remover asserções: `accessibility.component.spec.ts` verifica separadamente os 257 novos campos; `recce-routing.component.spec.ts` verifica explicitamente o novo GET pessoal e mantém a restrição às leituras da PEC escolhida.
- E2E: `frontend/e2e/notebook.spec.ts`; isolamento de configurações auxiliares em `src/test/java/org/example/e2e/E2eServer.java` e classificação correta de `TestUserBootstrapAuditTest.BootstrapConfig` como `@TestConfiguration`.
- Este documento e `docs/e2e.md` com os dois novos percursos e o contrato de impressão/persistência real.

## Verificação dos critérios
| Critério | Verificação executada | Resultado |
| --- | --- | --- |
| AC1 | E2E `notebook.spec.ts`: configuração pela UI, PUT real, recarga e recuperação de A5 horizontal/posição/sublinhado; HTTP/JPA confirma conteúdo persistido | PASS |
| AC2 | `NotebookPreferencesIntegrationTest`: 401 anónimo, duas contas da mesma equipa, PUT independente, userId forjado rejeitado, URL alheio 404 e DELETE 405; serviço sem cache de outra conta | PASS |
| AC3 | `notebook.model.spec.ts`: E6++ nt com centro/top-right/bottom-right; E2E altera ++ para top-left e sublinhado e confirma CSS após recarga | PASS |
| AC4 | Compositor verifica todos os elementos de D6 > E3 60 ATT E1 NC, prioridade da correspondência mais longa, órfãos, Unicode e HTML literal; ocupantes da mesma posição não se sobrepõem | PASS |
| AC5 | E2E compara texto/observações/tempos originais na API depois de exportar; percurso crítico original cria nota na UI e confirma persistência após recarga; regressões Studio/mapa/vídeo passam | PASS |
| AC6 | Browser mede todos os blocos e confirma ausência de overflow; sequência longa ocupa 3 páginas de 3 linhas; observações e separadores preservados | PASS |
| AC7 | Backend rejeita números inválidos/fracionários, versões, posições, tamanhos e regras duplicadas sem sobrescrever; componente e E2E bloqueiam conteúdo demasiado largo/alto e apresentam orientação de recuperação | PASS |
| AC8 | PDF Chromium do DOM de impressão real: 3 páginas A5 horizontal, sem botões; tamanho verificado com tolerância de 1 ponto ao arredondamento Chromium. Leitura pypdf confirma ATT=12, NC=12 e observações. Pré-visualização inspecionada visualmente | PASS |

## Validações e revisão
Skills factory-qa e factory-review aplicadas no mesmo fluxo, sem agentes adicionais. Perfil STANDARD escolhido automaticamente com `FACTORY_RISK=medium`, sem FACTORY_TICKET_ID (não existe ticket canónico para esta feature).

| Comando | Resultado final executado | Evidência |
| --- | --- | --- |
| `node tools/run-quality-gate.mjs ticket AUTO` | PASS: factory config, backend 32/32 sem skips, lint, typecheck, targeted 75/75, integração 112/112, E2E 9/9 + wrapper 3/3 e build | `.factory-results/FEAT-004-ticket-approved.log`, `FEAT-004-ticket.json`; logs individuais em `.factory-results/2026-10-24T08-49-29.735Z-ticket-standard/` |
| `npm --prefix frontend run e2e:ci -- notebook.spec.ts` | PASS: 2/2 percursos específicos (e novamente no gate final) | `.factory-results/FEAT-004-e2e-focused.log` |
| `npm --prefix frontend run audit:accessibility` | PASS | `.factory-results/FEAT-004-accessibility.log` |
| Python/pypdf: `PdfReader`, contagem de páginas, ATT/NC e observações | PASS: 3 páginas, 594.95996 × 420 pt, 12 ATT + 12 NC; ambas as observações presentes | `.factory-results/FEAT-004-pdf-check.log`, `FEAT-004-notebook.pdf` |
| Inspeção visual e `git diff --check` no âmbito alterado | PASS: disposição/avisos/separadores observados; sem erros de whitespace | `.factory-results/FEAT-004-notebook.png`, `FEAT-004-qa-review.md` |
| Verificação da instância beta `localhost:4200` → backend `8080` | PASS após atualização do processo: login com as mesmas credenciais, edição de linhas 8→7 e tamanho ++ 60→65, gravação e recuperação após reload; valores iniciais repostos e guardados | `.factory-results/FEAT-004-beta-runtime.json`, `FEAT-004-beta-editable.png`, `FEAT-004-beta-verification.md` |

Seleção Maven: `FACTORY_MAVEN_TESTS=NotebookPreferencesIntegrationTest,NoteWorkflowIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest,TestUserBootstrapAuditTest#auditSec005ExplicitDisableDoesNotAccessPersistence+auditSec005ExplicitEnableFailsClosedOutsideLocalEnvironments+auditSec005ExplicitLocalOptInStillCreatesHashedCredentials`.

Seleção Angular `QUALITY_TARGET_SPECS` (separada por vírgulas, relativa a frontend): `src/app/modules/core/notebook/notebook.model.spec.ts`, `src/app/modules/core/notebook/notebook.component.spec.ts`, `src/app/modules/features/pecs/pecs-editor/pecs-editor.component.spec.ts`, `src/app/modules/features/pecs/pecs-editor/media-map-sync.component.spec.ts`, `src/app/modules/features/pecs/pecs-editor/recce-routing.component.spec.ts`, `src/app/accessibility.component.spec.ts`, `src/app/modules/core/services/recce-note-parser.service.spec.ts`.

Ambiente: Windows, Node 22 do runtime local, Java/Maven do ambiente e Chrome Headless 156. Chrome inicialmente bloqueado pela sandbox; testes browser executados fora dela. Build final: 475.63 kB iniciais, abaixo do aviso de 500 kB. Aviso preexistente RouterLink não utilizado em PecsListComponent permanece.

Revisão factory-review: **APPROVE**, sem achados bloqueantes pendentes. Revistos identidade exclusivamente autenticada, isolamento por userId persistido, validação/limites, XSS, falha de gravação, compatibilidade das notas antigas, paginação, clone de impressão sem interface e regressões. Corrigida a concatenação de palavras no DOM, mantendo o E2E original e acrescentando uma regressão de espaçamento/nome acessível.

## Problemas e limitações
- Nenhuma regressão introduzida permanece nos checks executados. Falhas intermédias corrigidas: contratos antigos de testes de navegação/campos, nomes acessíveis dos seletores e separação textual do compositor; configuração auxiliar de mocks foi isolada do servidor E2E.
- A impressão exige confirmação no diálogo do navegador, escolhendo Guardar como PDF; preferências do diálogo podem alterar a escala. Impressão física e browsers distintos do Chromium não foram validados.
- Modelo pessoal e apresentação são independentes do dicionário de voz existente; não reescrevem notas antigas ou regras de condução.
- Nova tabela `notebook_preferences` validada em H2/JPA; migração PostgreSQL de produção e persistência entre reinícios de uma BD de produção não executadas.
- A primeira entrega foi validada num backend E2E isolado; a instância beta ainda executava o PID 22908, iniciado em 23/10 antes da feature. Confirmado pedido CORS para o novo endpoint rejeitado com 403, justificando os campos bloqueados nas imagens do utilizador. Não era uma falha de permissões do modelo.
- Seguimento de 24/10: utilizador autorizou eliminar os restantes dados em memória e manter o acesso de teste. Credenciais verificadas antes do encerramento; backend atualizado arrancado no PID 27404, loopback:8080, com o mesmo email/palavra-passe de teste e H2 local em ficheiro `.factory-results/local-beta/data/beta.mv.db`. Acesso recriado com as mesmas credenciais; não é uma migração dos IDs/dados anteriores. Media no disco e sessões offline preservados. CORS passou a 200 e a edição/gravação/reload foi validada na aplicação local. Sessões anteriores precisam de novo login. Código do produto não foi alterado neste seguimento; resultados STANDARD anteriores reutilizados.
- Baseline consultada. Sem auditoria global de dependências, DEEP, release completo, CI remoto, push, merge ou deploy nesta feature. Alterações preexistentes do utilizador, incluindo application.properties e outros FEAT, preservadas.

## Gates independentes
- **TICKET_GATE:** PASS / APPROVED — 8/8 critérios validados, STANDARD final e revisão aprovados.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED.

## Histórico
- 2026-10-24: PLANNED — especificação criada antes de implementar, próximo ID 004 confirmado.
- 2026-10-24: IN_PROGRESS — persistência pessoal, compositor, configuração no perfil, Studio e impressão implementados; QA direcionado 4 backend + 15 frontend aprovado; gate STANDARD em execução.
- 2026-10-24: QA — primeiro gate STANDARD: backend 21/21 e targeted 56/56 PASS; integração inicialmente FAIL em dois contratos de teste desatualizados. Após verificar explicitamente o GET pessoal e os novos campos acessíveis: integração 111/111 PASS. E2E identificou mock de repositório carregado pelo scan do servidor de testes; isolamento corrigido e verificação de repositório real acrescentada. Validação final pendente.
- 2026-10-24: QA — percursos específicos 2/2 PASS; regressão completa expôs concatenação de palavras no DOM. Corrigida no produto, acrescentado teste e mantido o E2E original.
- 2026-10-24: IN_REVIEW — gate STANDARD final PASS (32 backend, 75 targeted, 112 integração, 9 E2E + 3 wrapper), build e revisão aprovados. Critérios 8/8 verificados; aguarda aprovação do utilizador. Sem aprovação global de release.
- 2026-10-24: Seguimento beta — confirmado backend antigo; com autorização explícita, atualizado o processo e trocada apenas a configuração local de H2 em memória para ficheiro persistente. Mesmo acesso de teste confirmado antes/depois; navegador real em localhost:4200 validou edição, gravação e recuperação após reload. Valores de teste repostos; TICKET_GATE PASS reutilizado, RELEASE_GATE NOT_RUN.
