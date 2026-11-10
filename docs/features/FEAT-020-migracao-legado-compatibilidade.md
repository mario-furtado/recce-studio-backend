# FEAT-020 — Migração do legado e compatibilidade

- **Estado:** IN_REVIEW — implementação, ensaio isolado e percurso de migração no browser concluídos.
- **Âmbito:** UAC-P03 apenas; manifesto explícito e ensaios isolados aprovados em 2026-11-02.
- **Perfil:** STANDARD com testes rigorosos de migração, persistência, restauro, interrupção e autorização; sem cutover real nem DEEP/release global.

## Objetivo e decisões

Converter contextos legados inequivocamente aprovados para o modelo P02 sem alterar IDs, relações, notas, media, recibos de sincronização ou configurações pessoais. P02/FEAT-019 existente é dependência. D11 aprovada: recursos próprios por crew. D02/processo aprovado pelo utilizador: manifesto explícito equipa→proprietário, bloquear dono/membros ambíguos, ensaios apenas isolados e nenhuma migração na beta nesta tarefa.

Esta autorização não fornece donos reais para dados reais. Nenhum proprietário será escolhido pelo primeiro login, nomes ou ordem de IDs. Contextos com várias contas antigas continuam bloqueados para conversão até política específica: não manter escritores ocultos, não rebaixar sem decisão e não antecipar READ da P04. A primeira implementação aceita somente equipas com uma conta ligada e owner explicitamente igual a essa conta, ativa, no manifesto aprovado.

## Requisitos

1. Ferramenta operacional offline, sem endpoint público, execução automática no arranque ou defaults de base alvo. Plano/inventário antes de mutações; apoio inicial H2 local e media local, recusando alvos/schemas não suportados.
2. Manifesto versionado, aprovação operacional identificada e digest explícito; owner por ID imutável, digest do contexto e membros verificados. Sem inventar mapeamentos.
3. Backup consistente de base+media e restauro em diretório novo/isolado com checksums antes de apply. Backups sensíveis não aparecem em logs. Caminhos de media originais preservados; não afirmar suporte a relocalização/S3/PostgreSQL.
4. Conversão por contexto atómica, journal persistido, retry e retoma sem recriar recursos nem sobrescrever dados novos. Interrupção entre contextos preserva checkpoints; divergências bloqueiam.
5. Autoridade nova também na API antiga; flags de UI ou campos legados não restauram permissões. Marcador persistido e campo legado de autorização retirado ao cutover; compat adapter resolve por ID da conta. IDs/links antigos continuam utilizáveis pelo proprietário.
6. Recusar rollback para binário sem capacidade de autorização compatível; rollback compatível não restaura backups antigos, vínculos/grants ou credenciais. Revogação de sessão/inatividade mantém negação; dados criados depois da migração conservados.
7. Não migrar offline/browser, criar READ/convites, transferir donos ou alterar retenção; não executar sobre a beta. Auto-backfill antigo não pode reatribuir órfãos após cutover.

## Critérios de aceitação

1. **AC1 / P03-AC1:** Given várias contas/equipas/recibos/media de ensaio, When aplica manifesto explícito e repete/interrompe/retoma, Then preserva IDs/relações/contagens/conteúdo e não duplica crews/recibos.
2. **AC2 / P03-AC2:** Given owner ausente/inativo/errado, membros adicionais, órfãos, ficheiro ausente, schema inválido ou divergência do inventário, When planeia/aplica, Then recusa esse cutover sem inferir dono ou alterar dados/acesso legado desse contexto.
3. **AC3 / P03-AC3:** Given contexto convertido com sessão revogada/inatividade e dados novos, When usa modo compatível ou tenta rollback antigo, Then não recupera acessos nem perde dados; binário permissivo e reatribuição pelo campo antigo são recusados.
4. **AC4:** Given backup de base/media e destino isolado novo, When ensaia restauro e verifica prova, Then registos e bytes reconciliam; backup/prova adulterados ou destino existente são recusados antes de apply.
5. **AC5:** Given proprietário e terceiro, When usam URLs antigas e header/body de equipa/crew, Then apenas proprietário acede ao contexto convertido; preferências pessoais e outros contextos continuam isolados.
6. **AC6:** Given arranque/flag off e ausência de comando operador aprovado, When a aplicação funciona, Then não migra nem escolhe donos; adaptador e journal continuam a negar acessos indevidos em contexto convertido.

## Componentes e solução

AuthUser/serviço de autenticação, ApiAuthInterceptor/TenantContext, CrewService/repos, OwnershipMigration antigo, journal de conversão, ferramenta JDBC offline, inventário/checksums/backup/restauro e launcher com capacidade de rollback explícita. Reutilizar teamProfileId como crewId para preservar referências, sem copiar projetos/media ou alterar modelos pessoais.

Nos contextos convertidos, o journal e a tripulação substituem AuthUser.teamProfileId como fonte de autoridade. A chave estrangeira para a lista de contextos legados impede qualquer conta, incluindo uma nova, de voltar a ligar-se pelo campo antigo. A ferramenta de rollback verifica a capacidade declarada do artefacto; não autentica o artefacto nem protege contra alterações privilegiadas ao schema ou execução direta de um binário antigo.

## Casos limite e riscos

Schema sem colunas, equipa sem membros/com vários membros, ID/email duplicado, owner inválido, source alterada após plano, media fora da raiz/symlink/ausente, caminhos maliciosos, backup parcial/adulterado, destino de restauro existente, interrupção/concorrência, reenvio de sync antigo, conta sem equipa, flag off e binário antigo. Migração sistémica real exige plano/backup/manifesto por alvo e ensaio representativo; H2 isolado não aprova produção diferente.

## Ficheiros alterados

- Operação offline: `LegacyCrewMigrationTool.java`, `MigrationSnapshot.java`, `tools/run-legacy-crew-migration.mjs`, `pom.xml`.
- Compatibilidade: journal e repositório `LegacyCrewMigration*`, `LegacyMigrationAccess`, `AuthUser`, `AuthService`, `ApiAuthInterceptor`, `PersonalAccountController`, `CrewService`, `OwnershipMigration` e `TestUserBootstrap`.
- QA: `LegacyCrewMigrationToolTest`, `LegacyCrewMigrationIntegrationTest`, adaptação dos testes de tokens, `E2eServer` e `frontend/e2e/legacy-migration.spec.ts`.
- Operação e rastreio: [guia de migração](../legacy-crew-migration.md), roadmap e baseline. Alterações preexistentes de FEAT-018/019 preservadas.

## Validação e revisão

QA e revisão focaram a fronteira de autorização, a atomicidade por contexto e a possibilidade de retoma. A revisão acrescentou validação estrita dos bytes aprovados do manifesto, cópia do SQL verificado para o destino isolado antes do restauro e verificação do conteúdo efetivamente restaurado antes de aplicar.

| Critério | Evidência executada | Resultado |
| --- | --- | --- |
| AC1 | Apply, falha transacional, retoma e repetição preservam IDs, recibos e alterações posteriores | PASS |
| AC2 | Ambiguidade, manifesto inválido, schema/media inválidos e divergências bloqueiam sem conversão | PASS |
| AC3 | Integração verifica revogação, inatividade, negação de reatribuição legada e recusa de artefacto incompatível | PASS |
| AC4 | Restauro de H2 e media isolados; backup/prova errados e destino existente recusados | PASS |
| AC5 | HTTP: URLs antigas, terceiros negados e preferências pessoais preservadas | PASS |
| AC6 | Sem conversão automática; adaptador com flag desligada, backfill e bootstrap protegidos após cutover | PASS |

- `mvn.cmd compiler:compile compiler:testCompile '-Dtest=LegacyCrewMigrationToolTest,LegacyCrewMigrationIntegrationTest' surefire:test`: 20/20 na versão revista. Log: `.factory-results/FEAT-020-reviewed-backend.log`.
- `node tools/run-quality-gate.mjs ticket AUTO` (STANDARD, backend direcionado): 125/134; 2 falhas e 7 erros nas três assinaturas conhecidas de AUD-SEC-005. O relatório bruto FAIL está em `.factory-results/FEAT-020-ticket.json`.
- `mvn.cmd resources:resources jar:jar spring-boot:repackage`: PASS, JAR com `Recce-Authorization: crew-compat-v1` e `Start-Class: org.example.Main`.
- Ensaio isolado `runtime-smoke.ps1`: PASS. Launcher aplicou o manifesto sintético sobre um clone, rejeitou o JAR sem marcador e aceitou o JAR empacotado. Após reinício em Java 8 com a flag de tripulações desligada, o token revogado recebeu 401 e o proprietário voltou a abrir o rali criado após a conversão e os quatro bytes do áudio antigo. Evidência: `.factory-results/FEAT-020-runtime-smoke.json`.
- `npm --prefix frontend run quality:standard`: lint, typecheck, 23 testes direcionados, 203 de componentes e 3 verificações do runner passaram. A primeira passagem Playwright parou no limite global (17 aprovados, 1 falha por nome incorreto no seletor novo, 16 por executar); o seletor foi corrigido sem alterar a aplicação. Log original: `.factory-results/FEAT-020-frontend-standard.log`.
- Configuração Factory, validação do formato da baseline e `git diff --check`: PASS.
- `npm --prefix frontend run build`: PASS. Na segunda passagem alargada Playwright passaram 21 testes, dois falharam e 11 não correram antes do limite global. O percurso novo abriu os links antigos mas faltava o passo de abrir o separador Studio; corrigido no teste. Em `recce-map.spec.ts`, o vídeo ficou em `readyState=0`; a causa não foi confirmada. Evidência: `.factory-results/FEAT-020-e2e-reviewed.log` e `.factory-results/FEAT-020-frontend-build.log`.
- `npm --prefix frontend run e2e:ci -- legacy-migration.spec.ts`: 1/1. Login pela conta antiga, links e nota no Studio, bytes do áudio, negação a terceiro, logout/revogação e reentrada. Captura inspecionada: `.factory-results/FEAT-020-legacy-studio.png`. Log: `.factory-results/FEAT-020-e2e-final-focused.log`.
- Playwright complementar (mapa e os 11 cenários em falta): 10/12. No conjunto das execuções finais: 32/34 cenários distintos passaram; mapa e redesign do Studio falharam ao reproduzir as fixtures WebM inválidas, confirmadas por comparação dos bytes enviados e recebidos nos dois traces. Nenhuma asserção foi alterada nesses testes. Log: `.factory-results/FEAT-020-e2e-complement.log`.

## Gates e limitações

- **TICKET_GATE:** PASS (APPROVED) — seis critérios verificados no âmbito da P03. O relatório bruto do runner continua FAIL por AUD-SEC-005. Os testes de reprodução do mapa e do Studio ficaram por validar: ambos os traces mostram que a fixture chegou sem pista VP8 ou blocos de vídeo e que a API devolveu os mesmos 110 bytes com HTTP 200.
- **RELEASE_GATE:** BLOCKED — AUD-SEC-005 reproduzido no check obrigatório e dois percursos de reprodução sem validação. Não foi executada uma release global.
- Sem manifesto de dados reais aprovado, sem migração beta/produção ou SMTP real. PostgreSQL/S3 e restauro real fora de âmbito aprovado.

## Histórico

- 2026-11-02: PLANNED — ID020 exclusivo e documento antes de código; D02 e política de membros identificadas.
- 2026-11-02: utilizador aprovou manifesto explícito, bloqueio de ambiguidades e ensaios isolados, sem migração beta ou READ.
- 2026-11-03: implementação, revisão e ensaios isolados com H2/media, JAR em Java 8 e browser; nenhuma alteração na beta.
