<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  Difficulty,
  FirstTurn,
  type MatchConfig,
  type MatchView,
  WeaponType,
} from "@guerra-naval/core";
import { api, ApiError } from "./api";
import BoardGrid from "./components/BoardGrid.vue";

const config = ref<MatchConfig | null>(null);
const match = ref<MatchView | null>(null);
const message = ref("");

const form = ref({
  boardSize: 8,
  difficulty: Difficulty.NORMAL,
  firstTurn: FirstTurn.RANDOM,
  extraTurnOnHit: false,
});

const rejectionText: Record<string, string> = {
  BOARD_SIZE_OUT_OF_LIMITS: "El tamaño del tablero está fuera de los límites.",
  FLEET_SIZE_OUT_OF_LIMITS: "La flota no tiene el número de barcos permitido.",
  FLEET_DOES_NOT_FIT: "La flota no cabe en el tablero.",
  MATCH_IN_PROGRESS: "Ya hay una partida en curso.",
};

const weaponName: Record<WeaponType, string> = {
  [WeaponType.MISSILE]: "Misil",
  [WeaponType.BOMB]: "Bomba",
  [WeaponType.BOMBER]: "Avión de ataque",
  [WeaponType.TORPEDO]: "Torpedo",
  [WeaponType.RECON_PLANE]: "Avión de reconocimiento",
};

function show(error: unknown) {
  message.value =
    error instanceof ApiError ? (rejectionText[error.message] ?? error.message) : String(error);
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
    fillForm((await api.configure(form.value)).config);
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
  match.value = await api.getMatch().catch(() => null);
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
            <option :value="Difficulty.EASY">Fácil</option>
            <option :value="Difficulty.NORMAL">Normal</option>
            <option :value="Difficulty.HARD">Difícil</option>
          </select>
        </label>
        <label>
          Primer turno
          <select v-model="form.firstTurn">
            <option :value="FirstTurn.HUMAN">Jugador</option>
            <option :value="FirstTurn.BOT">Oponente</option>
            <option :value="FirstTurn.RANDOM">Al azar</option>
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
