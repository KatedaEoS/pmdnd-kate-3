<script setup lang="ts">
import Creatures, { Creature } from '@renderer/model/Creature'
import {
  environmentDamageOnTurn,
  envTypeMdfTotal,
  mapMemory,
  statusMemory,
  StatusMemory,
  weatherStatusEntries
} from '@renderer/model/GlobalMemory'
import { ref, computed, onBeforeUnmount, nextTick, onUpdated } from 'vue'
import VueNumberInput from '@chenfengyuan/vue-number-input'
import { damageCalcRaw, showHP, handleHP } from '@renderer/model/Damage'
import { MovePower } from '@renderer/model/DataType'
import type { Status } from '@renderer/model/DataType'
import { S_Null, StatusList } from '@renderer/model/Status'
import { autoResize, toMod, valueToColorBinary } from '@renderer/utils'
import { fieldRemainingText, fieldStatusesForCreature } from '@renderer/model/MapFields'

function valueToColor(val: number): string {
  if (val == 0) {
    return 'lightgray'
  } else if (val > 0) {
    return 'crimson'
  } else {
    return 'dodgerblue'
  }
}

const thisCreatures = ref<Creature[]>(Creatures.value)
const memory = ref<StatusMemory>(statusMemory.value)

function toPartPage(): void {
  if (memory.value.cur != null) {
    memory.value.cur.shallowRefresh()
  }
  memory.value.pageNumber = 1
}

function toFullPage(): void {
  if (memory.value.cur != null) {
    memory.value.cur.shallowRefresh()
  }
  memory.value.pageNumber = 2
}

function onChangeSelectedCreature(code: string): void {
  const index = thisCreatures.value.findIndex((creature) => creature.code() == code)
  if (index < 0) {
    memory.value.cur = null
    return
  }
  memory.value.cur = thisCreatures.value[index]
}

onBeforeUnmount(() => {
  if (memory.value.cur != null) {
    memory.value.cur.shallowRefresh()
  }
})

function addNewStatus(): void {
  if (!memory.value.cur) {
    return
  }
  if (StatusList.some((s) => s.name == memory.value.newStatus.name)) {
    return
  }
  memory.value.cur.status.status.push(memory.value.newStatus.duplicate())
  memory.value.cur.shallowRefresh()
  memory.value.newStatus = S_Null.duplicate()
  memory.value.newStatus.lossOnTurn = 1
}

function statusMessage(): string {
  if (!memory.value.cur) {
    return ''
  }
  return (
    memory.value.cur.name() +
    '：' +
    memory.value.cur.attributeChangeString() +
    '；' +
    memory.value.cur.status.toString()
  )
}

interface StatusDamageEntry {
  pwr: MovePower
  amount: number
  kind: 'damage' | 'heal'
  source: 'environment' | 'status'
  key: string
}

const fieldStatusEntries = computed(() =>
  fieldStatusesForCreature(memory.value.cur, mapMemory.value)
)
const weatherReadonlyEntries = computed(() => weatherStatusEntries())

const statusDamageEntries = computed<StatusDamageEntry[]>(() => {
  const cur = memory.value.cur
  if (!cur) return []
  const cr = cur.battleLv()
  const powers = [
    ...environmentDamageOnTurn(cur).map((p) => ({ p, source: 'environment' as const })),
    ...cur.status
      .grandStatus()
      .damageOnTurn.filter((p) => p.power > 0)
      .map((p) => ({ p, source: 'status' as const }))
  ]
  return powers.map(({ p, source }, idx) => {
    const isHeal = p.elemType == '治疗'
    if (isHeal) {
      const mdf = envTypeMdfTotal([p.elemType, p.aspect], cur)
      return {
        pwr: p,
        amount: damageCalcRaw(p.power, cr, 1, 1, 0, mdf, 100),
        kind: 'heal',
        source,
        key: `${source}-${idx}`
      }
    }
    const defName = p.psType == '物理' ? '物防' : '特防'
    const defValue = Math.max(1, cur.getAttackAttributeByName(defName))
    const mdf =
      cur.typeMdf(p.elemType) +
      cur.typeMdf(p.aspect) +
      cur.grandStatus().grandMdf +
      envTypeMdfTotal([p.elemType, p.aspect], cur)
    return {
      pwr: p,
      amount: damageCalcRaw(p.power, cr, cr * 2, defValue, 0, mdf, 50),
      kind: 'damage',
      source,
      key: `${source}-${idx}`
    }
  })
})

const statusDamageLog = computed<string>(() => {
  const cur = memory.value.cur
  if (!cur || statusDamageEntries.value.length == 0) return ''
  const name = cur.name()
  const lines: string[] = []
  let hp = [cur.currentHP, cur.tempHP]
  for (const e of statusDamageEntries.value) {
    const dt = `${e.pwr.elemType}${e.pwr.psType}${e.pwr.aspect == '无性相' ? '' : e.pwr.aspect}`
    const src = e.pwr.extra.substring(1, e.pwr.extra.length - 1) || '状态'
    const preview = handleHP([...hp], cur.maxHP(), [e.kind == 'heal' ? e.amount : -e.amount, 0])
    if (e.kind == 'heal') {
      lines.push(
        `${name}受到了来自${src}的 ${e.amount} HP治疗（HP ${showHP(hp)} -> ${showHP(preview)}）。`
      )
    } else {
      lines.push(
        `${name}受到了来自${src}的 ${e.amount} ${dt}伤害（HP ${showHP(hp)} -> ${showHP(preview)}）。`
      )
    }
    hp = preview
  }
  return lines.join('\n')
})

function copyStatusLog(): void {
  navigator.clipboard.writeText(statusDamageLog.value)
}

function applyAllStatusDamage(): void {
  const cur = memory.value.cur
  if (!cur) return
  navigator.clipboard.writeText(statusDamageLog.value)
  for (const e of statusDamageEntries.value) {
    if (e.kind == 'heal') {
      cur.takeHP([e.amount, 0])
    } else {
      cur.takeHP([-e.amount, 0])
    }
  }
  cur.refreshGrandStatus()
}

function canConvertToParentStatus(s: Status): boolean {
  const cur = memory.value.cur
  return (
    cur != null &&
    s.parentName.length > 0 &&
    s.stack > 0 &&
    cur.status.stackOfStatus(s.parentName) <= 0
  )
}

function parentConversionLabel(s: Status): string {
  return `${s.stack >= 20 ? '确认转化为' : '手动转化为'} ${s.parentStack} 回合${s.parentName}`
}

function parentConversionTitle(s: Status): string {
  return s.stack >= 20
    ? '20 层以上可转化为严重状态；需要 DM 手动确认。'
    : '低于 20 层时，仅在招式或 DM 指定效果允许时使用。'
}

function convertToParentStatus(s: Status): void {
  const cur = memory.value.cur
  if (!cur) return
  cur.status.upgradeStatus(s.name, !cur.inRound)
  cur.shallowRefresh()
}

memory.value.newStatus.lossOnTurn = 1

if (memory.value.cur != null) {
  memory.value.cur.shallowRefresh()
}

let lastRefreshTick = 0
onUpdated(() => {
  nextTick(() => {
    document.querySelectorAll<HTMLTextAreaElement>('textarea[data-autosize]').forEach(autoResize)
  })
  const cur = memory.value.cur
  const now = Date.now()
  if (cur && now - lastRefreshTick > 50) {
    lastRefreshTick = now
    cur.shallowRefresh()
  }
})
</script>

<template>
  <div class="status-panel">
    <div class="status-toolbar">
      <label>
        角色
        <select
          :value="memory.cur?.code() ?? ''"
          class="w3-select w3-border"
          @change="onChangeSelectedCreature(($event.target as HTMLSelectElement).value)"
        >
          <option value="">（选择角色）</option>
          <option v-for="creature in thisCreatures" :key="creature.code()" :value="creature.code()">
            {{ creature.name() }} {{ creature.code() }}
          </option>
        </select>
      </label>
    </div>

    <div v-if="memory.cur != null">
      <div class="w3-bar status-tabs">
        <button
          class="w3-bar-item w3-button"
          :class="{ 'w3-black': memory.pageNumber == 1 }"
          style="width: 50%"
          @click="toPartPage"
        >
          当前状态
        </button>
        <button
          class="w3-bar-item w3-button"
          :class="{ 'w3-black': memory.pageNumber == 2 }"
          style="width: 50%"
          @click="toFullPage"
        >
          状态一览（点击刷新）
        </button>
      </div>

      <div style="padding-top: 0.5em">
        <div>
          <span class="round-indicator" :class="{ active: memory.cur.inRound }">
            {{ `现在${memory.cur.inRound ? '' : '不'}是${memory.cur.name()}的回合` }}
          </span>
          <button class="w3-button w3-light-gray" @click="memory.cur.newRound()">
            {{ `${memory.cur.name()}回合开始状态流逝` }}
          </button>
        </div>
        <p>
          注意：在你的<span style="color: crimson">回合外</span>获得<span style="color: crimson"
            >当前没有</span
          >的<span style="color: crimson">持续型状态</span>时，需要额外记录 1 回合
        </p>
        <div v-if="memory.pageNumber == 1">
          <div class="status-table-scroll">
            <table class="w3-table-all w3-centered dense-table status-current-table">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>状态名</th>
                  <th>剩余</th>
                  <th>修正</th>
                  <th>状态转换</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="ws in weatherReadonlyEntries"
                  :key="`${ws.typeLabel}-${ws.statusName}`"
                  class="weather-status-row"
                >
                  <td>{{ ws.typeLabel }}</td>
                  <td>
                    <span>{{ ws.statusName }}</span>
                  </td>
                  <td>{{ ws.layers }} 层</td>
                  <td>只读</td>
                  <td>{{ ws.details }}</td>
                </tr>
                <tr v-for="fs in fieldStatusEntries" :key="fs.stateName" class="field-status-row">
                  <td>累积</td>
                  <td>
                    <span>{{ fs.statusName }}</span>
                  </td>
                  <td>{{ fs.layers }} 层</td>
                  <td>只读</td>
                  <td>
                    {{ fs.sourceCount }} 个区域；施法者 {{ fs.casterCodes.join('、') }}；DC
                    {{ fs.dcs.join(' / ') }}；剩余
                    {{ fs.remainingRounds.map(fieldRemainingText).join(' / ') }}
                  </td>
                </tr>
                <tr v-for="s in memory.cur.status.status.filter((x) => x.stack > 0)" :key="s.name">
                  <td>{{ s.type ? '累积' : '持续' }}</td>
                  <td>
                    <span>{{ s.name }}</span>
                  </td>
                  <td>
                    <vue-number-input
                      v-model="s.stack"
                      size="small"
                      inline
                      center
                      controls
                      :step="1"
                    />
                    {{ s.type || s.name == '刚毅' ? '层' : '回合' }}
                  </td>
                  <td>
                    <span
                      :style="{
                        color: valueToColor(memory.cur.getStatusMdf(s))
                      }"
                    >
                      {{ toMod(memory.cur.getStatusMdf(s)) }}</span
                    >
                  </td>
                  <td>
                    <button
                      v-if="canConvertToParentStatus(s)"
                      class="w3-button status-convert-button"
                      :class="
                        s.stack >= 20 ? 'w3-red' : 'w3-border w3-pale-yellow manual-convert-button'
                      "
                      :title="parentConversionTitle(s)"
                      @click="convertToParentStatus(s)"
                    >
                      {{ parentConversionLabel(s) }}
                    </button>
                    <button
                      v-if="s.childName.length > 0 && s.stack >= 1"
                      class="w3-button w3-red"
                      @click="memory.cur.status.degradeStatus(s.name)"
                    >
                      {{ 10 }} 层{{ s.childName }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>结算顺序：累积型状态转换 → 环境状态伤害 / 治疗 → 角色状态伤害 → 状态流逝</div>
          <div v-if="statusDamageEntries.length > 0" style="margin: 0.5em 0">
            <table class="w3-table w3-bordered">
              <thead>
                <tr class="w3-light-gray">
                  <th>威力</th>
                  <th>属性</th>
                  <th>类型</th>
                  <th>伤害 / 治疗</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in statusDamageEntries" :key="e.key">
                  <td>{{ e.pwr.power }}</td>
                  <td>
                    {{ e.pwr.elemType }}{{ e.pwr.psType
                    }}{{ e.pwr.aspect == '无性相' ? '' : e.pwr.aspect }}
                  </td>
                  <td>
                    {{ e.source == 'environment' ? '环境' : e.pwr.isStatus ? '状态' : '' }}
                    {{ e.pwr.extra }}
                  </td>
                  <td
                    style="font-weight: bold"
                    :style="{ color: e.kind == 'heal' ? '#2e7d32' : '#e53935' }"
                  >
                    {{ e.kind == 'heal' ? '+' : '-' }}{{ e.amount }}
                  </td>
                </tr>
              </tbody>
            </table>
            <button
              class="w3-button w3-red"
              style="margin-top: 0.3em"
              @click="applyAllStatusDamage"
            >
              全部结算
            </button>
            <button
              v-if="statusDamageLog.length > 0"
              class="w3-button w3-center w3-light-gray"
              style="margin-top: 0.3em; margin-left: 0.3em"
              @click="copyStatusLog"
            >
              复制到剪贴板
            </button>
            <textarea
              v-if="statusDamageLog.length > 0"
              :value="statusDamageLog"
              data-autosize
              style="width: 100%; height: 5em; resize: none; margin-top: 0.3em"
              readonly
            ></textarea>
          </div>
          <div v-else style="color: gray">无状态伤害</div>

          <br />

          <div>
            自定义状态：<button
              class="w3-button"
              :class="{ 'w3-black': memory.newStatus.type }"
              @click="memory.newStatus.type = !memory.newStatus.type"
            >
              {{ memory.newStatus.type ? '累积型状态' : '持续型状态' }}
            </button>

            名字：<input v-model="memory.newStatus.name" class="w3-input" style="width: 12em" />
            层数/回合数：<vue-number-input
              v-model="memory.newStatus.stack"
              size="small"
              inline
              center
              controls
              :min="1"
              :step="1"
            />
            <br />
            每回合减少：<vue-number-input
              v-model="memory.newStatus.lossOnTurn"
              size="small"
              inline
              center
              controls
              :step="1"
            />
            <button class="w3-button" @click="addNewStatus">添加状态</button>
          </div>
          <div>
            <textarea
              style="width: 100%; height: 5em; resize: none"
              :value="statusMessage()"
            ></textarea>
          </div>
        </div>

        <div v-if="memory.pageNumber == 2">
          <div class="status-table-scroll">
            <table class="w3-table-all w3-centered dense-table status-overview-table">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>状态名</th>
                  <th>层/回合</th>
                  <th>修正</th>
                  <th>回合</th>
                  <th>相关状态</th>
                  <th>标签</th>
                  <th>移除</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="s in memory.cur.status.status"
                  :key="s.name"
                  :style="{ color: valueToColorBinary(s.stack) }"
                >
                  <td>{{ s.type ? '累积' : '持续' }}</td>
                  <td>
                    <span :style="{ color: valueToColor(s.stack) }">{{ s.name }}</span>
                  </td>
                  <td>
                    <vue-number-input
                      v-model="s.stack"
                      size="small"
                      inline
                      center
                      controls
                      :step="1"
                    />
                  </td>
                  <td>
                    <span
                      :style="{
                        color: valueToColor(memory.cur.getStatusMdf(s))
                      }"
                    >
                      {{ toMod(memory.cur.getStatusMdf(s)) }}</span
                    >
                  </td>
                  <td>
                    <span
                      :style="{
                        color:
                          s.stack > 0 ? valueToColor(s.lossOnTurn) : valueToColorBinary(s.stack)
                      }"
                    >
                      {{ s.lossOnTurn }}</span
                    >
                  </td>
                  <td
                    :style="{
                      fontWeight: s.type && s.stack >= 20 ? 'bold' : 'inherit',
                      color: s.type && s.stack >= 20 ? 'crimson' : 'inherit'
                    }"
                  >
                    {{ s.parentName.length > 0 ? `${s.parentStack} 回合` : '' }}{{ s.parentName
                    }}{{ s.parentName.length > 0 ? '，20层可转化' : '' }} {{ s.childName
                    }}{{ s.oppositeName.length > 0 ? `/${s.oppositeName}` : '' }}
                  </td>
                  <td>
                    {{ s.autoCrit ? '自动暴击' : '' }}
                    {{ s.cannotMove ? '无法移动' : '' }}
                    {{ s.incapacitated ? '命中减值无效' : '' }}
                  </td>
                  <td
                    :style="{
                      color: s.stack > 0 && s.removeAt == 2 ? 'crimson' : 'inherit'
                    }"
                  >
                    {{ s.removeAt == 0 ? '协助' : '' }}
                    {{ s.removeAt == 1 ? '初等复原术' : '' }}
                    {{ s.removeAt == 2 ? '高等复原术' : '' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-panel {
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  padding: 0.75em;
}

.status-panel h3 {
  margin-top: 0;
}

.status-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75em;
  margin-bottom: 0.75em;
}

.status-toolbar label {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  min-width: 220px;
  font-size: 13px;
  color: #555;
}

.status-tabs {
  display: flex;
  flex-wrap: wrap;
  background-color: white;
  border-bottom: 1px solid #e8e8e8;
}

.status-tabs .w3-button {
  flex: 1 1 160px;
  width: auto !important;
}

.status-panel :is(table.w3-table, table.w3-table-all) {
  width: 100%;
  max-width: 100%;
}

.status-table-scroll {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}

.status-table-scroll > .dense-table {
  display: table !important;
  width: 100%;
  max-width: none;
  min-width: 720px;
  table-layout: fixed;
}

.status-table-scroll :is(th, td) {
  white-space: nowrap;
  vertical-align: middle;
}

.status-current-table :is(th:nth-child(1), td:nth-child(1)),
.status-overview-table :is(th:nth-child(1), td:nth-child(1)) {
  width: 5.5rem;
}

.status-current-table :is(th:nth-child(2), td:nth-child(2)),
.status-overview-table :is(th:nth-child(2), td:nth-child(2)) {
  width: 8rem;
}

.status-current-table :is(th:nth-child(3), td:nth-child(3)) {
  width: 11rem;
}

.status-current-table :is(th:nth-child(4), td:nth-child(4)),
.status-overview-table :is(th:nth-child(4), td:nth-child(4)),
.status-overview-table :is(th:nth-child(5), td:nth-child(5)) {
  width: 5rem;
}

.status-current-table :is(th:nth-child(5), td:nth-child(5)),
.status-overview-table :is(th:nth-child(6), td:nth-child(6)) {
  white-space: normal;
  text-align: left;
}

.status-overview-table {
  min-width: 840px !important;
}

.status-overview-table :is(th:nth-child(3), td:nth-child(3)) {
  width: 10rem;
}

.status-overview-table :is(th:nth-child(7), td:nth-child(7)),
.status-overview-table :is(th:nth-child(8), td:nth-child(8)) {
  width: 7rem;
}

.status-panel :is(input, select, textarea) {
  max-width: 100%;
}

.status-panel [style*='width: 12em'] {
  width: min(12em, 100%) !important;
}

.status-panel .w3-right {
  float: none !important;
}

.round-indicator {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  margin-right: 0.3em;
  padding: 0.35em 0.75em;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: #f2f2f2;
  color: #666;
  vertical-align: middle;
}

.round-indicator.active {
  border-color: #2e7d32;
  background: #e8f5e9;
  color: #1b5e20;
  font-weight: 600;
}

.field-status-row td {
  background: #f4f7fb;
  color: #263238;
  font-weight: 600;
}

.weather-status-row td {
  background: #fff8e1;
  color: #3e2723;
  font-weight: 600;
}

.status-convert-button {
  min-width: 10em;
}

.manual-convert-button {
  color: #5f4300 !important;
  border-color: #d6aa2b !important;
  background: #fff8df !important;
}
</style>
