import { RecceNoteParserService } from './recce-note-parser.service';

describe('RecceNoteParserService', () => {
  let service: RecceNoteParserService;

  beforeEach(() => {
    service = new RecceNoteParserService();
  });

  const cases = [
    {
      spoken: 'Cem metros para esquerda quatro corta na casa',
      compact: '100m > E4 C',
      observation: 'na casa',
    },
    {
      spoken: 'Cinquenta direita tres mais e esquerda cinco a fundo',
      compact: '50 D3+ + E5 AF',
      observation: '',
    },
    {
      spoken: 'Esquerda cinco muito longa abre para seis',
      compact: 'E5 LL ab > 6',
      observation: '',
    },
    {
      spoken: 'Oitenta direita dois curta para esquerda dois longa fecha na saida',
      compact: '80 D2 ct > E2 L f',
      observation: 'na saida',
    },
    {
      spoken: 'Cinquenta mantem esquerda tres para direita quatro corta por dentro',
      compact: '50 m E3 > D4 C',
      observation: 'por dentro',
    },
    {
      spoken: 'Atencao lomba sobre esquerda dois aperta nao corta',
      compact: 'ATT LB s/ E2 ap NC',
      observation: '',
    },
    {
      spoken: 'Duzentos metros para travagem forte direita um no poste de eletricidade',
      compact: '200m > TR+ D1',
      observation: 'no poste de eletricidade',
    },
    {
      spoken: 'Perigo salto sobre direita tres nao tocar no rail',
      compact: '! SL s/ D3',
      observation: 'nao tocar no rail',
    },
    {
      spoken: 'Atencao ponte estreita para direita dois suja',
      compact: 'ATT PT estreita > D2',
      observation: 'suja',
    },
    {
      spoken: 'Cinquenta esquerda cinco sobre lomba para direita quatro por fora da arvore',
      compact: '50 E5 s/ LB > D4',
      observation: 'por fora da arvore',
    },
    {
      spoken: 'Esquerda seis para imediatamente direita dois fecha muito',
      compact: 'E6 >> D2 f+',
      observation: '',
    },
    {
      spoken: 'Trezentos metros travagem cruzamento direita um fita amarela',
      compact: '300m TR CRZ D1',
      observation: 'fita amarela',
    },
    {
      spoken: 'Oitenta direita quatro para alcatrao escorrega',
      compact: '80 D4 > ALC',
      observation: 'escorrega',
    },
    {
      spoken: 'Dousentos metros mudanca de piso para terra em esquerda quatro corta',
      compact: '200m MUD. PISO > TERRA em E4 C',
      observation: '',
    },
    {
      spoken: 'Quatrocentos metros em lomba a fundo centro',
      compact: '400m em LB AF CNT',
      observation: '',
    },
    {
      spoken: 'Esquerda tres tardia corta muito no segundo tanque',
      compact: 'E3 td C+',
      observation: 'no segundo tanque',
    },
    {
      spoken: 'Cinquenta chicane entrada esquerda primeiro fardo',
      compact: '50 CHICANE ent E',
      observation: 'primeiro fardo',
    },
    {
      spoken: 'Cem metros travagem forte para gancho esquerda travao de mao',
      compact: '100m TR+ > G E',
      observation: 'travao de mao',
    },
    {
      spoken: 'Esquerda quatro esconde para direita cinco nao corta',
      compact: 'E4 esconde > D5 NC',
      observation: '',
    },
    {
      spoken: 'Oitenta lomba cega para direita seis a fundo',
      compact: '80 LB cega > D6 AF',
      observation: '',
    },
    {
      spoken: 'Cento e cinquenta metros agua para esquerda tres buraco por dentro',
      compact: '150m AGUA > E3',
      observation: 'buraco por dentro',
    },
    {
      spoken: 'Direita quatro cai para fora contra curva esquerda tres',
      compact: 'D4 > E3',
      observation: 'cai para fora / contra curva',
    },
    {
      spoken: 'Cinquenta travagem para direita um estreita entre muros',
      compact: '50 TR > D1 estreita',
      observation: 'entre muros',
    },
    {
      spoken: 'Esquerda tres para trinta direita tres menos fecha nao corta na rede',
      compact: 'E3 > 30 D3- f NC',
      observation: 'na rede',
    },
    {
      spoken: 'Cento e cinquenta para meta em direita cinco a fundo',
      compact: '150m > META s/ D5 AF',
      observation: '',
    },
  ];

  cases.forEach(({ spoken, compact, observation }) => {
    it(`parses "${spoken}"`, () => {
      expect(service.parse(spoken)).toEqual({
        compactText: compact,
        observation,
        rawText: spoken,
      });
    });
  });

  it('parses compact direction commands produced by speech recognition', () => {
    expect(service.parse('e3').compactText).toBe('E3');
    expect(service.parse('d4').compactText).toBe('D4');
  });

  it('ignores speech filler words between direction and rating', () => {
    expect(service.parse('direita acelera tres').compactText).toBe('D3');
    expect(service.parse('d acelera 4').compactText).toBe('D4');
  });

  it('applies custom dictionary symbols before base parser rules', () => {
    const customParser = new RecceNoteParserService({
      getActiveRules: () => [
        { phrase: 'trava', symbol: 'T', enabled: true },
        { phrase: 'sinal', symbol: 'Sin', enabled: true },
      ],
    } as any);

    expect(customParser.parse('Trava no sinal')).toEqual({
      compactText: 'T Sin',
      observation: '',
      rawText: 'Trava no sinal',
    });
  });
});
