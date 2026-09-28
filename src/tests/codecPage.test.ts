// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CodecPage from '@/pages/codec/CodecPage.vue';

describe('编解码页面', () => {
  it('随原文输入更新编码，并对无效编码保留原文', async () => {
    const wrapper = mount(CodecPage, {
      global: {
        stubs: { ToolPage: { template: '<div><slot /></div>' } },
      },
    });
    const [original, encoded] = wrapper.findAll('textarea');

    await original.setValue('工具');
    expect((encoded.element as HTMLTextAreaElement).value).toBe('5bel5YW3');

    await encoded.setValue('%%%');
    expect((original.element as HTMLTextAreaElement).value).toBe('工具');
    expect(encoded.attributes('aria-invalid')).toBe('true');
  });
});
