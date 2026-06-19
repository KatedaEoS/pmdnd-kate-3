import { ElemType, MovePower } from './DataType'

export type EnvCategory = '基本气候' | '天气' | '背景场地' | '普通场地'

export class EnvState {
  name: string
  category: EnvCategory
  opposite: string
  typeMdf: ElemType
  effectIntensity: ElemType
  damageOnTurn: MovePower[]
  exports: string[]
  hints: { threshold: number; text: string }[]

  constructor(
    name: string,
    category: EnvCategory,
    opposite: string,
    typeMdf: ElemType,
    effectIntensity: ElemType = new ElemType(),
    damageOnTurn: MovePower[] = [],
    exports: string[] = [],
    hints: { threshold: number; text: string }[] = []
  ) {
    this.name = name
    this.category = category
    this.opposite = opposite
    this.typeMdf = typeMdf
    this.effectIntensity = effectIntensity
    this.damageOnTurn = damageOnTurn
    this.exports = exports
    this.hints = hints
  }

  duplicate(): EnvState {
    return new EnvState(
      this.name,
      this.category,
      this.opposite,
      new ElemType([...this.typeMdf.value]),
      new ElemType([...this.effectIntensity.value]),
      this.damageOnTurn.map(
        (m) => new MovePower(m.idx, m.power, m.elemType, m.psType, m.aspect, m.isStatus, m.extra)
      ),
      [...this.exports],
      this.hints.map((h) => ({ ...h }))
    )
  }
}

function et(vals: [string, number][]): ElemType {
  const arr = new Array(ElemType.nameList.length).fill(0)
  for (const [name, val] of vals) {
    const idx = ElemType.nameList.indexOf(name)
    if (idx >= 0) arr[idx] = val
  }
  return new ElemType(arr)
}

// ── 基本气候状态 ──

export const C_IntenseLight = new EnvState(
  '强烈光照',
  '基本气候',
  '光照不足',
  et([
    ['草', 0.1],
    ['光耀', 0.1],
    ['黯蚀', -0.1]
  ]),
  et([
    ['草', 2],
    ['光耀', 2],
    ['黯蚀', -2]
  ])
)

export const C_LowLight = new EnvState(
  '光照不足',
  '基本气候',
  '强烈光照',
  new ElemType(),
  new ElemType(),
  [],
  [],
  [
    { threshold: 10, text: '能见度 ≤ 60m' },
    { threshold: 15, text: '微光光照，能见度 ≤ 30m' },
    { threshold: 20, text: '黑暗光照，能见度 ≤ 12m' }
  ]
)

export const C_TempRise = new EnvState(
  '气温上升',
  '基本气候',
  '气温下降',
  et([
    ['火', 0.1],
    ['冰', -0.1]
  ]),
  et([
    ['火', 2],
    ['冰', -2]
  ]),
  [],
  [],
  [{ threshold: 11, text: '每多 1 层炎热基准 +1' }]
)

export const C_TempDrop = new EnvState(
  '气温下降',
  '基本气候',
  '气温上升',
  et([
    ['冰', 0.1],
    ['火', -0.1]
  ]),
  et([
    ['冰', 2],
    ['火', -2]
  ]),
  [],
  [],
  [{ threshold: 11, text: '每多 1 层寒冷基准 +1' }]
)

export const C_HumidRise = new EnvState(
  '湿度上升',
  '基本气候',
  '湿度下降',
  et([
    ['水', 0.1],
    ['火', -0.1]
  ]),
  et([
    ['水', 2],
    ['火', -2]
  ]),
  [],
  [],
  [{ threshold: 11, text: '每多 1 层潮湿基准 +1' }]
)

export const C_HumidDrop = new EnvState(
  '湿度下降',
  '基本气候',
  '湿度上升',
  et([['水', -0.1]]),
  et([
    ['地面', 2],
    ['岩石', 2],
    ['水', -2]
  ]),
  [],
  [],
  [{ threshold: 11, text: '每多 1 层干燥基准 +1' }]
)

export const C_PressureRise = new EnvState(
  '气压上升',
  '基本气候',
  '起风',
  et([['飞行', 0.1]]),
  et([['飞行', 2]]),
  [],
  [],
  [
    { threshold: 6, text: '飞行/滑翔移动力消耗 0.5 倍' },
    { threshold: 10, text: '实体飞行物射程 +1 倍' }
  ]
)

export const C_Wind = new EnvState(
  '起风',
  '基本气候',
  '气压上升',
  et([['飞行', 0.1]]),
  new ElemType(),
  [],
  [],
  [
    { threshold: 6, text: '雾/粉尘消散速度 +1 倍' },
    { threshold: 8, text: '困难地形，实体飞行物射程减半' },
    { threshold: 10, text: '每回合受到 5×层数 飞行物理钝击伤害，可能倒地' }
  ]
)

// ── 天气状态（通过 exports 导出基本气候状态，自身 typeMdf 为空）──

export const W_Sun = new EnvState(
  '暴晒',
  '天气',
  '',
  new ElemType(),
  new ElemType(),
  [],
  ['强烈光照', '气温上升', '湿度下降']
)

export const W_Rain = new EnvState(
  '下雨',
  '天气',
  '',
  new ElemType(),
  new ElemType(),
  [],
  ['光照不足', '湿度上升']
)

export const W_Snow = new EnvState(
  '下雪',
  '天气',
  '',
  new ElemType(),
  new ElemType(),
  [],
  ['光照不足', '气温下降']
)

export const W_Hail = new EnvState(
  '冰雹',
  '天气',
  '',
  new ElemType(),
  new ElemType(),
  [new MovePower(0, 10, '冰', '物理', '钝击', true, '（冰雹）')],
  ['光照不足', '气温下降']
)

export const W_Sandstorm = new EnvState(
  '沙尘暴',
  '天气',
  '',
  new ElemType(),
  new ElemType(),
  [new MovePower(0, 10, '岩石', '物理', '钝击', true, '（沙尘暴）')],
  ['光照不足', '湿度下降', '起风']
)

export const W_Fog = new EnvState(
  '起雾',
  '天气',
  '',
  new ElemType(),
  new ElemType(),
  [],
  ['光照不足']
)

// ── 背景场地状态 ──

export const F_Electric = new EnvState(
  '电气场地',
  '背景场地',
  '',
  et([['电', 0.1]]),
  et([['电', 2]]),
  [],
  [],
  [{ threshold: 1, text: '地面生物无法获得睡眠/瞌睡' }]
)

export const F_Misty = new EnvState(
  '薄雾场地',
  '背景场地',
  '',
  et([
    ['妖精', 0.1],
    ['龙', -0.1]
  ]),
  et([
    ['妖精', 2],
    ['龙', -2]
  ]),
  [],
  [],
  [{ threshold: 1, text: '地面生物无法获得畏缩/震慑' }]
)

export const F_Psychic = new EnvState(
  '精神场地',
  '背景场地',
  '',
  et([
    ['超能力', 0.1],
    ['恶', -0.1],
    ['幽灵', -0.1]
  ]),
  et([
    ['超能力', 2],
    ['恶', -2],
    ['幽灵', -2]
  ]),
  [],
  [],
  [{ threshold: 1, text: '地面生物无法获得恍惚/恐慌' }]
)

export const F_Grassy = new EnvState(
  '青草场地',
  '背景场地',
  '',
  et([['草', 0.1]]),
  et([['草', 2]]),
  [new MovePower(0, 10, '治疗', '', '', true, '（青草场地）')],
  [],
  [{ threshold: 1, text: '回合开始时 HP>0 的生物获得治疗' }]
)

export const F_Shadowy = new EnvState(
  '幽暗场地',
  '背景场地',
  '',
  et([
    ['幽灵', 0.1],
    ['黯蚀', 0.1],
    ['草', -0.1],
    ['光耀', -0.1]
  ]),
  et([
    ['幽灵', 2],
    ['黯蚀', 2],
    ['草', -2],
    ['光耀', -2]
  ]),
  [],
  [],
  [{ threshold: 1, text: '地面生物无法获得困惑/混乱' }]
)

export const F_Dragon = new EnvState(
  '龙之场地',
  '背景场地',
  '',
  et([
    ['龙', 0.1],
    ['妖精', -0.1]
  ]),
  et([
    ['龙', 2],
    ['妖精', -2]
  ]),
  [],
  [],
  [{ threshold: 1, text: '地面生物无法获得迷离/魅惑' }]
)

export const F_Disorder = new EnvState(
  '失序场地',
  '背景场地',
  '',
  et([['力场', 0.1]]),
  new ElemType(),
  [],
  [],
  [{ threshold: 1, text: '覆盖场地时可能触发失序场地，阈值随失败递减' }]
)

// ── 普通场地状态 ──

export const S_Icy = new EnvState('结冰地表', '普通场地', '', new ElemType())

export const S_Burning = new EnvState('着火地表', '普通场地', '', new ElemType(), new ElemType(), [
  new MovePower(0, 10, '火', '特殊', '', true, '（着火地表）')
])

// ── 分类列表 ──

export const ClimateStates: EnvState[] = [
  C_IntenseLight,
  C_LowLight,
  C_TempRise,
  C_TempDrop,
  C_HumidRise,
  C_HumidDrop,
  C_PressureRise,
  C_Wind
]

export const WeatherStates: EnvState[] = [W_Sun, W_Rain, W_Snow, W_Hail, W_Sandstorm, W_Fog]

export const FieldStates: EnvState[] = [
  F_Electric,
  F_Misty,
  F_Psychic,
  F_Grassy,
  F_Shadowy,
  F_Dragon,
  F_Disorder
]

export const SurfaceStates: EnvState[] = [S_Icy, S_Burning]

export const AllEnvStates: EnvState[] = [
  ...ClimateStates,
  ...WeatherStates,
  ...FieldStates,
  ...SurfaceStates
]

export function getEnvState(name: string): EnvState | undefined {
  return AllEnvStates.find((a) => a.name == name)?.duplicate()
}
