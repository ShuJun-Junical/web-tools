// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import Base64Page from '@/pages/codec/Base64Page.vue';

describe('Base64 页面', () => {
  it('随原文输入更新编码，并对无效编码保留原文', async () => {
    const wrapper = mount(Base64Page, {
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
