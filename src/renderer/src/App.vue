<script setup lang="ts">
import GameScene from './GameScene.vue'
import { webPlatform } from './platform/web'

if (!window.api) {
  ;(window as unknown as Record<string, unknown>).api = webPlatform
}
</script>

<template>
  <GameScene />
</template>
