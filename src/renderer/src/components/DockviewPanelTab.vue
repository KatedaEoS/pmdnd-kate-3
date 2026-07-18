<script setup lang="ts">
import { inject, onBeforeUnmount, ref } from 'vue'
import type { IDockviewPanelHeaderProps } from 'dockview-core'

const props = defineProps<{ params: IDockviewPanelHeaderProps }>()

const minimizeDockviewPanel = inject<(panelId: string) => void>('minimizeDockviewPanel')
const title = ref(props.params.api.title ?? props.params.api.id)
const titleListener = props.params.api.onDidTitleChange((event) => {
  title.value = event.title
})

function minimizePanel(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  minimizeDockviewPanel?.(props.params.api.id)
}

function closePanel(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  props.params.api.close()
}

onBeforeUnmount(() => titleListener.dispose())
</script>

<template>
  <div class="dock-panel-tab" :title="title">
    <span class="dock-panel-tab-title">{{ title }}</span>
    <span class="dock-panel-tab-actions">
      <button
        type="button"
        class="dock-panel-tab-action dock-panel-tab-minimize"
        :title="`最小化 ${title}`"
        :aria-label="`最小化 ${title}`"
        @pointerdown.stop
        @click="minimizePanel"
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        class="dock-panel-tab-action dock-panel-tab-close"
        :title="`关闭 ${title}`"
        :aria-label="`关闭 ${title}`"
        @pointerdown.stop
        @click="closePanel"
      >
        <span aria-hidden="true">×</span>
      </button>
    </span>
  </div>
</template>

<style scoped>
.dock-panel-tab {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  align-items: center;
  gap: 4px;
  padding-left: 9px;
  overflow: hidden;
  box-sizing: border-box;
  color: inherit;
}

.dock-panel-tab-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dock-panel-tab-actions {
  display: inline-flex;
  flex: 0 0 auto;
  height: 100%;
  align-items: stretch;
}

.dock-panel-tab-action {
  display: grid;
  width: 25px;
  min-width: 25px;
  height: 100%;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #777;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.dock-panel-tab-minimize span {
  transform: translateY(3px);
}

.dock-panel-tab-action:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #222;
}

.dock-panel-tab-close:hover {
  background: #d83b3b;
  color: #fff;
}

.dock-panel-tab-action:active {
  background: rgba(0, 0, 0, 0.14);
}

.dock-panel-tab-close:active {
  background: #b52c2c;
}

@media (pointer: coarse) and (orientation: landscape) {
  .dock-panel-tab-action {
    width: 34px;
    min-width: 34px;
  }
}
</style>
