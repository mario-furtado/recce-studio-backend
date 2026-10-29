export type WorkflowKind = 'rally' | 'pec' | 'recce' | 'studio' | 'team' | 'offline';
export interface WorkflowStep { title: string; text: string; target: string }
export interface WorkflowGuide { name: string; practice: string; steps: readonly WorkflowStep[] }

export const workflowGuides: ReadonlyMap<string, WorkflowGuide> = new Map([
  ['team', { name: 'Perfil da Equipa', practice: 'Ir para o perfil da equipa', steps: [
    { title: 'Conhecer o perfil', target: '[data-demo="team-heading"]', text: 'O Perfil da Equipa reúne identidade, tripulação, carros e unidades. Esta simulação usa apenas exemplos; não carrega nem altera a tua equipa.' },
    { title: 'Editar identidade e tripulação', target: '[data-demo="team-identity"]', text: 'Escolhe Editar Perfil para alterar o nome, piloto e navegador. Alterar Imagem permite escolher o logótipo. Aqui não abrimos ficheiros nem guardamos imagens.' },
    { title: 'Organizar a garagem', target: '[data-demo="team-garage"]', text: 'Em edição, Novo Carro permite definir nome, classe e notas. Podes editar, adicionar foto ou eliminar um carro. Selecionar um carro torna-o ativo; confirma a escolha no uso real.' },
    { title: 'Escolher as unidades', target: '[data-demo="team-units"]', text: 'Em Unidades, escolhe a unidade de medida apresentada no perfil. Confirma a opção antes de guardar; esta demonstração não converte nem altera distâncias reais.' },
    { title: 'Guardar ou cancelar', target: '[data-demo="team-save"]', text: 'Guardar aplica a edição do perfil; Cancelar descarta o formulário de perfil. As ações da garagem têm controlos próprios: Cancelar não deve ser usado como desfazer de alterações já guardadas nos carros.' },
    { title: 'Onde configurar as notas', target: '[data-demo="team-notes"]', text: 'Usa a aba Notas para dicionário, apresentação e caderno. As regras e o modelo são pessoais; apenas o sistema base é partilhado com a equipa. O perfil mantém-se dedicado à equipa e aos carros.' },
  ] }],
  ['offline', { name: 'Reconhecimentos offline', practice: 'Ir para reconhecimentos offline', steps: [
    { title: 'Sessões neste dispositivo', target: '[data-demo="offline-heading"]', text: 'Aqui encontras reconhecimentos guardados neste navegador. O exemplo é temporário e não consulta as tuas sessões. Não limpes os dados do navegador enquanto tiveres sessões por sincronizar.' },
    { title: 'Reconhecer o estado', target: '[data-demo="offline-status"]', text: 'Rascunho significa que podes continuar; Por sincronizar identifica uma sessão finalizada. Confere data, notas, duração e áudio antes de enviar. As sessões visíveis respeitam o contexto da conta ou do modo offline.' },
    { title: 'Continuar ou começar outro', target: '[data-demo="offline-continue"]', text: 'Continuar está disponível para rascunhos. Novo reconhecimento inicia outra sessão. No reconhecimento real, autoriza GPS/microfone e finaliza a gravação antes de sincronizar. Este guia não ativa dispositivos.' },
    { title: 'Escolher o destino online', target: '[data-demo="offline-destination"]', text: 'Inicia sessão online para Escolher PEC existente ou Criar PEC no rali pretendido. Confirma o destino antes de Sincronizar. Em modo offline, estas ações de servidor não estão disponíveis.' },
    { title: 'Sincronizar e confirmar', target: '[data-demo="offline-sync"]', text: 'Sincronizar envia notas e áudio. Aguarda a confirmação: só após sucesso a sessão é removida do dispositivo. Não elimines manualmente a cópia local para resolver um envio pendente.' },
    { title: 'Recuperar de um erro', target: '[data-demo="offline-error"]', text: 'Após uma interrupção, Atualizar recupera sincronizações paradas para nova tentativa. Se faltar áudio, a sessão e os metadados são preservados. Confirma a ligação e a gravação antes de tentar novamente; repetir não deve duplicar notas remotas.' },
    { title: 'Eliminar com cuidado', target: '[data-demo="offline-delete"]', text: 'Eliminar pede confirmação e remove os dados locais de forma irreversível. Usa Cancelar se ainda precisas da sessão. O tutorial não abre confirmações reais nem apaga sessões; Experimentar abre a tua lista.' },
  ] }],
  ['rally', { name: 'Criar um rali', practice: 'Ir para os meus ralis', steps: [
    { title: 'Começar em Ralis & PECs', target: 'app-pecs-list .rs-page-header', text: 'Escolhe Criar novo rali. Este guia usa o formulário real com dados temporários; nada será criado na tua conta.' },
    { title: 'Nome e localização', target: '#rally-name', text: 'Nome e localização são obrigatórios. O exemplo chama-se Rali de exemplo; usa um nome que distingas facilmente na lista.' },
    { title: 'Ano e piso', target: '#rally-surface', text: 'Confirma o ano e escolhe Asfalto, Terra, Neve ou Misto. Estes dados ajudam a organizar e filtrar os teus ralis.' },
    { title: 'Carro, classe e imagem', target: '#rally-car', text: 'Carro e imagem são opcionais. Ao escolher um carro da equipa, a classe acompanha esse carro. Sem imagem, aparecem as iniciais.' },
    { title: 'Criar e encontrar o rali', target: 'app-pecs-list .interactive-card', text: 'Ao avançar até aqui, criámos apenas o exemplo em memória. No uso real, Criar Rali guarda-o na conta. Abre o rali para adicionar PECs; filtros podem esconder ralis concluídos.' },
  ] }],
  ['pec', { name: 'Criar uma PEC', practice: 'Escolher o meu rali', steps: [
    { title: 'Escolher o rali', target: 'app-rally-detail h1', text: 'Abre um rali e escolhe Adicionar Nova PEC. A PEC fica associada a esse rali. Aqui usamos um rali de exemplo, sem consultar os teus dados.' },
    { title: 'Identificar a PEC', target: '#new-pec-name', text: 'Escolhe um número e um nome reconhecível. O exemplo é Serra de exemplo, PEC1. Confirma que estás no rali certo antes de criar.' },
    { title: 'Indicar a distância', target: '#new-pec-distance', text: 'Preenche a distância em quilómetros, por exemplo 8,5. A distância contribui para os totais do rali; confirma a unidade apresentada no campo.' },
    { title: 'Criar a PEC', target: 'app-rally-detail .interactive-card', text: 'Criar PEC acrescenta-a ao rali. O cartão que vês é apenas um exemplo em memória. Um rali concluído não permite criar novas PECs.' },
    { title: 'Reconhecimento ou Studio', target: 'app-rally-detail .interactive-card', text: 'Abre o cartão para continuar em Reconhecimento ou Studio. A conclusão deste tutorial leva-te aos teus ralis, sem abrir o ID de exemplo.' },
  ] }],
  ['recce', { name: 'Reconhecimento', practice: 'Escolher reconhecimento', steps: [
    { title: 'Com PEC ou sem PEC', target: '[data-demo="recce-choice"]', text: 'Podes abrir Reconhecimento numa PEC ou iniciar sem PEC. Sem PEC, a sessão fica local e escolhes o destino ao sincronizar. Este painel é uma simulação.' },
    { title: 'Confirmar GPS e microfone', target: '[data-demo="recce-gps"]', text: 'No reconhecimento real, autoriza GPS e microfone e confirma o estado do sinal. Se o GPS for negado ou falhar, resolve a permissão antes de iniciar. O tutorial não pede acesso a dispositivos.' },
    { title: 'Reconhecimento em curso', target: '[data-demo="recce-record"]', text: 'Depois de INICIAR RECONHECIMENTO, confirma que tempo, áudio e GPS acompanham a sessão. O botão passa a FINALIZAR E GUARDAR. Aqui os valores são simulados, sem gravação real.' },
    { title: 'Marcar e ditar notas', target: '[data-demo="recce-marker"]', text: 'No modo premir para falar, segura SEGURE PARA DITAR e solta para fechar a nota. No modo de voz contínua, MARCAR NOTA regista o instante. A conversão usa o teu dicionário.' },
    { title: 'Finalizar e guardar', target: '[data-demo="recce-save"]', text: 'Termina com FINALIZAR E GUARDAR e espera pela confirmação antes de sair. Se houver erro, tenta guardar novamente; não abandones a sessão ainda pendente. Este exemplo já está finalizado em memória.' },
    { title: 'Sincronizar a sessão offline', target: '[data-demo="recce-sync"]', text: 'Nos Reconhecimentos offline, revê a sessão e escolhe rali/PEC ao sincronizar. Mantém a sessão enquanto houver erro ou áudio em falta. A demonstração não escreve no navegador nem envia sessões.' },
  ] }],
  ['studio', { name: 'Studio', practice: 'Escolher PEC para o Studio', steps: [
    { title: 'Abrir o Studio da PEC', target: '[data-demo="studio-heading"]', text: 'Abre a tua PEC e muda para Studio. Aqui mostramos uma amostra isolada, sem carregar ralis, PECs ou ficheiros reais.' },
    { title: 'Vídeo, áudio, GPS e notas', target: '[data-demo="studio-assets"]', text: 'Os controlos + Add Video, áudio, GPS e notas carregam os ficheiros da PEC. Revê o conteúdo antes de substituir. Neste exemplo não abrimos ficheiros, câmara ou microfone.' },
    { title: 'Tempo e navegação', target: '[data-demo="studio-timeline"]', text: 'O vídeo controla o instante da revisão. Avançar ou recuar permite conferir as notas e o trajeto nesse momento. O exemplo muda de instante apenas ao mudar de passo.' },
    { title: 'Alinhar as notas', target: '[data-demo="studio-anchor"]', text: 'Usa Fixar Nota 1 Aqui para alinhar o início das notas com o vídeo. Confirma a referência temporal e o desfasamento antes de guardar. Neste guia o ajuste é apenas ilustrativo.' },
    { title: 'Mapa e notas no mesmo instante', target: '[data-demo="studio-map"]', text: 'Com GPS temporizado, a posição no mapa acompanha o vídeo. As notas com coordenadas aparecem no trajeto; sem coordenadas não se inventa uma posição. Este desenho representa pontos simulados, sem imagens de satélite.' },
    { title: 'Rever a nota', target: '[data-demo="studio-notes"]', text: 'Revê texto, instante e observações antes de guardar. Configurar notas ajusta os símbolos e o modelo pessoal. O destaque deste exemplo usa o componente real de apresentação.' },
    { title: 'Caderno e PDF', target: '[data-demo="studio-notebook"] .notebook-controls', text: 'Abre Caderno / PDF, confirma a paginação e usa Imprimir / Guardar PDF. Se algo não couber, ajusta o modelo. A amostra usa o caderno real; o tutorial não abre a impressão automaticamente.' },
  ] }],
]);
