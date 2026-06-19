<script setup lang="ts">
import { toolsMemory, ToolsMemory } from '@renderer/model/GlobalMemory'
import { ref, computed } from 'vue'
import VueNumberInput from '@chenfengyuan/vue-number-input'

const memory = ref<ToolsMemory>(toolsMemory.value)

const STAT_NAMES = ['HP', '物攻', '物防', '特攻', '特防', '速度']
const REDIST_ORDER = [0, 1, 3, 2, 4, 5]

interface RaceResult {
  bValues: number[]; base: number; cValues: number[]; sumC: number
  dRaw: number[]; dClipped: number[]; dFinal: number[]; total: number; stdDev: number
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
  if (realSumC === 0) {
    const dFinal = bValues.map(() => 100)
    return { bValues, base, cValues, sumC: 0, dRaw: dFinal, dClipped: dFinal, dFinal, total: 600, stdDev: 0 }
  }
  const remaining = 600 - base * 6
  const dRaw: number[] = new Array(6)
  for (let i = 1; i < 6; i++) { dRaw[i] = Math.floor(base + (remaining * cValues[i]) / sumC) }
  dRaw[0] = 600 - dRaw.slice(1).reduce((s, v) => s + v, 0)
  const dClipped = dRaw.map((v) => Math.min(v, 150))
  let truncRemoved = dRaw.reduce((s, v) => s + Math.max(0, v - 150), 0)
  const dFinal = [...dClipped]
  let total = dFinal.reduce((s, v) => s + v, 0)
  while (total < 600 && truncRemoved > 0) {
    let added = false
    for (const idx of REDIST_ORDER) {
      if (total >= 600) break
      if (dFinal[idx] < 150) { dFinal[idx]++; total++; truncRemoved--; added = true }
    }
    if (!added) break
  }
  return { bValues, base, cValues, sumC, dRaw, dClipped, dFinal, total, stdDev }
}

const normalized = computed(() => normalizeRaceStats(memory.value.raceStats))
const pasteInput = ref('')

function applyPaste(): void {
  const nums = pasteInput.value.match(/\d+/g)
  if (!nums || nums.length < 6) return
  for (let i = 0; i < 6; i++) { memory.value.raceStats[i] = parseInt(nums[i]) || 0 }
  pasteInput.value = ''
}
</script>

<template>
  <div class="panel-page">
    <p class="panel-note">输入六项种族值（≥0），自动缩放至总和 600，每项限制在 75 ~ 150。</p>
    <div class="panel-toolbar">
      <span>快速粘贴</span>
      <input
        v-model="pasteInput"
        placeholder="例：100 100 100 100 100 100"
        class="w3-input w3-border paste-input"
        @keyup.enter="applyPaste"
      />
      <button class="w3-button w3-light-gray" @click="applyPaste">填入</button>
    </div>
    <div class="table-wrap">
      <table class="w3-table-all w3-centered dense-table">
      <thead>
        <tr><th></th><th v-for="(name, idx) in STAT_NAMES" :key="idx">{{ name }}</th><th>总和</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>原始种族值</td>
          <td v-for="(_, idx) in STAT_NAMES" :key="idx"><vue-number-input v-model="memory.raceStats[idx]" size="small" inline center controls :min="0" :step="1" /></td>
          <td>{{ memory.raceStats.reduce((s, v) => s + v, 0) }}</td>
        </tr>
        <tr><td>缩放</td><td v-for="(_, idx) in STAT_NAMES" :key="idx">{{ normalized.bValues[idx].toFixed(2) }}</td><td>{{ normalized.bValues.reduce((s, v) => s + v, 0).toFixed(1) }}</td></tr>
        <tr><td>底差</td><td v-for="(_, idx) in STAT_NAMES" :key="idx">{{ normalized.cValues[idx].toFixed(2) }}</td><td>{{ normalized.sumC.toFixed(2) }}</td></tr>
        <tr><td>预分配</td><td v-for="(_, idx) in STAT_NAMES" :key="idx" :style="{ color: normalized.dRaw[idx] > 150 ? 'crimson' : 'inherit' }">{{ normalized.dRaw[idx] }}</td><td>{{ normalized.dRaw.reduce((s, v) => s + v, 0) }}</td></tr>
        <tr style="font-weight: bold"><td>最终结果</td><td v-for="(_, idx) in STAT_NAMES" :key="idx" :style="{ color: normalized.dFinal[idx] === 150 ? 'dodgerblue' : normalized.dFinal[idx] <= 75 ? 'crimson' : 'inherit' }">{{ normalized.dFinal[idx] }}</td><td>{{ normalized.total }}</td></tr>
      </tbody>
      </table>
    </div>
    <p>标准差 = {{ normalized.stdDev.toFixed(2) }}，基准值 = {{ normalized.base }}，剩余点数 = {{ 600 - normalized.base * 6 }}</p>
    <div class="race-explainer">
      <p><b>流程说明：</b></p>
      <ol>
        <li><b>输入 A：</b>输入六项原始种族值（≥0 的整数）。</li>
        <li><b>等比缩放 B：</b>将 A 按比例缩放，使六项总和恰好为 600（全为 0 则跳过）。同时计算 B 的总体标准差 σ。</li>
        <li><b>基准值：</b>根据 σ 动态计算基准值 = ⌊90 − min(15, σ<sup>0.7</sup>)⌋。差异越大，基准值越低（最低 75）。</li>
        <li><b>底差值 C：</b>计算 C<sub>x</sub> = B<sub>x</sub> − min(B)。C 表示各项相对于最低项的超出幅度。</li>
        <li><b>预分配 D：</b>将剩余点数（600 − 基准值 × 6）按 C<sub>x</sub> / ΣC 的比例分配。除 HP 外的五项取 FLOOR，HP 直接由 600 减去其余五项得出。</li>
        <li><b>截断与补偿：</b>将 D 中超过 150 的项截断为 150，截断减少的点数按 HP → 物攻 → 特攻 → 物防 → 特防 → 速度的顺序，轮询分配给不足 150 的项，直至总和达到 600。</li>
      </ol>
      <p><b>种族值只需要在从主系列迁移到 PMDnD 时标准化一次。已经标准化的种族值再次标准化会出现不同的结果。</b></p>
    </div>
  </div>
</template>

<style scoped>
.paste-input {
  flex: 1 1 220px;
  width: auto;
  min-width: 0;
}

.race-explainer {
  max-width: 55em;
  margin-top: 1em;
  color: #555;
  font-size: small;
  line-height: 1.8;
}
</style>
