# FEAT-001 — Workflow permanente da factory-feature

- **Descrição:** configurar a skill para especificar, documentar, implementar, testar e rever cada feature com evidência persistente.
- **Estado:** COMPLETED
- **Perfil:** FAST — configuração e documentação, sem alteração de lógica de negócio.

## Objetivo e âmbito

Atualizar apenas a `factory-feature` e os seus recursos. Reutilizar `AGENTS.md`, `factory-qa` e `factory-review`. Não implementar a funcionalidade do campo genérico `[DESCREVER AQUI A FUNCIONALIDADE]` nem alterar código da aplicação.

## Requisitos funcionais

- RF1: criar automaticamente um documento por feature antes da implementação, com ID único e sem substituir documentos existentes.
- RF2: especificar objetivo, âmbito, requisitos, critérios verificáveis, casos limite, dependências, riscos e solução mínima.
- RF3: atualizar o mesmo documento ao longo das fases, com rastreabilidade entre critérios, testes e resultados reais.
- RF4: aplicar QA, revisão e gates independentes, respeitando os perfis e reutilização de evidência do `AGENTS.md`.
- RF5: fornecer relatório final conciso; impedir conclusão prematura e preservar alterações alheias.

## Critérios de aceitação

1. Dado um pedido novo, quando a skill inicia o trabalho, define o próximo ID disponível e cria `docs/features/FEAT-XXX-nome.md` antes de implementar, sem sobrescrever ficheiros; numa retoma reutiliza o documento existente.
2. Dado o documento inicial, quando se especifica a feature, contém requisitos e critérios numerados verificáveis, casos limite, erros, componentes, dependências e decisões técnicas.
3. Dada a progressão do trabalho, quando muda a fase ou surge evidência, atualiza estado, ficheiros, matriz critério/teste/resultado, limitações e histórico no mesmo documento.
4. Dada uma implementação, quando se valida, aplica `factory-qa` e `factory-review`, respeita `AGENTS.md`, distingue gates e só permite COMPLETED com todos os critérios obrigatórios verificados e sem falhas introduzidas pendentes.
5. Dado o fim do trabalho, quando reporta, apresenta ID, critérios, testes reais, regressões, gates, documento e riscos; alterações limitadas à configuração/documentação.

## Casos limite e erros

Pedido sem objetivo concreto exige esclarecimento de produto antes da implementação. IDs existentes, lacunas, retoma e concorrência não podem causar substituição de documentos. Testes não executados permanecem UNVERIFIED; falhas de ambiente que impedem observar critérios bloqueiam a conclusão. Falhas globais conhecidas mantêm-se independentes da aprovação da feature.

## Decisões técnicas e componentes

- Instruções curtas na skill e modelo Markdown em `assets/feature-template.md`, carregado apenas ao criar um documento.
- A atualização automática é uma obrigação do agente ao executar a skill em cada fase; não implica um serviço ou watcher.
- A política de risco e gates continua centralizada no `AGENTS.md`; não alterar os runners.
- Alterações anteriores em frontend, tracker, baseline e documentação E2E estão fora deste âmbito e serão preservadas.

## Ficheiros alterados

- `docs/features/FEAT-001-workflow-factory-feature.md` — especificação e evidência desta configuração.
- `.agents/skills/factory-feature/SKILL.md` — workflow e contratos de documentação, QA, revisão e reporte.
- `.agents/skills/factory-feature/assets/feature-template.md` — modelo reutilizável carregado apenas na criação.

## Testes e resultados por critério

| Critério | Verificação prevista | Resultado |
| --- | --- | --- |
| 1 | Revisão manual das instruções: vazio → 001; IDs 001/003 → 004; retoma reutiliza ID; colisão exige reconciliação antes de implementar | PASS — contrato revisto; sem execução de um alocador, que não foi criado |
| 2 | Comparação manual entre requisitos, modelo e especificação | PASS — todos os campos pedidos presentes |
| 3 | Revisão das transições e atualização deste documento | PASS — PLANNED antes da implementação, IN_PROGRESS e IN_REVIEW registados |
| 4 | Validação da skill, gate FAST e revisão dos contratos QA/review/gates | PASS — validações executadas e políticas compatíveis |
| 5 | Inspeção do diff e contrato de relatório final rastreável | PASS — três ficheiros desta configuração; nenhum código de negócio alterado nesta tarefa |

## Resultados das validações

- `python quick_validate.py .agents/skills/factory-feature`: PASS (`Skill is valid!`), usando o Python do runtime e o script da `skill-creator`. Inicialmente falhou por ausência de PyYAML; instalado PyYAML 6.0.3 apenas em `.factory-results/skill-validation-deps`, exposto por `PYTHONPATH`. A tentativa de instalação na sandbox falhou por DNS; repetição autorizada fora dela passou. Evidência: `.factory-results/FEAT-001-skill-validation.log` e `FEAT-001-validator-setup-retry.log`.
- `FACTORY_RISK=low node tools/run-quality-gate.mjs ticket AUTO`: FAST, PASS em configuração Factory, lint, typecheck e testes Angular direcionados (26/26). O runner incluiu frontend devido a alterações anteriores já existentes. `FACTORY_TICKET_ID` removido do ambiente desta execução (não há ticket de auditoria para esta feature).
- Ambiente do gate: Node 22.23.4, Chrome Headless; `QUALITY_TARGET_SPECS=src/app/modules/features/pecs/pecs-editor/recce-routing.component.spec.ts,src/app/modules/core/guards/auth.guard.spec.ts,src/app/modules/features/recce-mode/recce-mode.component.spec.ts`. Primeira execução: navegador não iniciou na sandbox; repetição autorizada fora dela passou. Evidência: `.factory-results/FEAT-001-ticket.log`, `FEAT-001-ticket-retry.log` e snapshot `FEAT-001-ticket.json`.
- Revisão focalizada segundo `factory-qa` e `factory-review`: APPROVE, sem findings bloqueantes. Inspecionados âmbito, modelo, alocação/retoma/colisão de IDs, fases, traceabilidade, impedimento de conclusão prematura e independência dos gates. Evidência detalhada: `.factory-results/FEAT-001-qa-review.md`.
- `git diff --check`: PASS; apenas avisos de normalização LF/CRLF em documentação anterior fora do âmbito.

## Problemas e limitações

Validação documental não demonstra cumprimento futuro por todos os modelos nem constitui teste concorrente de um alocador. A atualização automática depende do agente que executa a skill. Sem novas regressões observadas nos checks executados. Backend, build, E2E e gate global não executados nesta alteração FAST de configuração; não são critérios desta feature.

Consultada a baseline: mantém-se a falha conhecida de dependências `AUD-DEP-001` (0 critical, 15 high, 4 moderate), bloqueante para release e independente desta configuração. Auditoria não repetida; sem alterações de dependências da aplicação. Preservados os ficheiros anteriormente modificados de AUD-PERF-001.

## Gates

- **TICKET_GATE:** PASS → APPROVED — critérios verificados, revisão APPROVE e gate FAST aprovado.
- **RELEASE_GATE:** NOT_RUN → UNVERIFIED — não executado para esta alteração; a falha conhecida de dependências continua bloqueante para release.

## Histórico

- 2026-10-23: especificação criada antes da implementação; FEAT-001 é o primeiro ID no diretório.
- 2026-10-23: implementação iniciada na skill e no modelo reutilizável.
- 2026-10-23: IN_REVIEW — validador da skill e gate FAST aprovados após resolução de limitações de ambiente; QA/revisão focalizados sem findings bloqueantes.
- 2026-10-23: COMPLETED — cinco critérios verificados por validação documental e checks executados; relatório final preparado. Sem push, merge ou deploy.
