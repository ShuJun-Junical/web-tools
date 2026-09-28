// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import IndependencePage from '@/pages/statistic/IndependencePage.vue';

const stubs = {
  ToolPage: { template: '<div><slot /></div>' },
  Card: { template: '<section><slot /></section>' },
  CardHeader: { template: '<header><slot /></header>' },
  CardTitle: { template: '<h2><slot /></h2>' },
  CardDescription: { template: '<p><slot /></p>' },
  CardContent: { template: '<div><slot /></div>' },
  Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
  Input: {
    props: ['modelValue'],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
};

function setInputValue(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function inputAtPosition(wrapper: ReturnType<typeof mount>, index: number) {
  return wrapper.findAll('input')[index].element as HTMLInputElement;
}

describe('Independence 页面', () => {
  it('清空核心分项 a 后输入框保持为空', async () => {
    const wrapper = mount(IndependencePage, { global: { stubs } });

    const a = inputAtPosition(wrapper, 0);
    const ab = inputAtPosition(wrapper, 2);
    setInputValue(a, '5');
    setInputValue(ab, '5');
    await wrapper.vm.$nextTick();

    setInputValue(a, '');
    await wrapper.vm.$nextTick();

    expect(a.value).toBe('');
  });

  it('合计 ab 在分项已知时显示自动解出的值', async () => {
    const wrapper = mount(IndependencePage, { global: { stubs } });

    const a = inputAtPosition(wrapper, 0);
    const b = inputAtPosition(wrapper, 1);
    setInputValue(a, '3');
    setInputValue(b, '2');
    await wrapper.vm.$nextTick();

    const ab = inputAtPosition(wrapper, 2);
    expect(ab.value).toBe('5');
  });
});
