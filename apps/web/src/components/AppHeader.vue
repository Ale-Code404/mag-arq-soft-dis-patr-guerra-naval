<script setup lang="ts">
import { useGame } from "../game/useGame";

const game = useGame();
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <span class="sonar" aria-hidden="true"></span>
      <div>
        <strong>Guerra naval</strong>
        <span class="mono muted">Mando táctico</span>
      </div>
    </div>
    <div v-if="game.player.value" class="who">
      <button
        type="button"
        class="btn btn-ghost sound"
        :aria-pressed="!game.sound.muted.value"
        :aria-label="game.sound.muted.value ? 'Activar sonido' : 'Silenciar'"
        :title="game.sound.muted.value ? 'Activar sonido' : 'Silenciar'"
        @click="game.sound.toggle()"
      >
        {{ game.sound.muted.value ? "🔇" : "🔊" }}
      </button>
      <span class="chip chip-cyan"><span class="dot"></span>{{ game.player.value.name }}</span>
      <button type="button" class="btn btn-ghost" aria-label="Cambiar de jugador" @click="game.signOut()">
        <span class="label">Cambiar de jugador</span>
        <span class="icon" aria-hidden="true">⇄</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 24px;
  background: rgba(3, 8, 15, 0.7);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(16px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand strong {
  display: block;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
}

.brand .mono {
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.sonar {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1.5px solid var(--cyan);
  background: radial-gradient(circle, transparent 38%, rgba(63, 208, 255, 0.35) 40%, transparent 42%);
  overflow: hidden;
  box-shadow: 0 0 16px rgba(63, 208, 255, 0.35);
}

.sonar::after {
  content: "";
  position: absolute;
  inset: 0;
  background: conic-gradient(from 0deg, transparent 0 290deg, rgba(63, 208, 255, 0.8) 360deg);
  animation: sweep 3s linear infinite;
}

.who {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.who .chip {
  max-width: 40vw;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sound {
  min-width: 42px;
  padding: 0 10px;
  font-size: 1.05rem;
}

.icon {
  display: none;
  font-size: 1.1rem;
}

@media (max-width: 560px) {
  .topbar {
    padding: 12px 14px;
  }

  .brand .mono,
  .who .label {
    display: none;
  }

  .who .icon {
    display: inline;
  }

  .who .btn {
    min-width: 42px;
    padding: 0 10px;
  }
}
</style>
