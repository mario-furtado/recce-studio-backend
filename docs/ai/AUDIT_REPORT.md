# Auditoria adversarial da aplicação

Data: 2026-10-09  
Estado: **vermelho — não recomendado para integração ou exposição a utilizadores não confiáveis**  
Âmbito original: frontend Angular e backend Spring Boot, agora consolidados neste repositório (`frontend/` e raiz, respetivamente).  
Nota de migração (2026-10-22): este relatório preserva evidência histórica de 2026-10-09. Alguns testes Java aqui mencionados não existem no checkout atual; consultar `QUALITY_BASELINE.md` e `ISSUES.md` para o estado verificável corrente.  
Método: análise estática dirigida por fluxos, execução de testes existentes, testes adversariais isolados e criação de regressões reproduzíveis  
Dados: apenas fixtures locais sintéticas, H2 em memória, `localStorage`/IndexedDB do Chrome Headless e ficheiros temporários. Não foram usados dados de produção.

## Resumo executivo

Foram auditados quatro lotes independentes. A baseline existente passou nos testes que já existiam, mas tinha cobertura muito limitada: 35 testes frontend e nenhum teste Java executável no backend. Nove testes de regressão adversarial foram adicionados sem alterar lógica de negócio. Todos compilam e todos falham no comportamento de produto que pretendem proteger: seis no frontend e três no backend.

Resultados classificados:

- Críticos confirmados: **0**.
- Altos confirmados: **10** defeitos e **1** risco de dependências por triar.
- Médios confirmados: **5**.
- Baixos confirmados: **1**.
- Principais bloqueadores: ausência de isolamento entre equipas, gravações de recce acessíveis sem autenticação, parser GPX vulnerável a entidades externas, estados offline irrecuperáveis/perda de áudio, credenciais de teste conhecidas por omissão e tokens sem expiração/revogação.

## Mapa de fluxos, estados e dependências críticas

| Fluxo | Estados relevantes | Dependências críticas | Invariantes esperadas |
| --- | --- | --- | --- |
| Login e sessão | anónimo, autenticado, sessão offline, token inválido | `localStorage`, `AuthService`, interceptor Angular, interceptor Spring | Um token só segue para a API confiável; logout/revogação terminam a sessão; dados são isolados por equipa. |
| Ralis e PECs | `DRAFT`, `COMPLETED`, criação, edição, eliminação | REST, JPA/H2/Postgres, armazenamento local/S3 | Apenas a equipa proprietária lê ou altera os seus recursos; concluídos respeitam imutabilidade. |
| Assets de PEC | sem asset, upload, disponível, eliminado | multipart, storage local/S3, endpoints de áudio/vídeo/GPS | Assets privados exigem autenticação/autorização; parsers rejeitam conteúdo ativo ou externo. |
| Reconhecimento | inicial, GPS à procura/ativo/degradado/erro, gravação, finalização | Geolocation, MediaRecorder, SpeechRecognition, parser de notas | Falha de permissão não deixa gravação ativa; saída inesperada não perde trabalho sem aviso. |
| Offline e sincronização | `draft`, `ready_to_sync`, `syncing`, `synced`, `conflict` | IndexedDB, áudio Blob, rede/API | Reinício recupera operações interrompidas; falta de áudio nunca é declarada sucesso; dados locais são isolados por conta. |
| Preferências e shell | online/offline, tema shell, cor de destaque, voz | `localStorage`, DOM, router | Todas as opções apresentadas produzem efeito persistente e rotas não conduzem a edição implícita. |
| PWA e qualidade transversal | build, cache, acessibilidade, dependências | Angular CLI, service worker, npm, Chrome Headless | Build reproduzível, controlos nomeados, advisories triados e testes E2E reais para jornadas críticas. |

## Lote 1 — identidade, configuração, routing e autorização

### Comportamentos esperados

- Rotas privadas recusam utilizadores sem sessão válida.
- O bearer token é enviado apenas à origem da API configurada.
- Cada utilizador/equipa só vê e altera os seus próprios ralis, PECs, perfil, carros e gravações.
- Conteúdo de recce permanece privado.
- Sessões têm expiração ou revogação efetiva; ambientes expostos não criam credenciais conhecidas.

### Evidência e exploração adversarial

- Os 4 testes existentes de app/login passaram em Chrome Headless.
- Foi criada uma prova de integração com dois utilizadores e duas equipas em H2: o utilizador B recebeu o rali criado pelo utilizador A.
- Foi simulada uma requisição sem `Authorization` a `/api/pecs/pec-audit/audio`: o interceptor autorizou-a.
- Foi simulada uma chamada Angular para `https://third-party.invalid/telemetry`: o interceptor anexou o bearer token local.
- Foram inspecionados os caminhos de bootstrap, validação e armazenamento de tokens. Não existe validade temporal nem endpoint de logout/revogação.

### Achados

#### AUD-SEC-001 — Alto — isolamento entre equipas inexistente

**Esperado:** o token determina a equipa e todas as queries/alterações são filtradas por essa equipa.  
**Observado:** o interceptor apenas confirma que o token pertence a algum utilizador ativo. `RallyController` usa uma query global e `RallyEntity` não contém proprietário/equipa. O mesmo padrão global aparece no perfil e carros.  
**Impacto:** qualquer conta válida pode ler e, pelos endpoints por ID, potencialmente editar ou eliminar dados de outras equipas.  
**Evidência:** `src/main/java/org/example/controller/RallyController.java:38`, `src/main/java/org/example/entity/RallyEntity.java:14`, `src/main/java/org/example/service/AuthService.java:65`. A regressão histórica `TenantIsolationAuditTest` criou A e B, gravou com A e demonstrou leitura por B; esse teste não está presente no checkout migrado.  
**Reprodução:** `mvn "-Dtest=TenantIsolationAuditTest" test` no backend.  
**Remediação delimitada:** introduzir ownership persistente e aplicar autorização por recurso em todos os serviços/controllers, nunca apenas na UI.

#### AUD-SEC-002 — Alto — áudio e vídeo de recce são públicos

**Esperado:** gravações exigem sessão válida e autorização sobre a PEC.  
**Observado:** áudio/vídeo são explicitamente tratados como media pública pelo interceptor e excluídos no `WebConfig`.  
**Impacto:** quem descobrir ou receber um ID pode descarregar material sensível sem token.  
**Evidência:** `src/main/java/org/example/controller/ApiAuthInterceptor.java:24`, `:41-52`; `WebConfig.java:19-25`.  
**Reprodução:** `mvn "-Dtest=ApiAuthInterceptorAuditTest" test`; resultado atual: esperado `false`, recebido `true`.  
**Remediação delimitada:** exigir autenticação e autorização por PEC; para media embebida, usar pedidos autenticados ou URLs assinadas, curtas e específicas.

#### AUD-SEC-003 — Alto — parser GPX permite entidades XML externas

**Esperado:** GPX com `DOCTYPE`/entidade externa é rejeitado antes de qualquer resolução.  
**Observado:** `DocumentBuilderFactory` é usado sem desativar DTD, entidades externas ou XInclude. Uma fixture aponta para um ficheiro temporário e o parse termina sem rejeição.  
**Impacto:** um upload autenticado pode possibilitar leitura local/SSRF ou consumo de recursos, dependendo do parser e ambiente.  
**Evidência:** `src/main/java/org/example/service/PecAssetService.java:261`.  
**Reprodução:** `mvn "-Dtest=PecAssetServiceXmlSecurityAuditTest" test`; resultado atual: nenhuma exceção.  
**Remediação delimitada:** configurar o parser em modo seguro, rejeitar `DOCTYPE`, limitar tamanho/complexidade e testar GPX válido e hostil.

#### AUD-SEC-004 — Médio — bearer token enviado para origens externas

**Esperado:** o interceptor só autentica URLs pertencentes à API configurada.  
**Observado:** qualquer `HttpClient` URL recebe o token, exceto três condições baseadas em texto.  
**Impacto:** uma integração externa presente ou futura pode exfiltrar a sessão. O repositório atual não demonstrou um URL externo controlável por utilizador, por isso a severidade não foi elevada.  
**Evidência:** `frontend/src/app/modules/core/interceptors/auth.interceptor.ts:4-20`; regressão `AUD-SEC-004` em `frontend/src/app/audit-regressions.spec.ts`.

#### AUD-SEC-005 — Alto, condicionado à exposição — conta conhecida ativa por omissão

**Esperado:** contas de teste são opt-in e a aplicação falha fechada fora de desenvolvimento explícito.  
**Observado:** `application.properties` ativa por omissão `test@reccestudio.local` com password `123456`; a proteção só reconhece os nomes `prod`/`production`. O servidor escuta em `0.0.0.0`.  
**Impacto:** uma instalação de staging, QA ou produção mal classificada fica acessível com credenciais públicas do código e, em conjunto com AUD-SEC-001, expõe o domínio inteiro.  
**Evidência:** `src/main/resources/application.properties:1-8`; `TestUserBootstrap.java:51-68,91-98`. Não foi tentado acesso a qualquer deployment externo.

#### AUD-SEC-006 — Alto — tokens sem expiração nem revogação de logout

**Esperado:** tokens expiram e podem ser revogados ao terminar sessão.  
**Observado:** a validade consiste apenas em `findByTokenAndActiveTrue`; não há timestamp/TTL. O logout frontend remove apenas o valor local. Um novo login roda o token, mas não resolve logout ou roubo enquanto não houver novo login.  
**Impacto:** um token copiado mantém acesso indefinidamente enquanto a conta estiver ativa.  
**Evidência:** `src/main/java/org/example/service/AuthService.java:60-71`, `AuthUserEntity.java`; ausência de endpoint de logout em `AuthController`.

## Lote 2 — domínio HTTP, CRUD, assets e persistência backend

### Comportamentos esperados

- CRUD preserva ownership e bloqueia alterações incompatíveis com `COMPLETED`.
- Falhas de storage/DB não são transformadas em sucesso parcial silencioso.
- Uploads têm tipo, tamanho e parser seguros.
- O build backend executa testes reais e não depende apenas da compilação do frontend embebido.

### Evidência e exploração adversarial

- `mvn test` passou antes das regressões, mas o Surefire não encontrou testes. A execução também fez `npm ci` e `ng build`; não executou testes Angular.
- A prova de integração AUD-SEC-001 percorreu HTTP real via MockMvc, interceptor, controller, JPA e H2.
- A prova AUD-SEC-003 percorreu o parser GPX real com um ficheiro temporário não produtivo.
- Foram examinados ralis, PECs, sync offline, perfil/equipa e file storage. As regras de imutabilidade de concluídos foram vistas no código, mas não tiveram teste comportamental dedicado neste lote.

### Riscos adicionais não fechados

- Limites de multipart são 500 MB em properties e 2 GB em YAML. Não foi executado teste de exaustão para evitar consumo destrutivo de recursos; resiliência a uploads grandes permanece por verificar.
- Postgres e S3 não foram exercitados; só H2 e storage local foram inicializados.
- Não foram validadas concorrência, transações interrompidas ou idempotência de `sessionId` sob pedidos simultâneos.

## Lote 3 — recce, voz, GPS, offline e sincronização

### Comportamentos esperados

- Negar GPS impede iniciar uma gravação que prometa traçado.
- Fechar/navegar durante a gravação preserva ou recupera notas e áudio, ou pede confirmação explícita.
- Um reinício durante `syncing` devolve a sessão a um estado repetível.
- Um Blob referenciado mas ausente provoca falha visível e preserva a sessão.
- Uma conta local não vê sessões da conta anterior no mesmo browser.

### Evidência e exploração adversarial

- Os 30 testes existentes do parser de notas passaram.
- Chrome Headless simulou `PERMISSION_DENIED` nas APIs `getCurrentPosition` e `watchPosition`.
- Foram injetadas sessões sintéticas `draft`, `ready_to_sync` e `syncing`, utilizadores diferentes e uma referência a Blob inexistente.
- Foram inspecionados o encerramento do componente, a fila de snapshots, a finalização, a sincronização e a eliminação local.

### Achados

#### AUD-OFF-001 — Alto — sessão fica presa em `syncing` depois de interrupção

**Esperado:** ao recarregar, uma operação incompleta volta a `ready_to_sync` ou oferece retry.  
**Observado:** o estado `syncing` é persistido antes do HTTP; `loadSessions()` não o recupera. `syncSession()` aceita apenas `ready_to_sync` e `continueSession()` apenas `draft`.  
**Impacto:** trabalho de campo gravado fica sem caminho de sincronização ou continuação; só resta eliminar.  
**Evidência:** `offline-recces.component.ts:95,134,340-414`; `offline-recce-store.service.ts:177-188`. Regressão `AUD-OFF-001` recebe `syncing`, não `ready_to_sync`.

#### AUD-OFF-002 — Alto — referência de áudio ausente é tratada como upload bem-sucedido

**Esperado:** `audioBlobId` sem Blob é erro recuperável e impede apagar a sessão.  
**Observado:** `uploadSessionAudio()` devolve `true` quando `getAudioBlob()` devolve `null`; o chamador elimina a sessão depois.  
**Impacto:** perda permanente de áudio e falsa mensagem de sincronização concluída.  
**Evidência:** `offline-recces.component.ts:422-424` e caminho de eliminação em `:350-386`; regressão `AUD-OFF-002` esperava `false`, recebeu `true`.

#### AUD-OFF-003 — Alto — sessões IndexedDB não são isoladas por conta

**Esperado:** a conta atual só lista as suas sessões, com política explícita de recuperação para sessões anónimas/offline.  
**Observado:** `listSessions()` devolve tudo e o componente apresenta tudo, apesar de cada registo ter `userEmail`.  
**Impacto:** num browser/dispositivo partilhado, a conta seguinte pode ver metadados, continuar, sincronizar ou apagar trabalho da anterior.  
**Evidência:** `offline-recce-store.service.ts:149-157`, `offline-recces.component.ts:95`; regressão `AUD-OFF-003` recebeu `own-session` e `foreign-session`.

#### AUD-REC-001 — Alto — negação de GPS deixa a gravação internamente ativa

**Esperado:** `requestGpsAndStart()` devolver `false` repõe integralmente o estado.  
**Observado:** `initializeRecording()` define `isRecording=true` antes da permissão; o ramo `PERMISSION_DENIED` devolve `false` sem `stopRecce()`. Uma nota ainda é aceite por `registerClick()`.  
**Impacto:** o utilizador pode produzir um reconhecimento inconsistente sem GPS depois de a UI ter recebido falha.  
**Evidência:** `tracking.service.ts:86,127-140,254`; regressão `AUD-REC-001` recebeu um marcador em vez de `null`.

#### AUD-REC-002 — Alto — sair durante a gravação pode perder áudio e a recuperação anunciada não existe

**Esperado:** `ngOnDestroy` finaliza/persiste o áudio ou impede saída; quando o armazenamento falha, o backup anunciado é realmente produzido.  
**Observado:** `ngOnDestroy()` chama `stopAudioCapture()` sem aguardar nem passar o Blob a `completeSession()`. O erro de finalização afirma que um JSON foi descarregado, mas esse ramo não faz download.  
**Impacto:** refresh, navegação ou destruição do componente pode perder áudio; em erro de IndexedDB, o utilizador recebe uma garantia falsa.  
**Evidência:** `recce-mode.component.ts:650-662,847-854`. Confirmado por análise de controlo de fluxo; não foi automatizado porque MediaRecorder e navegação real requerem harness de browser ainda inexistente.

## Lote 4 — UI, acessibilidade, PWA, resiliência e dependências

### Comportamentos esperados

- Opções visíveis produzem alterações verificáveis e persistentes.
- Não existem rotas que editem um recurso implícito.
- Controlos têm nome acessível.
- Build respeita budgets e advisories críticos/altos são triados.
- Jornadas críticas têm E2E aplicável.

### Achados

#### AUD-UI-001 — Médio — duas cores de destaque são ações sem efeito

**Esperado:** `racing-red`, `midnight-blue` e `forest-green`, expostos pelas definições, persistem e aplicam-se.  
**Observado:** `isAccentTheme()` só aceita `racing-red`; as outras escolhas voltam silenciosamente ao vermelho e ainda mostram toast de sucesso.  
**Evidência:** `shared-properties.ts:62-72,189-191`; regressão `AUD-UI-001` recebeu `racing-red` ao selecionar `midnight-blue`.

#### AUD-ROUTE-001 — Médio — `/new-recce` abre edição implícita de `pec-1`

**Esperado:** a ação “novo reconhecimento” cria/seleciona explicitamente o alvo.  
**Observado:** a rota aponta para `PecsEditorComponent` sem `id`; o componente usa fallback literal `pec-1` e tenta carregar/sincronizar esse recurso.  
**Impacto:** caminho sem saída quando `pec-1` não existe ou edição/sync redundante do recurso errado quando existe.  
**Evidência:** `app.routes.ts:32`, `pecs-editor.component.ts:86-95`, link ativo em `sidebar.component.html:60`.

#### AUD-ACC-001 — Médio — 40 controlos sem associação de label/nome acessível

**Observado:** `npm run audit:accessibility` falhou com 40 ocorrências estáticas em login, offline recces, detalhe/editor/lista de PECs, detalhe de rali e perfil da equipa.  
**Impacto:** navegação por leitor de ecrã e identificação por voz/automação ficam incompletas.  
**Limite da evidência:** esta é análise estática; não foi executado leitor de ecrã nem auditoria WCAG em browser real.

#### AUD-DEP-001 — Alto, triagem pendente — 53 advisories high/critical

**Observado:** `npm run audit:security` falhou e reportou 4 critical, 49 high, 24 moderate e 4 low. O wrapper confirmou exit code falhante mesmo com o comportamento permissivo do npm usado no ambiente.  
**Impacto:** superfície de supply chain não aceitável sem determinar dependências de runtime, alcance e versões corrigidas.  
**Limite da evidência:** a existência/severidade dos advisories foi confirmada; explorabilidade na aplicação não foi demonstrada. Não foi executado `npm audit fix`.

#### AUD-QA-001 — Médio — cobertura backend ausente e E2E não configurado

**Observado:** antes desta auditoria, `mvn test` executava zero testes Java. `npm run test:e2e` devolve skip condicional porque não existe script/target/config Playwright ou Cypress. O build Maven compila o frontend, mas não executa os testes Angular.  
**Impacto:** alterações de autorização, persistência e jornadas completas podiam integrar sem deteção.

#### AUD-PERF-001 — Baixo — bundle inicial excede budget de warning

**Observado:** `ng build` produziu 609,78 kB e excedeu o budget de 500 kB em 109,78 kB. O build passa porque o limite de erro é superior.  
**Impacto:** custo inicial de rede/parse acima do objetivo configurado; não foi medido em hardware real.

## Testes e comandos executados

| Comando | Resultado observado | Interpretação |
| --- | --- | --- |
| `ng test ... app.component.spec.ts ... login.component.spec.ts` | 4/4 passaram | Baseline de shell/login. |
| `ng test ... recce-note-parser.service.spec.ts` | 30/30 passaram | Parser de notas existente. |
| `npm run test:unit` antes das regressões | 35/35 passaram | Toda a suite frontend existente naquele momento. |
| `npm run test:integration` | 5/5 passaram | Specs de componentes existentes; não é integração HTTP real. |
| `npm run test:e2e` | skip condicional | Nenhum runner/config E2E presente; não conta como área testada. |
| `npm run build` | passou com warning | Bundle inicial 609,78 kB, +109,78 kB sobre warning budget. |
| `mvn test` antes das regressões | passou, 0 testes Java | Build backend/frontend, sem cobertura comportamental backend. |
| `npm run test:unit -- --include src/app/audit-regressions.spec.ts` | 6 executados, 6 falharam | Falhas de produto confirmadas; suite compila e chega às asserções. |
| `mvn "-Dtest=ApiAuthInterceptorAuditTest,PecAssetServiceXmlSecurityAuditTest,TenantIsolationAuditTest" test` | 3 executados, 3 falharam | Falhas de produto confirmadas via unit, parser e integração HTTP/JPA. |
| `npm run lint` | passou | Sem focused/skipped tests ou padrões bloqueados pelo checker atual. |
| `npm run typecheck` | passou | Aplicação e specs TypeScript compilam em strict mode configurado. |
| `npm run audit:resilience` | passou | Guardas estáticas configuradas foram satisfeitas; não substitui fault injection runtime. |
| `npm run audit:security` | falhou | 4 critical, 49 high, 24 moderate, 4 low. |
| `npm run audit:accessibility` | falhou | 40 controlos sem label/nome detetados. |

Os nove testes vermelhos são intencionais e devem bloquear integração até a implementação cumprir as invariantes. Não foram ignorados, marcados como skipped nem enfraquecidos.

## Ficheiros de regressão adicionados

- Frontend: `frontend/src/app/audit-regressions.spec.ts` — 6 casos independentes, presentes no checkout atual.
- Backend histórico: `src/test/java/org/example/controller/ApiAuthInterceptorAuditTest.java` — ausente no checkout atual.
- Backend histórico: `src/test/java/org/example/security/TenantIsolationAuditTest.java` — ausente no checkout atual.
- Backend histórico: `src/test/java/org/example/service/PecAssetServiceXmlSecurityAuditTest.java` — ausente no checkout atual.

## Áreas ainda não verificadas

- Nenhuma jornada E2E completa em browser contra frontend e backend reais.
- GPS, microfone, reconhecimento de voz e MediaRecorder em Android/iOS ou hardware de campo.
- Service worker instalado, atualização de versão, cache offline e recuperação após quota esgotada.
- PostgreSQL, S3, URLs assinadas, falhas/retries de rede e permissões do bucket.
- Concorrência, pedidos duplicados, transações parciais e idempotência sob carga.
- Limites de 500 MB/2 GB, descompressão/parse adversarial e exaustão de memória/CPU.
- CORS em deployment, TLS, headers de segurança, rate limiting e brute force.
- Leitor de ecrã, teclado, contraste e zoom em browser real.
- Dados/configuração de produção; deliberadamente não acedidos.

## Próximo lote recomendado

**Lote 5 — fronteira de autorização e privacidade, após remediação.** Deve começar por definir formalmente ownership (utilizador/equipa) para ralis, PECs, perfil, carros, syncs e assets. Depois, expandir a matriz negativa para list/get/create/update/delete/upload/download com utilizadores A/B, recurso inexistente, token expirado/revogado e acesso anónimo. O lote só deve fechar quando os três testes backend atuais estiverem verdes e existirem provas equivalentes para todas as entidades, incluindo storage local/S3. Em seguida, o lote 6 deve validar gravação e recuperação offline em dispositivos reais.
