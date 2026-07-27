import { describe, expect, it } from 'vitest'
import { analyzeText } from '@/lib/text-statistics'

describe('文本统计', () => {
  it('处理空文本', () => {
    expect(analyzeText('')).toEqual({
      visibleCharacters: 0,
      charactersWithoutLineBreaks: 0,
      thesisCharacters: 0,
      thesisCharactersWithoutPunctuation: 0,
      mixedWords: 0,
      hanCharacters: 0,
      latinLetters: 0,
      latinWords: 0,
      digitCharacters: 0,
      punctuationCharacters: 0,
      whitespaceCharacters: 0,
      lines: 0,
      nonEmptyLines: 0,
      paragraphs: 0,
      codePoints: 0,
      utf16Units: 0,
      utf8Bytes: 0,
    })
  })

  it('按论文、字符和编码口径统计中英混排文本', () => {
    expect(analyzeText('你好，OpenAI 2026！\n👨‍👩‍👧‍👦')).toEqual({
      visibleCharacters: 17,
      charactersWithoutLineBreaks: 16,
      thesisCharacters: 21,
      thesisCharactersWithoutPunctuation: 19,
      mixedWords: 4,
      hanCharacters: 2,
      latinLetters: 6,
      latinWords: 1,
      digitCharacters: 4,
      punctuationCharacters: 2,
      whitespaceCharacters: 2,
      lines: 2,
      nonEmptyLines: 2,
      paragraphs: 1,
      codePoints: 23,
      utf16Units: 27,
      utf8Bytes: 49,
    })
  })

  it('处理生僻汉字、组合字符、连字符和空白段落', () => {
    const result = analyzeText("〇𠀀 café e\u0301 don't state-of-the-art\n \nGPT4")

    expect(result.hanCharacters).toBe(2)
    expect(result.latinWords).toBe(8)
    expect(result.mixedWords).toBe(10)
    expect(result.latinLetters).toBe(25)
    expect(result.digitCharacters).toBe(1)
    expect(result.lines).toBe(3)
    expect(result.nonEmptyLines).toBe(2)
    expect(result.paragraphs).toBe(2)
  })
})
