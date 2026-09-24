// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import RulerPage from '@/pages/measure/RulerPage.vue';

const stubs = {
  ToolPage: { template: '<main><slot /></main>' },
  Card: { template: '<section><slot /></section>' },
  CardHeader: { template: '<header><slot /></header>' },
  CardTitle: { template: '<h2><slot /></h2>' },
  CardDescription: { template: '<p><slot /></p>' },
  CardContent: { template: '<div><slot /></div>' },
  Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
  Input: { template: '<input />' },
  RadioGroup: { template: '<div />' },
  Select: { template: '<div />' },
};

describe('RulerPage', () => {
  it('opens and exits the in-page immersive mode', async () => {
    const wrapper = mount(RulerPage, { global: { stubs } });

    await wrapper.get('button').trigger('click');
    expect(wrapper.text()).toContain('退出沉浸模式');

    const leftEdgeButton = wrapper.findAll('button').find((button) => button.text() === '靠左');
    await leftEdgeButton?.trigger('click');
    expect(wrapper.find('.ruler--vertical').exists()).toBe(true);
    expect(wrapper.text()).toContain('靠上');

    const exitButton = wrapper.findAll('button').find((button) => button.text() === '退出沉浸模式');
    await exitButton?.trigger('click');
    expect(wrapper.text()).toContain('沉浸模式');
  });
});
