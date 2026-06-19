import { ref, type Ref } from 'vue'
import type { DockviewApi } from 'dockview-core'
import type { DockviewReadyEvent } from 'dockview-vue'
import { clampNumber } from './canvasGeometry'

const floatingPanelMinReachableSize = 32

export function useSceneDockview(containerRef: Ref<HTMLElement | null>) {
  const dockviewApi = ref<DockviewApi | null>(null)
  const dockviewReady = ref(false)
  let dockviewDisposables: { dispose: () => void }[] = []
  let floatingPanelObserver: MutationObserver | null = null
  let floatingPanelReachabilityFrame = 0

  function disposeDockviewListeners(): void {
    dockviewDisposables.forEach((disposable) => disposable.dispose())
    dockviewDisposables = []
  }

  function keepFloatingPanelsReachable(): void {
    const host = containerRef.value?.querySelector<HTMLElement>('.dv-floating-overlay-host')
    if (!host) return

    const hostRect = host.getBoundingClientRect()
    const panels = host.querySelectorAll<HTMLElement>('.dv-resize-container')

    panels.forEach((panel) => {
      if (panel.classList.contains('dv-hidden')) return

      const rect = panel.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const currentLeft = rect.left - hostRect.left
      const currentTop = rect.top - hostRect.top
      const nextLeft =
        rect.width <= hostRect.width ? clampNumber(currentLeft, 0, hostRect.width - rect.width) : 0
      const nextTop =
        rect.height <= hostRect.height ? clampNumber(currentTop, 0, hostRect.height - rect.height) : 0

      if (Math.abs(nextLeft - currentLeft) < 0.5 && Math.abs(nextTop - currentTop) < 0.5) {
        return
      }

      panel.style.left = `${nextLeft}px`
      panel.style.top = `${nextTop}px`
      panel.style.right = 'auto'
      panel.style.bottom = 'auto'
      panel.style.maxWidth = `${Math.max(floatingPanelMinReachableSize, hostRect.width)}px`
      panel.style.maxHeight = `${Math.max(floatingPanelMinReachableSize, hostRect.height)}px`
    })
  }

  function scheduleKeepFloatingPanelsReachable(): void {
    if (floatingPanelReachabilityFrame) {
      cancelAnimationFrame(floatingPanelReachabilityFrame)
    }
    floatingPanelReachabilityFrame = requestAnimationFrame(() => {
      floatingPanelReachabilityFrame = 0
      keepFloatingPanelsReachable()
    })
  }

  function setupFloatingPanelObserver(): void {
    floatingPanelObserver?.disconnect()
    const host = containerRef.value?.querySelector<HTMLElement>('.dv-floating-overlay-host')
    if (!host) return
    floatingPanelObserver = new MutationObserver(scheduleKeepFloatingPanelsReachable)
    floatingPanelObserver.observe(host, { childList: true })
  }

  function onDockviewReady(event: DockviewReadyEvent): void {
    dockviewApi.value = event.api
    dockviewReady.value = true
    disposeDockviewListeners()
    dockviewDisposables = [
      event.api.onDidLayoutChange(scheduleKeepFloatingPanelsReachable),
      event.api.onDidAddPanel(scheduleKeepFloatingPanelsReachable),
      event.api.onDidAddGroup(scheduleKeepFloatingPanelsReachable)
    ]
    setupFloatingPanelObserver()
    scheduleKeepFloatingPanelsReachable()
  }

  function cleanupDockview(): void {
    if (floatingPanelReachabilityFrame) {
      cancelAnimationFrame(floatingPanelReachabilityFrame)
      floatingPanelReachabilityFrame = 0
    }
    floatingPanelObserver?.disconnect()
    floatingPanelObserver = null
    disposeDockviewListeners()
  }

  return {
    dockviewApi,
    dockviewReady,
    onDockviewReady,
    scheduleKeepFloatingPanelsReachable,
    cleanupDockview
  }
}
