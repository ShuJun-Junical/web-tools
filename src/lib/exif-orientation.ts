/** 本 wasm 版 ExifTool 中 `--Orientation` exact 查询不返回结果，只能用全量 dump 后取 IFD0 组值。 */
export const metadataDumpArgs = ['-j', '-G1', '-a', '-s', '-u', '-n'];

/** 浏览器只应用主 EXIF IFD0 的 Orientation；从 describe 的 JSON dump 中精确取该来源。 */
export function orientationFromDump(json: string): number | undefined {
  const entries = JSON.parse(json) as Record<string, unknown>[];
  const value = Number(entries[0]?.['IFD0:Orientation']);
  return Number.isInteger(value) && value >= 1 && value <= 8 ? value : undefined;
}
