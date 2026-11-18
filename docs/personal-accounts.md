# Contas pessoais — UAC-P01 / FEAT-018

## Política aprovada em 2026-11-02

O registo recolhe email, nome, data de nascimento e password. O código de seis dígitos confirma o pedido que o gerou, dura cinco minutos e só pode ser usado uma vez. A conta é criada após a confirmação. A recuperação mantém um link de uso único válido durante 30 minutos. Passwords novas têm 12–128 caracteres Unicode e são guardadas com SHA-256 + BCrypt versionado. Hashes BCrypt legados continuam válidos.

Em **A minha conta**, o titular consulta e corrige nome e data de nascimento. `GET /api/auth/me` devolve estes campos apenas para a conta autenticada. `PATCH /api/auth/me` aceita apenas `displayName` e `dateOfBirth` no formato `AAAA-MM-DD`. As contas existentes mantêm os campos em branco até serem preenchidos. Atualizar frontend e backend em conjunto. O endpoint `POST /api/auth/verify-email` continua a aceitar links emitidos antes da transição, até expirarem.

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

### Ensaio com Resend

Para o primeiro ensaio, usar `reccestudiohelpdesk@<domínio-verificado>` como remetente e o URL HTTPS do frontend de ensaio em `RECCE_ACCOUNT_PUBLIC_BASE_URL`. Após verificar o domínio no Resend, definir `RECCE_SMTP_HOST=smtp.resend.com`, `RECCE_SMTP_PORT=587`, `RECCE_SMTP_USERNAME=resend`, `RECCE_SMTP_STARTTLS=true` e `RECCE_SMTP_SSL=false`. A chave de envio fica em `RECCE_SMTP_PASSWORD`, no ambiente do backend.

O percurso começa em **Criar conta**, no login. Depois de preencher o formulário, o utilizador introduz o código na página **Verifica o teu email**. Pode reenviar o código ou corrigir o endereço sem repetir os dados. Após confirmar, regressa ao login e recebe um email de boas-vindas. Uma falha nesse segundo email não desativa a conta. A opção `RECCE_ACCOUNT_ENABLED` ativa registo e recuperação em conjunto. Ativá-la primeiro no ambiente de ensaio e testar com uma caixa de correio controlada.

### Ensaio local sem Resend

Arrancar o [Mailpit](https://mailpit.axllent.org/docs/install/) com SMTP e interface limitados ao computador local:

```powershell
mailpit.exe --smtp 127.0.0.1:1025 --listen 127.0.0.1:8025
```

Na configuração **Main local** do IntelliJ, definir estas variáveis de ambiente para o backend local e reiniciar esse processo:

| Variável | Valor local |
| --- | --- |
| `RECCE_ACCOUNT_ENABLED` | `true` |
| `RECCE_ACCOUNT_PUBLIC_BASE_URL` | `http://localhost:4200` |
| `RECCE_ACCOUNT_MAIL_FROM` | `reccestudiohelpdesk@example.invalid` |
| `RECCE_SMTP_HOST` | `127.0.0.1` |
| `RECCE_SMTP_PORT` | `1025` |
| `RECCE_SMTP_STARTTLS` | `false` |
| `RECCE_SMTP_SSL` | `false` |

Neste ensaio, deixar o utilizador e a password SMTP vazios. Pedir o código com um endereço fictício em `http://localhost:4200/register` e consultar a caixa de ensaio em `http://127.0.0.1:8025`. O Mailpit recebe o email no próprio computador.

Após atualizar dependências, recarregar o projeto Maven e recompilar antes de executar o Main: o envio usa `spring-boot-starter-mail`. Esta alteração não reiniciou a beta nem mudou as suas credenciais.

## Segurança e persistência

- Antes da confirmação, a API usa o mesmo percurso para endereços existentes, inexistentes e inativos. A confirmação nunca substitui uma conta existente. A falha no envio do código expira-o e deixa o pedido disponível para reenvio.
- O identificador aleatório do registo fica em memória no navegador e é enviado no body, juntamente com o código, para confirmar. A base guarda o hash da password e o hash do código associado a esse identificador. Os dados pendentes expiram após 30 minutos sem reenvio e são removidos ao confirmar. Os tokens de recuperação continuam no fragmento do link de email e são retirados do endereço pelo frontend.
- Limite normal: 5 pedidos por email normalizado e IP remoto em janela deslizante de 15 minutos, por operação. Registo e reenvio partilham a quota; login, verificação e recuperação têm operações próprias. Excesso devolve 429 e `Retry-After: 900`. Usa-se o endereço do socket, ignorando `X-Forwarded-For` arbitrário. Um proxy publicado precisa de uma política de endereços confiáveis própria.
- Janelas e provas são persistidas. Um registo coordenador bloqueado na base serializa contagem, consumo de provas e primeira criação, incluindo pedidos concorrentes. Provas expiradas e janelas antigas são removidas oportunisticamente em novos pedidos; contas e media não são apagados. Não há ensaio de carga elevada: o bloqueio global é uma limitação de capacidade conhecida.
- Atualização de esquema aditiva. O registo por código acrescenta colunas anuláveis para os dados pendentes, o hash e o prazo do código em `account_challenges`. Validar backup e atualização de esquema no ambiente de publicação antes de ativar.

O harness E2E usa caixa de correio em memória, endpoint de teste protegido por chave efémera e servidor loopback, apenas no classpath de testes. A quota elevada nesse harness evita esgotá-la em dezenas de logins da regressão; os testes de integração exercitam o limite real de 5. Não há endpoint de caixa de correio em produção.

Resultados e critérios: [FEAT-018](features/FEAT-018-conta-pessoal-registo-recuperacao.md). A aprovação desta feature não aprova automaticamente um release global.
