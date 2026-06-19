<script setup lang="ts">
import { ref, computed, watch, onUpdated, nextTick } from 'vue'
import VueNumberInput from '@chenfengyuan/vue-number-input'
import { autoResize, d20, valueToColor } from '@renderer/utils'
import { damageCalcRaw, showHP, handleHP } from '@renderer/model/Damage'
import {
  battleMemory,
  battleMemoryHeal,
  battleMemoryStatus,
  BattleMemory,
  currentMove,
  moveMemory,
  MoveMemory,
  surviveMemory,
  battleLv,
  battleLvStatus,
  spellTypeStab,
  spellTypeStabHeal,
  spellModifier,
  spellModifierHeal,
  spellModifierStatus,
  spellAttack,
  spellAttackHeal,
  spellAttackHealShield,
  envTypeMdfTotal,
  envTypeMdfContributions,
  envEffectIntensity,
  envEffectIntensityContributions,
  getAttackAdvantage,
  healMdf,
  damageMdfStatus,
  dicePct,
  applyAttackResult,
  applyHealResult,
  applyHealShieldResult,
  applyStatusResult,
  applyHealStatusResult,
  applyHealShieldStatusResult
} from '@renderer/model/GlobalMemory'
import Creatures, { Creature } from '@renderer/model/Creature'
import { damageAttackList, damageTypeList, modifierList, MovePower } from '@renderer/model/DataType'
import type { EnvModifierContribution } from '@renderer/model/GlobalMemory'

interface TargetEntry {
  code: string
  damageMdfD: number
  diceroll: number
  dicerollD: number
  advantageDelta: number
  rollHistory: number[]
}

const memory = ref<BattleMemory>(battleMemory.value)
const memoryHeal = ref<BattleMemory>(battleMemoryHeal.value)
const memoryStatus = ref<BattleMemory>(battleMemoryStatus.value)
const movem = ref<MoveMemory>(moveMemory.value)
const targets = ref<TargetEntry[]>([])
const batchAdvantage = ref<number>(0)
const batchDiceroll = ref<number>(10)
const healMode = ref<'heal' | 'shield'>('heal')
const statusMode = ref<'damage' | 'heal' | 'shield'>('damage')
const showMoveDescription = ref(false)
const casterExpanded = ref(true)

const atkType = computed(() => memory.value.attackType)
const casterMoveList = computed(() => memory.value.attacker?.getMoveInMemoryList() ?? [])

function chooseCaster(code: string): void {
  memory.value.attacker = Creatures.value.find((c) => c.code() == code) ?? null
}

function currentPower(): MovePower | null {
  return currentMove().powerList[movem.value.selectedPowerIdx] ?? null
}

function isNoPower(): boolean {
  const pwr = currentPower()
  return !pwr || pwr.message() == '无威力'
}

function resetTargetRolls(defaultAdvantage: number): void {
  for (const entry of targets.value) {
    const creature = getCreature(entry.code)
    const autoCrit = atkType.value == 1 && (creature?.grandStatus().autoCrit ?? false)
    entry.damageMdfD = 0
    entry.diceroll = autoCrit ? 20 : 10
    entry.dicerollD = 0
    entry.advantageDelta = defaultAdvantage
    entry.rollHistory = [entry.diceroll]
  }
}

function setCurrentMove(): void {
  const caster = memory.value.attacker
  const mov = currentMove()
  const moveNameKey = `${caster?.code() ?? ''}:${mov.name}`

  movem.value.dcDelta = 0
  movem.value.selectedPowerIdx = Math.min(
    Math.max(0, movem.value.selectedPowerIdx),
    mov.powerList.length - 1
  )
  const pwr = currentPower()
  if (!caster || !mov.name || !pwr) {
    memory.value.attackType = 0
    return
  }

  let costPPOverride = mov.costPP
  const ppMatch = /([0-9]+)[Pp][Pp]/.exec(pwr.extra)
  if (ppMatch) costPPOverride = Number(ppMatch[1])

  let elemTypeOverride = mov.elemType
  for (const name of damageTypeList) {
    if (pwr.extra.includes(name)) elemTypeOverride = name
  }

  let spellAttackOverride = pwr.psType == '物理' ? '物攻' : '特攻'
  for (const name of damageAttackList) {
    if (pwr.extra.includes(name)) spellAttackOverride = name
  }

  let spellModOverride = mov.castAbility
  for (const name of modifierList) {
    if (pwr.extra.includes(name)) spellModOverride = name
  }

  let advantageOverride: number | null = null
  const advMatch = pwr.extra.match(/([0-9]+)\s*优势/)
  const disMatch = pwr.extra.match(/([0-9]+)\s*劣势/)
  if (advMatch) advantageOverride = Number(advMatch[1])
  else if (disMatch) advantageOverride = -Number(disMatch[1])

  if (isNoPower()) {
    memory.value.attackType = 0
    movem.value.nullCostPP = costPPOverride
    movem.value.lastMoveName = moveNameKey
    return
  }

  const damageDefense = pwr.psType == '物理' ? '物防' : '特防'
  const isNewPower = `${moveNameKey}:${pwr.idx}` != movem.value.lastMoveName
  const defaultAdvantage = advantageOverride ?? 0

  if (pwr.isStatus) {
    memory.value.attackType = 3
    memoryStatus.value.costPP = costPPOverride
    memoryStatus.value.battleLvD = 0
    memoryStatus.value.ctLimit = 20
    memoryStatus.value.spellName = mov.name
    memoryStatus.value.effect = pwr.power
    memoryStatus.value.spellType = elemTypeOverride
    memoryStatus.value.spellTypeStabD = 0
    memoryStatus.value.spellAttack = spellAttackOverride
    memoryStatus.value.spellAttackD = 0
    memoryStatus.value.spellMod = spellModOverride
    memoryStatus.value.spellModD = 0
    memoryStatus.value.damageType = pwr.elemType
    memoryStatus.value.damageAspect = pwr.aspect
    memoryStatus.value.damageDef = pwr.psType
    memoryStatus.value.damageDefense = damageDefense
    memoryStatus.value.damageDefenseD = 0
    memoryStatus.value.customDamage = 0
    memoryStatus.value.enableCT = 0
    memoryStatus.value.enableMiss = 0
    memoryStatus.value.enableAccuracyAdvance = 0
    if (isNewPower) {
      memoryStatus.value.damageMdfD = 0
      memoryStatus.value.dicerollD = 0
      memoryStatus.value.diceroll = 10
      memoryStatus.value.advantageDelta = defaultAdvantage
      memoryStatus.value.rollHistory = [10]
    }
  } else if (damageTypeList.includes(pwr.elemType)) {
    memory.value.attackType = 1
    memory.value.costPP = costPPOverride
    memory.value.battleLvD = 0
    memory.value.ctLimit = 20
    memory.value.spellName = mov.name
    memory.value.effect = pwr.power
    memory.value.spellType = elemTypeOverride
    memory.value.spellTypeStabD = 0
    memory.value.spellAttack = spellAttackOverride
    memory.value.spellAttackD = 0
    memory.value.spellMod = spellModOverride
    memory.value.spellModD = 0
    memory.value.damageType = pwr.elemType
    memory.value.damageAspect = pwr.aspect
    memory.value.damageDef = pwr.psType
    memory.value.damageDefense = damageDefense
    memory.value.damageDefenseD = 0
    memory.value.customDamage = 0
    memory.value.enableCT = 1
    memory.value.enableMiss = 1
    memory.value.enableAccuracyAdvance = 1
    if (isNewPower) {
      memory.value.damageMdfD = 0
      memory.value.dicerollD = 0
      memory.value.diceroll = 10
      memory.value.advantageDelta = defaultAdvantage
      memory.value.rollHistory = [10]
    }
  } else {
    memory.value.attackType = 2
    memoryHeal.value.costPP = costPPOverride
    memoryHeal.value.battleLvD = 100 - caster.battleLv()
    memoryHeal.value.ctLimit = 20
    memoryHeal.value.spellName = mov.name
    memoryHeal.value.effect = pwr.power
    memoryHeal.value.spellType = elemTypeOverride
    memoryHeal.value.spellTypeStabD = 0
    memoryHeal.value.spellAttack = '特防'
    memoryHeal.value.spellAttackShield = '物防'
    for (const name of damageAttackList) {
      if (pwr.extra.includes(name)) {
        memoryHeal.value.spellAttack = name
        memoryHeal.value.spellAttackShield = name
      }
    }
    memoryHeal.value.spellAttackD = 0
    memoryHeal.value.spellAttackShieldD = 0
    memoryHeal.value.spellMod = spellModOverride
    memoryHeal.value.spellModD = 0
    memoryHeal.value.damageType = pwr.elemType
    memoryHeal.value.damageAspect = pwr.aspect
    memoryHeal.value.damageDef = pwr.psType
    memoryHeal.value.damageDefense = damageDefense
    memoryHeal.value.damageDefenseD = 0
    memoryHeal.value.customDamage = 0
    memoryHeal.value.enableCT = 1
    memoryHeal.value.enableMiss = 0
    memoryHeal.value.enableAccuracyAdvance = 0
    if (isNewPower) {
      memoryHeal.value.damageMdfD = 0
      memoryHeal.value.dicerollD = 0
      memoryHeal.value.diceroll = 10
      memoryHeal.value.advantageDelta = defaultAdvantage
      memoryHeal.value.rollHistory = [10]
    }
  }

  if (isNewPower) resetTargetRolls(defaultAdvantage)
  movem.value.lastMoveName = `${moveNameKey}:${pwr.idx}`
  ensureTargetData()
}

function moveWheel(event: { preventDefault(): unknown; deltaY: number }): void {
  const moveList = casterMoveList.value
  if (moveList.length > 0) {
    const index = moveList.indexOf(movem.value.selectedMove)
    if (event.deltaY < 0) movem.value.selectedMove = moveList[Math.max(index - 1, 0)]
    else if (event.deltaY > 0)
      movem.value.selectedMove = moveList[Math.min(index + 1, moveList.length - 1)]
    movem.value.selectedPowerIdx = 1
  } else {
    movem.value.selectedMove = ''
  }
  setCurrentMove()
  event.preventDefault()
}

function movePowerWheel(event: { preventDefault(): unknown; deltaY: number }): void {
  if (currentMove().powerList.length > 0) {
    if (event.deltaY < 0) movem.value.selectedPowerIdx -= 1
    else if (event.deltaY > 0) movem.value.selectedPowerIdx += 1
    movem.value.selectedPowerIdx = Math.min(
      Math.max(0, movem.value.selectedPowerIdx),
      currentMove().powerList.length - 1
    )
    setCurrentMove()
  }
  event.preventDefault()
}

function currentDC(): number {
  const caster = memory.value.attacker
  if (!caster) return 10 + movem.value.dcDelta
  return (
    caster.getMoveDC(currentMove().name) +
    movem.value.dcDelta +
    envEffectIntensity(currentMove().elemType, caster)
  )
}

const envDcContributions = computed<EnvModifierContribution[]>(() => {
  const caster = memory.value.attacker
  if (!caster || currentMove().name.length <= 0) return []
  return envEffectIntensityContributions(currentMove().elemType, caster)
})

const envDamageMdfContributions = computed<EnvModifierContribution[]>(() => {
  const caster = memory.value.attacker
  if (!caster || currentMove().name.length <= 0 || isNoPower()) return []
  if (atkType.value == 1) {
    return envTypeMdfContributions([memory.value.damageType, memory.value.damageAspect], caster)
  }
  if (atkType.value == 2) {
    return envTypeMdfContributions(
      [memoryHeal.value.damageType, memoryHeal.value.damageAspect],
      caster
    )
  }
  if (atkType.value == 3) {
    return envTypeMdfContributions(
      [memoryStatus.value.damageType, memoryStatus.value.damageAspect],
      caster
    )
  }
  return []
})

function contributionTotal(items: EnvModifierContribution[]): number {
  return items.reduce((sum, item) => sum + item.value, 0)
}

function contributionValueText(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`
}

function contributionListText(items: EnvModifierContribution[]): string {
  return items
    .map((item) => `${item.name} ${item.layers}层 ${contributionValueText(item.value)}`)
    .join('、')
}

function setSaveForTargets(skill: string): void {
  surviveMemory.value.checkSkill = skill
  surviveMemory.value.isSave = 1
  surviveMemory.value.rollMode = 'save'
  surviveMemory.value.abilityOverride = ''
  surviveMemory.value.difficulty = currentDC()
}

watch(
  () => memory.value.attacker?.code() ?? '',
  () => {
    const caster = memory.value.attacker
    if (!caster) {
      movem.value.selectedMove = ''
      return
    }
    caster.shallowRefresh()
    if (!casterMoveList.value.includes(movem.value.selectedMove)) {
      movem.value.selectedMove = casterMoveList.value[0] ?? ''
      movem.value.selectedPowerIdx = 1
    }
    setCurrentMove()
  },
  { immediate: true }
)

function ensureTargetData(): void {
  const chosen = surviveMemory.value.chosen
  for (const code of chosen) {
    const creature = Creatures.value.find((c) => c.code() == code)
    const autoCrit = atkType.value == 1 && (creature?.grandStatus().autoCrit ?? false)
    const existing = targets.value.find((t) => t.code == code)
    if (existing) {
      if (autoCrit) {
        existing.diceroll = 20
        existing.rollHistory = [20]
      }
    } else {
      const defaultAdv =
        atkType.value == 2
          ? memoryHeal.value.advantageDelta
          : atkType.value == 3
            ? memoryStatus.value.advantageDelta
            : memory.value.advantageDelta
      targets.value.push({
        code,
        damageMdfD: 0,
        diceroll: autoCrit ? 20 : 10,
        dicerollD: 0,
        advantageDelta: defaultAdv,
        rollHistory: autoCrit ? [20] : [10]
      })
    }
  }
  // remove deselected
  targets.value = targets.value.filter((t) => chosen.has(t.code))
}

watch(
  () => Array.from(surviveMemory.value.chosen).sort().join('\u0000'),
  ensureTargetData,
  { immediate: true }
)
watch(() => Creatures.value.length, ensureTargetData)
watch(atkType, ensureTargetData)

function getCreature(code: string): Creature | undefined {
  return Creatures.value.find((c) => c.code() == code)
}

function toggleChosen(code: string): void {
  const chosen = surviveMemory.value.chosen
  if (chosen.has(code)) {
    chosen.delete(code)
  } else {
    chosen.add(code)
  }
  ensureTargetData()
}

// ── 批量操作 ──

function batchRoll(): void {
  for (const t of targets.value) {
    if (atkType.value == 1) {
      const c = getCreature(t.code)
      if (c?.grandStatus().autoCrit) {
        t.diceroll = 20
        t.rollHistory = [20]
        continue
      }
    }
    const n = 1 + Math.abs(t.advantageDelta)
    const rolls = Array.from({ length: n }, () => d20())
    t.rollHistory = rolls
    t.diceroll =
      t.advantageDelta > 0
        ? Math.max(...rolls)
        : t.advantageDelta < 0
          ? Math.min(...rolls)
          : rolls[0]
  }
}

function batchSetAdvantage(): void {
  for (const t of targets.value) {
    t.advantageDelta = batchAdvantage.value
  }
}

function batchSetDiceroll(): void {
  for (const t of targets.value) {
    modifyWorldline(t, batchDiceroll.value)
  }
}

function rollSingle(entry: TargetEntry): void {
  entry.diceroll = d20()
  entry.rollHistory = [entry.diceroll]
}

function setAutoCrit(entry: TargetEntry): void {
  entry.diceroll = 20
  entry.rollHistory = [20]
}

function modifyWorldline(entry: TargetEntry, newValue: number): void {
  const n = entry.rollHistory.length
  if (n <= 1) {
    entry.diceroll = newValue
    entry.rollHistory = [newValue]
    return
  }

  const isAdv = entry.advantageDelta > 0
  const rolls: number[] = []
  for (let i = 0; i < n; i++) {
    rolls.push(
      isAdv
        ? Math.floor(Math.random() * newValue) + 1 // 1d(target)
        : Math.floor(Math.random() * (21 - newValue)) + newValue // target..20
    )
  }
  // 随机将一个骰子设为目标值，确保取最高/最低时就是它
  rolls[Math.floor(Math.random() * n)] = newValue

  entry.rollHistory = rolls
  entry.diceroll = isAdv ? Math.max(...rolls) : Math.min(...rolls)
}

// ── 模式 1：攻击 ──

interface TargetResult {
  code: string
  name: string
  defValue: number
  damage: number
  mdf: number
  roll: number
  rollPct: number
}

function computeResult(entry: TargetEntry): TargetResult {
  const mem = memory.value
  const defender = getCreature(entry.code)
  if (!mem.attacker || !defender) {
    return { code: entry.code, name: '?', defValue: 0, damage: 0, mdf: 0, roll: 0, rollPct: 0 }
  }

  const defValue = Math.max(
    1,
    Math.floor(defender.getAttributeByName(mem.damageDefense) + mem.damageDefenseD)
  )
  const baseMdf =
    defender.typeMdf(mem.damageType) +
    defender.typeMdf(mem.damageAspect) +
    defender.grandStatus().grandMdf
  const mdf =
    baseMdf + envTypeMdfTotal([mem.damageType, mem.damageAspect], mem.attacker) + entry.damageMdfD

  const accAdv =
    mem.enableAccuracyAdvance && entry.diceroll < mem.ctLimit
      ? mem.attacker.accuracy() - defender.evasion()
      : Math.max(0, mem.attacker.accuracy() - defender.evasion())

  const { roll, rollPct } = dicePct(
    entry.diceroll,
    entry.dicerollD,
    accAdv + spellModifier() + getAttackAdvantage(mem.spellMod),
    mem.enableCT,
    mem.ctLimit,
    mem.enableMiss
  )

  return {
    code: entry.code,
    name: defender.name(),
    defValue,
    damage: damageCalcRaw(
      mem.effect,
      battleLv(),
      spellAttack(),
      defValue,
      spellTypeStab(),
      mdf,
      rollPct
    ),
    mdf,
    roll,
    rollPct
  }
}

const results = computed<TargetResult[]>(() => targets.value.map(computeResult))

// ── 模式 2：治疗 / 护盾（逐目标计算）──

interface HealResult {
  code: string
  name: string
  heal: number
  shield: number
  roll: number
  rollPct: number
  mdf: number
}

function computeHealResult(entry: TargetEntry): HealResult {
  const mem = memory.value
  const mh = memoryHeal.value
  const attacker = mem.attacker
  const creature = getCreature(entry.code)
  if (!attacker || !creature) {
    return { code: entry.code, name: '?', heal: 0, shield: 0, roll: 0, rollPct: 0, mdf: 0 }
  }

  const cr = battleLv() + mh.battleLvD
  const stab = spellTypeStabHeal()
  const rawMdf = healMdf()
  const mdf = rawMdf - mh.damageMdfD + entry.damageMdfD
  const healAtk = spellAttackHeal()
  const shieldAtk = spellAttackHealShield()

  const { roll, rollPct } = dicePct(
    entry.diceroll,
    entry.dicerollD,
    spellModifierHeal(),
    mh.enableCT,
    mh.ctLimit,
    mh.enableMiss
  )

  return {
    code: entry.code,
    name: creature.name(),
    heal: damageCalcRaw(mh.effect, cr, healAtk, 200, stab, mdf, rollPct),
    shield: damageCalcRaw(mh.effect, cr, shieldAtk, 200, stab, mdf, rollPct),
    roll,
    rollPct,
    mdf
  }
}

const healResults = computed<HealResult[]>(() => targets.value.map(computeHealResult))

// ── 模式 3：状态（逐目标计算）──

interface StatusResult {
  code: string
  name: string
  damage: number
  heal: number
  shield: number
  roll: number
  rollPct: number
  mdf: number
}

function computeStatusResult(entry: TargetEntry): StatusResult {
  const ms = memoryStatus.value
  const creature = getCreature(entry.code)
  if (!creature) {
    return {
      code: entry.code,
      name: '?',
      damage: 0,
      heal: 0,
      shield: 0,
      roll: 0,
      rollPct: 0,
      mdf: 0
    }
  }

  const { roll, rollPct } = dicePct(
    entry.diceroll,
    entry.dicerollD,
    spellModifierStatus(),
    ms.enableCT,
    ms.ctLimit,
    ms.enableMiss
  )

  if (ms.customDamage > 0) {
    const mdf = damageMdfStatus() - ms.damageMdfD + entry.damageMdfD
    const v = damageCalcRaw(ms.customDamage, 100, 1, 1, 0, mdf, 100)
    return {
      code: entry.code,
      name: creature.name(),
      damage: v,
      heal: v,
      shield: v,
      roll,
      rollPct,
      mdf
    }
  }

  const cr = battleLvStatus()
  const defValue = Math.max(
    1,
    Math.floor(creature.getAttackAttributeByName(ms.damageDefense) + ms.damageDefenseD)
  )
  const baseMdf = creature.typeMdf(ms.damageType) + creature.typeMdf(ms.damageAspect)
  const mdf =
    baseMdf + envTypeMdfTotal([ms.damageType, ms.damageAspect], memory.value.attacker) + entry.damageMdfD
  const healMdfVal = ms.damageMdfD + entry.damageMdfD

  return {
    code: entry.code,
    name: creature.name(),
    damage: damageCalcRaw(ms.effect, cr, cr * 2, defValue, 0, mdf, rollPct),
    heal: damageCalcRaw(ms.effect, cr, 1, 1, 0, healMdfVal, rollPct),
    shield: damageCalcRaw(ms.effect, cr, 1, 1, 0, healMdfVal, rollPct),
    roll,
    rollPct,
    mdf
  }
}

const statusResults = computed<StatusResult[]>(() => targets.value.map(computeStatusResult))

// ── 日志预览 ──

const logText = computed<string>(() => {
  const mem = memory.value
  const atk = mem.attacker
  if (atkType.value != 3 && atkType.value != 0 && !atk) return ''

  const atkName = atk?.name() ?? '环境'
  const lines: string[] = []
  const spellName =
    atkType.value == 3
      ? memoryStatus.value.spellName
      : atkType.value == 2
        ? memoryHeal.value.spellName
        : atkType.value == 0
          ? currentMove().name
          : mem.spellName

  const ppCost =
    atkType.value == 3
      ? memoryStatus.value.costPP
      : atkType.value == 2
        ? memoryHeal.value.costPP
        : atkType.value == 0
          ? movem.value.nullCostPP
          : mem.costPP
  const ppLog =
    atk && ppCost != 0 ? `（PP ${atk.currentPP} -> ${Math.max(0, atk.currentPP - ppCost)}）` : ''
  if (targets.value.length > 0) {
    const targetNames = targets.value.map((t) => getCreature(t.code)?.name() ?? '?').join('、')
    if (atk) {
      lines.push(`${atkName}对${targetNames}使用了${spellName}${ppLog}。`)
    } else {
      lines.push(`${targetNames}受到${spellName}的影响。`)
    }
  } else if (atk) {
    lines.push(`${atkName}使用了${spellName}${ppLog}。`)
  } else {
    lines.push(`${spellName}的影响。`)
  }

  // 每个防御方
  for (let i = 0; i < targets.value.length; i++) {
    const entry = targets.value[i]
    const creature = getCreature(entry.code)
    if (!creature) continue

    const bonus =
      (atkType.value == 1
        ? (results.value[i]?.roll ?? 0)
        : atkType.value == 2
          ? (healResults.value[i]?.roll ?? 0)
          : (statusResults.value[i]?.roll ?? 0)) - entry.diceroll

    const ct =
      atkType.value == 1
        ? { e: mem.enableCT, l: mem.ctLimit, m: mem.enableMiss }
        : atkType.value == 2
          ? {
              e: memoryHeal.value.enableCT,
              l: memoryHeal.value.ctLimit,
              m: memoryHeal.value.enableMiss
            }
          : {
              e: memoryStatus.value.enableCT,
              l: memoryStatus.value.ctLimit,
              m: memoryStatus.value.enableMiss
            }

    for (const v of entry.rollHistory) {
      const { roll: dv, rollPct: dp } = dicePct(v, entry.dicerollD, bonus, ct.e, ct.l, ct.m)
      lines.push(
        `【骰子】(${atkName}：${spellName})[${dp}%]D20${bonus > 0 ? '+' : ''}${bonus != 0 ? bonus : ''}=${dv}`
      )
    }

    if (atkType.value == 1) {
      const r = results.value[i]
      if (!r) continue
      const hp = [creature.currentHP, creature.tempHP]
      const preview = handleHP(hp, creature.maxHP(), [-r.damage, 0])
      if (r.damage <= 0) {
        lines.push(`${creature.name()}没有受到伤害。`)
      } else {
        const dt =
          mem.damageType + mem.damageDef + (mem.damageAspect == '无性相' ? '' : mem.damageAspect)
        lines.push(
          `${creature.name()}受到了 ${r.damage} ${dt}伤害（HP ${showHP(hp)} -> ${showHP(preview)}）。`
        )
      }
    } else if (atkType.value == 2) {
      const r = healResults.value[i]
      if (!r) continue
      const hp = [creature.currentHP, creature.tempHP]
      const amt = healMode.value == 'heal' ? r.heal : r.shield
      if (healMode.value == 'heal') {
        lines.push(
          `${creature.name()}回复了 ${amt} HP（HP ${showHP(hp)} -> ${showHP(handleHP(hp, creature.maxHP(), [amt, 0]))}）。`
        )
      } else {
        lines.push(
          `${creature.name()}获得了 ${amt} 护盾（HP ${showHP(hp)} -> ${showHP(handleHP(hp, creature.maxHP(), [0, amt]))}）。`
        )
      }
    } else if (atkType.value == 3) {
      const r = statusResults.value[i]
      if (!r) continue
      const hp = [creature.currentHP, creature.tempHP]
      const ms = memoryStatus.value
      if (statusMode.value == 'damage') {
        if (r.damage <= 0) {
          lines.push(`${creature.name()}没有受到状态伤害。`)
        } else {
          const dt =
            ms.damageType + ms.damageDef + (ms.damageAspect == '无性相' ? '' : ms.damageAspect)
          lines.push(
            `${creature.name()}受到了 ${r.damage} ${dt}状态伤害（HP ${showHP(hp)} -> ${showHP(handleHP(hp, creature.maxHP(), [-r.damage, 0]))}）。`
          )
        }
      } else if (statusMode.value == 'heal') {
        lines.push(
          `${creature.name()}回复了 ${r.heal} HP（HP ${showHP(hp)} -> ${showHP(handleHP(hp, creature.maxHP(), [r.heal, 0]))}）。`
        )
      } else {
        lines.push(
          `${creature.name()}获得了 ${r.shield} 护盾（HP ${showHP(hp)} -> ${showHP(handleHP(hp, creature.maxHP(), [0, r.shield]))}）。`
        )
      }
    }
  }

  return lines.join('\n')
})

function applyAttack(entry: TargetEntry): void {
  const mem = memory.value
  const defender = getCreature(entry.code)
  if (!mem.attacker || !defender) return

  const origDefender = mem.defender
  const origMdfD = mem.damageMdfD
  const origDiceroll = mem.diceroll
  const origDicerollD = mem.dicerollD

  mem.defender = defender
  mem.damageMdfD = entry.damageMdfD
  mem.diceroll = entry.diceroll
  mem.dicerollD = entry.dicerollD

  applyAttackResult()

  mem.defender = origDefender
  mem.damageMdfD = origMdfD
  mem.diceroll = origDiceroll
  mem.dicerollD = origDicerollD
}

function applyCasterCost(): void {
  const atk = memory.value.attacker
  if (!atk) return
  const cost = atkType.value == 3 ? memoryStatus.value.costPP
    : atkType.value == 2 ? memoryHeal.value.costPP
    : atkType.value == 0 ? movem.value.nullCostPP
    : memory.value.costPP
  if (cost > 0) atk.currentPP = Math.max(0, atk.currentPP - cost)
}

function applyAllAttack(): void {
  const log = logText.value
  if (targets.value.length > 0) {
    for (const entry of targets.value) applyAttack(entry)
  } else {
    applyCasterCost()
  }
  navigator.clipboard.writeText(log)
}

function applyHealShield(entry: TargetEntry, action: 'heal' | 'shield'): void {
  const mem = memory.value
  const defender = getCreature(entry.code)
  if (!mem.attacker || !defender) return

  const mh = memoryHeal.value
  const origDefender = mem.defender
  const origMdfD = mh.damageMdfD
  const origDiceroll = mh.diceroll
  const origDicerollD = mh.dicerollD

  mem.defender = defender
  mh.damageMdfD = entry.damageMdfD
  mh.diceroll = entry.diceroll
  mh.dicerollD = entry.dicerollD

  if (action == 'heal') {
    applyHealResult()
  } else {
    applyHealShieldResult()
  }

  mem.defender = origDefender
  mh.damageMdfD = origMdfD
  mh.diceroll = origDiceroll
  mh.dicerollD = origDicerollD
}

function applyAllHeal(action: 'heal' | 'shield'): void {
  const log = logText.value
  if (targets.value.length > 0) {
    for (const entry of targets.value) applyHealShield(entry, action)
  } else {
    applyCasterCost()
  }
  navigator.clipboard.writeText(log)
}

function applyStatus(entry: TargetEntry, action: 'damage' | 'heal' | 'shield'): void {
  const defender = getCreature(entry.code)
  if (!defender) return

  const mem = memory.value
  const ms = memoryStatus.value
  const origDefender = mem.defender
  const origMdfD = ms.damageMdfD
  const origDiceroll = ms.diceroll
  const origDicerollD = ms.dicerollD

  mem.defender = defender
  ms.damageMdfD = entry.damageMdfD
  ms.diceroll = entry.diceroll
  ms.dicerollD = entry.dicerollD

  if (action == 'heal') {
    applyHealStatusResult()
  } else if (action == 'shield') {
    applyHealShieldStatusResult()
  } else {
    applyStatusResult()
  }

  mem.defender = origDefender
  ms.damageMdfD = origMdfD
  ms.diceroll = origDiceroll
  ms.dicerollD = origDicerollD
}

function applyAllStatus(action: 'damage' | 'heal' | 'shield'): void {
  const log = logText.value
  if (targets.value.length > 0) {
    for (const entry of targets.value) applyStatus(entry, action)
  } else {
    applyCasterCost()
  }
  navigator.clipboard.writeText(log)
}

function copyLogToClipboard(): void {
  navigator.clipboard.writeText(logText.value)
}

onUpdated(() => {
  nextTick(() => {
    document.querySelectorAll<HTMLTextAreaElement>('textarea[data-autosize]').forEach(autoResize)
  })
})
</script>

<template>
  <div class="multi-target-panel panel-page">
    <div class="w3-container w3-border w3-round" style="padding: 0.5em; margin-bottom: 0.75em">
      <div style="display: flex; flex-wrap: wrap; gap: 0.5em; align-items: center; justify-content: space-between">
        <div v-if="casterExpanded" style="display: flex; flex-wrap: wrap; gap: 0.5em; align-items: center">
        <span>施法者</span>
        <select
          :value="memory.attacker?.code() ?? ''"
          class="w3-select w3-border"
          style="width: 14em"
          @change="chooseCaster(($event.target as HTMLSelectElement).value)"
        >
          <option value="">未选择</option>
          <option v-for="c in Creatures" :key="c.code()" :value="c.code()">
            {{ c.name() }} {{ c.code() }}
          </option>
        </select>

        <template v-if="memory.attacker != null">
          <span>要使用招式</span>
          <input
            v-model="movem.selectedMove"
            class="w3-input"
            style="width: 10em"
            list="spell-suggestions"
            @change="setCurrentMove()"
          />
          <datalist id="spell-suggestions">
            <option v-for="name in casterMoveList" :key="name" :value="name"></option>
          </datalist>
          <select
            v-model="movem.selectedMove"
            class="w3-select w3-border"
            style="width: 10em"
            @change="setCurrentMove()"
            @wheel="moveWheel"
          >
            <option v-for="name in casterMoveList" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
        </template>
        </div>
        <p v-if="!casterExpanded && memory.attacker != null && currentMove().name.length > 0 && !isNoPower()" style="margin: 0; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
          <span v-if="atkType == 1">攻击方：</span>
          <span v-else>施法者：</span>
          <span style="font-weight: bold">{{ memory.attacker!.name() }}</span>
          <span v-if="atkType == 1">
            | {{ memory.spellName }} | {{ memory.spellType }} | 威力 {{ memory.effect }}
            {{ memory.damageType }}{{ memory.damageDef
            }}{{ memory.damageAspect == '无性相' ? '' : memory.damageAspect }}
          </span>
          <span v-if="atkType == 2">
            | {{ memoryHeal.spellName }} | 威力 {{ memoryHeal.effect }}
          </span>
          <span v-if="atkType == 3">
            | {{ memoryStatus.spellName }} | 威力 {{ memoryStatus.effect }}
          </span>
        </p>
        <button
          class="w3-button w3-tiny w3-light-gray"
          style="flex-shrink: 0"
          @click="casterExpanded = !casterExpanded"
        >
          {{ casterExpanded ? '收起' : '展开' }}
        </button>
      </div>

      <div v-if="casterExpanded && currentMove().name.length > 0" style="margin-top: 0.5em">
        <div v-if="currentMove().inMemory.length <= 0" style="color: crimson">该招式未预备</div>
        <div v-if="currentMove().maxCharge > 0">
          次数剩余：{{ currentMove().chargeAt }} {{ currentMove().charge }} /
          {{ currentMove().maxCharge }}
        </div>
        <div>
          {{ currentMove().ring < 0 ? '动作' : `${currentMove().ring} 环` }}
          {{ currentMove().elemType }}
          {{ currentMove().castAbility }} | 施法资源：{{ currentMove().costs() }} | 施法距离：{{
            currentMove().castRange
          }}{{ currentMove().castRange.includes('*') ? '（受威胁）' : '' }} |
          <span>本次消耗：</span>
          <vue-number-input
            v-if="atkType == 0"
            v-model="movem.nullCostPP"
            size="small"
            inline
            center
            controls
            :step="15"
            :min="0"
          />
          <vue-number-input
            v-if="atkType == 1"
            v-model="memory.costPP"
            size="small"
            inline
            center
            controls
            :step="15"
            :min="0"
          />
          <vue-number-input
            v-if="atkType == 2"
            v-model="memoryHeal.costPP"
            size="small"
            inline
            center
            controls
            :step="15"
            :min="0"
          />
          <vue-number-input
            v-if="atkType == 3"
            v-model="memoryStatus.costPP"
            size="small"
            inline
            center
            controls
            :step="15"
            :min="0"
          />
          <span>PP</span>
        </div>
        <div>
          法术成分：{{ currentMove().components() }} | 持续时间：{{
            currentMove().concentration.length > 0 ? '专注，至多 ' : ''
          }}{{ currentMove().duration.length > 0 ? currentMove().duration : '立即' }}
        </div>
        <div v-if="currentMove().cooldown.length > 0">冷却回合：{{ currentMove().cooldown }}</div>

        <div
          v-if="envDcContributions.length > 0 || envDamageMdfContributions.length > 0"
          class="env-auto-effects"
        >
          <span class="env-auto-title">环境自动修正</span>
          <span v-if="envDcContributions.length > 0" class="env-auto-pill">
            DC {{ contributionValueText(contributionTotal(envDcContributions)) }}：{{
              contributionListText(envDcContributions)
            }}
          </span>
          <span v-if="envDamageMdfContributions.length > 0" class="env-auto-pill">
            伤害修正
            {{ contributionValueText(contributionTotal(envDamageMdfContributions)) }}：{{
              contributionListText(envDamageMdfContributions)
            }}
          </span>
        </div>

      <div
        v-if="currentMove().name.length > 0 && currentMove().powerList.length > 0"
        style="margin-top: 0.5em"
      >
        <div style="display: flex; flex-wrap: wrap; gap: 0.5em; align-items: center">
          <span>选择威力</span>
          <select
            v-model="movem.selectedPowerIdx"
            class="w3-select w3-border"
            style="width: 28em"
            @change="setCurrentMove()"
            @wheel="movePowerWheel"
          >
            <option v-for="pwr in currentMove().powerList" :key="pwr.idx" :value="pwr.idx">
              {{ pwr.message() }}
            </option>
          </select>
          <span>DC {{ currentDC() - movem.dcDelta }} +</span>
          <vue-number-input v-model="movem.dcDelta" size="small" inline center controls :step="1" />
        </div>

        <div
          style="display: flex; flex-wrap: wrap; gap: 0.5em; align-items: center; margin-top: 0.5em"
        >
          <template v-if="atkType == 1">
            <span
              >攻击等级 {{ battleLv() }} | {{ memory.spellType }} 属性一致
              {{ spellTypeStab() }}</span
            >
            <button
              class="w3-button"
              :class="{ 'w3-black': !memory.enableCT }"
              @click="memory.enableCT = memory.enableCT ? 0 : 1"
            >
              {{ memory.enableCT ? '启用暴击' : '禁用暴击' }}
            </button>
            <vue-number-input
              v-model="memory.ctLimit"
              size="small"
              inline
              center
              controls
              :step="1"
              :min="1"
              :max="20"
            />
            <button
              class="w3-button"
              :class="{ 'w3-black': !memory.enableMiss }"
              @click="memory.enableMiss = memory.enableMiss ? 0 : 1"
            >
              {{ memory.enableMiss ? '启用大失败' : '禁用大失败' }}
            </button>
            <button
              class="w3-button"
              :class="{ 'w3-black': !memory.enableAccuracyAdvance }"
              @click="memory.enableAccuracyAdvance = memory.enableAccuracyAdvance ? 0 : 1"
            >
              {{ memory.enableAccuracyAdvance ? '命中减值有效' : '命中减值无效' }}
            </button>
          </template>
          <template v-if="atkType == 2">
            <span>{{ memoryHeal.spellType }} 属性一致 {{ spellTypeStabHeal() }}</span>
            <button
              class="w3-button"
              :class="{ 'w3-black': !memoryHeal.enableCT }"
              @click="memoryHeal.enableCT = memoryHeal.enableCT ? 0 : 1"
            >
              {{ memoryHeal.enableCT ? '启用暴击' : '禁用暴击' }}
            </button>
            <vue-number-input
              v-model="memoryHeal.ctLimit"
              size="small"
              inline
              center
              controls
              :step="1"
              :min="1"
              :max="20"
            />
            <button
              class="w3-button"
              :class="{ 'w3-black': !memoryHeal.enableMiss }"
              @click="memoryHeal.enableMiss = memoryHeal.enableMiss ? 0 : 1"
            >
              {{ memoryHeal.enableMiss ? '启用大失败' : '禁用大失败' }}
            </button>
          </template>
          <template v-if="atkType == 3">
            <span>状态等级 {{ battleLvStatus() }}</span>
            <button
              class="w3-button"
              :class="{ 'w3-black': !memoryStatus.enableCT }"
              @click="memoryStatus.enableCT = memoryStatus.enableCT ? 0 : 1"
            >
              {{ memoryStatus.enableCT ? '启用暴击' : '禁用暴击' }}
            </button>
            <vue-number-input
              v-model="memoryStatus.ctLimit"
              size="small"
              inline
              center
              controls
              :step="1"
              :min="1"
              :max="20"
            />
            <button
              class="w3-button"
              :class="{ 'w3-black': !memoryStatus.enableMiss }"
              @click="memoryStatus.enableMiss = memoryStatus.enableMiss ? 0 : 1"
            >
              {{ memoryStatus.enableMiss ? '启用大失败' : '禁用大失败' }}
            </button>
          </template>
        </div>

        <div
          style="
            display: flex;
            flex-wrap: wrap;
            gap: 0.25em;
            align-items: center;
            margin-top: 0.5em;
          "
        >
          <span>豁免</span>
          <button
            v-for="skill in ['力量', '敏捷', '体质', '智力', '感知', '魅力']"
            :key="skill"
            class="w3-button w3-light-gray"
            @click="setSaveForTargets(skill)"
          >
            {{ skill }} {{ currentDC() }}
          </button>
        </div>

        <div style="margin-top: 0.5em">
          <button
            class="w3-button w3-light-gray"
            @click="showMoveDescription = !showMoveDescription"
          >
            {{ showMoveDescription ? '收起招式描述' : '展开招式描述' }}
          </button>
          <textarea
            v-if="showMoveDescription"
            v-model="currentMove().description"
            data-autosize
            spellcheck="false"
            style="
              width: 100%;
              min-height: 10em;
              resize: vertical;
              box-sizing: border-box;
              margin-top: 0.5em;
            "
          ></textarea>
        </div>
      </div>
      </div>

    </div>

    <div v-if="memory.attacker != null && currentMove().name.length > 0">
      <!-- 目标选择 -->
      <div v-if="!isNoPower()" style="margin-bottom: 0.75em">
        <p class="battlepage-item" style="font-weight: bold; margin-bottom: 0.3em">选择目标</p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.3em">
          <button
            v-for="c in Creatures"
            :key="c.code()"
            class="w3-button w3-tiny"
            :class="{
              'w3-black': surviveMemory.chosen.has(c.code()),
              'w3-light-gray': !surviveMemory.chosen.has(c.code())
            }"
            @click="toggleChosen(c.code())"
          >
            {{ c.name() }}
          </button>
        </div>
      </div>

      <!-- 批量操作 -->
      <div v-if="targets.length > 0" style="margin-bottom: 1em">
        <p class="battlepage-item" style="font-weight: bold">批量操作</p>
        <div style="display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap">
          <button class="w3-button w3-blue" @click="batchRoll">一键掷骰</button>
          <span style="font-size: small; color: gray">
            批量优劣势：
            <vue-number-input v-model="batchAdvantage" size="small" inline center :step="1" />
          </span>
          <button class="w3-button w3-tiny" @click="batchSetAdvantage">应用</button>
          <span style="font-size: small; color: gray">
            批量掷骰：
            <vue-number-input
              v-model="batchDiceroll"
              size="small"
              inline
              center
              :min="1"
              :max="20"
              :step="1"
            />
          </span>
          <button class="w3-button w3-tiny" @click="batchSetDiceroll">应用</button>
          <span style="font-size: small; color: gray"> （优劣势时自动修改世界线） </span>
        </div>
      </div>

      <!-- ── 模式 1：攻击 ── -->
      <div v-if="atkType == 1 && targets.length > 0">
        <table class="w3-table w3-bordered">
          <thead>
            <tr class="w3-light-gray">
              <th>防御方</th>
              <th>防御</th>
              <th>伤害修正</th>
              <th>优劣势</th>
              <th>攻击掷骰</th>
              <th>其他调整值</th>
              <th>最终掷骰</th>
              <th style="font-weight: bold">伤害</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, idx) in targets" :key="entry.code">
              <td>
                {{ results[idx]?.name }}
                <span style="font-size: small; color: gray">{{ entry.code }}</span>
              </td>
              <td>{{ results[idx]?.defValue }}</td>
              <td>
                <vue-number-input
                  v-model="entry.damageMdfD"
                  size="small"
                  inline
                  center
                  :step="0.1"
                />
              </td>
              <td>
                <vue-number-input
                  v-model="entry.advantageDelta"
                  size="small"
                  inline
                  center
                  :step="1"
                />
              </td>
              <td>
                <div style="display: flex; align-items: center; gap: 0.2em">
                  <vue-number-input
                    :model-value="entry.diceroll"
                    size="small"
                    inline
                    center
                    :min="1"
                    :max="20"
                    :step="1"
                    @update:model-value="(v: number) => modifyWorldline(entry, v)"
                  />
                  <button
                    v-if="getCreature(entry.code)?.grandStatus().autoCrit"
                    class="w3-button w3-tiny w3-red"
                    style="color: white"
                    @click="setAutoCrit(entry)"
                  >
                    自动暴击
                  </button>
                  <button v-else class="w3-button w3-tiny w3-border" @click="rollSingle(entry)">
                    🎲
                  </button>
                </div>
              </td>
              <td>
                <vue-number-input v-model="entry.dicerollD" size="small" inline center :step="1" />
              </td>
              <td>
                <span :style="{ color: valueToColor(-results[idx]?.roll), fontWeight: 'bold' }">
                  {{ results[idx]?.roll }} ({{ results[idx]?.rollPct }}%)
                </span>
              </td>
              <td>
                <span
                  style="font-weight: bold; font-size: larger"
                  :style="{ color: results[idx]?.damage > 0 ? '#e53935' : 'gray' }"
                >
                  {{ results[idx]?.damage }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <button class="w3-button w3-red" style="margin-top: 0.5em" @click="applyAllAttack">
          全部应用
        </button>
        <button
          class="w3-button w3-light-gray"
          style="margin-top: 0.5em; margin-left: 0.3em"
          @click="copyLogToClipboard"
        >
          复制到剪贴板
        </button>
      </div>

      <!-- ── 模式 2：治疗 / 护盾 ── -->
      <div v-if="atkType == 2 && targets.length > 0">
        <p class="battlepage-item" style="font-weight: bold">
          <button
            class="w3-button w3-tiny"
            :class="{ 'w3-green': healMode == 'heal', 'w3-light-gray': healMode != 'heal' }"
            @click="healMode = 'heal'"
          >
            治疗模式
          </button>
          <button
            class="w3-button w3-tiny"
            :class="{ 'w3-blue': healMode == 'shield', 'w3-light-gray': healMode != 'shield' }"
            @click="healMode = 'shield'"
          >
            护盾模式
          </button>
        </p>
        <table class="w3-table w3-bordered">
          <thead>
            <tr class="w3-light-gray">
              <th>目标</th>
              <th>HP</th>
              <th>伤害修正</th>
              <th>优劣势</th>
              <th>治疗掷骰</th>
              <th>其他调整值</th>
              <th>最终掷骰</th>
              <th style="font-weight: bold">{{ healMode == 'heal' ? '治疗' : '护盾' }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, idx) in targets" :key="entry.code">
              <td>
                {{ healResults[idx]?.name }}
                <span style="font-size: small; color: gray">{{ entry.code }}</span>
              </td>
              <td>
                {{ getCreature(entry.code)?.currentHP }} / {{ getCreature(entry.code)?.maxHP() }}
                <span v-if="(getCreature(entry.code)?.tempHP ?? 0) > 0"
                  >+{{ getCreature(entry.code)?.tempHP }}</span
                >
              </td>
              <td>
                <vue-number-input
                  v-model="entry.damageMdfD"
                  size="small"
                  inline
                  center
                  :step="0.1"
                />
              </td>
              <td>
                <vue-number-input
                  v-model="entry.advantageDelta"
                  size="small"
                  inline
                  center
                  :step="1"
                />
              </td>
              <td>
                <div style="display: flex; align-items: center; gap: 0.2em">
                  <vue-number-input
                    :model-value="entry.diceroll"
                    size="small"
                    inline
                    center
                    :min="1"
                    :max="20"
                    :step="1"
                    @update:model-value="(v: number) => modifyWorldline(entry, v)"
                  />
                  <button class="w3-button w3-tiny w3-border" @click="rollSingle(entry)">🎲</button>
                </div>
              </td>
              <td>
                <vue-number-input v-model="entry.dicerollD" size="small" inline center :step="1" />
              </td>
              <td>
                <span :style="{ color: valueToColor(-healResults[idx]?.roll), fontWeight: 'bold' }">
                  {{ healResults[idx]?.roll }} ({{ healResults[idx]?.rollPct }}%)
                </span>
              </td>
              <td>
                <span
                  style="font-weight: bold; font-size: larger"
                  :style="{ color: healMode == 'heal' ? '#4caf50' : '#2196f3' }"
                  >{{
                    healMode == 'heal' ? healResults[idx]?.heal : healResults[idx]?.shield
                  }}</span
                >
              </td>
            </tr>
          </tbody>
        </table>
        <button
          class="w3-button"
          :class="healMode == 'heal' ? 'w3-green' : 'w3-blue'"
          style="margin-top: 0.5em"
          @click="applyAllHeal(healMode)"
        >
          全部{{ healMode == 'heal' ? '治疗' : '护盾' }}
        </button>
        <button
          class="w3-button w3-light-gray"
          style="margin-top: 0.5em; margin-left: 0.3em"
          @click="copyLogToClipboard"
        >
          复制到剪贴板
        </button>
      </div>

      <!-- ── 模式 3：状态 ── -->
      <div v-if="atkType == 3 && targets.length > 0">
        <p class="battlepage-item" style="font-weight: bold">
          <button
            class="w3-button w3-tiny"
            :class="{ 'w3-red': statusMode == 'damage', 'w3-light-gray': statusMode != 'damage' }"
            @click="statusMode = 'damage'"
          >
            状态伤害
          </button>
          <button
            class="w3-button w3-tiny"
            :class="{ 'w3-green': statusMode == 'heal', 'w3-light-gray': statusMode != 'heal' }"
            @click="statusMode = 'heal'"
          >
            治疗
          </button>
          <button
            class="w3-button w3-tiny"
            :class="{ 'w3-blue': statusMode == 'shield', 'w3-light-gray': statusMode != 'shield' }"
            @click="statusMode = 'shield'"
          >
            护盾
          </button>
        </p>
        <table class="w3-table w3-bordered">
          <thead>
            <tr class="w3-light-gray">
              <th>目标</th>
              <th>HP</th>
              <th>伤害修正</th>
              <th>优劣势</th>
              <th>状态掷骰</th>
              <th>其他调整值</th>
              <th>最终掷骰</th>
              <th style="font-weight: bold">
                {{ statusMode == 'damage' ? '状态伤害' : statusMode == 'heal' ? '治疗' : '护盾' }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, idx) in targets" :key="entry.code">
              <td>
                {{ statusResults[idx]?.name }}
                <span style="font-size: small; color: gray">{{ entry.code }}</span>
              </td>
              <td>
                {{ getCreature(entry.code)?.currentHP }} / {{ getCreature(entry.code)?.maxHP() }}
                <span v-if="(getCreature(entry.code)?.tempHP ?? 0) > 0"
                  >+{{ getCreature(entry.code)?.tempHP }}</span
                >
              </td>
              <td>
                <vue-number-input
                  v-model="entry.damageMdfD"
                  size="small"
                  inline
                  center
                  :step="0.1"
                />
              </td>
              <td>
                <vue-number-input
                  v-model="entry.advantageDelta"
                  size="small"
                  inline
                  center
                  :step="1"
                />
              </td>
              <td>
                <div style="display: flex; align-items: center; gap: 0.2em">
                  <vue-number-input
                    :model-value="entry.diceroll"
                    size="small"
                    inline
                    center
                    :min="1"
                    :max="20"
                    :step="1"
                    @update:model-value="(v: number) => modifyWorldline(entry, v)"
                  />
                  <button class="w3-button w3-tiny w3-border" @click="rollSingle(entry)">🎲</button>
                </div>
              </td>
              <td>
                <vue-number-input v-model="entry.dicerollD" size="small" inline center :step="1" />
              </td>
              <td>
                <span
                  :style="{ color: valueToColor(-statusResults[idx]?.roll), fontWeight: 'bold' }"
                >
                  {{ statusResults[idx]?.roll }} ({{ statusResults[idx]?.rollPct }}%)
                </span>
              </td>
              <td>
                <span
                  style="font-weight: bold; font-size: larger"
                  :style="{
                    color:
                      statusMode == 'damage'
                        ? '#e53935'
                        : statusMode == 'heal'
                          ? '#4caf50'
                          : '#2196f3'
                  }"
                  >{{
                    statusMode == 'damage'
                      ? statusResults[idx]?.damage
                      : statusMode == 'heal'
                        ? statusResults[idx]?.heal
                        : statusResults[idx]?.shield
                  }}</span
                >
              </td>
            </tr>
          </tbody>
        </table>
        <button
          class="w3-button"
          :class="statusMode == 'damage' ? 'w3-red' : statusMode == 'heal' ? 'w3-green' : 'w3-blue'"
          style="margin-top: 0.5em"
          @click="applyAllStatus(statusMode)"
        >
          全部{{ statusMode == 'damage' ? '状态伤害' : statusMode == 'heal' ? '治疗' : '护盾' }}
        </button>
        <button
          class="w3-button w3-light-gray"
          style="margin-top: 0.5em; margin-left: 0.3em"
          @click="copyLogToClipboard"
        >
          复制到剪贴板
        </button>
      </div>

      <!-- 日志预览 -->
      <div style="margin-top: 1em">
        <textarea
          data-autosize
          :value="logText"
          style="width: 100%; height: 10em; resize: vertical; box-sizing: border-box"
          readonly
        ></textarea>
      </div>
    </div>

    <div v-if="isNoPower() || targets.length == 0" style="margin-top: 0.5em">
      <button
        class="w3-button w3-red"
        @click="applyAllAttack()"
      >
        消耗 PP
      </button>
      <button
        class="w3-button w3-light-gray"
        style="margin-left: 0.3em"
        @click="copyLogToClipboard"
      >
        复制到剪贴板
      </button>
    </div>
  </div>
</template>

<style scoped>
.multi-target-panel :is(input, select, textarea) {
  max-width: 100%;
}

.multi-target-panel :is(input, select)[style*='width'] {
  max-width: 100% !important;
}

.multi-target-panel :is(table.w3-table, table.w3-table-all) {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  white-space: nowrap;
}

.multi-target-panel .w3-container {
  max-width: 100%;
}

.env-auto-effects {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4em;
  margin-top: 0.5em;
}

.env-auto-title {
  font-weight: 600;
  color: #444;
}

.env-auto-pill {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 2px 8px;
  border: 1px solid #d9dde3;
  background: #f6f8fa;
  color: #333;
  font-size: 12px;
  line-height: 1.5;
}
</style>
