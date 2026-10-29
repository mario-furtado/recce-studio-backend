# FEAT-007 — Apresentação com origem no Dicionário

- **Estado:** IN_REVIEW — critérios verificados e revisão aprovada; aguarda aprovação do utilizador.
- **Descrição:** O Dicionário é a origem única dos símbolos configuráveis na Apresentação.
- **Perfil:** STANDARD — formulários, sincronização de metadados e compatibilidade com modelos guardados.
- **Data:** 2026-10-25.

## Objetivo e âmbito
Confirmado e reproduzido: Apresentação permitia adicionar elementos livres e editar correspondência, símbolo e significado, criando um segundo dicionário independente. Agora oferece apenas símbolos definidos no Dicionário. Mantêm-se as regras pessoais e o sistema base partilhado; não se altera silenciosamente o âmbito para a equipa. Backend, schema e ownership não foram alterados.

## Requisitos e critérios de aceitação
1. Dado Apresentação, não existe Adicionar elemento livre; só permite configurar símbolos existentes no Dicionário, sem duplicar aliases do mesmo símbolo.
2. Correspondência, símbolo e significado são carregados do Dicionário e apresentados em leitura; papel, associação, posição, tamanho, negrito, sublinhado e destaque continuam editáveis.
3. Criar/alterar regra no Dicionário atualiza as opções; Configurar apresentação seleciona o símbolo correto e preserva os estilos existentes.
4. Apresentações antigas sem símbolo no Dicionário são preservadas para notas existentes, sem edição livre, com indicação para definir o símbolo no Dicionário. Eliminar/renomear regras não elimina preferências históricas.
5. Falha/carregamento do Dicionário impede configurar e guardar o modelo com dados não confirmados; erros não apagam o rascunho. Não há gravações automáticas.
6. Tutorial e E2E de caderno seguem o novo fluxo; exportação e isolamento entre contas mantêm-se.

## Casos limite, erros e decisões
- Várias frases com o mesmo símbolo têm uma única apresentação; distingue maiúsculas/minúsculas, como o renderer existente.
- Símbolos incompatíveis com o limite atual (40 caracteres/controlos) não são configuráveis. O texto original não é eliminado.
- Máximo existente de 250 apresentações mantido; nunca se apagam dados históricos para libertar espaço automaticamente.
- Metadados de símbolos ligados refletem o Dicionário; estilos mantêm-se e só há persistência ao guardar explicitamente o modelo. As entradas antigas não ligadas continuam no JSON e no renderer.
- Renomear um símbolo não infere uma migração dos estilos históricos para outro símbolo; a apresentação anterior fica preservada e a nova pode ser configurada.
- Repor modelo inicial repõe página e estilos configurados ligados ao Dicionário; preserva os restantes e não introduz símbolos novos.
- Regras desativadas continuam a existir no Dicionário e podem ter apresentação, para notas já guardadas.
- O contrato é do frontend de configuração; o endpoint JSON continua compatível com modelos históricos. Não é uma nova fronteira de autorização.

## Componentes, dependências e riscos
NotesComponent fornece regras e estado de carregamento confirmado ao NotebookSettingsComponent. Este oferece um seletor e a ligação Ir ao Dicionário; cria o estilo apenas ao selecionar um símbolo conhecido. Riscos cobertos: ordem assíncrona, aliases, falhas, duplicação, perda de estilos antigos, reposição e regressão do tutorial/PDF. Sem nova dependência ou migração destrutiva.

## Ficheiros alterados
- frontend/src/app/modules/core/notebook/notebook-settings.component.ts e .html: catálogo, identidade em leitura, estilos/histórico e reposição.
- frontend/src/app/modules/features/notes/notes.component.ts e .html: confirmação de carga e ligação ao catálogo.
- frontend/src/app/modules/features/tutorial/notes-tour.component.ts e notes-tour.steps.ts: exemplos definidos no Dicionário antes da apresentação; explicações atualizadas.
- frontend/src/app/modules/core/notebook/notebook-dictionary.component.spec.ts (novo): regressões da origem única, aliases, dados históricos, limites e erros.
- frontend/src/app/modules/core/notebook/notebook.component.spec.ts: persistência com Dicionário confirmado e edição de estilo.
- frontend/src/app/modules/features/notes/notes.component.spec.ts: criação prévia no Dicionário, identidade canónica e conservação de layout.
- frontend/e2e/notebook-dictionary.spec.ts (novo): criar, configurar, guardar/recarregar e renomear, preservando a apresentação histórica.
- frontend/e2e/notebook.spec.ts: define o modificador no Dicionário antes de estilizar, mantendo as verificações reais de PDF.
- docs/e2e.md e este documento: percurso e evidência.

## Verificação dos critérios
| Critério | Testes/checks executados | Resultado |
| --- | --- | --- |
| AC1 | TestBed: sem criação/remoção livre, rejeição de símbolo desconhecido, aliases únicos; E2E: seletor proveniente do Dicionário | PASS |
| AC2 | TestBed/E2E: três campos readonly, significado da regra, posição/tamanho editáveis e persistentes | PASS |
| AC3 | TestBed: metadata atualizada e layout mantido; E2E: criar, configurar, guardar/recarregar e renomear | PASS |
| AC4 | TestBed: remover o último alias preserva estilos; E2E: N7 renomeado para N8, N7 fora das opções mas preservado no JSON com posição/tamanho | PASS |
| AC5 | TestBed: 503/carregamento bloqueiam edição/PUT; repetição recupera; falha de guardar preserva rascunho; sem PUT automático | PASS |
| AC6 | E2E: tutorial completo/móvel, PDF real sem perda de avisos, offline e isolamento; backend selecionado de notebook/tenant/auth/notas | PASS |

## Validações executadas
Windows, Node 22 local, Maven e Chrome Headless; E2E com backend HTTP/JPA/H2 e frontend compilado nas portas isoladas 18765/18766. Instância beta e base de dados não reiniciadas/alteradas.

```powershell
$env:FACTORY_RISK='medium'
$env:FACTORY_MAVEN_TESTS='NotebookPreferencesIntegrationTest,NoteWorkflowIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest'
$env:QUALITY_TARGET_SPECS='src/app/modules/core/notebook/notebook-dictionary.component.spec.ts,src/app/modules/core/notebook/notebook.component.spec.ts,src/app/modules/features/notes/notes.component.spec.ts,src/app/modules/features/tutorial/notes-tour.component.spec.ts,src/app/modules/core/notebook/notebook.model.spec.ts,src/app/accessibility.component.spec.ts'
node tools/run-quality-gate.mjs ticket AUTO
```

PATH incluiu Node 22, Git e Maven; CHROME_BIN apontou para o Chrome instalado. Logs em .factory-results/.

| Comando/check | Resultado real | Evidência |
| --- | --- | --- |
| Teste direcionado antes da correção | 2/2 FAIL: criação/remoção livre e identidade editável reproduzidas | FEAT-007-before.log |
| Testes direcionados após implementação e revisão | 27/27 PASS em ambas as execuções | FEAT-007-focused.log; FEAT-007-review-focused.log |
| Ticket AUTO → STANDARD final | PASS: configuração/lint/typecheck/backend/direcionados/integração/E2E/build | FEAT-007-ticket-final.log; FEAT-007-ticket.json |
| Backend selecionado | 23/23, zero falhas/erros/skips | 2026-10-25T13-00-39.535Z-ticket-standard/backend-test.log |
| Frontend direcionados / integração | 42/42 e 131/131 | Mesmo diretório: frontend-test-targeted.log e frontend-test-integration.log |
| E2E / wrapper | 12/12 e 3/3, sem skips | Mesmo diretório: frontend-test-e2e.log |
| Build produção | PASS; inicial 475.86 kB, abaixo do aviso de 500 kB | Mesmo diretório: frontend-build.log |
| npm --prefix frontend run typecheck | PASS; repetido após revisão | FEAT-007-typecheck-final.log |
| npm --prefix frontend run audit:accessibility | PASS, incluindo rótulo final | FEAT-007-accessibility.log |
| Revisão técnica e visual | APPROVE; sem findings bloqueantes pendentes | FEAT-007-qa-review.md; FEAT-007-presentation.png |

## QA e revisão
factory-qa e factory-review aplicadas no mesmo fluxo, sem agentes independentes. A primeira passagem STANDARD teve 11/12 E2E: o novo teste bloqueou ao localizar o rótulo exato do seletor. Acrescentado aria-label explícito, sem reduzir a asserção; gate final integralmente aprovado.

Revisão protegeu a reposição do modelo contra criação de símbolos fora do catálogo e perda de apresentações históricas. Verificados metadados, sincronização, guards, ausência de gravações automáticas, erros, limites, renderização histórica e persistência após renomeação. Asserções antigas de edição livre de display/significado foram adaptadas ao novo contrato, mantendo e reforçando verificações de estilo, persistência, erros e PDF. Nenhum teste foi desativado. Não foram observadas novas regressões nos checks executados.

## Problemas e limitações
- Aviso preexistente NG8113 de RouterLink não utilizado em PecsListComponent; build aprovado, sem nova investigação global.
- Release global/DEEP, navegadores além de Chromium, leitores de ecrã reais, impressora física e cache de service worker não executados.
- Modelos antigos sem ligação ao Dicionário preservados; a gestão não destrutiva do limite histórico de 250 mantém-se.
- Alterações anteriores do utilizador preservadas. Sem push, merge ou deploy.

## Gates independentes
- **TICKET_GATE:** PASS / APPROVED — 6/6 critérios verificados, STANDARD e revisão aprovados.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED — não executado gate global de release.

## Histórico
- 2026-10-25: PLANNED — documento criado exclusivamente antes de implementar; âmbito pessoal/equipa preservado.
- 2026-10-25: IN_PROGRESS — reprodução 2/2 FAIL; implementação e testes direcionados aprovados.
- 2026-10-25: IN_REVIEW — reposição protegida, rótulo do seletor corrigido, STANDARD final PASS; pronto para aprovação do utilizador.
