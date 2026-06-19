import type { Creature } from '../model/Creature'

export function isUsableTokenImage(img: HTMLImageElement | undefined): img is HTMLImageElement {
  return Boolean(img && img.complete && img.naturalWidth > 0)
}

function splitTokenLabel(name: string, maxLines: number): string[] {
  const clean = name.trim() || '?'
  const chars = Array.from(clean)
  if (maxLines <= 1 || chars.length <= 4) return [clean]

  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    let bestSplit = 1
    let bestDiff = Infinity
    for (let i = 1; i < words.length; i++) {
      const left = words.slice(0, i).join(' ')
      const right = words.slice(i).join(' ')
      const diff = Math.abs(left.length - right.length)
      if (diff < bestDiff) {
        bestDiff = diff
        bestSplit = i
      }
    }
    return [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')]
  }

  const splitAt = Math.ceil(chars.length / 2)
  return [chars.slice(0, splitAt).join(''), chars.slice(splitAt).join('')]
}

function fitTokenText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  minFontSize: number
): { text: string; fontSize: number } {
  const fontStack = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"
  let size = fontSize
  while (size > minFontSize) {
    ctx.font = `bold ${size}px ${fontStack}`
    if (ctx.measureText(text).width <= maxWidth) return { text, fontSize: size }
    size -= 1
  }

  size = minFontSize
  ctx.font = `bold ${size}px ${fontStack}`
  if (ctx.measureText(text).width <= maxWidth) return { text, fontSize: size }

  const chars = Array.from(text)
  for (let i = chars.length - 1; i > 0; i--) {
    const candidate = `${chars.slice(0, i).join('')}...`
    if (ctx.measureText(candidate).width <= maxWidth) return { text: candidate, fontSize: size }
  }
  return { text: '?', fontSize: size }
}

export function drawFallbackToken(
  ctx: CanvasRenderingContext2D,
  c: Creature,
  cx: number,
  cy: number,
  size: number,
  color: string,
  viewScale: number
): void {
  const half = size / 2
  const scale = viewScale || 1
  ctx.save()

  ctx.fillStyle = color
  ctx.fillRect(cx - half, cy - half, size, size)
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.fillRect(cx - half, cy - half, size, size * 0.45)
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = Math.max(size * 0.035, 1 / scale)
  ctx.strokeRect(cx - half, cy - half, size, size)

  const padding = Math.max(size * 0.08, 2 / scale)
  const maxWidth = Math.max(1, size - padding * 2)
  const maxLines = size >= 36 ? 2 : 1
  const lines = splitTokenLabel(c.name(), maxLines)
  const baseFontSize = size * (lines.length > 1 ? 0.18 : 0.23)
  const minFontSize = Math.max(5, size * 0.1)
  const fitted = lines.map((line) => fitTokenText(ctx, line, maxWidth, baseFontSize, minFontSize))
  const lineHeight = Math.max(...fitted.map((line) => line.fontSize)) * 1.1
  const startY = cy - ((fitted.length - 1) * lineHeight) / 2

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < fitted.length; i++) {
    const line = fitted[i]
    const y = startY + i * lineHeight
    ctx.font = `bold ${line.fontSize}px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`
    ctx.lineWidth = Math.max(line.fontSize * 0.14, 1 / scale)
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'
    ctx.strokeText(line.text, cx, y)
    ctx.fillStyle = '#fff'
    ctx.fillText(line.text, cx, y)
  }

  ctx.restore()
}
