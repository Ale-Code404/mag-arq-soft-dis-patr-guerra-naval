import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Pool, RowDataPacket } from "mysql2/promise";
import { Game } from "../src/application/Game";
import { Orientation } from "../src/domain/fleet/Orientation";
import { MatchPhase } from "../src/domain/match/MatchPhase";
import { WeaponType } from "../src/domain/weapon/WeaponType";
import { connect } from "../src/infrastructure/database/connect";
import { migrate } from "../src/infrastructure/database/migrate";
import { MySqlMatchRepository } from "../src/infrastructure/persistence/MySqlMatchRepository";
import { MySqlPlayerRepository } from "../src/infrastructure/persistence/MySqlPlayerRepository";
import { seeded } from "./support";

// Integration tests: they run against the database of .env (docker compose up
// db) and are skipped when DB_HOST is not set.
const skip = process.env.DB_HOST ? false : "DB_HOST is not set";
let pool: Pool;

before(async () => {
  if (skip) return;
  pool = connect();
  await migrate(pool);
});

after(async () => {
  await pool?.end();
});

test("migrations create the tables once (players, matches)", { skip }, async () => {
  assert.deepEqual(await migrate(pool), []);

  const [tables] = await pool.query<RowDataPacket[]>(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY name",
  );
  const names = tables.map((row) => row.name);
  assert.ok(names.includes("players") && names.includes("matches") && names.includes("schema_migrations"));
});

test("a player is found by its code, and the table keeps only its hash", { skip }, async () => {
  const players = new MySqlPlayerRepository(pool);
  const { player, code } = await players.create(`Ana ${randomUUID().slice(0, 8)}`);

  assert.match(code, /^[0-9a-f]{16}$/);
  assert.deepEqual(await players.findByCode(code), player);
  assert.deepEqual(await players.findByCode(code.toUpperCase()), player);
  assert.equal(await players.findByCode("ffffffffffffffff"), null);
  assert.equal(await players.findByCode("' OR '1'='1"), null);

  const [rows] = await pool.execute<RowDataPacket[]>("SELECT * FROM players WHERE id = ?", [player.id]);
  assert.ok(!JSON.stringify(rows).includes(code));
});

test("a finished match is saved, listed and loaded only by its player (CU-06, CU-09)", { skip }, async () => {
  const players = new MySqlPlayerRepository(pool);
  const { player } = await players.create("Ana");
  const { player: other } = await players.create("Beto");

  const repository = new MySqlMatchRepository(pool, player.id);
  const game = new Game({ player, random: seeded(42), repository });
  game.startMatch();
  [[0, 0], [2, 0], [4, 0], [6, 0], [6, 4]].forEach(([row, column], index) =>
    game.placeShip(index, row, column, Orientation.HORIZONTAL),
  );
  game.confirmPlacement();
  let saved: boolean | undefined;
  for (let cell = 0; cell < 64 && game.currentMatch()!.phase !== MatchPhase.FINISHED; cell++) {
    const result = await game.fire(WeaponType.MISSILE, Math.floor(cell / 8), cell % 8);
    if (result.ok) saved = result.saved;
  }
  assert.equal(saved, true);

  const [summary] = await game.listFinishedMatches();
  assert.equal(summary.winner, game.currentMatch()!.winner);

  // The record comes back whole and can be replayed (CU-10).
  game.closeMatch();
  const loaded = await game.loadFinishedMatch(summary.id);
  assert.ok(loaded.ok);
  assert.equal(loaded.replay.winner, summary.winner);

  const otherRepository = new MySqlMatchRepository(pool, other.id);
  assert.deepEqual(await otherRepository.list(), []);
  assert.equal(await otherRepository.load(summary.id), null);
});
