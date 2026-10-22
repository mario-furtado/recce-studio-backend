# Issues da auditoria adversarial

Atualizado em 2026-10-09 e preservado como resumo histórico durante a migração de 2026-10-22. O tracker canónico corrente é `docs/ai/ISSUES.md`; este ficheiro não deve ser usado para alterar estados.

| ID | Severidade | Estado | Área | Resumo | Evidência automatizada |
| --- | --- | --- | --- | --- | --- |
| AUD-SEC-001 | Alto | Confirmado, aberto | Autorização | Dados de ralis/PECs/perfil são globais; utilizador B lê o rali de A. | `TenantIsolationAuditTest` falha. |
| AUD-SEC-002 | Alto | Confirmado, aberto | Privacidade | Áudio/vídeo de recce dispensam autenticação. | `ApiAuthInterceptorAuditTest` falha. |
| AUD-SEC-003 | Alto | Confirmado, aberto | Parser/upload | GPX aceita `DOCTYPE` e entidade XML externa. | `PecAssetServiceXmlSecurityAuditTest` falha. |
| AUD-SEC-004 | Médio | Confirmado, aberto | Frontend auth | Bearer token é anexado a origem HTTP externa. | `AUD-SEC-004` falha. |
| AUD-SEC-005 | Alto condicional | Confirmado, aberto | Configuração | Conta conhecida `test@reccestudio.local`/`123456` ativa por omissão fora de prod reconhecida. | Inspeção de config/bootstrap; sem teste a deployment. |
| AUD-SEC-006 | Alto | Confirmado, aberto | Sessão | Tokens não expiram e logout não os revoga no servidor. | Inspeção de entidade/serviço/controller. |
| AUD-OFF-001 | Alto | Confirmado, aberto | Offline | Reinício deixa sessões permanentemente em `syncing`. | `AUD-OFF-001` falha. |
| AUD-OFF-002 | Alto | Confirmado, aberto | Offline/áudio | Blob referenciado mas ausente é tratado como upload bem-sucedido e permite apagar sessão. | `AUD-OFF-002` falha. |
| AUD-OFF-003 | Alto | Confirmado, aberto | Privacidade local | IndexedDB apresenta sessões de outras contas no mesmo browser. | `AUD-OFF-003` falha. |
| AUD-REC-001 | Alto | Confirmado, aberto | GPS | Permissão negada devolve falha mas deixa gravação ativa. | `AUD-REC-001` falha. |
| AUD-REC-002 | Alto | Confirmado, aberto | Gravação/recuperação | Destruir componente pode perder áudio; mensagem promete backup que não é criado nesse erro. | Análise de fluxo; E2E de media pendente. |
| AUD-UI-001 | Médio | Confirmado, aberto | Definições | `midnight-blue` e `forest-green` voltam silenciosamente a vermelho. | `AUD-UI-001` falha. |
| AUD-ROUTE-001 | Médio | Confirmado, aberto | Routing | `/new-recce` usa implicitamente `pec-1`. | Análise de rota e inicialização. |
| AUD-ACC-001 | Médio | Confirmado, aberto | Acessibilidade | 40 controlos sem label/nome acessível no checker estático. | `npm run audit:accessibility` falha. |
| AUD-DEP-001 | Alto, triagem pendente | Confirmado, aberto | Dependências | npm reporta 4 critical e 49 high, ainda sem análise de alcance. | `npm run audit:security` falha. |
| AUD-QA-001 | Médio | Confirmado, aberto | Cobertura | Backend tinha zero testes e não existe runner E2E. | Baseline Maven + skip de `test:e2e`. |
| AUD-PERF-001 | Baixo | Confirmado, aberto | Performance | Bundle inicial excede warning budget em 109,78 kB. | `npm run build` avisa. |

## Ordem de tratamento sugerida

1. AUD-SEC-001, AUD-SEC-002 e AUD-SEC-005: fechar acesso transversal e credenciais conhecidas antes de qualquer exposição.
2. AUD-SEC-003, AUD-SEC-006 e AUD-SEC-004: endurecer parsing e ciclo de vida/transporte de tokens.
3. AUD-OFF-002, AUD-OFF-001, AUD-OFF-003, AUD-REC-001 e AUD-REC-002: impedir perda ou exposição de trabalho de campo.
4. AUD-DEP-001: triar dependência por dependência, distinguindo runtime/dev e sem usar updates destrutivos automáticos.
5. AUD-UI-001, AUD-ROUTE-001, AUD-ACC-001, AUD-QA-001 e AUD-PERF-001.

## Critério de fecho

Um issue só deve ser fechado com comportamento corrigido, teste de regressão verde e evidência do nível aplicável (unitário, integração e, para jornadas de utilizador/media, E2E/dispositivo). Não remover, ignorar ou relaxar as asserções vermelhas para obter uma build verde.
