import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import {
  ActionResult,
  api,
  ApiResult,
  BoardView,
  CellState,
  MatchConfig,
  MatchStatistics,
  MatchView,
  OutcomeType,
  Position,
  ReplayView,
  TurnView,
} from "./api";

// D-17: recon results stay visible for 10 seconds; the timer lives here.
const RECON_VISIBLE_MS = 10_000;

// CU-10, step 5: one turn per interval. Pendiente in the CU: its value and
// whether the Jugador may change it.
const REPLAY_INTERVAL_MS = 1_000;

// RNF-03: each cell state has its own symbol in the console.
const symbol: Record<CellState, string> = {
  EMPTY: "·",
  SHIP: "■",
  MISS: "o",
  HIT: "x",
  SUNK: "#",
};

const reconSymbol: Record<OutcomeType, string> = { SPOTTED: "?", CLEAR: "-", MISS: "o", HIT: "x" };

const weaponName: Record<string, string> = {
  MISSILE: "Misil",
  BOMB: "Bomba",
  BOMBER: "Avión de ataque",
  TORPEDO: "Torpedo",
  RECON_PLANE: "Avión de reconocimiento",
};

const phaseName: Record<MatchView["phase"], string> = {
  PLACEMENT: "ubicación de la flota",
  IN_PROGRESS: "en curso",
  FINISHED: "terminada",
};

const rejectionText: Record<string, string> = {
  BOARD_SIZE_OUT_OF_LIMITS: "el tamaño del tablero está fuera de los límites",
  FLEET_SIZE_OUT_OF_LIMITS: "la flota no tiene el número de barcos permitido",
  FLEET_DOES_NOT_FIT:
    "la flota ocupa más del 30 % del tablero, no deja sitio para separar los barcos o tiene un barco más largo que el tablero",
  ARSENAL_AMMO_OUT_OF_LIMITS: "cada arma debe tener al menos una unidad de munición",
  ARSENAL_WEAPONS_NOT_CONFIGURABLE_WEAPONS: "el misil no es configurable",
  MATCH_IN_PROGRESS: "ya hay una partida en curso",
  INVALID_VALUE: "hay un valor no válido",
  NO_MATCH: "no hay ninguna partida",
  WRONG_PHASE: "esa acción no está permitida en esta fase",
  OUT_OF_BOARD: "el barco se sale del tablero",
  OVERLAP: "el barco se superpone con otro",
  TOO_CLOSE: "el barco debe quedar a una casilla de los demás, también en diagonal",
  UNKNOWN_SHIP: "ese barco no existe",
  UNKNOWN_ORIENTATION: "orientación desconocida",
  FLEET_NOT_PLACED: "faltan barcos por ubicar",
  OPPONENT_PLACEMENT_FAILED: "el oponente no pudo ubicar su flota; la partida se descartó",
  UNKNOWN_WEAPON: "esa arma no está en tu arsenal",
  NO_SHOT: "no es tu turno",
  NO_AMMO: "no queda munición para esa arma",
  AREA_OUT_OF_BOARD: "el área de ataque se sale del tablero",
  AREA_ALREADY_ATTACKED: "toda esa área ya fue atacada",
  NOT_FOUND: "esa partida guardada no existe",
  INVALID_MATCH: "la partida guardada no se puede leer o su contenido no es válido",
  NO_REPLAY: "no hay ninguna partida cargada",
  NO_SUCH_TURN: "ese turno no existe",
  NO_SESSION: "la sesión no es válida; vuelve a entrar con tu código",
  INVALID_CODE: "ese código no corresponde a ningún jugador",
  TOO_MANY_REQUESTS: "demasiados intentos seguidos; espera un momento",
  INVALID_NAME: "el nombre debe tener entre 1 y 30 caracteres",
};

const explain = (reason: string) => rejectionText[reason] ?? reason;

// Shared with the web: rows are letters (A, B, ...) and columns numbers from 1,
// so "C4" is row 2, column 3 in the API (0-based).
const rowLabel = (row: number) => String.fromCharCode(65 + row);
const cellLabel = ({ row, column }: Position) => `${rowLabel(row)}${column + 1}`;

function drawBoard(title: string, board: BoardView, overlay = new Map<string, OutcomeType>()): string {
  const header = "   " + Array.from({ length: board.size }, (_, i) => String(i + 1).padStart(2)).join("");
  const rows = board.cells.map(
    (row, r) =>
      rowLabel(r).padStart(2) +
      " " +
      row
        .map((cell, c) => {
          const recon = overlay.get(`${r},${c}`);
          return " " + (recon ? reconSymbol[recon] : symbol[cell]);
        })
        .join(""),
  );
  return [title, header, ...rows].join("\n");
}

function drawMatch(match: MatchView, overlay?: Map<string, OutcomeType>): string {
  const arsenal = match.arsenal.map((w) => `${weaponName[w.type] ?? w.type} ${w.ammo ?? "∞"}`).join(", ");
  return [
    `Fase: ${phaseName[match.phase]} · barcos rivales a flote: ${match.rivalShipsAfloat}`,
    drawBoard("Tu tablero", match.ownBoard),
    drawBoard("Tablero rival" + (overlay ? " (reconocimiento: ? = barco, - = agua)" : ""), match.rivalBoard, overlay),
    `Arsenal: ${arsenal}`,
  ].join("\n\n");
}

function drawFleet(match: MatchView): string {
  return match.fleet
    .map((ship, index) => {
      const where = ship.origin
        ? `en ${cellLabel(ship.origin)} ${ship.orientation === "VERTICAL" ? "vertical" : "horizontal"}`
        : "sin ubicar";
      return `  ${index + 1}) Barco de ${ship.length}: ${where}`;
    })
    .join("\n");
}

function describeTurn(turn: TurnView): string {
  const who = turn.side === "PLAYER" ? "Tú" : "Rival";
  const where = `${weaponName[turn.weapon] ?? turn.weapon} en ${cellLabel(turn.target)}`;
  if (turn.weapon === "RECON_PLANE") {
    const spotted = turn.outcomes.filter((o) => o.result === "SPOTTED").map(cellLabel);
    return `${who}: ${where} → barcos en: ${spotted.length > 0 ? spotted.join(", ") : "ninguna casilla"}`;
  }
  const hits = turn.outcomes.filter((o) => o.result === "HIT").length;
  return `${who}: ${where} → ${hits === 0 ? "agua" : `${hits} ${hits === 1 ? "impacto" : "impactos"}`}`;
}

function describeConfig(config: MatchConfig): string {
  const weapons = config.enabledWeapons.map((w) => `${w.type} ${w.ammo}`).join(", ");
  return [
    `Tablero: ${config.boardSize} x ${config.boardSize}`,
    `Flota: ${config.shipLengths.join(", ")}`,
    `Dificultad: ${config.difficulty}`,
    `Primer turno: ${config.firstTurn}`,
    `Turno extra por acierto: ${config.extraTurnOnHit ? "sí" : "no"}`,
    `Armas: ${weapons}`,
  ].join("\n");
}

// CU-07, step 4.
function describeStatistics(statistics: MatchStatistics): string {
  const precision =
    statistics.precision === null
      ? "sin disparos"
      : `${Math.round(statistics.precision * 100)} % (${statistics.hits} de ${statistics.damagingShots})`;
  const { turns, shipsSunk } = statistics;
  return [
    `Precisión: ${precision}`,
    `Turnos consumidos: ${turns.total} (tuyos ${turns.player}, del oponente ${turns.opponent})`,
    `Barcos destruidos: del oponente ${shipsSunk.opponent}, tuyos ${shipsSunk.player}`,
  ].join("\n");
}

const winnerName = (winner: string | null) =>
  winner === "PLAYER" ? "tú" : winner === "OPPONENT" ? "el oponente" : "desconocido";

// CU-10, steps 3 and 5: both fleets, the turn that led here and, at the end,
// the result. A recon turn is drawn over the board it flew over.
function drawReplay(replay: ReplayView): string {
  const last = replay.lastTurn;
  const overlay =
    last?.weapon === "RECON_PLANE" ? new Map(last.outcomes.map((o) => [`${o.row},${o.column}`, o.result])) : undefined;
  const onPlayer = last?.side === "OPPONENT";

  return [
    replay.turn === 0 ? `Estado inicial (${replay.totalTurns} turnos)` : `Turno ${replay.turn} de ${replay.totalTurns}`,
    last ? describeTurn(last) : "",
    drawBoard("Tu flota", replay.playerBoard, onPlayer ? overlay : undefined),
    drawBoard("Flota del oponente", replay.opponentBoard, onPlayer ? undefined : overlay),
    replay.turn === replay.totalTurns ? `Fin de la partida. Ganador: ${winnerName(replay.winner)}.` : "",
  ]
    .filter((part) => part !== "")
    .join("\n\n");
}

const prompt = createInterface({ input, output });
const lines = prompt[Symbol.asyncIterator]();

// Reads one line; also works when the input is piped.
async function ask(question: string): Promise<string> {
  output.write(question);
  const line = await lines.next();
  return line.done ? "0" : line.value;
}

// Reads a cell as a row letter and a column number; null when out of format.
async function askCell(size: number): Promise<Position | null> {
  const row = (await ask(`Fila (A-${rowLabel(size - 1)}): `)).trim().toUpperCase();
  const column = Number(await ask(`Columna (1-${size}): `));
  if (!/^[A-Z]$/.test(row) || !Number.isInteger(column)) return null;
  return { row: row.charCodeAt(0) - 65, column: column - 1 };
}

let reconTimer: NodeJS.Timeout | undefined;

// D-17: recon results are shown now and hidden after 10 seconds by reprinting
// the rival board without them. Any later action also redraws without them.
function showRecon(match: MatchView, turn: TurnView) {
  clearTimeout(reconTimer);
  const overlay = new Map(turn.outcomes.map((o) => [`${o.row},${o.column}`, o.result]));
  console.log(drawMatch(match, overlay));
  console.log("(El reconocimiento se muestra durante 10 segundos.)");
  reconTimer = setTimeout(() => {
    console.log("\n[Reconocimiento oculto]\n" + drawBoard("Tablero rival", match.rivalBoard));
    output.write("> ");
  }, RECON_VISIBLE_MS);
  // Leaving the console does not wait for the timer.
  reconTimer.unref();
}

function report(result: ApiResult<ActionResult>, success?: string) {
  clearTimeout(reconTimer);
  if (!result.ok) {
    console.log(`Rechazado: ${explain(result.reason)}.`);
    return;
  }
  const { match, turns, saved } = result.data;
  if (success) console.log(success);
  for (const turn of turns) console.log(describeTurn(turn));

  const recon = [...turns].reverse().find((t) => t.side === "PLAYER" && t.weapon === "RECON_PLANE");
  if (recon && match.phase === "IN_PROGRESS") showRecon(match, recon);
  else console.log(drawMatch(match));

  if (match.phase === "PLACEMENT") console.log("Flota:\n" + drawFleet(match));
  // CU-06, steps 2-4.
  if (match.phase === "FINISHED") {
    console.log(`\nPartida terminada. Ganador: ${match.winner === "PLAYER" ? "tú" : "el oponente"}.`);
    if (saved !== undefined) console.log(saved ? "La partida se guardó." : "La partida no se pudo guardar.");
  }
}

function phaseOptions(match: MatchView | null): string {
  switch (match?.phase) {
    case "PLACEMENT":
      return "6) Ubicar barco  7) Retirar barco  8) Confirmar flota  9) Abandonar partida";
    case "IN_PROGRESS":
      return "6) Disparar  9) Abandonar partida";
    case "FINISHED":
      return "6) Cerrar partida  7) Ver estadísticas";
    default:
      return "";
  }
}

async function menu(): Promise<boolean> {
  const current = await api.getMatch();
  const match = current.ok ? current.data : null;
  const extra = phaseOptions(match);

  console.log(
    "\n1) Ver configuración  2) Cambiar tablero  3) Cambiar dificultad  4) Iniciar partida  5) Ver partida" +
      "  R) Reproducir partida" +
      (extra ? "\n" + extra : "") +
      "  0) Salir",
  );
  const option = (await ask("> ")).trim();

  switch (option) {
    case "1": {
      const result = await api.getConfig();
      console.log(result.ok ? describeConfig(result.data) : explain(result.reason));
      return true;
    }
    case "2": {
      const size = Number(await ask("Tamaño del tablero: "));
      const result = await api.configure({ boardSize: size });
      console.log(result.ok ? "Configuración guardada." : `Rechazada: ${explain(result.reason)}.`);
      return true;
    }
    case "3": {
      const difficulty = (await ask("Dificultad (EASY, NORMAL, HARD): ")).trim().toUpperCase();
      const result = await api.configure({ difficulty });
      console.log(result.ok ? "Configuración guardada." : `Rechazada: ${explain(result.reason)}.`);
      return true;
    }
    case "4": {
      // CU-01, steps 3-4.
      const result = await api.startMatch();
      if (!result.ok) console.log(`No se pudo iniciar: ${explain(result.reason)}.`);
      else console.log(drawMatch(result.data) + "\nFlota:\n" + drawFleet(result.data));
      return true;
    }
    case "5": {
      if (!match) console.log("No hay partida.");
      else console.log(drawMatch(match) + (match.phase === "PLACEMENT" ? "\nFlota:\n" + drawFleet(match) : ""));
      return true;
    }
    case "R":
    case "r":
      await replayMatch();
      return true;
    case "0":
      return false;
  }

  if (match && extra) {
    const handled = await phaseAction(match, option);
    if (handled) return true;
  }
  console.log("Opción no válida.");
  return true;
}

// The options of each phase (CU-03, CU-04, CU-06); false when not one of them.
async function phaseAction(match: MatchView, option: string): Promise<boolean> {
  const size = match.ownBoard.size;

  if (match.phase === "PLACEMENT" && option === "6") {
    // CU-03, steps 2-4: the origin is the left or top end of the ship.
    console.log("Flota:\n" + drawFleet(match));
    const index = Number(await ask("Número de barco: ")) - 1;
    const cell = await askCell(size);
    const orientation = (await ask("Orientación (H/V): ")).trim().toUpperCase();
    if (cell === null || (orientation !== "H" && orientation !== "V")) {
      console.log("Datos no válidos.");
      return true;
    }
    report(
      await api.placeShip(index, cell, orientation === "H" ? "HORIZONTAL" : "VERTICAL"),
      `Barco ${index + 1} ubicado en ${cellLabel(cell)}.`,
    );
    return true;
  }
  if (match.phase === "PLACEMENT" && option === "7") {
    // CU-03, 5a.
    const index = Number(await ask("Número de barco: ")) - 1;
    report(await api.removeShip(index), `Barco ${index + 1} retirado.`);
    return true;
  }
  if (match.phase === "PLACEMENT" && option === "8") {
    // CU-03, steps 5-7; the opponent may open (CU-01, 7a).
    report(await api.confirmPlacement(), "Flota confirmada. ¡Comienza la batalla!");
    return true;
  }
  if (match.phase === "IN_PROGRESS" && option === "6") {
    // CU-04, step 1: the target is the top-left cell of the weapon's area.
    match.arsenal.forEach((w, i) =>
      console.log(`  ${i + 1}) ${weaponName[w.type] ?? w.type} (munición: ${w.ammo ?? "∞"})`),
    );
    const weapon = match.arsenal[Number(await ask("Arma: ")) - 1];
    const cell = await askCell(size);
    if (!weapon || cell === null) {
      console.log("Datos no válidos.");
      return true;
    }
    report(await api.fire(weapon.type, cell));
    return true;
  }
  if (option === "9" && match.phase !== "FINISHED") {
    const result = await api.closeMatch();
    console.log(result.ok ? "Partida abandonada." : explain(result.reason));
    return true;
  }
  if (match.phase === "FINISHED" && option === "6") {
    // CU-06, steps 5-6.
    const result = await api.closeMatch();
    console.log(result.ok ? "Partida cerrada." : explain(result.reason));
    return true;
  }
  if (match.phase === "FINISHED" && option === "7") {
    // CU-07, steps 1-4; closing it shows the result again (steps 5-6).
    const result = await api.getStatistics();
    console.log(result.ok ? describeStatistics(result.data) : explain(result.reason));
    console.log(`\nGanador: ${winnerName(match.winner)}.`);
    return true;
  }
  return false;
}

// CU-10, including CU-09.
async function replayMatch(): Promise<void> {
  // CU-09, steps 1-2, 1a and 2a.
  const list = await api.listMatches();
  if (!list.ok) {
    console.log(explain(list.reason));
    return;
  }
  if (list.data.length === 0) {
    console.log("No hay partidas guardadas.");
    return;
  }

  let replay: ReplayView | null = null;
  while (replay === null) {
    list.data.forEach((saved, i) =>
      console.log(
        `  ${i + 1}) ${saved.finishedAt ?? "(no se puede leer)"} · ganador: ${winnerName(saved.winner)}`,
      ),
    );
    const option = Number(await ask("Partida (0 para cancelar): "));
    if (option === 0) return;

    const chosen = list.data[option - 1];
    if (!chosen) {
      console.log("Opción no válida.");
      continue;
    }

    // CU-09, step 3 and 3a: an invalid match is not loaded; back to the list.
    const loaded = await api.loadReplay(chosen.id);
    if (loaded.ok) replay = loaded.data;
    else console.log(`No se pudo cargar: ${explain(loaded.reason)}.`);
  }

  console.log(drawReplay(replay));

  while (true) {
    const option = (
      await ask("\nA) Automático  S) Siguiente  P) Anterior  0) Cerrar reproducción\n> ")
    ).trim().toUpperCase();

    if (option === "0") break;

    if (option === "S" || option === "P") {
      // 4a1 and 4a2.
      const next = replay.turn + (option === "S" ? 1 : -1);
      if (next > replay.totalTurns) console.log("No hay más turnos.");
      else if (next < 0) console.log("Estás en el estado inicial; no hay turno anterior.");
      else {
        const result = await api.replayAt(next);
        if (result.ok) replay = result.data;
        console.log(result.ok ? drawReplay(replay) : explain(result.reason));
      }
      continue;
    }

    if (option === "A") {
      replay = await playAutomatically(replay);
      continue;
    }

    console.log("Opción no válida.");
  }

  // Steps 6-7.
  await api.closeReplay();
  console.log("Reproducción cerrada.");
}

// CU-10, step 5 and 5a: a turn per interval until the last one, or until the
// Jugador presses Enter; then it stays on that turn, step by step.
async function playAutomatically(from: ReplayView): Promise<ReplayView> {
  console.log("(Pulsa Enter para detener.)");
  let stopped = false;
  const stop = lines.next().then(() => (stopped = true));
  let replay = from;

  while (!stopped && replay.turn < replay.totalTurns) {
    await Promise.race([new Promise((resolve) => setTimeout(resolve, REPLAY_INTERVAL_MS)), stop]);
    if (stopped) break;

    const result = await api.replayAt(replay.turn + 1);
    if (!result.ok) break;
    replay = result.data;
    console.log("\n" + drawReplay(replay));
  }

  if (!stopped) {
    output.write("Pulsa Enter para continuar.");
    await stop;
  } else {
    console.log(`Detenida en ${replay.turn === 0 ? "el estado inicial" : `el turno ${replay.turn}`}.`);
  }
  return replay;
}

// Who plays: the API keeps one match per player, found by the player's code.
async function signIn(): Promise<boolean> {
  while (true) {
    const option = (await ask("\n1) Soy un jugador nuevo  2) Tengo mi código  0) Salir\n> ")).trim();
    if (option === "0") return false;

    if (option === "1") {
      const result = await api.register(await ask("Tu nombre: "));
      if (!result.ok) {
        console.log(`No se pudo crear: ${explain(result.reason)}.`);
        continue;
      }
      console.log(`Hola, ${result.data.player.name}. Tu código es ${result.data.code}`);
      console.log("Guárdalo: es la única forma de volver a tu partida y no se puede mostrar de nuevo.");
      return true;
    }

    if (option === "2") {
      const result = await api.signIn((await ask("Tu código: ")).trim());
      if (result.ok) {
        console.log(`Hola de nuevo, ${result.data.player.name}.`);
        return true;
      }
      console.log(`No se pudo entrar: ${explain(result.reason)}.`);
      continue;
    }

    console.log("Opción no válida.");
  }
}

try {
  if (await signIn()) while (await menu()) {}
} catch (error) {
  console.error("Error al hablar con la API:", (error as Error).message);
} finally {
  clearTimeout(reconTimer);
  prompt.close();
}
