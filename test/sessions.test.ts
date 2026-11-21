import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Game } from "../src/application/Game";
import { Lobby } from "../src/application/Lobby";
import { Orientation } from "../src/domain/fleet/Orientation";
import { MatchPhase } from "../src/domain/match/MatchPhase";
import { WeaponType } from "../src/domain/weapon/WeaponType";
import { buildServer } from "../src/infrastructure/http/server";
import { JsonFilePlayerRepository } from "../src/infrastructure/persistence/JsonFilePlayerRepository";
import { InMemorySessionRepository } from "../src/infrastructure/session/InMemorySessionRepository";
import { InMemoryMatchRepository, InMemoryPlayerRepository, seeded } from "./support";

// One repository of finished matches per player, as the composition root does.
function newServer() {
  const saved = new Map<string, InMemoryMatchRepository>();
  const lobby = new Lobby(new InMemoryPlayerRepository(), new InMemorySessionRepository(), (player) => {
    saved.set(player.id, new InMemoryMatchRepository());
    return new Game({ player, random: seeded(42), repository: saved.get(player.id) });
  });
  return { app: buildServer(lobby, { logger: false }), lobby, saved };
}

// Signs in and returns the cookie a browser would send back.
async function signIn(app: ReturnType<typeof buildServer>, name: string): Promise<string> {
  const response = await app.inject({ method: "POST", url: "/api/session", payload: { name } });
  assert.equal(response.statusCode, 201);
  return String(response.headers["set-cookie"]).split(";")[0];
}

test("without a session the game cannot be reached", async () => {
  const { app } = newServer();

  assert.equal((await app.inject({ method: "GET", url: "/api/match" })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: "/api/session" })).statusCode, 401);
  const forged = await app.inject({ method: "POST", url: "/api/match", headers: { cookie: "session=forged" } });
  assert.equal(forged.statusCode, 401);
});

test("each player plays its own match in the same process", async () => {
  const { app } = newServer();
  const ana = await signIn(app, "Ana");
  const beto = await signIn(app, "Beto");

  await app.inject({ method: "PUT", url: "/api/config", headers: { cookie: beto }, payload: { boardSize: 10 } });
  assert.equal((await app.inject({ method: "POST", url: "/api/match", headers: { cookie: ana } })).statusCode, 201);

  // Beto has no match yet and keeps his own configuration.
  assert.equal((await app.inject({ method: "GET", url: "/api/match", headers: { cookie: beto } })).statusCode, 404);
  const betoMatch = await app.inject({ method: "POST", url: "/api/match", headers: { cookie: beto } });
  assert.equal(betoMatch.json().ownBoard.size, 10);
  assert.equal((await app.inject({ method: "GET", url: "/api/match", headers: { cookie: ana } })).json().ownBoard.size, 8);
});

test("signing in again with the same name finds the same player and match", async () => {
  const { app } = newServer();
  const first = await signIn(app, "Ana");
  await app.inject({ method: "POST", url: "/api/match", headers: { cookie: first } });

  // Another browser, another session, the same player.
  const second = await signIn(app, "  ana ");
  assert.notEqual(second, first);
  const session = await app.inject({ method: "GET", url: "/api/session", headers: { cookie: second } });
  assert.equal(session.json().player.name, "Ana");
  assert.equal((await app.inject({ method: "GET", url: "/api/match", headers: { cookie: second } })).statusCode, 200);

  // Signing out closes that session only.
  assert.equal((await app.inject({ method: "DELETE", url: "/api/session", headers: { cookie: second } })).statusCode, 204);
  assert.equal((await app.inject({ method: "GET", url: "/api/match", headers: { cookie: second } })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: "/api/match", headers: { cookie: first } })).statusCode, 200);
});

test("a name must have between 1 and 30 characters", async () => {
  const { app } = newServer();
  for (const name of ["", "   ", "x".repeat(31), 42]) {
    const response = await app.inject({ method: "POST", url: "/api/session", payload: { name } });
    assert.equal(response.statusCode, 422, `name ${JSON.stringify(name)}`);
  }
});

test("each player only sees its own saved matches, which record who played them", async () => {
  const { app, lobby, saved } = newServer();
  const ana = await signIn(app, "Ana");
  const beto = await signIn(app, "Beto");

  const { game, player } = (await lobby.resume(ana.split("=")[1]))!;
  game.startMatch();
  [[0, 0], [2, 0], [4, 0], [6, 0], [6, 4]].forEach(([row, column], index) =>
    game.placeShip(index, row, column, Orientation.HORIZONTAL),
  );
  game.confirmPlacement();
  for (let cell = 0; cell < 64 && game.currentMatch()!.phase !== MatchPhase.FINISHED; cell++) {
    await game.fire(WeaponType.MISSILE, Math.floor(cell / 8), cell % 8);
  }

  assert.deepEqual(saved.get(player.id)!.records[0].player, player);
  assert.equal((await app.inject({ method: "GET", url: "/api/matches", headers: { cookie: ana } })).json().length, 1);
  assert.deepEqual((await app.inject({ method: "GET", url: "/api/matches", headers: { cookie: beto } })).json(), []);
});

test("players are remembered by name after a restart", async () => {
  const file = join(await mkdtemp(join(tmpdir(), "players-")), "players.json");

  const created = await new JsonFilePlayerRepository(file).create("Ana");
  const [again, other] = await Promise.all([
    new JsonFilePlayerRepository(file).findByName("ANA"),
    new JsonFilePlayerRepository(file).findByName("Beto"),
  ]);

  assert.deepEqual(again, created);
  assert.equal(other, null);
});
