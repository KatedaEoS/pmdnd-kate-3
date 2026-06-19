export interface DrawingPoint {
  x: number
  y: number
}

interface ConeDrawingLike {
  points: DrawingPoint[]
  angle?: number
}

const EPS = 1e-8
const DEFAULT_CONE_ANGLE = 53

export function coneTrianglePoints(drawing: ConeDrawingLike): [DrawingPoint, DrawingPoint, DrawingPoint] | null {
  const [apex, baseCenter] = drawing.points
  if (!apex || !baseCenter) return null

  const dx = baseCenter.x - apex.x
  const dy = baseCenter.y - apex.y
  const length = Math.hypot(dx, dy)
  if (length <= EPS) return null

  const requestedAngle = Number(drawing.angle)
  const angle =
    Number.isFinite(requestedAngle) && requestedAngle > 0 && requestedAngle < 180
      ? requestedAngle
      : DEFAULT_CONE_ANGLE
  const halfBase = length * Math.tan((angle * Math.PI) / 360)
  const nx = -dy / length
  const ny = dx / length

  return [
    { x: apex.x, y: apex.y },
    { x: baseCenter.x + nx * halfBase, y: baseCenter.y + ny * halfBase },
    { x: baseCenter.x - nx * halfBase, y: baseCenter.y - ny * halfBase }
  ]
}

function pointOnSegmentInclusive(
  point: DrawingPoint,
  start: DrawingPoint,
  end: DrawingPoint
): boolean {
  const cross =
    (point.y - start.y) * (end.x - start.x) -
    (point.x - start.x) * (end.y - start.y)
  if (Math.abs(cross) > EPS) return false

  const dot =
    (point.x - start.x) * (end.x - start.x) +
    (point.y - start.y) * (end.y - start.y)
  if (dot < -EPS) return false

  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2
  return dot <= lengthSquared + EPS
}

export function pointInPolygonInclusive(point: DrawingPoint, polygon: DrawingPoint[]): boolean {
  if (polygon.length < 3) return false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (pointOnSegmentInclusive(point, polygon[j], polygon[i])) return true
  }

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const current = polygon[i]
    const previous = polygon[j]
    if (current.y > point.y !== previous.y > point.y) {
      const x =
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
        current.x
      if (point.x < x) inside = !inside
    }
  }
  return inside
}
