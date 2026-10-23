# Preservação de áudio ao sair de um reconhecimento

Durante o arranque, gravação, finalização ou uma falha de persistência, a navegação Angular é bloqueada. Finaliza e guarda o reconhecimento antes de sair. A mesma proteção abrange a página autónoma e o reconhecimento embutido na página da PEC, incluindo a troca de modo.

Ao finalizar, a aplicação aguarda o `stop` do MediaRecorder e o último chunk de áudio, depois a fila de snapshots e o commit da sessão/Blob em IndexedDB. Só então permite a saída normal. Chamadas simultâneas de finalização/destruição partilham a mesma operação; não substituem o callback nem descartam o áudio.

Se guardar falhar, a sessão original e o Blob ficam disponíveis em memória para repetir sem começar outra gravação. A mensagem indica que não foi guardado e pede para manter a página e a conta original. Não é anunciado nem descarregado um backup JSON fictício. Uma conta diferente não pode receber a gravação; voltar à conta original permite repetir. Se a sessão local inicial nem chegou a ser criada, não há confirmação de preservação: a saída mantém-se protegida e não se deve fechar a página.

Refresh/fecho solicita a confirmação nativa do navegador enquanto há dados por guardar. Os navegadores controlam essa confirmação e podem exigir interação prévia ou não a mostrar em alguns casos. Confirmar a saída, matar o processo, falha de energia e encerramento forçado podem perder áudio ainda em memória. O `ngOnDestroy` tenta persistir localmente se for chamado; trabalho assíncrono durante unload não é uma garantia de durabilidade. Para preservar o áudio, finalizar e guardar antes de fechar continua a ser o caminho recomendado.

Validação automatizada: IndexedDB real em bases isoladas, callbacks de MediaRecorder controlados e RouterTestingHarness com o Router real. O listener Angular de `beforeunload` é invocado sem disparar o detetor de reload do Karma. Não foram validados microfone/codecs reais, diálogo nativo, browsers móveis ou encerramento forçado. Nenhuma ferramenta de exportação/restauro foi adicionada.
