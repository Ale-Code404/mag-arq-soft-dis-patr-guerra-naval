import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/application/Game";
import { Lobby } from "../src/application/Lobby";
import { Orientation } from "../src/domain/fleet/Orientation";
import { MatchPhase } from "../src/domain/match/MatchPhase";
import { WeaponType } from "../src/domain/weapon/WeaponType";
import { buildServer } from "../src/infrastructure/http/server";
import { issueSessionToken, verifySessionToken } from "../src/infrastructure/http/sessionToken";
import { InMemoryMatchRepository, InMemoryPlayerRepository, seeded } from "./support";

const SECRET = "x".repeat(32);

// One repository of finished matches per player, as the composition root does.
function newServer(players = new InMemoryPlayerRepository(), options: { secureCookie?: boolean } = {}) {
  const saved = new Map<string, InMemoryMatchRepository>();
  const lobby = new Lobby(players, (player) => {
    saved.set(player.id, saved.get(player.id) ?? new InMemoryMatchRepository());
    return new Game({ player, random: seeded(42), repository: saved.get(player.id) });
  });
  return { app: buildServer(lobby, { logger: false, sessionSecret: SECRET, ...options }), lobby, saved, players };
}

const cookieOf = (response: { headers: Record<string, unknown> }) =>
  String(response.headers["set-cookie"]).split(";")[0];

// Registers a new player; returns the cookie a browser would send back and the code.
async function register(app: ReturnType<typeof buildServer>, name: string) {
  const response = await app.inject({ method: "POST", url: "/api/players", payload: { name } });
  assert.equal(response.statusCode, 201);
  return { cookie: cookieOf(response), code: response.json().code as string, id: response.json().player.id };
}

async function signIn(app: ReturnType<typeof buildServer>, code: unknown) {
  return app.inject({ method: "POST", url: "/api/session", payload: { code } });
}

const get = (app: ReturnType<typeof buildServer>, url: string, cookie?: string) =>
  app.inject({ method: "GET", url, headers: cookie ? { cookie } : {} });

test("without a valid session the game cannot be reached", async () => {
  const { app } = newServer();
  const { id } = await register(app, "Ana");

  assert.equal((await get(app, "/api/match")).statusCode, 401);
  assert.equal((await get(app, "/api/session")).statusCode, 401);

  // Signed with another secret, tampered with, or expired.
  const forged = issueSessionToken(id, "y".repeat(32), 3600);
  const tampered = issueSessionToken("player-2", SECRET, 3600).replace("player-2", id);
  const expired = issueSessionToken(id, SECRET, -1);
  for (const token of [forged, tampered, expired, "garbage", `${id}.9999999999.`]) {
    assert.equal((await get(app, "/api/match", `session=${token}`)).statusCode, 401, token);
  }
});

test("each player plays its own match in the same process", async () => {
  const { app } = newServer();
  const { cookie: ana } = await register(app, "Ana");
  const { cookie: beto } = await register(app, "Beto");

  await app.inject({ method: "PUT", url: "/api/config", headers: { cookie: beto }, payload: { boardSize: 10 } });
  assert.equal((await app.inject({ method: "POST", url: "/api/match", headers: { cookie: ana } })).statusCode, 201);

  assert.equal((await get(app, "/api/match", beto)).statusCode, 404);
  const betoMatch = await app.inject({ method: "POST", url: "/api/match", headers: { cookie: beto } });
  assert.equal(betoMatch.json().ownBoard.size, 10);
  assert.equal((await get(app, "/api/match", ana)).json().ownBoard.size, 8);
});

test("the player's code, not its name, finds the same player and match", async () => {
  const { app } = newServer();
  const { cookie: first, code } = await register(app, "Ana");
  await app.inject({ method: "POST", url: "/api/match", headers: { cookie: first } });

  const { cookie: namesake } = await register(app, "Ana");
  assert.equal((await get(app, "/api/match", namesake)).statusCode, 404);

  const response = await signIn(app, code);
  assert.equal(response.statusCode, 201);
  const second = cookieOf(response);
  assert.equal((await get(app, "/api/session", second)).json().player.name, "Ana");
  assert.equal((await get(app, "/api/match", second)).statusCode, 200);

  // Signing out clears this browser's cookie; the token is not revoked.
  const out = await app.inject({ method: "DELETE", url: "/api/session", headers: { cookie: second } });
  assert.equal(out.statusCode, 204);
  assert.match(String(out.headers["set-cookie"]), /^session=; .*Max-Age=0/);
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
  const { cookie: ana, id } = await register(app, "Ana");
  const { cookie: beto } = await register(app, "Beto");

  const { game, player } = (await lobby.resume(id))!;
  game.startMatch();
  [[0, 0], [2, 0], [4, 0], [6, 0], [6, 4]].forEach(([row, column], index) =>
    game.placeShip(index, row, column, Orientation.HORIZONTAL),
  );
  game.confirmPlacement();
  for (let cell = 0; cell < 64 && game.currentMatch()!.phase !== MatchPhase.FINISHED; cell++) {
    await game.fire(WeaponType.MISSILE, Math.floor(cell / 8), cell % 8);
  }

  assert.deepEqual(saved.get(player.id)!.records[0].player, player);
  assert.equal((await get(app, "/api/matches", ana)).json().length, 1);
  assert.deepEqual((await get(app, "/api/matches", beto)).json(), []);
});

test("a session survives a restart: the player's game is created again", async () => {
  const players = new InMemoryPlayerRepository();
  const { cookie } = await register(newServer(players).app, "Ana");

  const restarted = newServer(players);
  assert.equal((await get(restarted.app, "/api/session", cookie)).json().player.name, "Ana");
  assert.equal((await get(restarted.app, "/api/match", cookie)).statusCode, 404);
});

test("games left idle are dropped from memory", async () => {
  const players = new InMemoryPlayerRepository();
  const { player: ana } = await players.create("Ana");
  const { player: beto } = await players.create("Beto");
  let now = 0;
  const lobby = new Lobby(players, (player) => new Game({ player }), { idleMs: 1000, now: () => now });

  (await lobby.resume(ana.id))!.game.startMatch();
  now = 600;
  await lobby.resume(beto.id);
  now = 1200;
  await lobby.resume(beto.id);

  assert.equal(lobby.size, 1);
  assert.equal((await lobby.resume(ana.id))!.game.currentMatch(), null);
  assert.equal(await lobby.resume("nobody"), null);
});

test("the token carries an expiry and the cookie a matching Max-Age; HTTPS only when asked", async () => {
  assert.equal(verifySessionToken(issueSessionToken("p", SECRET, 60, 0), SECRET, 59_000), "p");
  assert.equal(verifySessionToken(issueSessionToken("p", SECRET, 60, 0), SECRET, 61_000), null);

  const health = await get(newServer().app, "/api/health");
  assert.deepEqual([health.statusCode, health.json()], [200, { status: "ok" }]);

  const secure = newServer(undefined, { secureCookie: true }).app;
  const response = await secure.inject({ method: "POST", url: "/api/players", payload: { name: "Ana" } });
  assert.match(String(response.headers["set-cookie"]), /HttpOnly; SameSite=Lax; Secure; Max-Age=604800$/);
  assert.doesNotMatch((await register(newServer().app, "Beto")).cookie, /Secure/);
});
