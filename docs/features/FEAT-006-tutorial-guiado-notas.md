# FEAT-006 — Tutorial guiado de Notas

- **Descrição:** Aprendizagem contextual de dicionário, apresentação e caderno, com exemplos descartáveis.
- **Estado:** IN_REVIEW — implementação e validações concluídas; aguarda aprovação do utilizador.
- **Perfil:** STANDARD — navegação Angular, acessibilidade e isolamento dos dados de demonstração.
- **Data:** 2026-10-25.

## Objetivo e âmbito
A página Tutorial continha instruções estáticas e Notas tinha três áreas sem percurso guiado. Foi criado um percurso com os formulários reais de Notas, destaque do elemento explicado e amostras temporárias. A navegação habitual ganhou uma indicação simples: regra → apresentação → caderno. Nenhuma regra de negócio, ownership ou lógica de persistência foi alterada.

## Requisitos
- Entrada em Tutorial e ajuda na página Notas; percurso completo de 12 passos e percursos independentes por área.
- Escurecimento, foco no elemento, texto contextual e controlos Anterior/Próximo/Sair; sem avanço por temporizador.
- Demonstração descartável; nenhuma escrita HTTP ou em armazenamento local, mesmo se um formulário de exemplo guardar.
- Reutilizar renderização, paginação e deteção real de overflow, sem biblioteca adicional.

## Critérios de aceitação
1. Dado Tutorial ou Notas, ao iniciar a ajuda, apresenta o percurso completo; Tutorial oferece também percursos independentes por área, identificados como demonstração temporária.
2. Dada a introdução, destaca Notas no menu; apenas ao avançar navega para a demonstração contextual em /notes/learn.
3. Cada passo apresenta título, explicação, indicador, Anterior, Próximo e Sair (na conclusão, Próximo dá lugar a Experimentar); teclado, Escape, foco e ecrã móvel permitem completar/sair.
4. Dado Dicionário, demonstra frase, significado e símbolo; distingue regras pessoais de sistema base partilhado.
5. Dada Apresentação, demonstra ligação do símbolo, associação/posição/tamanho dos modificadores e pré-visualização real.
6. Dado Caderno, demonstra formato, orientação, margens, linhas, separadores e um aviso real de conteúdo que não cabe, sem cortar/reduzir silenciosamente.
7. Demonstra utilização no Studio e exportação PDF, com exemplo visível e conclusão que permite experimentar nas configurações reais.
8. Avançar/recuar/sair/recarregar ou guardar no exemplo nunca altera regras, modelo ou armazenamento reais; reiniciar cria dados novos.

## Casos limite e comportamentos de erro
- Elemento de destaque ausente/recolhido: explicação e saída continuam disponíveis, com mensagem de apoio.
- Resize/scroll: recalcular destaque com requestAnimationFrame e listener de scroll em captura, incluindo contentores internos; sem animação obrigatória.
- Percurso desconhecido (incluindo __proto__) inicia o percurso contextual padrão. A introdução ignora parâmetros de secção.
- Sair descarta os exemplos e regressa a Tutorial; a conclusão oferece acesso explícito às Notas reais. O foco passa ao título da página destino.
- Notas mantém restrições de autenticação/offline; Tutorial oculta as entradas de configuração offline. A introdução acedida diretamente offline regressa a Tutorial.
- A ajuda avisa para guardar edições antes de sair da página Notas: não transfere rascunhos não guardados para outra rota.
- O passo de overflow usa um bloco longo real; o botão de impressão fica desativado. Recuar/avançar restaura o exemplo válido.

## Componentes, dependências e riscos
Frontend apenas. Tutorial → introdução → cópia de Notas → amostra Studio/PDF → configurações reais, por decisão explícita. As rotas mantêm os guards existentes. Nenhuma PEC remota é criada/aberta para ensinar o Studio. Riscos principais: DI consumir serviços reais, fuga de foco e desalinhamento do destaque; cobertos por testes e revisão visual. Dados de exemplo não contêm dados pessoais nem tokens.

## Decisões técnicas
- Rotas lazy /tutorial/notes e /notes/learn; sem aumento relevante do bundle inicial ou novas dependências.
- NotesComponent, NotebookSettingsComponent e NotebookComponent reais, com três providers novos por instância: DemoDictionary, DemoNotebook e DemoTeamProfile. Estes não herdam serviços de produção e não dependem de HttpClient/localStorage/IndexedDB.
- Exemplos preparados por passo e assinalados; fundo inert/aria-hidden evita ações acidentais. Dialog modal nativo com contenção explícita de Tab/Shift+Tab, foco no título e saída por Escape.
- A5 vertical, seis linhas e 18 pt são uma configuração explícita de demonstração. Nenhuma redução automática de letra.
- Studio é uma amostra temporária dos componentes reais de caderno, acompanhada das instruções para a PEC real. O tutorial não abre impressão automaticamente.

## Ficheiros alterados
- frontend/src/app/app.routes.ts: duas rotas lazy de aprendizagem.
- frontend/src/app/modules/features/tutorial/tutorial.component.ts e .html: entradas para os percursos; modo offline.
- frontend/src/app/modules/features/tutorial/notes-tour.component.ts, .html e .css: navegação, modal, destaque e acessibilidade.
- frontend/src/app/modules/features/tutorial/notes-tour.steps.ts: conteúdo e limites dos percursos.
- frontend/src/app/modules/features/tutorial/notes-demo.providers.ts: serviços exclusivamente em memória.
- frontend/src/app/modules/features/notes/notes.component.ts e .html: entrada de ajuda, indicação do percurso, modo de demonstração e alvos estáveis.
- frontend/src/app/modules/core/shared/components/sidebar/sidebar.component.html: alvo Notas.
- frontend/src/app/modules/core/notebook/notebook-settings.component.html: alvo das opções de página e texto correto sobre âmbito pessoal.
- frontend/src/app/modules/features/tutorial/notes-tour.component.spec.ts: isolamento, transições, overflow/recuperação, foco e parâmetros inválidos.
- frontend/src/app/modules/features/notes/notes.component.spec.ts: provider Router para a nova ligação.
- frontend/e2e/notes-tour.spec.ts: percurso real, teclado/móvel, reload e comparação de dados HTTP/storage.
- docs/e2e.md e este documento: evidência e âmbito.

## Verificação dos critérios
| Critério | Testes/checks | Resultado executado |
| --- | --- | --- |
| AC1 | E2E: entrada Tutorial, atalhos, ajuda em Notas e indicadores por percurso | PASS no gate |
| AC2 | TestBed: sem autoavanço; E2E: menu destacado e transição explícita para /notes/learn | PASS no gate |
| AC3 | TestBed: foco, Tab/Shift+Tab, cancel; E2E: 12 passos, Anterior, Escape, teclado e viewport 390×844 | PASS no gate |
| AC4 | Formulário real preenchido e regra temporária E6 visível; explicações de âmbito | PASS no gate |
| AC5 | Modelo real: ++ anterior/superior direito/60%, E6++ nt; inspeção visual desktop/móvel | PASS no gate e E2E dirigido após revisão |
| AC6 | TestBed e E2E: seis linhas, aviso real, impressão bloqueada e recuperação | PASS no gate |
| AC7 | E2E: amostra Studio válida, instruções PDF, conclusão para /notes; regressão de PDF existente | PASS no gate |
| AC8 | TestBed: providers locais, guardar/recarregar/eliminar sem HTTP/storage; novas instâncias limpas; E2E: reload, zero escritas e dados reais idênticos antes/depois | PASS no gate |

## Validações executadas
Ambiente Windows, Node 22 do runtime local, Maven, Chrome Headless 156, backend E2E/H2 e frontend compilado em portas isoladas 18765/18766. A instância beta e a sua base de dados não foram reiniciadas nem alteradas.

Comando principal (PATH inclui Node 22, Git e Maven):

```powershell
$env:FACTORY_RISK='medium'
$env:FACTORY_MAVEN_TESTS='NotebookPreferencesIntegrationTest,NoteWorkflowIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest'
$env:QUALITY_TARGET_SPECS='src/app/modules/features/tutorial/notes-tour.component.spec.ts,src/app/modules/features/notes/notes.component.spec.ts,src/app/modules/core/notebook/notebook.component.spec.ts,src/app/modules/core/guards/auth.guard.spec.ts,src/app/modules/core/shared/components/sidebar/sidebar.component.spec.ts'
node tools/run-quality-gate.mjs ticket AUTO
```

| Comando/check | Resultado | Evidência em .factory-results/ |
| --- | --- | --- |
| Ticket AUTO → STANDARD | PASS; configuração, backend, lint, typecheck, direcionados, integração, E2E e build | FEAT-006-ticket-final.log; FEAT-006-ticket.json |
| Backend selecionado | 23/23; zero falhas/erros/skips | 2026-10-25T11-52-51.065Z-ticket-standard/backend-test.log |
| Direcionados | 37/37 | Mesmo diretório: frontend-test-targeted.log |
| Integração de componentes | 125/125 | Mesmo diretório: frontend-test-integration.log |
| E2E + wrapper | 11/11 + 3/3; sem skips | Mesmo diretório: frontend-test-e2e.log |
| Build produção | PASS; inicial 475.86 kB, abaixo do aviso de 500 kB | Mesmo diretório: frontend-build.log |
| npm --prefix frontend run typecheck | PASS após revisão | FEAT-006-typecheck-final.log |
| npm --prefix frontend run audit:accessibility | PASS | FEAT-006-accessibility.log |
| npm --prefix frontend run e2e:ci -- --grep FEAT-006 | PASS: 1/1 após ajuste visual dos alvos de posição/preview e rebuild de produção | FEAT-006-review-e2e.log |

## QA e revisão
factory-qa e factory-review aplicadas no mesmo fluxo, sem agentes independentes. Primeira execução direcionada: 10/11, por altura insuficiente no exemplo; corrigida configuração de demonstração. Primeira execução STANDARD: E2E 10/11, revelou fuga de foco no limite do diálogo nativo; corrigida contenção e acrescentados testes. Repetição STANDARD acima integralmente aprovada; nenhuma asserção desativada/enfraquecida.

Revisão: fornecedores em memória sem persistência; guards mantidos; seletores estáticos sem HTML de utilizador; listeners/frames/dialog limpos ao destruir; nota/caderno reais reutilizados; dados reais nunca utilizados nos exemplos. Inspeção das capturas desktop, overflow e móvel realizada. Ajustados os destaques para posição do modificador e nota renderizada; confirmação E2E final PASS (1/1), incluindo posição visível em viewport móvel. Veredicto de revisão: APPROVE, sem findings bloqueantes; evidência em .factory-results/FEAT-006-qa-review.md.

## Problemas e limitações
- Falha conhecida: aviso NG8113 de RouterLink não utilizado em PecsListComponent, preexistente; build passou.
- Não executados: release global/DEEP, navegadores além de Chromium, leitores de ecrã reais, impressora física e cache de service worker.
- O tutorial é demonstrativo: alterações do exemplo são descartadas; só após a conclusão o utilizador trabalha nas configurações reais.
- As alterações anteriores do utilizador foram preservadas. Sem push, merge ou deploy.

## Gates independentes
- **TICKET_GATE:** PASS / APPROVED — STANDARD integral e confirmação dirigida após revisão aprovados; 8/8 critérios verificados.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED — não foi solicitado gate global de release.

## Histórico
- 2026-10-25: PLANNED — documento criado exclusivamente antes de implementar; estrutura obrigatória e AGENTS.md confirmados.
- 2026-10-25: IN_PROGRESS — implementação com isolamento em memória, testes, correção de exemplo e contenção de foco.
- 2026-10-25: IN_REVIEW — STANDARD PASS; revisão visual e documental, confirmação dirigida final 1/1 aprovada; aguarda aprovação do utilizador.

