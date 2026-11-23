import type { Position, TurnView, WeaponType } from "./api/client";
import { weaponArea } from "./areas";
import { cellKey } from "./coordinates";

// How a cell reacts to the attack: PASS is a cell the weapon only crosses
// (the torpedo's run, or an area cell that was already attacked).
export type EffectResult = "hit" | "miss" | "spotted" | "clear" | "pass";

// One cell of an attack animation; delay staggers the cells of a run or sweep.
export type CellEffect = { weapon: WeaponType; result: EffectResult; delay: number };

export type TurnEffect = { cells: Map<string, CellEffect>; duration: number };

// Length of each weapon's animation on one cell, in ms. Keep in sync with style.css.
const BASE_DURATION: Record<WeaponType, number> = {
  MISSILE: 800,
  BOMB: 1000,
  BOMBER: 700,
  TORPEDO: 600,
  RECON_PLANE: 1100,
  NUKE: 1300,
};

// Delay between consecutive cells of the bomber's sweep and the torpedo's run.
const STEP_DELAY: Partial<Record<WeaponType, number>> = { BOMBER: 160, TORPEDO: 90 };

export function turnEffect(turn: TurnView, boardSize: number): TurnEffect {
  const results = new Map(turn.outcomes.map((o) => [cellKey(o), o.result.toLowerCase() as EffectResult]));
  const step = STEP_DELAY[turn.weapon] ?? 0;
  const cells = new Map<string, CellEffect>();

  for (const [index, position] of crossedCells(turn, boardSize).entries()) {
    const key = cellKey(position);
    cells.set(key, { weapon: turn.weapon, result: results.get(key) ?? "pass", delay: index * step });
  }

  const lastDelay = Math.max(0, ...[...cells.values()].map((cell) => cell.delay));
  return { cells, duration: lastDelay + BASE_DURATION[turn.weapon] };
}

// Cells the animation runs over, in the order the weapon reaches them.
function crossedCells(turn: TurnView, boardSize: number): Position[] {
  // Column by column, so the bomber sweeps left to right.
  const { cells } = weaponArea(turn.weapon, turn.target, boardSize);

  // D-18: the torpedo runs the row from the left and stops at the ship it hits.
  const hit = turn.weapon === "TORPEDO" ? turn.outcomes.find((o) => o.result === "HIT") : undefined;
  return hit ? cells.slice(0, hit.column + 1) : cells;
}
