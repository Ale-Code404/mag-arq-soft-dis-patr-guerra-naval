import assert from "node:assert/strict";
import { test } from "node:test";
import { FinishedMatchRepository } from "../src/application/FinishedMatchRepository";
import { Game } from "../src/application/Game";
import { BoardView, CellState } from "../src/application/MatchView";
import { Orientation } from "../src/domain/fleet/Orientation";
import { MatchPhase } from "../src/domain/match/MatchPhase";
import { WeaponType } from "../src/domain/weapon/WeaponType";
import { InMemoryMatchRepository, seeded } from "./support";

const DEFAULT_FLEET_ORIGINS: [row: number, column: number][] = [[0, 0], [2, 0], [4, 0], [6, 0], [6, 4]];

// Plays a seeded match to its end, firing a missile at every cell in order.
async function playFinishedMatch<R extends FinishedMatchRepository = InMemoryMatchRepository>(
  repository: R = new InMemoryMatchRepository() as unknown as R,
) {
  const game = new Game({ random: seeded(42), repository });
  game.startMatch();
  DEFAULT_FLEET_ORIGINS.forEach(([row, column], index) => game.placeShip(index, row, column, Orientation.HORIZONTAL));
  game.confirmPlacement();

  for (let row = 0; row < 8 && game.currentMatch()!.phase !== MatchPhase.FINISHED; row++) {
    for (let column = 0; column < 8 && game.currentMatch()!.phase !== MatchPhase.FINISHED; column++) {
      await game.fire(WeaponType.MISSILE, row, column);
    }
  }

  return { game, repository };
}

const count = (board: BoardView, state: CellState) => board.cells.flat().filter((cell) => cell === state).length;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test("a saved match is listed and loaded at its initial state, both fleets visible (CU-09, CU-10 step 3)", async () => {
  const { game, repository } = await playFinishedMatch();

  const list = await game.listFinishedMatches();
  assert.equal(list.length, 1);
  assert.equal(list[0].winner, repository.records[0].winner);

  const loaded = await game.loadFinishedMatch(list[0].id);
  assert.ok(loaded.ok);
  assert.equal(loaded.replay.turn, 0);
  assert.equal(loaded.replay.totalTurns, repository.records[0].turns.length);
  assert.equal(loaded.replay.lastTurn, null);
  assert.equal(count(loaded.replay.playerBoard, CellState.SHIP), 17);
  assert.equal(count(loaded.replay.opponentBoard, CellState.SHIP), 17);
});

test("the last turn of the replay shows the board the match ended with (CU-10, step 5)", async () => {
  const { game } = await playFinishedMatch();
  const ended = game.currentMatch()!;

  const loaded = await game.loadFinishedMatch("0");
  assert.ok(loaded.ok);
  const last = game.replayAt(loaded.replay.totalTurns);
  assert.ok(last.ok);

  assert.deepEqual(last.replay.playerBoard, ended.ownBoard);
  // The match hid the rival ships that were not hit; the replay shows them.
  const hidden = last.replay.opponentBoard.cells.map((row) =>
    row.map((cell) => (cell === CellState.SHIP ? CellState.EMPTY : cell)),
  );
  assert.deepEqual(hidden, ended.rivalBoard.cells);
  assert.equal(last.replay.winner, ended.winner);
});

test("stepping back shows the same state as before, and the bounds are reported (CU-10, 4a1 and 4a2)", async () => {
  const { game, repository } = await playFinishedMatch();
  const saved = copy(repository.records[0]);
  const loaded = await game.loadFinishedMatch("0");
  assert.ok(loaded.ok);

  const third = game.replayAt(3);
  game.replayAt(10);
  assert.deepEqual(game.replayAt(3), third);
  assert.ok(third.ok);
  assert.equal(third.replay.lastTurn?.number, 3);

  assert.deepEqual(game.replayAt(-1), { ok: false, rejection: "NO_SUCH_TURN" });
  assert.deepEqual(game.replayAt(loaded.replay.totalTurns + 1), { ok: false, rejection: "NO_SUCH_TURN" });

  // Prototype: the turns are applied to clones, never to the loaded match.
  assert.deepEqual(game.replayAt(0), loaded);
  assert.deepEqual(repository.records[0], saved);

  // Steps 6-7.
  assert.equal(game.closeReplay(), true);
  assert.deepEqual(game.replayAt(0), { ok: false, rejection: "NO_REPLAY" });
});

test("a match cannot be loaded while another is in progress (CU-09, precondition)", async () => {
  const { repository } = await playFinishedMatch();
  const game = new Game({ repository });
  game.startMatch();

  assert.deepEqual(await game.loadFinishedMatch("0"), { ok: false, rejection: "MATCH_IN_PROGRESS" });
});

test("a missing or edited saved match is not loaded (CU-09, 3a)", async () => {
  const { game, repository } = await playFinishedMatch();
  const record = repository.records[0];

  const overlapping = copy(record);
  overlapping.initialPlacement[1].origin = { ...overlapping.initialPlacement[0].origin };

  const hitOnWater = copy(record);
  const miss = hitOnWater.turns.flatMap((turn) => turn.outcomes).find((outcome) => outcome.result === "MISS")!;
  miss.result = "HIT";

  const outside = copy(record);
  outside.turns[0].outcomes[0].position = { row: 99, column: 0 };

  const unfinished = copy(record);
  unfinished.turns = unfinished.turns.slice(0, 5);

  repository.stored.push(overlapping, hitOnWater, outside, unfinished, { hello: "world" });

  for (const id of ["1", "2", "3", "4", "5"]) {
    assert.deepEqual(await game.loadFinishedMatch(id), { ok: false, rejection: "INVALID_MATCH" }, `id ${id}`);
  }
  assert.deepEqual(await game.loadFinishedMatch("99"), { ok: false, rejection: "NOT_FOUND" });
});
