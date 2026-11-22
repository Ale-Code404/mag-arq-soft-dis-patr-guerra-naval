<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { api, ApiError, type FinishedMatchSummary, type OutcomeType, type ReplayView, type TurnView } from "../api/client";
import { cellKey, cellLabel } from "../coordinates";
import BoardGrid from "./BoardGrid.vue";

// CU-10, step 5: one turn per interval. Pendiente in the CU: its value and
// whether the Jugador may change it.
const REPLAY_INTERVAL_MS = 1_000;

const props = defineProps<{ describeTurn: (turn: TurnView) => string }>();
// The page hides the configuration while a match is being replayed.
const emit = defineEmits<{ active: [replaying: boolean] }>();

const saved = ref<FinishedMatchSummary[] | null>(null);
const replay = ref<ReplayView | null>(null);
const message = ref("");
let timer: ReturnType<typeof setInterval> | undefined;
const playing = ref(false);

const rejectionText: Record<string, string> = {
  MATCH_IN_PROGRESS: "Hay una partida en curso; termínala o abandónala antes de reproducir otra.",
  NOT_FOUND: "Esa partida guardada ya no existe.",
  INVALID_MATCH: "La partida guardada no se puede leer o su contenido no es válido.",
  NO_REPLAY: "No hay ninguna partida cargada.",
  NO_SUCH_TURN: "Ese turno no existe.",
  TOO_MANY_REQUESTS: "Demasiadas peticiones seguidas; espera un momento.",
};

function show(error: unknown) {
  message.value =
    error instanceof ApiError ? (rejectionText[error.reason] ?? error.reason) : String(error);
}

const winnerName = (winner: string | null) =>
  winner === "PLAYER" ? "tú" : winner === "OPPONENT" ? "el oponente" : "desconocido";

const formatDate = (iso: string | null) => (iso === null ? "No se puede leer" : new Date(iso).toLocaleString());

// A recon turn is drawn over the board it flew over (D-17).
const recon = computed(() => {
  const last = replay.value?.lastTurn;
  const cells =
    last?.weapon === "RECON_PLANE"
      ? new Map<string, OutcomeType>(last.outcomes.map((o) => [cellKey(o), o.result]))
      : new Map<string, OutcomeType>();
  return { onPlayer: last?.side === "OPPONENT" ? cells : new Map(), onOpponent: last?.side === "PLAYER" ? cells : new Map() };
});

const atEnd = computed(() => replay.value !== null && replay.value.turn === replay.value.totalTurns);

// CU-09, step 1 and 1a.
async function openList() {
  message.value = "";
  try {
    saved.value = await api.listMatches();
    if (saved.value.length === 0) message.value = "No hay partidas guardadas.";
  } catch (error) {
    show(error);
  }
}

// CU-09, steps 2-4, and CU-10, step 3. On 3a the list stays open.
async function load(id: string) {
  message.value = "";
  try {
    replay.value = await api.loadReplay(id);
    saved.value = null;
    emit("active", true);
  } catch (error) {
    show(error);
  }
}

// 4a1 and 4a2: the API rebuilds any turn, forward or back.
async function goTo(turn: number) {
  if (!replay.value) return;
  if (turn > replay.value.totalTurns) {
    message.value = "No hay más turnos.";
    return;
  }
  if (turn < 0) {
    message.value = "Estás en el estado inicial; no hay turno anterior.";
    return;
  }
  message.value = "";
  try {
    replay.value = await api.replayAt(turn);
  } catch (error) {
    show(error);
  }
}

// CU-10, step 5 and 5a: stopping leaves it on the current turn, step by step.
function play() {
  if (!replay.value || atEnd.value) return;
  playing.value = true;
  timer = setInterval(async () => {
    await goTo(replay.value!.turn + 1);
    if (atEnd.value) stop();
  }, REPLAY_INTERVAL_MS);
}

function stop() {
  clearInterval(timer);
  playing.value = false;
}

// CU-10, steps 6-7.
async function close() {
  stop();
  message.value = "";
  try {
    await api.closeReplay();
  } catch {
    // Already closed on the server: nothing left to do.
  }
  replay.value = null;
  emit("active", false);
}

onUnmounted(stop);
</script>

<template>
  <section class="panel">
    <h2>Partidas guardadas</h2>

    <template v-if="!replay">
      <div class="actions">
        <button type="button" @click="openList">Reproducir una partida</button>
        <button v-if="saved" type="button" class="ghost" @click="saved = null">Cancelar</button>
      </div>
      <ul v-if="saved && saved.length > 0" class="saved">
        <li v-for="match in saved" :key="match.id">
          <button type="button" @click="load(match.id)">
            {{ formatDate(match.finishedAt) }}
            <span class="tag" :class="{ done: match.winner === 'PLAYER' }">ganador: {{ winnerName(match.winner) }}</span>
          </button>
        </li>
      </ul>
    </template>

    <template v-else>
      <p class="hint">
        Partida del {{ formatDate(replay.finishedAt) }} ·
        <strong>{{ replay.turn === 0 ? "Estado inicial" : `Turno ${replay.turn} de ${replay.totalTurns}` }}</strong>
        <template v-if="replay.lastTurn"> · {{ props.describeTurn(replay.lastTurn) }}</template>
        <template v-if="replay.lastTurn?.weapon === 'RECON_PLANE'">
          ({{ replay.lastTurn.outcomes.filter((o) => o.result === "SPOTTED").map(cellLabel).join(", ") || "sin barcos" }})
        </template>
      </p>
      <p v-if="atEnd" class="hint">
        <strong>Fin de la partida. Ganador: {{ winnerName(replay.winner) }}.</strong>
      </p>
      <div class="actions">
        <button type="button" :disabled="playing" @click="goTo(replay.turn - 1)">← Anterior</button>
        <button v-if="!playing" type="button" class="primary" :disabled="atEnd" @click="play">Automático</button>
        <button v-else type="button" class="primary" @click="stop">Detener</button>
        <button type="button" :disabled="playing" @click="goTo(replay.turn + 1)">Siguiente →</button>
        <button type="button" class="ghost" @click="close">Cerrar reproducción</button>
      </div>
      <div class="boards">
        <BoardGrid title="Tu flota" :board="replay.playerBoard" :overlay="recon.onPlayer" />
        <BoardGrid title="Flota del oponente" :board="replay.opponentBoard" :overlay="recon.onOpponent" />
      </div>
    </template>

    <p v-if="message" class="message" role="status">{{ message }}</p>
  </section>
</template>

<style scoped>
.saved {
  list-style: none;
  padding: 0;
  margin: 0.75rem 0 0;
  display: grid;
  gap: 0.5rem;
}

.saved button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
</style>
