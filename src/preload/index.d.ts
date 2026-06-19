import { ElectronAPI } from '@electron-toolkit/preload'
import type { AppAPI } from '../renderer/src/platform/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
