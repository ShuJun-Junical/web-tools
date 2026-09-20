import { describe, expect, it } from 'vitest';
import { commonFieldNames, fieldInfoFor } from '@/lib/exif-presets';

describe('字段中文说明字典', () => {
  it('常用字段全部具备中文名和说明', () => {
    for (const name of commonFieldNames) {
      expect(fieldInfoFor(name)?.label, name).toBeTruthy();
      expect(fieldInfoFor(name)?.description, name).toBeTruthy();
    }
  });

  it('扩展字段提供说明，未知字段返回 undefined', () => {
    expect(fieldInfoFor('GPSLatitude')?.label).toBe('拍摄纬度');
    expect(fieldInfoFor('GPSLatitude')?.description).toContain('隐私');
    expect(fieldInfoFor('SomeMakerNoteTag')).toBeUndefined();
  });
});
