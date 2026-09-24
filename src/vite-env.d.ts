/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />

declare module '*.css';

declare module 'punycode/punycode.es6.js' {
  export function toASCII(input: string): string;
  export function toUnicode(input: string): string;
}
