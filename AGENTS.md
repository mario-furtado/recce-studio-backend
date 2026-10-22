# AI Software Factory

Estas regras aplicam-se a todo o repositório. São a fonte única para seleção de perfil, gates e reutilização de evidência; as Skills devem referenciá-las em vez de as duplicar.

## Princípios

- Trabalhar apenas no âmbito pedido e preservar alterações alheias.
- Ler primeiro o ticket, o diff e os módulos afetados. Não repetir inventários globais já válidos na sessão.
- Reutilizar resultados quando o comando, o código afetado e o ambiente relevante não mudaram.
- Guardar logs detalhados em `.factory-results/` e comunicar apenas resumos e linhas diagnósticas.
- Não enfraquecer, ignorar ou desativar testes. Não fazer push, merge ou deploy sem pedido explícito.

## Perfis

- `FAST`: documentação, configuração local ou alteração pequena e isolada; análise mínima, testes direcionados e revisão focalizada.
- `STANDARD`: perfil normal para código; análise de impacto, testes afetados e regressões relacionadas, build quando aplicável e revisão técnica.
- `DEEP`: apenas para preparação de release, alteração transversal, risco sistémico ou pedido explícito; acrescenta regressão completa e auditorias globais.

Seleção automática: baixo risco e âmbito isolado usa `FAST`; código ou risco médio usa `STANDARD`; `DEEP` nunca é escolhido automaticamente apenas porque um ticket é de segurança. Segurança crítica, autorização, privacidade, persistência ou risco de perda de dados usam `STANDARD` mais testes específicos rigorosos do limite afetado. Escalar para `DEEP` apenas quando o impacto for global, incerto ou orientado a release.

## Gates independentes

- `TICKET_GATE`: verifica critérios de aceitação, regressão direcionada e ausência de novas falhas no âmbito alterado. Uma falha conhecida e não relacionada não reprova este gate quando coincide com `docs/ai/QUALITY_BASELINE.md` e não impede a verificação.
- `RELEASE_GATE`: verifica a aplicação completa. Qualquer check obrigatório executado e falhado reprova este gate, mesmo que a falha esteja na baseline.

Um ticket pode ficar `RESOLVED` com `TICKET_GATE: PASS` e `RELEASE_GATE: FAIL`, desde que a falha de release seja preexistente, independente, esteja registada e a revisão aprove o diff. Se uma falha conhecida impedir observar o comportamento alterado, usar `BLOCKED` ou verificação `UNVERIFIED`; nunca inferir aprovação.

## Evidência e baseline

- Consultar `docs/ai/QUALITY_BASELINE.md` antes de investigar um resultado global conhecido.
- Não voltar a diagnosticar uma assinatura conhecida, salvo se os ficheiros alterados puderem afetá-la, a assinatura mudar ou o utilizador pedir nova investigação.
- Registar comando, perfil, resultado e apenas evidência nova. Atualizar a baseline apenas após execução real.
- Para comandos e contratos, seguir `docs/quality-gates.md`.
- Este repositório contém o backend Spring Boot na raiz e o frontend Angular em `frontend/`. Os gates selecionam automaticamente as áreas alteradas; para testes Maven específicos usar `FACTORY_MAVEN_TESTS` e para specs Angular usar `QUALITY_TARGET_SPECS`.

## Uso das Skills

- Usar somente a Skill necessária para o pedido.
- Em tickets `FAST`, fazer QA e revisão focalizados no mesmo fluxo; não carregar Skills adicionais nem solicitar revisão independente sem risco concreto ou pedido explícito.
- Em `STANDARD`/`DEEP`, usar `factory-qa` e `factory-review` quando a alteração ou o pedido exigir essas fases. Ler cada instrução uma vez por tarefa.
- Auditorias consultam primeiro a baseline e não recriam tickets já confirmados sem evidência nova.
