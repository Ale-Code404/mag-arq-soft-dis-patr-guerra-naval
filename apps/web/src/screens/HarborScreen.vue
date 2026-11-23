<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Difficulty, FirstTurn } from "../api/client";
import { difficultyName, firstTurnName, formatDate, winnerName } from "../game/labels";
import { useGame } from "../game/useGame";

const game = useGame();
const difficulties: Difficulty[] = ["EASY", "NORMAL", "HARD"];
const firstTurns: FirstTurn[] = ["HUMAN", "RANDOM", "BOT"];
const sizes = [8, 10, 12, 16];

const PAGE_SIZE = 6;
const page = ref(0);
const all = computed(() => game.savedMatches.value ?? []);
const pages = computed(() => Math.max(1, Math.ceil(all.value.length / PAGE_SIZE)));
const visible = computed(() => all.value.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE));
watch(pages, (count) => (page.value = Math.min(page.value, count - 1)));
</script>

<template>
  <section class="harbor">
    <div class="card mission">
      <div class="card-title">
        <div>
          <p class="eyebrow">Puerto</p>
          <h2>Nueva misión</h2>
        </div>
        <span v-if="game.config.value" class="chip">Flota {{ game.config.value.shipLengths.join(" · ") }}</span>
      </div>

      <form class="stack" @submit.prevent="game.startMatch()">
        <div class="field">
          <span>Tamaño del tablero</span>
          <div class="segmented">
            <label v-for="size in sizes" :key="size">
              <input v-model.number="game.form.value.boardSize" type="radio" :value="size" />
              {{ size }} × {{ size }}
            </label>
          </div>
        </div>

        <div class="field">
          <span>Dificultad del oponente</span>
          <div class="segmented">
            <label v-for="level in difficulties" :key="level">
              <input v-model="game.form.value.difficulty" type="radio" :value="level" />
              {{ difficultyName[level] }}
            </label>
          </div>
        </div>

        <div class="field">
          <span>Primer turno</span>
          <div class="segmented">
            <label v-for="turn in firstTurns" :key="turn">
              <input v-model="game.form.value.firstTurn" type="radio" :value="turn" />
              {{ firstTurnName[turn] }}
            </label>
          </div>
        </div>

        <label class="toggle">
          <span>
            <strong>Turno extra por acierto</strong>
            <small class="muted">Quien impacta vuelve a disparar.</small>
          </span>
          <input v-model="game.form.value.extraTurnOnHit" type="checkbox" />
        </label>

        <button type="submit" class="btn btn-primary btn-lg btn-block" :disabled="game.busy.value">Zarpar</button>
      </form>
    </div>

    <div class="card logbook">
      <div class="card-title">
        <div>
          <p class="eyebrow">Bitácora</p>
          <h2>Partidas guardadas</h2>
        </div>
        <div class="row pager">
          <template v-if="pages > 1">
            <button type="button" class="btn btn-ghost" :disabled="page === 0" aria-label="Anteriores" @click="page--">‹</button>
            <span class="mono muted">{{ page + 1 }} / {{ pages }}</span>
            <button type="button" class="btn btn-ghost" :disabled="page === pages - 1" aria-label="Siguientes" @click="page++">›</button>
          </template>
          <span class="chip">{{ all.length }}</span>
        </div>
      </div>

      <div v-if="!game.savedMatches.value?.length" class="empty">
        <div class="radar-empty" aria-hidden="true"></div>
        <p class="muted">Aún no hay partidas. Termina una y aparecerá aquí para revivirla turno a turno.</p>
      </div>

      <ul v-else class="matches">
        <li v-for="saved in visible" :key="saved.id">
          <button type="button" class="match" :disabled="game.busy.value" @click="game.openReplay(saved.id)">
            <span class="chip" :class="saved.winner === 'PLAYER' ? 'chip-success' : 'chip-danger'">
              {{ saved.winner === "PLAYER" ? "Victoria" : saved.winner ? "Derrota" : "?" }}
            </span>
            <span class="when">
              <strong>{{ formatDate(saved.finishedAt) }}</strong>
              <small class="muted">Ganador: {{ winnerName(saved.winner) }}</small>
            </span>
            <span class="play" aria-hidden="true">▶</span>
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.harbor {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.toggle strong {
  display: block;
  font-size: 0.95rem;
}

.toggle small {
  font-size: 0.8rem;
}

.matches {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  overflow: hidden;
}

.pager {
  gap: 4px;
}

.pager .btn {
  min-height: 34px;
  min-width: 34px;
  padding: 0;
  font-size: 1.2rem;
}

.match {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  font: inherit;
  color: var(--text);
  text-align: left;
  background: rgba(3, 10, 20, 0.5);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    transform 0.15s ease;
}

.match:hover:not(:disabled) {
  border-color: var(--cyan);
  transform: translateX(2px);
}

.when {
  display: grid;
  gap: 2px;
  flex: 1;
}

.when small {
  font-size: 0.78rem;
}

.play {
  color: var(--cyan);
}

.empty {
  display: grid;
  justify-items: center;
  gap: 16px;
  padding: 24px 8px;
  text-align: center;
}

.radar-empty {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  background:
    radial-gradient(circle, transparent 30%, var(--line) 31%, transparent 32%),
    radial-gradient(circle, transparent 62%, var(--line) 63%, transparent 64%);
  overflow: hidden;
}

.radar-empty::after {
  content: "";
  position: absolute;
  inset: 0;
  background: conic-gradient(from 0deg, transparent 0 300deg, rgba(63, 208, 255, 0.45) 360deg);
  animation: sweep 4s linear infinite;
}

@media (max-width: 900px) {
  .harbor {
    grid-template-columns: 1fr;
  }
}
</style>
