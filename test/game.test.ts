import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/application/Game";
import { CellState } from "../src/application/MatchView";
import { PlacementRejection } from "../src/domain/board/PlacementRejection";
import { Orientation } from "../src/domain/fleet/Orientation";
import { FirstTurn } from "../src/domain/match/FirstTurn";
import { MatchConfigRejection } from "../src/domain/match/MatchConfigRejection";
import { MatchPhase } from "../src/domain/match/MatchPhase";
import { MatchRejection } from "../src/domain/match/MatchRejection";
import { OutcomeType } from "../src/domain/weapon/OutcomeType";
import { WeaponRejection } from "../src/domain/weapon/WeaponRejection";
import { WeaponType } from "../src/domain/weapon/WeaponType";
import { InMemoryMatchRepository, seeded } from "./support";

// The default fleet [5, 4, 3, 3, 2], one ship per row from column 0.
function placeDefaultFleet(game: Game): void {
  for (let index = 0; index < 5; index++) {
    const result = game.placeShip(index, index, 0, Orientation.HORIZONTAL);
    assert.ok(result.ok, `ship ${index}`);
  }
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

test("placements outside the board or overlapping are rejected (CU-03, 3a and 3b)", () => {
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
