import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/application/Game";
import { Orientation } from "../src/domain/fleet/Orientation";
import { MatchPhase } from "../src/domain/match/MatchPhase";
import { MatchRejection } from "../src/domain/match/MatchRejection";
import { WeaponType } from "../src/domain/weapon/WeaponType";
import { InMemoryMatchRepository, seeded } from "./support";

const DEFAULT_FLEET_ORIGINS: [row: number, column: number][] = [[0, 0], [2, 0], [4, 0], [6, 0], [6, 4]];

function placedGame() {
  const game = new Game({ random: seeded(42), repository: new InMemoryMatchRepository() });
  game.startMatch();
  DEFAULT_FLEET_ORIGINS.forEach(([row, column], index) => game.placeShip(index, row, column, Orientation.HORIZONTAL));
  game.confirmPlacement();
  return game;
}

test("statistics are only given for a finished match (CU-07, precondition)", async () => {
  assert.deepEqual(new Game().statistics(), { ok: false, rejection: "NO_MATCH" });

  const game = placedGame();
  await game.fire(WeaponType.MISSILE, 0, 0);
  assert.deepEqual(game.statistics(), { ok: false, rejection: MatchRejection.WRONG_PHASE });
});

test("precision, turns and sunk ships are computed from the turns (CU-07, steps 2-3)", async () => {
  const game = placedGame();
  let hits = 0;
  let shots = 0;

  // A recon flight first: it is not a damaging use, so it does not count.
  await game.fire(WeaponType.RECON_PLANE, 0, 0);

  for (let row = 0; row < 8 && game.currentMatch()!.phase !== MatchPhase.FINISHED; row++) {
    for (let column = 0; column < 8 && game.currentMatch()!.phase !== MatchPhase.FINISHED; column++) {
      const result = await game.fire(WeaponType.MISSILE, row, column);
      if (!result.ok) continue;
      shots++;
      if (result.turns[0].outcomes.some((outcome) => outcome.result === "HIT")) hits++;
    }
  }

  const result = game.statistics();
  assert.ok(result.ok);
  const { statistics } = result;
  const match = game.currentMatch()!;

  assert.equal(statistics.damagingShots, shots);
  assert.equal(statistics.hits, hits);
  assert.equal(statistics.precision, hits / shots);
  assert.equal(statistics.turns.total, match.turnsPlayed);
  assert.equal(statistics.turns.player, shots + 1);
  assert.equal(statistics.turns.player + statistics.turns.opponent, statistics.turns.total);
  assert.equal(statistics.shipsSunk.opponent, 5 - match.rivalShipsAfloat);
  assert.equal(statistics.shipsSunk.player, match.fleet.filter((ship) => ship.sunk).length);
});
