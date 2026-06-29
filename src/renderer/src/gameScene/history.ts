import { computed, ref } from 'vue'

export interface HistorySnapshot {
  label: string
  data: string
  byteSize: number
}

export interface HistoryManagerOptions {
  maxEntries?: number
  maxBytes?: number
  debounceMs?: number
}

export class HistoryManager {
  private readonly maxEntries: number
  private readonly maxBytes: number
  private readonly debounceMs: number
  private currentSnapshot = ''
  private debounceTimer: number | null = null
  private transactionDepth = 0
  private transactionLabel = ''

  readonly undoStack = ref<HistorySnapshot[]>([])
  readonly redoStack = ref<HistorySnapshot[]>([])
  readonly isRestoring = ref(false)
  readonly canUndo = computed(() => this.undoStack.value.length > 0)
  readonly canRedo = computed(() => this.redoStack.value.length > 0)

  constructor(options: HistoryManagerOptions = {}) {
    this.maxEntries = options.maxEntries ?? 50
    this.maxBytes = options.maxBytes ?? 180 * 1024 * 1024
    this.debounceMs = options.debounceMs ?? 400
  }

  initialize(snapshot: string): void {
    this.clearTimers()
    this.currentSnapshot = snapshot
    this.undoStack.value = []
    this.redoStack.value = []
    this.transactionDepth = 0
    this.transactionLabel = ''
  }

  clear(snapshot = this.currentSnapshot): void {
    this.initialize(snapshot)
  }

  beginTransaction(label: string): void {
    if (this.isRestoring.value) return
    if (this.transactionDepth == 0) {
      this.clearTimers()
      this.transactionLabel = label
    }
    this.transactionDepth += 1
  }

  endTransaction(snapshot: string): void {
    if (this.isRestoring.value) return
    if (this.transactionDepth <= 0) {
      this.capture(snapshot)
      return
    }
    this.transactionDepth -= 1
    if (this.transactionDepth == 0) {
      const label = this.transactionLabel || '操作'
      this.transactionLabel = ''
      this.capture(snapshot, label)
    }
  }

  capture(snapshot: string, label = '操作'): void {
    if (this.isRestoring.value) return
    if (this.transactionDepth > 0) return
    this.clearTimers()
    this.commit(snapshot, label)
  }

  captureDebounced(snapshotFactory: () => string, label = '编辑'): void {
    if (this.isRestoring.value || this.transactionDepth > 0) return
    this.clearTimers()
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null
      this.commit(snapshotFactory(), label)
    }, this.debounceMs)
  }

  undo(): string | null {
    this.clearTimers()
    const previous = this.undoStack.value.pop()
    if (!previous) return null
    this.redoStack.value.push(this.makeSnapshot(this.currentSnapshot, previous.label))
    this.currentSnapshot = previous.data
    this.prune(this.redoStack.value)
    return previous.data
  }

  redo(): string | null {
    this.clearTimers()
    const next = this.redoStack.value.pop()
    if (!next) return null
    this.undoStack.value.push(this.makeSnapshot(this.currentSnapshot, next.label))
    this.currentSnapshot = next.data
    this.prune(this.undoStack.value)
    return next.data
  }

  markRestored(snapshot: string): void {
    this.currentSnapshot = snapshot
  }

  dispose(): void {
    this.clearTimers()
  }

  private commit(snapshot: string, label: string): void {
    if (snapshot == this.currentSnapshot) return
    this.undoStack.value.push(this.makeSnapshot(this.currentSnapshot, label))
    this.currentSnapshot = snapshot
    this.redoStack.value = []
    this.prune(this.undoStack.value)
  }

  private makeSnapshot(data: string, label: string): HistorySnapshot {
    return {
      label,
      data,
      byteSize: new TextEncoder().encode(data).byteLength
    }
  }

  private prune(stack: HistorySnapshot[]): void {
    while (stack.length > this.maxEntries) stack.shift()
    while (this.totalBytes() > this.maxBytes) {
      if (this.undoStack.value.length > 0) {
        this.undoStack.value.shift()
      } else if (this.redoStack.value.length > 0) {
        this.redoStack.value.shift()
      } else {
        break
      }
    }
  }

  private totalBytes(): number {
    const sum = (items: HistorySnapshot[]) =>
      items.reduce((total, item) => total + item.byteSize, 0)
    return (
      new TextEncoder().encode(this.currentSnapshot).byteLength +
      sum(this.undoStack.value) +
      sum(this.redoStack.value)
    )
  }

  private clearTimers(): void {
    if (!this.debounceTimer) return
    window.clearTimeout(this.debounceTimer)
    this.debounceTimer = null
  }
}
