import { describe, expect, it } from 'vitest';
import { orientationFromDump } from '@/lib/exif-orientation';

describe('方向解析', () => {
  it('仅接受主 EXIF IFD0 的 1–8 值', () => {
    expect(orientationFromDump('[{"IFD0:Orientation":6}]')).toBe(6);
    expect(orientationFromDump('[{"XMP-tiff:Orientation":6}]')).toBeUndefined();
    expect(orientationFromDump('[{"IFD0:Orientation":"8"}]')).toBe(8);
    expect(orientationFromDump('[{"IFD0:Orientation":9}]')).toBeUndefined();
    expect(orientationFromDump('[{"IFD0:Orientation":1.5}]')).toBeUndefined();
    expect(orientationFromDump('[]')).toBeUndefined();
    expect(orientationFromDump('[{}]')).toBeUndefined();
  });
});
