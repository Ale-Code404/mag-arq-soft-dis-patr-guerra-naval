import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless session: "<playerId>.<expiry in seconds>.<HMAC-SHA256>", base64url.
// Nothing is stored; the signature proves the server issued it. Signing out
// only clears the cookie, so a copied token stays valid until it expires;
// rotating the secret invalidates every token at once.

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function issueSessionToken(playerId: string, secret: string, ttlSeconds: number, now = Date.now()): string {
  const payload = `${playerId}.${Math.floor(now / 1000) + ttlSeconds}`;
  return `${payload}.${sign(payload, secret)}`;
}

// The player id, or null when the token is malformed, forged or expired.
export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): string | null {
  const parts = token?.split(".") ?? [];
  if (parts.length !== 3) return null;

  const [playerId, expiry, signature] = parts;
  const expected = Buffer.from(sign(`${playerId}.${expiry}`, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  return Number(expiry) * 1000 > now ? playerId : null;
}
