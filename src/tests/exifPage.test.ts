// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExifPage from '@/pages/image/ExifPage.vue';
import type { ExifField, ExifResult } from '@/lib/exif-types';

const dialog = vi.hoisted(() => ({
  file: null as File | null,
  change: null as ((files: File[]) => void) | null,
  workerCalls: 0,
}));
vi.mock('@vueuse/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useFileDialog: () => ({
    open: () => dialog.change?.(dialog.file ? [dialog.file] : []),
    onChange: (callback: (files: File[]) => void) => { dialog.change = callback; },
    reset: () => {},
  }),
}));

const base: Omit<ExifResult, 'fields'> = {
  file: null as unknown as File,
  blocks: [], format: 'png', animated: false, unsupportedMultiImage: false,
  imageUnchanged: true, signed: false, warning: '',
};

describe('EXIF 工具页面', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('常用信息以中文名展示并可删除撤销，编辑在全部元数据表格内进行', async () => {
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:test-image');
      static revokeObjectURL = vi.fn();
    });
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(message: { id: number; action: { type: string; file: File; tag?: string; value?: string } }) {
        dialog.workerCalls++;
        const { id, action } = message;
        const fields: ExifField[] = [
          { key: 'PNG:Software', group: 'PNG', name: 'Software', value: 'Local editor' },
          { key: 'PNG:CameraNote', group: 'PNG', name: 'CameraNote', value: 'note-1' },
          { key: 'ExifIFD:WhiteBalance', group: 'ExifIFD', name: 'WhiteBalance', value: 'Auto' },
        ];
        let result: ExifResult = { ...base, file: action.file, fields };
        if (action.type === 'clear') result = { ...base, file: action.file, fields: [] };
        if (action.type === 'write') result = { ...base, file: action.file, fields: action.value === undefined
          ? fields.filter(field => field.key !== action.tag)
          : fields.map(field => field.key === action.tag ? { ...field, value: action.value! } : field) };
        queueMicrotask(() => this.onmessage?.({ data: { id, type: 'result', result } } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker);
    const wrapper = mount(ExifPage, {
      global: { stubs: { ToolPage: { template: '<div><slot /></div>' } } },
    });
    dialog.file = new File([new Uint8Array([1])], 'sample.png', { type: 'image/png' });
    await wrapper.findAll('button').find(button => button.text() === '选择图片')!.trigger('click');
    await flushPromises();

    // 常用信息展示中文名、值与圈问号；不提供编辑入口
    expect(wrapper.text()).toContain('处理软件');
    expect(wrapper.text()).toContain('Local editor');
    expect(wrapper.text()).not.toContain('修改 Software');
    const help = wrapper.findAll('button').find(button => button.attributes('aria-label') === '什么是「处理软件」');
    expect(help).toBeDefined();
    await help!.trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('生成或编辑过这张图片的软件名称与版本');

    const commonDelete = wrapper.findAll('button').find(button => button.text() === '删除')!;
    await commonDelete.trigger('click');
    await flushPromises();
    expect(wrapper.text()).not.toContain('处理软件');
    expect(wrapper.text()).toContain('字段：2 项');

    await wrapper.findAll('button').find(button => button.text().includes('撤销'))!.trigger('click');
    expect(wrapper.text()).toContain('处理软件');
    expect(wrapper.text()).toContain('字段：3 项');

    // 编辑位于“全部元数据”的紧凑表格中：展开 PNG 分组后修改 CameraNote
    await wrapper.findAll('button').find(button => button.text().startsWith('PNG（'))!.trigger('click');
    await wrapper.findAll('button').find(button => button.text().startsWith('ExifIFD（'))!.trigger('click');
    await flushPromises();
    // 详细信息行同样提供中文名与圈问号说明
    expect(wrapper.text()).toContain('白平衡');
    await wrapper.findAll('button').find(button => button.attributes('aria-label') === '什么是「白平衡」')!
      .trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('拍摄时的白平衡设置');
    await wrapper.findAll('button').find(button => button.text() === '编辑')!.trigger('click');
    await wrapper.find('[aria-label="修改 CameraNote"]').setValue('note-2');
    await wrapper.findAll('button').find(button => button.text() === '应用')!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('note-2');
    wrapper.unmount();
  });

  it('清理后按已消失来源筛选时自动回退到全部', async () => {
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:test-image');
      static revokeObjectURL = vi.fn();
    });
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(message: { id: number; action: { type: string; file: File } }) {
        const { id, action } = message;
        const result: ExifResult = action.type === 'inspect'
          ? { ...base, file: action.file, fields: [{ key: 'GPS:GPSLatitude', group: 'GPS', name: 'GPSLatitude', value: '30' }] }
          : { ...base, file: action.file, fields: [] };
        queueMicrotask(() => this.onmessage?.({ data: { id, type: 'result', result } } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker);
    const wrapper = mount(ExifPage, {
      global: { stubs: { ToolPage: { template: '<div><slot /></div>' } } },
    });
    dialog.file = new File([new Uint8Array([1])], 'sample.png', { type: 'image/png' });
    await wrapper.findAll('button').find(button => button.text() === '选择图片')!.trigger('click');
    await flushPromises();
    const vm = wrapper.vm as unknown as { groupFilter: string };
    vm.groupFilter = 'GPS';
    await flushPromises();
    expect(wrapper.text()).toContain('GPS（1）');
    await wrapper.findAll('button').find(button => button.text() === '强力清理')!.trigger('click');
    await flushPromises();
    expect(vm.groupFilter).toBe('all');
    wrapper.unmount();
  });
});
