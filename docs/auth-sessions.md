# Sessões online

O backend mantém uma credencial opaca por utilizador. Login e registo pelo serviço emitem um token novo e persistem a expiração em milissegundos desde Unix epoch, na coluna nullable `auth_users.token_expires_at_epoch_millis` (`BIGINT`). O endpoint público de registo continua desativado nesta beta.

A validade por omissão é de **28 800 segundos (8 horas)**, configurável por `recce.auth.token-ttl-seconds` / `RECCE_AUTH_TOKEN_TTL_SECONDS`. O valor tem de ser positivo e representável em milissegundos. A expiração é absoluta, não é renovada por pedidos normais e é verificada pelo servidor em cada autenticação. Um token é inválido no instante exato da expiração, quando não tem expiração, quando não existe ou quando o utilizador está inativo. Um novo login invalida o token anterior.

`POST /api/auth/logout` recebe a credencial em `Authorization: Bearer ...`. Revoga apenas essa credencial através de um update condicional na base de dados, removendo a expiração; não aceita um utilizador/token alvo no body ou na query. Devolve `204` para um bearer apresentado, incluindo tokens já revogados, expirados ou desconhecidos, permitindo repetição sem revelar a existência de sessões. Cabeçalhos ausentes, vazios ou fora do formato Bearer recebem `401`. Login, validação e logout usam `Cache-Control: no-store`.

O frontend aguarda confirmação da revogação antes de limpar a sessão e navegar para login. Em falha de rede, erro do servidor ou ausência de resposta durante 10 segundos, mantém a credencial para permitir repetir e mostra uma mensagem de erro. Uma resposta antiga não elimina uma sessão criada entretanto. Sessões exclusivamente offline (`offline-session`) e ausência de credencial são tratadas localmente e não enviam esse marcador ao backend. Tokens online usados em modo offline continuam a exigir ligação ao servidor para confirmar logout.

O bootstrap de teste provisiona credenciais, mas não uma sessão autenticada: a expiração fica vazia até login. Reexecutar esse bootstrap invalida uma sessão anterior do mesmo utilizador quando volta a provisionar as credenciais.

## Atualização de bases existentes

Com `spring.jpa.hibernate.ddl-auto=update`, o Hibernate acrescenta a coluna nullable. Em ambientes cujo esquema é gerido externamente, aplicar previamente a alteração equivalente pelo processo habitual; a alteração SQL é `ALTER TABLE auth_users ADD COLUMN token_expires_at_epoch_millis BIGINT;`. Não preencher retroativamente a coluna para tokens antigos: devem ser recusados e substituídos por um novo login. A atualização foi validada numa base H2 com esquema anterior; PostgreSQL e produção não foram alterados nem validados nesta tarefa.

As contas, perfis e palavras-passe existentes são preservados. A revogação fica na persistência e não depende da memória de um processo; a expiração depende do relógio do servidor, que deve estar sincronizado entre instâncias. Um pedido já autorizado antes do logout não é cancelado retroativamente. A mudança não fornece refresh tokens nem altera as regras de contas de teste preexistentes.
