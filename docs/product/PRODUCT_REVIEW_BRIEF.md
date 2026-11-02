# Recce Studio — brief de revisão de produto e UX (AS-IS)

**30 de outubro de 2026 · commit eb44ad4 · leitura do código, sem nova execução.** Este documento descreve o produto atual para avaliação externa. Não é uma proposta de redesign nem um backlog. A [especificação principal](PRODUCT_SPECIFICATION_AS_IS.md) contém passos, dados, limites, permissões e ficheiros de evidência para cada ID abaixo. O presente brief é autónomo para compreender o funcionamento; as referências permitem aprofundar.

## O produto e os seus utilizadores

O Recce Studio permite a uma equipa de rally preparar reconhecimento e cadernos de notas: organizar ralis e especiais (PECs), captar marcadores temporais, GPS e áudio, converter ditado em linguagem compacta, rever notas com vídeo/áudio/mapa e exportar Excel ou um RecceBook em PDF. Piloto e copiloto são destinatários e campos do perfil, sem papéis de autorização diferenciados implementados. Não há resultados desportivos, inscrições em provas ou navegação curva a curva identificados.

A beta usa contas previamente fornecidas; não existe registo público ativo nem gestão visível de membros/convites/password. Conta online pertence a uma equipa; entrada offline sem conta é um contexto local diferente. Não se deve assumir que captura sem conta será automaticamente transferida após login.

**Âmbitos essenciais:** perfil, carros, ralis, PECs, notas, media/GPS e capa guardada por PEC são partilhados com a equipa. Regras do dicionário, modelo visual/página e capa principal são pessoais no servidor. Temas/modos e reconhecimento por sincronizar vivem no navegador. Não há hierarquia de administrador/editor/leitor encontrada.

## Navegação e módulos

Login abre Ralis & PECs ou fila local própria pendente; entrada offline abre Reconhecimentos Offline. Menu: Ralis & PECs, Reconhecimentos Offline, Notas, Perfil da Equipa, Configurações e Tutorial. Rali abre lista de PECs; PEC tem Visão geral, Reconhecimento e Studio. Notas tem Dicionário, Apresentação e Caderno e exportação. Studio reúne ficheiros, sincronização, media, mapa, notas e PDF. `/new-recce` é uma escolha de início acessível por links, sem item ativo no menu.

Em offline, acesso remoto de ralis/PECs/Notas é bloqueado; captura sem PEC, fila, configurações e tutorial continuam nas rotas permitidas. A instalação PWA/cache de shell não equivale a copiar toda a aplicação/dados/mapas para offline.

## Catálogo completo e conciso

**88 capacidades em 12 módulos.** C = confirmado no código; P = parcialmente implementado. Nenhuma é marcada como validada em execução nova neste levantamento. Cada linha resume uma ficha detalhada no documento principal; funções de baixo nível não ligadas à interface não são apresentadas como funcionalidades utilizáveis.

### Acesso e navegação (10)

| ID | Funcionalidade e valor | Estado |
| --- | --- | --- |
| FUNC-001 | **Entrar online** — Aceder ao trabalho da equipa com uma conta beta existente. | C |
| FUNC-002 | **Entrar em modo offline** — Capturar sem autenticação de servidor. | C |
| FUNC-003 | **Alternar online e offline** — Controlar quando são permitidas operações remotas. | C |
| FUNC-004 | **Terminar sessão** — Fechar o acesso da conta no dispositivo. | C |
| FUNC-005 | **Navegar e adaptar o menu** — Aceder aos módulos em desktop/móvel. | C |
| FUNC-006 | **Proteger rotas e saída de trabalho em curso** — Evitar acesso fora do modo e perdas ao navegar. | C |
| FUNC-007 | **Mensagens e confirmações** — Comunicar sucesso, erros e decisões destrutivas. | C |
| FUNC-008 | **Instalar a aplicação** — Abrir em formato de aplicação no dispositivo. | C |
| FUNC-009 | **Escolher como iniciar um reconhecimento** — Separar captura numa PEC de captura sem destino. | C |
| FUNC-010 | **Disponibilidade do registo e gestão de contas** — Distinguir beta com contas fornecidas de autosserviço. | P |

### Equipa e garagem (10)

| ID | Funcionalidade e valor | Estado |
| --- | --- | --- |
| FUNC-011 | **Consultar perfil da equipa** — Reconhecer identidade, tripulação e viatura ativa. | C |
| FUNC-012 | **Editar identidade e unidades** — Manter dados da equipa e preferência de medida. | C |
| FUNC-013 | **Alterar imagem da equipa** — Identificar visualmente a equipa. | C |
| FUNC-014 | **Consultar garagem e carro ativo** — Ver viaturas disponíveis e a seleção atual. | C |
| FUNC-015 | **Criar e editar viaturas** — Manter nome, classe e notas de cada carro. | C |
| FUNC-016 | **Selecionar viatura ativa** — Definir o carro de referência da equipa. | C |
| FUNC-017 | **Adicionar ou substituir foto do carro** — Distinguir visualmente as viaturas. | C |
| FUNC-018 | **Eliminar viatura** — Remover um carro da garagem. | C |
| FUNC-019 | **Consultar estatísticas de reconhecimento** — Resumir volume de trabalho e eventos ativos. | C |
| FUNC-020 | **Consultar atividade recente** — Retomar PECs efetivamente atualizadas. | C |

### Ralis (7)

| ID | Funcionalidade e valor | Estado |
| --- | --- | --- |
| FUNC-021 | **Listar, pesquisar e filtrar ralis** — Encontrar o evento de trabalho. | C |
| FUNC-022 | **Criar rali** — Dar contexto a PECs e reconhecimento. | C |
| FUNC-023 | **Editar rali** — Corrigir dados de um evento existente. | C |
| FUNC-024 | **Definir logótipo do rali** — Reconhecer visualmente o evento. | C |
| FUNC-025 | **Consultar resumo do rali** — Ver contexto, métricas e acesso às especiais. | C |
| FUNC-026 | **Terminar e reabrir rali** — Proteger trabalho concluído e permitir correções posteriores. | C |
| FUNC-027 | **Eliminar rali e alcance da eliminação** — Remover evento não pretendido. | P |

### PECs (6)

| ID | Funcionalidade e valor | Estado |
| --- | --- | --- |
| FUNC-028 | **Listar e procurar PECs do rali** — Encontrar uma especial dentro do evento. | C |
| FUNC-029 | **Criar PEC num rali** — Definir uma nova especial e destino de notas. | C |
| FUNC-030 | **Editar identificação da PEC** — Corrigir nome, número e distância. | C |
| FUNC-031 | **Abrir PEC e escolher modo** — Reunir resumo, captura e revisão no mesmo destino. | C |
| FUNC-032 | **Concluir e reabrir PEC** — Alternar entre edição e consulta protegida. | C |
| FUNC-033 | **Eliminar PEC e alcance da eliminação** — Retirar uma especial da lista. | P |

### Reconhecimento (8)

| ID | Funcionalidade e valor | Estado |
| --- | --- | --- |
| FUNC-034 | **Iniciar captura com GPS** — Começar um reconhecimento temporalmente referenciado. | C |
| FUNC-035 | **Acompanhar GPS, tempo e traçado** — Ver qualidade do registo e conservar percurso percorrido. | C |
| FUNC-036 | **Gravar áudio do reconhecimento** — Conservar contexto sonoro da passagem. | C |
| FUNC-037 | **Marcar instantes de notas** — Relacionar um ponto da estrada com a revisão posterior. | C |
| FUNC-038 | **Ditar nota por pressão** — Capturar uma nota de voz delimitada pelo gesto. | C |
| FUNC-039 | **Ditar em escuta contínua** — Captar frases mantendo o reconhecimento de fala ativo. | C |
| FUNC-040 | **Finalizar e guardar captura** — Fechar a passagem sem perder trabalho ainda local. | C |
| FUNC-041 | **Retomar contexto e proteger gravação** — Continuar tempo/marcadores e impedir saída prematura. | C |

### Offline e sincronização (7)

| ID | Funcionalidade e valor | Estado |
| --- | --- | --- |
| FUNC-042 | **Consultar fila local** — Saber o que ainda existe apenas neste navegador. | C |
| FUNC-043 | **Continuar rascunho local** — Acrescentar reconhecimento à sessão inacabada. | C |
| FUNC-044 | **Sincronizar para PEC existente** — Transferir notas, GPS e áudio do dispositivo. | C |
| FUNC-045 | **Criar PEC e sincronizar** — Dar destino a captura sem especial previamente criada. | C |
| FUNC-046 | **Recuperar interrupções e repetir envio** — Desbloquear sessões deixadas em sincronização. | C |
| FUNC-047 | **Eliminar sessão do dispositivo** — Libertar trabalho local que já não se pretende conservar. | C |
| FUNC-048 | **Isolar sessões locais e transferência de identidade** — Evitar acesso de outra conta a reconhecimento local. | P |

### Studio (14)

| ID | Funcionalidade e valor | Estado |
| --- | --- | --- |
| FUNC-049 | **Reproduzir e rever media** — Relacionar instante, nota ativa e posição na revisão. | C |
| FUNC-050 | **Adicionar ou substituir vídeo** — Usar gravação externa como contexto visual. | C |
| FUNC-051 | **Adicionar ou substituir áudio** — Ouvir captura recebida ou ficheiro externo. | C |
| FUNC-052 | **Importar ou substituir GPS** — Mostrar trajeto de ficheiro externo. | C |
| FUNC-053 | **Eliminar vídeo ou áudio** — Retirar media incorreto da PEC. | C |
| FUNC-054 | **Explorar mapa de satélite e notas** — Ver trajeto percorrido e localizar contexto das notas. | C |
| FUNC-055 | **Alinhar vídeo e reconhecimento** — Corrigir diferença de início entre gravações. | C |
| FUNC-056 | **Inserir nota manual** — Acrescentar nota específica à PEC. | C |
| FUNC-057 | **Editar conteúdo e observações da nota** — Corrigir uma ocorrência sem mudar regras gerais. | C |
| FUNC-058 | **Editar instante e mover notas seguintes** — Ajustar alinhamento temporal de uma ou várias notas. | C |
| FUNC-059 | **Personalizar apresentação de uma nota** — Destacar uma situação particular da especial. | C |
| FUNC-060 | **Eliminar nota** — Remover nota indevida do caderno. | C |
| FUNC-061 | **Importar notas de folha de cálculo** — Preparar notas fora da aplicação e carregar na PEC. | P |
| FUNC-062 | **Exportar notas ou modelo Excel** — Rever/preencher caderno numa folha editável. | C |

### Dicionário e conversão (7)

| ID | Funcionalidade e valor | Estado |
| --- | --- | --- |
| FUNC-063 | **Consultar e pesquisar dicionário** — Perceber frases, significados e símbolos disponíveis. | C |
| FUNC-064 | **Criar ou editar regra pessoal** — Converter frase da tripulação no símbolo preferido. | C |
| FUNC-065 | **Ativar ou desativar regras** — Controlar conversão sem eliminar definição. | C |
| FUNC-066 | **Eliminar regra ou repor base** — Remover personalização da linguagem. | C |
| FUNC-067 | **Editar descrição do sistema base** — Registar convenção da equipa em texto. | C |
| FUNC-068 | **Converter transcrição em nota compacta** — Reduzir frases ditadas para linguagem de rally. | C |
| FUNC-069 | **Abrir apresentação a partir do símbolo** — Ligar significado a estilo sem duplicar definição. | C |

### Apresentação pessoal (4)

| ID | Funcionalidade e valor | Estado |
| --- | --- | --- |
| FUNC-070 | **Escolher símbolos do dicionário** — Garantir fonte única para identidade dos elementos. | C |
| FUNC-071 | **Configurar composição e estilo** — Posicionar curva, modificadores e avisos. | C |
| FUNC-072 | **Pré-visualizar sequência de notas** — Conferir composição antes da exportação. | C |
| FUNC-073 | **Guardar, carregar e repor modelo** — Conservar apresentação e página pessoal. | C |

### Caderno e capas (7)

| ID | Funcionalidade e valor | Estado |
| --- | --- | --- |
| FUNC-074 | **Configurar página do caderno** — Adaptar caderno à leitura em prova. | C |
| FUNC-075 | **Paginar e consultar o caderno** — Ver a distribuição efetiva das notas antes de imprimir. | C |
| FUNC-076 | **Editar capa principal pessoal** — Definir modelo reutilizável da identidade do caderno. | C |
| FUNC-077 | **Editar capa específica da PEC** — Personalizar caderno de uma especial sem alterar modelo principal. | C |
| FUNC-078 | **Imprimir ou guardar PDF** — Produzir caderno utilizável fora da aplicação. | C |
| FUNC-079 | **Bloquear exportação inválida e recuperar falhas** — Evitar cadernos cortados e gravação cega de capas. | C |
| FUNC-080 | **Preservar marca e contracapa** — Manter identificação do produto em todas as exportações. | C |

### Configurações locais (3)

| ID | Funcionalidade e valor | Estado |
| --- | --- | --- |
| FUNC-081 | **Escolher tema e cor de destaque** — Adaptar apresentação da aplicação ao contexto. | C |
| FUNC-082 | **Escolher modo de captura de voz** — Definir gesto e comportamento da próxima captura. | C |
| FUNC-083 | **Preferência de idioma anunciada** — Identificar limite atual da personalização. | P |

### Aprendizagem guiada (5)

| ID | Funcionalidade e valor | Estado |
| --- | --- | --- |
| FUNC-084 | **Escolher percurso de tutorial** — Encontrar demonstração do módulo pretendido. | C |
| FUNC-085 | **Aprender dicionário, apresentação e caderno** — Explicar sistema completo de notas com exemplos. | C |
| FUNC-086 | **Aprender criação de rali e PEC** — Dar contexto aos formulários e dependências. | C |
| FUNC-087 | **Aprender reconhecimento e Studio** — Explicar captura, alinhamento, mapa e exportação. | C |
| FUNC-088 | **Aprender equipa e reconhecimento offline** — Explicar âmbito, garagem e recuperação local. | C |

## Percursos principais, do início ao fim

1. **Preparar equipa e notas:** login → Perfil/Editar → identidade/unidades → Guardar → garagem/criar/selecionar carro → Notas/criar regra → Configurar apresentação/estilo → Guardar modelo → página do caderno → capa principal/Guardar capa. Perfil, garagem, página e capa não são uma única gravação.
2. **Criar estrutura de trabalho:** Ralis & PECs → Criar rali (nome/localização/ano/piso, carro/imagem opcionais) → Guardar → abrir rali → Nova PEC (nome/número/distância) → abrir PEC. Exige online e rali editável.
3. **Reconhecer online:** PEC/Reconhecimento → Iniciar → GPS/microfone → marcar ou premir/ditar/soltar → Finalizar → aguardar guarda local → envio notas/GPS e áudio → Studio. GPS negado impede início; microfone negado permite prosseguir sem áudio. Não grava vídeo.
4. **Reconhecer offline com conta:** mudar modo → fila/Novo → captar/finalizar → Por sincronizar → voltar online/validar → escolher PEC ou criar PEC num rali → Sincronizar → confirmar remoção local. Falha conserva cópia; retry não deve duplicar receção da sessão.
5. **Entrar offline sem conta:** login/Entrar offline → capturar/finalizar → fila do contexto local. Ao entrar depois com conta real não foi encontrado percurso de adoção dessas sessões; o fim-a-fim até sync está incompleto/por confirmar.
6. **Corrigir no Studio:** abrir PEC/Studio → associar vídeo/áudio/GPS → alinhar offset/Fixar Nota1 Aqui → reproduzir/escolher nota ou mapa → Editar conteúdo/observação/tempo/apresentação → Guardar ou Cancelar. Alteração da ocorrência não muda dicionário/modelo geral.
7. **Trabalhar com Excel:** Studio/Ficheiros → exportar modelo/notas → editar tabela XLSX → importar → rever tempos → alinhar. Importação substitui o conjunto de notas; não é adição incremental nem preserva toda a apresentação anterior.
8. **Gerar RecceBook:** preparar página/modelo/capa principal em Notas → PEC/Studio/Exportar PDF → opcional capa específica/Guardar → conferir folhas/avisos → Imprimir/Guardar PDF no navegador. Ordem: capa, notas, contracapa. Não é exportação agregada de todo o rali.
9. **Concluir/corrigir:** guardar ou finalizar trabalho → concluir PEC ou Terminar Rali → consulta protegida → reabrir rali e PEC, conforme estado, para corrigir. Conclusão não sincroniza nem faz backup automaticamente.
10. **Aprender:** Tutorial/Ajuda → escolher módulo ou parte → exemplos com destaque/Anterior/Próximo/Sair → Experimentar abre contexto real. Demonstrações não gravam dados da equipa e não ativam sensores reais.

Falhas recuperáveis incluem retry de carga, rascunho mantido, sessão pronta após sync interrompido, erro explícito de áudio ausente e mapa sem imagens mas com geometria. Não há recuperação garantida de áudio nunca consolidado após fecho forçado nem restauro global de dados eliminados.

## Dependências e regras críticas

- Rali precede PEC online; captura sem PEC existe localmente e precisa de destino para enviar. Criar PEC no fluxo de sync requer rali existente.
- Regras pessoais de voz influenciam conversão futura; apresentação usa símbolos do dicionário e não cria novas definições. Texto base do sistema da equipa é descritivo, não um conjunto de regras partilhadas.
- Um colega pode alterar recursos partilhados, mas não os modelos pessoais de outro membro. Backend verifica equipa/propriedade; os papéis piloto/copiloto não conferem privilégios.
- Concluir rali bloqueia alterações nas suas PECs/notas/media/capas; concluir PEC bloqueia essa especial. Reabrir um nível não reabre automaticamente o outro. DRAFT/COMPLETED são as ações expostas; não há aprovação formal por outro utilizador.
- Importar Excel e receber nova sessão com marcadores substituem notas do destino. Retry da mesma sessão/equipa reutiliza o destino já recebido; não é merge nem reatribuição livre a outra PEC.
- Áudio é enviado depois de notas/GPS. Só sucesso completo remove sessão local; áudio referenciado em falta é erro. Browser/conta originais e espaço local importam.
- Capa principal é pessoal; PEC sem capa guardada herda modelo e resolve campos de rali/PEC/equipa/carro/data. Guardar capa na PEC cria snapshot partilhado independente. Símbolo da aplicação e assinatura de contracapa são fixos.
- Caderno: A4/A5, orientação, margens5–30mm,1–24 linhas,12–48pt e alinhamento centrado por omissão. Blocos longos continuam noutras linhas; overflow bloqueia exportação em vez de cortar/reduzir silenciosamente.
- Captura não grava vídeo; voz depende do browser e não é garantida sem internet. GPS pode ficar degradado; mapa interpola entre amostras temporizadas válidas, não faz correção para a estrada nem inventa posição em lacunas.
- Selecionar carro afeta equipa; guardar rali com carId também atualiza carro ativo. Estatísticas refletem distâncias declaradas, não necessariamente quilómetros de passagens gravadas.

## Integrações e ficheiros

API própria para persistência; geolocalização/microfone/MediaRecorder/SpeechRecognition do navegador; imagens Esri World Imagery com atribuição; GPX e JSON reconhecido para GPS; XLSX para tabela de notas; impressão/PDF no navegador; disco do servidor ou S3 configurável para ficheiros. Cache de shell em produção e IndexedDB para sessões locais. Sem envio de PDF por email, biblioteca remota de exportações, mapas descarregados offline ou integração de cronometrista identificados.

## Problemas e inconsistências observados

| Tema | Impacto observado ou risco funcional | Confiança |
| --- | --- | --- |
| Sessões sem conta | Falta percurso identificado de migração para a conta que vai sincronizar. | Alta no código; fim-a-fim não executado. |
| Formatos Excel | UI anuncia CSV/XLS; parser confirma XLSX. | Alta. |
| Eliminação de rali/PEC | Confirmações prometem dependências; limpeza/cascata completa não está demonstrada nos métodos. | Alta na divergência; efeito real da base por confirmar. |
| Unidades/estatísticas | Preferência de milhas coexistente com resumo km; km em recce são distância declarada. | Alta para o resumo analisado. |
| Carro ativo | Guardar rali pode alterar seleção global de equipa. | Alta. |
| Áudio e vídeo | Dois players não equivalem a sincronização audiovisual geral; vídeo é media ativo preferido. | Alta no código, reprodução real não executada. |
| Linguagem pessoal/partilhada | Base textual, parser e regras pessoais têm âmbitos distintos e potencialmente pouco evidentes. | Alta. |
| Gravações separadas | Guardar Perfil não desfaz/guarda garagem; Guardar modelo não grava capa em edição. | Alta. |
| Ajuda offline | /tutorial/notes permite entrada, mas avanço para /notes/learn entra em rota não permitida offline. | Alta no encaminhamento, sem execução. |
| Descoberta de início | Rota de novo reconhecimento existe sem item ativo no menu. | Alta. |
| Substituição de notas | Importação/sync substituem conjunto; não foi encontrada confirmação prévia na importação. | Alta. |
| Estados do rali/PEC | UI pode mostrar ação baseada só na PEC; backend rejeita por rali concluído. | Alta. |
| Guarda da captura | Snapshots e consolidação áudio não equivalem a salvaguarda integral contínua. | Alta no mecanismo; fecho forçado por confirmar. |
| Parcialidades | Idioma informativo, registo beta proibido e roteiro sem explicação específica da capa principal. | Alta. |

Estas observações descrevem problemas/perceções possíveis; não estabelecem prioridades de implementação nem propõem soluções. Repetições como editar PEC na lista ou na página, ajuda por partes e atalhos Configurar notas são sobreposições com contextos próprios, não automaticamente defeitos.

## Limites para a avaliação externa

Não houve alterações de código/dados, testes, auditorias ou visita à instalação publicada. Confirmação estática não é usabilidade observada. Não se validaram sensores/voz em dispositivos, perda de rede, concorrência, quotas/eviction de armazenamento, codecs, impressão física, acessibilidade assistida, permissões/retensão de produção ou integrações S3/Postgres. Eliminação com dependentes, migração anónima, estado conflict e continuação do áudio em retoma permanecem pontos específicos a confirmar.

Foram analisados os 12 módulos e as superfícies/ações identificadas; não se afirma cobertura total de todos os ramos de implementação ou de configurações externas. A especificação principal inclui mapa de rotas, matriz de permissões, entidades, ciclo de vida, estados, fontes e inventário de operações backend. Não inclui credenciais, tokens ou dados pessoais.
