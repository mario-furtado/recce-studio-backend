# FEAT-003 — Mapa de satélite, traçado GPS e reprodução sincronizada

- **Estado:** IN_REVIEW
- **Descrição:** substituir o esboço GPS do Studio por um mapa geográfico navegável, com percurso, notas identificadas e posição sincronizada com vídeo/áudio.
- **Perfil:** STANDARD, com testes rigorosos de persistência e isolamento nos endpoints afetados. Âmbito delimitado ao reconhecimento/Studio; sem alteração transversal de autenticação ou preparação de release.

## Objetivo e âmbito

Apresentar o trajeto realmente amostrado, todas as notas com posição conhecida e um indicador de posição que acompanha reprodução, pausa e procura no vídeo/áudio. Permitir zoom, deslocação, enquadrar trajeto e expandir o mapa. Preservar GPS/notas no armazenamento existente e sincronização offline.

Não prometer precisão superior ao sensor nem reconstruir ruas percorridas entre amostras. Imagens de satélite dependem de internet; não fazer download de regiões para utilização offline. Não alterar contas, deploy ou dados de utilizadores existentes.

## Requisitos

- RF1: conservar todas as amostras válidas recebidas durante a captura, com tempo e precisão, sem o filtro atual de um segundo.
- RF2: importar os tempos reais dos pontos GPX como segundos relativos ao primeiro tempo válido; pontos sem tempo não recebem tempos fictícios. Preservar segmentos GPX.
- RF3: apresentar satélite real com atribuição, zoom/pan, enquadramento e expansão; manter percurso/notas visíveis quando as imagens falham, com indicação de erro.
- RF4: desenhar o percurso na sua posição geográfica e assinalar notas com texto atual (ex. D6 > E3), sem distribuir artificialmente pontos de GPS parado.
- RF5: manter coordenadas das notas capturadas nos seus registos, preservando-as ao editar texto/tempo. Para notas sem coordenadas, usar interpolação temporal apenas quando exista um intervalo GPS válido; mostrar quantas não têm posição.
- RF6: sincronizar posição e nota ativa com o tempo do vídeo (ou áudio na ausência de vídeo); selecionar uma nota no mapa posiciona o leitor no seu tempo.
- RF7: permitir um desfasamento vídeo/reconhecimento explícito e persistido por PEC, aplicado ao GPS e à apresentação das notas, respeitando bloqueios de PEC/rali concluídos e isolamento entre equipas.

## Critérios de aceitação

1. Dadas várias amostras GPS válidas em menos de um segundo, quando recebidas e guardadas, todas as amostras permanecem disponíveis após snapshot/sincronização, com ordem, coordenadas e precisão preservadas; coordenadas inválidas não são gravadas.
2. Dado GPX com tempos e segmentos, quando importado, os tempos correspondem ao intervalo real e as interrupções não são ligadas; GPX sem tempos continua visível, mas não simula sincronização temporal.
3. Dado GPS disponível, quando se abre o Studio, existe satélite georreferenciado, zoom/pan/enquadramento/expansão e percurso sobreposto. Falha de imagens informa o utilizador e mantém os dados do percurso.
4. Dadas notas com posição, quando apresentadas no mapa, mostram a designação atual e mantêm coordenadas reais mesmo com GPS parado; texto hostil é tratado como texto. Notas sem posição identificável são contabilizadas sem inventar localizações.
5. Dado um trajeto temporal, quando o vídeo/áudio avança ou recua, a posição e a nota ativa acompanham o tempo; intervalos GPS longos/segmentos distintos não geram posições interpoladas fictícias. Selecionar nota posiciona o leitor se o tempo estiver incluído no media; caso contrário apresenta erro acionável sem falsa seleção ou movimento.
6. Dado um desfasamento configurado numa PEC editável, quando guardado e recarregado, mapa e notas aplicam-no; inputs inválidos são rejeitados, sem alterar dados.
7. Dado acesso anónimo ou de outra equipa, quando tenta ler GPS/notas ou alterar desfasamento, é recusado; PEC/rali concluídos mantêm bloqueios de edição.
8. Dadas funcionalidades existentes, quando se executam regressões de captura, offline, media, notas e navegação, não surgem falhas relacionadas; build e gate selecionado passam.

## Etapas verificáveis

| Etapa | Entrega | Validação antes da seguinte |
| --- | --- | --- |
| T1 | Amostras completas, GPX temporal/segmentos, coordenadas das notas e desfasamento persistido | Unitários GPS/GPX e integração HTTP/JPA de persistência/isolamento |
| T2 | Mapa satélite expansível, percurso e notas | Unitários de geometria/tempos e componente, tratamento de erro e texto hostil |
| T3 | Integração vídeo/áudio/notas/mapa | Testes de procura/pausa/offset, E2E com API real e media controlada, gate e revisão |

## Decisões técnicas e componentes

- Reutilizar IndexedDB/sync GPS existentes. Sem novo serviço externo para guardar coordenadas.
- Leaflet 1.9.4 estável ([documentação oficial](https://leafletjs.com/reference.html)), empacotado localmente e carregado na área Studio; evitar scripts de mapa em CDN.
- Fundo proposto: Esri World Imagery ([fontes/atribuição](https://doc.arcgis.com/en/data-appliance/latest/imagery-elevation/world-imagery.htm)); preferência de fornecedor perguntada ao utilizador. As tiles são pedidas diretamente como imagens, sem bearer da aplicação nem notas enviadas ao fornecedor. O fornecedor observa a região consultada e IP, como qualquer serviço de tiles.
- Posição por interpolação entre amostras próximas no mesmo segmento, nunca por encaixe automático em estradas. Intervalos superiores a 15 s são interrupções explícitas. Geometria sem tempos serve para visualizar, não para sincronizar.
- Desfasamento em segundos por PEC, separado da edição pontual de tempos das notas; zero por omissão para compatibilidade. Migração aditiva por JPA, sem apagar/recriar tabelas.
- O atalho «Fixar Nota 1 Aqui» alinha agora todo o reconhecimento através do desfasamento persistido, em vez de reescrever só os tempos das notas e deixar o GPS desalinhado. A edição individual de tempos mantém-se disponível.
- Leaflet usa a distribuição ESM fornecida no pacote para evitar um novo aviso CommonJS. Os textos são criados com textContent, sem HTML das notas. Etiquetas podem ser afastadas visualmente para legibilidade; os pontos GPS nunca são deslocados. Lista acessível permite selecionar notas coincidentes.
- Expansão usa a camada superior nativa do navegador (Popover API, suportada pelo Chromium utilizado); evita sobreposição da sidebar. Escape recolhe o mapa. O layout mantém altura mínima do vídeo e permite scroll natural.
- Componentes: TrackingService, armazenamento/sync existentes, leitor GPX, NoteEntity/sync de notas, PecEntity/DTO/patch/assets, PecsEditor e novo componente de mapa. Fronteiras: API por equipa e imagens externas; regressões de autorização obrigatórias.

## Casos limite e erros

Sem GPS, sem vídeo, áudio apenas, GPX sem tempos/segmentado, coordenadas inválidas, pontos repetidos/parados, tempos repetidos/desordenados, perda de sinal, procura antes/depois do trajeto, notas sem tempo/posição, falha de tiles, resize/expansão, erro ao guardar e dados legados. Sem interpolação que atravesse interrupções. Não alegar alinhamento automático de relógios de câmaras: o utilizador configura o desfasamento quando necessário.

## Ficheiros alterados

- `frontend/package.json`, `package-lock.json`: Leaflet 1.9.4, @types/leaflet 1.9.21 e dependência de tipos geojson; sem upgrades de pacotes existentes.
- `frontend/src/styles.css`: CSS local Leaflet e etiquetas; `modules/core/models/rally.ts`, `services/pecs.service.ts`: coordenadas/segmentos/offset nos contratos; `services/tracking.service.ts` e `.spec.ts`: amostragem sem filtro de um segundo e validação.
- `frontend/src/app/modules/features/pecs/pecs-editor/`: `gps-timeline.ts/.spec.ts`, `recce-map.component.ts/.spec.ts`, `leaflet-esm.d.ts`, `media-map-sync.component.spec.ts`, `pecs-editor.component.ts/.html`: mapa, geometria e integração temporal/interface.
- `frontend/src/app/accessibility.component.spec.ts`: contrato de nomes ampliado ao novo campo, mantendo os seis nomes anteriores.
- `frontend/e2e/recce-map.spec.ts`: jornada real com vídeo gerado localmente, satélite, falha de imagens e recarga.
- `src/main/java/org/example/dto/`: GpsPointDTO, PecDTO, PecOverviewDTO, PecPatchDTO e PecAssetDTO; `entity/NoteEntity.java`, `PecEntity.java`; `service/PecAssetService.java`, `PecService.java`, `NoteExcelParserService.java`, `OfflineRecceSyncService.java`: tempos GPX, coordenadas, validação e offset persistido.
- `src/test/java/org/example/service/GpsTimelineTest.java`, `PecAssetServiceXmlSecurityAuditTest.java`, `controller/GpsMapIntegrationTest.java`: fronteiras GPS/GPX/notas/isolamento/bloqueios. Fixture XML passou a ter tempos reais explícitos, mantendo asserções de ordem/coordenadas/tempos.
- Este documento, `docs/ai/QUALITY_BASELINE.md` e o âmbito E2E em `docs/e2e.md`: apenas evidência executada; sem mudança de estado de tickets não relacionados. Restantes alterações previamente existentes preservadas.

## Verificação dos critérios

| Critério | Testes previstos | Resultado | Evidência |
| --- | --- | --- | --- |
| 1 | TrackingService: amostras 0/0.1/0.2 s; GpsMapIntegrationTest: persistência/read/replay e rejeição de null/fora de limites; regressão offline | PASS | tracking-before.log, T2-targeted-final.log e ticket.json |
| 2 | GpsTimelineTest: 7.5 s reais, sem tempos, segmentos, dados inválidos; segurança XML mantida | PASS | T1-backend-final.log e ticket.json |
| 3 | RecceMapComponent + E2E: satélite real, zoom/escala, expansão acima da sidebar, Escape e falha de imagens | PASS | review-e2e.log e screenshots |
| 4 | HTTP/JPA guarda coords e mantém após edição/replay; componente trata HTML como texto; helper mantém GPS parado e omite posições desconhecidas | PASS | ticket.json, T2-targeted-final.log e review-targeted.log |
| 5 | Helper sem extrapolação/gaps; componente e editor: recuo/avanço, vídeo/áudio, seleção, nota ativa e erro fora do media; E2E com WebM real | PASS | review-targeted.log e review-e2e.log |
| 6 | HTTP: offset positivo/negativo/limite inválido, recarga/assets; editor: erro sem substituir valor anterior; E2E: recarga de 0.2 s | PASS | ticket.json, review-targeted.log e review-e2e.log |
| 7 | HTTP anónimo 401, outra equipa 404, proprietário permitido, PEC/rali concluídos 400; regressões TenantIsolation/ApiAuthInterceptor | PASS | ticket.json e logs backend do gate |
| 8 | STANDARD e QA/revisão finais aprovados; asserções de acessibilidade preservadas e ampliadas | PASS | ticket-final.log, review-targeted.log, review-e2e.log e qa-review.md |

Prefixo de todos os nomes de logs da tabela: `.factory-results/FEAT-003-`.

## Validação e revisão

T1 backend: PASS, 12/12 (GpsTimelineTest, GpsMapIntegrationTest, PecAssetServiceXmlSecurityAuditTest), após correções na leitura do desfasamento e no endpoint PUT usado pelo teste do rali. Repetição de sync compara identidade e contagem; a representação de nanossegundos H2 não faz parte do contrato. Evidência: `.factory-results/FEAT-003-T1-backend-final.log`. Testes XML executados fora da sandbox por precisarem de servidor local para verificar ausência de consultas externas.

T2: primeira execução 24 PASS/1 FAIL; identificou mudança de estado na inicialização do mapa após verificação Angular (NG0100). Corrigida a preparação do estado antes da montagem; revalidação pendente. Typecheck inicial PASS. Aplicadas factory-qa/factory-review; restantes validações em curso.

T2 revalidada: PASS 25/25, incluindo tracker, geometria, mapa e media autenticada. T3 unitários iniciais: PASS 5/5. E2E inicial revelou sobreposição de etiquetas e expansão sob a sidebar; corrigidos sem alterar coordenadas nem forçar clicks no teste. Inspeção visual revelou compressão do vídeo, corrigida com altura/scroll e asserção de altura do leitor.

T3 E2E final: PASS 1/1, com API real/H2, vídeo WebM gerado localmente e tiles reais Esri; sem respostas API simuladas. Confirma procura para trás/frente, nota ativa, click no mapa, offset persistido, expansão/zoom, ausência de bearer nas tiles e falha de imagens mantendo dados. Evidência: `.factory-results/FEAT-003-T3-e2e-final.log`, `FEAT-003-expanded-map.png` e `FEAT-003-studio-map.png`. Gate STANDARD e revisão final em curso após alinhar o atalho de ancoragem global.

## Resultados finais executados

- `node tools/run-quality-gate.mjs ticket AUTO`, com `FACTORY_RISK=medium`: STANDARD PASS. `FACTORY_TICKET_ID` ausente por se tratar de feature. `FACTORY_MAVEN_TESTS=GpsTimelineTest,GpsMapIntegrationTest,PecAssetServiceXmlSecurityAuditTest,TenantIsolationAuditTest,NoteWorkflowIntegrationTest,ApiAuthInterceptorAuditTest`: 29/29, sem falhas/erros/skips.
- `QUALITY_TARGET_SPECS`: tracking.service, gps-timeline, recce-map.component, media-map-sync.component, pecs-editor.component, offline-recces.component, recce-mode.component e auth.interceptor, nos respetivos caminhos em frontend/src/app. Direcionados 98/98; integração 103/103; controlos E2E runner 3/3 e jornadas reais 7/7. Configuração, lint, typecheck app/spec/E2E e build PASS. Logs `.factory-results/2026-10-23T18-57-45.018Z-ticket-standard/`, `FEAT-003-ticket-final.log` e snapshot `FEAT-003-ticket.json`.
- Primeira execução do gate parou na acessibilidade (102 PASS/1 FAIL): esperava seis campos e passou a ter sete. Atualizada a lista exata de nomes, acrescentando o novo campo sem remover asserções; segunda execução integral aprovada.
- Revisão final adicionou guarda para seleção de notas antes/depois do intervalo do media e removeu import obsoleto. Revalidação: `node tools/run-targeted-tests.mjs` (componente mapa e sincronização media selecionados): 9/9 PASS; `npm --prefix frontend run typecheck`: PASS; `npm --prefix frontend run e2e:ci -- --grep FEAT-003`: 1/1 PASS, com rebuild de produção. Restantes resultados STANDARD reutilizados; não se afirma nova execução integral após este último ajuste. Evidência: `FEAT-003-review-targeted.log`, `FEAT-003-review-typecheck.log`, `FEAT-003-review-e2e.log`.
- Ambiente: Node 22.23.4, Chrome Headless 156, Java/Maven locais, H2 e storage isolados do harness. Instalação inicial npm usou o cliente existente e emitiu EBADENGINE por o seu launcher usar Node20.15.1; testes/build usaram Node22, sem alterar engines nem versões Angular. Sem novos avisos CommonJS; permanece o aviso anterior RouterLink não utilizado em PecsListComponent.
- Build: initial 474.32 kB, abaixo de 500 kB; CSS Leaflet aumenta carga inicial face aos 462.88 kB anteriores, JavaScript do mapa fica no chunk lazy do Studio.
- Auditoria nova do lockfile: 0 critical, 0 high, 8 moderate, 0 low. `npm audit --json` devolveu 1 por moderados; `npm --prefix frontend run audit:security` devolveu PASS no limiar high definido no projeto. `npm audit --omit=dev --json`: zero findings; nenhum finding Leaflet. Atualizada baseline após execução, sem atribuir a mudança do catálogo a upgrades que não foram feitos. Logs `FEAT-003-audit.json`, `FEAT-003-audit-runtime.json`, `FEAT-003-security-gate.log`.
- Revisão `factory-review`: APPROVE, sem findings bloqueantes pendentes. Inspecionados diff, propriedade/validação de dados, limpeza de listeners/mapa, texto não confiável, auth de media e fronteira de tiles externas. QA detalhada em `.factory-results/FEAT-003-qa-review.md`. Factory/baseline e `git diff --check` PASS no fecho.

## Problemas e limitações

Problemas de amostragem/tempos/esboço corrigidos e reproduzidos por testes. Sem novas regressões observadas nos checks executados. Permanecem oito advisories moderados de tooling; nenhum high/critical observado nesta auditoria. Não foi executado RELEASE_GATE nem DEEP global, migração PostgreSQL/produção, GPS/câmara física, Safari/Firefox/dispositivo real, leitor de ecrã real ou arranque offline com cache de tiles.

As imagens dependem de internet/disponibilidade Esri; o E2E de satélite requer acesso a esse fornecedor. Não foram verificadas condições comerciais específicas do deployment. Dados antigos sem coordenadas/tempos podem não permitir reconstrução ou sincronização; não se inventam posições. O vídeo é a autoridade quando existe; áudio é alternativa na sua ausência, não uma sincronização entre dois leitores independentes. Latência/precisão dos sensores não é eliminada pelo mapa.

Configuração local do utilizador em `application.properties` (bootstrap de testes por omissão) preservada; defaults de bootstrap não revalidados globalmente nesta feature. O backend local anterior não foi reiniciado: usa H2 em memória e um reinício perderia os seus dados. Testes usaram instâncias isoladas; para experimentar a nova persistência no backend local é necessário aprovar/preparar esse reinício ou preservar previamente os dados.

Estado IN_REVIEW para aprovação do utilizador; os oito critérios técnicos obrigatórios estão verificados.

## Gates independentes

- **TICKET_GATE:** PASS → APPROVED — STANDARD e revalidação final aprovados; revisão APPROVE.
- **RELEASE_GATE:** NOT_RUN → UNVERIFIED — sem aprovação global inferida; o antigo bloqueio high de dependências foi removido da baseline apenas após o novo check PASS.

## Histórico

- 2026-10-23: PLANNED — especificação e decomposição T1/T2/T3 criadas antes da implementação; ID seguinte a FEAT-002.
- 2026-10-23: IN_PROGRESS — reprodução executada: GPS 1 FAIL/13 PASS; GPX 2 FAIL. Utilizador confirma não ter fornecedor; selecionada camada pública Esri. Leaflet instalado após resolução de bloqueio de rede da sandbox.
- 2026-10-23: T1 PASS 12/12; T2 PASS 25/25; T3 E2E PASS 1/1 após correções reais de interface. IN_REVIEW — gate e revisão final em curso.
- 2026-10-23: STANDARD aprovado após ampliar o contrato de acessibilidade; seleção fora do media corrigida na revisão e revalidada com 9/9 + E2E 1/1/typecheck/rebuild. Baseline atualizada com auditoria executada. IN_REVIEW, pronta para aprovação; sem push, merge ou deploy.
