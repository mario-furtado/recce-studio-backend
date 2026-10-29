# FEAT-011 — Tutoriais de ralis, PECs, reconhecimento e Studio

- **Estado:** IN_REVIEW — implementação, QA e revisão concluídas; aguarda aprovação.
- **Perfil:** STANDARD — quatro percursos, navegação e fronteira de demonstração sem persistência/dispositivos.
- **Data:** 2026-10-28.

## Objetivo e âmbito
Tutorial tinha cartões estáticos para ralis/PECs/recce/Studio e o guia de Notas. Agora oferece quatro percursos independentes com destaque, fundo escurecido e Anterior/Próximo/Sair. A ajuda permanece na secção Tutorial; não foram acrescentados textos permanentes às páginas de trabalho.

Não se criam dados reais nem se inicia captura. O guia de Notas mantém-se. Backend, APIs, regras de negócio, autorização e persistência da aplicação não foram alterados.

## Requisitos e critérios de aceitação
1. Tutorial oferece quatro entradas claras: Criar um rali, Criar uma PEC, Reconhecimento e Studio, mantendo Notas.
2. Rali explica nome/localização, ano/piso, carro/classe/imagem opcionais e resultado, usando formulário real com serviços em memória.
3. PEC explica escolha do rali, nome/número/distância, criação e continuação em reconhecimento/Studio, usando formulário real e exemplos.
4. Recce demonstra escolha de PEC/sem PEC, GPS/microfone, início, marcação/voz, finalizar/guardar e sincronizar, explicitamente simulados. Não pede dispositivos nem grava em IndexedDB.
5. Studio demonstra media/GPS/notas, tempo, sincronização/referência, mapa/notas e revisão/exportação. Usa amostras e componentes reais de apresentação/caderno; não abre PECs reais nem reproduz media automaticamente.
6. Todos têm contador, avanço apenas explícito, recuo coerente, Escape/Sair, foco contido e destaque responsivo. Dados descartados ao sair/recarregar; percurso inválido tem recuperação clara.
7. Em sessão online/offline, a conclusão oferece uma rota real permitida, sem IDs de exemplo. Não há escritas API/storage ou acesso a sensores/media nos guias.
8. Testes direcionados/E2E cobrem cada percurso, teclado/móvel, reinício/saída, dados e regressão Notas; revisão e gates independentes registados.

## Percursos entregues
| Percurso | Passos | Âmbito |
| --- | --- | --- |
| Criar um rali | 5 | Entrar, nome/localização, ano/piso, carro/classe/imagem, resultado |
| Criar uma PEC | 5 | Rali, identificação, distância, criação, reconhecimento/Studio |
| Reconhecimento | 6 | Escolha, permissões, estado iniciado, marcação/voz, finalização, sincronização |
| Studio | 7 | Abrir, ficheiros, tempo, referência, mapa, nota, caderno/PDF |

## Decisões técnicas, componentes e riscos
- Rota lazy /tutorial/learn/:workflow sob os guards existentes. Map de nomes válidos rejeita percursos desconhecidos/propriedades herdadas.
- Um GuidedTourComponent comum aos quatro guias: dialog nativo, contador, foco/Tab/Shift+Tab/Escape, recuo/avanço e destaque recalculado com scroll/resize. Reutiliza a folha de estilos do guia Notas sem alterar o seu comportamento.
- WorkflowDemoComponent injeta providers por instância, sem HttpClient/storage. PecsListComponent e RallyDetailComponent reais são reutilizados, com RallyService/TeamProfile/rota de exemplo. O serviço de PEC real não é usado.
- A simulação mantém SharedProperties local em modo online apenas para apresentar os formulários, sem alterar o modo global da sessão. O final offline vai a /offline-recces; online vai a /pecs ou /new-recce, nunca a um ID de exemplo.
- Recce/Studio usam painéis identificados como simulação. Não se instanciam RecceMode/Tracking/PecsEditor ou leitores de media. NoteDisplay/Notebook reais apresentam exemplos. Trajeto é SVG identificado como simulado, sem satélite ou coordenadas pessoais.
- Dados são recriados por passo, evitando duplicação ao recuar; nada é guardado fora da instância. O fundo inert/aria-hidden e o modal impedem ações acidentais nos formulários.
- CSS sem encapsulamento é delimitado por .workflow-demo; apenas nessa área a modal PEC fica no fluxo do documento, permitindo destaque em móvel. Não altera modais de produção.

Riscos analisados: injeção acidental de serviços reais, navegação com IDs fictícios, hardware/storage ativo, foco perdido, alvo fora do ecrã, contraste e divergência de rótulos. Não se modificam gravações em curso, bases reais ou ficheiros do utilizador.

## Casos limite e comportamentos
Percurso inválido mostra Tutorial indisponível e Voltar aos tutoriais. Alvo recolhido/ausente não bloqueia a explicação nem a saída. Primeiro/último passo limitam avanço/recuo. Trocar percurso/recarregar reinicia os exemplos. Ao sair, foco vai para o título da página destino. Nenhum cronómetro, reprodução, impressão ou avanço automático é iniciado. O painel de vídeo mantém contraste mesmo quando o texto envolvente usa tema claro.

## Ficheiros alterados
- frontend/src/app/app.routes.ts: rota lazy.
- frontend/src/app/modules/features/tutorial/tutorial.component.ts e .html: entradas para quatro percursos, substituindo cartões estáticos redundantes.
- frontend/src/app/modules/features/tutorial/guided-tour.component.ts (novo): overlay/controlo comum.
- frontend/src/app/modules/features/tutorial/workflow-tour.steps.ts (novo): conteúdo de23passos e catálogo.
- frontend/src/app/modules/features/tutorial/workflow-tour.component.ts (novo): sequência, validação de rota e destinos seguros.
- frontend/src/app/modules/features/tutorial/workflow-demo.providers.ts (novo): fixtures e providers apenas em memória.
- frontend/src/app/modules/features/tutorial/workflow-demo.component.ts/.html/.css (novos): formulários reais isolados e painéis simulados.
- frontend/src/app/modules/features/tutorial/workflow-tour.component.spec.ts e frontend/e2e/workflow-tours.spec.ts (novos): regressões e fronteira de demonstração.
- docs/e2e.md e este documento: âmbito e evidência.

## Verificação dos critérios
| Critério | Testes/checks executados | Resultado |
| --- | --- | --- |
| AC1 | E2E inicia cada entrada; guia de Notas reexecutado no gate; sem duplicar cartões estáticos | PASS |
| AC2 | Unit/E2E: formulário real preenchido, piso/carro opcionais e uma única fixture criada; recuo não duplica | PASS |
| AC3 | Unit/E2E: rali de exemplo, nome/número/distância8.5, criação única e cartão; móvel confirmado | PASS |
| AC4 | Painéis simulados, ausência de componente recorder/media; probes de GPS/microfone/voz/MediaRecorder/AudioContext e IndexedDBwrites a zero em desktop/móvel/offline | PASS |
| AC5 | Tempo muda explicitamente, mapa acompanha estado, NoteDisplay/Notebook reais; dados/media pessoais não pedidos | PASS |
| AC6 | Todos os passos desktop, recuo/reload/Escape, ciclo Tab/Shift+Tab, foco e painel390×844, rota__proto__ sem erro | PASS |
| AC7 | Dados HTTP e local/sessionStorage antes/depois iguais; zero pedidos de dados durante os guias; modo offline zero API e finais /offline-recces; destinos online fixos em unit | PASS |
| AC8 | STANDARD integral e revisão dirigida final, sem novas regressões observadas | PASS |

## Comandos e validações executadas
Windows, Node22, Chrome Headless156, Maven e ambiente E2E HTTP/JPA/H2 isolado18765/18766. PATH incluiu Node22/Git/Maven; CHROME_BIN usou Chrome instalado.

```powershell
$env:FACTORY_RISK='medium'
$env:FACTORY_MAVEN_TESTS='NotebookPreferencesIntegrationTest,NoteWorkflowIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest'
$env:QUALITY_TARGET_SPECS='src/app/modules/features/tutorial/workflow-tour.component.spec.ts,src/app/modules/features/tutorial/notes-tour.component.spec.ts,src/app/modules/core/guards/auth.guard.spec.ts,src/app/accessibility.component.spec.ts'
node tools/run-quality-gate.mjs ticket AUTO
npm --prefix frontend run e2e:ci -- --grep FEAT-011
npm --prefix frontend run audit:accessibility
```

| Check | Resultado executado | Evidência em .factory-results/ |
| --- | --- | --- |
| Typecheck inicial | PASS | FEAT-011-typecheck.log |
| Direcionados iniciais | 16/16 PASS, novos guias + Notas | FEAT-011-focused.log |
| E2E dirigido inicial | 4/5; seletor PEC também contava o cartão Adicionar Troço, corrigido para a PEC pelo nome | FEAT-011-focused-e2e.log |
| Repetição PEC | 1/1 PASS, incluindo móvel | FEAT-011-pec-e2e.log |
| Ticket AUTO → STANDARD | PASS: config/backend/lint/typecheck/direcionados/integração/E2E/build | FEAT-011-ticket.log; FEAT-011-ticket.json |
| Backend selecionado | 24/24, sem falhas/erros/skips | 2026-10-28T16-04-56.283Z-ticket-standard/backend-test.log |
| Direcionados / componentes | 35/35 e145/145 | Mesmo diretório: frontend-test-targeted.log e frontend-test-integration.log |
| E2E / wrapper | 19/19 e3/3, sem skips | Mesmo diretório: frontend-test-e2e.log |
| Auditoria estática de acessibilidade | PASS | FEAT-011-accessibility.log |
| Direcionados após revisão de contraste | 10/10 PASS; razão de contraste ≥4.5 | FEAT-011-review-focused.log |
| E2E dirigido após revisão | 5/5 PASS; probes também verificados antes do reload e em offline | FEAT-011-review-e2e.log |
| Build final | PASS; inicial475.94kB, abaixo do aviso500kB | FEAT-011-review-build.log |
| Recursos do Main repostos | Maven resources:resources compiler:compile PASS; hashes properties/yml iguais aos sources | FEAT-011-main-resources.log |

Após o gate, foram reutilizados checks inalterados e confirmados os ajustes finais com testes dirigidos e rebuild. Capturas dos quatro guias desktop/móvel em FEAT-011-{rally,pec,recce,studio}-{desktop,mobile}.png, inspecionadas. Backend beta não foi reiniciado nem foram redefinidas contas/dados.

## QA e revisão
factory-qa/factory-review aplicadas no mesmo fluxo, sem agentes. Revisão APPROVE, sem findings bloqueantes pendentes (FEAT-011-qa-review.md). Confirmados providers isolados, rotas fixas, limites do contador, foco, limpeza de listeners/frames, nomes de controlos, labels reais de gravação e contraste. O texto do estado iniciado esclarece que o botão muda para FINALIZAR E GUARDAR. A asserção da PEC continua a exigir exatamente uma PEC, excluindo corretamente o cartão de adicionar; não foram desativados testes ou enfraquecidas asserções funcionais.

## Problemas e limitações
- Aviso preexistente NG8113 de RouterLink não utilizado em PecsListComponent mantido; build aprovado.
- Recce/Studio são demonstrações explícitas; GPS/microfone/câmara, gravação física, importação de ficheiros reais e satélite não são exercitados pelos tutoriais. E2E existente mantém regressão de percursos reais de dados/mapa/PDF.
- Sessão offline da aplicação foi testada; cache offline física/service-worker não validada. Sem leitores de ecrã reais, outros browsers, impressora ou release global/DEEP.
- Alterações anteriores do utilizador preservadas. Sem push, merge ou deploy.

## Gates independentes
- **TICKET_GATE:** PASS / APPROVED —8/8 critérios verificados, STANDARD e revisão aprovados.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED — gate global não executado.

## Histórico
- 2026-10-28: PLANNED — especificação criada exclusivamente antes de implementar.
- 2026-10-28: IN_PROGRESS — quatro percursos, isolamento de fixtures e testes; seletor de PEC corrigido e contraste revisto.
- 2026-10-28: IN_REVIEW — STANDARD PASS, confirmação dirigida final e capturas aprovadas; aguarda aprovação.
- Ambiente: o último rebuild com o texto final encontrou EPERM na criação de dist/browser/assets/brand dentro da sandbox; repetição fora da sandbox PASS. O gate STANDARD e o primeiro rebuild pós-contraste também passaram; o último build final está confirmado.

