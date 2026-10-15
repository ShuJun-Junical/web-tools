/// <reference lib="webworker" />
import { buildDocx, type DocxBuildResult, type DocxIssue, type PagePreset } from './docx-build';
import { readFolderSource, readZipSource, type DocxFolderEntry } from './docx-source';

export type { DocxFolderEntry };

export type DocxWorkerJob =
  | { type: 'zip'; page: PagePreset; archive: File }
  | { type: 'folder'; page: PagePreset; files: DocxFolderEntry[] };

export type DocxWorkerRequest = DocxWorkerJob & { id: number };

export interface DocxWorkerSuccess extends Omit<DocxBuildResult, 'bytes'> {
  bytes: ArrayBuffer;
  entry: string;
  issues: DocxIssue[];
}

export type DocxWorkerResponse =
  | { id: number; type: 'progress'; stage: string }
  | { id: number; type: 'result'; result: DocxWorkerSuccess }
  | { id: number; type: 'error'; message: string };

function post(message: DocxWorkerResponse) {
  self.postMessage(message);
}

/**
 * 读压缩包字节。拖进来的目录和浏览器没给读取权限的文件都会在这里失败，
 * 系统抛的是 ENOENT 之类的原始文案，对用户没有指导意义，换成能照做的提示。
 */
async function readArchiveBytes(archive: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await archive.arrayBuffer());
  } catch {
    throw new Error('读不到这个文件的内容。请改用「选择 zip」或「选择文件夹」按钮重新选一次。');
  }
}

async function handle(request: DocxWorkerRequest) {
  const { id, page } = request;
  try {
    post({ id, type: 'progress', stage: request.type === 'zip' ? '解压压缩包' : '读取文件夹' });

    const source =
      request.type === 'zip'
        ? readZipSource(await readArchiveBytes(request.archive))
        : await readFolderSource(request.files);

    const result = await buildDocx(source, { page }, (stage) =>
      post({ id, type: 'progress', stage })
    );

    post({
      id,
      type: 'result',
      result: { ...result, entry: source.entry },
    });
  } catch (error) {
    post({ id, type: 'error', message: error instanceof Error ? error.message : '转换失败。' });
  }
}

self.addEventListener('message', (event: MessageEvent<DocxWorkerRequest>) => {
  void handle(event.data);
});
