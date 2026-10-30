# FEAT-017 — Capas personalizadas do RecceBook

- **Description:** Modelo pessoal de capa/contracapa em Notas e personalização independente por PEC, com logótipo Recce Studio fixo e ordem capa/notas/contracapa na pré-visualização e PDF.
- **Status:** IN_REVIEW — capa principal e capa por PEC implementadas e validadas.
- **Profile and reason:** STANDARD, frontend/backend com persistência; testes rigorosos de validação, propriedade e bloqueios na fronteira afetada. Sem DEEP global.

## Objective and scope
No Studio/Caderno PDF, editar textos e apresentação da capa/contracapa sem alterar notas, dicionário ou modelo pessoal. Carregar dados reais do rali, PEC, equipa e carro; data inicial é a data atual do caderno, editável, não inferida como data da gravação. Configuração da PEC é partilhada com a equipa, sujeita à mesma autorização e aos bloqueios de PEC/rali concluídos. Preservar alterações existentes FEAT015/016.

## Requirements and technical decisions
- API autenticada GET/PUT /api/pecs/{id}/reccebook-cover, JSON versionado estrito na PEC (LOB nullable, registos antigos têm defaults sem migração destrutiva). Sem guardar automaticamente defaults. GET fornece capacidade de edição; PUT valida antes de gravar e nunca permite alterar branding.
- Textos livres adicionáveis/removíveis (até12 por lado), posição X/Y percentual, largura, letra8–72pt, Arial/Georgia/Courier New, alinhamento, negrito/itálico/sublinhado, cor e fundo por lado. Inputs numéricos e preview real, utilizáveis em móvel/teclado; não introduzir editor gráfico externo.
- Símbolo usa o asset oficial existente, com posição/tamanho reservados e sem opção de remoção. Contracapa branca inicial, assinatura fixa Official product by Recce Studio e espaço para texto opcional. Não aceitar HTML/CSS/URLs arbitrários.
- Notebook inclui capa primeiro e contracapa no fim em todos os PDFs. Modelos de notas/previews sem contexto têm capa inicial genérica, sem inventar dados de rali/equipa. Página de notas e respetiva paginação permanecem independentes. Formato/orientação do modelo continuam a definir todas as folhas.
- Sem cortes/reduções silenciosas: validação estrutural de ambos os lados e medição DOM bloqueiam exportação com mensagem quando excede área útil ou há sobreposição. Zona da marca protegida; não expor controles sobre o logótipo.
- Editor com Guardar/Cancelar, âmbito explícito, loading/retry e preservação do rascunho em erro. Exportar só após carga bem-sucedida e Guardar/Cancelar; erro de carga não autoriza sobrescrever defaults.

## Acceptance criteria
1. Given PEC sem capa gravada, then Studio carrega capa inicial com dados reais autorizados e contracapa, sem alterar notas/modelo nem escrever defaults.
2. Given editar, then todos os textos podem ser alterados/adicionados/removidos, posicionados/dimensionados/estilizados e pré-visualizados; logótipo não tem controles de edição.
3. Given guardar/cancelar/recarregar, then persistência é por PEC e apenas Guardar aplica; erro mantém rascunho e retry; PEC/rali concluídos só permitem consultar/exportar.
4. Given request anónimo/de outra equipa ou payload inválido, then acesso negado/404/400, sem alteração dos dados válidos nem exposição de informação estrangeira; branding/estilos desconhecidos rejeitados.
5. Given imprimir/exportar, then ordem capa → todas as notas → contracapa, incluindo logótipo e assinatura, com dimensões A4/A5 portrait/landscape do modelo e conteúdo textual seguro. Folhas existentes preservadas sem perder avisos.
6. Given texto longo/posições/tamanhos inválidos ou sobreposição, then erro acionável e impressão bloqueada; não cortar ou diminuir silenciosamente; marca não pode ser coberta no output válido.
7. Given desktop/móvel/teclado, then editor/modal operáveis, estados e foco claros, capturas e PDF real inspecionados, regressões de caderno/Studio e preferências aprovadas.

## Edge cases and expected errors
Zero notas (capa/contracapa exportáveis), nomes longos, campos reais ausentes (placeholder explícito), ambos os lados vazios, null legado, versão/tipos/chaves desconhecidas, controlos não finitos, texto com markup, perda de rede ao carregar/guardar, trocar de PEC/conta, PEC/rali concluídos, fontes/imagem indisponíveis, dimensões reduzidas.

## Components, dependencies and risks
PecEntity + controlador/validador de capa, repositórios/tenant context existentes; NotebookComponent + componentes locais de capa/editor; integração no Studio. Sem dependências novas. Riscos principais: isolamento, payload arbitrário, sobreposição/clipping, ordem/contagem de páginas e compatibilidade com modelos legados. Logo sempre definido em código, nunca fornecido pelo utilizador.

## Changed files
- Backend: `PecEntity.java` (LOB nullable), `RecceBookCoverController.java` e `RecceBookCoverValidator.java` (novos), `RecceBookCoverIntegrationTest.java` (novo).
- Frontend notebook: novos `book-cover.model.ts`, `book-cover-page.component.ts`, `reccebook.component.{ts,html}`, `reccebook.component.spec.ts`; alteração de `notebook.component.ts` e respetivo spec.
- Studio: `pecs-editor.component.{ts,html}`, `pec-detail.component.ts` e `studio-redesign.component.spec.ts` para montagem persistente e guardas de rascunho.
- E2E: novo `reccebook-cover.spec.ts`; adaptação contextual em `notebook.spec.ts`, `notebook-alignment.spec.ts` e `critical-journeys.spec.ts`, mantendo asserções de notas/persistência/alinhamento.
- Este documento. Sem dependências, assets ou infraestrutura de deploy novos; alterações anteriores preservadas.

## Acceptance verification
| Criterion | Test/check | Actual result |
| --- | --- | --- |
| AC1 | Backend: defaults reais, legado null e ausência de escrita | PASS |
| AC2 | Angular/editor e E2E: textos, posição, largura, fonte, contracapa e marca fixa | PASS |
| AC3 | Backend/Angular/E2E: persistência, cancelar, erro, reload, rascunho e estados concluídos | PASS |
| AC4 | Backend: anónimo401, estrangeiro404, colega autorizado e payload inválido sem mutação | PASS |
| AC5 | Angular A4/A5 e orientações; E2E PDF3 páginas, notas preservadas; inspeção visual | PASS |
| AC6 | Angular: limites, sobreposição/overflow e impressão bloqueada; backend schema estrito | PASS |
| AC7 | Studio/acessibilidade, desktop/móvel360, capturas e PDF inspecionados | PASS, limitações abaixo |

## Validation and review
factory-qa/factory-review no mesmo fluxo, sem agentes; direcionados primeiro, depois ticket STANDARD com FACTORY_MAVEN_TESTS/QUALITY_TARGET_SPECS específicos. Logs .factory-results/. Comparar baseline antes de investigar falhas globais. Sem push/merge/deploy ou reinício da instância beta.

## Problems and limitations
Validado em Chrome/Windows e viewport móvel simulado; outros navegadores, dispositivos físicos e leitores de ecrã reais não testados. Impressão/PDF usa mecanismo existente do navegador. A capa usa textos/estilos/formas de página, sem upload de imagens novas ou rotação livre nesta versão; símbolo oficial fixo. Datas/campos iniciais tornam-se texto editável e não são reescritos silenciosamente após guardar. Gravações concorrentes seguem o padrão existente, sem controlo novo de conflitos.

## Independent gates
- **TICKET_GATE:** PASS / APPROVED — inclui extensão da capa principal, critérios8–11 verificados e revisão aprovada.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED.

## Implementation history
- 2026-10-29: PLANNED, especificação antes de código; próximo ID017 verificado incluindo documentos não tracked. Reproduzido em código: exportação inicia diretamente nas notas, sem contexto/capa persistida.
## Evidência intermédia
- Backend direcionado5/5 PASS após corrigir a leitura da fixture MockMvc para bytes UTF-8; primeira tentativa falhou em comparações Unicode da fixture, preservada em FEAT-017-backend-initial.log. Payload/branding/isolation/locks verificados sem enfraquecer asserções.
- Angular capa/notebook17/17 PASS após corrigir notificação assíncrona da validação de layout (evita ExpressionChanged no editor). Falha inicial guardada em FEAT-017-focused-initial.log.
- Studio mantém rascunho ao fechar/reabrir o diálogo. Guarda de navegação/beforeunload contempla capa; mudança de modo/conclusão descarta uma única vez todos os rascunhos apenas após confirmação, evitando recursão dos handlers existentes. Teste dedicado acrescentado.
- E2E existentes notebook2/2 PASS com capa/contracapa e páginas de notas preservadas. Primeiro cenário novo não encontrou seletor de fonte com nome exato porque o label incluía opções; nomes aria explícitos acrescentados, sem alterar condições do teste. Log FEAT-017-e2e-initial.log preservado; repetição em curso.
- Validação dirigida final: Angular29/29 PASS (capa/notebook, Studio guard e acessibilidade); E2E3/3 PASS (capa real + regressões de notebook). Guardas verificam rascunho ao fechar/reabrir e navegar; modo/conclusão descartam todos os rascunhos uma única vez após confirmação.
- PDF real gerado e inspecionado:3 páginas, capa/notas/contracapa, A5 horizontal herdado do modelo real do teste; texto Unicode extraído corretamente e folhas renderizadas via Poppler. Wrapper pdftoppm.cmd falhou por caminho; execução direta pdftoppm.exe PASS. Nenhuma dependência instalada.
- Decisão visual final: símbolo oficial fixo na capa; contracapa limpa com texto opcional e assinatura fixa, conforme pedido. Preview de desktop inspecionado; inspeção do PDF confirma legibilidade e ausência de cortes nas três folhas. Limites de tamanho/quantidade/versão reforçados nos testes.
- IN_REVIEW para gate STANDARD final, sem reinício do backend beta. A nova coluna nullable usa o mecanismo Hibernate existente; migração de uma base de produção não executada.
- Primeiro gate STANDARD: backend32/32, direcionados29/29 e integração190/190 PASS; E2E28 PASS/2 FAIL. Asserção global de observação encontrou cópia legítima no caderno fechado (agora persistente para manter rascunho), e teste de alinhamento ainda esperava PDF de1 página. Corrigidas asserções para lista de notas e PDF de3 páginas (capa/notas/contracapa), mantendo conteúdo/alinhamento. Evidência FEAT-017-ticket-first.log/json e 2026-10-29T19-25-23.424Z-ticket-standard/. Não são falhas conhecidas/baseline.
- Revisão adicional protege erro assíncrono de uma impressão abandonada quando já existe outra ativa, com regressão específica; confirmação distingue nota+capa quando ambos têm rascunhos.
- Segundo gate:32 backend PASS,29 direcionados PASS/1 FAIL no teste novo de substituição de impressão; a simulação estava no protótipo do documento principal, mas as imagens são de outro realm (iframe). Corrigido o spy no elemento do iframe; regressão específica7/7 PASS (FEAT-017-review-test.log). Asserções preservadas. Evidência inicial FEAT-017-ticket-second.log/json. Código estabilizado para execução final.
## Resultado final executado — 2026-10-29
- `node tools/run-quality-gate.mjs ticket AUTO`, `FACTORY_RISK=medium`: STANDARD PASS. `FACTORY_MAVEN_TESTS=RecceBookCoverIntegrationTest,NotebookPreferencesIntegrationTest,NoteWorkflowIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest`; `QUALITY_TARGET_SPECS` para reccebook, notebook, studio-redesign e accessibility.
- Backend32/32, direcionados30/30, integração191/191, E2E30/30 e testes do runner3/3: PASS. Configuração Factory, lint, typecheck e build: PASS. Bundle inicial485.82kB, abaixo do aviso500kB; sem aviso CSS.
- Evidência: `.factory-results/FEAT-017-ticket.log`, `FEAT-017-ticket.json` e pasta `2026-10-29T20-57-49.081Z-ticket-standard/`. Tentativas anteriores preservadas; nenhuma regressão pendente nos checks finais executados.
- Auditoria estática de acessibilidade PASS (`FEAT-017-accessibility.log`); revisão factory-review APPROVE (`FEAT-017-qa-review.md`), sem achados bloqueantes. Diff check no âmbito PASS.
- PDF real `.factory-results/FEAT-017-reccebook.pdf`:3 páginas A5 horizontal (594.96×420pt), herdadas do modelo do teste. Extração confirma título Unicode, notas e assinatura; renderização Poppler PASS (`FEAT-017-pdf-render.log`, `FEAT-017-page-1.png` a `-3.png`). Capturas: `FEAT-017-editor-desktop.png`, `FEAT-017-editor-mobile.png`, `FEAT-017-print-preview.png`.
- Após o clean do gate, `mvn.cmd resources:resources compiler:compile` PASS (`FEAT-017-main-resources.log`); hashes application.properties fonte/target iguais. Recursos do Main repostos.
- Acesso: Studio → Exportar PDF → Editar capa. Configuração partilhada por PEC; fechar mantém rascunho, Guardar persiste e Cancelar descarta.
- **Ativação local pendente:** reiniciar backend com versão atualizada para disponibilizar API e coluna nullable. Instância beta não reiniciada e dados não alterados nesta entrega; migração de produção não executada.
- RELEASE_GATE NOT_RUN / UNVERIFIED: gate de ticket não representa aprovação global de release. Sem push, merge ou deploy.
## Diagnóstico local posterior — 2026-10-29
- Conta local de testes autentica (POST /api/auth/login200), lista ralis200 e a PEC existente pertence à conta; GET da sua reccebook-cover devolve404 de rota (sem mensagem PEC não encontrada).
- Porta8080 ocupada pelo PID26552, iniciado em2026-10-28 às15:33 UTC, antes da implementação. Rebuild não reinicia este processo JVM. Confirmado backend antigo ainda ativo; a recomendação anterior de rebuild isoladamente não resolvia.
- Apenas leituras e login de diagnóstico; não foi parado qualquer processo nem eliminados dados. Ativação exige parar a instância antiga e arrancar o Main atualizado. H2 em memória implica perda dos dados dessa instância ao parar; requer decisão de preservação antes de reinício automático.
- Evidência histórica de testes permanece válida para o código; a instância local antiga não comprova ativação da feature.
## Ativação local concluída — 2026-10-29 21:15 UTC
- Inspeção completa dos argumentos confirmou H2 persistente em `.factory-results/local-beta/data/beta`, não H2 em memória. A referência ao risco H2 em memória no diagnóstico anterior era condicional e não descreve esta instância.
- Processo antigo PID26552 validado e parado; script existente `start-current.ps1` compilou recursos/classes, criou backup `beta-before-start-20261029-211449.mv.db` e arrancou PID20048 com a mesma configuração, sem reset nem bootstrap de contas.
- Verificação HTTP real: health200, login200, sessão200; GET da capa da PEC existente passou de404 para200, versão1 e5 elementos iniciais. Identidade da conta e IDs de todos os ralis/PECs antes/depois iguais. Não foram efetuadas edições de conteúdo.
- Evidência `.factory-results/FEAT-017-local-before.json`, `FEAT-017-local-after.json`, `local-beta/current-start.json`, `prepare-current.log`, `backend-current.log`. Ativação local deixa de estar pendente. Não houve alteração adicional de código; evidência STANDARD anterior reutilizada. RELEASE_GATE permanece UNVERIFIED.
- Navegador: atualizar e autenticar novamente se a sessão anterior tiver expirado após reinício. Usar a configuração IntelliJ `Main local`; rebuild por si só não substitui um backend externo já ativo na porta8080.
## Extensão pedida — capa principal em Notas (2026-10-29)
Estado IN_PROGRESS; STANDARD por persistência pessoal e herança para PECs. TICKET_GATE desta extensão UNVERIFIED; RELEASE_GATE NOT_RUN.
Diagnóstico: Caderno e exportação monta NotebookComponent diretamente, sem editor/contexto de capa. O editor apenas consulta/grava por PEC.
Decisão: reutilizar RecceBookComponent com modo pessoal e endpoint isolado por utilizador; armazenamento separado das preferências de página para evitar sobrescritas. Modelo principal com campos {{rali}}, {{pec}}, {{equipa}}, {{carro}}, {{data}}; substituição literal apenas ao gerar uma capa de PEC sem personalização. Capas gravadas permanecem independentes. Sem aplicar retroativamente ou adicionar uma página extra de capa ao PDF.
Critérios adicionais:
8. Em Notas/Caderno e exportação, Editar capa principal permite editar e guardar/cancelar capa e contracapa, com a mesma marca fixa e validações.
9. Recarregar preserva o modelo pessoal; outro utilizador, incluindo colega da equipa, não lê nem altera esse modelo; gravação de preferências não o apaga.
10. PEC sem capa gravada recebe o modelo pessoal e campos reais; PEC personalizada não muda após alterar modelo principal; edição da PEC não altera principal.
11. Falhas de carga/gravação preservam segurança e rascunho; exportação/preview e responsividade existentes sem regressões. Verificação Angular/backend/E2E real e revisão do diff.
### Validação da extensão — evidência intermédia
- Backend direcionado14/14 PASS: RecceBookCoverIntegrationTest + NotebookPreferencesIntegrationTest (`mvn.cmd compiler:compile compiler:testCompile -Dtest=RecceBookCoverIntegrationTest,NotebookPreferencesIntegrationTest surefire:test`). GET default não escreve; autenticação, isolamento pessoal mesmo entre colegas, payloads inválidos, preferências independentes e herança/snapshot verificados.
- Angular direcionado29/29 PASS com QUALITY_TARGET_SPECS: reccebook, notebook-dictionary, notes, notes-tour. Capa principal usa endpoint pessoal, mantém rascunho em erro e cancelar não grava. Tabs, navegação/beforeunload e tutorial sem HTTP real cobertos.
- Typecheck PASS. Auditoria estática acessibilidade PASS. E2E `npm --prefix frontend run e2e:ci -- e2e/reccebook-cover.spec.ts`:2/2 PASS. Capturas `FEAT-017-main-cover-desktop.png` e `FEAT-017-main-cover-mobile.png` inspecionadas: campos utilizáveis, sem overflow horizontal do documento a360px; preview mantém escala real e scroll interno existentes.
- Ficheiros adicionais: entidade/repositório/controlador RecceBookTemplate; RecceBookCoverController e integration test; RecceBookComponent e spec; NotebookSettingsComponent template/TS; NotesComponent template/TS/spec e guard da rota; spec de dictionary e E2E reccebook-cover. Sem dependências novas.
- Modelo principal é pessoal; capa guardada da PEC continua partilhada com a equipa. Herança só em GET de PEC sem capa persistida, sem gravar implicitamente. Campos substituídos literalmente numa passagem, sem interpretar HTML/CSS. Restrições existentes de texto/layout mantidas. Modelo sem contexto mostra os marcadores, sem inventar dados.
- Limitações: não existe aplicação retroativa em lote nem resolução de conflitos concorrentes. O texto expandido continua sujeito aos limites e à medição de layout antes de exportar. Impressão desta página de configuração é preview do modelo, com marcadores; exportação do Studio resolve dados reais.
### Resultado final da extensão — 2026-10-29
| Critério | Evidência executada | Resultado |
| --- | --- | --- |
| AC8 | Reccebook Angular, E2E Notas/Caderno e capturas desktop/móvel | PASS |
| AC9 | Backend personalização por conta (incluindo colega), spoofing/invalid payload, preferências independentes; E2E reload | PASS |
| AC10 | Backend herança/snapshot/PEC nova/colega e E2E capa principal versus capa PEC | PASS |
| AC11 | Angular erro/cancelar/abas/guard/beforeunload/tutorial; E2E real e regressões STANDARD | PASS |
- `node tools/run-quality-gate.mjs ticket AUTO`, FACTORY_RISK=medium: STANDARD PASS. FACTORY_MAVEN_TESTS=RecceBookCoverIntegrationTest,NotebookPreferencesIntegrationTest,TenantIsolationAuditTest. QUALITY_TARGET_SPECS=reccebook.component.spec.ts,notebook-dictionary.component.spec.ts,notes.component.spec.ts,notes-tour.component.spec.ts,notebook.component.spec.ts (caminhos completos no relatório).
- Backend24/24, direcionados40/40, integração192/192, E2E31/31 e runner3/3 PASS. Factory/config, lint, typecheck e build PASS; bundle inicial485.92kB, sem novos avisos. Evidência `FEAT-017-main-cover-ticket.log/json`, pasta `2026-10-29T21-26-50.152Z-ticket-standard/`. Auditoria estática acessibilidade e diff check PASS. Sem falhas novas nos checks executados.
- Revisão final APPROVE, sem achados bloqueantes; evidência `.factory-results/FEAT-017-qa-review.md`. IN_REVIEW para aprovação do utilizador. RELEASE_GATE NOT_RUN / UNVERIFIED; sem inferir aprovação de release.
- Ativação local concluída: instância antiga PID20048 substituída por PID22944, mesma base persistente e cópia `beta-before-start-20261029-213316.mv.db`. Script existente repôs recursos/compilação. API principal e API da capa PEC200, health/login/sessão200. Comparação de identidade da conta, IDs de ralis/PECs e hash dos conteúdos das notas iguais (1 nota existente). Nenhum conteúdo real editado nos testes.
- Evidência local: `.factory-results/FEAT-017-main-cover-local-before.json`, `FEAT-017-main-cover-local-after.json`, `FEAT-017-main-cover-local-verification.json`, `FEAT-017-main-cover-activation.log` e `local-beta/current-start.json`. Nova tabela criada pelo mecanismo Hibernate existente na base local; migração produção não executada.
- Utilização: Notas → Caderno e exportação → Editar capa principal → Guardar capa. Studio → Exportar PDF → Editar capa continua específico da PEC. Atualizar página e autenticar novamente se necessário após reinício.
- Sem push, merge ou deploy. Evidência anterior reutilizada apenas para comportamento não alterado; testes desta extensão executados de novo nos limites afetados.
