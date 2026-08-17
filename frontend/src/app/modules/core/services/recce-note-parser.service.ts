import { Injectable, Optional } from '@angular/core';
import { CustomNoteDictionaryRule, NoteDictionaryService } from './note-dictionary.service';

export interface ParsedRecceNote {
  compactText: string;
  observation: string;
  rawText: string;
}

interface VoiceToken {
  raw: string;
  norm: string;
}

interface NumberParseResult {
  value: number;
  consumed: number;
}

@Injectable({
  providedIn: 'root',
})
export class RecceNoteParserService {
  private readonly units: Record<string, number> = {
    um: 1,
    uma: 1,
    dois: 2,
    duas: 2,
    tres: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9,
  };

  private readonly tens: Record<string, number> = {
    dez: 10,
    vinte: 20,
    trinta: 30,
    quarenta: 40,
    cinquenta: 50,
    sessenta: 60,
    setenta: 70,
    oitenta: 80,
    noventa: 90,
  };

  private readonly hundreds: Record<string, number> = {
    cem: 100,
    cento: 100,
    duzentos: 200,
    dousentos: 200,
    trezentos: 300,
    quatrocentos: 400,
    quinhentos: 500,
    seiscentos: 600,
  };

  constructor(@Optional() private noteDictionary?: NoteDictionaryService) {}

  parse(rawText: string): ParsedRecceNote {
    const cleanText = this.normalizeWhitespace(rawText);
    const tokens = this.tokenize(cleanText);
    const dictionaryRules = this.noteDictionary?.getRules() || [];
    const customRules = dictionaryRules.filter((rule) => rule.enabled);
    const disabledRules = dictionaryRules.filter((rule) => !rule.enabled);
    const compact: string[] = [];
    const observations: string[] = [];
    let lastCurveEmitted = false;

    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      const next = tokens[index + 1];

      if (this.isNoise(token.norm)) {
        continue;
      }

      const customRule = this.customRuleAt(tokens, index, customRules);
      if (customRule) {
        compact.push(customRule.text);
        index += customRule.consumed - 1;
        lastCurveEmitted = false;
        continue;
      }

      const disabledRule = this.customRuleAt(tokens, index, disabledRules);
      if (disabledRule) {
        index += disabledRule.consumed - 1;
        lastCurveEmitted = false;
        continue;
      }

      if ((token.norm === 'para' || token.norm === 'pra') && (next?.norm === 'imediatamente' || next?.norm === 'logo')) {
        compact.push('>>');
        index++;
        continue;
      }

      if (token.norm === 'e' && this.isDirection(next?.norm || '')) {
        this.appendConnector(compact, '+');
        continue;
      }

      const number = this.parseNumberAt(tokens, index);
      if (number) {
        compact.push(this.formatDistanceOrNumber(number.value, tokens[index + number.consumed]));
        index += this.consumeMeters(tokens, index + number.consumed) ? number.consumed : number.consumed - 1;
        lastCurveEmitted = false;
        continue;
      }

      if (this.isDirection(token.norm)) {
        this.appendImplicitCurveConnector(compact, lastCurveEmitted);
        const curve = this.parseCurve(tokens, index);
        compact.push(curve.text);
        index += curve.consumed - 1;
        lastCurveEmitted = curve.hasRating;
        continue;
      }

      if (this.isPhrase(tokens, index, ['nao', 'corta'])) {
        compact.push('NC');
        index++;
        continue;
      }

      if (this.isPhrase(tokens, index, ['nao', 'tocar'])) {
        observations.push(this.collectObservation(tokens, index, tokens.length));
        break;
      }

      if (this.isPhrase(tokens, index, ['corta', 'muito'])) {
        compact.push('C+');
        index++;
        if (this.isLocalReferenceStart(tokens[index + 1]?.norm)) {
          observations.push(this.collectObservation(tokens, index + 1, tokens.length));
          break;
        }
        continue;
      }

      if (this.isPhrase(tokens, index, ['corta', 'pouco'])) {
        compact.push('C-');
        index++;
        continue;
      }

      if (this.isCut(token.norm)) {
        compact.push('C');
        if (this.isLocalReferenceStart(next?.norm)) {
          observations.push(this.collectObservation(tokens, index + 1, tokens.length));
          break;
        }
        continue;
      }

      if (this.isPhrase(tokens, index, ['travagem', 'forte'])) {
        compact.push('TR+');
        index++;
        continue;
      }

      if (this.isBrake(token.norm)) {
        compact.push('TR');
        continue;
      }

      if (this.isPhrase(tokens, index, ['travao', 'de', 'mao'])) {
        observations.push(this.collectObservation(tokens, index, index + 3));
        index += 2;
        continue;
      }

      if (this.isPhrase(tokens, index, ['mudanca', 'de', 'piso'])) {
        compact.push('MUD. PISO');
        index += 2;
        continue;
      }

      if (this.isPhrase(tokens, index, ['muito', 'longa']) || this.isPhrase(tokens, index, ['muito', 'longo'])) {
        compact.push('LL');
        index++;
        continue;
      }

      if (this.isLong(token.norm)) {
        compact.push('L');
        continue;
      }

      if (this.isShort(token.norm)) {
        compact.push('ct');
        continue;
      }

      if (this.isPhrase(tokens, index, ['fecha', 'muito'])) {
        compact.push('f+');
        index++;
        continue;
      }

      if (this.isTightening(token.norm)) {
        compact.push(token.norm.startsWith('apert') ? 'ap' : 'f');
        continue;
      }

      if (this.isOpening(token.norm)) {
        compact.push('ab');
        continue;
      }

      if (this.isPhrase(tokens, index, ['a', 'fundo'])) {
        compact.push('AF');
        index++;
        continue;
      }

      if (token.norm === 'fundo') {
        compact.push('AF');
        continue;
      }

      if (token.norm === 'imediatamente' || token.norm === 'logo') {
        compact.push('>>');
        continue;
      }

      if (token.norm === 'para' || token.norm === 'pra') {
        if (next?.norm === 'imediatamente' || next?.norm === 'logo') {
          compact.push('>>');
          index++;
          continue;
        }
        this.appendConnector(compact, '>');
        continue;
      }

      if (token.norm === 'e') {
        this.appendConnector(compact, '+');
        continue;
      }

      if (token.norm === 'sobre') {
        compact.push('s/');
        continue;
      }

      if (token.norm === 'em' && this.lastCompactIs(compact, 'META') && this.isDirection(next?.norm || '')) {
        compact.push('s/');
        continue;
      }

      if (token.norm === 'em') {
        compact.push('em');
        continue;
      }

      const directToken = this.directToken(token.norm, next?.norm);
      if (directToken) {
        compact.push(directToken.text);
        index += directToken.consumed - 1;
        continue;
      }

      const observationEnd = this.observationEnd(tokens, index);
      if (observationEnd > index) {
        observations.push(this.collectObservation(tokens, index, observationEnd));
        index = observationEnd - 1;
        continue;
      }
    }

    return {
      compactText: this.cleanupCompact(compact.join(' ')) || cleanText,
      observation: this.cleanupObservation(observations),
      rawText: cleanText,
    };
  }

  private tokenize(text: string): VoiceToken[] {
    return this.normalizeWhitespace(text)
      .replace(/(\d+)([a-zA-Z]+)/g, '$1 $2')
      .replace(/([a-zA-Z]+)(\d+)/g, '$1 $2')
      .replace(/[.,;:!?]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((raw) => ({
        raw: raw.toLowerCase(),
        norm: this.normalizeToken(raw),
      }));
  }

  private customRuleAt(
    tokens: VoiceToken[],
    index: number,
    rules: CustomNoteDictionaryRule[],
  ): { text: string; consumed: number } | null {
    const sortedRules = [...rules]
      .map((rule) => ({
        rule,
        phraseTokens: this.tokenize(rule.phrase).map((token) => token.norm),
      }))
      .filter(({ phraseTokens, rule }) => phraseTokens.length > 0 && !!rule.symbol?.trim())
      .sort((a, b) => b.phraseTokens.length - a.phraseTokens.length);

    for (const { rule, phraseTokens } of sortedRules) {
      if (this.matchesTokens(tokens, index, phraseTokens)) {
        return { text: rule.symbol.trim(), consumed: phraseTokens.length };
      }

      if (this.isLocalReferenceStart(tokens[index]?.norm) && this.matchesTokens(tokens, index + 1, phraseTokens)) {
        return { text: rule.symbol.trim(), consumed: phraseTokens.length + 1 };
      }
    }

    return null;
  }

  private matchesTokens(tokens: VoiceToken[], index: number, phraseTokens: string[]): boolean {
    return phraseTokens.every((word, offset) => tokens[index + offset]?.norm === word);
  }

  private normalizeWhitespace(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  private normalizeToken(token: string): string {
    return token
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private parseNumberAt(tokens: VoiceToken[], index: number): NumberParseResult | null {
    const token = tokens[index]?.norm;
    if (!token) return null;

    if (/^\d+$/.test(token)) {
      return { value: Number(token), consumed: 1 };
    }

    if (this.hundreds[token]) {
      const base = this.hundreds[token];
      const skipAnd = tokens[index + 1]?.norm === 'e' ? 1 : 0;
      const next = tokens[index + 1 + skipAnd]?.norm;
      if (token === 'cento' && next && this.tens[next]) {
        return { value: base + this.tens[next], consumed: 2 + skipAnd };
      }
      if (token === 'cento' && next && this.units[next]) {
        return { value: base + this.units[next], consumed: 2 + skipAnd };
      }
      return { value: base, consumed: 1 };
    }

    if (this.tens[token]) {
      const skipAnd = tokens[index + 1]?.norm === 'e' ? 1 : 0;
      const next = tokens[index + 1 + skipAnd]?.norm;
      if (next && this.units[next]) {
        return { value: this.tens[token] + this.units[next], consumed: 2 + skipAnd };
      }
      return { value: this.tens[token], consumed: 1 };
    }

    if (this.units[token]) {
      return { value: this.units[token], consumed: 1 };
    }

    return null;
  }

  private consumeMeters(tokens: VoiceToken[], index: number): boolean {
    return ['metro', 'metros'].includes(tokens[index]?.norm || '');
  }

  private formatDistanceOrNumber(value: number, next?: VoiceToken): string {
    if (['metro', 'metros'].includes(next?.norm || '') || value >= 100) {
      return `${value}m`;
    }
    return String(value);
  }

  private parseCurve(tokens: VoiceToken[], index: number): { text: string; consumed: number; hasRating: boolean } {
    const direction = this.isRight(tokens[index].norm) ? 'D' : 'E';
    let ratingIndex = index + 1;
    while (this.isDirectionFiller(tokens[ratingIndex]?.norm || '') && ratingIndex <= index + 3) {
      ratingIndex++;
    }

    const rating = this.parseNumberAt(tokens, ratingIndex);
    if (!rating) {
      return { text: direction, consumed: 1, hasRating: false };
    }

    let suffix = '';
    const suffixToken = tokens[ratingIndex + rating.consumed]?.norm;
    if (suffixToken === 'mais') suffix = '+';
    if (suffixToken === 'menos') suffix = '-';

    return {
      text: `${direction}${rating.value}${suffix}`,
      consumed: ratingIndex - index + rating.consumed + (suffix ? 1 : 0),
      hasRating: true,
    };
  }

  private directToken(token: string, next?: string): { text: string; consumed: number } | null {
    const map: Record<string, string> = {
      atencao: 'ATT',
      perigo: '!',
      lomba: 'LB',
      salto: 'SL',
      ponte: 'PT',
      estreita: 'estreita',
      suja: '',
      cega: 'cega',
      alcatrao: 'ALC',
      asfalto: 'ALC',
      terra: 'TERRA',
      gravilha: 'GRAVILHA',
      centro: 'CNT',
      tardia: 'td',
      esconde: 'esconde',
      gancho: 'G',
      cruzamento: 'CRZ',
      chicane: 'CHICANE',
      entrada: 'ent',
      meta: 'META',
      agua: 'AGUA',
      mantem: 'm',
    };

    if (token === 'lomba' && next === 'cega') {
      return { text: 'LB', consumed: 1 };
    }

    if (token === 'suja') {
      return null;
    }

    return map[token] ? { text: map[token], consumed: 1 } : null;
  }

  private observationEnd(tokens: VoiceToken[], index: number): number {
    const token = tokens[index]?.norm;
    const next = tokens[index + 1]?.norm;

    if (!token) return index;
    if (token === 'suja' || token === 'escorrega') return index + 1;
    if (token === 'fita') return tokens.length;
    if (token === 'primeiro') return tokens.length;
    if (token === 'buraco') return tokens.length;
    if (token === 'entre') return tokens.length;
    if (token === 'por') return tokens.length;
    if (['no', 'na'].includes(token)) return tokens.length;
    if (this.isPhrase(tokens, index, ['travao', 'de', 'mao'])) return index + 3;
    if (this.isPhrase(tokens, index, ['nao', 'tocar'])) return tokens.length;
    if (this.isPhrase(tokens, index, ['cai', 'para', 'fora'])) return index + 3;
    if (this.isPhrase(tokens, index, ['contra', 'curva'])) return index + 2;
    if (token === 'corta' && this.isLocalReferenceStart(next)) return tokens.length;

    return index;
  }

  private collectObservation(tokens: VoiceToken[], start: number, end: number): string {
    return tokens
      .slice(start, end)
      .map((token) => token.raw)
      .join(' ')
      .trim();
  }

  private isPhrase(tokens: VoiceToken[], index: number, phrase: string[]): boolean {
    return phrase.every((word, offset) => tokens[index + offset]?.norm === word);
  }

  private isNoise(token: string): boolean {
    return token === 'de' || token === 'da' || token === 'do' || this.isDirectionFiller(token);
  }

  private isDirectionFiller(token: string): boolean {
    return ['acelera', 'acelerar', 'acelerador', 'aceleracao'].includes(token);
  }

  private isDirection(token: string): boolean {
    return this.isRight(token) || this.isLeft(token);
  }

  private isRight(token: string): boolean {
    return ['direita', 'dir', 'd'].includes(token);
  }

  private isLeft(token: string): boolean {
    return ['esquerda', 'esq', 'e'].includes(token);
  }

  private isCut(token: string): boolean {
    return ['corta', 'cortar', 'corte'].includes(token);
  }

  private isBrake(token: string): boolean {
    return ['travagem', 'trava', 'travar'].includes(token);
  }

  private isLong(token: string): boolean {
    return ['longo', 'longa'].includes(token);
  }

  private isShort(token: string): boolean {
    return ['curto', 'curta'].includes(token);
  }

  private isTightening(token: string): boolean {
    return ['aperta', 'fecha', 'fechar', 'apertar'].includes(token);
  }

  private isOpening(token: string): boolean {
    return ['abre', 'abrir'].includes(token);
  }

  private isLocalReferenceStart(token?: string): boolean {
    return !!token && ['no', 'na', 'por', 'entre'].includes(token);
  }

  private appendConnector(compact: string[], connector: string): void {
    if (compact.length > 0 && compact[compact.length - 1] !== connector) {
      compact.push(connector);
    }
  }

  private appendImplicitCurveConnector(compact: string[], lastCurveEmitted: boolean): void {
    if (!lastCurveEmitted) return;
    const last = compact[compact.length - 1];
    if (last && !['>', '>>', '+', 's/'].includes(last)) {
      compact.push('>');
    }
  }

  private lastCompactIs(compact: string[], token: string): boolean {
    return compact[compact.length - 1] === token;
  }

  private cleanupCompact(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/>\s+>/g, '>')
      .trim();
  }

  private cleanupObservation(observations: string[]): string {
    return observations
      .map((observation) => observation.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter((observation, index, all) => all.indexOf(observation) === index)
      .join(' / ');
  }
}
