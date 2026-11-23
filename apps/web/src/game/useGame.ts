import { computed, inject, nextTick, provide, ref, type InjectionKey } from "vue";
import {
  api,
  ApiError,
  type ActionResult,
  type FinishedMatchSummary,
  type MatchConfig,
  type MatchStatistics,
  type MatchView,
  type Orientation,
  type OutcomeType,
  type PlayerAccount,
  type Position,
  type Rejection,
  type ReplayView,
  type ShipView,
  type TurnView,
  type WeaponType,
} from "../api/client";
import { canAttack, weaponArea } from "../areas";
import { cellKey } from "../coordinates";
import { turnEffect, type CellEffect } from "../effects";
import { rejectionText } from "./labels";
import { createSoundboard } from "./sound";

// D-17: recon results stay visible for 10 seconds.
const RECON_VISIBLE_MS = 10_000;
// Pause after each turn is shown, so the Jugador's shot and the opponent's
// answer read as two moves and no new shot overlaps them.
const TURN_PAUSE_MS = 700;
// CU-10, step 5: one turn per interval.
const REPLAY_INTERVAL_MS = 1_250;

export type ConfigForm = Pick<MatchConfig, "boardSize" | "difficulty" | "firstTurn" | "extraTurnOnHit">;

export function shipPositions(length: number, { row, column }: Position, along: Orientation): Position[] {
  return Array.from({ length }, (_, i) => (along === "VERTICAL" ? { row: row + i, column } : { row, column: column + i }));
}

function shipCells(ship: ShipView): string[] {
  if (!ship.origin || !ship.orientation) return [];
  return shipPositions(ship.length, ship.origin, ship.orientation).map(cellKey);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createGame() {
  const ready = ref(false);
  const busy = ref(false);
  const message = ref<{ text: string; tone: "info" | "error" } | null>(null);

  const player = ref<PlayerAccount | null>(null);
  // Shown once, right after creating the player; the server cannot show it again.
  const newCode = ref<string | null>(null);

  const config = ref<MatchConfig | null>(null);
  const form = ref<ConfigForm>({ boardSize: 8, difficulty: "NORMAL", firstTurn: "RANDOM", extraTurnOnHit: false });
  const match = ref<MatchView | null>(null);
  const turns = ref<TurnView[]>([]);
  const saved = ref<boolean | null>(null);
  const statistics = ref<MatchStatistics | null>(null);

  const selectedShip = ref<number | null>(null);
  const orientation = ref<Orientation>("HORIZONTAL");
  const selectedWeapon = ref<WeaponType>("MISSILE");
  const aimed = ref<Position | null>(null);
  const anchored = ref<Position | null>(null);

  const recon = ref(new Map<string, OutcomeType>());
  let reconTimer: ReturnType<typeof setTimeout> | undefined;

  const ownEffects = ref(new Map<string, CellEffect>());
  const rivalEffects = ref(new Map<string, CellEffect>());
  const animating = ref(false);
  const playingSide = ref<TurnView["side"] | null>(null);
  let playback: Promise<void> = Promise.resolve();
  let playbackId = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sound = createSoundboard();
  let lastRotation = 0;

  const savedMatches = ref<FinishedMatchSummary[] | null>(null);
  const replay = ref<ReplayView | null>(null);
  const replayPlaying = ref(false);
  let replayTimer: ReturnType<typeof setInterval> | undefined;

  const allPlaced = computed(() => match.value?.fleet.every((ship) => ship.placed) ?? false);
  const aiming = computed(() => match.value?.phase === "IN_PROGRESS" && !animating.value && !busy.value);

  const selectedCells = computed(() => {
    const ship = selectedShip.value === null ? undefined : match.value?.fleet[selectedShip.value];
    return new Set(ship ? shipCells(ship) : []);
  });

  const attackPreview = computed(() => {
    if (!aiming.value || !aimed.value || !match.value) return { cells: new Set<string>(), valid: false };
    const board = match.value.rivalBoard;
    return {
      cells: new Set(weaponArea(selectedWeapon.value, aimed.value, board.size).cells.map(cellKey)),
      valid: canAttack(selectedWeapon.value, aimed.value, board),
    };
  });

  // CU-03, steps 3-4, as the API checks them: inside, without overlapping or
  // touching another ship, diagonals included (3c).
  const placementPreview = computed(() => {
    const ship = selectedShip.value === null ? undefined : match.value?.fleet[selectedShip.value];
    if (match.value?.phase !== "PLACEMENT" || !ship || !anchored.value) return { cells: new Set<string>(), valid: false };
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

  const replayRecon = computed(() => {
    const last = replay.value?.lastTurn;
    const cells =
      last?.weapon === "RECON_PLANE"
        ? new Map<string, OutcomeType>(last.outcomes.map((o) => [cellKey(o), o.result]))
        : new Map<string, OutcomeType>();
    const none = new Map<string, OutcomeType>();
    return { onPlayer: last?.side === "OPPONENT" ? cells : none, onOpponent: last?.side === "PLAYER" ? cells : none };
  });

  function notify(text: string, tone: "info" | "error" = "info") {
    message.value = { text, tone };
  }

  function fail(error: unknown) {
    const text = error instanceof ApiError ? (rejectionText[error.reason as Rejection] ?? error.reason) : String(error);
    notify(text, "error");
  }

  async function run(action: () => Promise<void>) {
    message.value = null;
    busy.value = true;
    try {
      await action();
    } catch (error) {
      fail(error);
      if (error instanceof ApiError && error.reason === "NO_SESSION") leave();
      // CU-01, 5a: the match was discarded.
      if (error instanceof ApiError && error.reason === "OPPONENT_PLACEMENT_FAILED") match.value = null;
    } finally {
      busy.value = false;
    }
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
      if (turn.side !== "PLAYER") continue;
      if (turn.weapon === "RECON_PLANE") showRecon(turn);
      else clearRecon(turn);
    }
    if (result.turns.length === 0) return;
    const finished = result.match.phase === "FINISHED" ? result.match.winner === "PLAYER" : null;
    present(result.turns, result.match.ownBoard.size, finished);
  }

  // One turn at a time, each followed by a pause; shooting stays locked until
  // the last one, the opponent's answer included, has been shown.
  // won: null while the match goes on; otherwise the finale plays at the end.
  function present(played: TurnView[], boardSize: number, won: boolean | null) {
    const id = playbackId;
    animating.value = true;
    playback = playback.then(async () => {
      for (const turn of played) {
        if (id !== playbackId) return;
        playingSide.value = turn.side;
        const { cells, duration } = turnEffect(turn, boardSize);
        sound.turn(turn, reducedMotion ? 300 : duration * 0.45, turn.sunkShips.length > 0);
        if (!reducedMotion) {
          const target = turn.side === "PLAYER" ? rivalEffects : ownEffects;
          target.value = new Map();
          await nextTick();
          await new Promise(requestAnimationFrame);
          target.value = cells;
          await sleep(duration);
          target.value = new Map();
        }
        await sleep(TURN_PAUSE_MS);
      }
      if (id === playbackId) {
        animating.value = false;
        playingSide.value = null;
        if (won !== null) sound.finale(won);
      }
    });
  }

  function stopAnimations() {
    playbackId++;
    playingSide.value = null;
    playback = Promise.resolve();
    ownEffects.value = new Map();
    rivalEffects.value = new Map();
    animating.value = false;
  }

  // An attacked cell shows what the attack found; its recon hint goes away.
  // Only cells with an outcome were attacked: the torpedo's run is not (D-18).
  function clearRecon(turn: TurnView) {
    if (recon.value.size === 0) return;
    const left = new Map(recon.value);
    for (const outcome of turn.outcomes) left.delete(cellKey(outcome));
    recon.value = left;
  }

  function showRecon(turn: TurnView) {
    clearTimeout(reconTimer);
    recon.value = new Map(turn.outcomes.map((o) => [cellKey(o), o.result]));
    reconTimer = setTimeout(() => (recon.value = new Map()), RECON_VISIBLE_MS);
  }

  function resetMatchState() {
    stopAnimations();
    clearTimeout(reconTimer);
    recon.value = new Map();
    turns.value = [];
    saved.value = null;
    statistics.value = null;
  }

  async function enter(account: PlayerAccount) {
    player.value = account;
    fillForm(await api.getConfig());
    match.value = await api.getMatch();
    if (match.value?.phase === "PLACEMENT") selectedShip.value = firstPendingShip(match.value);
    await refreshSavedMatches();
  }

  function leave() {
    resetMatchState();
    stopReplay();
    player.value = null;
    match.value = null;
    replay.value = null;
    savedMatches.value = null;
    newCode.value = null;
  }

  async function refreshSavedMatches() {
    try {
      savedMatches.value = await api.listMatches();
    } catch {
      savedMatches.value = [];
    }
  }

  const register = (name: string) =>
    run(async () => {
      const { player: account, code } = await api.register(name);
      newCode.value = code;
      await enter(account);
    });

  const signIn = (code: string) =>
    run(async () => {
      const { player: account } = await api.signIn(code.trim());
      await enter(account);
    });

  const signOut = () =>
    run(async () => {
      await api.signOut();
      leave();
    });

  const saveConfig = () =>
    run(async () => {
      fillForm(await api.configure(form.value));
      notify("Configuración guardada.");
    });

  // CU-02 then CU-01, steps 3-4.
  const startMatch = () =>
    run(async () => {
      fillForm(await api.configure(form.value));
      match.value = await api.startMatch();
      resetMatchState();
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

  // One wheel gesture fires many events (trackpads above all): one turn each 250 ms.
  function rotateWithWheel() {
    const now = Date.now();
    if (now - lastRotation < 250) return;
    lastRotation = now;
    toggleOrientation();
  }

  // CU-03, steps 2-4.
  const placeAt = (row: number, column: number) =>
    run(async () => {
      if (selectedShip.value === null) {
        notify("Elige un barco de tu flota.");
        return;
      }
      const placed = selectedShip.value;
      apply(await api.placeShip(placed, { row, column }, orientation.value));
      if (match.value) selectedShip.value = firstPendingShip(match.value) ?? placed;
    });

  // CU-03, 5a.
  const removeSelected = () =>
    run(async () => {
      if (selectedShip.value !== null) apply(await api.removeShip(selectedShip.value));
    });

  // CU-03, steps 5-7: the opponent may open (CU-01, 7a).
  const confirmFleet = () =>
    run(async () => {
      apply(await api.confirmPlacement());
      selectedShip.value = null;
    });

  // CU-04, step 1: the target is the top-left cell of the weapon's area. The
  // lock is checked before the request, so a double click fires once.
  function fireAt(row: number, column: number) {
    if (busy.value || animating.value || match.value?.phase !== "IN_PROGRESS") return;
    return run(async () => {
      apply(await api.fire(selectedWeapon.value, { row, column }));
      const weapon = match.value?.arsenal.find((w) => w.type === selectedWeapon.value);
      if (weapon?.ammo === 0) selectedWeapon.value = "MISSILE";
    });
  }

  // CU-07.
  const loadStatistics = () =>
    run(async () => {
      statistics.value = await api.getStatistics();
    });

  // CU-06, steps 5-6, or abandoning the match.
  const closeMatch = () =>
    run(async () => {
      await api.closeMatch();
      resetMatchState();
      match.value = null;
      fillForm(await api.getConfig());
      await refreshSavedMatches();
    });

  // CU-09, steps 2-4, and CU-10, step 3.
  const openReplay = (id: string) =>
    run(async () => {
      replay.value = await api.loadReplay(id);
    });

  // CU-10, 4a1 and 4a2.
  // Only a step forward sounds: its weapon, impact and sinking, and at the
  // last turn the finale. Going back or jumping is silent.
  async function replayTo(turn: number) {
    const previous = replay.value;
    if (!previous) return;
    if (turn > previous.totalTurns) return notify("No hay más turnos.");
    if (turn < 0) return notify("Estás en el estado inicial.");
    await run(async () => {
      const next = await api.replayAt(turn);
      replay.value = next;
      if (turn !== previous.turn + 1 || !next.lastTurn) return;
      sound.turn(next.lastTurn, 250, next.lastTurn.sunkShips.length > 0);
      if (next.turn === next.totalTurns) sound.finale(next.winner === "PLAYER", 1200);
    });
  }

  // CU-10, step 5 and 5a.
  function playReplay() {
    if (!replay.value || replay.value.turn === replay.value.totalTurns) return;
    replayPlaying.value = true;
    replayTimer = setInterval(async () => {
      await replayTo(replay.value!.turn + 1);
      if (replay.value && replay.value.turn === replay.value.totalTurns) stopReplay();
    }, REPLAY_INTERVAL_MS);
  }

  function stopReplay() {
    clearInterval(replayTimer);
    replayPlaying.value = false;
  }

  // CU-10, steps 6-7.
  const closeReplay = () =>
    run(async () => {
      stopReplay();
      await api.closeReplay().catch(() => null);
      replay.value = null;
    });

  async function boot() {
    const session = await api.getSession().catch(() => null);
    if (session) await enter(session.player).catch(fail);
    ready.value = true;
  }

  function dispose() {
    clearTimeout(reconTimer);
    stopAnimations();
    stopReplay();
  }

  return {
    ready,
    busy,
    message,
    player,
    newCode,
    config,
    form,
    match,
    turns,
    saved,
    statistics,
    selectedShip,
    orientation,
    selectedWeapon,
    aimed,
    anchored,
    recon,
    ownEffects,
    rivalEffects,
    animating,
    playingSide,
    sound,
    rotateWithWheel,
    savedMatches,
    replay,
    replayPlaying,
    allPlaced,
    aiming,
    selectedCells,
    attackPreview,
    placementPreview,
    replayRecon,
    notify,
    register,
    signIn,
    signOut,
    saveConfig,
    startMatch,
    selectShip,
    toggleOrientation,
    placeAt,
    removeSelected,
    confirmFleet,
    fireAt,
    loadStatistics,
    closeMatch,
    openReplay,
    replayTo,
    playReplay,
    stopReplay,
    closeReplay,
    boot,
    dispose,
  };
}

export type GameStore = ReturnType<typeof createGame>;

const GAME: InjectionKey<GameStore> = Symbol("game");

export function provideGame(): GameStore {
  const game = createGame();
  provide(GAME, game);
  return game;
}

export function useGame(): GameStore {
  const game = inject(GAME);
  if (!game) throw new Error("useGame() outside provideGame()");
  return game;
}
