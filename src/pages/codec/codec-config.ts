import {
  decodeBase64,
  decodePunycode,
  decodeUrl,
  encodeBase64,
  encodePunycode,
  encodeUrl,
  looksLikeBase64,
  looksLikePunycode,
  looksLikeUrlEncoding,
} from '@/lib/codecs';
import type { CodecPairOptions } from '@/composables/useCodecPair';

export type CodecId = 'base64' | 'url' | 'punycode';

export interface CodecSpec {
  id: CodecId;
  label: string;
  originalLabel: string;
  encodedLabel: string;
  originalPlaceholder: string;
  encodedPlaceholder: string;
  options: CodecPairOptions;
}

export const codecSpecs: CodecSpec[] = [
  {
    id: 'base64',
    label: 'Base64 文本',
    originalLabel: '原文（UTF-8）',
    encodedLabel: 'Base64',
    originalPlaceholder: '输入或粘贴原文',
    encodedPlaceholder: '输入或粘贴 Base64',
    options: {
      encode: encodeBase64,
      decode: decodeBase64,
      looksLike: looksLikeBase64,
      errorMessage: '这不是有效的 UTF-8 Base64 字符串。',
      copyLabels: {
        fromEncoded: '检测到有效的 Base64，已复制原文。',
        fromOriginal: '检测到文本，已转为 Base64。',
      },
    },
  },
  {
    id: 'url',
    label: 'URL 编解码',
    originalLabel: '原文',
    encodedLabel: 'URL 编码',
    originalPlaceholder: '输入或粘贴原文',
    encodedPlaceholder: '输入或粘贴 URL 编码',
    options: {
      encode: encodeUrl,
      decode: decodeUrl,
      looksLike: looksLikeUrlEncoding,
      errorMessage: '这不是有效的 URL 编码字符串。',
      copyLabels: {
        fromEncoded: '检测到有效的 URL 编码，已复制原文。',
        fromOriginal: '检测到文本，已转为 URL 编码。',
      },
    },
  },
  {
    id: 'punycode',
    label: 'Punycode 编解码',
    originalLabel: 'Unicode 域名',
    encodedLabel: 'Punycode',
    originalPlaceholder: '输入或粘贴 Unicode 域名',
    encodedPlaceholder: '输入或粘贴 Punycode',
    options: {
      encode: encodePunycode,
      decode: decodePunycode,
      looksLike: looksLikePunycode,
      errorMessage: '这不是有效的 Punycode 字符串。',
      copyLabels: {
        fromEncoded: '检测到有效的 Punycode，已复制 Unicode 域名。',
        fromOriginal: '检测到 Unicode 域名，已转为 Punycode。',
      },
    },
  },
];

export const defaultCodecId: CodecId = 'base64';
