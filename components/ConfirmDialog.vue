<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div v-if="open" class="confirm-overlay" @click.self="onCancel">
        <div class="confirm-box" role="dialog" aria-modal="true">
          <div :class="['confirm-icon', `icon-${tone}`]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 9v4" /><path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <h3 class="confirm-title">{{ title }}</h3>
          <p class="confirm-message">{{ message }}</p>
          <div class="confirm-actions">
            <button class="btn-cancel" :disabled="busy" @click="onCancel">{{ cancelText }}</button>
            <button :class="['btn-confirm', `btn-${tone}`]" :disabled="busy" @click="onConfirm">
              {{ busy ? '…' : confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  tone?: 'primary' | 'danger' | 'warning'
  busy?: boolean
}>(), {
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  tone: 'primary',
  busy: false,
})

const emit = defineEmits<{ confirm: []; cancel: [] }>()
function onConfirm() { emit('confirm') }
function onCancel() { emit('cancel') }
</script>

<style scoped>
.confirm-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
  backdrop-filter: blur(2px);
}
.confirm-box {
  background: white; border-radius: 16px;
  padding: 1.75rem 1.75rem 1.5rem;
  max-width: 380px; width: 100%;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
  text-align: center;
  font-family: 'Inter', sans-serif;
}
.confirm-icon {
  width: 48px; height: 48px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 1rem;
}
.icon-primary { background: #eff6ff; color: #2563eb; }
.icon-warning { background: #fef3c7; color: #b45309; }
.icon-danger  { background: #fef2f2; color: #dc2626; }

.confirm-title { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; }
.confirm-message { font-size: 0.875rem; color: #64748b; line-height: 1.55; margin-bottom: 1.5rem; }

.confirm-actions { display: flex; gap: 0.75rem; }
.confirm-actions button {
  flex: 1; padding: 0.6rem 1rem; border-radius: 9px;
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  font-family: 'Inter', sans-serif; transition: all 0.15s; border: 1.5px solid transparent;
}
.confirm-actions button:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-cancel { background: #f1f5f9; border-color: #e2e8f0; color: #475569; }
.btn-cancel:hover:not(:disabled) { background: #e2e8f0; }

.btn-confirm { color: white; }
.btn-primary { background: #2563eb; }
.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.btn-warning { background: #d97706; }
.btn-warning:hover:not(:disabled) { background: #b45309; }
.btn-danger  { background: #dc2626; }
.btn-danger:hover:not(:disabled) { background: #b91c1c; }

.confirm-fade-enter-active, .confirm-fade-leave-active { transition: opacity 0.18s ease; }
.confirm-fade-enter-from, .confirm-fade-leave-to { opacity: 0; }
.confirm-fade-enter-active .confirm-box, .confirm-fade-leave-active .confirm-box { transition: transform 0.18s ease; }
.confirm-fade-enter-from .confirm-box { transform: scale(0.95); }
</style>
