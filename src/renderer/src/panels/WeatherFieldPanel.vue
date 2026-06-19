<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import VueNumberInput from '@chenfengyuan/vue-number-input'
import type { IDockviewPanelProps } from 'dockview-core'
import {
  ClimateStates,
  WeatherStates,
  getEnvState
} from '@renderer/model/WeatherField'
import {
  envMemory,
  envEffectIntensity,
  toggleBattleStatusMemory
} from '@renderer/model/GlobalMemory'
import { ElemType, MovePower } from '@renderer/model/DataType'
import Creatures, { Creature } from '@renderer/model/Creature'

const props = defineProps<{ params?: IDockviewPanelProps }>()
const thisCreatures = ref<Creature[]>(Creatures.value)
const compact = ref(false)
const panelRef = ref<HTMLElement | null>(null)
let expandedSize = { width: 760, height: 560 }

// ── 天气 ──

function weatherLayers(name: string): number {
  return envMemory.value.getWeather(name)
}

function setWeather(name: string, layers: number): void {
  envMemory.value.setWeather(name, Math.max(0, Math.floor(layers) || 0))
}

// ── 气候本底 ──

function climateBase(name: string): number {
  return envMemory.value.getClimateBase(name)
}

function setClimateBase(name: string, layers: number): void {
  envMemory.value.setClimateBase(name, Math.max(0, Math.floor(layers) || 0))
}

function climateEffective(name: string): number {
  return envMemory.value.getClimateEffective(name)
}

const activeWeather = computed(() =>
  WeatherStates.map((state) => ({
    name: state.name,
    layers: weatherLayers(state.name)
  })).filter((state) => state.layers > 0)
)

const activeClimate = computed(() =>
  ClimateStates.map((state) => ({
    name: state.name,
    layers: climateEffective(state.name)
  })).filter((state) => state.layers > 0)
)

async function toggleCompact(): Promise<void> {
  const api = props.params?.api
  compact.value = !compact.value
  if (!api) return

  if (compact.value) {
    expandedSize = {
      width: Math.max(420, api.width || expandedSize.width),
      height: Math.max(340, api.height || expandedSize.height)
    }
    api.setConstraints({ minimumWidth: 240, minimumHeight: 64 })
    await nextTick()
    if (api.location.type == 'floating') {
      const contentHeight = panelRef.value?.scrollHeight ?? 64
      api.setSize({
        width: 360,
        height: Math.min(260, Math.max(96, contentHeight + 36))
      })
    }
  } else {
    api.setConstraints({ minimumWidth: 420, minimumHeight: 340 })
    if (api.location.type == 'floating') api.setSize(expandedSize)
  }
}

onMounted(() => {
  props.params?.api.setTitle('天气')
})

function activeHints(name: string, layers: number): string[] {
  const s = getEnvState(name)
  if (!s) return []
  return s.hints.filter((h) => layers >= h.threshold).map((h) => h.text)
}

// ── 有效元素修正汇总 ──

const elementMods = computed<{ elem: string; total: number }[]>(() => {
  const totals = new Map<string, number>()

  for (const c of ClimateStates) {
    const layers = envMemory.value.getClimateEffective(c.name)
    if (layers > 0) {
      for (let i = 0; i < ElemType.nameList.length; i++) {
        const v = c.typeMdf.value[i]
        if (v !== 0) {
          const name = ElemType.nameList[i]
          totals.set(name, (totals.get(name) ?? 0) + v * layers)
        }
      }
    }
  }

  const result: { elem: string; total: number }[] = []
  for (const elem of ElemType.nameList) {
    const t = totals.get(elem)
    if (t && Math.abs(t) >= 0.001) {
      result.push({ elem, total: t })
    }
  }
  return result
})

// ── 状态伤害 / 治疗 ──

function collectMovePowers(): MovePower[] {
  const res: MovePower[] = []

  const gather = (name: string, layers: number): void => {
    if (layers <= 0) return
    const s = getEnvState(name)
    if (!s) return
    for (const mp of s.damageOnTurn) {
      if (mp.power > 0) {
        res.push(
          new MovePower(
            mp.idx,
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
  }

  for (const [name, layers] of Object.entries(envMemory.value.weatherLayers)) gather(name, layers)

  // 起风 ≥10 层：每回合 5×层数 飞行物理钝击状态伤害
  const windLayers = envMemory.value.getClimateEffective('起风')
  if (windLayers >= 10) {
    res.push(new MovePower(0, 5 * windLayers, '飞行', '物理', '钝击', true, '（起风 ≥10 层）'))
  }

  return res
}

const movePowers = computed<MovePower[]>(() => collectMovePowers())

const effectIntensities = computed<{ elem: string; val: number }[]>(() => {
  const result: { elem: string; val: number }[] = []
  for (const elem of ElemType.nameList) {
    const v = envEffectIntensity(elem)
    if (v !== 0) result.push({ elem, val: v })
  }
  return result
})

const chosenTarget = ref<string>('')

function applyMovePower(mp: MovePower): void {
  let targetCode = chosenTarget.value
  if (!targetCode && thisCreatures.value.length > 0) {
    targetCode = thisCreatures.value[0].code()
  }
  if (!targetCode) return
  toggleBattleStatusMemory(
    targetCode,
    0,
    mp.extra,
    mp.power,
    mp.elemType == '无属性' ? '无属性' : mp.elemType,
    '物攻',
    '无加成',
    mp.elemType,
    mp.aspect,
    mp.psType,
    mp.psType == '物理' ? '物防' : '特防'
  )
}
</script>

<template>
  <div ref="panelRef" class="weather-panel" :class="{ 'weather-panel--compact': compact }">
    <div class="weather-panel-header">
      <strong>天气</strong>
      <button
        class="weather-panel-toggle"
        type="button"
        :title="compact ? '展开天气编辑' : '最小化为天气参照'"
        :aria-label="compact ? '展开天气编辑' : '最小化为天气参照'"
        @click="toggleCompact"
      >
        {{ compact ? '□' : '−' }}
      </button>
    </div>

    <div v-if="compact" class="weather-summary">
      <div v-if="activeWeather.length > 0" class="weather-summary-group">
        <span class="weather-summary-label">天气</span>
        <span v-for="item in activeWeather" :key="item.name" class="weather-summary-item weather">
          {{ item.name }} {{ item.layers }}层
        </span>
      </div>
      <div v-if="activeClimate.length > 0" class="weather-summary-group">
        <span class="weather-summary-label">气候</span>
        <span v-for="item in activeClimate" :key="item.name" class="weather-summary-item climate">
          {{ item.name }} {{ item.layers }}层
        </span>
      </div>
      <div v-if="activeWeather.length == 0 && activeClimate.length == 0" class="weather-summary-empty">
        无活跃天气或基本气候
      </div>
    </div>

    <template v-else>
    <!-- ── 天气 ── -->
    <h3>天气</h3>
    <div style="display: flex; flex-wrap: wrap; gap: 0.5em; margin-bottom: 1em">
      <div
        v-for="ws in WeatherStates"
        :key="ws.name"
        class="w3-padding-small"
        :class="{ 'w3-light-gray': weatherLayers(ws.name) > 0 }"
        style="min-width: 14em"
      >
        <span style="font-weight: bold">{{ ws.name }}</span>
        <div style="display: flex; align-items: center; gap: 0.3em; margin-top: 0.3em">
          <button
            class="w3-button w3-tiny w3-border"
            @click="setWeather(ws.name, weatherLayers(ws.name) - 5)"
          >
            -5
          </button>
          <button
            class="w3-button w3-tiny w3-border"
            @click="setWeather(ws.name, weatherLayers(ws.name) - 1)"
          >
            -1
          </button>
          <vue-number-input
            :model-value="weatherLayers(ws.name)"
            size="small"
            inline
            center
            :min="0"
            :step="5"
            @update:model-value="(v: number) => setWeather(ws.name, v)"
          />
          <button
            class="w3-button w3-tiny w3-border"
            @click="setWeather(ws.name, weatherLayers(ws.name) + 1)"
          >
            +1
          </button>
          <button
            class="w3-button w3-tiny w3-border"
            @click="setWeather(ws.name, weatherLayers(ws.name) + 5)"
          >
            +5
          </button>
          层
        </div>
        <div style="font-size: small; color: gray">
          导出：{{ ws.exports.join('、') || '无' }}
          <span v-if="ws.damageOnTurn.length > 0"> | 伤害</span>
        </div>
      </div>
    </div>

    <!-- ── 基本气候 ── -->
    <h3>基本气候</h3>
    <div style="margin-bottom: 1em">
      <div
        v-for="[plus, minus, label] in [
          ['强烈光照', '光照不足', '光照'],
          ['气温上升', '气温下降', '气温'],
          ['湿度上升', '湿度下降', '湿度'],
          ['气压上升', '起风', '气压']
        ]"
        :key="label"
        class="w3-padding-small"
        :class="climateEffective(plus) > 0 || climateEffective(minus) > 0 ? 'w3-light-gray' : ''"
        style="margin-bottom: 0.3em; display: flex; align-items: center; gap: 0.4em"
      >
        <span style="font-weight: bold">{{ label }}</span>

        <button
          class="w3-button w3-tiny w3-border w3-red"
          style="padding: 0 6px; min-width: 28px"
          @click="setClimateBase(minus, climateBase(minus) + 5)"
        >
          -5
        </button>
        <button
          class="w3-button w3-tiny w3-border w3-red"
          style="padding: 0 6px; min-width: 28px"
          @click="setClimateBase(minus, climateBase(minus) + 1)"
        >
          -1
        </button>
        <button
          class="w3-button w3-tiny w3-border w3-green"
          style="padding: 0 6px; min-width: 28px"
          @click="setClimateBase(plus, climateBase(plus) + 1)"
        >
          +1
        </button>
        <button
          class="w3-button w3-tiny w3-border w3-green"
          style="padding: 0 6px; min-width: 28px"
          @click="setClimateBase(plus, climateBase(plus) + 5)"
        >
          +5
        </button>

        <span v-if="climateEffective(plus) > 0">
          <span style="color: #4caf50; font-weight: bold"
            >{{ plus }} {{ climateEffective(plus) }}</span
          >
        </span>
        <span v-if="climateEffective(minus) > 0">
          <span style="color: #e53935; font-weight: bold"
            >{{ minus }} {{ climateEffective(minus) }}</span
          >
        </span>
        <span v-if="climateBase(plus) > 0" style="font-size: small; color: gray; margin-left: 0.3em"
          >本底：{{ plus }} {{ climateBase(plus) }}</span
        >
        <span
          v-if="climateBase(minus) > 0"
          style="font-size: small; color: gray; margin-left: 0.3em"
          >本底：{{ minus }} {{ climateBase(minus) }}</span
        >
        <div
          v-for="h in activeHints(plus, climateEffective(plus)).concat(
            activeHints(minus, climateEffective(minus))
          )"
          :key="h"
          style="font-size: small; color: #2196f3; margin-left: 1em"
        >
          ! {{ h }}
        </div>
      </div>
    </div>

    <!-- ── 总元素修正 ── -->
    <h3>环境元素伤害修正</h3>
    <div
      v-if="elementMods.length > 0"
      style="display: flex; flex-wrap: wrap; gap: 0.4em; margin-bottom: 1em"
    >
      <span
        v-for="mod in elementMods"
        :key="mod.elem"
        class="w3-tag"
        :class="{ 'w3-red': mod.total < 0, 'w3-green': mod.total > 0 }"
      >
        {{ mod.elem }} {{ mod.total > 0 ? '+' : '' }}{{ mod.total.toFixed(1) }}
      </span>
    </div>
    <div v-else style="color: gray; margin-bottom: 1em">无活跃的环境状态</div>
    <p style="font-size: small; color: gray">
      全局天气和气候修正会自动计入伤害计算；地图场地按角色位置另行计算。
    </p>

    <!-- ── 环境效应强度 ── -->
    <h3>环境效应强度（每 5 层 ±2）</h3>
    <div
      v-if="effectIntensities.length > 0"
      style="display: flex; flex-wrap: wrap; gap: 0.4em; margin-bottom: 1em"
    >
      <span
        v-for="ei in effectIntensities"
        :key="ei.elem"
        class="w3-tag"
        :class="{ 'w3-red': ei.val < 0, 'w3-green': ei.val > 0 }"
      >
        {{ ei.elem }} {{ ei.val > 0 ? '+' : '' }}{{ ei.val }}
      </span>
    </div>
    <div v-else style="color: gray; margin-bottom: 1em">无环境效应强度</div>
    <p style="font-size: small; color: gray">
      全局天气和气候加值会自动计入战斗页面的豁免 DC；地图场地按施法者位置另行计算。
    </p>

    <!-- ── 环境状态伤害 / 治疗 ── -->
    <h3>环境状态伤害 / 治疗</h3>
    <div v-if="movePowers.length > 0">
      <p style="font-size: small; color: gray">
        目标：
        <select
          v-model="chosenTarget"
          class="w3-select w3-border"
          style="width: auto; display: inline"
        >
          <option value="">（选择生物）</option>
          <option v-for="c in thisCreatures" :key="c.code()" :value="c.code()">
            {{ c.name() }} {{ c.code() }}
          </option>
        </select>
      </p>
      <div
        v-for="(mp, idx) in movePowers"
        :key="idx"
        class="w3-padding-small"
        :class="mp.isStatus && mp.elemType == '无属性' ? 'w3-pale-green' : 'w3-light-gray'"
        style="display: flex; align-items: center; gap: 0.5em; margin-bottom: 0.3em"
      >
        <span>{{ mp.message() }}</span>
        <button class="w3-button w3-blue" @click="applyMovePower(mp)">跳转</button>
      </div>
    </div>
    <div v-else style="color: gray">无环境状态伤害或治疗</div>
    </template>
  </div>
</template>

<style scoped>
.weather-panel {
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  padding: 0.5em;
}

.weather-panel--compact {
  padding: 6px 8px;
}

.weather-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  margin-bottom: 4px;
}

.weather-panel:not(.weather-panel--compact) .weather-panel-header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 4px;
}

.weather-panel-toggle {
  width: 26px;
  height: 22px;
  padding: 0;
  border: 1px solid #d0d4d9;
  background: #f7f8fa;
  color: #333;
  cursor: pointer;
  line-height: 18px;
}

.weather-panel-toggle:hover {
  background: #e8f0fe;
}

.weather-summary {
  display: grid;
  gap: 5px;
}

.weather-summary-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.weather-summary-label {
  min-width: 2.5em;
  color: #68707a;
  font-size: 11px;
}

.weather-summary-item {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 7px;
  border: 1px solid #d8dde3;
  background: #fff;
  white-space: nowrap;
}

.weather-summary-item.weather {
  border-left: 3px solid #e53935;
}

.weather-summary-item.climate {
  border-left: 3px solid #2196f3;
}

.weather-summary-empty {
  padding: 3px 0;
  color: #777;
  font-size: 12px;
}

.weather-panel :is(input, select) {
  max-width: 100%;
}

.weather-panel [style*='min-width: 14em'] {
  flex: 1 1 14em;
  min-width: min(14em, 100%) !important;
}

.weather-panel [style*='display: flex'][style*='align-items: center'] {
  flex-wrap: wrap;
}

.weather-panel .w3-padding-small {
  border: 1px solid #eee;
}
</style>
