<script setup lang="ts">
import { toolsMemory, ToolsMemory } from '@renderer/model/GlobalMemory'
import { ref, computed } from 'vue'
import { getLunarPhase, getLunarPhasesSequence, formatTime } from '@renderer/model/Lunar'

const memory = ref<ToolsMemory>(toolsMemory.value)

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
  if (!terms) return null
  if (day === 5) return terms[0]
  else if (day === 20) return terms[1]
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
    if (foundTerm) return { term: foundTerm, daysUntil: daysToAdd }
    if (daysToAdd > 366) return null
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
  星期一: '#eebab7', 星期二: '#eed3b7', 星期三: '#eee1b7',
  星期四: '#e1e9b7', 星期五: '#a8c7d6', 星期六: '#baa8d6', 星期日: '#d4a8d6'
}

function lastDay(date: string): string {
  return new Date(new Date(date).setDate(new Date(date).getDate() - 1)).toISOString().split('T')[0]
}

const lunarYesterday = computed(() => getLunarPhase(lastDay(memory.value.selectedDate)))
const lunarToday = computed(() => getLunarPhase(memory.value.selectedDate))
const lunarFuture = computed(() =>
  getLunarPhasesSequence(
    new Date(new Date(memory.value.selectedDate).setDate(new Date(memory.value.selectedDate).getDate() + 1))
      .toISOString().split('T')[0], 7
  )
)

function formatLocalDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/^0+/, '').replaceAll('/0', '/').replace('/', ' 年 ').replace('/', ' 月 ') + ' 日'
}
</script>

<template>
  <div style="height: 100%; overflow-y: auto; padding: 0.5em">
    <p>选择日期：<input v-model="memory.selectedDate" type="date" /></p>
    <div v-if="memory.selectedDate" class="date-info-container">
      <div class="date-display"><span class="date-text">{{ formatLocalDate(memory.selectedDate) }}</span></div>
      <div class="info-row">
        <div class="info-box weekday-box" :style="{ backgroundColor: WEEKDAY_BG_COLORS[getWeekday(memory.selectedDate)] }">
          <span class="info-label">星期</span>
          <span class="info-value">{{ getWeekday(memory.selectedDate) }}</span>
        </div>
        <div class="info-box solar-term-box" :class="{ 'has-term': !!getSolarTerm(memory.selectedDate) }"
          :style="{ backgroundColor: getSolarTerm(memory.selectedDate) ? '#FFEB3B' : '#F5F5F5' }">
          <span class="info-label">{{ getSolarTerm(memory.selectedDate) ? '节气' : '下一个节气' }}</span>
          <span class="info-value">
            {{ getSolarTerm(memory.selectedDate) || (getNextSolarTerm(memory.selectedDate)
              ? `${getNextSolarTerm(memory.selectedDate)!.term}（${getNextSolarTerm(memory.selectedDate)!.daysUntil} 天后）` : '无') }}
          </span>
        </div>
      </div>
    </div>
    <p v-else style="color: #ff6b6b">请选择一个有效日期</p>
    <div v-if="memory.selectedDate" class="lunar-phase-container">
      <div class="lunar-phase-sequence">
        <div class="lunar-phase-box" :style="{ backgroundColor: LUNAR_PHASE_STYLES[lunarYesterday.phase].bgColor, color: LUNAR_PHASE_STYLES[lunarYesterday.phase].color }" title="昨日">
          <span class="lunar-phase-text">{{ lunarYesterday.phase }}<br v-if="lunarYesterday.eventTime" /><span v-if="lunarYesterday.eventTime" class="lunar-phase-time">({{ formatTime(lunarYesterday.eventTime) }})</span></span>
        </div>
        <div class="lunar-phase-box today" :style="{ backgroundColor: LUNAR_PHASE_STYLES[lunarToday.phase].bgColor, color: LUNAR_PHASE_STYLES[lunarToday.phase].color }" title="今日">
          <span class="lunar-phase-text">{{ lunarToday.phase }}<br v-if="lunarToday.eventTime" /><span v-if="lunarToday.eventTime" class="lunar-phase-time">({{ formatTime(lunarToday.eventTime) }})</span></span>
        </div>
        <div v-for="(item, index) in lunarFuture" :key="'future_' + index" class="lunar-phase-box"
          :style="{ backgroundColor: LUNAR_PHASE_STYLES[item.phase].bgColor, color: LUNAR_PHASE_STYLES[item.phase].color }" :title="`+ ${index + 1} 天`">
          <span class="lunar-phase-text">{{ item.phase }}<br v-if="item.eventTime" /><span v-if="item.eventTime" class="lunar-phase-time">({{ formatTime(item.eventTime) }})</span></span>
        </div>
      </div>
      <p>离线计算的月相可能不精确。</p>
    </div>
  </div>
</template>

<style scoped>
.date-info-container { margin-top: 0.5em; }
.date-display { margin-bottom: 0.5em; }
.date-text { font-size: 1.5em; font-weight: bold; color: #333; }
.info-row { display: flex; gap: 1em; justify-content: flex-start; align-items: stretch; }
.info-box { flex: 1; min-width: 10em; padding: 1em; border-radius: 0.5em; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
.weekday-box { border: 1px solid #ccc; }
.solar-term-box.has-term { border: 1px solid #ffc107; }
.info-label { font-size: 0.9em; color: #666; margin-bottom: 0.2em; }
.info-value { font-size: 1.2em; font-weight: bold; color: #333; word-break: break-word; padding: 0 0.2em; }
.lunar-phase-container { margin-top: 1em; }
.lunar-phase-sequence { display: flex; gap: 1em; justify-content: flex-start; align-items: stretch; flex-wrap: nowrap; overflow-x: auto; padding: 0.3em 0.5em 2em 0.5em; }
.lunar-phase-box { flex: 1; min-width: 4em; max-width: 8em; height: 3em; border-radius: 0.5em; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 0.9em; font-weight: bold; padding: 0.5em; position: relative; }
.lunar-phase-box.today { border: 2px solid dodgerblue; transform: scale(1.1); }
.lunar-phase-text { word-break: break-word; padding: 0 0.2em; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; }
.lunar-phase-time { font-size: 0.7em; font-weight: normal; color: #ddd; align-self: flex-end; margin-top: auto; }
.lunar-phase-box::after { content: attr(title); position: absolute; top: calc(100% + 0.3em); left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.8); color: white; padding: 0.2em 0.5em; border-radius: 0.3em; font-size: 0.8em; white-space: nowrap; pointer-events: none; }
</style>
