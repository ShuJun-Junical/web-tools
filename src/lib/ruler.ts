export function calculatePpi(widthPixels: number, heightPixels: number, diagonalInches: number) {
  if (!Number.isFinite(widthPixels) || !Number.isFinite(heightPixels) || !Number.isFinite(diagonalInches)
    || widthPixels <= 0 || heightPixels <= 0 || diagonalInches <= 0) return null

  return Math.hypot(widthPixels, heightPixels) / diagonalInches
}

export function cssPixelsPerMillimeter(ppi: number, devicePixelRatio: number) {
  if (!Number.isFinite(ppi) || !Number.isFinite(devicePixelRatio) || ppi <= 0 || devicePixelRatio <= 0) return null

  return ppi / 25.4 / devicePixelRatio
}

export function wholeMillimetersThatFit(availableCssPixels: number, cssPixelsPerMillimeter: number, maximumMillimeters: number) {
  if (!Number.isFinite(availableCssPixels) || !Number.isFinite(cssPixelsPerMillimeter) || !Number.isFinite(maximumMillimeters)
    || availableCssPixels < 0 || cssPixelsPerMillimeter <= 0 || maximumMillimeters < 0) return 0

  return Math.min(maximumMillimeters, Math.floor(availableCssPixels / cssPixelsPerMillimeter))
}
