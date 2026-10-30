import { Orientation } from "../domain/fleet/Orientation";
import { Difficulty } from "../domain/match/Difficulty";
import { FirstTurn } from "../domain/match/FirstTurn";
import { Match } from "../domain/match/Match";
import { MatchConfig, MatchConfigResult } from "../domain/match/MatchConfig";
import { MatchConfigBuilder } from "../domain/match/MatchConfigBuilder";
import { MatchConfigRejection } from "../domain/match/MatchConfigRejection";
import { MatchFactory } from "../domain/match/MatchFactory";
import { MatchPhase } from "../domain/match/MatchPhase";
import { AnyRejection, MatchRejection } from "../domain/match/MatchRejection";
import { Turn } from "../domain/match/Turn";
import { Clock } from "../domain/shared/Clock";
import { Coordinate } from "../domain/shared/Coordinate";
import { Random } from "../domain/shared/Random";
import { WeaponType } from "../domain/weapon/WeaponType";
import { toFinishedMatchRecord } from "./FinishedMatchRecord";
import { FinishedMatchRepository } from "./FinishedMatchRepository";
import { MatchView, toMatchView, toTurnViews, TurnView } from "./MatchView";

export type ConfigureMatchInput = {
  boardSize?: number;
  shipLengths?: number[];
  difficulty?: Difficulty;
  firstTurn?: FirstTurn;
  extraTurnOnHit?: boolean;
  enabledWeapons?: [weapon: WeaponType, ammo: number][];
};

export type StartMatchResult =
  | { started: true; match: MatchView }
  | { started: false; reason: "MATCH_IN_PROGRESS" };

export type GameRejection = AnyRejection | "NO_MATCH";

export type ActionResult =
  | { ok: true; match: MatchView; turns: TurnView[]; saved?: boolean }
  | { ok: false; rejection: GameRejection };

export type GameOptions = {
  config?: MatchConfig;
  random?: Random;
  clock?: Clock;
  repository?: FinishedMatchRepository;
};

// Facade (D-23): one method per system event. The presentation never touches
// the domain; it gets views back.
export class Game {
  private config: MatchConfig;
  private match: Match | null = null;
  private readonly random: Random;
  private readonly clock: Clock;
  private readonly repository: FinishedMatchRepository | null;

  constructor(options: GameOptions = {}) {
    this.config = options.config ?? MatchConfig.defaults();
    this.random = options.random ?? Math.random;
    this.clock = options.clock ?? (() => new Date());
    this.repository = options.repository ?? null;
  }

  currentConfig(): MatchConfig {
    return this.config;
  }

  // CU-02.
  configureMatch(input: ConfigureMatchInput): MatchConfigResult {
    if (this.isMatchInProgress()) {
      return { accepted: false, rejection: MatchConfigRejection.MATCH_IN_PROGRESS };
    }

    const builder = MatchConfigBuilder.from(this.config);

    if (input.boardSize !== undefined) builder.withBoardSize(input.boardSize);
    if (input.shipLengths !== undefined) builder.withShipLengths(input.shipLengths);
    if (input.difficulty !== undefined) builder.withDifficulty(input.difficulty);
    if (input.firstTurn !== undefined) builder.withFirstTurn(input.firstTurn);
    if (input.extraTurnOnHit !== undefined) builder.withExtraTurnOnHit(input.extraTurnOnHit);
    if (input.enabledWeapons !== undefined) builder.withEnabledWeapons(input.enabledWeapons);

    const result = builder.build();

    if (result.accepted) {
      this.config = result.config;
    }

    return result;
  }

  // CU-01, steps 3-4. A finished match is replaced by the new one.
  startMatch(): StartMatchResult {
    if (this.isMatchInProgress()) {
      return { started: false, reason: "MATCH_IN_PROGRESS" };
    }

    this.match = MatchFactory.create(this.config, this.random, this.clock);

    return { started: true, match: toMatchView(this.match) };
  }

  // The match as the presentation may see it, or null before CU-01.
  currentMatch(): MatchView | null {
    return this.match === null ? null : toMatchView(this.match);
  }

  // CU-03, steps 2-4.
  placeShip(index: number, row: number, column: number, orientation: Orientation): ActionResult {
    return this.act((match) => match.placeShip(index, new Coordinate(row, column), orientation));
  }

  // CU-03, 5a.
  removeShip(index: number): ActionResult {
    return this.act((match) => match.removeShip(index));
  }

  // CU-03, steps 5-7, and CU-01, steps 6-7 (7a: the opponent may open).
  confirmPlacement(): ActionResult {
    const match = this.match;
    const result = this.act((current) => current.confirmPlacement());

    // CU-01, 5a: without both fleets placed by error, the match is discarded.
    if (!result.ok && result.rejection === MatchRejection.OPPONENT_PLACEMENT_FAILED) {
      if (this.match === match) this.match = null;
    }

    return result;
  }

  // CU-04, including CU-12 and, when a fleet is sunk, CU-06 steps 1-3.
  async fire(weapon: WeaponType, row: number, column: number): Promise<ActionResult> {
    const result = this.act((match) => match.fire({ weapon, target: new Coordinate(row, column) }));
    if (!result.ok || this.match?.phase !== MatchPhase.FINISHED) return result;

    return { ...result, saved: await this.saveFinishedMatch(this.match) };
  }

  // CU-06, steps 5-6, and the cancellations of CU-01 and CU-03 (*a): the game
  // is left without a match.
  closeMatch(): boolean {
    if (this.match === null) return false;

    this.match = null;
    return true;
  }

  private act(action: (match: Match) => { ok: true; turns?: Turn[] } | { ok: false; rejection: AnyRejection }): ActionResult {
    const match = this.match;
    if (match === null) return { ok: false, rejection: "NO_MATCH" };

    const result = action(match);
    if (!result.ok) return result;

    return { ok: true, match: toMatchView(match), turns: toTurnViews(match, result.turns ?? []) };
  }

  // CU-06, step 3 and 3a: a storage failure does not undo the end of the match.
  private async saveFinishedMatch(match: Match): Promise<boolean> {
    if (this.repository === null) return false;

    try {
      await this.repository.save(toFinishedMatchRecord(match, this.clock()));
      return true;
    } catch {
      return false;
    }
  }

  private isMatchInProgress(): boolean {
    return this.match !== null && this.match.phase !== MatchPhase.FINISHED;
  }
}
