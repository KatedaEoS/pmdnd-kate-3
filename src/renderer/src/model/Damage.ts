export function damageCalcRaw(
  eff: number,
  cr: number,
  atk: number,
  def: number,
  stab: number,
  mdf: number,
  rollp: number
): number {
  let coef4 = 1
  if (stab > 0) {
    coef4 = (100 + stab) / 100
  } else {
    coef4 = 100 / (100 - stab)
  }
  let coef5 = 1
  if (mdf > 0) {
    coef5 = (2 + mdf) / 2
  } else {
    coef5 = 2 / (2 - mdf)
  }
  return Math.max(0, Math.floor((eff * cr * atk * coef4 * coef5 * rollp) / 10000 / def))
}

export function handleHP(
  hp: number[],
  maxhp: number,
  delta: number[],
  shieldDamageRatio: number = 1
): number[] {
  const cur = hp[0]
  let tmp = Math.max(hp[1], delta[1])
  let real = cur
  if (delta[0] < 0) {
    const damage = -delta[0]
    const ratio = Math.max(1, Math.floor(Number(shieldDamageRatio) || 1))
    const shieldAbsorbedDamage = Math.min(damage, tmp > 0 ? Math.ceil(tmp / ratio) : 0)
    const shieldLoss = Math.min(tmp, damage * ratio)
    tmp -= shieldLoss
    real -= damage - shieldAbsorbedDamage
  } else {
    real += delta[0]
  }
  return [Math.min(maxhp, real), tmp]
}

export function showHP(hp: number[]): string {
  return `${hp[0]}${hp[1] != 0 ? '+' + hp[1] : ''}`
}
