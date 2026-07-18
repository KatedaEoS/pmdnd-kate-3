<script setup lang="ts">
import type { MapMemory } from '../model/GlobalMemory'
import {
  drawModeLabels,
  drawModes,
  drawModeTitles,
  factionColor,
  factionShortLabel,
  factions,
  type DrawMode
} from '../gameScene/constants'

defineProps<{
  mm: MapMemory
  drawMode: DrawMode
  drawColor: string
  snapEnabled: boolean
  moveCostMode: boolean
}>()

const emit = defineEmits<{
  'draw-color-change': [value: string]
  'snap-enabled-change': [value: boolean]
  'move-cost-mode-change': [value: boolean]
  'enter-draw-mode': [mode: DrawMode]
  'toggle-fog-visible': []
  'set-hp-display-level': [faction: string, level: number]
}>()

function emitColor(event: Event): void {
  emit('draw-color-change', (event.target as HTMLInputElement).value)
}

function emitHPDisplayLevel(faction: string, event: Event): void {
  emit('set-hp-display-level', faction, Number((event.target as HTMLSelectElement).value))
}
</script>

<template>
  <div class="toolbar">
    <div class="tool-section">
      <div class="tool-label">绘制</div>
      <input
        type="color"
        :value="drawColor"
        class="toolbar-color"
        title="颜色"
        @input="emitColor"
      />
      <button
        v-for="(m, index) in drawModes"
        :key="m"
        :class="{ active: drawMode == m }"
        :title="`${drawModeTitles[m]}（快捷键 ${index + 1}）`"
        @click="emit('enter-draw-mode', m)"
      >
        {{ drawModeLabels[m] }}
      </button>
    </div>
    <div class="tool-section">
      <div class="tool-label">地图</div>
      <button
        :class="{ active: mm.fogVisible }"
        title="切换迷雾可见性（快捷键 0）"
        @click="emit('toggle-fog-visible')"
      >
        迷雾
      </button>
    </div>
    <div class="tool-section">
      <div class="tool-label">对齐</div>
      <button
        :class="{ active: snapEnabled }"
        title="对齐到半格（Ctrl/Command 临时反转；Ctrl/Command + 左键拖动 Token 消耗移动力）"
        @click="emit('snap-enabled-change', !snapEnabled)"
      >
        {{ snapEnabled ? '📏' : '📐' }}
      </button>
      <button
        :class="{ active: moveCostMode }"
        title="触摸端移动力消耗模式；桌面端仍可用 Ctrl/Command + 左键拖动 Token"
        @click="emit('move-cost-mode-change', !moveCostMode)"
      >
        耗移
      </button>
    </div>
    <div class="tool-section">
      <div class="tool-label">显示</div>
      <div v-for="f in factions" :key="f" class="hp-display-row">
        <span :style="{ color: factionColor[f], fontWeight: 'bold' }">
          {{ factionShortLabel[f] }}
        </span>
        <select :value="mm.hpDisplayLevels[f] ?? 2" @change="emitHPDisplayLevel(f, $event)">
          <option :value="0">-</option>
          <option :value="1">血条</option>
          <option :value="2">HP值</option>
          <option :value="3">PP值</option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  position: absolute;
  top: calc(50% + 14px);
  right: 8px;
  transform: translateY(-50%);
  z-index: 30;
  background: rgba(255, 255, 255, 0.94);
  border-radius: 8px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  max-width: 60px;
}

.tool-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.tool-label {
  font-size: 9px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.toolbar-color {
  width: 36px;
  height: 22px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}

.toolbar button {
  width: 38px;
  height: 32px;
  font-size: 14px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #555;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar button:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #222;
}

.toolbar button.active {
  background: #e8f0fe;
  border-color: #a8c7fa;
  color: #1a73e8;
}

.hp-display-row {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
}

.toolbar select {
  width: 44px;
  font-size: 11px;
  padding: 2px;
  background: #fff;
  color: #444;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  text-align: center;
}

@media (pointer: coarse) and (orientation: landscape) {
  .toolbar {
    top: auto;
    right: auto;
    bottom: max(8px, env(safe-area-inset-bottom));
    left: max(8px, env(safe-area-inset-left));
    right: max(8px, env(safe-area-inset-right));
    transform: none;
    flex-direction: row;
    align-items: flex-end;
    max-width: none;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .tool-section {
    flex-direction: row;
    align-items: center;
    flex: 0 0 auto;
  }

  .tool-label {
    margin: 0 2px 0 0;
  }

  .toolbar-color {
    width: 44px;
    height: 36px;
  }

  .toolbar button {
    width: 46px;
    height: 40px;
    font-size: 14px;
  }
}
</style>
