# FEAT-005 — Configuração de notas centralizada

- **Description:** Uma única aba Notas para dicionário, apresentação e caderno/exportação, com âmbitos explícitos.
- **Status:** IN_REVIEW
- **Profile:** STANDARD — navegação, edição/persistência de regras e preservação de preferências existentes.

## Objetivo e âmbito
Centralizar configuração de notas em /notes; retirar configurações de notas do perfil de equipa; manter pré-visualização e acesso Configurar notas no Studio. Reutilizar serviços/renderer/exportação da FEAT-004. Código observado antes de alterar: dicionário guardado por userEmail (pessoal), notebook por userId (pessoal) e noteSystem por equipa. A descrição anterior de dicionário partilhado estava incorreta.

Decisão explícita do utilizador: manter regras pessoais; apenas sistema base partilhado com a equipa. Sem migração de regras para a equipa, sem alterar permissões, sem reescrever notas ou preferências.

## Requisitos
1. Três áreas acessíveis em Notas: Dicionário, Apresentação e Caderno e exportação; seleção sem perder alterações pessoais em curso.
2. Identificar Dicionário/Apresentação/Caderno como Pessoal; identificar Sistema de notas base como Partilhado com a equipa. Regras locais identificadas como deste dispositivo.
3. Dicionário com frase, significado opcional e símbolo; regras antigas sem significado continuam válidas. Limitar significado a 200 caracteres.
4. Reutilização explícita do símbolo do dicionário na apresentação: criar/selecionar configuração pessoal pelo símbolo exato, sem substituir estilos existentes nem converter significados automaticamente. O parser continua a emitir o símbolo do dicionário; o compositor/preview/PDF continua a usar o mesmo modelo pessoal.
5. Mover edição do sistema base para Notas; perfil mantém equipa, piloto/copiloto, carros e unidades. Guardar perfil não pode sobrescrever um sistema base alterado em Notas.
6. Studio mantém preview e PDF; ligação Configurar notas abre /notes. Sem duplicação de formulários no perfil.
7. Erros de leitura/gravação preservam rascunhos e são acionáveis. Não enviar alterações pessoais ao endpoint da equipa.

## Critérios de aceitação
1. Given utilizador online, when abre /notes, then encontra as três áreas e vê os âmbitos reais antes de editar.
2. Given configuração existente, when acede ao perfil de equipa, then não encontra formulários de notas; Studio liga a /notes e mantém renderer/exportação.
3. Given regra nova ou antiga, when guarda frase/significado/símbolo, then reload recupera dados e entrada antiga sem significado funciona.
4. Given símbolo do dicionário, when escolhe Configurar apresentação, then seleciona/cria regra do mesmo símbolo; não duplica nem altera regra pessoal existente, e altera apenas a sua conta.
5. Given rascunhos pessoais, when alterna Apresentação/Caderno/Dicionário, then retém as alterações sem gravação implícita; save/reload confirma persistência e preview/PDF.
6. Given sistema base, when edita em Notas, then PATCH contém só noteSystem; guardar posteriormente perfil não altera esse valor. Outras equipas e preferências pessoais permanecem isoladas.
7. Given input inválido ou falha do servidor, when guarda/carrega, then comunica erro sem perder dados, redefinir preferências ou simular sucesso.
8. Given entrada offline, when tenta abrir /notes, then mantém o bloqueio e navegação offline existentes. Fluxos parser, Studio/mapa/vídeo e PDF não regridem.

## Casos limite e erros
Regras equivalentes/duplicadas, símbolo com espaços/Unicode, significado vazio ou >200, modelo já personalizado, símbolo sem estilo, modelo indisponível, carregar dicionário falha, troca de área durante edição/gravação, conta diferente e fronteira de equipa, deep link /notes e modo offline.

## Componentes, dependências e riscos
NotesComponent, NotebookSettingsComponent, TeamProfileComponent, Studio, NoteDictionaryService e DTO/entidade/serviço do dicionário. Sem dependências novas. Riscos: perder rascunho ao destruir componentes, sobrescrever modelo personalizado, marcar dados pessoais como partilhados, PATCH de perfil sobrescrever sistema base. Base beta atual em ficheiro persistente; não usar instância em memória antiga nem apagar dados.

## Decisões técnicas
Componentes existentes mantidos numa única página com navegação por botões e âmbito explícito. Modelo pessoal partilhado entre as duas áreas com uma única instância; ligação de símbolos apenas por ação explícita. Significado opcional aditivo, sem migração de ownership. QA/review conforme AGENTS, sem agentes adicionais.

## Ficheiros alterados
- `frontend/src/app/modules/features/notes/notes.component.ts/.html` e novo `notes.component.spec.ts`: três áreas, âmbitos, sistema base e ação explícita de reutilização de símbolo.
- `frontend/src/app/modules/core/notebook/notebook-settings.component.ts/.html`: áreas apresentação/caderno, instância única, seleção de símbolo e preview apenas quando visível.
- `frontend/src/app/modules/features/team-profile/team-profile.component.ts/.html`: remoção dos formulários e exclusão de noteSystem do PATCH.
- `frontend/src/app/modules/features/pecs/pecs-editor/pecs-editor.component.html`: ligação Configurar notas.
- `frontend/src/app/modules/core/services/note-dictionary.service.ts`: transporte/cache do significado opcional, sem mudar ownership.
- `src/main/java/org/example/{entity/NoteDictionaryRuleEntity,dto/NoteDictionaryRuleDTO,service/NoteDictionaryRuleService}.java`: significado aditivo validado e 404 para regra inacessível.
- `src/test/java/org/example/controller/NotebookPreferencesIntegrationTest.java`: compatibilidade, limites e regras pessoais entre contas da mesma equipa; sistema base partilhado.
- `frontend/src/app/accessibility.component.spec.ts`, `frontend/e2e/notebook.spec.ts` e novo `frontend/e2e/note-settings.spec.ts`: contratos de UI/navegação e persistência atualizados sem remover verificações de PDF/isolamento.
- `docs/e2e.md` e este documento: localização atualizada e resultados reais. Scripts/evidências locais ignorados em `.factory-results/FEAT-005-*` e `.factory-results/local-beta/upgrade-FEAT-005.ps1`.

## Verificação dos critérios
| Critério | Verificação executada | Resultado |
| --- | --- | --- |
| AC1 | `notes.component.spec.ts`, E2E `note-settings.spec.ts` e browser beta: três áreas e âmbitos pessoais/equipa explícitos, seleção acessível e visível | PASS |
| AC2 | Teste de acessibilidade/perfil, E2E centralização/PDF e browser beta: sem formulários de notas no perfil, unidades mantidas, ligação do Studio a /notes | PASS |
| AC3 | HTTP/JPA: significado guardado, recuperado, 201 caracteres rejeitados sem perder dados, PATCH antigo preserva significado, criação antiga sem significado aceita. E2E salva e recupera frase/significado/símbolo | PASS |
| AC4 | Testes de componente preservam estilo existente e não duplicam; criação explícita usa o mesmo símbolo; parser real converte frase em Z6; E2E confirma persistência e modelo compartilhado com renderer/PDF | PASS |
| AC5 | Componente mantém a mesma instância; não grava ao mudar de área. E2E retém posição/negrito/linhas antes de gravar e recupera após reload. Beta conserva E6 100→101 entre áreas; valor original reposto e guardado | PASS |
| AC6 | Componente/E2E verificam PATCH da equipa apenas com noteSystem e PATCH do perfil sem noteSystem. HTTP/JPA verifica sistema partilhado por contas da mesma equipa, regras/modelos pessoais isolados e outra equipa independente | PASS |
| AC7 | Guardas de leitura/gravação, campo vazio, significado excessivo, erro 503 e recuperação do modelo: rascunhos mantidos, sem escrita de fallback. Expressão Angular de erro corrigida e coberta | PASS |
| AC8 | Guards/sidebar direcionados, integração de componentes e 10 percursos E2E reais: offline mantém bloqueio de Notas, parser/Studio/mapa/vídeo/PDF sem regressão nos checks executados | PASS |

## Validações e revisão
Skills factory-qa/factory-review aplicadas no mesmo fluxo, sem agentes. `FACTORY_RISK=medium`; sem FACTORY_TICKET_ID, por não existir ticket de auditoria canónico para esta feature.

| Comando/validação | Resultado real | Evidência |
| --- | --- | --- |
| `node tools/run-quality-gate.mjs ticket AUTO` | STANDARD PASS: config, backend 23/23 sem skips, lint, typecheck, targeted 76/76, integração 118/118, E2E 10/10 + runner 3/3, build | `.factory-results/FEAT-005-ticket-final.log`, `FEAT-005-ticket.json` |
| `npm --prefix frontend run test:targeted` (seleção focused) | Final focused 21/21 PASS | `.factory-results/FEAT-005-focused-final.log` |
| `npm --prefix frontend run e2e:ci -- note-settings.spec.ts` | PASS 1/1; repetido no gate final | `.factory-results/FEAT-005-e2e-centralized.log` |
| E2E `notebook.spec.ts` na nova localização | PASS 2/2 com PDF real; repetido no gate final | `.factory-results/FEAT-005-e2e-focused.log` e logs do gate |
| `npm --prefix frontend run audit:accessibility` | PASS | `.factory-results/FEAT-005-accessibility.log` |
| `git diff --check` no âmbito e revisão técnica | PASS / APPROVE, sem bloqueios pendentes | `.factory-results/FEAT-005-qa-review.md` |
| Upgrade local com backup e comparação antes/depois | PASS: mesmo perfil, modelo pessoal e contagem de ralis; token válido após reinício, sem reset | `.factory-results/FEAT-005-runtime.json` |
| Browser real `localhost:4200` → backend `8080` | PASS: login, três áreas, E6 existente, rascunho retido na troca de área, valor original reposto e guardado; perfil sem duplicação | `.factory-results/FEAT-005-beta-dictionary.png`, `FEAT-005-beta-verification.md` |

Seleção Maven: `FACTORY_MAVEN_TESTS=NotebookPreferencesIntegrationTest,NoteWorkflowIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest`.

Seleção Angular `QUALITY_TARGET_SPECS` (separadas por vírgulas, relativas a frontend): `src/app/modules/features/notes/notes.component.spec.ts`, `src/app/modules/core/notebook/notebook.model.spec.ts`, `src/app/modules/core/notebook/notebook.component.spec.ts`, `src/app/modules/core/services/recce-note-parser.service.spec.ts`, `src/app/accessibility.component.spec.ts`, `src/app/modules/core/guards/auth.guard.spec.ts`, `src/app/modules/core/shared/components/sidebar/sidebar.component.spec.ts`.

Ambiente: Windows, Node 22 local, Maven/Java do ambiente e Chrome Headless 156. Build 475.63 kB iniciais, sem aviso do orçamento de 500 kB; aviso preexistente RouterLink não utilizado em PecsListComponent mantido. Baseline consultada sem reabrir falhas globais independentes.

Revisão: **APPROVE**. Inspecionados payloads, ownership pessoal/equipa, compatibilidade do significado opcional, preservação de estilos/rascunhos, composição e paginação em elementos inicialmente ocultos, erros e navegação. Não foram alteradas permissões nem migradas regras pessoais para a equipa.

## Problemas e limitações
- Não há regressões introduzidas pendentes nos checks executados. Falhas intermédias: seletor E2E ambíguo corrigido sem enfraquecer teste; expressão de recuperação Angular corrigida com teste adicional. O primeiro gate falhou e os logs continuam registados; o gate final passou.
- Significado é opcional, aditivo e pessoal. Não há migração de ownership nem reescrita de notas antigas. Reutilização do símbolo na apresentação é explícita, não sobrescreve estilos existentes e exige guardar o modelo pessoal para persistir alterações.
- Beta atualizada no PID 13176 com backup da mesma H2 em ficheiro; bootstrap desativado no arranque local para não recriar/redefinir a conta. Comparação automática preservou perfil, modelo e ralis. Rali/PEC existentes continuaram visíveis. Não foi apagado nenhum dado.
- Não foram executados release global/DEEP, auditoria de dependências, CI remoto, impressão física, validação noutros browsers ou migração PostgreSQL de produção. Atualização aditiva da H2 persistente foi executada sem reset; validação da impressão continua pelo diálogo nativo.
- Alterações alheias no workspace preservadas. Sem push, merge ou deploy; apenas atualização da instância de desenvolvimento local.

## Gates independentes
- **TICKET_GATE:** PASS / APPROVED — 8/8 critérios verificados, STANDARD final e revisão aprovados.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED.

## Histórico
- 2026-10-24: PLANNED — raiz/regras confirmadas; especificação criada antes da implementação; utilizador confirmou manter dicionário pessoal.
- 2026-10-24: IN_PROGRESS — centralização implementada, significado opcional persistido e personalizações mantidas; QA direcionado iniciado. Removido noteSystem do PATCH de perfil para prevenir sobrescrita de metadados editados em Notas.
- 2026-10-24: QA — E2E novo 1/1 e regressão PDF 2/2 PASS. Primeiro gate falhou em expressão de mensagem de recuperação que mudava undefined→string durante o ciclo Angular; corrigida no produto com resultado booleano e acrescentada regressão. Focused final 21/21 e audit:accessibility PASS; gate STANDARD final em execução.
- 2026-10-24: IN_REVIEW — STANDARD final PASS (23 backend, 76 targeted, 118 integração, 10 E2E + 3 runner); revisão aprovada. Beta atualizada com backup, conta/dados/modelo preservados e UI local verificada. Aguarda aprovação do utilizador; RELEASE_GATE não executado.
