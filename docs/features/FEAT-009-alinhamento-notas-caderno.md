# FEAT-009 — Alinhamento das notas no caderno

- **Estado:** IN_REVIEW — implementação, QA e revisão concluídas; aguarda aprovação.
- **Perfil:** STANDARD — preferências pessoais persistidas e renderização de impressão/PDF.
- **Descrição:** Linhas centradas por defeito, com alinhamento esquerda/centro/direita em Caderno e exportação.
- **Data:** 2026-10-25.

## Objetivo e âmbito
A captura e um teste geométrico confirmaram linhas iniciadas à esquerda. A sequência completa de cada linha fica agora centrada entre as margens. A opção aplica-se ao documento, pré-visualização e impressão/PDF; não altera posições internas de notas/modificadores ou texto. Esta versão permite escolher alinhamento horizontal, sem recuos em milímetros ou definição por nota.

## Requisitos e critérios de aceitação
1. Modelos novos e antigos sem a opção apresentam notas centradas por defeito, sem apagar preferências ou alterar texto.
2. Em Caderno e exportação, o utilizador escolhe Alinhamento das notas: esquerda, centro ou direita; a pré-visualização acompanha a escolha.
3. Guardar/recarregar mantém a opção pessoal; outras contas, mesmo na mesma equipa, mantêm preferências próprias.
4. PDF/impressão reproduz o alinhamento; sequências quebradas alinham cada linha, mantendo separadores, margens e posições dos modificadores.
5. Valores inválidos são rejeitados por frontend/backend sem sobrescrever a configuração válida. Paginação e avisos de overflow continuam rigorosos.

## Decisões técnicas e casos limite
- page.alignment opcional na versão1: left/center/right. Ausência significa center; null e outros valores são inválidos. Modelos/clientes anteriores continuam aceites.
- Leitura no cliente acrescenta o valor inicial sem gravação automática; renderer também tem fallback para entradas antigas recebidas diretamente. Backend aceita a opção por allowlist; nenhuma migração de schema/dados.
- Flex justify-content por linha aplica-se à área útil entre margens. A cópia DOM de impressão conserva o estilo explícito de cada linha.
- Quebras de sequência, notas desconhecidas, avisos, separadores e dimensões mantêm a lógica existente. Nenhuma redução de letra ou corte introduzido.
- Opção pertence ao modelo pessoal existente. Repor modelo inicial volta ao alinhamento centrado.

## Componentes, dependências e riscos
NotebookSettings/Model/Service/Component e validador Java. Fronteira de persistência continua autenticada e indexada por utilizador, sem parâmetros de ownership. Riscos cobertos: JSON antigo, enum malformado, CSS de impressão, wrapping/margens e isolamento. Sem nova dependência.

## Ficheiros alterados
- frontend/src/app/modules/core/notebook/notebook.model.ts: tipo opcional, default e validação.
- frontend/src/app/modules/core/notebook/notebook.service.ts: normalização de leitura de modelos antigos.
- frontend/src/app/modules/core/notebook/notebook-settings.component.html: escolha de alinhamento.
- frontend/src/app/modules/core/notebook/notebook.component.ts: alinhamento por linha e CSS partilhado com impressão.
- src/main/java/org/example/service/NotebookPreferencesValidator.java: enum opcional na allowlist da página.
- src/test/java/org/example/controller/NotebookPreferencesIntegrationTest.java: persistência/JPA, legado, valores inválidos e isolamento.
- frontend/src/app/modules/core/notebook/notebook.component.spec.ts e notebook.model.spec.ts: geometria, wrapping, cópia impressa, modelos antigos e validação.
- frontend/e2e/notebook-alignment.spec.ts (novo): UI/HTTP/PDF reais e recarregamento.
- docs/e2e.md e este documento: resultados reais e âmbito.

## Verificação dos critérios
| Critério | Testes/checks executados | Resultado |
| --- | --- | --- |
| AC1 | Reprodução geométrica antes da correção; TestBed com ausência explícita; Service legacy/default sem PUT; E2E carrega JSON sem alignment | PASS |
| AC2 | Geometria esquerda/centro/direita entre margens, UI com as três opções e captura centrada | PASS |
| AC3 | HTTP/JPA guarda os três valores; mesma equipa com preferências independentes; E2E guarda right e recarrega; beta aceita a opção | PASS |
| AC4 | TestBed: linhas quebradas e cópia impressa, avisos/separadores; três PDFs reais, texto preservado e coordenadas extraídas do PDF confirmam centragem | PASS |
| AC5 | Frontend/backend rejeitam null, valores desconhecidos, CSS, tipos errados; configuração válida não sobrescrita; regressões de overflow/PDF aprovadas | PASS |

## Comandos e validações executadas
Windows, Node22 local, Maven, Chrome Headless156 e E2E HTTP/JPA/H2 isolado em18765/18766. PATH incluiu Node22/Git/Maven; CHROME_BIN apontou para o Chrome instalado.

```powershell
$env:FACTORY_RISK='medium'
$env:FACTORY_MAVEN_TESTS='NotebookPreferencesIntegrationTest,NoteWorkflowIntegrationTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest'
$env:QUALITY_TARGET_SPECS='src/app/modules/core/notebook/notebook.model.spec.ts,src/app/modules/core/notebook/notebook.component.spec.ts,src/app/modules/core/notebook/notebook-dictionary.component.spec.ts,src/app/modules/features/notes/notes.component.spec.ts,src/app/modules/features/tutorial/notes-tour.component.spec.ts,src/app/accessibility.component.spec.ts'
node tools/run-quality-gate.mjs ticket AUTO
npm --prefix frontend run e2e:ci -- --grep FEAT-009
npm --prefix frontend run audit:accessibility
```

O E2E dirigido foi executado antes do gate. Logs detalhados em .factory-results/.

| Check | Resultado real | Evidência |
| --- | --- | --- |
| Reprodução antes da correção | 1/9 FAIL: desvio do centro; 8 regressões PASS | FEAT-009-before.log |
| Direcionados de modelo/renderer | 20/20 PASS | FEAT-009-focused.log |
| E2E dirigido | 1/1 PASS, PDFs reais para três alinhamentos | FEAT-009-focused-e2e.log |
| Ticket AUTO → STANDARD | PASS: configuração/backend/lint/typecheck/direcionados/integração/E2E/build | FEAT-009-ticket.log; FEAT-009-ticket.json |
| Backend selecionado | 24/24, zero falhas/erros/skips | 2026-10-25T14-02-55.051Z-ticket-standard/backend-test.log |
| Frontend direcionados / integração | 48/48 e136/136 | Mesmo diretório: frontend-test-targeted.log e frontend-test-integration.log |
| E2E / wrapper | 14/14 e3/3, sem skips | Mesmo diretório: frontend-test-e2e.log |
| Build produção | PASS; inicial475.82kB | Mesmo diretório: frontend-build.log |
| Auditoria estática de acessibilidade | PASS | FEAT-009-accessibility.log |
| Inspeção independente dos PDFs com Python/pypdf | Uma página cada, E6/++/nt/D6/ATT/NC/G3 preservados; posição de G3 cresce esquerda→centro→direita e centro coincide com ponto médio (<1pt) | FEAT-009-pdf-validation.json; FEAT-009-left/center/right.pdf |
| Revisão técnica e visual | APPROVE, sem bloqueios | FEAT-009-qa-review.md; FEAT-009-centered.png |

## Atualização da beta local
Backend local atualizado para aceitar a nova opção, mantendo a base H2 persistente. Antes de parar, confirmou-se PID/porta e caminho da base; após terminar o processo, criou-se backup e reutilizou-se o comando de arranque com bootstrap de testes desativado. Não houve reset.

Evidência FEAT-009-runtime.json/log: novoPID10860, mesmo profileID, mesmo modelo de caderno, mesmo número de ralis e token de verificação válido após restart. Um PUT temporário confirmou a aceitação/persistência de alignment; o modelo original foi restaurado e comparado integralmente por JSON. Backup local: .factory-results/local-beta/data/beta-before-FEAT-009-20261025-140749.mv.db. A autenticação de verificação pode exigir novo login nas sessões anteriores da conta de teste.

## QA, revisão e limitações
factory-qa/factory-review no mesmo fluxo, sem agentes. Inspecionados os ficheiros modificados, incluindo os já não rastreados pelo Git. A validação aceita apenas os três valores; estilos CSS usam alternativas estáticas, não dados arbitrários. Modelo antigo não é gravado automaticamente. Pré-visualização/impressão usam o mesmo DOM e CSS; preservados separadores e modificadores. Captura e três PDFs inspecionados. Não foram observadas novas regressões nos checks executados; nenhuma asserção desativada ou enfraquecida.

Aviso preexistente NG8113 de RouterLink em PecsListComponent mantido. Não executados: outros navegadores, impressora física, leitores de ecrã reais, service-worker e gate global de release/DEEP. Sem push, merge ou deploy; apenas atualização do runtime local.

## Gates independentes
- **TICKET_GATE:** PASS / APPROVED —5/5 critérios verificados, STANDARD e revisão aprovados.
- **RELEASE_GATE:** NOT_RUN / UNVERIFIED — gate global não executado.

## Histórico
- 2026-10-25: PLANNED — documento criado exclusivamente antes de implementar.
- 2026-10-25: IN_PROGRESS — reprodução falhou como esperado; alinhamento, compatibilidade, validação e testes implementados.
- 2026-10-25: IN_REVIEW — STANDARD PASS, PDF validado, beta atualizada com backup/dados preservados; aguarda aprovação.
