export function calculatePpi(widthPixels: number, heightPixels: number, diagonalInches: number) {
  if (
    !Number.isFinite(widthPixels) ||
    !Number.isFinite(heightPixels) ||
    !Number.isFinite(diagonalInches) ||
    widthPixels <= 0 ||
    heightPixels <= 0 ||
    diagonalInches <= 0
  )
    return null;

  return Math.hypot(widthPixels, heightPixels) / diagonalInches;
}

export function cssPixelsPerMillimeter(ppi: number, devicePixelRatio: number) {
  if (
    !Number.isFinite(ppi) ||
    !Number.isFinite(devicePixelRatio) ||
    ppi <= 0 ||
    devicePixelRatio <= 0
  )
    return null;

  return ppi / 25.4 / devicePixelRatio;
}

/**
 * 浏览器把布局坐标对齐到固定的分数像素（Chromium、WebKit 为 1/64）。
 * 每段长度先对齐到同一精度，取整误差就不会沿尺子逐段累积。
 */
export function snapToLayoutPixels(pixels: number) {
  return Math.round(pixels * 64) / 64;
}

export function wholeMillimetersThatFit(
  availableCssPixels: number,
  cssPixelsPerMillimeter: number,
  maximumMillimeters: number
) {
  if (
    !Number.isFinite(availableCssPixels) ||
    !Number.isFinite(cssPixelsPerMillimeter) ||
    !Number.isFinite(maximumMillimeters) ||
    availableCssPixels < 0 ||
    cssPixelsPerMillimeter <= 0 ||
    maximumMillimeters < 0
  )
    return 0;

  return Math.min(maximumMillimeters, Math.floor(availableCssPixels / cssPixelsPerMillimeter));
}

export type PresetId =
  | 'desktop-24-fhd'
  | 'desktop-27-qhd'
  | 'desktop-27-4k'
  | 'macbook-air-13'
  | 'macbook-pro-14'
  | 'ipad'
  | 'iphone'
  | 'galaxy-s24-ultra';

/** 设备预设与厂商标称 PPI；与 PpiSourceEditor 共享同一份列表。 */
export const ppiPresets: { value: PresetId; label: string; ppi: number }[] = [
  { value: 'desktop-24-fhd', label: '24 英寸显示器 · 1920×1080 · 91.8 PPI', ppi: 91.79 },
  { value: 'desktop-27-qhd', label: '27 英寸显示器 · 2560×1440 · 108.8 PPI', ppi: 108.79 },
  { value: 'desktop-27-4k', label: '27 英寸显示器 · 3840×2160 · 163.2 PPI', ppi: 163.18 },
  { value: 'macbook-air-13', label: 'MacBook Air 13.6 英寸 · 224 PPI', ppi: 224 },
  { value: 'macbook-pro-14', label: 'MacBook Pro 14 英寸 · 3024×1964 · 254 PPI', ppi: 254 },
  { value: 'ipad', label: 'iPad（Retina）· 264 PPI', ppi: 264 },
  { value: 'iphone', label: 'iPhone（Super Retina）· 460 PPI', ppi: 460 },
  { value: 'galaxy-s24-ultra', label: 'Samsung Galaxy S24 Ultra · 505 PPI', ppi: 505 },
];
