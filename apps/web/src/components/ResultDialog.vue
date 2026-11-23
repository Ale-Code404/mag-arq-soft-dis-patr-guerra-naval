<script setup lang="ts">
import { computed, onMounted } from "vue";
import { precisionText } from "../game/labels";
import { useGame } from "../game/useGame";

const game = useGame();
const won = computed(() => game.match.value?.winner === "PLAYER");
const stats = computed(() => game.statistics.value);

// CU-07 extends CU-06: shown with the result.
onMounted(() => game.loadStatistics());
</script>

<template>
  <div class="backdrop">
    <div class="dialog card" :class="won ? 'won' : 'lost'" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <p class="eyebrow">{{ won ? "Misión cumplida" : "Flota perdida" }}</p>
      <h2 id="result-title">{{ won ? "¡Victoria!" : "Derrota" }}</h2>
      <p class="muted">
        {{ won ? "Hundiste toda la flota enemiga." : "El oponente hundió tu flota." }}
        <template v-if="game.saved.value !== null">
          {{ game.saved.value ? "La partida quedó en tu bitácora." : "No se pudo guardar la partida." }}
        </template>
      </p>

      <div v-if="stats" class="stats">
        <div>
          <span class="muted">Precisión</span>
          <strong class="mono">{{ precisionText(stats) }}</strong>
          <small v-if="stats.precision !== null" class="muted">{{ stats.hits }} de {{ stats.damagingShots }}</small>
        </div>
        <div>
          <span class="muted">Turnos</span>
          <strong class="mono">{{ stats.turns.total }}</strong>
          <small class="muted">tuyos {{ stats.turns.player }} · rival {{ stats.turns.opponent }}</small>
        </div>
        <div>
          <span class="muted">Hundidos</span>
          <strong class="mono">{{ stats.shipsSunk.opponent }} / {{ stats.shipsSunk.player }}</strong>
          <small class="muted">enemigos / propios</small>
        </div>
      </div>

      <button type="button" class="btn btn-primary btn-lg btn-block" @click="game.closeMatch()">Volver al puerto</button>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(2, 6, 12, 0.7);
  backdrop-filter: blur(6px);
  animation: appear 0.3s ease both;
}

.dialog {
  width: min(520px, 100%);
  display: grid;
  gap: 14px;
  text-align: center;
  animation: rise 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.dialog h2 {
  font-size: clamp(2.2rem, 7vw, 3.2rem);
  font-weight: 700;
}

.won {
  border-color: rgba(69, 224, 168, 0.5);
}

.won h2 {
  color: var(--success);
  text-shadow: 0 0 30px rgba(69, 224, 168, 0.45);
}

.lost {
  border-color: rgba(255, 61, 85, 0.5);
}

.lost h2 {
  color: var(--sunk);
  text-shadow: 0 0 30px rgba(255, 61, 85, 0.45);
}

.won .eyebrow {
  color: var(--success);
}

.lost .eyebrow {
  color: var(--sunk);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 8px 0;
}

.stats div {
  display: grid;
  gap: 4px;
  padding: 14px 8px;
  border-radius: var(--radius-sm);
  background: rgba(3, 10, 20, 0.55);
  border: 1px solid var(--line);
}

.stats span {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.stats strong {
  font-size: 1.35rem;
  color: var(--text);
}

.stats small {
  font-size: 0.72rem;
}

@keyframes appear {
  from {
    opacity: 0;
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.96);
  }
}

@media (max-width: 480px) {
  .stats {
    grid-template-columns: 1fr;
  }
}
</style>
