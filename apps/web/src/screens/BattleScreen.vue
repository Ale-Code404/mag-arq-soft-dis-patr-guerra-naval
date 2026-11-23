<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import ArsenalBar from "../components/ArsenalBar.vue";
import BoardGrid from "../components/BoardGrid.vue";
import FleetDock from "../components/FleetDock.vue";
import ResultDialog from "../components/ResultDialog.vue";
import TurnLog from "../components/TurnLog.vue";
import { shipsFromBoard } from "../game/ships";
import { useGame } from "../game/useGame";

const game = useGame();
const match = computed(() => game.match.value!);
const placing = computed(() => match.value.phase === "PLACEMENT");
const fighting = computed(() => match.value.phase === "IN_PROGRESS");
const rivalTurn = computed(() => fighting.value && game.playingSide.value === "OPPONENT");
const ownShips = computed(() => shipsFromBoard(match.value.ownBoard, true));
const rivalShips = computed(() => shipsFromBoard(match.value.rivalBoard, false));

// The wheel over the own board turns the ship while placing, instead of scrolling.
function onWheel(event: WheelEvent) {
  if (!placing.value) return;
  event.preventDefault();
  game.rotateWithWheel();
}

// R turns the ship while placing; 1 to 5 pick a weapon with ammo while fighting.
function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (placing.value && event.key.toLowerCase() === "r") return game.toggleOrientation();
  if (!fighting.value || !/^[1-9]$/.test(event.key)) return;
  const weapon = match.value.arsenal[Number(event.key) - 1];
  if (weapon && weapon.ammo !== 0) game.selectedWeapon.value = weapon.type;
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <section class="battle" :class="{ placing }">
    <aside v-if="placing" class="side">
      <FleetDock />
    </aside>
    <ArsenalBar v-else-if="fighting" class="arsenal" />

    <div class="stage">
    <div class="theatre">
      <BoardGrid
        title="Tu flota"
        :caption="placing ? 'Pulsa una casilla para ubicar el barco elegido' : 'Defiende tus barcos'"
        :board="match.ownBoard"
        :ships="ownShips"
        :clickable="placing"
        :active="placing"
        :alert="rivalTurn"
        :highlight="game.selectedCells.value"
        :effects="game.ownEffects.value"
        :preview="game.placementPreview.value.cells"
        :preview-invalid="!game.placementPreview.value.valid"
        @cell-click="game.placeAt"
        @wheel="onWheel"
        @cell-hover="(row, column) => (game.anchored.value = { row, column })"
        @hover-end="game.anchored.value = null"
      />
      <div
        class="turn"
        :class="{ hidden: !fighting, rival: rivalTurn }"
        role="status"
        aria-live="polite"
        :aria-label="rivalTurn ? 'Turno del rival' : 'Tu turno'"
      >
        <svg class="arrow" viewBox="0 0 56 28" aria-hidden="true">
          <path d="M4 14 H44" />
          <path d="M32 4 L50 14 L32 24" />
        </svg>
        <span class="who mono">{{ rivalTurn ? "Rival" : "Tú" }}</span>
      </div>
      <BoardGrid
        title="Radar enemigo"
        :caption="fighting ? 'Apunta a la esquina superior izquierda del área' : 'Se activa al zarpar'"
        :board="match.rivalBoard"
        :ships="rivalShips"
        :clickable="game.aiming.value"
        :active="fighting && !rivalTurn"
        :radar="fighting"
        :overlay="game.recon.value"
        :effects="game.rivalEffects.value"
        :preview="game.attackPreview.value.cells"
        :preview-invalid="!game.attackPreview.value.valid"
        @cell-hover="(row, column) => (game.aimed.value = { row, column })"
        @hover-end="game.aimed.value = null"
        @cell-click="game.fireAt"
      >
        <template #aside>
          <span v-if="game.recon.value.size > 0" class="chip chip-amber"><span class="dot pulse"></span>Reconocimiento</span>
        </template>
      </BoardGrid>

      <div class="legend">
        <span><i style="background: var(--ship)"></i>Barco</span>
        <span><i style="background: var(--miss)"></i>Agua</span>
        <span><i style="background: var(--hit)"></i>Impacto</span>
        <span><i style="background: var(--sunk)"></i>Hundido</span>
        <span><i style="background: var(--spotted)"></i>Detectado</span>
      </div>
    </div>
    </div>

    <TurnLog v-if="!placing" class="log" :turns="game.turns.value" />

    <ResultDialog v-if="match.phase === 'FINISHED'" />
  </section>
</template>

<style scoped>
.battle {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

.battle.placing {
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  align-items: start;
}

.side {
  position: sticky;
  top: 88px;
}

.stage {
  container-type: inline-size;
}

.theatre {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px minmax(0, 1fr);
  gap: 20px 12px;
  justify-items: center;
}

.turn {
  --nx: 5px;
  --ny: 0px;
  align-self: center;
  display: grid;
  justify-items: center;
  gap: 4px;
  width: 64px;
  margin-top: 36px;
  color: var(--cyan);
  transition: color 0.3s ease;
}

.turn.hidden {
  visibility: hidden;
}

.turn.rival {
  --nx: -5px;
  color: var(--amber);
}

.arrow {
  width: 56px;
  height: 28px;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 6px currentColor);
  transition: rotate 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  animation: nudge 1.4s ease-in-out infinite;
}

.turn.rival .arrow {
  rotate: 180deg;
}

.who {
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

@keyframes nudge {
  50% {
    translate: var(--nx) var(--ny);
  }
}

.legend {
  grid-column: 1 / -1;
  justify-content: center;
}

@container (max-width: 640px) {
  .theatre {
    grid-template-columns: 1fr;
  }

  .turn {
    --nx: 0px;
    --ny: 5px;
    margin-top: 0;
    grid-auto-flow: column;
    align-items: center;
    width: auto;
    gap: 10px;
  }

  .turn.rival {
    --nx: 0px;
    --ny: -5px;
  }

  .arrow {
    rotate: 90deg;
  }

  .turn.rival .arrow {
    rotate: -90deg;
  }
}

@media (max-width: 980px) {
  .battle.placing {
    grid-template-columns: 1fr;
  }

  .side {
    position: static;
    order: 2;
  }
}
</style>
