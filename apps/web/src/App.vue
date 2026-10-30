<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  api,
  ApiError,
  type ActionResult,
  type Difficulty,
  type FirstTurn,
  type MatchConfig,
  type MatchView,
  type Orientation,
  type OutcomeType,
  type Rejection,
  type ShipView,
  type TurnView,
  type WeaponType,
} from "./api/client";
import BoardGrid from "./components/BoardGrid.vue";
import { cellKey, cellLabel } from "./coordinates";

// D-17: recon results stay visible for 10 seconds; the timer lives here.
const RECON_VISIBLE_MS = 10_000;

const config = ref<MatchConfig | null>(null);
const match = ref<MatchView | null>(null);
const message = ref("");
const turns = ref<TurnView[]>([]);
const saved = ref<boolean | null>(null);

const selectedShip = ref<number | null>(null);
const orientation = ref<Orientation>("HORIZONTAL");
const selectedWeapon = ref<WeaponType>("MISSILE");
const recon = ref(new Map<string, OutcomeType>());
let reconTimer: ReturnType<typeof setTimeout> | undefined;

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
  INVALID_VALUE: "Hay un valor no válido en la configuración.",
  NO_MATCH: "No hay ninguna partida.",
  WRONG_PHASE: "Esa acción no está permitida en esta fase de la partida.",
  OUT_OF_BOARD: "El barco se sale del tablero.",
  OVERLAP: "El barco se superpone con otro.",
  UNKNOWN_SHIP: "Ese barco no existe.",
  UNKNOWN_ORIENTATION: "Orientación desconocida.",
  FLEET_NOT_PLACED: "Faltan barcos por ubicar.",
  OPPONENT_PLACEMENT_FAILED: "El oponente no pudo ubicar su flota; la partida se descartó.",
  UNKNOWN_WEAPON: "Esa arma no está en tu arsenal.",
  NO_SHOT: "No es tu turno.",
  NO_AMMO: "No queda munición para esa arma.",
  AREA_OUT_OF_BOARD: "El área de ataque se sale del tablero.",
  AREA_ALREADY_ATTACKED: "Toda esa área ya fue atacada.",
};

const weaponName: Record<WeaponType, string> = {
  MISSILE: "Misil",
  BOMB: "Bomba",
  BOMBER: "Avión de ataque",
  TORPEDO: "Torpedo",
  RECON_PLANE: "Avión de reconocimiento",
};

const weaponArea: Record<WeaponType, string> = {
  MISSILE: "1 casilla",
  BOMB: "2 × 2",
  BOMBER: "1 × 3 en horizontal",
  TORPEDO: "toda la fila, primer barco",
  RECON_PLANE: "3 × 3, sin daño",
};

const allPlaced = computed(() => match.value?.fleet.every((ship) => ship.placed) ?? false);

// Cells of the selected ship, outlined on the own board.
const selectedCells = computed(() => {
  const ship = selectedShip.value === null ? undefined : match.value?.fleet[selectedShip.value];
  return new Set(ship ? shipCells(ship) : []);
});

// Newest first, so the latest answer of the opponent is on top.
const lastTurns = computed(() => [...turns.value].reverse().slice(0, 10));

function shipCells(ship: ShipView): string[] {
  if (!ship.origin) return [];
  const { row, column } = ship.origin;
  return Array.from({ length: ship.length }, (_, i) =>
    ship.orientation === "VERTICAL" ? cellKey({ row: row + i, column }) : cellKey({ row, column: column + i }),
  );
}

function describeTurn(turn: TurnView): string {
  const who = turn.side === "PLAYER" ? "Tú" : "Rival";
  const where = `${weaponName[turn.weapon]} en ${cellLabel(turn.target)}`;
  if (turn.weapon === "RECON_PLANE") {
    const spotted = turn.outcomes.filter((o) => o.result === "SPOTTED").length;
    return `${who}: ${where} → ${spotted} ${spotted === 1 ? "casilla con barco" : "casillas con barco"}`;
  }
  const hits = turn.outcomes.filter((o) => o.result === "HIT").length;
  const result = hits === 0 ? "agua" : `${hits} ${hits === 1 ? "impacto" : "impactos"}`;
  return `${who}: ${where} → ${result}`;
}

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

function firstPendingShip(view: MatchView): number | null {
  const index = view.fleet.findIndex((ship) => !ship.placed);
  return index === -1 ? null : index;
}

function apply(result: ActionResult) {
  match.value = result.match;
  turns.value.push(...result.turns);
  if (result.saved !== undefined) saved.value = result.saved;
  for (const turn of result.turns) {
    if (turn.side === "PLAYER" && turn.weapon === "RECON_PLANE") showRecon(turn);
  }
}

// D-17: SPOTTED/CLEAR are drawn over the rival board, then hidden.
function showRecon(turn: TurnView) {
  clearTimeout(reconTimer);
  recon.value = new Map(turn.outcomes.map((o) => [cellKey(o), o.result]));
  reconTimer = setTimeout(() => (recon.value = new Map()), RECON_VISIBLE_MS);
}

async function run(action: () => Promise<void>) {
  message.value = "";
  try {
    await action();
  } catch (error) {
    show(error);
    // A rejection may have discarded the match (CU-01, 5a).
    if (error instanceof ApiError && error.reason === "OPPONENT_PLACEMENT_FAILED") match.value = null;
  }
}

const saveConfig = () =>
  run(async () => {
    fillForm(await api.configure(form.value));
    message.value = "Configuración guardada.";
  });

// CU-01, steps 3-4.
const startMatch = () =>
  run(async () => {
    match.value = await api.startMatch();
    turns.value = [];
    saved.value = null;
    orientation.value = "HORIZONTAL";
    selectedShip.value = firstPendingShip(match.value);
  });

function selectShip(index: number) {
  selectedShip.value = index;
  const ship = match.value?.fleet[index];
  if (ship?.orientation) orientation.value = ship.orientation;
}

function toggleOrientation() {
  orientation.value = orientation.value === "HORIZONTAL" ? "VERTICAL" : "HORIZONTAL";
}

// CU-03, steps 2-4: place or move the selected ship with its origin on the cell.
const placeAt = (row: number, column: number) =>
  run(async () => {
    if (selectedShip.value === null) {
      message.value = "Elige un barco de la lista.";
      return;
    }
    const placed = selectedShip.value;
    apply(await api.placeShip(placed, { row, column }, orientation.value));
    if (match.value) selectedShip.value = firstPendingShip(match.value) ?? placed;
  });

// CU-03, 5a.
const removeSelected = () =>
  run(async () => {
    if (selectedShip.value === null) return;
    apply(await api.removeShip(selectedShip.value));
  });

// CU-03, steps 5-7: the opponent places its fleet and may open (CU-01, 7a).
const confirmFleet = () =>
  run(async () => {
    apply(await api.confirmPlacement());
    selectedShip.value = null;
  });

// CU-04, step 1: the target is the top-left cell of the weapon's area.
const fireAt = (row: number, column: number) =>
  run(async () => {
    apply(await api.fire(selectedWeapon.value, { row, column }));
    const weapon = match.value?.arsenal.find((w) => w.type === selectedWeapon.value);
    if (weapon?.ammo === 0) selectedWeapon.value = "MISSILE";
  });

// CU-06, steps 5-6, or cancelling the match in progress.
const closeMatch = () =>
  run(async () => {
    await api.closeMatch();
    clearTimeout(reconTimer);
    recon.value = new Map();
    match.value = null;
    turns.value = [];
    saved.value = null;
    fillForm(await api.getConfig());
  });

onMounted(async () => {
  fillForm(await api.getConfig());
  match.value = await api.getMatch();
  if (match.value?.phase === "PLACEMENT") selectedShip.value = firstPendingShip(match.value);
});

onUnmounted(() => clearTimeout(reconTimer));
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

    <p v-if="message" class="message" role="status">{{ message }}</p>

    <template v-if="match">
      <!-- CU-03: placement of the Jugador's fleet. -->
      <section v-if="match.phase === 'PLACEMENT'" class="panel">
        <h2>Ubica tu flota</h2>
        <p class="hint">
          Elige un barco, su orientación y pulsa la casilla de tu tablero donde empieza
          (extremo izquierdo o superior).
        </p>
        <ul class="ships">
          <li v-for="(ship, index) in match.fleet" :key="index">
            <button
              type="button"
              :class="{ active: selectedShip === index }"
              @click="selectShip(index)"
            >
              Barco {{ index + 1 }} ({{ ship.length }})
              <span class="tag" :class="{ done: ship.placed }">
                {{ ship.placed ? `en ${cellLabel(ship.origin!)} ${ship.orientation === "VERTICAL" ? "↓" : "→"}` : "sin ubicar" }}
              </span>
            </button>
          </li>
        </ul>
        <div class="actions">
          <button type="button" @click="toggleOrientation">
            Orientación: {{ orientation === "HORIZONTAL" ? "horizontal →" : "vertical ↓" }}
          </button>
          <button
            type="button"
            :disabled="selectedShip === null || !match.fleet[selectedShip]?.placed"
            @click="removeSelected"
          >
            Retirar barco
          </button>
          <button type="button" class="primary" :disabled="!allPlaced" @click="confirmFleet">
            Confirmar flota
          </button>
          <button type="button" class="ghost" @click="closeMatch">Abandonar partida</button>
        </div>
      </section>

      <!-- CU-04: the Jugador's turn. -->
      <section v-else-if="match.phase === 'IN_PROGRESS'" class="panel">
        <h2>Batalla</h2>
        <p class="hint">
          Elige un arma y pulsa una casilla del tablero rival (esquina superior izquierda del área).
          Barcos rivales a flote: <strong>{{ match.rivalShipsAfloat }}</strong>.
        </p>
        <div class="weapons">
          <label v-for="weapon in match.arsenal" :key="weapon.type" class="weapon" :class="{ empty: weapon.ammo === 0 }">
            <input
              v-model="selectedWeapon"
              type="radio"
              name="weapon"
              :value="weapon.type"
              :disabled="weapon.ammo === 0"
            />
            <span>
              {{ weaponName[weapon.type] }} · {{ weapon.ammo ?? "∞" }}
              <small>{{ weaponArea[weapon.type] }}</small>
            </span>
          </label>
        </div>
        <div class="actions">
          <button type="button" class="ghost" @click="closeMatch">Abandonar partida</button>
        </div>
      </section>

      <!-- CU-06: end of the match. -->
      <section v-else class="panel result" :class="match.winner === 'PLAYER' ? 'won' : 'lost'">
        <h2>{{ match.winner === "PLAYER" ? "¡Ganaste!" : "Ganó el oponente" }}</h2>
        <p class="hint">
          Turnos jugados: {{ match.turnsPlayed }}.
          <template v-if="saved !== null">
            {{ saved ? "La partida se guardó." : "La partida no se pudo guardar." }}
          </template>
        </p>
        <div class="actions">
          <button type="button" class="primary" @click="closeMatch">Cerrar partida</button>
        </div>
      </section>

      <div class="boards">
        <BoardGrid
          title="Tu tablero"
          :board="match.ownBoard"
          :clickable="match.phase === 'PLACEMENT'"
          :highlight="selectedCells"
          @cell-click="placeAt"
        />
        <BoardGrid
          title="Tablero rival"
          :board="match.rivalBoard"
          :clickable="match.phase === 'IN_PROGRESS'"
          :overlay="recon"
          @cell-click="fireAt"
        />
      </div>
      <p v-if="recon.size > 0" class="hint">
        Reconocimiento: «?» marca casillas con barco; se ocultan a los 10 segundos.
      </p>

      <section v-if="lastTurns.length > 0" class="panel">
        <h2>Últimos turnos</h2>
        <ol class="log">
          <li v-for="turn in lastTurns" :key="turn.number" :class="turn.side.toLowerCase()">
            <span class="turn">{{ turn.number }}.</span> {{ describeTurn(turn) }}
          </li>
        </ol>
      </section>
    </template>
  </main>
</template>
