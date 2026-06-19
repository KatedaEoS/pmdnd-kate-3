<script setup lang="ts">
import pkg from '../../../../package.json'
</script>

<template>
  <div class="about-panel">
    <img src="../assets/dm_kate.png" draggable="false" alt="" />
    <div class="about-copy">
      <h3>凯特的万事幕后</h3>
      <div>Version {{ pkg.version }}</div>
      <div class="artist">Artist: 牙结石雕刻家 & 夜影翎羽</div>
    </div>
  </div>
</template>

<style scoped>
.about-panel {
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  padding: 0.5em;
  display: grid;
  grid-template-columns: minmax(120px, 42%) 1fr;
  gap: 1em;
  align-items: center;
  align-content: center;
}

.about-panel img {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  justify-self: center;
}

.about-copy h3 {
  margin-top: 0;
  margin-bottom: 0.3em;
}

.artist {
  margin-top: 0.75em;
  font-size: 12px;
  color: #666;
}
</style>
