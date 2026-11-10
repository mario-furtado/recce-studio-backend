# Tripulações — UAC-P02 / FEAT-019

## Estado e âmbito

Novas tripulações têm proprietário explícito por ID de conta. Uma conta pode ser proprietária de várias tripulações, sem convite. Nomes de piloto/navegador são dados desportivos e não concedem acesso. D11 aprovada: viaturas, imagens e sistema base pertencem a cada nova tripulação, sem cópia automática. O dicionário pessoal, o modelo visual e a capa principal continuam pessoais.

Equipas/contas antigas mantêm o vínculo existente. P02 não cria crews a partir de equipas antigas nem escolhe proprietário para o legado. Migração, leitores, convites, arquivo e transferência pertencem às fases seguintes.

## Rollout controlado

`RECCE_CREWS_ENABLED` é `false` por omissão. Não ativar globalmente antes de validar a compatibilidade P03/P09 prevista no roadmap. Os testes isolados ativam a flag. Registo/SMTP têm configuração independente; ligar crews não abre registo público.

Quando ativa, a página **A minha conta** permite criar e abrir tripulações. O contexto selecionado é visível no workspace. A troca faz recarregamento integral para descartar caches e respostas antigas; guardas de saída existentes continuam a proteger rascunhos antes de chegar à conta. A seleção é local à aba e vinculada à sessão atual, removida no novo login/logout/entrada offline. Uma seleção de outra sessão bloqueia pedidos de workspace até escolher/limpar o contexto na conta, sem fallback silencioso.

Captura e sincronização offline de novos contextos estão bloqueadas nesta fase: IndexedDB ainda não distingue tripulações. Para os dados antigos, mantém-se o percurso existente; não há adoção/reatribuição implícita.

## Contrato de API

- `GET /api/auth/me` inclui `crewsEnabled`, além da identidade própria; ignora a seleção para não se tornar uma consulta de terceiro.
- `GET /api/crews` lista apenas as tripulações de que a conta autenticada é proprietária. Não devolve chaves de criação ou diretório de proprietários.
- `POST /api/crews` aceita apenas `{ "name": "Nome" }` e exige `Idempotency-Key` de 16–64 caracteres alfanuméricos, `_` ou `-`. Nome de 1–100 caracteres, sem controlos. A chave é vinculada à conta: retry com o mesmo nome devolve a mesma crew; reutilização para outro nome devolve409. Transação e bloqueio da conta evitam criação parcial/duplicada por concorrência.
- Pedidos de workspace usam `X-Crew-Id`. O header escolhe contexto, nunca concede autorização: o servidor verifica conta/sessão e propriedade persistida. Contexto desconhecido/estrangeiro devolve404 uniforme; vazio/múltiplo é inválido. Flag off devolve403 para o novo contrato, sem fallback.
- Sem header, preserva-se apenas o contexto legado já vinculado à conta; conta pessoal sem equipa não recebe equipa default. Novos recursos reutilizam o ID do perfil da própria crew para os filtros existentes.
- Rali/PEC/nota/viatura continuam a validar as relações pai/filho. A listagem filtrada de PECs mantém o contrato existente200[] para pai ausente/estrangeiro; acesso direto/mutação de recurso estrangeiro falha. Respostas com contexto novo são no-store. Corpo com owner forjado não atribui propriedade.

## Persistência e operação

Adição da tabela `crews` (owner, chave de criação, nome inicial, data) com unicidade owner/chave e índice por owner; `team_profile.managed_crew` anulável distingue perfis novos de legado. Perfil e crew são criados atomicamente. Perfis novos começam sem viaturas, fotografias ou nomes desportivos fictícios. A edição do nome continua no ecrã Perfil/Equipa; a listagem de crews apresenta esse nome atual.

Não foi migrada/reiniciada a beta nesta feature. Antes de publicação, validar backup, atualização aditiva do esquema e os requisitos de rollout no ambiente alvo. Testes usam H2; PostgreSQL/S3, múltiplos processos e carga elevada não foram validados. Uma mudança de propriedade ou eliminação de conta não está implementada nesta fase.

Critérios e resultados reais: [FEAT-019](features/FEAT-019-tripulacoes-propriedade-contexto.md).
