import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { api, BoardView, CellState, MatchConfig, MatchView } from "./api";

// RNF-03: each cell state has its own symbol in the console.
const symbol: Record<CellState, string> = {
  EMPTY: "·",
  SHIP: "■",
  MISS: "o",
  HIT: "x",
  SUNK: "#",
};

function drawBoard(title: string, board: BoardView): string {
  const header = "   " + Array.from({ length: board.size }, (_, i) => String.fromCharCode(65 + i)).join(" ");
  const rows = board.cells.map(
    (row, index) => String(index + 1).padStart(2) + " " + row.map((cell) => symbol[cell]).join(" "),
  );
  return [title, header, ...rows].join("\n");
}

function drawMatch(match: MatchView): string {
  const arsenal = match.arsenal.map((w) => `${w.type} ${w.ammo ?? "∞"}`).join(", ");
  return [
    `Fase: ${match.phase}`,
    drawBoard("Tu tablero", match.ownBoard),
    drawBoard("Tablero rival", match.rivalBoard),
    `Arsenal: ${arsenal}`,
  ].join("\n\n");
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

const prompt = createInterface({ input, output });
const lines = prompt[Symbol.asyncIterator]();

// Reads one line; also works when the input is piped.
async function ask(question: string): Promise<string> {
  output.write(question);
  const line = await lines.next();
  return line.done ? "0" : line.value;
}

async function menu(): Promise<boolean> {
  console.log("\n1) Ver configuración  2) Cambiar tablero  3) Cambiar dificultad  4) Iniciar partida  5) Ver partida  0) Salir");
  const option = (await ask("> ")).trim();

  switch (option) {
    case "1": {
      const result = await api.getConfig();
      console.log(result.ok ? describeConfig(result.data) : result.reason);
      return true;
    }
    case "2": {
      const size = Number(await ask("Tamaño del tablero: "));
      const result = await api.configure({ boardSize: size });
      console.log(result.ok ? "Configuración guardada." : `Rechazada: ${result.reason}`);
      return true;
    }
    case "3": {
      const difficulty = (await ask("Dificultad (EASY, NORMAL, HARD): ")).trim().toUpperCase();
      const result = await api.configure({ difficulty });
      console.log(result.ok ? "Configuración guardada." : `Rechazada: ${result.reason}`);
      return true;
    }
    case "4": {
      const result = await api.startMatch();
      console.log(result.ok ? drawMatch(result.data) : `No se pudo iniciar: ${result.reason}`);
      return true;
    }
    case "5": {
      const result = await api.getMatch();
      console.log(result.ok ? drawMatch(result.data) : "No hay partida.");
      return true;
    }
    case "0":
      return false;
    default:
      console.log("Opción no válida.");
      return true;
  }
}

try {
  while (await menu()) {}
} catch (error) {
  console.error("Error al hablar con la API:", (error as Error).message);
} finally {
  prompt.close();
}
