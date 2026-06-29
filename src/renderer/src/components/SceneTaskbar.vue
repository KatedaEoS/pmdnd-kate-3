<script setup lang="ts">
interface TaskbarPanel {
  id: string
  title: string
  component: string
}

defineProps<{ panels: TaskbarPanel[] }>()

defineEmits<{
  restore: [id: string]
  remove: [id: string]
  toggleDesktop: []
}>()
</script>

<template>
  <div class="scene-taskbar" role="toolbar" aria-label="最小化窗口任务栏">
    <div class="taskbar-items">
      <div
        v-for="panel in panels"
        :key="panel.id"
        class="taskbar-item"
        @contextmenu.prevent="$emit('remove', panel.id)"
      >
        <button
          class="taskbar-item-restore"
          type="button"
          :title="`恢复 ${panel.title}`"
          @click="$emit('restore', panel.id)"
        >
          <span class="taskbar-item-title">{{ panel.title }}</span>
        </button>
        <button
          class="taskbar-item-close"
          type="button"
          title="从任务栏移除"
          aria-label="从任务栏移除"
          @click="$emit('remove', panel.id)"
        >
          x
        </button>
      </div>
      <div v-if="panels.length == 0" class="taskbar-empty">无最小化窗口</div>
    </div>
    <button
      class="taskbar-show-desktop"
      type="button"
      title="显示桌面 / 恢复窗口"
      aria-label="显示桌面 / 恢复窗口"
      @click="$emit('toggleDesktop')"
    >
      显示桌面
    </button>
  </div>
</template>

<style scoped>
.scene-taskbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 35;
  display: flex;
  align-items: stretch;
  gap: 8px;
  height: 42px;
  padding: 5px 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.18);
  background: rgba(246, 248, 252, 0.88);
  backdrop-filter: blur(10px);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.1);
  pointer-events: auto;
}

.taskbar-items {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
}

.taskbar-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 180px;
  min-width: 120px;
  max-width: 220px;
  padding: 0 6px 0 0;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.92);
  color: #1f2937;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.06);
}

.taskbar-item:hover {
  background: #ffffff;
  border-color: rgba(33, 150, 243, 0.55);
}

.taskbar-item:active {
  background: #edf6ff;
}

.taskbar-item-restore {
  display: inline-flex;
  flex: 1;
  min-width: 0;
  height: 100%;
  align-items: center;
  padding: 0 0 0 10px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.taskbar-item-title {
  min-width: 0;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.taskbar-item-close {
  display: grid;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #64748b;
  font: inherit;
  line-height: 1;
  cursor: pointer;
}

.taskbar-item-close:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #111827;
}

.taskbar-empty {
  display: grid;
  place-items: center;
  padding: 0 12px;
  color: #6b7280;
  font-size: 13px;
  white-space: nowrap;
}

.taskbar-show-desktop {
  display: grid;
  flex: 0 0 auto;
  width: 92px;
  min-width: 92px;
  margin-left: 2px;
  padding: 0;
  place-items: center;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.86);
  color: #1f2937;
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.06);
}

.taskbar-show-desktop:hover {
  background: #ffffff;
  border-color: rgba(33, 150, 243, 0.65);
}

.taskbar-show-desktop:active {
  background: #dbeafe;
}

@media (pointer: coarse) and (orientation: landscape) {
  .scene-taskbar {
    height: 48px;
    padding: 6px 10px;
  }

  .taskbar-item-close {
    width: 28px;
    height: 28px;
  }

  .taskbar-show-desktop {
    width: 108px;
    min-width: 108px;
  }
}
</style>
