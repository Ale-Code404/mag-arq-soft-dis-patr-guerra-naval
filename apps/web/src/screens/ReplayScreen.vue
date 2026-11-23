<script setup lang="ts">
import { computed } from "vue";
import BoardGrid from "../components/BoardGrid.vue";
import { describeTurn, formatDate, winnerName } from "../game/labels";
import { shipsFromBoard } from "../game/ships";
import { useGame } from "../game/useGame";

const game = useGame();
const replay = computed(() => game.replay.value!);
const atEnd = computed(() => replay.value.turn === replay.value.totalTurns);
const playerShips = computed(() => shipsFromBoard(replay.value.playerBoard, true));
const opponentShips = computed(() => shipsFromBoard(replay.value.opponentBoard, true));
const progress = computed(() => (replay.value.totalTurns === 0 ? 100 : (replay.value.turn / replay.value.totalTurns) * 100));
</script>

<template>
  <section class="replay stack">
    <div class="card bar">
      <div>
        <p class="eyebrow">Reproducción · {{ formatDate(replay.finishedAt) }}</p>
        <h2>
          {{ replay.turn === 0 ? "Estado inicial" : `Turno ${replay.turn} de ${replay.totalTurns}` }}
        </h2>
        <p class="muted now">
          <template v-if="replay.lastTurn">
            <strong :class="replay.lastTurn.side.toLowerCase()">{{ replay.lastTurn.side === "PLAYER" ? "Tú" : "Rival" }}</strong>
            · {{ describeTurn(replay.lastTurn) }}
          </template>
          <template v-else>Ambas flotas a la vista, antes del primer disparo.</template>
        </p>
      </div>

      <div class="controls">
        <button type="button" class="btn" :disabled="game.replayPlaying.value || replay.turn === 0" @click="game.replayTo(0)" aria-label="Inicio">⏮</button>
        <button type="button" class="btn" :disabled="game.replayPlaying.value" @click="game.replayTo(replay.turn - 1)" aria-label="Anterior">◀</button>
        <button v-if="!game.replayPlaying.value" type="button" class="btn btn-primary" :disabled="atEnd" @click="game.playReplay()">▶ Reproducir</button>
        <button v-else type="button" class="btn btn-amber" @click="game.stopReplay()">❚❚ Pausar</button>
        <button type="button" class="btn" :disabled="game.replayPlaying.value" @click="game.replayTo(replay.turn + 1)" aria-label="Siguiente">▶</button>
        <button type="button" class="btn" :disabled="game.replayPlaying.value || atEnd" @click="game.replayTo(replay.totalTurns)" aria-label="Final">⏭</button>
        <button type="button" class="btn btn-ghost" @click="game.closeReplay()">Cerrar</button>
      </div>

      <div class="track" aria-hidden="true"><span :style="{ width: `${progress}%` }"></span></div>
    </div>

    <div v-if="atEnd" class="card verdict" :class="replay.winner === 'PLAYER' ? 'won' : 'lost'">
      <strong>Fin de la partida</strong> · Ganador: {{ winnerName(replay.winner) }}
    </div>

    <div class="boards">
      <BoardGrid title="Tu flota" :board="replay.playerBoard" :ships="playerShips" :overlay="game.replayRecon.value.onPlayer" />
      <BoardGrid
        title="Flota enemiga"
        :board="replay.opponentBoard"
        :ships="opponentShips"
        :overlay="game.replayRecon.value.onOpponent"
      />
    </div>
  </section>
</template>

<style scoped>
.bar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 18px 24px;
  align-items: center;
}

.bar h2 {
  margin: 6px 0 4px;
  font-size: 1.4rem;
}

.now strong.player {
  color: var(--cyan);
}

.now strong.opponent {
  color: var(--amber);
}

.controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.controls .btn {
  min-width: 44px;
  padding: 0 14px;
}

.track {
  grid-column: 1 / -1;
  height: 4px;
  border-radius: 999px;
  background: var(--water-edge);
  overflow: hidden;
}

.track span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--cyan), var(--amber));
  transition: width 0.3s ease;
}

.verdict {
  padding: 14px 20px;
  text-align: center;
}

.verdict.won {
  color: var(--success);
  border-color: rgba(69, 224, 168, 0.45);
}

.verdict.lost {
  color: var(--sunk);
  border-color: rgba(255, 61, 85, 0.45);
}

.boards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 28px;
  justify-items: center;
}

@media (max-width: 760px) {
  .bar {
    grid-template-columns: 1fr;
  }

  .controls {
    justify-content: flex-start;
  }
}
</style>
