import type { Creature } from './Creature'
import type { MapDrawing, MapFieldData, MapMemory, MapToken } from './GlobalMemory'
import { FieldStates, SurfaceStates } from './WeatherField'
import { coneTrianglePoints, pointInPolygonInclusive } from './DrawingGeometry'

interface Point {
  x: number
  y: number
}

export interface FieldStatusEntry {
  stateName: string
  statusName: string
  layers: number
  sourceCount: number
  dcs: number[]
  casterCodes: string[]
  remainingRounds: number[]
}

const EPS = 1e-8

const fieldColors: Record<string, string> = {
  电气场地: '#f2c94c',
  薄雾场地: '#a66bd6',
  精神场地: '#e0569d',
  青草场地: '#35a853',
  幽暗场地: '#4a4f78',
  龙之场地: '#3f7bd7',
  失序场地: '#ff6f61',
  结冰地表: '#8fd8ff',
  着火地表: '#ff7043'
}

export const DrawableFieldStates = [...FieldStates, ...SurfaceStates]

export function fieldStatusName(stateName: string): string {
  return `在${stateName}中`
}

function normalizeFieldName(stateName: string | undefined): string {
  const trimmed = (stateName ?? '').trim()
  return trimmed || '电气场地'
}

function normalizeFieldColor(color: string | undefined, stateName: string): string {
  const trimmed = (color ?? '').trim()
  if (/^#[\da-fA-F]{6}$/.test(trimmed)) return trimmed
  return fieldColors[stateName] ?? '#607d8b'
}

function normalizeRemainingRounds(value: number | undefined): number {
  const raw = Math.floor(value ?? -1)
  if (!Number.isFinite(raw)) return -1
  return Math.max(-1, raw)
}

export function fieldColorForState(stateName: string, color?: string): string {
  return normalizeFieldColor(color, stateName)
}

export function fieldColorForField(field: Partial<MapFieldData> | undefined): string {
  const normalized = normalizeFieldData(field)
  return normalized.color
}

export function fieldRemainingText(rounds: number): string {
  if (rounds < 0) return '无限'
  return `${rounds} 回合`
}

export function isAreaDrawing(d: MapDrawing | undefined): d is MapDrawing {
  if (!d || d.type == 'arrow' || d.type == 'ruler') return false
  if (d.type == 'circle' || d.type == 'cone' || d.type == 'sector' || d.type == 'rectangle') {
    return d.points.length >= 2
  }
  return d.points.length >= 3
}

export function normalizeFieldData(field: Partial<MapFieldData> | undefined): MapFieldData {
  const stateName = normalizeFieldName(field?.stateName)
  const layers = Math.max(1, Math.floor(field?.layers ?? 1) || 1)
  const casterCode = (field?.casterCode ?? '').trim()
  const dcAbility = ['力量', '敏捷', '体质', '智力', '感知', '魅力'].includes(
    field?.dcAbility ?? ''
  )
    ? field?.dcAbility ?? ''
    : ''
  const fallbackDc = casterCode.length > 0 ? 0 : 10
  const rawDc = Math.floor(field?.dc ?? fallbackDc)
  const dc = Number.isFinite(rawDc) ? Math.max(0, rawDc) : fallbackDc
  const color = normalizeFieldColor(field?.color, stateName)
  const remainingRounds = normalizeRemainingRounds(field?.remainingRounds)
  return { stateName, layers, casterCode, dcAbility, dc, color, remainingRounds }
}

export function drawingIsField(d: MapDrawing | undefined): d is MapDrawing & { field: MapFieldData } {
  return Boolean(isAreaDrawing(d) && d.field && normalizeFieldData(d.field).remainingRounds != 0)
}

export function applyFieldDataToDrawing(
  d: MapDrawing | undefined,
  field: Partial<MapFieldData> | undefined
): boolean {
  if (!isAreaDrawing(d)) return false
  d.field = normalizeFieldData(field)
  return true
}

export function removeFieldDataFromDrawing(d: MapDrawing | undefined): boolean {
  if (!d?.field) return false
  delete d.field
  return true
}

export function convertAreaDrawingsToFields(
  map: MapMemory,
  field: Partial<MapFieldData> | undefined
): number {
  let count = 0
  for (const drawing of map.drawings) {
    if (applyFieldDataToDrawing(drawing, field)) count += 1
  }
  return count
}

export function advanceFieldRounds(map: MapMemory): number {
  let expired = 0
  for (const drawing of map.drawings) {
    if (!drawing.field) continue
    const field = normalizeFieldData(drawing.field)
    if (field.remainingRounds < 0) {
      drawing.field = field
      continue
    }
    if (field.remainingRounds > 0) {
      field.remainingRounds -= 1
    }
    if (field.remainingRounds <= 0) {
      delete drawing.field
      expired += 1
    } else {
      drawing.field = field
    }
  }
  return expired
}

function angleDiff(a: number, b: number): number {
  let diff = a - b
  while (diff > Math.PI) diff -= 2 * Math.PI
  while (diff < -Math.PI) diff += 2 * Math.PI
  return diff
}

export function pointInAreaDrawingGrid(p: Point, d: MapDrawing): boolean {
  if (!isAreaDrawing(d)) return false

  if (d.type == 'rectangle') {
    const [p1, p2] = d.points
    return (
      p.x >= Math.min(p1.x, p2.x) - EPS &&
      p.x <= Math.max(p1.x, p2.x) + EPS &&
      p.y >= Math.min(p1.y, p2.y) - EPS &&
      p.y <= Math.max(p1.y, p2.y) + EPS
    )
  }

  if (d.type == 'polygon') {
    return pointInPolygonInclusive(p, d.points)
  }

  if (d.type == 'circle') {
    const [p1, p2] = d.points
    const r = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    return Math.hypot(p.x - p1.x, p.y - p1.y) <= r + EPS
  }

  if (d.type == 'cone') {
    const triangle = coneTrianglePoints(d)
    return triangle ? pointInPolygonInclusive(p, triangle) : false
  }

  if (d.type == 'sector') {
    const [p1, p2] = d.points
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
    const r = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    const half = ((d.angle || 45) * Math.PI) / 360
    const da = Math.atan2(p.y - p1.y, p.x - p1.x)
    const dr = Math.hypot(p.x - p1.x, p.y - p1.y)
    return dr <= r + EPS && Math.abs(angleDiff(da, angle)) <= half + EPS
  }

  return false
}

function creatureFootprint(creature: Creature): number {
  const size = creature.sizeAbility.size
  return size < 1 ? 0.5 : Math.floor(size)
}

function occupiedCellCenters(token: MapToken, footprint: number): Point[] {
  if (footprint <= 1) return [{ x: token.x, y: token.y }]
  const centers: Point[] = []
  const startX = token.x - footprint / 2 + 0.5
  const startY = token.y - footprint / 2 + 0.5
  for (let ix = 0; ix < footprint; ix++) {
    for (let iy = 0; iy < footprint; iy++) {
      centers.push({ x: startX + ix, y: startY + iy })
    }
  }
  return centers
}

export function creatureIsInFieldDrawing(
  creature: Creature,
  drawing: MapDrawing,
  map: MapMemory
): boolean {
  if (!drawingIsField(drawing)) return false
  const token = map.tokens.find((t) => t.code == creature.code())
  if (!token) return false
  return occupiedCellCenters(token, creatureFootprint(creature)).some((p) =>
    pointInAreaDrawingGrid(p, drawing)
  )
}

export function fieldStatusesForCreature(
  creature: Creature | null,
  map: MapMemory
): FieldStatusEntry[] {
  if (!creature) return []
  const entries = new Map<string, FieldStatusEntry>()

  for (const drawing of map.drawings) {
    if (!drawingIsField(drawing) || !creatureIsInFieldDrawing(creature, drawing, map)) continue
    const field = normalizeFieldData(drawing.field)
    const entry =
      entries.get(field.stateName) ??
      {
        stateName: field.stateName,
        statusName: fieldStatusName(field.stateName),
        layers: 0,
        sourceCount: 0,
        dcs: [],
        casterCodes: [],
        remainingRounds: []
      }
    entry.layers += field.layers
    entry.sourceCount += 1
    if (!entry.dcs.includes(field.dc)) entry.dcs.push(field.dc)
    const casterLabel = field.casterCode || '大自然'
    if (!entry.casterCodes.includes(casterLabel)) entry.casterCodes.push(casterLabel)
    if (!entry.remainingRounds.includes(field.remainingRounds)) {
      entry.remainingRounds.push(field.remainingRounds)
    }
    entries.set(field.stateName, entry)
  }

  return Array.from(entries.values()).sort((a, b) => {
    const ai = DrawableFieldStates.findIndex((f) => f.name == a.stateName)
    const bi = DrawableFieldStates.findIndex((f) => f.name == b.stateName)
    const orderDiff = (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
    return orderDiff != 0 ? orderDiff : a.stateName.localeCompare(b.stateName)
  })
}

export function fieldLayersForCreature(
  creature: Creature | null,
  map: MapMemory
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const entry of fieldStatusesForCreature(creature, map)) {
    result[entry.stateName] = entry.layers
  }
  return result
}

export function fieldLabelPoint(d: MapDrawing): Point | null {
  if (!isAreaDrawing(d)) return null
  if (d.type == 'rectangle') {
    const [p1, p2] = d.points
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  }
  if (d.type == 'circle' || d.type == 'cone' || d.type == 'sector') {
    return d.points[0] ?? null
  }
  const sum = d.points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  )
  return { x: sum.x / d.points.length, y: sum.y / d.points.length }
}
