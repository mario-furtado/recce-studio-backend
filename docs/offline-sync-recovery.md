# Recuperação de sincronizações offline

Ao carregar a lista de reconhecimentos offline, sessões do utilizador atual que ficaram em `syncing` sem uma operação ativa regressam a `ready_to_sync`. A recuperação é persistida numa transação IndexedDB e mantém o ID, notas, GPS, referência e Blob de áudio. Não envia dados automaticamente: o utilizador pode repetir a sincronização.

Uma operação ativa mantém a marca e a coordenação até terminar o envio de notas, o envio de áudio e a limpeza local. Recarregar a lista ou voltar à página não deve transformar essa operação em pendente. Estados `draft`, `ready_to_sync`, `synced` e `conflict` não são alterados pela recuperação.

O mesmo ID de sessão é reutilizado em cada tentativa. O backend já resolve repetições pela combinação de sessão offline e equipa, devolvendo a PEC e a sincronização anteriores. O teste H2 deste ticket repete três vezes a criação de PEC com notas e confirma uma única PEC, nota e sincronização. Falhas de resposta, de upload de áudio existente ou de limpeza local não devem deixar uma operação ativa bloqueada no frontend.

As escritas locais só são consideradas concluídas no commit da transação, e abortos são propagados. A recuperação relê o registo na transação antes de alterar o estado; não regrava um estado mais recente a partir da lista anterior.

Quando disponível, Web Locks coordena a mesma sessão entre instâncias/páginas da mesma origem e liberta a posse quando a página termina. Sem essa API, a proteção de progresso é apenas da instância do serviço: usar uma única página para sincronizar. Foram testadas duas instâncias do serviço com Web Locks em Chrome Headless, não um encerramento real do navegador nem stress entre separadores/processos.

A recuperação só altera sessões com a mesma identidade de email local. O isolamento da listagem e ações entre contas é descrito abaixo (AUD-OFF-003).

## Áudio referenciado em falta (AUD-OFF-002)

Se a sessão referencia áudio mas o Blob não está disponível, o envio falha e a sessão regressa a `ready_to_sync`. A referência, tipo, tamanho, notas e GPS são preservados, mesmo após repetir a sincronização ou voltar à página. As notas podem já estar no servidor; a repetição mantém o mesmo ID. A mensagem informa que o áudio está em falta ou não pôde ser enviado e recomenda não apagar a sessão nem os dados do navegador e confirmar a disponibilidade da gravação antes de repetir. Não afirma que um Blob ausente está guardado, nem reconstrói uma gravação perdida.

Uma sessão criada sem gravação e sem referência de áudio continua a poder sincronizar normalmente. Falhas de leitura do armazenamento também mantêm a sessão para nova tentativa.

## Isolamento de contas locais (AUD-OFF-003)

Listagem, leitura por ID, snapshots, conclusão, recuperação, sincronização e eliminação exigem uma sessão local autenticada e o mesmo email do registo, normalizado sem espaços exteriores e sem distinção de maiúsculas. Uma referência conhecida não permite obter a sessão ou o áudio de outra conta. O áudio tem de pertencer à sessão autorizada e ser a sua referência atual; a eliminação verifica essa ligação e remove sessão e áudio na mesma transação. Operações assíncronas revalidam a identidade e rejeitam uma mudança de conta antes de devolver dados ou gravar alterações.

Continuar um rascunho relê o registo persistido. A fila filtra também dados e contadores em memória. O modo de gravação revalida a sessão antes de retomar ou enviar imediatamente. O editor de PECs só envia um backup quando existe uma sessão persistida autorizada para essa PEC; usa notas e GPS dessa sessão, não os valores de um cache sem dono. Uma resposta tardia de outra conta não envia áudio nem remove o backup.

Não existe transferência automática de propriedade ao fazer login. Registos antigos com email de uma conta continuam acessíveis apenas ao entrar nessa conta. Registos com email nulo/vazio e backups antigos sem sessão persistida autorizada ficam preservados e ocultos, sem atribuição, sincronização ou eliminação automática. Não foi acrescentada uma ferramenta de migração: qualquer futura recuperação/atribuição destes registos exige um fluxo explícito que confirme o dono; não se deve alterar o email para a conta seguinte.

Entrar explicitamente em modo offline usa a identidade reservada `offline@recce.local`, separada das contas autenticadas. Os registos desse modo só ficam disponíveis enquanto esse modo está ativo e não são reclamados por uma conta ao entrar online. Este é um espaço offline partilhado do perfil do navegador, sem identidade pessoal verificada. Depois de terminar sessão não são devolvidos registos, mesmo que reste um email em cache. Estar sem rede mantendo a conta iniciada conserva a propriedade dessa conta.

Este controlo protege os fluxos da aplicação no mesmo navegador; não cifra IndexedDB nem protege contra quem controla o perfil do navegador ou executa código na mesma origem. A autorização no servidor continua independente.
