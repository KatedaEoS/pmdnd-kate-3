<script setup lang="ts">
import { ref } from 'vue'

export interface MenuItem {
  label: string
  shortcut?: string
  action?: string
  separator?: boolean
  disabled?: boolean
  children?: MenuItem[]
}

export interface MenuGroup {
  label: string
  shortcut?: string
  action?: string
  items?: MenuItem[]
}

const props = defineProps<{ groups: MenuGroup[] }>()
const emit = defineEmits<{ select: [action: string] }>()

const openMenu = ref<string | null>(null)

function toggleMenu(label: string): void {
  openMenu.value = openMenu.value == label ? null : label
}

function handleGroupClick(group: MenuGroup): void {
  if (group.action) {
    handleSelect(group.action)
    return
  }
  toggleMenu(group.label)
}

function handleSelect(action: string): void {
  openMenu.value = null
  emit('select', action)
}

function closeAll(): void {
  openMenu.value = null
}
</script>

<template>
  <div class="menu-bar" @mouseleave="closeAll">
    <div
      v-for="group in groups"
      :key="group.label"
      class="menu-group"
      @mouseenter="openMenu && !group.action && (openMenu = group.label)"
    >
      <button
        class="menu-trigger"
        :class="{ active: openMenu == group.label }"
        :title="group.shortcut ? `${group.label}（快捷键 ${group.shortcut}）` : group.label"
        @click="handleGroupClick(group)"
        @mouseenter="openMenu && !group.action && (openMenu = group.label)"
      >
        <span>{{ group.label }}</span>
        <span v-if="group.shortcut" class="menu-trigger-shortcut">{{ group.shortcut }}</span>
      </button>
      <div v-if="!group.action && openMenu == group.label" class="menu-dropdown">
        <template v-for="(item, i) in group.items ?? []" :key="i">
          <div v-if="item.separator" class="menu-separator" />
          <div v-else-if="item.children?.length" class="menu-item-wrapper">
            <button
              class="menu-item menu-item-parent"
              :class="{ disabled: item.disabled }"
              :disabled="item.disabled"
              :title="item.shortcut ? `${item.label}（快捷键 ${item.shortcut}）` : item.label"
            >
              <span>{{ item.label }}</span>
              <span class="menu-item-meta">
                <span v-if="item.shortcut" class="menu-shortcut">{{ item.shortcut }}</span>
                <span class="menu-arrow">›</span>
              </span>
            </button>
            <div class="menu-submenu">
              <template v-for="(child, ci) in item.children" :key="ci">
                <div v-if="child.separator" class="menu-separator" />
                <button
                  v-else
                  class="menu-item"
                  :class="{ disabled: child.disabled }"
                  :disabled="child.disabled"
                  :title="
                    child.shortcut ? `${child.label}（快捷键 ${child.shortcut}）` : child.label
                  "
                  @click="handleSelect(child.action!)"
                >
                  <span>{{ child.label }}</span>
                  <span v-if="child.shortcut" class="menu-shortcut">{{ child.shortcut }}</span>
                </button>
              </template>
            </div>
          </div>
          <button
            v-else
            class="menu-item"
            :class="{ disabled: item.disabled }"
            :disabled="item.disabled"
            :title="item.shortcut ? `${item.label}（快捷键 ${item.shortcut}）` : item.label"
            @click="handleSelect(item.action!)"
          >
            <span>{{ item.label }}</span>
            <span v-if="item.shortcut" class="menu-shortcut">{{ item.shortcut }}</span>
          </button>
        </template>
      </div>
    </div>
    <div class="menu-extra">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.menu-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  height: 28px;
  background: #f0f0f0;
  border-bottom: 1px solid #d0d0d0;
  padding: 0 8px;
  user-select: none;
  -webkit-app-region: no-drag;
}

.menu-extra {
  margin-left: auto;
  display: flex;
  align-items: center;
  min-width: 0;
}

.menu-group {
  position: relative;
}

.menu-trigger {
  height: 27px;
  padding: 0 10px;
  font-size: 13px;
  border: none;
  background: transparent;
  color: #333;
  cursor: pointer;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.menu-trigger:hover,
.menu-trigger.active {
  background: #d0d0d0;
}

.menu-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 180px;
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 0 0 6px 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  padding: 4px 0;
}

.menu-item-wrapper {
  position: relative;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
  padding: 5px 16px;
  font-size: 13px;
  text-align: left;
  border: none;
  background: transparent;
  color: #333;
  cursor: pointer;
  white-space: nowrap;
}

.menu-submenu {
  display: none;
  position: absolute;
  top: -5px;
  left: 100%;
  min-width: 280px;
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 0 6px 6px 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  padding: 4px 0;
}

.menu-item-wrapper:hover > .menu-submenu {
  display: block;
}

.menu-arrow {
  color: #777;
}

.menu-item-meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.menu-shortcut,
.menu-trigger-shortcut {
  color: #777;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.menu-trigger-shortcut {
  color: #666;
}

.menu-item:hover:not(.disabled) {
  background: #3a6fd8;
  color: #fff;
}

.menu-item:hover:not(.disabled) .menu-shortcut,
.menu-item:hover:not(.disabled) .menu-arrow {
  color: #fff;
}

.menu-item.disabled {
  color: #bbb;
  cursor: default;
}

.menu-separator {
  height: 1px;
  background: #e0e0e0;
  margin: 4px 8px;
}
</style>
