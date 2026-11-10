# Contas pessoais — UAC-P01 / FEAT-018

## Política aprovada em 2026-11-02

Novas contas verificam o email antes de definir a primeira password e entrar. O pedido inicial recebe apenas o email: não cria utilizador, equipa, viatura ou sessão. O link de verificação dura 24 horas; a recuperação dura 30 minutos. Ambos são de uso único e separados por finalidade. Passwords novas têm 12–128 caracteres Unicode; são guardadas com SHA-256 + BCrypt versionado para evitar truncagem aos 72 bytes. Hashes BCrypt legados continuam válidos.

Mantém-se uma sessão por conta, com duração predefinida de 8 horas. Novo login substitui a sessão anterior. Recuperar a password revoga a sessão e os pedidos de recuperação anteriores. As contas legadas mantêm ID, equipa, password e dados; `emailVerified` nulo não afirma que o email já foi verificado.

Uma conta pessoal entra em `/account` e pode consultar apenas a própria identidade. Os endpoints existentes de equipa continuam a exigir equipa autorizada. Criar tripulações, convites e novas permissões pertence às fases seguintes e não está implementado aqui.

## Configuração de email

Registo e recuperação estão **desativados por omissão**. Configurar no ambiente do processo backend, sem guardar segredos no repositório:

| Variável | Uso / valor por omissão |
| --- | --- |
| `RECCE_ACCOUNT_ENABLED` | `false`; ativação explícita dos fluxos públicos |
| `RECCE_ACCOUNT_PUBLIC_BASE_URL` | URL pública do frontend, sem query, fragmento ou credenciais; HTTPS, exceto loopback local |
| `RECCE_ACCOUNT_MAIL_FROM` | Remetente autorizado pelo fornecedor |
| `RECCE_SMTP_HOST` | Servidor SMTP |
| `RECCE_SMTP_PORT` | `587` |
| `RECCE_SMTP_USERNAME` | Utilizador, se exigido |
| `RECCE_SMTP_PASSWORD` | Segredo, se exigido |
| `RECCE_SMTP_STARTTLS` | `true`; TLS obrigatório quando ativo |
| `RECCE_SMTP_SSL` | `false`; para SMTP com TLS implícito, usar `true` e a porta apropriada |

Sem configuração mínima válida, os fluxos permanecem indisponíveis. TLS/SSL e validação de hostname são obrigatórios fora de loopback; SMTP sem encriptação destina-se apenas ao simulador local. Configuração válida não prova entrega: timeouts de ligação/leitura/escrita são 5 segundos. O fornecedor tem de aceitar remetente e credenciais. Nesta tarefa não foram configurados fornecedores nem enviados emails reais.

Após atualizar dependências, recarregar o projeto Maven e recompilar antes de executar o Main: o envio usa `spring-boot-starter-mail`. Esta alteração não reiniciou a beta nem mudou as suas credenciais.

## Segurança e persistência

- A API responde de forma condicional e uniforme para endereços existentes, inexistentes e inativos; não confirma entrega. Falha SMTP invalida a prova emitida e mantém a mesma resposta genérica. Pedir novamente continua sujeito aos limites.
- Tokens aleatórios de 256 bits só aparecem no email. A base guarda o hash; não existe fallback de tokens em logs ou API pública. O frontend remove o fragmento do endereço e envia a prova no body do POST; não a coloca em query ou armazenamento persistente.
- Limite normal: 5 pedidos por email normalizado e IP remoto em janela deslizante de 15 minutos, por operação. Registo e reenvio partilham a quota; login, verificação e recuperação têm operações próprias. Excesso devolve 429 e `Retry-After: 900`. Usa-se o endereço do socket, ignorando `X-Forwarded-For` arbitrário. Um proxy publicado precisa de uma política de endereços confiáveis própria.
- Janelas e provas são persistidas. Um registo coordenador bloqueado na base serializa contagem, consumo de provas e primeira criação, incluindo pedidos concorrentes. Provas expiradas e janelas antigas são removidas oportunisticamente em novos pedidos; contas e media não são apagados. Não há ensaio de carga elevada: o bloqueio global é uma limitação de capacidade conhecida.
- Atualização de esquema aditiva: `auth_users.email_verified` e `credential_version` anuláveis; tabelas `account_challenges` e `account_rate_limits`, com índices de expiração/atividade. Validar backup e estratégia de migração no ambiente de publicação antes de ativar. O teste de upgrade usa H2 isolado; não foi executada migração da beta nem PostgreSQL.

O harness E2E usa caixa de correio em memória, endpoint de teste protegido por chave efémera e servidor loopback, apenas no classpath de testes. A quota elevada nesse harness evita esgotá-la em dezenas de logins da regressão; os testes de integração exercitam o limite real de 5. Não há endpoint de caixa de correio em produção.

Resultados e critérios: [FEAT-018](features/FEAT-018-conta-pessoal-registo-recuperacao.md). A aprovação desta feature não aprova automaticamente um release global.
