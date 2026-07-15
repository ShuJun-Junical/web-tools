const IMAGE_DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/]+={0,2})$/i

export function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }

  return btoa(binary)
}

export function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export function encodeUrl(value: string): string {
  return encodeURIComponent(value)
}

export function decodeUrl(value: string): string {
  return decodeURIComponent(value)
}

export function parseImageDataUrl(value: string) {
  const match = IMAGE_DATA_URL.exec(value.trim())
  if (!match) return null

  try {
    atob(match[2])
    return { mimeType: match[1].toLowerCase(), dataUrl: value.trim() }
  } catch {
    return null
  }
}

export function imageDataUrlToBlob(value: string): Blob | null {
  const parsed = parseImageDataUrl(value)
  if (!parsed) return null

  const encoded = parsed.dataUrl.slice(parsed.dataUrl.indexOf(',') + 1)
  const binary = atob(encoded)
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return new Blob([bytes], { type: parsed.mimeType })
}
