export function dvalue(mx: number): number {
  mx = Math.max(Math.round(mx), 1)
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return (array[0] % mx) + 1
}

export function d10(): number {
  return dvalue(10)
}

export function d20(): number {
  return dvalue(20)
}

export function toMod(mod: number): string {
  return `${mod > 0 ? '+' : ''}${mod == 0 ? '' : mod}`
}

export function toAdvantage(mod: number): string {
  return `${mod > 0 ? '+' : ''}${mod == 0 ? '' : mod} ${mod > 0 ? '优势' : '劣势'}`
}

export function valueToColor(val: number): string {
  if (val == 0) {
    return 'black'
  } else if (val > 0) {
    return 'crimson'
  } else {
    return 'dodgerblue'
  }
}

export function valueToColorBinary(val: number): string {
  if (val == 0) {
    return 'lightgray'
  } else {
    return 'black'
  }
}

export function stringHP(hp: number[], maxhp: number): string {
  return `${hp[0]}${hp[1] > 0 ? '+' + String(hp[1]) : ''}/${maxhp}`
}

export function autoResize(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 4 + 'px'
}

/** 在 Canvas 世界坐标位置绘制黑底白字标签 */
export function drawCanvasLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  wx: number,
  wy: number,
  s: number,
  rs: number,
  vx: number,
  vy: number,
  options?: { fontSize?: number; align?: 'center' | 'left' | 'right'; bold?: boolean; warn?: boolean }
): void {
  const fontSize = (options?.fontSize ?? 14) * rs
  const align = options?.align ?? 'center'
  const bold = options?.bold ?? false
  const warn = options?.warn ?? false

  const sx = wx * s + vx
  const sy = wy * s + vy

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px sans-serif`
  const tw = ctx.measureText(text).width

  const pad = 4 * rs
  const xOff = align == 'left' ? 0 : align == 'right' ? -tw : -tw / 2
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(sx + xOff - pad, sy - fontSize - pad, tw + pad * 2, fontSize + pad * 2)
  ctx.fillStyle = warn ? '#ff9999' : '#fff'
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px sans-serif`
  ctx.textAlign = align as CanvasTextAlign
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, sx, sy)
  ctx.restore()
}
