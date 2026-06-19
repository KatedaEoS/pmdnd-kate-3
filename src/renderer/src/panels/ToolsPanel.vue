<script setup lang="ts">
import { toolsMemory, ToolsMemory } from '@renderer/model/GlobalMemory'
import { ref, computed } from 'vue'
import VueNumberInput from '@chenfengyuan/vue-number-input'
import { stringHP } from '@renderer/utils'
import Creatures, { Creature } from '@renderer/model/Creature'
import { getLunarPhase, getLunarPhasesSequence, formatTime } from '@renderer/model/Lunar'

const memory = ref<ToolsMemory>(toolsMemory.value)

const thisCreatures = ref<Creature[]>(Creatures.value)

const toolsName = ['日历', '高空抛物', '工匠装备打造', '短休与长休', '种族值标准化']

function onChangeSelectedPage(name: string): void {
  memory.value.pageName = name
}

function dropCoef(height: number): number {
  return Math.max(Math.min(10, (height - 3) / 2), 0)
}

function craftCoef(level: number): number {
  return 0.8 + level / 100
}

function armorPower(armorCoef: number): number[] {
  let bonus = Math.floor((armorCoef * 1000 - 1000) * 0.2)
  let a = Math.floor(bonus / 2)
  return [bonus, a, bonus - a]
}

let refreshKey = ref<number>(0)
let lastSetRest = ref<number>(0)

function setRest(coef: number): void {
  for (let i of thisCreatures.value) {
    if (i.currentHP > 0) {
      i.restHPCoef = coef
      i.restPPCoef = coef
    } else {
      i.restHPCoef = 0
      i.restPPCoef = 0
    }
  }
  lastSetRest.value = coef
  refreshKey.value += 1
}

function resetRest(): void {
  let temp = lastSetRest.value
  setRest(0)
  lastSetRest.value = temp
  refreshKey.value += 1
}

const FACTION_NAMES = ['玩家', '友方', '中立', '敌方']

function setFactionRest(faction: string, coef: number): void {
  for (let i of thisCreatures.value) {
    if (i.faction === faction) {
      if (i.currentHP > 0) {
        i.restHPCoef = coef
        i.restPPCoef = coef
      } else {
        i.restHPCoef = 0
        i.restPPCoef = 0
      }
    }
  }
  if (coef > 0) lastSetRest.value = coef
  refreshKey.value += 1
}

function applyRestResult(): void {
  for (let i of thisCreatures.value) {
    i.takeHP([Math.floor((i.maxHP() * i.restHPCoef) / 100), 0])
    i.takePP(Math.floor((i.maxPP() * i.restPPCoef) / 100))
    for (let m of i.moves) {
      if (m.chargeAt == '每长休' && lastSetRest.value >= 100) {
        m.charge = m.maxCharge
      } else if (m.chargeAt == '每短休' && lastSetRest.value >= 50) {
        m.charge = m.maxCharge
      }
    }
  }
  lastSetRest.value = 0
  refreshKey.value += 1
}

const SOLAR_TERMS_MAP = new Map([
  ['01', ['小寒', '大寒']],
  ['02', ['立春', '雨水']],
  ['03', ['惊蛰', '春分']],
  ['04', ['清明', '谷雨']],
  ['05', ['立夏', '小满']],
  ['06', ['芒种', '夏至']],
  ['07', ['小暑', '大暑']],
  ['08', ['立秋', '处暑']],
  ['09', ['白露', '秋分']],
  ['10', ['寒露', '霜降']],
  ['11', ['立冬', '小雪']],
  ['12', ['大雪', '冬至']]
])

function getWeekday(dateString: string): string {
  const date = new Date(dateString)
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return weekdays[date.getDay()]
}

function getSolarTerm(dateString: string): string | null {
  const date = new Date(dateString)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = date.getDate()

  const terms = SOLAR_TERMS_MAP.get(month)
  if (!terms) {
    return null
  }

  if (day === 5) {
    return terms[0]
  } else if (day === 20) {
    return terms[1]
  }

  return null
}

function getNextSolarTerm(dateString: string): { term: string; daysUntil: number } | null {
  let currentDate = new Date(dateString)
  let daysToAdd = 0

  while (true) {
    daysToAdd++
    const checkDate = new Date(currentDate)
    checkDate.setDate(checkDate.getDate() + daysToAdd)

    const foundTerm = getSolarTerm(checkDate.toISOString().split('T')[0])
    if (foundTerm) {
      return {
        term: foundTerm,
        daysUntil: daysToAdd
      }
    }

    if (daysToAdd > 366) {
      return null
    }
  }
}

const LUNAR_PHASE_STYLES: Record<string, { color: string; bgColor: string }> = {
  朔月: { color: '#ffffff', bgColor: '#000000' },
  蛾眉月: { color: '#e0e0e0', bgColor: '#333333' },
  上弦月: { color: '#c0c0c0', bgColor: '#4d4d4d' },
  盈凸月: { color: '#a0a0a0', bgColor: '#666666' },
  满月: { color: '#f0f0f0', bgColor: '#aaaaaa' },
  亏凸月: { color: '#a0a0a0', bgColor: '#666666' },
  下弦月: { color: '#c0c0c0', bgColor: '#4d4d4d' },
  残月: { color: '#e0e0e0', bgColor: '#333333' }
}

const WEEKDAY_BG_COLORS = {
  星期一: '#eebab7',
  星期二: '#eed3b7',
  星期三: '#eee1b7',
  星期四: '#e1e9b7',
  星期五: '#a8c7d6',
  星期六: '#baa8d6',
  星期日: '#d4a8d6'
}

function lastDay(date: string): string {
  return new Date(new Date(date).setDate(new Date(date).getDate() - 1)).toISOString().split('T')[0]
}

const lunarYesterday = computed(() => getLunarPhase(lastDay(memory.value.selectedDate)))
const lunarToday = computed(() => getLunarPhase(memory.value.selectedDate))
const lunarFuture = computed(() =>
  getLunarPhasesSequence(
    new Date(new Date(memory.value.selectedDate).setDate(new Date(memory.value.selectedDate).getDate() + 1))
      .toISOString()
      .split('T')[0],
    7
  )
)

// ── 种族值标准化 ──
const STAT_NAMES = ['HP', '物攻', '物防', '特攻', '特防', '速度']
// 截断点再分配顺序: HP, 物攻, 特攻, 物防, 特防, 速度
const REDIST_ORDER = [0, 1, 3, 2, 4, 5]

interface RaceResult {
  bValues: number[]
  base: number
  cValues: number[]
  sumC: number
  dRaw: number[]
  dClipped: number[]
  dFinal: number[]
  total: number
  stdDev: number
}

function normalizeRaceStats(stats: number[]): RaceResult {
  const sumA = stats.reduce((s, v) => s + v, 0)
  const bValues = sumA === 0 ? stats.map(() => 0) : stats.map((v) => (v * 600) / sumA)

  const meanB = bValues.reduce((s, v) => s + v, 0) / 6
  const variance = bValues.reduce((s, v) => s + (v - meanB) ** 2, 0) / 6
  const stdDev = Math.sqrt(variance)
  const base = Math.floor(90 - Math.min(15, Math.pow(stdDev, 0.7)))

  const minB = Math.min(...bValues)
  const cValues = bValues.map((v) => v - minB)
  const realSumC = cValues.reduce((s, v) => s + v, 0)
  const sumC = Math.max(1e-10, realSumC)

  // 六项相同时直接均分
  if (realSumC === 0) {
    const dFinal = bValues.map(() => 100)
    return {
      bValues,
      base,
      cValues,
      sumC: 0,
      dRaw: dFinal,
      dClipped: dFinal,
      dFinal,
      total: 600,
      stdDev: 0
    }
  }

  const remaining = 600 - base * 6
  const dRaw: number[] = new Array(6)
  for (let i = 1; i < 6; i++) {
    dRaw[i] = Math.floor(base + (remaining * cValues[i]) / sumC)
  }
  dRaw[0] = 600 - dRaw.slice(1).reduce((s, v) => s + v, 0)

  const dClipped = dRaw.map((v) => Math.min(v, 150))
  let truncRemoved = dRaw.reduce((s, v) => s + Math.max(0, v - 150), 0)

  const dFinal = [...dClipped]
  let total = dFinal.reduce((s, v) => s + v, 0)

  while (total < 600 && truncRemoved > 0) {
    let added = false
    for (const idx of REDIST_ORDER) {
      if (total >= 600) break
      if (dFinal[idx] < 150) {
        dFinal[idx]++
        total++
        truncRemoved--
        added = true
      }
    }
    if (!added) break
  }

  return { bValues, base, cValues, sumC, dRaw, dClipped, dFinal, total, stdDev }
}

const normalized = computed(() => normalizeRaceStats(memory.value.raceStats))

// ── 工匠计算缓存 ──
const craftCoefVal = computed(() => craftCoef(memory.value.craftLevel))
const armorClothing = computed(() => armorPower(craftCoefVal.value * 1.08))
const armorLight = computed(() => armorPower(craftCoefVal.value * 1.25))
const armorMedium = computed(() => armorPower(craftCoefVal.value * 1.5))
const armorHeavy = computed(() => armorPower(craftCoefVal.value * 1.8))
const armorCustom = computed(() => armorPower(craftCoefVal.value * memory.value.craftArmorCoef))

const pasteInput = ref('')

function applyPaste(): void {
  const nums = pasteInput.value.match(/\d+/g)
  if (!nums || nums.length < 6) return
  for (let i = 0; i < 6; i++) {
    memory.value.raceStats[i] = parseInt(nums[i]) || 0
  }
  pasteInput.value = ''
}

function formatLocalDate(dateString: string): string {
  const date = new Date(dateString)
  return (
    date
      .toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      .replace(/^0+/, '')
      .replaceAll('/0', '/')
      .replace('/', ' 年 ')
      .replace('/', ' 月 ') + ' 日'
  )
}
</script>

<template>
  <div class="w3-sidebar w3-bar-block" style="width: 15em">
    <a
      v-for="name in toolsName"
      :key="name"
      class="w3-bar-item w3-button"
      :class="{ 'w3-black': memory.pageName == name }"
      @click="onChangeSelectedPage(name)"
    >
      {{
        name == '日历'
          ? formatLocalDate(memory.selectedDate)
          : name == '高空抛物'
            ? `高空抛物 | g = ${memory.gravity}`
            : name
      }}
    </a>
  </div>
  <div style="margin-left: 15em; padding: 0.5em">
    <div v-if="toolsName[0] == memory.pageName">
      <h3>日历</h3>
      <p>
        选择日期：
        <input v-model="memory.selectedDate" type="date" />
      </p>

      <div v-if="memory.selectedDate" class="date-info-container">
        <div class="date-display">
          <span class="date-text">{{ formatLocalDate(memory.selectedDate) }}</span>
        </div>
        <div class="info-row">
          <div
            class="info-box weekday-box"
            :style="{ backgroundColor: WEEKDAY_BG_COLORS[getWeekday(memory.selectedDate)] }"
            title="星期"
          >
            <span class="info-label">星期</span>
            <span class="info-value">{{ getWeekday(memory.selectedDate) }}</span>
          </div>
          <div
            class="info-box solar-term-box"
            :class="{ 'has-term': !!getSolarTerm(memory.selectedDate) }"
            title="节气"
            :style="{ backgroundColor: getSolarTerm(memory.selectedDate) ? '#FFEB3B' : '#F5F5F5' }"
          >
            <span class="info-label">{{
              getSolarTerm(memory.selectedDate) ? '节气' : '下一个节气'
            }}</span>
            <span class="info-value">
              {{
                getSolarTerm(memory.selectedDate) ||
                (getNextSolarTerm(memory.selectedDate)
                  ? `${getNextSolarTerm(memory.selectedDate)!.term}（${getNextSolarTerm(memory.selectedDate)!.daysUntil} 天后）`
                  : '无')
              }}
            </span>
          </div>
        </div>
      </div>
      <p v-else style="color: #ff6b6b">请选择一个有效日期</p>

      <div v-if="memory.selectedDate" class="lunar-phase-container">
        <div class="lunar-phase-sequence">
          <div
            class="lunar-phase-box"
            :style="{
              backgroundColor:
                LUNAR_PHASE_STYLES[lunarYesterday.phase].bgColor,
              color: LUNAR_PHASE_STYLES[lunarYesterday.phase].color
            }"
            title="昨日"
          >
            <span class="lunar-phase-text"
              >{{ lunarYesterday.phase }}
              <br v-if="lunarYesterday.eventTime" />
              <span
                v-if="lunarYesterday.eventTime"
                class="lunar-phase-time"
              >
                ({{ formatTime(lunarYesterday.eventTime) }})
              </span></span
            >
          </div>

          <div
            class="lunar-phase-box today"
            :style="{
              backgroundColor: LUNAR_PHASE_STYLES[lunarToday.phase].bgColor,
              color: LUNAR_PHASE_STYLES[lunarToday.phase].color
            }"
            title="今日"
          >
            <span class="lunar-phase-text">
              {{ lunarToday.phase }}
              <br v-if="lunarToday.eventTime" />
              <span v-if="lunarToday.eventTime" class="lunar-phase-time">
                ({{ formatTime(lunarToday.eventTime) }})
              </span>
            </span>
          </div>

          <div
            v-for="(item, index) in lunarFuture"
            :key="'future_' + index"
            class="lunar-phase-box"
            :style="{
              backgroundColor: LUNAR_PHASE_STYLES[item.phase].bgColor,
              color: LUNAR_PHASE_STYLES[item.phase].color
            }"
            :title="`+ ${index + 1} 天`"
          >
            <span class="lunar-phase-text">
              {{ item.phase }}
              <br v-if="item.eventTime" />
              <span v-if="item.eventTime" class="lunar-phase-time">
                ({{ formatTime(item.eventTime) }})
              </span>
            </span>
          </div>
        </div>
        <p>离线计算的月相可能不精确。</p>
      </div>
    </div>

    <div v-if="toolsName[1] == memory.pageName">
      <h3>高空抛物</h3>
      <p>
        当前重力加速度系数：<vue-number-input
          v-model="memory.gravity"
          size="medium"
          inline
          center
          controls
          :step="0.1"
          :min="0"
        />
        m·s^-2
      </p>
      <p>
        临时武器重量：<vue-number-input
          v-model="memory.dropWeight"
          size="medium"
          inline
          center
          controls
          :step="0.1"
          :min="0"
        />
        千克
      </p>
      <p>
        临时武器威力：{{ Math.max(0, Math.floor(memory.gravity * Math.sqrt(memory.dropWeight))) }}
      </p>
      <br />
      <p>
        坠落米数：<vue-number-input
          v-model="memory.dropMeters"
          size="medium"
          inline
          center
          controls
          :step="0.1"
          :min="0"
        />
      </p>
      <p>高空抛物系数：{{ dropCoef(memory.dropMeters).toFixed(1) }}</p>
      <p>
        该情况下临时武器威力：<vue-number-input
          v-model="memory.dropPower"
          size="medium"
          inline
          center
          controls
          :step="1"
          :min="0"
        />
      </p>
      <p>最终威力：{{ Math.max(0, Math.floor(dropCoef(memory.dropMeters) * memory.dropPower)) }}</p>
    </div>

    <div v-if="toolsName[2] == memory.pageName">
      <h3>工匠装备打造</h3>
      <p>
        工匠等级：<vue-number-input
          v-model="memory.craftLevel"
          size="medium"
          inline
          center
          controls
          :step="10"
          :min="0"
        />
      </p>
      <p>工匠系数：{{ craftCoefVal.toFixed(1) }}</p>
      <br />
      <p>
        武器初始威力：<vue-number-input
          v-model="memory.craftWeaponPower"
          size="medium"
          inline
          center
          controls
          :step="1"
          :min="0"
        />
      </p>
      <p>
        工匠武器威力：{{
          Math.max(0, Math.floor(Math.sqrt(craftCoefVal) * memory.craftWeaponPower))
        }}
      </p>
      <br />
      <p>
        服装：共计 {{ armorClothing[0] }}% 的提升：比如
        {{ armorClothing[1] }}% 物防和
        {{ armorClothing[2] }}% 特防
      </p>
      <p>
        轻甲：共计 {{ armorLight[0] }}% 的提升：比如
        {{ armorLight[1] }}% 物防和
        {{ armorLight[2] }}% 特防
      </p>
      <p>
        中甲：共计 {{ armorMedium[0] }}% 的提升：比如
        {{ armorMedium[1] }}% 物防和
        {{ armorMedium[2] }}% 特防
      </p>
      <p>
        重甲：共计 {{ armorHeavy[0] }}% 的提升：比如
        {{ armorHeavy[1] }}% 物防和
        {{ armorHeavy[2] }}% 特防
      </p>
      <p>
        自定义防御系数基准：<vue-number-input
          v-model="memory.craftArmorCoef"
          size="medium"
          inline
          center
          controls
          :step="0.1"
          :min="0"
        />
      </p>
      <p>
        自定义护甲：共计 {{ armorCustom[0] }}%
        的提升：比如 {{ armorCustom[1] }}%
        物防和 {{ armorCustom[2] }}% 特防
      </p>
    </div>

    <div v-if="toolsName[3] == memory.pageName">
      <h3>短休与长休</h3>
      <div>
        <button class="w3-button w3-light-gray" style="width: 14%" @click="setRest(50)">
          设置短休
        </button>
        <button class="w3-button w3-light-gray" style="width: 14%" @click="setRest(100)">
          设置长休
        </button>
        <button class="w3-button w3-light-gray" style="width: 14%" @click="resetRest()">
          清空系数
        </button>
      </div>
      <div style="margin-top: 0.5em">
        <span v-for="f in FACTION_NAMES" :key="f" style="margin-right: 0.5em; white-space: nowrap">
          <span
            :style="{
              color: {
                玩家: 'dodgerblue',
                友方: 'mediumseagreen',
                中立: '#f9a825',
                敌方: 'crimson'
              }[f],
              fontWeight: 'bold',
              fontSize: 'small'
            }"
            >{{ f }}</span
          >
          <button class="w3-button w3-tiny w3-light-gray" @click="setFactionRest(f, 50)">
            短休
          </button>
          <button class="w3-button w3-tiny w3-light-gray" @click="setFactionRest(f, 100)">
            长休
          </button>
          <button class="w3-button w3-tiny w3-light-gray" @click="setFactionRest(f, 0)">
            清除
          </button>
        </span>
      </div>
      <p>HP 为 0 的角色无法享受短休或长休的收益。</p>
      <table class="w3-table-all w3-centered dense-table">
        <thead>
          <tr>
            <th>角色</th>
            <th>当前 HP</th>
            <th>当前 PP</th>
            <th>恢复 HP 百分比</th>
            <th>恢复 PP 百分比</th>
            <th>休息后 HP</th>
            <th>休息后 PP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in thisCreatures" :key="i.code()">
            <td>{{ i.name() }}</td>
            <td :style="{ color: i.currentHP <= 0 ? 'crimson' : '' }">
              {{ stringHP(i.hpSet(), i.maxHP()) }}
            </td>
            <td>{{ i.currentPP }}/{{ i.maxPP() }}</td>
            <td>
              <vue-number-input
                v-model="i.restHPCoef"
                size="small"
                inline
                center
                controls
                :min="0"
                :step="5"
                :max="100"
              />
            </td>
            <td>
              <vue-number-input
                v-model="i.restPPCoef"
                size="small"
                inline
                center
                controls
                :step="5"
                :min="0"
                :max="100"
              />
            </td>
            <td :style="{ color: i.currentHP <= 0 ? 'crimson' : '' }">
              {{
                stringHP(i.previewHP([Math.floor((i.maxHP() * i.restHPCoef) / 100), 0]), i.maxHP())
              }}
            </td>
            <td>{{ i.previewPP(Math.floor((i.maxPP() * i.restPPCoef) / 100)) }}/{{ i.maxPP() }}</td>
          </tr>
        </tbody>
      </table>
      <div>
        <button
          v-if="lastSetRest > 0"
          class="w3-button w3-center w3-red w3-right"
          @click="applyRestResult()"
        >
          完成一次{{ lastSetRest == 100 ? '长' : '短' }}休
        </button>
      </div>
    </div>

    <div v-if="toolsName[4] == memory.pageName">
      <h3>种族值标准化</h3>
      <p>输入六项种族值（≥0），自动缩放至总和 600，每项限制在 75 ~ 150。</p>
      <p>
        快速粘贴：
        <input
          v-model="pasteInput"
          placeholder="例：100 100 100 100 100 100"
          style="width: 20em"
          class="w3-input w3-border"
          @keyup.enter="applyPaste"
        />
        <button class="w3-button w3-light-gray" style="margin-left: 0.3em" @click="applyPaste">
          填入
        </button>
      </p>
      <table class="w3-table-all w3-centered dense-table" style="width: 100%">
        <thead>
          <tr>
            <th></th>
            <th v-for="(name, idx) in STAT_NAMES" :key="idx">{{ name }}</th>
            <th>总和</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>原始种族值</td>
            <td v-for="(_, idx) in STAT_NAMES" :key="idx">
              <vue-number-input
                v-model="memory.raceStats[idx]"
                size="small"
                inline
                center
                controls
                :min="0"
                :step="1"
              />
            </td>
            <td>{{ memory.raceStats.reduce((s, v) => s + v, 0) }}</td>
          </tr>
          <tr>
            <td>缩放</td>
            <td v-for="(_, idx) in STAT_NAMES" :key="idx">
              {{ normalized.bValues[idx].toFixed(2) }}
            </td>
            <td>
              {{
                normalized
                  .bValues.reduce((s, v) => s + v, 0)
                  .toFixed(1)
              }}
            </td>
          </tr>
          <tr>
            <td>底差</td>
            <td v-for="(_, idx) in STAT_NAMES" :key="idx">
              {{ normalized.cValues[idx].toFixed(2) }}
            </td>
            <td>
              {{ normalized.sumC.toFixed(2) }}
            </td>
          </tr>
          <tr>
            <td>预分配</td>
            <td
              v-for="(_, idx) in STAT_NAMES"
              :key="idx"
              :style="{
                color: normalized.dRaw[idx] > 150 ? 'crimson' : 'inherit'
              }"
            >
              {{ normalized.dRaw[idx] }}
            </td>
            <td>
              {{ normalized.dRaw.reduce((s, v) => s + v, 0) }}
            </td>
          </tr>
          <tr style="font-weight: bold">
            <td>最终结果</td>
            <td
              v-for="(_, idx) in STAT_NAMES"
              :key="idx"
              :style="{
                color:
                  normalized.dFinal[idx] === 150
                    ? 'dodgerblue'
                    : normalized.dFinal[idx] <= 75
                      ? 'crimson'
                      : 'inherit'
              }"
            >
              {{ normalized.dFinal[idx] }}
            </td>
            <td>{{ normalized.total }}</td>
          </tr>
        </tbody>
      </table>
      <p>
        标准差 = {{ normalized.stdDev.toFixed(2) }}，基准值 =
        {{ normalized.base }}，剩余点数 =
        {{ 600 - normalized.base * 6 }}
      </p>
      <div
        style="max-width: 55em; margin-top: 1em; font-size: small; color: #555; line-height: 1.8"
      >
        <p><b>流程说明：</b></p>
        <ol>
          <li><b>输入 A：</b>输入六项原始种族值（≥0 的整数）。</li>
          <li>
            <b>等比缩放 B：</b>将 A 按比例缩放，使六项总和恰好为 600（全为 0 则跳过）。同时计算 B
            的总体标准差‌ σ。
          </li>
          <li>
            <b>基准值：</b>根据 σ 动态计算基准值 = ⌊90 − min(15,
            σ<sup>0.7</sup>)⌋。差异越大，基准值越低（最低 75）。
          </li>
          <li>
            <b>底差值 C：</b>计算 C<sub>x</sub> = B<sub>x</sub> − min(B)。C
            表示各项相对于最低项的超出幅度。
          </li>
          <li>
            <b>预分配 D：</b>将剩余点数（600 − 基准值 × 6）按 C<sub>x</sub> / ΣC 的比例分配。除 HP
            外的五项取 FLOOR，HP 直接由 600 减去其余五项得出。
          </li>
          <li>
            <b>截断与补偿：</b>将 D 中超过 150 的项截断为 150，截断减少的点数按 HP → 物攻 → 特攻 →
            物防 → 特防 → 速度的顺序，轮询分配给不足 150 的项，直至总和达到 600。
          </li>
        </ol>
        <p>
          <b
            >种族值只需要在从主系列迁移到 PMDnD
            时标准化一次。已经标准化的种族值再次标准化会出现不同的结果。</b
          >
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.date-info-container {
  margin-top: 0.5em;
}

.date-display {
  margin-bottom: 0.5em;
}

.date-text {
  font-size: 1.5em;
  font-weight: bold;
  color: #333;
}

.info-row {
  display: flex;
  gap: 1em;
  justify-content: flex-start;
  align-items: stretch;
}

.info-box {
  flex: 1;
  min-width: 10em;
  padding: 1em;
  border-radius: 0.5em;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  cursor: default;
  position: relative;
}

.weekday-box {
  border: 1px solid #ccc;
}

.solar-term-box.has-term {
  border: 1px solid #ffc107;
}

.info-label {
  font-size: 0.9em;
  color: #666;
  margin-bottom: 0.2em;
}

.info-value {
  font-size: 1.2em;
  font-weight: bold;
  color: #333;
  word-break: break-word;
  padding: 0 0.2em;
}

.lunar-phase-container {
  margin-top: 1em;
}

.lunar-phase-sequence {
  display: flex;
  gap: 1em;
  justify-content: flex-start;
  align-items: stretch;
  flex-wrap: nowrap;
  overflow-x: auto;
  padding: 0.3em 0.5em 2em 0.5em;
}

.lunar-phase-box {
  flex: 1;
  min-width: 4em;
  max-width: 8em;
  height: 3em;
  border-radius: 0.5em;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 0.9em;
  font-weight: bold;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  cursor: default;
  position: relative;
  padding: 0.5em;
}

.lunar-phase-box.today {
  border: 2px solid dodgerblue;
  transform: scale(1.1);
}

.lunar-phase-text {
  word-break: break-word;
  padding: 0 0.2em;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.lunar-phase-time {
  font-size: 0.7em;
  font-weight: normal;
  color: #ddd;
  align-self: flex-end;
  margin-top: auto;
}

.lunar-phase-box::after {
  content: attr(title);
  position: absolute;
  top: calc(100% + 0.3em);
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.2em 0.5em;
  border-radius: 0.3em;
  font-size: 0.8em;
  white-space: nowrap;
  opacity: 1;
  visibility: visible;
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease;
  pointer-events: none;
}
</style>
