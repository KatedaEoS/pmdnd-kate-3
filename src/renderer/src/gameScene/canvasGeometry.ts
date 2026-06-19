import type { MapDrawing } from '../model/GlobalMemory'
import { coneTrianglePoints, pointInPolygonInclusive } from '../model/DrawingGeometry'

export interface Point {
  x: number
  y: number
}

export type DrawableShape = Omit<MapDrawing, 'type'> & { type: MapDrawing['type'] | 'line' }

export function clampNumber(value: number, min: number, max: number): number {
  if (min > max) return min
  return Math.min(max, Math.max(min, value))
}

export function snapPosition(fp: number, val: number): number {
  if (fp < 1) return Math.round((val - 0.25) * 2) / 2 + 0.25
  if (fp % 2 == 1) return Math.round(val - 0.5) + 0.5
  return Math.round(val)
}

export function pointInPolygon(
  wx: number,
  wy: number,
  poly: Point[],
  ox: number,
  oy: number,
  cs: number
): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = ox + poly[i].x * cs
    const yi = oy + poly[i].y * cs
    const xj = ox + poly[j].x * cs
    const yj = oy + poly[j].y * cs
    if (yi > wy !== yj > wy && wx < ((xj - xi) * (wy - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function hitDrawing(
  wx: number,
  wy: number,
  d: DrawableShape,
  ox: number,
  oy: number,
  cs: number
): boolean {
  if (d.type == 'rectangle') {
    const [p1, p2] = d.points
    const x1 = ox + Math.min(p1.x, p2.x) * cs
    const x2 = ox + Math.max(p1.x, p2.x) * cs
    const y1 = oy + Math.min(p1.y, p2.y) * cs
    const y2 = oy + Math.max(p1.y, p2.y) * cs
    return wx >= x1 - 2 && wx <= x2 + 2 && wy >= y1 - 2 && wy <= y2 + 2
  }
  if (d.type == 'polygon' || d.type == 'line') {
    return pointInPolygon(wx, wy, d.points, ox, oy, cs)
  }
  if (d.type == 'circle') {
    const cx = ox + d.points[0].x * cs
    const cy = oy + d.points[0].y * cs
    const r = Math.hypot(d.points[1].x - d.points[0].x, d.points[1].y - d.points[0].y) * cs
    const dist = Math.hypot(wx - cx, wy - cy)
    return dist <= r + 2
  }
  if (d.type == 'cone') {
    const triangle = coneTrianglePoints(d)
    if (!triangle) return false
    return pointInPolygonInclusive(
      { x: wx, y: wy },
      triangle.map((point) => ({ x: ox + point.x * cs, y: oy + point.y * cs }))
    )
  }
  if (d.type == 'sector') {
    const [p1, p2] = d.points
    const x1 = ox + p1.x * cs
    const y1 = oy + p1.y * cs
    const angle = Math.atan2(oy + p2.y * cs - y1, ox + p2.x * cs - x1)
    const r = Math.hypot((p2.x - p1.x) * cs, (p2.y - p1.y) * cs)
    const half = ((d.angle || 45) * Math.PI) / 360
    const da = Math.atan2(wy - y1, wx - x1)
    let diff = da - angle
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    if (Math.abs(diff) > half) return false
    const dr = Math.hypot(wx - x1, wy - y1)
    return dr <= r + cs * 0.2
  }

  const p1x = ox + d.points[0].x * cs
  const p1y = oy + d.points[0].y * cs
  const p2x = ox + d.points[1].x * cs
  const p2y = oy + d.points[1].y * cs
  const len = Math.hypot(p2x - p1x, p2y - p1y)
  if (len == 0) return Math.hypot(wx - p1x, wy - p1y) < cs * 0.2
  const t = Math.max(
    0,
    Math.min(1, ((wx - p1x) * (p2x - p1x) + (wy - p1y) * (p2y - p1y)) / (len * len))
  )
  const px = p1x + t * (p2x - p1x)
  const py = p1y + t * (p2y - p1y)
  return Math.hypot(wx - px, wy - py) < cs * 0.2
}

export function drawShapeHighlight(
  ctx: CanvasRenderingContext2D,
  d: DrawableShape,
  ox: number,
  oy: number,
  cs: number
): void {
  ctx.beginPath()
  if (d.type == 'rectangle') {
    const [p1, p2] = d.points
    const x = Math.min(p1.x, p2.x)
    const y = Math.min(p1.y, p2.y)
    ctx.rect(ox + x * cs, oy + y * cs, Math.abs(p2.x - p1.x) * cs, Math.abs(p2.y - p1.y) * cs)
  } else if (d.type == 'circle') {
    const r = Math.hypot(d.points[1].x - d.points[0].x, d.points[1].y - d.points[0].y) * cs
    ctx.arc(ox + d.points[0].x * cs, oy + d.points[0].y * cs, r, 0, Math.PI * 2)
  } else if (d.type == 'cone') {
    const triangle = coneTrianglePoints(d)
    if (triangle) {
      ctx.moveTo(ox + triangle[0].x * cs, oy + triangle[0].y * cs)
      ctx.lineTo(ox + triangle[1].x * cs, oy + triangle[1].y * cs)
      ctx.lineTo(ox + triangle[2].x * cs, oy + triangle[2].y * cs)
      ctx.closePath()
    }
  } else if (d.type == 'sector') {
    const [p1, p2] = d.points
    const x1 = ox + p1.x * cs
    const y1 = oy + p1.y * cs
    const x2 = ox + p2.x * cs
    const y2 = oy + p2.y * cs
    const radius = Math.hypot(x2 - x1, y2 - y1)
    if (radius > 0) {
      const direction = Math.atan2(y2 - y1, x2 - x1)
      const halfAngle = ((d.angle || 45) * Math.PI) / 360
      ctx.moveTo(x1, y1)
      ctx.lineTo(
        x1 + radius * Math.cos(direction - halfAngle),
        y1 + radius * Math.sin(direction - halfAngle)
      )
      ctx.arc(x1, y1, radius, direction - halfAngle, direction + halfAngle)
      ctx.closePath()
    }
  } else if (d.type == 'polygon' && d.points.length >= 3) {
    ctx.moveTo(ox + d.points[0].x * cs, oy + d.points[0].y * cs)
    for (let i = 1; i < d.points.length; i++) ctx.lineTo(ox + d.points[i].x * cs, oy + d.points[i].y * cs)
    ctx.closePath()
  } else if (d.points.length >= 2) {
    ctx.moveTo(ox + d.points[0].x * cs, oy + d.points[0].y * cs)
    ctx.lineTo(ox + d.points[1].x * cs, oy + d.points[1].y * cs)
  }
  ctx.stroke()
}
