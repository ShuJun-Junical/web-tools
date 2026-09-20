// jsdom 缺少 Reka UI 定位层依赖的 ResizeObserver；node 环境已有则不覆盖。
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
