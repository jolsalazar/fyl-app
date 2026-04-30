interface Toast {
  id: number
  message: string
  type: 'ok' | 'error' | 'info'
}

const toasts = ref<Toast[]>([])
let _nextId = 0

export function useToast() {
  function show(message: string, type: Toast['type'] = 'ok', duration = 3000) {
    const id = ++_nextId
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
  }
  return { toasts: readonly(toasts), show }
}
