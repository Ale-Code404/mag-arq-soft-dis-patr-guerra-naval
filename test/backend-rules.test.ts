import assert from "node:assert/strict";
import { test } from "node:test";
import { toReplay } from "../src/application/FinishedMatchRecord";
import { Game } from "../src/application/Game";
import { Board } from "../src/domain/board/Board";
import { Fleet } from "../src/domain/fleet/Fleet";
import { Orientation } from "../src/domain/fleet/Orientation";
import { Ship } from "../src/domain/fleet/Ship";
import { MatchConfig } from "../src/domain/match/MatchConfig";
import { MatchPhase } from "../src/domain/match/MatchPhase";
import { BotPlayer } from "../src/domain/player/BotPlayer";
import { HumanPlayer } from "../src/domain/player/HumanPlayer";
import { Coordinate } from "../src/domain/shared/Coordinate";
import { WeaponFactory } from "../src/domain/weapon/WeaponFactory";
import { WeaponType } from "../src/domain/weapon/WeaponType";
import { InMemoryMatchRepository, seeded } from "./support";

const DEFAULT_FLEET_ORIGINS: [row: number, column: number][] = [[0, 0], [2, 0], [4, 0], [6, 0], [6, 4]];

// A rival with one ship of 4 at C3-C6 and a bot with only the missile.
function hunter(hitProbability: number, seed = 7) {
  const rivalBoard = Board.empty(8);
  const ship = new Ship(4);
  rivalBoard.place(ship, new Coordinate(2, 2), Orientation.HORIZONTAL);
  const rival = new HumanPlayer("Ana", rivalBoard, new Fleet([ship]), []);
  const bot = new BotPlayer("Bot", Board.empty(8), new Fleet([]), WeaponFactory.arsenal([]), hitProbability, rivalBoard, seeded(seed));
  return { bot, rival, ship };
}

const fire = (bot: BotPlayer, rival: HumanPlayer) => {
  const shot = bot.takeTurn(rival);
  assert.ok(shot.fired);
  return shot;
};

test("after a hit the bot fires next to it, then along the line, whatever its probability (CU-12)", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const { bot, rival, ship } = hunter(1, seed);
    const first = fire(bot, rival);
    assert.equal(first.outcomes[0].result, "HIT", `seed ${seed}`);

    // Probability 0 would aim at water; the hunt ignores it.
    bot.hitProbability = 0;
    const second = fire(bot, rival);
    const distance = Math.abs(second.target.row - first.target.row) + Math.abs(second.target.column - first.target.column);
    assert.equal(distance, 1, `seed ${seed}: next to the hit`);

    let last = second;
    while (last.outcomes[0].result !== "HIT") last = fire(bot, rival);

    // Two hits in row 2: from now on it keeps to that row until the ship sinks.
    while (!ship.isSunk()) {
      const shot = fire(bot, rival);
      assert.equal(shot.target.row, 2, `seed ${seed}: along the line`);
    }
  }
});

test("without a pending hit the bot follows its level's probability again", () => {
  const { bot, rival, ship } = hunter(1);
  while (!ship.isSunk()) fire(bot, rival);

  bot.hitProbability = 0;
  const shot = fire(bot, rival);
  assert.equal(shot.outcomes[0].result, "MISS");
});

test("the nuke covers 3 x 3 cells and is in the default arsenal (RF-24, RF-25)", async () => {
  assert.ok(MatchConfig.defaults().enabledWeapons.some(([type, ammo]) => type === WeaponType.NUKE && ammo === 1));

  const game = new Game({ random: seeded(42) });
  assert.ok(game.configureMatch({ firstTurn: "HUMAN" as never }).accepted);
  game.startMatch();
  DEFAULT_FLEET_ORIGINS.forEach(([row, column], index) => game.placeShip(index, row, column, Orientation.HORIZONTAL));
  game.confirmPlacement();

  const nuke = await game.fire(WeaponType.NUKE, 0, 0);
  assert.ok(nuke.ok);
  assert.equal(nuke.turns[0].weapon, WeaponType.NUKE);
  assert.equal(nuke.turns[0].outcomes.length, 9);
  assert.equal(nuke.match.arsenal.find((weapon) => weapon.type === WeaponType.NUKE)?.ammo, 0);
  assert.deepEqual(await game.fire(WeaponType.NUKE, 4, 4), { ok: false, rejection: "NO_AMMO" });
});

test("each turn says which ships it sank, and the views give every ship's state", async () => {
  const repository = new InMemoryMatchRepository();
  const game = new Game({ random: seeded(42), repository });
  game.configureMatch({ firstTurn: "HUMAN" as never });
  game.startMatch();
  DEFAULT_FLEET_ORIGINS.forEach(([row, column], index) => game.placeShip(index, row, column, Orientation.HORIZONTAL));
  game.confirmPlacement();

  const sinking = [];
  for (let cell = 0; cell < 64 && game.currentMatch()!.phase !== MatchPhase.FINISHED; cell++) {
    const result = await game.fire(WeaponType.MISSILE, Math.floor(cell / 8), cell % 8);
    if (!result.ok) continue;
    for (const turn of result.turns) if (turn.sunkShips.length > 0) sinking.push(turn);
  }

  const match = game.currentMatch()!;
  const playerSank = sinking.filter((turn) => turn.side === "PLAYER").flatMap((turn) => turn.sunkShips);
  const opponentSank = sinking.filter((turn) => turn.side === "OPPONENT").flatMap((turn) => turn.sunkShips);

  assert.equal(playerSank.length, match.rivalSunkShips.length);
  assert.equal(opponentSank.length, match.fleet.filter((ship) => ship.sunk).length);
  for (const ship of [...playerSank, ...match.rivalSunkShips]) {
    assert.equal(ship.sunk, true);
    assert.equal(ship.hits, ship.length);
  }
  assert.ok(match.fleet.every((ship) => ship.hits <= ship.length));

  // The replay rebuilds the same: every turn that sank a ship says so.
  const replay = toReplay(repository.records[0])!;
  const loaded = await game.loadFinishedMatch("0");
  assert.ok(loaded.ok);
  for (const turn of sinking) {
    const frame = game.replayAt(turn.number);
    assert.ok(frame.ok);
    assert.equal(frame.replay.lastTurn?.sunkShips.length, turn.sunkShips.length, `turn ${turn.number}`);
  }
  const end = game.replayAt(replay.turns.length);
  assert.ok(end.ok);
  assert.equal(end.replay.playerShips.length, 5);
  assert.equal(end.replay.opponentShips.length, 5);
  const loser = match.winner === "PLAYER" ? end.replay.opponentShips : end.replay.playerShips;
  assert.ok(loser.every((ship) => ship.sunk));
});
