<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  api,
  ApiError,
  type Difficulty,
  type FirstTurn,
  type MatchConfig,
  type MatchView,
  type Rejection,
  type WeaponType,
} from "./api/client";
import BoardGrid from "./components/BoardGrid.vue";

const config = ref<MatchConfig | null>(null);
const match = ref<MatchView | null>(null);
const message = ref("");

const form = ref<{
  boardSize: number;
  difficulty: Difficulty;
  firstTurn: FirstTurn;
  extraTurnOnHit: boolean;
}>({
  boardSize: 8,
  difficulty: "NORMAL",
  firstTurn: "RANDOM",
  extraTurnOnHit: false,
});

const rejectionText: Record<Rejection, string> = {
  BOARD_SIZE_OUT_OF_LIMITS: "El tamaño del tablero está fuera de los límites.",
  FLEET_SIZE_OUT_OF_LIMITS: "La flota no tiene el número de barcos permitido.",
  FLEET_DOES_NOT_FIT: "La flota no cabe en el tablero.",
  ARSENAL_AMMO_OUT_OF_LIMITS: "Cada arma debe tener al menos una unidad de munición.",
  ARSENAL_WEAPONS_NOT_CONFIGURABLE_WEAPONS: "El misil no es configurable: siempre está disponible.",
  MATCH_IN_PROGRESS: "Ya hay una partida en curso.",
};

const weaponName: Record<WeaponType, string> = {
  MISSILE: "Misil",
  BOMB: "Bomba",
  BOMBER: "Avión de ataque",
  TORPEDO: "Torpedo",
  RECON_PLANE: "Avión de reconocimiento",
};

function show(error: unknown) {
  message.value =
    error instanceof ApiError
      ? (rejectionText[error.reason as Rejection] ?? error.reason)
      : String(error);
}

function fillForm(current: MatchConfig) {
  config.value = current;
  form.value = {
    boardSize: current.boardSize,
    difficulty: current.difficulty,
    firstTurn: current.firstTurn,
    extraTurnOnHit: current.extraTurnOnHit,
  };
}

async function saveConfig() {
  message.value = "";
  try {
    fillForm(await api.configure(form.value));
    message.value = "Configuración guardada.";
  } catch (error) {
    show(error);
  }
}

async function startMatch() {
  message.value = "";
  try {
    match.value = await api.startMatch();
  } catch (error) {
    show(error);
  }
}

onMounted(async () => {
  fillForm(await api.getConfig());
  match.value = await api.getMatch();
});
</script>

<template>
  <main>
    <h1>Guerra naval</h1>

    <section v-if="!match" class="panel">
      <h2>Configurar partida</h2>
      <form @submit.prevent="saveConfig">
        <label>
          Tamaño del tablero
          <input v-model.number="form.boardSize" type="number" min="1" />
        </label>
        <label>
          Dificultad
          <select v-model="form.difficulty">
            <option value="EASY">Fácil</option>
            <option value="NORMAL">Normal</option>
            <option value="HARD">Difícil</option>
          </select>
        </label>
        <label>
          Primer turno
          <select v-model="form.firstTurn">
            <option value="HUMAN">Jugador</option>
            <option value="BOT">Oponente</option>
            <option value="RANDOM">Al azar</option>
          </select>
        </label>
        <label class="check">
          <input v-model="form.extraTurnOnHit" type="checkbox" />
          Un acierto concede otro turno
        </label>
        <div class="actions">
          <button type="submit">Guardar configuración</button>
          <button type="button" class="primary" @click="startMatch">Iniciar partida</button>
        </div>
      </form>
      <p v-if="config" class="hint">
        Flota: {{ config.shipLengths.join(", ") }} casillas.
      </p>
    </section>

    <p v-if="message" class="message">{{ message }}</p>

    <template v-if="match">
      <p class="hint">Fase: {{ match.phase }}</p>
      <div class="boards">
        <BoardGrid title="Tu tablero" :board="match.ownBoard" />
        <BoardGrid title="Tablero rival" :board="match.rivalBoard" />
      </div>
      <section class="panel">
        <h2>Arsenal</h2>
        <ul>
          <li v-for="weapon in match.arsenal" :key="weapon.type">
            {{ weaponName[weapon.type] }}: {{ weapon.ammo ?? "∞" }}
          </li>
        </ul>
        <h2>Flota</h2>
        <ul>
          <li v-for="(ship, index) in match.fleet" :key="index">
            Barco de {{ ship.length }}: {{ ship.placed ? "ubicado" : "sin ubicar" }}
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>
