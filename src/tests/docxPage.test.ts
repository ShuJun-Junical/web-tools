// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils';
import { isReactive } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MarkdownToDocxPage from '@/pages/document/MarkdownToDocxPage.vue';

const dialog = vi.hoisted(() => ({
  file: null as File | null,
  change: null as ((files: File[]) => void) | null,
  requests: [] as { id: number; type: string; page: string; files?: { path: string }[] }[],
}));

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useFileDialog: () => ({
    open: () => dialog.change?.(dialog.file ? [dialog.file] : []),
    onChange: (callback: (files: File[]) => void) => {
      dialog.change = callback;
    },
    reset: () => {},
  }),
}));

/** 由测试决定回什么，模拟 worker 的成功与失败两条路径。 */
let reply: (worker: FakeWorker, id: number) => void = () => {};

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage(message: { id: number; type: string; page: string; files?: { path: string }[] }) {
    dialog.requests.push(message);
    queueMicrotask(() => reply(this, message.id));
  }
  terminate() {}
}

/**
 * 伪造 DataTransfer 的目录条目。
 *
 * readEntries 每次最多返回一批、直到返回空数组才结束，这里用 batchSize 控制分批，
 * 用来验证递归确实会把超过一批的目录读完。
 */
function directoryEntry(name: string, children: unknown[], batchSize = 100): unknown {
  let cursor = 0;
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => ({
      readEntries(onBatch: (batch: unknown[]) => void) {
        onBatch(children.slice(cursor, cursor + batchSize));
        cursor += batchSize;
      },
    }),
  };
}

function fileEntry(name: string, file: File): unknown {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file(onFile: (value: File | null) => void) {
      onFile(file);
    },
  };
}

function dataTransferFor(entries: unknown[], files: File[] = []): unknown {
  return {
    items: entries.map((entry) => ({ kind: 'file', webkitGetAsEntry: () => entry })),
    files,
  };
}

const dropZoneSelector = '[role="button"][aria-label="选择或拖入 zip 压缩包或文件夹"]';

/** useDropZone 监听的是模板 ref，要等挂载后的 flush 阶段才真正绑上，触发拖放前先让出一轮。 */
async function mountForDrop() {
  vi.stubGlobal('Worker', FakeWorker);
  const wrapper = mountPage();
  await flushPromises();
  return wrapper;
}

function mountPage() {
  return mount(MarkdownToDocxPage, {
    global: { stubs: { ToolPage: { template: '<div><slot /></div>' } } },
  });
}

async function chooseZip(wrapper: ReturnType<typeof mountPage>) {
  dialog.file = new File([new Uint8Array([1, 2, 3])], 'docs.zip', { type: 'application/zip' });
  await wrapper.find(dropZoneSelector).trigger('click');
  await flushPromises();
}

const success =
  (imageCount = 2, issues: { ref: string; reason: string }[] = []) =>
  (worker: FakeWorker, id: number) =>
    worker.onmessage?.({
      data: {
        id,
        type: 'result',
        result: {
          bytes: new ArrayBuffer(8),
          entry: 'docs/guide.md',
          issues,
          imageCount,
          matchedByFileName: 0,
          title: '使用指南',
        },
      },
    } as MessageEvent);

describe('Markdown 转 Word 页面', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    dialog.requests.length = 0;
    reply = () => {};
  });

  it('选择 zip 后自动转换，成功时给出下载入口与图片数量', async () => {
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:docx');
        static revokeObjectURL = vi.fn();
      }
    );
    vi.stubGlobal('Worker', FakeWorker);
    reply = success();

    const wrapper = mountPage();
    await chooseZip(wrapper);

    expect(dialog.requests).toHaveLength(1);
    expect(dialog.requests[0]).toMatchObject({ type: 'zip', page: 'a4' });
    expect(wrapper.text()).toContain('docs.zip');
    expect(wrapper.text()).toContain('主文档 docs/guide.md');
    expect(wrapper.text()).toContain('已生成 使用指南.docx');
    expect(wrapper.text()).toContain('内嵌 2 张图片');

    const link = wrapper.find('a[download="使用指南.docx"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('blob:docx');
  });

  it('切换页面设置会按新纸张重新转换', async () => {
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:docx');
        static revokeObjectURL = vi.fn();
      }
    );
    vi.stubGlobal('Worker', FakeWorker);
    reply = success();

    const wrapper = mountPage();
    await chooseZip(wrapper);

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Letter')!
      .trigger('click');
    await flushPromises();

    expect(dialog.requests).toHaveLength(2);
    expect(dialog.requests[1].page).toBe('letter');
  });

  it('图片没能写入时逐条列出原因，而不是静默跳过', async () => {
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:docx');
        static revokeObjectURL = vi.fn();
      }
    );
    vi.stubGlobal('Worker', FakeWorker);
    reply = success(1, [{ ref: 'images/gone.png', reason: '压缩包或文件夹里没有这个文件。' }]);

    const wrapper = mountPage();
    await chooseZip(wrapper);

    const alert = wrapper.find('[role="alert"]');
    expect(alert.text()).toContain('1 张图片没能写入文档');
    expect(alert.text()).toContain('images/gone.png');
  });

  it('转换失败时展示 worker 返回的原因', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    reply = (worker, id) =>
      worker.onmessage?.({
        data: { id, type: 'error', message: '压缩包内没有 Markdown 文件。' },
      } as MessageEvent);

    const wrapper = mountPage();
    await chooseZip(wrapper);

    expect(wrapper.find('[role="alert"]').text()).toBe('压缩包内没有 Markdown 文件。');
    expect(wrapper.find('a[download]').exists()).toBe(false);
  });

  it('未选择来源时转换按钮不可用', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const wrapper = mountPage();

    const button = wrapper.findAll('button').find((b) => b.text() === '重新转换')!;
    expect(button.attributes('disabled')).toBeDefined();
  });
});

describe('拖拽来源', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    dialog.requests.length = 0;
    reply = () => {};
  });

  it('拖入文件夹时按目录结构读成文件夹来源，而不是当成 zip', async () => {
    reply = success(1);
    const md = new File(['# 指南\n\n![图](assets/a.png)\n'], 'guide.md');
    const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'a.png');

    const wrapper = await mountForDrop();
    await wrapper.find(dropZoneSelector).trigger('drop', {
      dataTransfer: dataTransferFor([
        directoryEntry('workspace', [
          fileEntry('guide.md', md),
          directoryEntry('assets', [fileEntry('a.png', png)]),
        ]),
      ]),
    });
    await flushPromises();

    expect(dialog.requests).toHaveLength(1);
    expect(dialog.requests[0]).toMatchObject({ type: 'folder', page: 'a4' });
    // 路径按 webkitdirectory 的口径拼，顶层目录名在最前。
    expect(dialog.requests[0].files?.map((item) => item.path)).toEqual([
      'workspace/guide.md',
      'workspace/assets/a.png',
    ]);
    // 载荷要原样 postMessage 给 worker，不能是 reactive Proxy，否则结构化克隆失败。
    expect(isReactive(dialog.requests[0].files)).toBe(false);
    expect(wrapper.text()).toContain('已选择：workspace');
  });

  it('目录条目分多批返回时会一直读到空批次为止', async () => {
    reply = success(1);
    const files = Array.from({ length: 5 }, (_, i) =>
      fileEntry(`note${i}.md`, new File([`# ${i}`], `note${i}.md`))
    );

    const wrapper = await mountForDrop();
    await wrapper.find(dropZoneSelector).trigger('drop', {
      dataTransfer: dataTransferFor([directoryEntry('docs', files, 2)]),
    });
    await flushPromises();

    expect(dialog.requests[0].files?.map((item) => item.path)).toEqual([
      'docs/note0.md',
      'docs/note1.md',
      'docs/note2.md',
      'docs/note3.md',
      'docs/note4.md',
    ]);
  });

  it('拖入 zip 文件仍按压缩包处理', async () => {
    reply = success();
    const zip = new File([new Uint8Array([1, 2, 3])], 'docs.zip', { type: 'application/zip' });

    const wrapper = await mountForDrop();
    await wrapper.find(dropZoneSelector).trigger('drop', {
      dataTransfer: dataTransferFor([fileEntry('docs.zip', zip)], [zip]),
    });
    await flushPromises();

    expect(dialog.requests[0]).toMatchObject({ type: 'zip', page: 'a4' });
    expect(wrapper.text()).toContain('已选择：docs.zip');
  });
});
