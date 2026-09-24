export interface TextStatistics {
  visibleCharacters: number;
  charactersWithoutLineBreaks: number;
  thesisCharacters: number;
  thesisCharactersWithoutPunctuation: number;
  mixedWords: number;
  hanCharacters: number;
  latinLetters: number;
  latinWords: number;
  digitCharacters: number;
  punctuationCharacters: number;
  whitespaceCharacters: number;
  lines: number;
  nonEmptyLines: number;
  paragraphs: number;
  codePoints: number;
  utf16Units: number;
  utf8Bytes: number;
}

const graphemeSegmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
    : null;

const HAN_RE = /^(?:\p{Unified_Ideograph}|\u3007)$/u;
const LATIN_LETTER_RE = /^(?=\p{Letter}$)\p{Script_Extensions=Latin}$/u;
const DIGIT_RE = /^\p{Decimal_Number}$/u;
const MARK_RE = /^\p{Mark}$/u;
const PUNCTUATION_RE = /^\p{Punctuation}$/u;
const WHITESPACE_RE = /^\p{White_Space}$/u;
const LINE_BREAK_RE = /\r\n?|\n/g;

export const supportsGraphemeSegmentation = graphemeSegmenter !== null;

function countGraphemes(value: string): number {
  if (!graphemeSegmenter) return Array.from(value).length;

  let count = 0;
  for (const _segment of graphemeSegmenter.segment(value)) count++;
  return count;
}

function countRuns(characters: string[], isMember: (character: string) => boolean): number {
  let count = 0;
  let inRun = false;

  for (let index = 0; index < characters.length; index++) {
    const character = characters[index]!;

    if (isMember(character)) {
      if (!inRun) count++;
      inRun = true;
    } else if (inRun && MARK_RE.test(character)) {
      continue;
    } else if (
      inRun &&
      (character === "'" || character === '’') &&
      isMember(characters[index + 1] ?? '')
    ) {
      continue;
    } else {
      inRun = false;
    }
  }

  return count;
}

export function analyzeText(value: string): TextStatistics {
  const characters = Array.from(value);
  let hanCharacters = 0;
  let latinLetters = 0;
  let digitCharacters = 0;
  let punctuationCharacters = 0;
  let whitespaceCharacters = 0;

  for (const character of characters) {
    if (HAN_RE.test(character)) hanCharacters++;
    if (LATIN_LETTER_RE.test(character)) latinLetters++;
    if (DIGIT_RE.test(character)) digitCharacters++;
    if (PUNCTUATION_RE.test(character)) punctuationCharacters++;
    if (WHITESPACE_RE.test(character)) whitespaceCharacters++;
  }

  const normalizedLines = value.replace(/\r\n?/g, '\n').split('\n');
  const nonEmpty = normalizedLines.map((line) =>
    Array.from(line).some((character) => !WHITESPACE_RE.test(character))
  );
  let paragraphs = 0;

  for (let index = 0; index < nonEmpty.length; index++) {
    if (nonEmpty[index] && !nonEmpty[index - 1]) paragraphs++;
  }

  return {
    visibleCharacters: countGraphemes(value),
    charactersWithoutLineBreaks: countGraphemes(value.replace(LINE_BREAK_RE, '')),
    thesisCharacters: characters.length - whitespaceCharacters,
    thesisCharactersWithoutPunctuation:
      characters.length - whitespaceCharacters - punctuationCharacters,
    mixedWords:
      hanCharacters +
      countRuns(
        characters,
        (character) => LATIN_LETTER_RE.test(character) || DIGIT_RE.test(character)
      ),
    hanCharacters,
    latinLetters,
    latinWords: countRuns(characters, (character) => LATIN_LETTER_RE.test(character)),
    digitCharacters,
    punctuationCharacters,
    whitespaceCharacters,
    lines: value ? normalizedLines.length : 0,
    nonEmptyLines: value ? nonEmpty.filter(Boolean).length : 0,
    paragraphs: value ? paragraphs : 0,
    codePoints: characters.length,
    utf16Units: value.length,
    utf8Bytes: new TextEncoder().encode(value).length,
  };
}
