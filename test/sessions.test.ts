import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/application/Game";
import { Lobby } from "../src/application/Lobby";
import { Orientation } from "../src/domain/fleet/Orientation";
import { MatchPhase } from "../src/domain/match/MatchPhase";
import { WeaponType } from "../src/domain/weapon/WeaponType";
import { buildServer } from "../src/infrastructure/http/server";
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

const cookieOf = (response: { headers: Record<string, unknown> }) =>
  String(response.headers["set-cookie"]).split(";")[0];

// Registers a new player; returns the cookie a browser would send back and the code.
async function register(app: ReturnType<typeof buildServer>, name: string) {
  const response = await app.inject({ method: "POST", url: "/api/players", payload: { name } });
  assert.equal(response.statusCode, 201);
  return { cookie: cookieOf(response), code: response.json().code as string };
}

async function signIn(app: ReturnType<typeof buildServer>, code: unknown) {
  return app.inject({ method: "POST", url: "/api/session", payload: { code } });
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
  const { cookie: ana } = await register(app, "Ana");
  const { cookie: beto } = await register(app, "Beto");

  await app.inject({ method: "PUT", url: "/api/config", headers: { cookie: beto }, payload: { boardSize: 10 } });
  assert.equal((await app.inject({ method: "POST", url: "/api/match", headers: { cookie: ana } })).statusCode, 201);

  // Beto has no match yet and keeps his own configuration.
  assert.equal((await app.inject({ method: "GET", url: "/api/match", headers: { cookie: beto } })).statusCode, 404);
  const betoMatch = await app.inject({ method: "POST", url: "/api/match", headers: { cookie: beto } });
  assert.equal(betoMatch.json().ownBoard.size, 10);
  assert.equal((await app.inject({ method: "GET", url: "/api/match", headers: { cookie: ana } })).json().ownBoard.size, 8);
});

test("the player's code, not its name, finds the same player and match", async () => {
  const { app } = newServer();
  const { cookie: first, code } = await register(app, "Ana");
  await app.inject({ method: "POST", url: "/api/match", headers: { cookie: first } });

  // Another player with the same name is someone else.
  const { cookie: namesake } = await register(app, "Ana");
  assert.equal((await app.inject({ method: "GET", url: "/api/match", headers: { cookie: namesake } })).statusCode, 404);

  // Another browser, another session, the same player.
  const response = await signIn(app, code);
  assert.equal(response.statusCode, 201);
  const second = cookieOf(response);
  assert.notEqual(second, first);
  const session = await app.inject({ method: "GET", url: "/api/session", headers: { cookie: second } });
  assert.equal(session.json().player.name, "Ana");
  assert.equal((await app.inject({ method: "GET", url: "/api/match", headers: { cookie: second } })).statusCode, 200);

  // Signing out closes that session only.
  assert.equal((await app.inject({ method: "DELETE", url: "/api/session", headers: { cookie: second } })).statusCode, 204);
  assert.equal((await app.inject({ method: "GET", url: "/api/match", headers: { cookie: second } })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: "/api/match", headers: { cookie: first } })).statusCode, 200);
});

test("a name must have between 1 and 30 characters, and an unknown code is refused", async () => {
  const { app } = newServer();
  for (const name of ["", "   ", "x".repeat(31), 42]) {
    const response = await app.inject({ method: "POST", url: "/api/players", payload: { name } });
    assert.equal(response.statusCode, 422, `name ${JSON.stringify(name)}`);
  }
  for (const code of ["", "ffffffffffffffff", "Ana", 7, undefined]) {
    const response = await signIn(app, code);
    assert.equal(response.statusCode, 401, `code ${JSON.stringify(code)}`);
    assert.equal(response.headers["set-cookie"], undefined);
  }
});

test("each player only sees its own saved matches, which record who played them", async () => {
  const { app, lobby, saved } = newServer();
  const { cookie: ana } = await register(app, "Ana");
  const { cookie: beto } = await register(app, "Beto");

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

test("the health check needs no session, and the cookie can be HTTPS only", async () => {
  const { app } = newServer();
  const health = await app.inject({ method: "GET", url: "/api/health" });
  assert.deepEqual([health.statusCode, health.json()], [200, { status: "ok" }]);

  const lobby = new Lobby(new InMemoryPlayerRepository(), new InMemorySessionRepository(), (player) => new Game({ player }));
  const secure = buildServer(lobby, { logger: false, secureCookie: true });
  const response = await secure.inject({ method: "POST", url: "/api/players", payload: { name: "Ana" } });
  assert.match(String(response.headers["set-cookie"]), /; Secure/);
  assert.doesNotMatch(String((await register(app, "Beto")).cookie), /Secure/);
});
