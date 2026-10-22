# Conta de teste local

A conta de teste está desativada por omissão. O backend não fornece email nem palavra-passe predefinidos.

Para a ativar localmente, fornecer todos estes valores pela configuração Spring ou pelas variáveis indicadas:

| Configuração | Valor exigido |
| --- | --- |
| `recce.test-user.enabled` / `RECCE_TEST_USER_ENABLED` | `true` explícito |
| `recce.test-user.email` / `RECCE_TEST_USER_EMAIL` | Email escolhido para o teste |
| `recce.test-user.password` / `RECCE_TEST_USER_PASSWORD` | Palavra-passe escolhida explicitamente, com pelo menos 6 caracteres |
| `recce.environment` / `RECCE_ENV` | `local`, `dev`, `development` ou `test` |
| `server.address` / `SERVER_ADDRESS` | `127.0.0.1`, `localhost`, `::1` ou `0:0:0:0:0:0:0:1` |

Todos os perfis Spring ativos também têm de ser locais, segundo a mesma lista; o perfil Spring `default` é permitido. Se não houver perfis ativos, são verificados os perfis por omissão. `RAILWAY_ENVIRONMENT_NAME` tem de estar ausente ou vazio, mesmo que `RECCE_ENV` indique um ambiente local.

Se a conta estiver ativada e qualquer condição falhar, o arranque termina com erro antes de consultar ou escrever o utilizador/perfil. Isto inclui produção, staging, preview, nomes desconhecidos e binds em todas as interfaces. Quando a flag está ausente ou é `false`, o bootstrap não consulta nem altera a persistência. Uma flag booleana inválida é rejeitada pelo binding Spring.

O bind geral do servidor continua em `0.0.0.0` por omissão; ativar a conta exige configurar explicitamente um bind local. A regra é de provisionamento e não substitui a configuração do proxy/rede: não expor esta instância local através de um proxy ou túnel.

O opt-in mantém o comportamento de criar ou atualizar o email configurado no perfil `default`, guardar a palavra-passe com BCrypt e preservar o utilizador existente. Desativar o bootstrap **não elimina nem revoga contas ou tokens já persistidos**. Antes de publicar uma base de dados anteriormente usada para testes, é necessária a revisão e desativação dessas contas; esta alteração não executa operações em deployments nem migrações sobre contas existentes.
