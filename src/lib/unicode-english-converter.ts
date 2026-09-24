/**
 * Unicode English Style Converter
 *
 * 仅使用 JavaScript / TypeScript 标准能力：
 * - 不依赖 DOM
 * - 不依赖外部库
 * - 不调用任何网络或系统 API
 * - 仅支持 ESM
 *
 * 支持转换：
 * - 大写英文字母 A-Z
 * - 小写英文字母 a-z
 * - 部分样式支持数字 0-9
 *
 * 没有独立数字变体的样式，默认保留普通数字。
 *
 * --------------------------------------------------------------------------
 * 支持的字体样式
 * --------------------------------------------------------------------------
 *
 * 调用方式：
 *
 *   convertUnicodeStyle("Professional 2026", "bold");
 *
 * 其中第二个参数就是下表中的 id。
 *
 *  1. id: "normal"
 *     名称：普通 ASCII
 *     示例：Professional 2026
 *     数字：支持
 *
 *  2. id: "bold"
 *     名称：数学粗体
 *     示例：𝐏𝐫𝐨𝐟𝐞𝐬𝐬𝐢𝐨𝐧𝐚𝐥 𝟐𝟎𝟐𝟔
 *     数字：支持
 *
 *  3. id: "italic"
 *     名称：数学斜体
 *     示例：𝑃𝑟𝑜𝑓𝑒𝑠𝑠𝑖𝑜𝑛𝑎𝑙 2026
 *     数字：不支持，默认保留普通数字
 *
 *  4. id: "boldItalic"
 *     名称：数学粗斜体
 *     示例：𝑷𝒓𝒐𝒇𝒆𝒔𝒔𝒊𝒐𝒏𝒂𝒍 2026
 *     数字：不支持，默认保留普通数字
 *
 *  5. id: "script"
 *     名称：数学花体
 *     示例：𝒫𝓇ℴ𝒻ℯ𝓈𝓈𝒾ℴ𝓃𝒶𝓁 2026
 *     数字：不支持，默认保留普通数字
 *
 *  6. id: "boldScript"
 *     名称：数学粗花体
 *     示例：𝓟𝓻𝓸𝓯𝓮𝓼𝓼𝓲𝓸𝓷𝓪𝓵 2026
 *     数字：不支持，默认保留普通数字
 *
 *  7. id: "fraktur"
 *     名称：数学哥特体
 *     示例：𝔓𝔯𝔬𝔣𝔢𝔰𝔰𝔦𝔬𝔫𝔞𝔩 2026
 *     数字：不支持，默认保留普通数字
 *
 *  8. id: "doubleStruck"
 *     名称：数学双线体
 *     示例：ℙ𝕣𝕠𝕗𝕖𝕤𝕤𝕚𝕠𝕟𝕒𝕝 𝟚𝟘𝟚𝟞
 *     数字：支持
 *
 *  9. id: "boldFraktur"
 *     名称：数学粗哥特体
 *     示例：𝕻𝖗𝖔𝖋𝖊𝖘𝖘𝖎𝖔𝖓𝖆𝖑 2026
 *     数字：不支持，默认保留普通数字
 *
 * 10. id: "sansSerif"
 *     名称：数学无衬线体
 *     示例：𝖯𝗋𝗈𝖿𝖾𝗌𝗌𝗂𝗈𝗇𝖺𝗅 𝟤𝟢𝟤𝟨
 *     数字：支持
 *
 * 11. id: "sansSerifBold"
 *     名称：数学无衬线粗体
 *     示例：𝗣𝗿𝗼𝗳𝗲𝘀𝘀𝗶𝗼𝗻𝗮𝗹 𝟮𝟬𝟮𝟲
 *     数字：支持
 *
 * 12. id: "sansSerifItalic"
 *     名称：数学无衬线斜体
 *     示例：𝘗𝘳𝘰𝘧𝘦𝘴𝘴𝘪𝘰𝘯𝘢𝘭 2026
 *     数字：不支持，默认保留普通数字
 *
 * 13. id: "sansSerifBoldItalic"
 *     名称：数学无衬线粗斜体
 *     示例：𝙋𝙧𝙤𝙛𝙚𝙨𝙨𝙞𝙤𝙣𝙖𝙡 2026
 *     数字：不支持，默认保留普通数字
 *
 * 14. id: "monospace"
 *     名称：数学等宽体
 *     示例：𝙿𝚛𝚘𝚏𝚎𝚜𝚜𝚒𝚘𝚗𝚊𝚕 𝟸𝟶𝟸𝟼
 *     数字：支持
 *
 * 15. id: "fullwidth"
 *     名称：全角字符
 *     示例：Ｐｒｏｆｅｓｓｉｏｎａｌ　２０２６
 *     数字：支持
 *     备注：通过 fullwidthSpace 选项控制是否转换空格
 *
 * 16. id: "circled"
 *     名称：带圈字符
 *     示例：Ⓟⓡⓞⓕⓔⓢⓢⓘⓞⓝⓐⓛ ②⓪②⑥
 *     数字：支持
 *
 * 17. id: "parenthesized"
 *     名称：括号字符
 *     示例：🄟⒭⒪⒡⒠⒮⒮⒤⒪⒩⒜⒧ 2026
 *     数字：不支持，默认保留普通数字
 *
 * --------------------------------------------------------------------------
 * 使用示例
 * --------------------------------------------------------------------------
 *
 * import {
 *   convertUnicodeStyle,
 *   convertToAllStyles,
 *   normalizeUnicodeStyle,
 *   listUnicodeStyles,
 * } from "./unicode-english-converter.js";
 *
 * const result = convertUnicodeStyle(
 *   "Professional 2026",
 *   "bold",
 * );
 *
 * console.log(result);
 * // 𝐏𝐫𝐨𝐟𝐞𝐬𝐬𝐢𝐨𝐧𝐚𝐥 𝟐𝟎𝟐𝟔
 */

const ASCII_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ASCII_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const ASCII_DIGITS = '0123456789';

export const UNICODE_STYLE_IDS = [
  'normal',
  'bold',
  'italic',
  'boldItalic',
  'script',
  'boldScript',
  'fraktur',
  'doubleStruck',
  'boldFraktur',
  'sansSerif',
  'sansSerifBold',
  'sansSerifItalic',
  'sansSerifBoldItalic',
  'monospace',
  'fullwidth',
  'circled',
  'parenthesized',
] as const;

export type UnicodeStyleId = (typeof UNICODE_STYLE_IDS)[number];

export type UnsupportedDigitBehavior = 'preserve' | 'remove' | 'error';

export interface ConvertUnicodeStyleOptions {
  /**
   * 当目标样式没有独立数字字符时的处理方式。
   *
   * - preserve：保留普通数字
   * - remove：删除数字
   * - error：抛出错误
   *
   * @default "preserve"
   */
  unsupportedDigits?: UnsupportedDigitBehavior;

  /**
   * 当使用 fullwidth 样式时，是否把普通空格转换成全角空格 U+3000。
   *
   * @default false
   */
  fullwidthSpace?: boolean;
}

export interface UnicodeStyleDefinition {
  readonly id: UnicodeStyleId;
  readonly name: string;
  readonly upper: readonly string[];
  readonly lower: readonly string[];
  readonly digits: readonly string[] | null;
}

export interface UnicodeStyleInfo {
  readonly id: UnicodeStyleId;
  readonly name: string;
  readonly supportsUppercase: true;
  readonly supportsLowercase: true;
  readonly supportsDigits: boolean;
  readonly example: string;
}

/**
 * 根据起始码点生成连续字符序列。
 */
function unicodeRange(startCodePoint: number, length: number): string[] {
  return Array.from({ length }, (_, index) => String.fromCodePoint(startCodePoint + index));
}

/**
 * 将字符串拆分成 Unicode 码点数组。
 */
function toCodePointArray(value: string): string[] {
  return Array.from(value);
}

/**
 * 某些数学字母在 Mathematical Alphanumeric Symbols 区块中保留了空位，
 * 实际字符复用了 Letterlike Symbols 中更早存在的编码。
 */
const MATHEMATICAL_EXCEPTIONS = {
  italic: {
    lower: {
      h: 'ℎ',
    },
  },

  script: {
    upper: {
      B: 'ℬ',
      E: 'ℰ',
      F: 'ℱ',
      H: 'ℋ',
      I: 'ℐ',
      L: 'ℒ',
      M: 'ℳ',
      R: 'ℛ',
    },

    lower: {
      e: 'ℯ',
      g: 'ℊ',
      o: 'ℴ',
    },
  },

  fraktur: {
    upper: {
      C: 'ℭ',
      H: 'ℌ',
      I: 'ℑ',
      R: 'ℜ',
      Z: 'ℨ',
    },
  },

  doubleStruck: {
    upper: {
      C: 'ℂ',
      H: 'ℍ',
      N: 'ℕ',
      P: 'ℙ',
      Q: 'ℚ',
      R: 'ℝ',
      Z: 'ℤ',
    },
  },
} as const;

interface CreateMathematicalStyleOptions {
  upperStart: number;
  lowerStart: number;
  digitStart?: number;
  upperExceptions?: Readonly<Record<string, string>>;
  lowerExceptions?: Readonly<Record<string, string>>;
}

interface CharacterSets {
  readonly upper: readonly string[];
  readonly lower: readonly string[];
  readonly digits: readonly string[] | null;
}

/**
 * 创建一套数学字母样式。
 */
function createMathematicalStyle(options: CreateMathematicalStyleOptions): CharacterSets {
  const upper = unicodeRange(options.upperStart, 26);
  const lower = unicodeRange(options.lowerStart, 26);

  for (const [asciiCharacter, replacement] of Object.entries(options.upperExceptions ?? {})) {
    const index = asciiCharacter.charCodeAt(0) - 65;

    if (index >= 0 && index < 26) {
      upper[index] = replacement;
    }
  }

  for (const [asciiCharacter, replacement] of Object.entries(options.lowerExceptions ?? {})) {
    const index = asciiCharacter.charCodeAt(0) - 97;

    if (index >= 0 && index < 26) {
      lower[index] = replacement;
    }
  }

  return Object.freeze({
    upper: Object.freeze(upper),
    lower: Object.freeze(lower),
    digits:
      options.digitStart === undefined ? null : Object.freeze(unicodeRange(options.digitStart, 10)),
  });
}

/**
 * 创建完整的样式定义。
 */
function defineStyle(
  id: UnicodeStyleId,
  name: string,
  characterSets: CharacterSets
): UnicodeStyleDefinition {
  return Object.freeze({
    id,
    name,
    upper: characterSets.upper,
    lower: characterSets.lower,
    digits: characterSets.digits,
  });
}

export const UNICODE_STYLES = Object.freeze({
  normal: defineStyle('normal', '普通 ASCII', {
    upper: Object.freeze(toCodePointArray(ASCII_UPPER)),
    lower: Object.freeze(toCodePointArray(ASCII_LOWER)),
    digits: Object.freeze(toCodePointArray(ASCII_DIGITS)),
  }),

  bold: defineStyle(
    'bold',
    '数学粗体',
    createMathematicalStyle({
      upperStart: 0x1d400,
      lowerStart: 0x1d41a,
      digitStart: 0x1d7ce,
    })
  ),

  italic: defineStyle(
    'italic',
    '数学斜体',
    createMathematicalStyle({
      upperStart: 0x1d434,
      lowerStart: 0x1d44e,
      lowerExceptions: MATHEMATICAL_EXCEPTIONS.italic.lower,
    })
  ),

  boldItalic: defineStyle(
    'boldItalic',
    '数学粗斜体',
    createMathematicalStyle({
      upperStart: 0x1d468,
      lowerStart: 0x1d482,
    })
  ),

  script: defineStyle(
    'script',
    '数学花体',
    createMathematicalStyle({
      upperStart: 0x1d49c,
      lowerStart: 0x1d4b6,
      upperExceptions: MATHEMATICAL_EXCEPTIONS.script.upper,
      lowerExceptions: MATHEMATICAL_EXCEPTIONS.script.lower,
    })
  ),

  boldScript: defineStyle(
    'boldScript',
    '数学粗花体',
    createMathematicalStyle({
      upperStart: 0x1d4d0,
      lowerStart: 0x1d4ea,
    })
  ),

  fraktur: defineStyle(
    'fraktur',
    '数学哥特体',
    createMathematicalStyle({
      upperStart: 0x1d504,
      lowerStart: 0x1d51e,
      upperExceptions: MATHEMATICAL_EXCEPTIONS.fraktur.upper,
    })
  ),

  doubleStruck: defineStyle(
    'doubleStruck',
    '数学双线体',
    createMathematicalStyle({
      upperStart: 0x1d538,
      lowerStart: 0x1d552,
      digitStart: 0x1d7d8,
      upperExceptions: MATHEMATICAL_EXCEPTIONS.doubleStruck.upper,
    })
  ),

  boldFraktur: defineStyle(
    'boldFraktur',
    '数学粗哥特体',
    createMathematicalStyle({
      upperStart: 0x1d56c,
      lowerStart: 0x1d586,
    })
  ),

  sansSerif: defineStyle(
    'sansSerif',
    '数学无衬线体',
    createMathematicalStyle({
      upperStart: 0x1d5a0,
      lowerStart: 0x1d5ba,
      digitStart: 0x1d7e2,
    })
  ),

  sansSerifBold: defineStyle(
    'sansSerifBold',
    '数学无衬线粗体',
    createMathematicalStyle({
      upperStart: 0x1d5d4,
      lowerStart: 0x1d5ee,
      digitStart: 0x1d7ec,
    })
  ),

  sansSerifItalic: defineStyle(
    'sansSerifItalic',
    '数学无衬线斜体',
    createMathematicalStyle({
      upperStart: 0x1d608,
      lowerStart: 0x1d622,
    })
  ),

  sansSerifBoldItalic: defineStyle(
    'sansSerifBoldItalic',
    '数学无衬线粗斜体',
    createMathematicalStyle({
      upperStart: 0x1d63c,
      lowerStart: 0x1d656,
    })
  ),

  monospace: defineStyle(
    'monospace',
    '数学等宽体',
    createMathematicalStyle({
      upperStart: 0x1d670,
      lowerStart: 0x1d68a,
      digitStart: 0x1d7f6,
    })
  ),

  fullwidth: defineStyle('fullwidth', '全角字符', {
    upper: Object.freeze(unicodeRange(0xff21, 26)),
    lower: Object.freeze(unicodeRange(0xff41, 26)),
    digits: Object.freeze(unicodeRange(0xff10, 10)),
  }),

  circled: defineStyle('circled', '带圈字符', {
    upper: Object.freeze(unicodeRange(0x24b6, 26)),
    lower: Object.freeze(unicodeRange(0x24d0, 26)),

    /**
     * 带圈数字不是按 0-9 连续排列：
     *
     * - ⓪：U+24EA
     * - ①-⑨：U+2460-U+2468
     */
    digits: Object.freeze(['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']),
  }),

  parenthesized: defineStyle('parenthesized', '括号字符', {
    /**
     * 括号大写字母：
     * U+1F110-U+1F129
     *
     * 例如：
     * 🄐 🄑 🄒 ... 🄩
     */
    upper: Object.freeze(unicodeRange(0x1f110, 26)),

    /**
     * 括号小写字母：
     * U+249C-U+24B5
     *
     * 例如：
     * ⒜ ⒝ ⒞ ... ⒵
     */
    lower: Object.freeze(unicodeRange(0x249c, 26)),

    digits: null,
  }),
} satisfies Readonly<Record<UnicodeStyleId, UnicodeStyleDefinition>>);

/**
 * 判断一个字符串是否是有效的样式 id。
 */
export function isUnicodeStyleId(value: string): value is UnicodeStyleId {
  return Object.prototype.hasOwnProperty.call(UNICODE_STYLES, value);
}

/**
 * 将普通 ASCII 英文字母和数字转换为指定 Unicode 样式。
 *
 * 不属于以下范围的字符会原样保留：
 *
 * - A-Z
 * - a-z
 * - 0-9
 * - fullwidth 模式下可选的普通空格
 *
 * @example
 * convertUnicodeStyle("Professional 2026", "bold");
 * // "𝐏𝐫𝐨𝐟𝐞𝐬𝐬𝐢𝐨𝐧𝐚𝐥 𝟐𝟎𝟐𝟔"
 *
 * @example
 * convertUnicodeStyle("Professional 2026", "script");
 * // "𝒫𝓇ℴ𝒻ℯ𝓈𝓈𝒾ℴ𝓃𝒶𝓁 2026"
 *
 * @example
 * convertUnicodeStyle(
 *   "Professional 2026",
 *   "fullwidth",
 *   { fullwidthSpace: true },
 * );
 * // "Ｐｒｏｆｅｓｓｉｏｎａｌ　２０２６"
 */
export function convertUnicodeStyle(
  input: string,
  styleId: UnicodeStyleId,
  options: ConvertUnicodeStyleOptions = {}
): string {
  if (typeof input !== 'string') {
    throw new TypeError('input 必须是字符串');
  }

  const style = UNICODE_STYLES[styleId];

  if (!style) {
    throw new RangeError(`未知的 Unicode 样式：${styleId}`);
  }

  const { unsupportedDigits = 'preserve', fullwidthSpace = false } = options;

  if (
    unsupportedDigits !== 'preserve' &&
    unsupportedDigits !== 'remove' &&
    unsupportedDigits !== 'error'
  ) {
    throw new RangeError('unsupportedDigits 必须是 "preserve"、"remove" 或 "error"');
  }

  let output = '';

  for (const character of input) {
    const codePoint = character.codePointAt(0);

    if (codePoint === undefined) {
      continue;
    }

    if (codePoint >= 0x41 && codePoint <= 0x5a) {
      output += style.upper[codePoint - 0x41];
      continue;
    }

    if (codePoint >= 0x61 && codePoint <= 0x7a) {
      output += style.lower[codePoint - 0x61];
      continue;
    }

    if (codePoint >= 0x30 && codePoint <= 0x39) {
      const digitIndex = codePoint - 0x30;

      if (style.digits) {
        output += style.digits[digitIndex];
        continue;
      }

      switch (unsupportedDigits) {
        case 'preserve':
          output += character;
          break;

        case 'remove':
          break;

        case 'error':
          throw new Error(`样式 "${styleId}" 没有独立的 Unicode 数字字符`);
      }

      continue;
    }

    if (character === ' ' && styleId === 'fullwidth' && fullwidthSpace) {
      output += '\u3000';
      continue;
    }

    output += character;
  }

  return output;
}

/**
 * 把输入文本转换成所有受支持的样式。
 *
 * 返回值的键就是 UnicodeStyleId。
 *
 * @example
 * const variants = convertToAllStyles("Professional 2026");
 *
 * console.log(variants.bold);
 * console.log(variants.script);
 * console.log(variants.fullwidth);
 */
export function convertToAllStyles(
  input: string,
  options: ConvertUnicodeStyleOptions = {}
): Record<UnicodeStyleId, string> {
  return Object.fromEntries(
    UNICODE_STYLE_IDS.map((styleId) => [styleId, convertUnicodeStyle(input, styleId, options)])
  ) as Record<UnicodeStyleId, string>;
}

/**
 * 生成所有受支持字符到普通 ASCII 的反向映射。
 */
const REVERSE_CHARACTER_MAP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();

  for (const styleId of UNICODE_STYLE_IDS) {
    const style = UNICODE_STYLES[styleId];

    style.upper.forEach((character, index) => {
      map.set(character, ASCII_UPPER[index]);
    });

    style.lower.forEach((character, index) => {
      map.set(character, ASCII_LOWER[index]);
    });

    style.digits?.forEach((character, index) => {
      map.set(character, ASCII_DIGITS[index]);
    });
  }

  map.set('\u3000', ' ');

  return map;
})();

/**
 * 将本模块支持的 Unicode 样式字符还原为普通 ASCII。
 *
 * 未识别的字符会原样保留。
 *
 * @example
 * normalizeUnicodeStyle(
 *   "𝓟𝓻𝓸𝓯𝓮𝓼𝓼𝓲𝓸𝓷𝓪𝓵 2026",
 * );
 * // "Professional 2026"
 *
 * @example
 * normalizeUnicodeStyle(
 *   "Ⓟⓡⓞⓕⓔⓢⓢⓘⓞⓝⓐⓛ ②⓪②⑥",
 * );
 * // "Professional 2026"
 */
export function normalizeUnicodeStyle(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('input 必须是字符串');
  }

  let output = '';

  for (const character of input) {
    output += REVERSE_CHARACTER_MAP.get(character) ?? character;
  }

  return output;
}

/**
 * 返回所有样式的基础信息、调用 id 和示例。
 */
export function listUnicodeStyles(): UnicodeStyleInfo[] {
  return UNICODE_STYLE_IDS.map((styleId) => {
    const style = UNICODE_STYLES[styleId];

    return {
      id: styleId,
      name: style.name,
      supportsUppercase: true,
      supportsLowercase: true,
      supportsDigits: style.digits !== null,
      example: convertUnicodeStyle('Professional 2026', styleId, {
        fullwidthSpace: styleId === 'fullwidth',
      }),
    };
  });
}

/**
 * 默认导出对象。
 *
 * @example
 * import UnicodeEnglishConverter from "./unicode-english-converter.js";
 *
 * UnicodeEnglishConverter.convert(
 *   "Professional 2026",
 *   "bold",
 * );
 */
const UnicodeEnglishConverter = Object.freeze({
  styleIds: UNICODE_STYLE_IDS,
  styles: UNICODE_STYLES,
  isStyleId: isUnicodeStyleId,
  convert: convertUnicodeStyle,
  convertAll: convertToAllStyles,
  normalize: normalizeUnicodeStyle,
  listStyles: listUnicodeStyles,
});

export default UnicodeEnglishConverter;
