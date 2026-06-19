import './assets/main.css'
import './assets/w3.css'
import 'dockview-vue/dist/styles/dockview.css'

import { createApp } from 'vue'
import App from './App.vue'
import CharacterSheetPanel from './panels/CharacterSheetPanel.vue'
import CharacterListPanel from './panels/CharacterListPanel.vue'
import CharacterFullPanel from './panels/CharacterFullPanel.vue'
import BattlePanel from './panels/BattlePanel.vue'
import MovePanel from './panels/MovePanel.vue'
import MultiTargetPanel from './panels/MultiTargetPanel.vue'
import WeatherFieldPanel from './panels/WeatherFieldPanel.vue'
import SurvivePanel from './panels/SurvivePanel.vue'
import StatusPanel from './panels/StatusPanel.vue'
import CalendarPanel from './panels/CalendarPanel.vue'
import FallDamagePanel from './panels/FallDamagePanel.vue'
import CraftingPanel from './panels/CraftingPanel.vue'
import RestPanel from './panels/RestPanel.vue'
import RaceStatsPanel from './panels/RaceStatsPanel.vue'
import InitiativePanel from './panels/InitiativePanel.vue'
import AssetManagerPanel from './panels/AssetManagerPanel.vue'
import BackgroundSettingsPanel from './panels/BackgroundSettingsPanel.vue'
import AboutPanel from './panels/AboutPanel.vue'

const app = createApp(App)
app.component('CharacterSheetPanel', CharacterSheetPanel)
app.component('CharacterListPanel', CharacterListPanel)
app.component('CharacterFullPanel', CharacterFullPanel)
app.component('BattlePanel', BattlePanel)
app.component('MovePanel', MovePanel)
app.component('MultiTargetPanel', MultiTargetPanel)
app.component('WeatherFieldPanel', WeatherFieldPanel)
app.component('SurvivePanel', SurvivePanel)
app.component('StatusPanel', StatusPanel)
app.component('CalendarPanel', CalendarPanel)
app.component('FallDamagePanel', FallDamagePanel)
app.component('CraftingPanel', CraftingPanel)
app.component('RestPanel', RestPanel)
app.component('RaceStatsPanel', RaceStatsPanel)
app.component('InitiativePanel', InitiativePanel)
app.component('AssetManagerPanel', AssetManagerPanel)
app.component('BackgroundSettingsPanel', BackgroundSettingsPanel)
app.component('AboutPanel', AboutPanel)
app.mount('#app')
