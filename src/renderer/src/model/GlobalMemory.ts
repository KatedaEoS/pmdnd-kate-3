import { ref } from 'vue'
import { Move, MovePower, Status } from './DataType'
import { d20 } from '../utils'
import { damageCalcRaw, handleHP, showHP } from './Damage'
import Creatures, { Creature } from './Creature'
import { ClimateStates, WeatherStates, getEnvState } from './WeatherField'
import { S_Null } from './Status'
import { fieldLayersForCreature } from './MapFields'

export class MainMemory {
  pageNumber: number
  pendingLoadData: string = ''
  constructor() {
    this.pageNumber = 10
  }
}

export const mainMemory = ref<MainMemory>(new MainMemory())

export class StatusMemory {
  cur: Creature | null
  pageNumber: number
  selectedPowerIdx: number
  initMode: 'individual' | 'grouped'
  currentInitiativeIdx: number
  initiativeTransparent: boolean

  newStatus: Status

  constructor() {
    this.cur = null
    this.pageNumber = 1
    this.selectedPowerIdx = 0
    this.initMode = 'individual'
    this.currentInitiativeIdx = 0
    this.initiativeTransparent = false
    this.newStatus = S_Null.duplicate()
  }
}

export const statusMemory = ref<StatusMemory>(new StatusMemory())

export class ToolsMemory {
  pageName: string
  dropMeters: number
  dropWeight: number
  dropPower: number
  gravity: number

  craftLevel: number
  craftWeaponPower: number
  craftArmorCoef: number

  selectedDate: string

  raceStats: number[]

  constructor() {
    this.pageName = ''
    this.dropMeters = 5
    this.dropWeight = 0
    this.dropPower = 50
    this.gravity = 9.8

    this.craftLevel = 20
    this.craftWeaponPower = 50
    this.craftArmorCoef = 2

    this.selectedDate = new Date().toISOString().split('T')[0]
    this.raceStats = [0, 0, 0, 0, 0, 0]
  }
}

export const toolsMemory = ref<ToolsMemory>(new ToolsMemory())

export class EnvMemory {
  climateBase: Record<string, number> = {}
  weatherLayers: Record<string, number> = {}
  fieldLayers: Record<string, number> = {}
  surfaceLayers: Record<string, number> = {}

  constructor() {
    this.climateBase = {}
    this.weatherLayers = {}
    this.fieldLayers = {}
    this.surfaceLayers = {}
  }

  // ── 天气层数 ──

  setWeather(name: string, layers: number): void {
    if (layers <= 0) {
      delete this.weatherLayers[name]
    } else {
      this.weatherLayers[name] = layers
    }
  }

  getWeather(name: string): number {
    return this.weatherLayers[name] ?? 0
  }

  // ── 气候本底层数 ──

  setClimateBase(name: string, layers: number): void {
    const state = getEnvState(name)
    if (!state || state.category !== '基本气候') return

    // 处理相反状态
    if (state.opposite.length > 0 && layers > 0) {
      const opp = this.climateBase[state.opposite] ?? 0
      if (opp > 0) {
        const net = opp - layers
        if (net > 0) {
          this.climateBase[state.opposite] = net
        } else {
          delete this.climateBase[state.opposite]
          if (net < 0) {
            this.climateBase[name] = -net
          }
        }
        return
      }
    }

    if (layers <= 0) {
      delete this.climateBase[name]
    } else {
      this.climateBase[name] = layers
    }
  }

  getClimateBase(name: string): number {
    return this.climateBase[name] ?? 0
  }

  // 内部：某气候的原始有效层数（本底 + 天气导出，未抵消相反状态）
  getClimateRaw(name: string): number {
    let total = this.climateBase[name] ?? 0
    for (const [wname, wlayers] of Object.entries(this.weatherLayers)) {
      const ws = getEnvState(wname)
      if (ws && ws.exports.includes(name)) {
        total += wlayers
      }
    }
    return total
  }

  // 气候有效层数 = max(0, 本侧原始 − 对侧原始)
  getClimateEffective(name: string): number {
    const self = this.getClimateRaw(name)
    const state = getEnvState(name)
    if (state && state.opposite.length > 0) {
      const opp = this.getClimateRaw(state.opposite)
      return Math.max(0, self - opp)
    }
    return self
  }

  // 天气对某气候的导出层数（净值）
  getWeatherExport(name: string): number {
    let self = 0
    for (const [wname, wlayers] of Object.entries(this.weatherLayers)) {
      const ws = getEnvState(wname)
      if (ws && ws.exports.includes(name)) {
        self += wlayers
      }
    }
    const state = getEnvState(name)
    if (state && state.opposite.length > 0) {
      let opp = 0
      for (const [wname, wlayers] of Object.entries(this.weatherLayers)) {
        const ws = getEnvState(wname)
        if (ws && ws.exports.includes(state.opposite)) {
          opp += wlayers
        }
      }
      self = Math.max(0, self - opp)
    }
    return self
  }

  // ── 场地层数 ──

  setField(name: string, layers: number): void {
    if (layers <= 0) {
      delete this.fieldLayers[name]
    } else {
      this.fieldLayers[name] = layers
    }
  }

  getField(name: string): number {
    return this.fieldLayers[name] ?? 0
  }

  // ── 地表层数 ──

  setSurface(name: string, layers: number): void {
    if (layers <= 0) {
      delete this.surfaceLayers[name]
    } else {
      this.surfaceLayers[name] = layers
    }
  }

  getSurface(name: string): number {
    return this.surfaceLayers[name] ?? 0
  }
}

export const envMemory = ref<EnvMemory>(new EnvMemory())

export interface MapToken {
  code: string
  x: number
  y: number
  color: string
}

export type MapAssetUsage = 'unused' | 'token' | 'background' | 'both'

export interface MapAssetBackground {
  cellSize: number
  offsetX: number
  offsetY: number
  bgWorldW: number
  bgWorldH: number
  gridColor: string
  gridAlpha: number
  gridDashLength: number
  gridLineWidth: number
}

export interface MapAsset {
  key: string
  dataUrl: string
  usage: MapAssetUsage
  background: MapAssetBackground
}

export interface MapFieldData {
  stateName: string
  layers: number
  casterCode: string
  dcAbility: string
  dc: number
  color: string
  remainingRounds: number
}

function defaultMapFieldColor(stateName: string): string {
  const colors: Record<string, string> = {
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
  return colors[stateName] ?? '#607d8b'
}

export class FieldEditMemory {
  selectedDrawingIdx: number = -1
  stateName: string = '电气场地'
  layers: number = 5
  casterCode: string = ''
  dcAbility: string = ''
  dc: number = 10
  color: string = '#f2c94c'
  remainingRounds: number = -1

  toFieldData(): MapFieldData {
    const rawRemainingRounds = Math.floor(this.remainingRounds)
    return {
      stateName: this.stateName || '电气场地',
      layers: Math.max(1, Math.floor(this.layers) || 1),
      casterCode: this.casterCode.trim(),
      dcAbility: this.dcAbility,
      dc: Math.max(0, Math.floor(this.dc) || 0),
      color: this.color || defaultMapFieldColor(this.stateName),
      remainingRounds: Number.isFinite(rawRemainingRounds) ? Math.max(-1, rawRemainingRounds) : -1
    }
  }

  loadFieldData(field: Partial<MapFieldData> | undefined): void {
    const rawRemainingRounds = Math.floor(field?.remainingRounds ?? this.remainingRounds)
    this.stateName = field?.stateName || this.stateName || '电气场地'
    this.layers = Math.max(1, Math.floor(field?.layers ?? this.layers) || 1)
    this.casterCode = field?.casterCode ?? ''
    this.dcAbility = field?.dcAbility ?? ''
    this.dc = Math.max(0, Math.floor(field?.dc ?? this.dc) || 0)
    this.color = field?.color || defaultMapFieldColor(this.stateName)
    this.remainingRounds = Number.isFinite(rawRemainingRounds)
      ? Math.max(-1, rawRemainingRounds)
      : -1
  }
}

export const fieldEditMemory = ref<FieldEditMemory>(new FieldEditMemory())

export class MapMemory {
  tokens: MapToken[] = []
  cellSize: number = 50
  offsetX: number = 0
  offsetY: number = 0
  viewX: number = 0
  viewY: number = 0
  viewScale: number = 1
  bgDataUrl: string = ''
  bgWorldW: number = 1200
  bgWorldH: number = 800
  gridColor: string = '#888888'
  gridAlpha: number = 0.5
  gridDashLength: number = 0
  gridLineWidth: number = 0.5
  fogPolygons: { x: number; y: number }[][] = []
  fogAlpha: number = 0.5
  drawings: MapDrawing[] = []
  tokenImages: { key: string; dataUrl: string }[] = []
  assets: MapAsset[] = []
  currentBackgroundKey: string = ''
  hpDisplayLevels: Record<string, number> = { 玩家: 2, 友方: 2, 中立: 2, 敌方: 2 }
  collapsedSections: string[] = []
  initiativeBarEnabled: boolean = false
  renderScale: number = 1
  fogVisible: boolean = true
}

export interface MapDrawing {
  type: 'rectangle' | 'cone' | 'sector' | 'circle' | 'polygon' | 'arrow' | 'ruler'
  color: string
  alpha: number
  points: { x: number; y: number }[]
  width: number
  angle: number
  field?: MapFieldData
}

export const mapMemory = ref<MapMemory>(new MapMemory())

export class SurviveMemory {
  chosen: Set<string>
  difficulty: number
  logs: string
  isSave: number
  rollMode: 'dice' | 'check' | 'save'
  checkSkill: string
  abilityOverride: string

  tempModifier: number

  chooseMode: number
  prevChosen: Set<string>
  useCustomAdvance: number
  useCustomMin: number

  diceSequence: string
  constructor() {
    this.chosen = new Set<string>([])
    this.difficulty = 10
    this.logs = ''
    this.isSave = 0
    this.rollMode = 'check'
    this.checkSkill = '力量'
    this.abilityOverride = ''

    this.tempModifier = 0

    this.chooseMode = 0
    this.prevChosen = new Set<string>([])
    this.useCustomAdvance = 1
    this.useCustomMin = 1

    this.diceSequence = ''
  }
}

export const surviveMemory = ref<SurviveMemory>(new SurviveMemory())

export class CharacterMemory {
  cur: Creature | null
  pageNumber: number

  movDistance: number
  movDistanceX: number
  movDistanceY: number

  selectedMove: string

  featureSearchKeyword: string
  equipmentSearchKeyword: string

  constructor() {
    this.cur = null
    this.pageNumber = 1
    this.movDistance = 0
    this.movDistanceX = 0
    this.movDistanceY = 0
    this.selectedMove = ''

    this.featureSearchKeyword = ''
    this.equipmentSearchKeyword = ''
  }
}

export const characterMemory = ref<CharacterMemory>(new CharacterMemory())

export class BattleMemory {
  attacker: Creature | null
  defender: Creature | null
  attackType: number

  spellName: string
  effect: number
  costPP: number

  battleLvD: number

  spellType: string
  spellTypeStabD: number
  spellAttack: string
  spellAttackD: number
  spellAttackShield: string
  spellAttackShieldD: number
  spellMod: string
  spellModD: number

  ctLimit: number

  damageType: string
  damageAspect: string
  damageDef: string
  damageDefense: string
  damageDefenseD: number

  damageMdfD: number
  diceroll: number
  dicerollD: number
  advantageDelta: number
  rollHistory: number[]

  enableCT: number
  enableMiss: number
  enableAccuracyAdvance: number

  customDamage: number

  constructor(type: number) {
    this.attacker = null
    this.defender = null
    this.attackType = 1

    this.battleLvD = 0
    this.ctLimit = 20

    if (type != 3) {
      this.spellName = '招式名字'
    } else {
      this.spellName = '状态名字'
    }
    this.effect = 50
    this.costPP = 0
    this.spellType = '无属性'
    this.spellTypeStabD = 0
    if (type != 2) {
      this.spellAttack = '物攻'
    } else {
      this.spellAttack = '特防'
    }
    this.spellAttackD = 0
    if (type != 2) {
      this.spellAttackShield = '物攻'
    } else {
      this.spellAttackShield = '物防'
    }
    this.spellAttackShieldD = 0
    if (type != 2) {
      this.spellMod = '无加成'
    } else {
      this.spellMod = '感知'
    }
    this.spellModD = 0

    this.damageType = '无属性'
    this.damageAspect = '无性相'
    this.damageDef = '物理'
    this.damageDefense = '物防'
    this.damageDefenseD = 0

    this.damageMdfD = 0
    this.diceroll = 10
    this.dicerollD = 0
    this.advantageDelta = 0
    this.rollHistory = [10]
    this.customDamage = 0

    if (type == 1) {
      this.enableCT = 1
      this.enableMiss = 1
      this.enableAccuracyAdvance = 1
    } else if (type == 2) {
      this.enableCT = 1
      this.enableMiss = 0
      this.enableAccuracyAdvance = 0
    } else {
      this.enableCT = 0
      this.enableMiss = 0
      this.enableAccuracyAdvance = 0
    }
  }
}

export const battleMemory = ref<BattleMemory>(new BattleMemory(1))
export const battleMemoryHeal = ref<BattleMemory>(new BattleMemory(2))
export const battleMemoryStatus = ref<BattleMemory>(new BattleMemory(3))

export function onChangeSelectedCreature(code: string): void {
  const index = Creatures.value.findIndex((creature) => creature.code() == code)
  if (index < 0) {
    return
  }
  if (battleMemory.value.attacker == null) {
    battleMemory.value.attacker = Creatures.value[index]
    battleMemory.value.attacker.shallowRefresh()
    battleMemoryHeal.value.battleLvD = 100 - battleMemory.value.attacker.battleLv()
  } else {
    battleMemory.value.defender = Creatures.value[index]
    battleMemory.value.defender.shallowRefresh()
    if (battleMemory.value.defender.grandStatus().autoCrit) {
      battleMemory.value.diceroll = 20
    }
  }
}

export function toggleSurviveMemory(
  code: string,
  skill: string,
  isSave: number,
  difficulty: number
): void {
  surviveMemory.value.chosen.clear()
  surviveMemory.value.chosen.add(code)
  surviveMemory.value.difficulty = difficulty
  surviveMemory.value.checkSkill = skill
  surviveMemory.value.isSave = isSave
  surviveMemory.value.rollMode = isSave ? 'save' : 'check'
  surviveMemory.value.abilityOverride = ''
  mainMemory.value.pageNumber = 5
}

export function toggleBattleStatusMemory(
  code: string,
  costPP: number,
  spellName: string,
  effect: number,
  spellType: string,
  spellAttack: string,
  spellMod: string,
  elemType: string,
  aspect: string,
  psType: string,
  damageDefense: string
): void {
  const index = Creatures.value.findIndex((creature) => creature.code() == code)
  if (index < 0) {
    return
  }
  battleMemory.value.attacker = null
  battleMemory.value.defender = Creatures.value[index]
  battleMemory.value.defender.shallowRefresh()

  battleMemory.value.attackType = 3
  battleMemoryStatus.value.costPP = costPP
  battleMemoryStatus.value.battleLvD = 0
  battleMemoryStatus.value.ctLimit = 20
  battleMemoryStatus.value.spellName = spellName
  battleMemoryStatus.value.effect = effect
  battleMemoryStatus.value.spellType = spellType
  battleMemoryStatus.value.spellTypeStabD = 0
  battleMemoryStatus.value.spellAttack = spellAttack
  battleMemoryStatus.value.spellAttackD = 0
  battleMemoryStatus.value.spellMod = spellMod
  battleMemoryStatus.value.spellModD = 0
  battleMemoryStatus.value.damageType = elemType
  battleMemoryStatus.value.damageAspect = aspect
  battleMemoryStatus.value.damageDef = psType
  battleMemoryStatus.value.damageDefense = damageDefense
  battleMemoryStatus.value.damageDefenseD = 0
  battleMemoryStatus.value.damageMdfD = 0
  battleMemoryStatus.value.diceroll = 10
  battleMemoryStatus.value.dicerollD = 0
  battleMemoryStatus.value.customDamage = 0
  battleMemoryStatus.value.enableCT = 0
  battleMemoryStatus.value.enableMiss = 0
  battleMemoryStatus.value.enableAccuracyAdvance = 0
  mainMemory.value.pageNumber = 1
}

function toggleDamageDefGeneric(memory: BattleMemory): void {
  if (memory.damageDef == '物理') {
    memory.damageDef = '特殊'
    memory.damageDefense = '特防'
    if (memory.spellAttack) {
      memory.spellAttack = '特攻'
    }
  } else {
    memory.damageDef = '物理'
    memory.damageDefense = '物防'
    if (memory.spellAttack) {
      memory.spellAttack = '物攻'
    }
  }
  memory.spellType = memory.damageType
}

export function toggleDamageDef(): void {
  toggleDamageDefGeneric(battleMemory.value)
}

export function toggleStatusDamageDef(): void {
  toggleDamageDefGeneric(battleMemoryStatus.value)
}

export function removeAttacker(): void {
  battleMemory.value.attacker = null
  moveMemory.value.selectedMove = ''
  moveMemory.value.selectedPowerIdx = 0
}

export function removeDefender(): void {
  battleMemory.value.defender = null
}

export function toggleAttackType(value: number): void {
  battleMemory.value.attackType = value
}

function toggleGenericFlag(memory: BattleMemory, flagName): void {
  memory[flagName] = 1 - memory[flagName]
}

export function toggleEnableCT(): void {
  toggleGenericFlag(battleMemory.value, 'enableCT')
}

export function toggleEnableMiss(): void {
  toggleGenericFlag(battleMemory.value, 'enableMiss')
}

export function toggleHealEnableCT(): void {
  toggleGenericFlag(battleMemoryHeal.value, 'enableCT')
}

export function toggleHealEnableMiss(): void {
  toggleGenericFlag(battleMemoryHeal.value, 'enableMiss')
}

export function toggleStatusEnableCT(): void {
  toggleGenericFlag(battleMemoryStatus.value, 'enableCT')
}

export function toggleStatusEnableMiss(): void {
  toggleGenericFlag(battleMemoryStatus.value, 'enableMiss')
}

export function toggleEnableAccuracyAdvance(): void {
  toggleGenericFlag(battleMemory.value, 'enableAccuracyAdvance')
}

function advRollMemory(memory: BattleMemory): void {
  const n = 1 + Math.abs(memory.advantageDelta)
  const rolls = Array.from({ length: n }, () => d20())
  memory.rollHistory = rolls
  memory.diceroll =
    memory.advantageDelta > 0
      ? Math.max(...rolls)
      : memory.advantageDelta < 0
        ? Math.min(...rolls)
        : rolls[0]
}

export function modifyWorldlineMemory(memory: BattleMemory, newValue: number): void {
  const n = memory.rollHistory.length
  if (n <= 1) {
    memory.diceroll = newValue
    memory.rollHistory = [newValue]
    return
  }
  const isAdv = memory.advantageDelta > 0
  const rolls: number[] = []
  for (let i = 0; i < n; i++) {
    rolls.push(
      isAdv
        ? Math.floor(Math.random() * newValue) + 1
        : Math.floor(Math.random() * (21 - newValue)) + newValue
    )
  }
  rolls[Math.floor(Math.random() * n)] = newValue
  memory.rollHistory = rolls
  memory.diceroll = isAdv ? Math.max(...rolls) : Math.min(...rolls)
}

export function rolld20(): void {
  advRollMemory(battleMemory.value)
}

export function rollHeald20(): void {
  advRollMemory(battleMemoryHeal.value)
}

export function rollStatusd20(): void {
  advRollMemory(battleMemoryStatus.value)
}

function calculateBattleLvGeneric(memory: BattleMemory, character: Creature | null): number {
  if (!isFinite(memory.battleLvD)) {
    memory.battleLvD = 0
  }
  if (character != null) {
    return Math.max(1, Math.floor(character.battleLv() + memory.battleLvD))
  }
  return 0
}

export function battleLv(): number {
  return calculateBattleLvGeneric(battleMemory.value, battleMemory.value.attacker)
}

export function battleLvHeal(): number {
  return calculateBattleLvGeneric(battleMemoryHeal.value, battleMemory.value.attacker)
}

export function battleLvStatus(): number {
  return calculateBattleLvGeneric(battleMemoryStatus.value, battleMemory.value.defender)
}

function calculateGenericStab(memory: BattleMemory, attacker: Creature | null): number {
  if (!isFinite(memory.spellTypeStabD)) {
    memory.spellTypeStabD = 0
  }
  if (attacker != null) {
    return Math.floor(attacker.typeStab(memory.spellType) + memory.spellTypeStabD)
  }
  return 0
}

function calculateGenericMod(memory: BattleMemory, attacker: Creature | null): number {
  if (!isFinite(memory.spellModD)) {
    memory.spellModD = 0
  }
  if (attacker != null) {
    return Math.floor(attacker.getModifierByName(memory.spellMod) + memory.spellModD)
  }
  return 0
}

export function spellTypeStab(): number {
  return calculateGenericStab(battleMemory.value, battleMemory.value.attacker)
}

export function spellTypeStabHeal(): number {
  return calculateGenericStab(battleMemoryHeal.value, battleMemory.value.attacker)
}

export function spellModifier(): number {
  return calculateGenericMod(battleMemory.value, battleMemory.value.attacker)
}

export function spellModifierHeal(): number {
  return calculateGenericMod(battleMemoryHeal.value, battleMemory.value.attacker)
}

export function spellModifierStatus(): number {
  return calculateGenericMod(battleMemoryStatus.value, battleMemory.value.attacker)
}

function calculateSpellAttackGeneric(memory: BattleMemory, attacker: Creature | null): number {
  return calcSpellAttackValue(memory.spellAttack, memory.spellAttackD, attacker)
}

function calcSpellAttackValue(
  spellAttack: string,
  spellAttackD: number,
  attacker: Creature | null
): number {
  if (!isFinite(spellAttackD)) {
    spellAttackD = 0
  }
  if (attacker != null) {
    return Math.max(1, Math.floor(attacker.getAttackAttributeByName(spellAttack) + spellAttackD))
  }
  return 0
}

export function spellAttack(): number {
  return calculateSpellAttackGeneric(battleMemory.value, battleMemory.value.attacker)
}

export function spellAttackHeal(): number {
  return calculateSpellAttackGeneric(battleMemoryHeal.value, battleMemory.value.attacker)
}

export function spellAttackHealShield(): number {
  return calcSpellAttackValue(
    battleMemoryHeal.value.spellAttackShield,
    battleMemoryHeal.value.spellAttackShieldD,
    battleMemory.value.attacker
  )
}

function calculateDamageMdfGeneric(
  memory: BattleMemory,
  defender: Creature | null,
  attacker: Creature | null = battleMemory.value.attacker
): number {
  if (!isFinite(memory.damageMdfD)) {
    memory.damageMdfD = 0
  }
  if (defender != null) {
    return (
      defender.typeMdf(memory.damageType) +
      defender.typeMdf(memory.damageAspect) +
      defender.grandStatus().grandMdf +
      envTypeMdfTotal([memory.damageType, memory.damageAspect], attacker) +
      memory.damageMdfD
    )
  }
  return memory.damageMdfD + envTypeMdfTotal([memory.damageType, memory.damageAspect], attacker)
}

export function damageMdf(): number {
  return calculateDamageMdfGeneric(battleMemory.value, battleMemory.value.defender)
}

export function damageMdfStatus(): number {
  return calculateDamageMdfGeneric(battleMemoryStatus.value, battleMemory.value.defender)
}

export function damageMdfStatusHeal(): number {
  return calculateDamageMdfGeneric(battleMemoryStatus.value, null)
}

export function healMdf(): number {
  return calculateDamageMdfGeneric(battleMemoryHeal.value, null)
}

export interface EnvModifierContribution {
  name: string
  layers: number
  value: number
  source: '天气/气候' | '场地'
}

export interface ReadonlyEnvStatusEntry {
  typeLabel: string
  statusName: string
  layers: number
  details: string
}

export function envTypeMdfContributions(
  elements: string[],
  creature: Creature | null = null
): EnvModifierContribution[] {
  const result: EnvModifierContribution[] = []
  const env = envMemory.value

  // 气候状态有效层数
  for (const c of ClimateStates) {
    const layers = env.getClimateEffective(c.name)
    if (layers > 0) {
      let value = 0
      for (const elem of elements) {
        value += c.typeMdf.get(elem) * layers
      }
      if (value != 0) {
        result.push({ name: c.name, layers, value, source: '天气/气候' })
      }
    }
  }

  // 场地状态来自地图上的场地区域，按角色当前位置计算。
  const fieldLayers = creature ? fieldLayersForCreature(creature, mapMemory.value) : {}
  for (const [name, layers] of Object.entries(fieldLayers)) {
    const state = getEnvState(name)
    if (!state) continue
    let value = 0
    for (const elem of elements) {
      value += state.typeMdf.get(elem) * layers
    }
    if (value != 0) {
      result.push({ name, layers, value, source: '场地' })
    }
  }

  return result
}

export function envTypeMdfTotal(elements: string[], creature: Creature | null = null): number {
  return envTypeMdfContributions(elements, creature).reduce((sum, item) => sum + item.value, 0)
}

export function envEffectIntensityContributions(
  elemType: string,
  creature: Creature | null = null
): EnvModifierContribution[] {
  const result: EnvModifierContribution[] = []
  const env = envMemory.value

  for (const c of ClimateStates) {
    const layers = env.getClimateEffective(c.name)
    if (layers >= 5) {
      const value = c.effectIntensity.get(elemType) * Math.floor(layers / 5)
      if (value != 0) {
        result.push({ name: c.name, layers, value, source: '天气/气候' })
      }
    }
  }

  const fieldLayers = creature ? fieldLayersForCreature(creature, mapMemory.value) : {}
  for (const [name, layers] of Object.entries(fieldLayers)) {
    if (layers < 5) continue
    const state = getEnvState(name)
    if (!state) continue
    const value = state.effectIntensity.get(elemType) * Math.floor(layers / 5)
    if (value != 0) {
      result.push({ name, layers, value, source: '场地' })
    }
  }

  // 失序场地：每 5 层任意属性 +2
  const disorderLayers = fieldLayers['失序场地'] ?? 0
  if (disorderLayers >= 5 && elemType !== '无属性') {
    result.push({
      name: '失序场地',
      layers: disorderLayers,
      value: 2 * Math.floor(disorderLayers / 5),
      source: '场地'
    })
  }

  return result
}

export function envEffectIntensity(elemType: string, creature: Creature | null = null): number {
  return envEffectIntensityContributions(elemType, creature).reduce(
    (sum, item) => sum + item.value,
    0
  )
}

function envStateDamageText(name: string, layers: number): string {
  const state = getEnvState(name)
  if (!state || state.damageOnTurn.length <= 0) return ''
  return state.damageOnTurn
    .filter((p) => p.power > 0)
    .map((p) => `${p.power * layers}${p.elemType == '治疗' ? '治疗' : `${p.elemType}伤害`}`)
    .join('、')
}

export function weatherStatusEntries(): ReadonlyEnvStatusEntry[] {
  const env = envMemory.value
  const entries: ReadonlyEnvStatusEntry[] = []

  for (const w of WeatherStates) {
    const layers = env.getWeather(w.name)
    if (layers <= 0) continue
    const hints = w.hints.filter((h) => layers >= h.threshold).map((h) => h.text)
    const damageText = envStateDamageText(w.name, layers)
    if (!damageText && hints.length <= 0) continue
    entries.push({
      typeLabel: '天气',
      statusName: `在${w.name}下`,
      layers,
      details: [damageText, ...hints].filter(Boolean).join('；') || '全局作用'
    })
  }

  for (const c of ClimateStates) {
    const layers = env.getClimateEffective(c.name)
    if (layers <= 0) continue
    const hints = c.hints.filter((h) => layers >= h.threshold).map((h) => h.text)
    const exported = env.getWeatherExport(c.name)
    entries.push({
      typeLabel: '基本气候',
      statusName: `在${c.name}下`,
      layers,
      details:
        [
          exported > 0 ? `天气导出 ${exported} 层` : '',
          envStateDamageText(c.name, layers),
          ...hints
        ]
          .filter(Boolean)
          .join('；') || '全局作用'
    })
  }

  return entries
}

export function environmentDamageOnTurn(creature: Creature | null): MovePower[] {
  const res: MovePower[] = []
  const env = envMemory.value

  const gather = (name: string, layers: number): void => {
    if (layers <= 0) return
    const state = getEnvState(name)
    if (!state) return
    for (const mp of state.damageOnTurn) {
      if (mp.power <= 0) continue
      res.push(
        new MovePower(
          res.length,
          mp.power * layers,
          mp.elemType,
          mp.psType,
          mp.aspect,
          mp.isStatus,
          `（${name} ${layers}层）`
        )
      )
    }
  }

  for (const [name, layers] of Object.entries(env.weatherLayers)) gather(name, layers)
  if (creature) {
    for (const [name, layers] of Object.entries(
      fieldLayersForCreature(creature, mapMemory.value)
    )) {
      gather(name, layers)
    }
  }

  const windLayers = env.getClimateEffective('起风')
  if (windLayers >= 10) {
    res.push(
      new MovePower(res.length, 5 * windLayers, '飞行', '物理', '钝击', true, '（起风 ≥10 层）')
    )
  }

  return res
}

function calculateDamageDefenseGeneric(
  memory: BattleMemory,
  defender: Creature | null,
  equip: boolean = true
): number {
  if (!isFinite(memory.damageDefenseD)) {
    memory.damageDefenseD = 0
  }
  if (defender != null) {
    return Math.max(
      1,
      Math.floor(
        (equip
          ? defender.getAttributeByName(memory.damageDefense)
          : defender.getAttackAttributeByName(memory.damageDefense)) + memory.damageDefenseD
      )
    )
  }
  return 0
}

export function damageDefense(): number {
  return calculateDamageDefenseGeneric(battleMemory.value, battleMemory.value.defender)
}

export function damageDefenseStatus(): number {
  return calculateDamageDefenseGeneric(battleMemoryStatus.value, battleMemory.value.defender, false)
}

export function attackDiceroll(): number {
  if (!isFinite(battleMemory.value.dicerollD)) {
    battleMemory.value.dicerollD = 0
  }
  return (
    battleMemory.value.diceroll + battleMemory.value.dicerollD + accuracyAdvance() + spellModifier()
  )
}

export function healDiceroll(): number {
  if (!isFinite(battleMemoryHeal.value.dicerollD)) {
    battleMemoryHeal.value.dicerollD = 0
  }
  return battleMemoryHeal.value.diceroll + battleMemoryHeal.value.dicerollD + spellModifierHeal()
}

export function statusDiceroll(): number {
  if (!isFinite(battleMemoryStatus.value.dicerollD)) {
    battleMemoryStatus.value.dicerollD = 0
  }
  return battleMemoryStatus.value.diceroll + battleMemoryStatus.value.dicerollD
}

export function dicePct(
  diceroll: number,
  dicerollD: number,
  bonus: number,
  enableCT: number,
  ctLimit: number,
  enableMiss: number
): { roll: number; rollPct: number } {
  const roll = diceroll + dicerollD + bonus
  let rollPct = roll * 5
  if (enableCT && diceroll >= ctLimit) rollPct += 50
  if (enableMiss && diceroll <= 1) rollPct = 0
  return { roll, rollPct: Math.max(0, rollPct) }
}

function calculateDicerollPercentageGeneric(
  baseRollFunc: () => number,
  memory: BattleMemory
): number {
  const { rollPct } = dicePct(
    memory.diceroll,
    memory.dicerollD,
    baseRollFunc() - memory.diceroll - memory.dicerollD,
    memory.enableCT,
    memory.ctLimit,
    memory.enableMiss
  )
  return rollPct
}

export function attackDicerollPercentage(): number {
  return calculateDicerollPercentageGeneric(attackDiceroll, battleMemory.value)
}

export function healDicerollPercentage(): number {
  return calculateDicerollPercentageGeneric(healDiceroll, battleMemoryHeal.value)
}

export function statusDicerollPercentage(): number {
  return calculateDicerollPercentageGeneric(statusDiceroll, battleMemoryStatus.value)
}

export function accuracyAdvance(): number {
  if (battleMemory.value.attacker != null && battleMemory.value.defender != null) {
    const v = battleMemory.value.attacker.accuracy() - battleMemory.value.defender.evasion()
    if (
      battleMemory.value.enableAccuracyAdvance &&
      battleMemory.value.diceroll < battleMemory.value.ctLimit
    ) {
      return v
    } else {
      return Math.max(0, v)
    }
  }
  return 0
}

export function damageCalc(): number {
  if (battleMemory.value.attacker != null && battleMemory.value.defender != null) {
    return damageCalcRaw(
      battleMemory.value.effect,
      battleLv(),
      spellAttack(),
      damageDefense(),
      spellTypeStab(),
      damageMdf(),
      attackDicerollPercentage()
    )
  }
  return 0
}

export function healCalc(): number {
  if (battleMemory.value.attacker != null && battleMemory.value.defender != null) {
    return damageCalcRaw(
      battleMemoryHeal.value.effect,
      battleLv() + battleMemoryHeal.value.battleLvD,
      spellAttackHeal(),
      200,
      spellTypeStabHeal(),
      healMdf(),
      healDicerollPercentage()
    )
  }
  return 0
}

export function healShieldCalc(): number {
  if (battleMemory.value.attacker != null && battleMemory.value.defender != null) {
    return damageCalcRaw(
      battleMemoryHeal.value.effect,
      battleLv() + battleMemoryHeal.value.battleLvD,
      spellAttackHealShield(),
      200,
      spellTypeStabHeal(),
      healMdf(),
      healDicerollPercentage()
    )
  }
  return 0
}

export function statusCalc(heal: boolean = false): number {
  if (!isFinite(battleMemoryStatus.value.customDamage)) {
    battleMemoryStatus.value.customDamage = 0
  }
  battleMemoryStatus.value.customDamage = Math.floor(battleMemoryStatus.value.customDamage)
  if (battleMemory.value.defender != null) {
    if (battleMemoryStatus.value.customDamage > 0) {
      return damageCalcRaw(
        battleMemoryStatus.value.customDamage,
        100,
        1,
        1,
        0,
        damageMdfStatus(),
        100
      )
    }
    if (heal) {
      return damageCalcRaw(
        battleMemoryStatus.value.effect,
        battleLvStatus(),
        1,
        1,
        0,
        damageMdfStatusHeal(),
        statusDicerollPercentage()
      )
    } else {
      return damageCalcRaw(
        battleMemoryStatus.value.effect,
        battleLvStatus(),
        battleLvStatus() * 2,
        damageDefenseStatus(),
        0,
        damageMdfStatus(),
        statusDicerollPercentage()
      )
    }
  }
  return 0
}

export function castMessage(spellName: string, ppCost: number): string {
  if (battleMemory.value.attacker != null) {
    const at = battleMemory.value.attacker.name()
    const df = battleMemory.value.defender ? battleMemory.value.defender.name() : '目标'
    const ppCostLog =
      ppCost != 0
        ? `（PP ${battleMemory.value.attacker.currentPP} -> ${battleMemory.value.attacker.currentPP - ppCost}）`
        : ''
    return `${at}对${df}使用了${spellName}${ppCostLog}。`
  }
  return ''
}

export function diceHistoryLines(
  memory: BattleMemory,
  attacker: string,
  spellName: string,
  bonus: number
): string {
  const lines: string[] = []
  for (const v of memory.rollHistory) {
    const { roll, rollPct } = dicePct(
      v,
      memory.dicerollD,
      bonus,
      memory.enableCT,
      memory.ctLimit,
      memory.enableMiss
    )
    lines.push(
      `【骰子】(${attacker}：${spellName})[${rollPct}%]D20${bonus > 0 ? '+' : ''}${bonus != 0 ? bonus : ''}=${roll}`
    )
  }
  return lines.join('\n')
}

export function diceMessage(
  attacker: string,
  spellName: string,
  per: number,
  mdf: number,
  result: number
): string {
  return `【骰子】(${attacker}：${spellName})[${per}%]D20${mdf > 0 ? '+' : ''}${mdf != 0 ? mdf : ''}=${result}`
}

export function damageMessage(
  damageType: string,
  damageDef: string,
  damageAspect: string,
  dmg: number
): string {
  if (battleMemory.value.defender != null) {
    const df = battleMemory.value.defender.name()
    if (dmg <= 0) {
      return `${df}没有受到伤害。`
    } else {
      const hp = [battleMemory.value.defender.currentHP, battleMemory.value.defender.tempHP]
      return `${df}受到了 ${dmg} ${damageType}${damageDef}${damageAspect == '无性相' ? '' : damageAspect}伤害（HP ${showHP(hp)} -> ${showHP(handleHP(hp, battleMemory.value.defender.maxHP(), [-dmg, 0]))}）。`
    }
  }
  return ''
}

export function nullMessage(): string {
  if (battleMemory.value.attacker != null) {
    return castMessage(currentMove().name, moveMemory.value.nullCostPP)
  }
  return ''
}

export function attackMessage(): string {
  if (battleMemory.value.attacker != null && battleMemory.value.defender != null) {
    const bonus = attackDiceroll() - battleMemory.value.diceroll
    const hist = diceHistoryLines(
      battleMemory.value,
      battleMemory.value.attacker.name(),
      battleMemory.value.spellName,
      bonus
    )
    return (
      castMessage(battleMemory.value.spellName, battleMemory.value.costPP) +
      '\n' +
      hist +
      '\n' +
      damageMessage(
        battleMemory.value.damageType,
        battleMemory.value.damageDef,
        battleMemory.value.damageAspect,
        damageCalc()
      )
    )
  }
  return ''
}

export function healMessage(): string {
  if (battleMemory.value.attacker != null && battleMemory.value.defender != null) {
    const df = battleMemory.value.defender.name()
    const heal = healCalc()
    const hp = [battleMemory.value.defender.currentHP, battleMemory.value.defender.tempHP]
    const bonus = healDiceroll() - battleMemoryHeal.value.diceroll
    const hist = diceHistoryLines(
      battleMemoryHeal.value,
      battleMemory.value.attacker.name(),
      battleMemoryHeal.value.spellName,
      bonus
    )
    return (
      castMessage(battleMemoryHeal.value.spellName, battleMemoryHeal.value.costPP) +
      '\n' +
      hist +
      '\n' +
      `${df}回复了 ${heal} HP（HP ${showHP(hp)} -> ${showHP(handleHP(hp, battleMemory.value.defender.maxHP(), [heal, 0]))}）。`
    )
  }
  return ''
}

export function healShieldMessage(): string {
  if (battleMemory.value.attacker != null && battleMemory.value.defender != null) {
    const df = battleMemory.value.defender.name()
    const heal = healShieldCalc()
    const hp = [battleMemory.value.defender.currentHP, battleMemory.value.defender.tempHP]
    const bonus = healDiceroll() - battleMemoryHeal.value.diceroll
    const hist = diceHistoryLines(
      battleMemoryHeal.value,
      battleMemory.value.attacker.name(),
      battleMemoryHeal.value.spellName,
      bonus
    )
    return (
      castMessage(battleMemoryHeal.value.spellName, battleMemoryHeal.value.costPP) +
      '\n' +
      hist +
      '\n' +
      `${df}获得了 ${heal} 护盾（HP ${showHP(hp)} -> ${showHP(handleHP(hp, battleMemory.value.defender.maxHP(), [0, heal]))}）。`
    )
  }
  return ''
}

export function statusMessage(): string {
  if (battleMemory.value.defender != null) {
    const name = battleMemory.value.attacker?.name() ?? battleMemory.value.defender.name()
    const bonus = statusDiceroll() - battleMemoryStatus.value.diceroll
    const hist = diceHistoryLines(
      battleMemoryStatus.value,
      name,
      battleMemoryStatus.value.spellName,
      bonus
    )
    return (
      (battleMemory.value.attacker != null
        ? castMessage(battleMemoryStatus.value.spellName, battleMemoryStatus.value.costPP) + '\n'
        : '') +
      hist +
      '\n' +
      damageMessage(
        battleMemoryStatus.value.damageType,
        battleMemoryStatus.value.damageDef,
        battleMemoryStatus.value.damageAspect,
        statusCalc(false)
      )
    )
  }
  return ''
}

export function healStatusMessage(): string {
  if (battleMemory.value.defender != null) {
    const df = battleMemory.value.defender.name()
    const heal = statusCalc(true)
    const hp = [battleMemory.value.defender.currentHP, battleMemory.value.defender.tempHP]
    const name = battleMemory.value.attacker?.name() ?? df
    const bonus = statusDiceroll() - battleMemoryStatus.value.diceroll
    const hist = diceHistoryLines(
      battleMemoryStatus.value,
      name,
      battleMemoryStatus.value.spellName,
      bonus
    )
    return (
      (battleMemory.value.attacker != null
        ? castMessage(battleMemoryStatus.value.spellName, battleMemoryStatus.value.costPP) + '\n'
        : '') +
      hist +
      '\n' +
      `${df}回复了 ${heal} HP（HP ${showHP(hp)} -> ${showHP(handleHP(hp, battleMemory.value.defender.maxHP(), [heal, 0]))}）。`
    )
  }
  return ''
}

export function healShieldStatusMessage(): string {
  if (battleMemory.value.defender != null) {
    const df = battleMemory.value.defender.name()
    const heal = statusCalc(true)
    const hp = [battleMemory.value.defender.currentHP, battleMemory.value.defender.tempHP]
    const name = battleMemory.value.attacker?.name() ?? df
    const bonus = statusDiceroll() - battleMemoryStatus.value.diceroll
    const hist = diceHistoryLines(
      battleMemoryStatus.value,
      name,
      battleMemoryStatus.value.spellName,
      bonus
    )
    return (
      (battleMemory.value.attacker != null
        ? castMessage(battleMemoryStatus.value.spellName, battleMemoryStatus.value.costPP) + '\n'
        : '') +
      hist +
      '\n' +
      `${df}获得了 ${heal} 护盾（HP ${showHP(hp)} -> ${showHP(handleHP(hp, battleMemory.value.defender.maxHP(), [0, heal]))}）。`
    )
  }
  return ''
}

export function copyNullMessageToClipboard(): void {
  navigator.clipboard.writeText(nullMessage())
}

export function copyAttackMessageToClipboard(): void {
  navigator.clipboard.writeText(attackMessage())
}

export function copyHealMessageToClipboard(): void {
  navigator.clipboard.writeText(healMessage())
}

export function copyHealShieldMessageToClipboard(): void {
  navigator.clipboard.writeText(healShieldMessage())
}

export function copyStatusMessageToClipboard(): void {
  navigator.clipboard.writeText(statusMessage())
}

export function copyHealStatusMessageToClipboard(): void {
  navigator.clipboard.writeText(healStatusMessage())
}

export function copyHealShieldStatusMessageToClipboard(): void {
  navigator.clipboard.writeText(healShieldStatusMessage())
}

export function applyNullResult(): void {
  if (battleMemory.value.attacker == null) {
    return
  }
  navigator.clipboard.writeText(nullMessage())
  battleMemory.value.attacker.takePP(-moveMemory.value.nullCostPP)
  moveMemory.value.nullCostPP = 0
  moveUseCharge()
}

export function applyAttackResult(): void {
  if (battleMemory.value.attacker == null || battleMemory.value.defender == null) {
    return
  }
  navigator.clipboard.writeText(attackMessage())
  battleMemory.value.attacker.takePP(-battleMemory.value.costPP)
  battleMemory.value.defender.takeHP([-damageCalc(), 0])
  battleMemory.value.costPP = 0
  moveUseCharge()
}

export function applyHealResult(): void {
  if (battleMemory.value.attacker == null || battleMemory.value.defender == null) {
    return
  }
  navigator.clipboard.writeText(healMessage())
  battleMemory.value.attacker.takePP(-battleMemoryHeal.value.costPP)
  battleMemory.value.defender.takeHP([healCalc(), 0])
  battleMemoryHeal.value.costPP = 0
  moveUseCharge()
}

export function applyHealShieldResult(): void {
  if (battleMemory.value.attacker == null || battleMemory.value.defender == null) {
    return
  }
  navigator.clipboard.writeText(healShieldMessage())
  battleMemory.value.attacker.takePP(-battleMemoryHeal.value.costPP)
  battleMemory.value.defender.takeHP([0, healShieldCalc()])
  battleMemoryHeal.value.costPP = 0
  moveUseCharge()
}

export function applyStatusResult(): void {
  if (battleMemory.value.defender == null) {
    return
  }
  navigator.clipboard.writeText(statusMessage())
  if (battleMemory.value.attacker != null) {
    battleMemory.value.attacker.takePP(-battleMemoryStatus.value.costPP)
  }
  battleMemory.value.defender.takeHP([-statusCalc(false), 0])
  battleMemoryStatus.value.costPP = 0
  moveUseCharge()
}

export function applyHealStatusResult(): void {
  if (battleMemory.value.defender == null) {
    return
  }
  navigator.clipboard.writeText(healStatusMessage())
  if (battleMemory.value.attacker != null) {
    battleMemory.value.attacker.takePP(-battleMemoryStatus.value.costPP)
  }
  battleMemory.value.defender.takeHP([statusCalc(true), 0])
  battleMemoryStatus.value.costPP = 0
  moveUseCharge()
}

export function applyHealShieldStatusResult(): void {
  if (battleMemory.value.defender == null) {
    return
  }
  navigator.clipboard.writeText(healShieldStatusMessage())
  if (battleMemory.value.attacker != null) {
    battleMemory.value.attacker.takePP(-battleMemoryStatus.value.costPP)
  }
  battleMemory.value.defender.takeHP([0, statusCalc(true)])
  moveUseCharge()
}

export function getAttackAdvantage(mod: string): number {
  let res = 0
  if (battleMemory.value.attacker != null) {
    res += battleMemory.value.attacker.getAttackAdvantageWithStatus(mod)
  }
  if (battleMemory.value.defender != null) {
    res += battleMemory.value.defender.getUnderAttackAdvantageWithStatus()
  }
  return res
}

export class MoveMemory {
  selectedMove: string
  selectedPowerIdx: number

  nullCostPP: number
  dcDelta: number

  lastMoveName: string

  constructor() {
    this.selectedMove = ''
    this.selectedPowerIdx = 0
    this.nullCostPP = 0
    this.dcDelta = 0
    this.lastMoveName = ''
  }
}

export const moveMemory = ref<MoveMemory>(new MoveMemory())

export function currentMove(): Move {
  return battleMemory.value.attacker?.getMove(moveMemory.value.selectedMove) ?? new Move()
}

export function moveUseCharge(): void {
  if (battleMemory.value.attacker != null && currentMove().maxCharge > 0) {
    currentMove().charge -= 1
  }
}
