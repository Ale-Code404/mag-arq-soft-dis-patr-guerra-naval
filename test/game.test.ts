import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/application/Game";
import { CellState } from "../src/application/MatchView";
import { Board } from "../src/domain/board/Board";
import { PlacementRejection } from "../src/domain/board/PlacementRejection";
import { Fleet } from "../src/domain/fleet/Fleet";
import { Ship } from "../src/domain/fleet/Ship";
import { Orientation } from "../src/domain/fleet/Orientation";
import { FirstTurn } from "../src/domain/match/FirstTurn";
import { MatchConfigRejection } from "../src/domain/match/MatchConfigRejection";
import { MatchPhase } from "../src/domain/match/MatchPhase";
import { MatchRejection } from "../src/domain/match/MatchRejection";
import { OutcomeType } from "../src/domain/weapon/OutcomeType";
import { WeaponRejection } from "../src/domain/weapon/WeaponRejection";
import { WeaponType } from "../src/domain/weapon/WeaponType";
import { BotPlayer } from "../src/domain/player/BotPlayer";
import { InMemoryMatchRepository, seeded } from "./support";

// The default fleet [5, 4, 3, 3, 2] on rows A, C, E and G, with a free cell
// between ships (CU-03, 3c).
const DEFAULT_FLEET_ORIGINS: [row: number, column: number][] = [[0, 0], [2, 0], [4, 0], [6, 0], [6, 4]];

function placeDefaultFleet(game: Game): void {
  DEFAULT_FLEET_ORIGINS.forEach(([row, column], index) => {
    const result = game.placeShip(index, row, column, Orientation.HORIZONTAL);
    assert.ok(result.ok, `ship ${index}`);
  });
}

function newGame(firstTurn = FirstTurn.HUMAN) {
  const repository = new InMemoryMatchRepository();
  const game = new Game({ random: seeded(42), repository });
  assert.ok(game.configureMatch({ firstTurn }).accepted);
  assert.ok(game.startMatch().started);
  return { game, repository };
}

test("a complete match can be played and is saved when a fleet is sunk", async () => {
  const { game, repository } = newGame();
  placeDefaultFleet(game);
  assert.ok(game.confirmPlacement().ok);

  let last = game.currentMatch()!;
  for (let row = 0; row < 8 && last.phase !== MatchPhase.FINISHED; row++) {
    for (let column = 0; column < 8 && last.phase !== MatchPhase.FINISHED; column++) {
      const result = await game.fire(WeaponType.MISSILE, row, column);
      assert.ok(result.ok);
      last = result.match;
    }
  }

  assert.equal(last.phase, MatchPhase.FINISHED);
  assert.notEqual(last.winner, null);
  assert.equal(repository.records.length, 1);
  assert.equal(repository.records[0].winner, last.winner);
  assert.equal(repository.records[0].initialPlacement.length, 10);

  // CU-06: a finished match accepts no more shots.
  const after = await game.fire(WeaponType.MISSILE, 7, 7);
  assert.deepEqual(after, { ok: false, rejection: MatchRejection.WRONG_PHASE });
});

test("the opponent answers every shot unless the match ends", async () => {
  const { game } = newGame();
  placeDefaultFleet(game);
  game.confirmPlacement();

  const result = await game.fire(WeaponType.MISSILE, 7, 7);
  assert.ok(result.ok);
  assert.deepEqual(result.turns.map((turn) => turn.side), ["PLAYER", "OPPONENT"]);
});

test("the opponent opens the match when the configuration says so (CU-01, 7a)", () => {
  const { game } = newGame(FirstTurn.BOT);
  placeDefaultFleet(game);

  const result = game.confirmPlacement();
  assert.ok(result.ok);
  assert.equal(result.turns.length, 1);
  assert.equal(result.turns[0].side, "OPPONENT");
});

test("each phase only accepts its own actions (State)", async () => {
  const { game } = newGame();

  assert.deepEqual(await game.fire(WeaponType.MISSILE, 0, 0), {
    ok: false,
    rejection: MatchRejection.WRONG_PHASE,
  });
  assert.deepEqual(game.confirmPlacement(), { ok: false, rejection: MatchRejection.FLEET_NOT_PLACED });

  placeDefaultFleet(game);
  game.confirmPlacement();

  assert.deepEqual(game.placeShip(0, 7, 0, Orientation.HORIZONTAL), {
    ok: false,
    rejection: MatchRejection.WRONG_PHASE,
  });
});

test("placements outside the board, overlapping or touching are rejected (CU-03, 3a to 3c)", () => {
  const { game } = newGame();

  assert.deepEqual(game.placeShip(0, 0, 5, Orientation.HORIZONTAL), {
    ok: false,
    rejection: PlacementRejection.OUT_OF_BOARD,
  });
  assert.ok(game.placeShip(0, 0, 0, Orientation.HORIZONTAL).ok);
  assert.deepEqual(game.placeShip(1, 0, 3, Orientation.VERTICAL), {
    ok: false,
    rejection: PlacementRejection.OVERLAP,
  });

  // 3c: ships keep a free cell between them, diagonals included.
  assert.deepEqual(game.placeShip(1, 1, 0, Orientation.HORIZONTAL), {
    ok: false,
    rejection: PlacementRejection.TOO_CLOSE,
  });
  assert.deepEqual(game.placeShip(4, 1, 5, Orientation.HORIZONTAL), {
    ok: false,
    rejection: PlacementRejection.TOO_CLOSE,
  });
  assert.ok(game.placeShip(1, 2, 0, Orientation.HORIZONTAL).ok);
  assert.ok(game.placeShip(4, 0, 6, Orientation.HORIZONTAL).ok);

  // 5a: a removed ship goes back to the pending ones.
  const removed = game.removeShip(0);
  assert.ok(removed.ok);
  assert.equal(removed.match.fleet[0].placed, false);
});

test("each weapon covers its own cells (Strategy)", async () => {
  const { game } = newGame();
  placeDefaultFleet(game);
  game.confirmPlacement();

  const bomb = await game.fire(WeaponType.BOMB, 6, 6);
  assert.ok(bomb.ok);
  assert.equal(bomb.turns[0].outcomes.length, 4);

  const recon = await game.fire(WeaponType.RECON_PLANE, 0, 0);
  assert.ok(recon.ok);
  assert.equal(recon.turns[0].outcomes.length, 9);
  assert.ok(recon.turns[0].outcomes.every((o) => [OutcomeType.SPOTTED, OutcomeType.CLEAR].includes(o.result)));

  // The torpedo attacks at most one cell: the first ship cell of the row.
  const torpedo = await game.fire(WeaponType.TORPEDO, 3, 0);
  assert.ok(torpedo.ok);
  assert.ok(torpedo.turns[0].outcomes.length <= 1);

  assert.deepEqual(await game.fire(WeaponType.TORPEDO, 3, 0), {
    ok: false,
    rejection: WeaponRejection.NO_AMMO,
  });
  assert.deepEqual(await game.fire(WeaponType.BOMB, 7, 7), {
    ok: false,
    rejection: WeaponRejection.AREA_OUT_OF_BOARD,
  });
});

test("the rival board never shows ships (CU-01, step 7)", () => {
  const { game } = newGame();
  placeDefaultFleet(game);
  const result = game.confirmPlacement();
  assert.ok(result.ok);

  const rivalCells = result.match.rivalBoard.cells.flat();
  assert.ok(rivalCells.every((cell) => cell !== CellState.SHIP));
  assert.equal(result.match.ownBoard.cells.flat().filter((cell) => cell === CellState.SHIP).length, 17);
});

test("unknown values are rejected by the configuration", () => {
  const game = new Game();
  const result = game.configureMatch({ difficulty: "FOO" as never });
  assert.deepEqual(result, { accepted: false, rejection: MatchConfigRejection.INVALID_VALUE });
});

test("the fleet takes at most 30 % of the board (CU-02, step 9)", () => {
  const game = new Game();
  const atLimit = game.configureMatch({ boardSize: 10, shipLengths: [6, 6, 6, 6, 6] });
  assert.ok(atLimit.accepted);
  const overLimit = game.configureMatch({ boardSize: 10, shipLengths: [6, 6, 6, 6, 7] });
  assert.deepEqual(overLimit, { accepted: false, rejection: MatchConfigRejection.FLEET_DOES_NOT_FIT });
});

test("a fleet without room to keep its ships apart does not fit (CU-03, 3c)", () => {
  const game = new Game();
  // 19 cells are under 30 % of 8 x 8, but at most 16 lone cells fit apart.
  const result = game.configureMatch({ shipLengths: Array(19).fill(1) });
  assert.deepEqual(result, { accepted: false, rejection: MatchConfigRejection.FLEET_DOES_NOT_FIT });
});

test("the opponent keeps its ships apart (CU-11)", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const board = Board.empty(8);
    const fleet = new Fleet([5, 4, 3, 3, 2].map((length) => new Ship(length)));
    const bot = new BotPlayer("Bot", board, fleet, [], 0, Board.empty(8), seeded(seed));
    assert.ok(bot.placeFleet(), `seed ${seed}`);

    const ships = board.cells.filter((cell) => cell.ship !== null);
    for (const cell of ships) {
      const touching = ships.filter(
        (other) =>
          other.ship !== cell.ship &&
          Math.abs(other.position.row - cell.position.row) <= 1 &&
          Math.abs(other.position.column - cell.position.column) <= 1,
      );
      assert.deepEqual(touching, [], `seed ${seed}`);
    }
  }
});

test("the same seed plays the same match", async () => {
  const play = async () => {
    const { game } = newGame(FirstTurn.RANDOM);
    placeDefaultFleet(game);
    game.confirmPlacement();
    const result = await game.fire(WeaponType.MISSILE, 7, 7);
    assert.ok(result.ok);
    return result.match;
  };

  assert.deepEqual(await play(), await play());
});
