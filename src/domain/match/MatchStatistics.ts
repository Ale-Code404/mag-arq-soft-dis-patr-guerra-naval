import { Player } from "../player/Player";
import { Match } from "./Match";

type PerSide = { player: number; opponent: number };

// CU-07 (RF-16): computed from the recorded turns, so asking for them leaves
// the finished match as it was. Supuesto of the CU: the precision is the
// Jugador's and the sunk ships are counted per fleet. Both turn counts are
// given until the pending «turnos consumidos» is decided.
export class MatchStatistics {
  // Uses of a damaging weapon with at least one hit over all those uses, or
  // null when the Jugador never used one (2a, «sin disparos»). Recon is left out.
  readonly precision: number | null;
  readonly hits: number;
  readonly damagingShots: number;
  readonly turns: PerSide & { total: number };
  // Ships of each fleet that were sunk.
  readonly shipsSunk: PerSide;

  private constructor(
    precision: number | null,
    hits: number,
    damagingShots: number,
    turns: PerSide & { total: number },
    shipsSunk: PerSide,
  ) {
    this.precision = precision;
    this.hits = hits;
    this.damagingShots = damagingShots;
    this.turns = turns;
    this.shipsSunk = shipsSunk;
  }

  // CU-07, steps 2-3.
  static of(match: Match): MatchStatistics {
    const { human, bot } = match;
    const turnsOf = (player: Player) => match.turns.filter((turn) => turn.player === player);
    const sunk = (player: Player) => player.fleet.ships.filter((ship) => ship.isSunk()).length;

    const damaging = turnsOf(human).filter((turn) => turn.weapon.isDamaging());
    const hits = damaging.filter((turn) => turn.isHit()).length;

    return new MatchStatistics(
      damaging.length === 0 ? null : hits / damaging.length,
      hits,
      damaging.length,
      { total: match.turns.length, player: turnsOf(human).length, opponent: turnsOf(bot).length },
      { player: sunk(human), opponent: sunk(bot) },
    );
  }
}
