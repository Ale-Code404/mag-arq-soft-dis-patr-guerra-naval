<script setup lang="ts">
import { onUnmounted, watch } from "vue";
import { useGame } from "../game/useGame";

const game = useGame();
let timer: ReturnType<typeof setTimeout> | undefined;

watch(game.message, (current) => {
  clearTimeout(timer);
  if (current) timer = setTimeout(() => (game.message.value = null), current.tone === "error" ? 6000 : 3000);
});

onUnmounted(() => clearTimeout(timer));
</script>

<template>
  <Transition name="fade">
    <div v-if="game.message.value" class="toast" :class="game.message.value.tone" role="status" aria-live="polite">
      <span class="dot"></span>
      <span>{{ game.message.value.text }}</span>
      <button type="button" class="close" aria-label="Cerrar" @click="game.message.value = null">×</button>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 50;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(560px, calc(100vw - 32px));
  padding: 12px 14px 12px 16px;
  background: var(--panel-solid);
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.7);
  color: var(--cyan);
}

.toast.error {
  color: var(--danger);
  border-color: rgba(255, 90, 106, 0.5);
}

.toast span:nth-child(2) {
  color: var(--text);
  font-size: 0.92rem;
}

.close {
  margin-left: auto;
  background: none;
  border: 0;
  color: var(--muted);
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
}

.fade-enter-from,
.fade-leave-to {
  transform: translate(-50%, 8px);
}
</style>
