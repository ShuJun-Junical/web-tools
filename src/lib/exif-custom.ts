export interface CustomTag {
  group: string;
  identifier: string;
  dataType: string;
  namespaceUri?: string;
}

const exifTypes = new Set(['string', 'int8u', 'int8s', 'int16u', 'int16s', 'int32u', 'int32s', 'rational64u', 'rational64s', 'undef']);
const xmpTypes = new Set(['string', 'integer', 'real', 'rational', 'date', 'boolean', 'lang-alt']);
const tagNamePattern = /^[A-Za-z][A-Za-z0-9_]*$/;
// 允许常规 URI 字符；单引号与反斜杠会破坏 ExifTool 配置里 Perl 单引号字符串的边界，必须排除。
const namespaceUriPattern = /^(https?:\/\/|urn:)[A-Za-z0-9._~:/?#@!$&()*+,;=%[\]-]+$/;

export const tagGroups = ['IFD0', 'ExifIFD', 'GPS', 'IPTC', 'PNG', 'XMP'] as const;

export function isExifStyleGroup(group: string) {
  return group === 'IFD0' || group === 'ExifIFD' || group === 'GPS' || group === 'IPTC';
}

export function dataTypesForGroup(group: string): string[] {
  if (group === 'IFD0' || group === 'ExifIFD' || group === 'GPS') return [...exifTypes];
  if (group.startsWith('XMP')) return [...xmpTypes];
  return ['string'];
}

function name(value: string, label: string) {
  if (!tagNamePattern.test(value)) throw new Error(`${label}只允许英文字母、数字和下划线，且必须以字母开头。`);
  return value;
}

function numericId(value: string, max: number) {
  const id = /^0x[0-9a-f]+$/i.test(value) ? Number.parseInt(value.slice(2), 16) : Number(value);
  if (!Number.isInteger(id) || id < 0 || id > max) throw new Error(`此层级的字段标识须为 0 至 ${max} 的数字或 0x 十六进制编号。`);
  return id;
}

export function customTagConfig(tag: CustomTag) {
  const group = tag.group.trim();
  const dataType = tag.dataType.trim();
  const identifier = tag.identifier.trim();

  if (group === 'IFD0' || group === 'ExifIFD' || group === 'GPS') {
    if (!exifTypes.has(dataType)) throw new Error('EXIF 自定义字段类型不受支持。');
    const id = numericId(identifier, 65535);
    const tagName = `Custom${id.toString(16).toUpperCase()}`;
    const table = group === 'GPS' ? 'Image::ExifTool::GPS::Main' : 'Image::ExifTool::Exif::Main';
    const writeGroup = group === 'GPS' ? '' : `, WriteGroup => '${group}'`;
    return {
      tag: `${group}:${tagName}`,
      config: `%Image::ExifTool::UserDefined = ( '${table}' => { ${id} => { Name => '${tagName}', Writable => '${dataType}'${writeGroup} } } );\n1;\n`,
    };
  }

  if (group === 'IPTC') {
    if (dataType !== 'string') throw new Error('IPTC 自定义字段当前使用 string 类型。');
    const id = numericId(identifier, 255);
    const tagName = `Custom${id}`;
    return {
      tag: `IPTC:${tagName}`,
      config: `%Image::ExifTool::UserDefined = ( 'Image::ExifTool::IPTC::ApplicationRecord' => { ${id} => { Name => '${tagName}', Format => 'string[0,65535]' } } );\n1;\n`,
    };
  }

  if (group === 'PNG') {
    if (dataType !== 'string') throw new Error('PNG 文本字段当前使用 string 类型。');
    const tagName = name(identifier, '字段标识');
    return {
      tag: `PNG:${tagName}`,
      config: `%Image::ExifTool::UserDefined = ( 'Image::ExifTool::PNG::TextualData' => { ${tagName} => { iTXt => 1 } } );\n1;\n`,
    };
  }

  if (group.startsWith('XMP-')) {
    const prefix = name(group.slice(4), 'XMP 命名空间前缀');
    const tagName = name(identifier, '字段标识');
    if (!xmpTypes.has(dataType)) throw new Error('XMP 自定义字段类型不受支持。');
    if (tag.namespaceUri) {
      const uri = tag.namespaceUri.trim();
      if (!namespaceUriPattern.test(uri)) throw new Error('XMP 命名空间 URI 无效：须以 http(s):// 或 urn: 开头，且不含引号、反斜杠或空白。');
      return {
        tag: `${group}:${tagName}`,
        config: `%Image::ExifTool::UserDefined = ( 'Image::ExifTool::XMP::Main' => { ${prefix} => { SubDirectory => { TagTable => 'Image::ExifTool::UserDefined::Custom' } } } );\n%Image::ExifTool::UserDefined::Custom = ( GROUPS => { 0 => 'XMP', 1 => '${group}', 2 => 'Image' }, NAMESPACE => { '${prefix}' => '${uri}' }, WRITABLE => '${dataType}', ${tagName} => {} );\n1;\n`,
      };
    }
    return {
      tag: `${group}:${tagName}`,
      config: `%Image::ExifTool::UserDefined = ( 'Image::ExifTool::XMP::${prefix}' => { ${tagName} => { Writable => '${dataType}' } } );\n1;\n`,
    };
  }

  throw new Error('此层级无法定义字段；请选择 EXIF、IPTC、PNG、XMP 层级，或使用原始块编辑。');
}

/** 就地校验用：返回错误信息，空字符串表示通过。IFD0/ExifIFD/GPS/IPTC 的英文标识按内置字段直写处理。 */
export function fieldValidationError(group: string, identifier: string, dataType: string, namespaceUri = ''): string {
  const trimmedIdentifier = identifier.trim();
  if (!group) return '请选择字段层级。';
  if (!trimmedIdentifier) return '请填写字段标识。';
  const numeric = /^(\d+|0x[0-9a-f]+)$/i.test(trimmedIdentifier);
  if (isExifStyleGroup(group) && !numeric && tagNamePattern.test(trimmedIdentifier)) {
    return dataTypesForGroup(group).includes(dataType.trim()) ? '' : '此层级不支持该字段类型。';
  }
  try {
    customTagConfig({ group, identifier, dataType, namespaceUri: namespaceUri.trim() || undefined });
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
