<script setup lang="ts">
import { toolsMemory, ToolsMemory } from '@renderer/model/GlobalMemory'
import { ref } from 'vue'
import VueNumberInput from '@chenfengyuan/vue-number-input'

const memory = ref<ToolsMemory>(toolsMemory.value)

function dropCoef(height: number): number {
  return Math.max(Math.min(10, (height - 3) / 2), 0)
}
</script>

<template>
  <div class="panel-page fall-panel">
    <div class="panel-field-grid">
      <label class="panel-field gravity-field">
        <span class="panel-field-label">当前重力加速度系数</span>
        <span>
          <vue-number-input
            v-model="memory.gravity"
            size="medium"
            inline
            center
            controls
            :step="0.1"
            :min="0"
          />
          m·s^-2
        </span>
      </label>
      <label class="panel-field">
        <span class="panel-field-label">临时武器重量</span>
        <span>
          <vue-number-input
            v-model="memory.dropWeight"
            size="medium"
            inline
            center
            controls
            :step="0.1"
            :min="0"
          />
          千克
        </span>
      </label>
      <div class="panel-field">
        <span class="panel-field-label">临时武器威力</span>
        <div class="panel-result">
          {{ Math.max(0, Math.floor(memory.gravity * Math.sqrt(memory.dropWeight))) }}
        </div>
      </div>
      <label class="panel-field">
        <span class="panel-field-label">坠落米数</span>
        <vue-number-input
          v-model="memory.dropMeters"
          size="medium"
          inline
          center
          controls
          :step="0.1"
          :min="0"
        />
      </label>
      <div class="panel-field">
        <span class="panel-field-label">高空抛物系数</span>
        <div class="panel-result">{{ dropCoef(memory.dropMeters).toFixed(1) }}</div>
      </div>
      <label class="panel-field">
        <span class="panel-field-label">该情况下临时武器威力</span>
        <vue-number-input
          v-model="memory.dropPower"
          size="medium"
          inline
          center
          controls
          :step="1"
          :min="0"
        />
      </label>
      <div class="panel-field">
        <span class="panel-field-label">最终威力</span>
        <div class="panel-result">
          {{ Math.max(0, Math.floor(dropCoef(memory.dropMeters) * memory.dropPower)) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fall-panel .panel-field-grid {
  grid-template-columns: repeat(2, minmax(190px, 1fr));
}

.gravity-field {
  grid-column: 1 / -1;
}

@media (max-width: 520px) {
  .fall-panel .panel-field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
