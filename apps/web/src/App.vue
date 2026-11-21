<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import {
  api,
  ApiError,
  type ActionResult,
  type Difficulty,
  type FirstTurn,
  type MatchConfig,
  type MatchStatistics,
  type MatchView,
  type Orientation,
  type PlayerAccount,
  type OutcomeType,
  type Position,
  type Rejection,
  type ShipView,
  type TurnView,
  type WeaponType,
} from "./api/client";
import BoardGrid from "./components/BoardGrid.vue";
import ReplayPanel from "./components/ReplayPanel.vue";
import { canAttack, weaponArea as areaOf } from "./areas";
import { cellKey, cellLabel } from "./coordinates";
import { turnEffect, type CellEffect } from "./effects";

// D-17: recon results stay visible for 10 seconds; the timer lives here.
const RECON_VISIBLE_MS = 10_000;

// Who plays; null until the player signs in with a name.
const player = ref<PlayerAccount | null>(null);
const playerName = ref("");
const ready = ref(false);

const config = ref<MatchConfig | null>(null);
const match = ref<MatchView | null>(null);
const message = ref("");
const turns = ref<TurnView[]>([]);
const saved = ref<boolean | null>(null);
// CU-07: shown on request over the result; null while closed.
const statistics = ref<MatchStatistics | null>(null);
// CU-10: the configuration is hidden while a saved match is replayed.
const replaying = ref(false);

const selectedShip = ref<number | null>(null);
const orientation = ref<Orientation>("HORIZONTAL");
const selectedWeapon = ref<WeaponType>("MISSILE");
const recon = ref(new Map<string, OutcomeType>());
let reconTimer: ReturnType<typeof setTimeout> | undefined;

// Attack animations, one turn at a time, on the board that received it.
const ownEffects = ref(new Map<string, CellEffect>());
const rivalEffects = ref(new Map<string, CellEffect>());
const animating = ref(false);
let playback: Promise<void> = Promise.resolve();
// Bumped when the match is closed, so a pending playback stops.
let playbackId = 0;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  FLEET_DOES_NOT_FIT:
    "La flota ocupa más del 30 % del tablero, no deja sitio para separar los barcos o tiene un barco más largo que el tablero.",
  ARSENAL_AMMO_OUT_OF_LIMITS: "Cada arma debe tener al menos una unidad de munición.",
  ARSENAL_WEAPONS_NOT_CONFIGURABLE_WEAPONS: "El misil no es configurable: siempre está disponible.",
  MATCH_IN_PROGRESS: "Ya hay una partida en curso.",
  INVALID_VALUE: "Hay un valor no válido en la configuración.",
  NO_MATCH: "No hay ninguna partida.",
  WRONG_PHASE: "Esa acción no está permitida en esta fase de la partida.",
  OUT_OF_BOARD: "El barco se sale del tablero.",
  OVERLAP: "El barco se superpone con otro.",
  TOO_CLOSE: "El barco debe quedar a una casilla de los demás, también en diagonal.",
  UNKNOWN_SHIP: "Ese barco no existe.",
  UNKNOWN_ORIENTATION: "Orientación desconocida.",
  FLEET_NOT_PLACED: "Faltan barcos por ubicar.",
  OPPONENT_PLACEMENT_FAILED: "El oponente no pudo ubicar su flota; la partida se descartó.",
  UNKNOWN_WEAPON: "Esa arma no está en tu arsenal.",
  NO_SHOT: "No es tu turno.",
  NO_AMMO: "No queda munición para esa arma.",
  AREA_OUT_OF_BOARD: "El área de ataque se sale del tablero.",
  AREA_ALREADY_ATTACKED: "Toda esa área ya fue atacada.",
  NOT_FOUND: "Esa partida guardada ya no existe.",
  INVALID_MATCH: "La partida guardada no se puede leer o su contenido no es válido.",
  NO_REPLAY: "No hay ninguna partida cargada.",
  NO_SUCH_TURN: "Ese turno no existe.",
  NO_SESSION: "Tu sesión terminó; vuelve a entrar con tu nombre.",
  INVALID_NAME: "El nombre debe tener entre 1 y 30 caracteres.",
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

// Cell under the pointer on the rival board, to preview the weapon's area.
const aimed = ref<Position | null>(null);

const aiming = computed(() => match.value?.phase === "IN_PROGRESS" && !animating.value);

const preview = computed(() => {
  if (!aiming.value || !aimed.value || !match.value) return { cells: new Set<string>(), valid: false };
  const board = match.value.rivalBoard;
  const { cells } = areaOf(selectedWeapon.value, aimed.value, board.size);
  return {
    cells: new Set(cells.map(cellKey)),
    valid: canAttack(selectedWeapon.value, aimed.value, board),
  };
});

// Cell under the pointer on the own board, to preview the selected ship there.
const anchored = ref<Position | null>(null);

// CU-03, steps 3-4, as the API checks them: inside the board, without
// overlapping or touching another ship, diagonals included (3c). The selected
// ship may be moved over its own cells.
const placementPreview = computed(() => {
  const ship = selectedShip.value === null ? undefined : match.value?.fleet[selectedShip.value];
  if (match.value?.phase !== "PLACEMENT" || !ship || !anchored.value) {
    return { cells: new Set<string>(), valid: false };
  }
  const board = match.value.ownBoard;
  const all = shipPositions(ship.length, anchored.value, orientation.value);
  const inside = all.filter(({ row, column }) => row < board.size && column < board.size);
  const holdsOther = ({ row, column }: Position) =>
    board.cells[row]?.[column] === "SHIP" && !selectedCells.value.has(cellKey({ row, column }));
  const touches = inside.some(({ row, column }) =>
    [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => holdsOther({ row: row + dr, column: column + dc }))),
  );
  return { cells: new Set(inside.map(cellKey)), valid: inside.length === all.length && !touches };
});

// Newest first, so the latest answer of the opponent is on top.
const lastTurns = computed(() => [...turns.value].reverse().slice(0, 10));

function shipCells(ship: ShipView): string[] {
  if (!ship.origin || !ship.orientation) return [];
  return shipPositions(ship.length, ship.origin, ship.orientation).map(cellKey);
}

function shipPositions(length: number, { row, column }: Position, along: Orientation): Position[] {
  return Array.from({ length }, (_, i) =>
    along === "VERTICAL" ? { row: row + i, column } : { row, column: column + i },
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
  if (!reducedMotion && result.turns.length > 0) animate(result.turns, result.match.ownBoard.size);
}

// Queues the turns so the opponent's answer plays after the Jugador's attack.
function animate(played: TurnView[], boardSize: number) {
  const id = playbackId;
  animating.value = true;
  playback = playback.then(async () => {
    for (const turn of played) {
      if (id !== playbackId) return;
      const { cells, duration } = turnEffect(turn, boardSize);
      const target = turn.side === "PLAYER" ? rivalEffects : ownEffects;
      // Cleared first so a cell hit twice in a row restarts its animation.
      target.value = new Map();
      await nextTick();
      await new Promise(requestAnimationFrame);
      target.value = cells;
      await new Promise((resolve) => setTimeout(resolve, duration));
      target.value = new Map();
    }
    if (id === playbackId) animating.value = false;
  });
}

function stopAnimations() {
  playbackId++;
  playback = Promise.resolve();
  ownEffects.value = new Map();
  rivalEffects.value = new Map();
  animating.value = false;
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
    if (error instanceof ApiError && error.reason === "NO_SESSION") leave();
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
    stopAnimations();
    turns.value = [];
    saved.value = null;
    statistics.value = null;
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

// "R" rotates the ship while placing, without leaving the board.
function onKeydown(event: KeyboardEvent) {
  if (match.value?.phase !== "PLACEMENT" || event.key.toLowerCase() !== "r") return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  toggleOrientation();
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
    if (animating.value) return;
    apply(await api.fire(selectedWeapon.value, { row, column }));
    const weapon = match.value?.arsenal.find((w) => w.type === selectedWeapon.value);
    if (weapon?.ammo === 0) selectedWeapon.value = "MISSILE";
  });

// CU-07, steps 1-4.
const showStatistics = () =>
  run(async () => {
    statistics.value = await api.getStatistics();
  });

const precisionText = (stats: MatchStatistics) =>
  stats.precision === null
    ? "sin disparos"
    : `${Math.round(stats.precision * 100)} % (${stats.hits} de ${stats.damagingShots})`;

// CU-06, steps 5-6, or cancelling the match in progress.
const closeMatch = () =>
  run(async () => {
    await api.closeMatch();
    stopAnimations();
    clearTimeout(reconTimer);
    recon.value = new Map();
    match.value = null;
    turns.value = [];
    saved.value = null;
    statistics.value = null;
    fillForm(await api.getConfig());
  });

// The player's configuration and match, as the server kept them.
async function enter(account: PlayerAccount) {
  player.value = account;
  fillForm(await api.getConfig());
  match.value = await api.getMatch();
  if (match.value?.phase === "PLACEMENT") selectedShip.value = firstPendingShip(match.value);
}

// Forgets everything of the previous player on this page.
function leave() {
  stopAnimations();
  clearTimeout(reconTimer);
  recon.value = new Map();
  player.value = null;
  match.value = null;
  turns.value = [];
  saved.value = null;
  statistics.value = null;
  replaying.value = false;
}

const signIn = () =>
  run(async () => {
    const { player: account } = await api.signIn(playerName.value);
    await enter(account);
  });

// The match stays on the server; signing in again with the name finds it.
const signOut = () =>
  run(async () => {
    await api.signOut();
    leave();
  });

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  const session = await api.getSession();
  if (session) await enter(session.player);
  ready.value = true;
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  clearTimeout(reconTimer);
  stopAnimations();
});
</script>

<template>
  <main>
    <h1>Guerra naval</h1>

    <section v-if="ready && !player" class="panel">
      <h2>¿Quién juega?</h2>
      <form @submit.prevent="signIn">
        <label>
          Tu nombre
          <input v-model="playerName" type="text" maxlength="30" autocomplete="nickname" required />
        </label>
        <div class="actions">
          <button type="submit" class="primary">Entrar</button>
        </div>
      </form>
      <p class="hint">Con el mismo nombre vuelves a tu partida y a tus partidas guardadas.</p>
      <p v-if="message" class="message" role="status">{{ message }}</p>
    </section>

    <template v-if="player">
      <p class="hint session">
        Jugador: <strong>{{ player.name }}</strong>
        <button type="button" class="ghost" @click="signOut">Cambiar de jugador</button>
      </p>

      <section v-if="!match && !replaying" class="panel">
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

      <!-- CU-10, including CU-09: only without a match in progress. -->
      <ReplayPanel v-if="!match || match.phase === 'FINISHED'" :describe-turn="describeTurn" @active="(on) => (replaying = on)" />

      <p v-if="message" class="message" role="status">{{ message }}</p>

      <template v-if="match && !replaying">
        <!-- CU-03: placement of the Jugador's fleet. -->
        <section v-if="match.phase === 'PLACEMENT'" class="panel">
          <h2>Ubica tu flota</h2>
          <p class="hint">
            Elige un barco, su orientación y pulsa la casilla de tu tablero donde empieza
            (extremo izquierdo o superior). Al pasar el puntero verás dónde quedaría; en rojo, si no
            cabe o queda pegado a otro barco (deja una casilla libre, también en diagonal). Pulsa «R» para girarlo.
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
            Al pasar el puntero verás el área que cubre; en rojo, si ese ataque no es válido.
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
          <!-- CU-07, step 4; closing it shows the result again (steps 5-6). -->
          <dl v-if="statistics" class="statistics">
            <dt>Precisión</dt>
            <dd>{{ precisionText(statistics) }}</dd>
            <dt>Turnos consumidos</dt>
            <dd>{{ statistics.turns.total }} (tuyos {{ statistics.turns.player }}, del oponente {{ statistics.turns.opponent }})</dd>
            <dt>Barcos destruidos</dt>
            <dd>del oponente {{ statistics.shipsSunk.opponent }}, tuyos {{ statistics.shipsSunk.player }}</dd>
          </dl>
          <div class="actions">
            <button v-if="!statistics" type="button" @click="showStatistics">Ver estadísticas</button>
            <button v-else type="button" @click="statistics = null">Cerrar estadísticas</button>
            <button type="button" class="primary" @click="closeMatch">Cerrar partida</button>
          </div>
        </section>

        <div class="boards">
          <BoardGrid
            title="Tu tablero"
            :board="match.ownBoard"
            :clickable="match.phase === 'PLACEMENT'"
            :highlight="selectedCells"
            :effects="ownEffects"
            :preview="placementPreview.cells"
            :preview-invalid="!placementPreview.valid"
            @cell-click="placeAt"
            @cell-hover="(row, column) => (anchored = { row, column })"
            @hover-end="anchored = null"
          />
          <BoardGrid
            title="Tablero rival"
            :board="match.rivalBoard"
            :clickable="aiming"
            :overlay="recon"
            :effects="rivalEffects"
            :preview="preview.cells"
            :preview-invalid="!preview.valid"
            @cell-hover="(row, column) => (aimed = { row, column })"
            @hover-end="aimed = null"
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
    </template>
  </main>
</template>
