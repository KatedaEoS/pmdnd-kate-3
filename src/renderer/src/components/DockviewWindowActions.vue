<script setup lang="ts">
import { inject } from 'vue'
import type { IDockviewHeaderActionsProps } from 'dockview-core'

const props = defineProps<{ params: IDockviewHeaderActionsProps }>()

const minimizeDockviewPanel = inject<(panelId: string) => void>('minimizeDockviewPanel')

function minimizeActivePanel(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  const panel = props.params.activePanel
  if (!panel || !minimizeDockviewPanel) return
  minimizeDockviewPanel(panel.id)
}
</script>

<template>
  <button
    v-if="params.activePanel"
    class="dock-window-action"
    type="button"
    title="最小化窗口"
    aria-label="最小化窗口"
    @pointerdown.stop
    @click="minimizeActivePanel"
  >
    _
  </button>
</template>

<style scoped>
.dock-window-action {
  width: 28px;
  height: 100%;
  min-height: 26px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #666;
  font: inherit;
  line-height: 1;
  cursor: pointer;
}

.dock-window-action:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #222;
}

.dock-window-action:active {
  background: rgba(0, 0, 0, 0.14);
}

@media (pointer: coarse) and (orientation: landscape) {
  .dock-window-action {
    width: 36px;
    min-height: 34px;
  }
}
</style>
