<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import VueNumberInput from '@chenfengyuan/vue-number-input'
import Creatures from '@renderer/model/Creature'
import { fieldEditMemory, mapMemory } from '@renderer/model/GlobalMemory'
import {
  applyFieldDataToDrawing,
  convertAreaDrawingsToFields,
  DrawableFieldStates,
  drawingIsField,
  fieldColorForState,
  fieldRemainingText,
  isAreaDrawing,
  removeFieldDataFromDrawing
} from '@renderer/model/MapFields'

const memory = ref(fieldEditMemory.value)
const mm = mapMemory.value
const requestSceneDraw = inject<() => void>('requestSceneDraw', () => {})
const dcAbilityOptions = ['力量', '敏捷', '体质', '智力', '感知', '魅力']
const CUSTOM_FIELD_OPTION = '__custom__'

const areaDrawings = computed(() =>
  mm.drawings
    .map((drawing, idx) => ({ drawing, idx }))
    .filter((entry) => isAreaDrawing(entry.drawing))
)

const selectedDrawing = computed(() => mm.drawings[memory.value.selectedDrawingIdx])
const selectedIsField = computed(() => drawingIsField(selectedDrawing.value))
const stateSelectValue = computed<string>({
  get() {
    return DrawableFieldStates.some((state) => state.name == memory.value.stateName)
      ? memory.value.stateName
      : CUSTOM_FIELD_OPTION
  },
  set(value) {
    if (value == CUSTOM_FIELD_OPTION) {
      if (DrawableFieldStates.some((state) => state.name == memory.value.stateName)) {
        memory.value.stateName = '自定义场地'
      }
      return
    }
    memory.value.stateName = value
    memory.value.color = fieldColorForState(value)
  }
})
const selectedLabel = computed(() => {
  const idx = memory.value.selectedDrawingIdx
  if (idx < 0) return '当前模板'
  const drawing = mm.drawings[idx]
  if (!drawing) return '当前模板'
  return `${idx + 1}. ${drawing.type}${drawing.field ? ` / ${drawing.field.stateName}` : ''}`
})

function drawingLabel(idx: number): string {
  const drawing = mm.drawings[idx]
  if (!drawing) return `${idx + 1}. 已删除`
  const field = drawing.field
  return `${idx + 1}. ${drawing.type}${
    field ? ` / ${field.stateName} ${field.layers}层 / ${fieldRemainingText(field.remainingRounds ?? -1)}` : ' / 未设为场地'
  }`
}

function selectDrawing(value: string): void {
  const idx = Number(value)
  memory.value.selectedDrawingIdx = Number.isFinite(idx) ? idx : -1
  const drawing = mm.drawings[memory.value.selectedDrawingIdx]
  if (drawing?.field) {
    memory.value.loadFieldData(drawing.field)
  }
}

function recalculateDc(): void {
  const code = memory.value.casterCode.trim()
  if (!code) {
    memory.value.dc = 10
    return
  }
  const creature = Creatures.value.find((c) => c.code() == code)
  if (!creature) return
  memory.value.dc = Math.max(
    0,
    Math.floor(creature.effectPower() + creature.getModifierByName(memory.value.dcAbility))
  )
}

function applyToSelected(): void {
  applyFieldDataToDrawing(selectedDrawing.value, memory.value.toFieldData())
  requestSceneDraw()
}

function applyToAll(): void {
  convertAreaDrawingsToFields(mm, memory.value.toFieldData())
  requestSceneDraw()
}

function clearSelected(): void {
  removeFieldDataFromDrawing(selectedDrawing.value)
  requestSceneDraw()
}

watch(
  () => [
    memory.value.stateName,
    memory.value.layers,
    memory.value.casterCode,
    memory.value.dcAbility,
    memory.value.dc,
    memory.value.color,
    memory.value.remainingRounds
  ],
  () => {
    if (selectedIsField.value) applyToSelected()
  }
)
</script>

<template>
  <div class="field-panel">
    <div class="field-row">
      <label>
        编辑对象
        <select
          :value="memory.selectedDrawingIdx"
          class="w3-select w3-border"
          @change="selectDrawing(($event.target as HTMLSelectElement).value)"
        >
          <option :value="-1">当前模板</option>
          <option v-for="entry in areaDrawings" :key="entry.idx" :value="entry.idx">
            {{ drawingLabel(entry.idx) }}
          </option>
        </select>
      </label>
    </div>

    <div class="field-grid">
      <label>
        类别
        <select v-model="stateSelectValue" class="w3-select w3-border">
          <option v-for="state in DrawableFieldStates" :key="state.name" :value="state.name">
            {{ state.category }} / {{ state.name }}
          </option>
          <option :value="CUSTOM_FIELD_OPTION">自定义场地</option>
        </select>
      </label>

      <label v-if="stateSelectValue == CUSTOM_FIELD_OPTION">
        自定义名称
        <input v-model="memory.stateName" class="w3-input w3-border" />
      </label>

      <label>
        颜色
        <input v-model="memory.color" class="field-color-input" type="color" />
      </label>

      <label>
        层数
        <vue-number-input v-model="memory.layers" size="small" inline center controls :min="1" />
      </label>

      <label>
        剩余回合（-1 无限）
        <vue-number-input v-model="memory.remainingRounds" size="small" inline center controls :min="-1" />
      </label>

      <label>
        施法者
        <select
          v-model="memory.casterCode"
          class="w3-select w3-border"
          @change="recalculateDc"
        >
          <option value="">大自然</option>
          <option v-for="creature in Creatures" :key="creature.code()" :value="creature.code()">
            {{ creature.name() }} {{ creature.code() }}
          </option>
        </select>
      </label>

      <label>
        DC 属性
        <select v-model="memory.dcAbility" class="w3-select w3-border" @change="recalculateDc">
          <option value="">不指定</option>
          <option v-for="ability in dcAbilityOptions" :key="ability" :value="ability">
            {{ ability }}
          </option>
        </select>
      </label>

      <label>
        固定 DC
        <vue-number-input v-model="memory.dc" size="small" inline center controls :min="0" />
      </label>
    </div>

    <div class="field-preview">
      <span class="field-swatch" :style="{ background: memory.color }" />
      <span>{{ selectedLabel }}：{{ memory.stateName }} {{ memory.layers }}层</span>
      <span>剩余 {{ fieldRemainingText(memory.remainingRounds) }}</span>
      <span>施法者 {{ memory.casterCode || '大自然' }}</span>
      <span v-if="memory.casterCode">
        DC 属性 {{ memory.dcAbility || '不指定' }}
      </span>
      <span>DC {{ memory.dc }}</span>
    </div>

    <div class="field-actions">
      <button
        class="w3-button w3-black"
        :disabled="memory.selectedDrawingIdx < 0 || !selectedDrawing"
        @click="applyToSelected"
      >
        应用到当前对象
      </button>
      <button class="w3-button w3-light-gray" @click="applyToAll">应用到全部面积图形</button>
      <button
        class="w3-button w3-light-gray"
        :disabled="!selectedIsField"
        @click="clearSelected"
      >
        当前对象取消场地
      </button>
    </div>

    <div class="field-note">
      场地 DC 会写入绘图对象，之后不会随施法者能力变化自动改变。角色是否处于场地内按 token
      当前位置实时计算。
    </div>
  </div>
</template>

<style scoped>
.field-panel {
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  padding: 0.75em;
}

.field-row {
  margin-bottom: 0.75em;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75em;
  align-items: end;
}

.field-panel label {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  font-size: 13px;
  color: #555;
}

.field-panel :deep(.vue-number-input) {
  width: 100%;
  max-width: 180px;
}

.field-color-input {
  width: 100%;
  max-width: 180px;
  min-height: 32px;
  border: 1px solid #ccc;
  background: #fff;
  padding: 2px;
}

.field-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75em;
  margin-top: 1em;
  padding: 0.5em 0;
  border-top: 1px solid #eee;
  border-bottom: 1px solid #eee;
}

.field-swatch {
  width: 18px;
  height: 18px;
  border: 1px solid rgba(0, 0, 0, 0.25);
}

.field-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
  margin-top: 1em;
}

.field-note {
  margin-top: 1em;
  color: #666;
  font-size: 13px;
  line-height: 1.5;
}
</style>
