<script setup lang="ts">
import { computed } from "vue";
import { cellLabel } from "../coordinates";
import { useGame } from "../game/useGame";

const game = useGame();
const fleet = computed(() => game.match.value?.fleet ?? []);
const placedCount = computed(() => fleet.value.filter((ship) => ship.placed).length);
const selectedPlaced = computed(() => {
  const index = game.selectedShip.value;
  return index !== null && fleet.value[index]?.placed === true;
});
</script>

<template>
  <section class="card dock">
    <div class="card-title">
      <div>
        <p class="eyebrow">Fase 1 · Despliegue</p>
        <h2>Ubica tu flota</h2>
      </div>
      <span class="chip" :class="placedCount === fleet.length ? 'chip-success' : 'chip-amber'">
        {{ placedCount }}/{{ fleet.length }}
      </span>
    </div>

    <p class="muted hint">
      Elige un barco y pulsa la casilla de tu tablero donde empieza. Deja una casilla libre entre barcos, también en
      diagonal. <kbd>R</kbd> o la rueda del ratón giran el barco.
    </p>

    <ul class="ships">
      <li v-for="(ship, index) in fleet" :key="index">
        <button
          type="button"
          class="ship"
          :class="{ active: game.selectedShip.value === index, placed: ship.placed }"
          @click="game.selectShip(index)"
        >
          <span class="hull" :style="{ '--len': ship.length }">
            <i v-for="n in ship.length" :key="n"></i>
          </span>
          <span class="meta">
            <strong>Barco de {{ ship.length }}</strong>
            <small class="mono">
              {{ ship.placed ? `${cellLabel(ship.origin!)} ${ship.orientation === "VERTICAL" ? "↓" : "→"}` : "Sin ubicar" }}
            </small>
          </span>
        </button>
      </li>
    </ul>

    <div class="row controls">
      <button type="button" class="btn" @click="game.toggleOrientation()">
        <span aria-hidden="true">{{ game.orientation.value === "HORIZONTAL" ? "→" : "↓" }}</span>
        {{ game.orientation.value === "HORIZONTAL" ? "Horizontal" : "Vertical" }}
      </button>
      <button type="button" class="btn" :disabled="!selectedPlaced" @click="game.removeSelected()">Retirar</button>
    </div>

    <button
      type="button"
      class="btn btn-primary btn-lg btn-block"
      :disabled="!game.allPlaced.value || game.busy.value"
      @click="game.confirmFleet()"
    >
      Confirmar flota y zarpar
    </button>
    <button type="button" class="btn btn-ghost btn-block" @click="game.closeMatch()">Abandonar partida</button>
  </section>
</template>

<style scoped>
.dock {
  display: grid;
  gap: 16px;
}

.card-title {
  margin-bottom: 0;
}

.hint {
  font-size: 0.88rem;
  line-height: 1.5;
}

kbd {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  padding: 1px 6px;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  color: var(--cyan);
}

.ships {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.ship {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  font: inherit;
  color: var(--text);
  text-align: left;
  background: rgba(3, 10, 20, 0.5);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.ship:hover {
  border-color: var(--line-strong);
}

.ship.active {
  border-color: var(--amber);
  background: var(--amber-soft);
}

.hull {
  display: flex;
  gap: 3px;
  min-width: 96px;
}

.hull i {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: var(--water-edge);
  box-shadow: inset 0 0 0 1px var(--line);
}

.ship.placed .hull i {
  background: linear-gradient(160deg, #7592b3, var(--ship));
  box-shadow: none;
}

.ship.active .hull i {
  background: var(--amber);
}

.meta {
  display: grid;
  gap: 2px;
}

.meta small {
  color: var(--muted);
  font-size: 0.75rem;
}

.controls .btn {
  flex: 1;
}
</style>
