<script setup lang="ts">
import { ref } from 'vue'
import VueNumberInput from '@chenfengyuan/vue-number-input'
import { stringHP } from '@renderer/utils'
import Creatures, { Creature } from '@renderer/model/Creature'

const thisCreatures = ref<Creature[]>(Creatures.value)
let refreshKey = ref<number>(0)
let lastSetRest = ref<number>(0)

function setRest(coef: number): void {
  for (let i of thisCreatures.value) {
    if (i.currentHP > 0) { i.restHPCoef = coef; i.restPPCoef = coef }
    else { i.restHPCoef = 0; i.restPPCoef = 0 }
  }
  lastSetRest.value = coef
  refreshKey.value += 1
}

function resetRest(): void {
  let temp = lastSetRest.value
  setRest(0)
  lastSetRest.value = temp
  refreshKey.value += 1
}

const FACTION_NAMES = ['玩家', '友方', '中立', '敌方']

function setFactionRest(faction: string, coef: number): void {
  for (let i of thisCreatures.value) {
    if (i.faction === faction) {
      if (i.currentHP > 0) { i.restHPCoef = coef; i.restPPCoef = coef }
      else { i.restHPCoef = 0; i.restPPCoef = 0 }
    }
  }
  if (coef > 0) lastSetRest.value = coef
  refreshKey.value += 1
}

function applyRestResult(): void {
  for (let i of thisCreatures.value) {
    i.takeHP([Math.floor((i.maxHP() * i.restHPCoef) / 100), 0])
    i.takePP(Math.floor((i.maxPP() * i.restPPCoef) / 100))
    for (let m of i.moves) {
      if (m.chargeAt == '每长休' && lastSetRest.value >= 100) m.charge = m.maxCharge
      else if (m.chargeAt == '每短休' && lastSetRest.value >= 50) m.charge = m.maxCharge
    }
  }
  lastSetRest.value = 0
  refreshKey.value += 1
}
</script>

<template>
  <div class="panel-page">
    <div class="panel-toolbar">
      <button class="w3-button w3-light-gray" @click="setRest(50)">设置短休</button>
      <button class="w3-button w3-light-gray" @click="setRest(100)">设置长休</button>
      <button class="w3-button w3-light-gray" @click="resetRest()">清空系数</button>
    </div>
    <div class="faction-rest-grid">
      <span v-for="f in FACTION_NAMES" :key="f" class="faction-rest-row">
        <span :style="{ color: { 玩家: 'dodgerblue', 友方: 'mediumseagreen', 中立: '#f9a825', 敌方: 'crimson' }[f], fontWeight: 'bold', fontSize: 'small' }">{{ f }}</span>
        <button class="w3-button w3-tiny w3-light-gray" @click="setFactionRest(f, 50)">短休</button>
        <button class="w3-button w3-tiny w3-light-gray" @click="setFactionRest(f, 100)">长休</button>
        <button class="w3-button w3-tiny w3-light-gray" @click="setFactionRest(f, 0)">清除</button>
      </span>
    </div>
    <p class="panel-note">HP 为 0 的角色无法享受短休或长休的收益。</p>
    <div class="table-wrap">
      <table class="w3-table-all w3-centered dense-table">
      <thead>
        <tr><th>角色</th><th>当前 HP</th><th>当前 PP</th><th>恢复 HP 百分比</th><th>恢复 PP 百分比</th><th>休息后 HP</th><th>休息后 PP</th></tr>
      </thead>
      <tbody>
        <tr v-for="i in thisCreatures" :key="i.code()">
          <td>{{ i.name() }}</td>
          <td :style="{ color: i.currentHP <= 0 ? 'crimson' : '' }">{{ stringHP(i.hpSet(), i.maxHP()) }}</td>
          <td>{{ i.currentPP }}/{{ i.maxPP() }}</td>
          <td><vue-number-input v-model="i.restHPCoef" size="small" inline center controls :min="0" :step="5" :max="100" /></td>
          <td><vue-number-input v-model="i.restPPCoef" size="small" inline center controls :step="5" :min="0" :max="100" /></td>
          <td :style="{ color: i.currentHP <= 0 ? 'crimson' : '' }">{{ stringHP(i.previewHP([Math.floor((i.maxHP() * i.restHPCoef) / 100), 0]), i.maxHP()) }}</td>
          <td>{{ i.previewPP(Math.floor((i.maxPP() * i.restPPCoef) / 100)) }}/{{ i.maxPP() }}</td>
        </tr>
      </tbody>
      </table>
    </div>
    <div>
      <button v-if="lastSetRest > 0" class="w3-button w3-center w3-red w3-right" @click="applyRestResult()">完成一次{{ lastSetRest == 100 ? '长' : '短' }}休</button>
    </div>
  </div>
</template>

<style scoped>
.faction-rest-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em 0.75em;
  margin-bottom: 0.55em;
}

.faction-rest-row {
  display: inline-flex;
  align-items: center;
  gap: 0.2em;
  white-space: nowrap;
}
</style>
