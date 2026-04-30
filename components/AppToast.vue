<template>
  <TransitionGroup tag="div" class="toast-wrap" name="toast">
    <div v-for="t in toasts" :key="t.id" :class="['toast', t.type]">
      <svg v-if="t.type === 'ok'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <svg v-else-if="t.type === 'error'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ t.message }}
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
const { toasts } = useToast()
</script>

<style scoped>
.toast-wrap {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 9999;
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  min-width: 220px;
  max-width: 340px;
}
.toast.ok    { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.toast.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.toast.info  { background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; }

.toast-enter-active { animation: toast-in 0.22s ease; }
.toast-leave-active { animation: toast-out 0.18s ease forwards; }
@keyframes toast-in  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toast-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(10px); } }
</style>
