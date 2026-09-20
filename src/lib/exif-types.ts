import type { ImageBlock, ImageFormat } from './image-container';

export interface ExifField {
  key: string;
  group: string;
  name: string;
  value: string;
}

export interface ExifResult {
  file: File;
  fields: ExifField[];
  blocks: ImageBlock[];
  format: ImageFormat;
  animated: boolean;
  unsupportedMultiImage: boolean;
  imageUnchanged: boolean | null;
  signed: boolean;
  warning: string;
}

export type ExifOperation =
  | { type: 'clear'; mode: 'normal' | 'strong' }
  | { type: 'write'; tag: string; value?: string }
  | { type: 'add'; group: string; identifier: string; dataType: string; value: string; namespaceUri?: string }
  | { type: 'raw'; blockId: string; hex: string }
  | { type: 'addBlock'; kind: string; hex: string };

export type ExifAction =
  & (ExifOperation | { type: 'inspect' })
  & { file: File; original: File };
