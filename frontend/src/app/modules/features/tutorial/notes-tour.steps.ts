export const notesTourSteps = [
  { title: 'Entrar em Notas', target: '[data-tour="notes-menu"]', area: 'dictionary', text: 'Notas reúne o teu sistema de notas. Ao avançar, abrimos uma cópia de demonstração desta página. Os teus dados ficam intactos.' },
  { title: 'Três áreas, um percurso', target: '[data-tour="notes-areas"]', area: 'dictionary', text: 'Começa no Dicionário, liga o símbolo à Apresentação e prepara o Caderno e exportação. Podes regressar a qualquer área.' },
  { title: 'Pessoal ou partilhado?', target: '[data-tour="note-system"]', area: 'dictionary', text: 'A descrição do sistema base é partilhada com a equipa. As regras do dicionário e o modelo visual são pessoais. Aqui tudo é apenas exemplo.' },
  { title: 'Uma frase, um significado, um símbolo', target: '[data-tour="note-rule-form"]', area: 'dictionary', text: 'Exemplo: quando digo “esquerda exemplo”, escrever E6. O significado é definido por ti; o grupo organiza as regras. No próximo passo adicionamos esta regra só à demonstração.' },
  { title: 'Da regra à apresentação', target: '[data-tour="configure-symbol"]', area: 'dictionary', text: 'A regra de exemplo já aparece na lista. “Configurar apresentação” abre o mesmo símbolo, preservando estilos existentes. Ao avançar mostramos essa ligação.' },
  { title: 'A nota principal', target: 'app-notebook-settings details[open]', area: 'presentation', text: 'E6 ocupa o centro. O símbolo e o significado vêm do Dicionário. Aqui ajustas papel, posição, tamanho, negrito, sublinhado e destaque. As opções iniciais são sugestões editáveis.' },
  { title: 'Associar os modificadores', target: 'app-notebook-settings details[open] select[aria-label="Posição"]', area: 'presentation', text: 'Neste exemplo ++ está associado ao bloco anterior, no canto superior direito e a 60%. nt fica em baixo à direita. Tu defines o significado e as posições.' },
  { title: 'Ver o resultado', target: 'app-notebook-settings .notebook-pages .notebook-row', area: 'presentation', text: 'A pré-visualização usa E6++ nt. Confere os modificadores e os avisos antes de guardar. A demonstração nunca guarda na tua conta.' },
  { title: 'Preparar as páginas', target: '[data-tour="notebook-page"]', area: 'notebook', text: 'Escolhe A4/A5, orientação, margens, linhas por página, tamanho da letra e separadores. Aqui mostramos A5 vertical com seis linhas e letra de 18 pt; a pré-visualização acompanha as opções.' },
  { title: 'Quando o conteúdo não cabe', target: 'app-notebook-settings .notebook-controls', area: 'notebook', text: 'Este exemplo provoca um aviso real: um bloco não cabe na página. A exportação fica indisponível. Ajusta o formato, a letra ou distribui a sequência; nunca cortes avisos. Ao mudar de passo restauramos um exemplo válido.' },
  { title: 'Usar no Studio', target: '[data-tour="studio-example"]', area: 'studio', text: 'Abre uma PEC no Studio: as notas usam o teu modelo. “Configurar notas” permite regressar às definições. Esta amostra usa apenas notas temporárias, sem abrir ou criar uma PEC real.' },
  { title: 'Exportar e experimentar', target: '[data-tour="studio-example"] .notebook-controls', area: 'studio', text: 'No Studio, abre Caderno/PDF e escolhe “Imprimir / Guardar PDF”. Confere a pré-visualização e seleciona Guardar como PDF no diálogo do navegador. Agora podes sair do exemplo e experimentar nas tuas notas.' },
] as const;

export const tourParts: ReadonlyMap<string, number> = new Map([
  ['dictionary', 2], ['presentation', 5], ['notebook', 8], ['studio', 10],
]);
