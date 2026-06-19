<script setup lang="ts">
import { ref, watch } from 'vue'

export interface ContextMenuAction {
  label: string
  action: string
  separator?: boolean
  danger?: boolean
  disabled?: boolean
}

const props = defineProps<{
  x: number
  y: number
  actions: ContextMenuAction[]
}>()

const emit = defineEmits<{
  select: [action: string]
  close: []
}>()

const menuRef = ref<HTMLElement | null>(null)

watch(() => props.x, () => {
  // 当菜单重新定位时，确保它在视口内
  nextTick(() => {
    const el = menuRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      el.style.left = (props.x - rect.width) + 'px'
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = (props.y - rect.height) + 'px'
    }
  })
})

function handleClick(action: string): void {
  emit('select', action)
}

import { nextTick } from 'vue'
</script>

<template>
  <div
    ref="menuRef"
    class="context-menu"
    :style="{ left: x + 'px', top: y + 'px' }"
    @click.stop
    @contextmenu.prevent
  >
    <template v-for="(item, i) in actions" :key="i">
      <div v-if="item.separator" class="context-menu-separator" />
      <div
        v-else
        class="context-menu-item"
        :class="{ 'context-menu-item-danger': item.danger, 'context-menu-item-disabled': item.disabled }"
        @click="!item.disabled && handleClick(item.action)"
      >
        {{ item.label }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 4px 0;
  min-width: 160px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  font-size: 13px;
  color: #333;
}

.context-menu-item {
  padding: 6px 16px;
  cursor: pointer;
  white-space: nowrap;
}

.context-menu-item:hover {
  background: #e8f0fe;
  color: #1a73e8;
}

.context-menu-item-danger {
  color: #d93025;
}

.context-menu-item-danger:hover {
  background: #fce8e6;
  color: #d93025;
}

.context-menu-item-disabled {
  color: #999;
  cursor: default;
}

.context-menu-item-disabled:hover {
  background: transparent;
  color: #999;
}

.context-menu-separator {
  height: 1px;
  background: #e8e8e8;
  margin: 4px 8px;
}
</style>
