<script setup lang="ts">
import { ref } from "vue";
import { useGame } from "../game/useGame";

const game = useGame();
const copied = ref(false);

async function copy() {
  if (!game.newCode.value) return;
  try {
    await navigator.clipboard.writeText(game.newCode.value);
    copied.value = true;
  } catch {
    game.notify("No se pudo copiar; anótalo a mano.", "error");
  }
}
</script>

<template>
  <Transition name="fade">
    <aside v-if="game.newCode.value" class="notice card">
      <div class="stack">
        <p class="eyebrow">Tu código de acceso</p>
        <p class="code mono">{{ game.newCode.value }}</p>
        <p class="muted">
          Guárdalo: con él vuelves a tu partida desde cualquier navegador. No se puede mostrar de nuevo.
        </p>
      </div>
      <div class="row">
        <button type="button" class="btn" @click="copy">{{ copied ? "Copiado ✓" : "Copiar" }}</button>
        <button type="button" class="btn btn-primary" @click="game.newCode.value = null">Ya lo guardé</button>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  border-color: rgba(255, 179, 71, 0.45);
  background: linear-gradient(135deg, rgba(255, 179, 71, 0.12), rgba(12, 30, 50, 0.72));
}

.notice .eyebrow {
  color: var(--amber);
}

.code {
  font-size: clamp(1.4rem, 4vw, 2rem);
  font-weight: 600;
  letter-spacing: 0.18em;
  color: var(--amber);
  text-shadow: 0 0 20px rgba(255, 179, 71, 0.35);
}
</style>
