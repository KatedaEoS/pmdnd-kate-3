import type { Creature } from './Creature'

export interface TokenPosition {
  x: number
  y: number
}

export interface DistancePoint {
  x: number
  y: number
}

export function creatureDistanceFootprint(creature: Creature): number {
  const size = creature.sizeAbility.size
  return size < 1 ? 0.5 : Math.max(1, Math.floor(size))
}

export function footprintDistancePoints(token: TokenPosition, footprint: number): DistancePoint[] {
  const step = footprint < 1 ? 0.25 : 1
  const count = Math.max(1, Math.round(footprint / step))
  const span = count * step
  const startX = token.x - span / 2 + step / 2
  const startY = token.y - span / 2 + step / 2
  const points: DistancePoint[] = []
  for (let ix = 0; ix < count; ix++) {
    for (let iy = 0; iy < count; iy++) {
      points.push({ x: startX + ix * step, y: startY + iy * step })
    }
  }
  return points
}

export function creatureDistancePoints(token: TokenPosition, creature: Creature): DistancePoint[] {
  return footprintDistancePoints(token, creatureDistanceFootprint(creature))
}

export function creatureTokenDistance(
  aToken: TokenPosition,
  aCreature: Creature,
  bToken: TokenPosition,
  bCreature: Creature
): number {
  const aPoints = creatureDistancePoints(aToken, aCreature)
  const bPoints = creatureDistancePoints(bToken, bCreature)
  let best = Number.POSITIVE_INFINITY
  for (const a of aPoints) {
    for (const b of bPoints) {
      best = Math.min(best, Math.hypot(a.x - b.x, a.y - b.y))
    }
  }
  return Number.isFinite(best) ? best : 0
}

export function roundedCreatureTokenDistance(
  aToken: TokenPosition,
  aCreature: Creature,
  bToken: TokenPosition,
  bCreature: Creature
): number {
  return Math.ceil(creatureTokenDistance(aToken, aCreature, bToken, bCreature) * 100) / 100
}
