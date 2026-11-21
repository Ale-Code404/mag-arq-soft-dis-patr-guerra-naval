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
import { MatchStatistics } from "../domain/match/MatchStatistics";
import { Turn } from "../domain/match/Turn";
import { Clock } from "../domain/shared/Clock";
import { Coordinate } from "../domain/shared/Coordinate";
import { Random } from "../domain/shared/Random";
import { Replay } from "../domain/replay/Replay";
import { WeaponType } from "../domain/weapon/WeaponType";
import { FinishedMatchRecord, toFinishedMatchRecord, toReplay } from "./FinishedMatchRecord";
import { FinishedMatchRepository, FinishedMatchSummary } from "./FinishedMatchRepository";
import { PlayerAccount } from "./PlayerRepository";
import { MatchView, ReplayView, toMatchView, toReplayView, toTurnViews, TurnView } from "./MatchView";

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

// CU-09: 3a covers both an unreadable file and invalid content.
export type ReplayRejection = "MATCH_IN_PROGRESS" | "NOT_FOUND" | "INVALID_MATCH" | "NO_REPLAY" | "NO_SUCH_TURN";

export type ReplayResult = { ok: true; replay: ReplayView } | { ok: false; rejection: ReplayRejection };

export type StatisticsResult =
  | { ok: true; statistics: MatchStatistics }
  | { ok: false; rejection: "NO_MATCH" | MatchRejection.WRONG_PHASE };

type LoadedMatch = { id: string; record: FinishedMatchRecord; replay: Replay };

export type GameOptions = {
  // Who plays this game's matches; saved with each finished one.
  player?: PlayerAccount;
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
  private loaded: LoadedMatch | null = null;
  private readonly random: Random;
  private readonly clock: Clock;
  private readonly repository: FinishedMatchRepository | null;
  readonly player: PlayerAccount | null;

  constructor(options: GameOptions = {}) {
    this.player = options.player ?? null;
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

  // CU-07, extending CU-06 at «partida terminada»: only a finished match has them.
  statistics(): StatisticsResult {
    if (this.match === null) return { ok: false, rejection: "NO_MATCH" };
    if (this.match.phase !== MatchPhase.FINISHED) return { ok: false, rejection: MatchRejection.WRONG_PHASE };

    return { ok: true, statistics: MatchStatistics.of(this.match) };
  }

  // CU-06, steps 5-6, and the cancellations of CU-01 and CU-03 (*a): the game
  // is left without a match.
  closeMatch(): boolean {
    if (this.match === null) return false;

    this.match = null;
    return true;
  }

  // CU-09, step 1 (1a: an empty list, which the presentation reports).
  async listFinishedMatches(): Promise<FinishedMatchSummary[]> {
    return this.repository === null ? [] : this.repository.list();
  }

  // CU-09, steps 2-4, as included by CU-10 (steps 2-3): the chosen match is
  // read, validated and left ready at its initial state. A rejected one does
  // not replace the match already loaded.
  async loadFinishedMatch(id: string): Promise<ReplayResult> {
    if (this.isMatchInProgress()) return { ok: false, rejection: "MATCH_IN_PROGRESS" };
    if (this.repository === null) return { ok: false, rejection: "NOT_FOUND" };

    let data: unknown;
    try {
      data = await this.repository.load(id);
    } catch {
      return { ok: false, rejection: "INVALID_MATCH" };
    }
    if (data === null) return { ok: false, rejection: "NOT_FOUND" };

    const replay = toReplay(data);
    if (replay === null) return { ok: false, rejection: "INVALID_MATCH" };

    this.loaded = { id, record: data as FinishedMatchRecord, replay };
    return this.replayAt(0);
  }

  // CU-10, steps 3 and 5, 4a1 and 4a2: the state after the first `turn` turns.
  replayAt(turn: number): ReplayResult {
    const loaded = this.loaded;
    if (loaded === null) return { ok: false, rejection: "NO_REPLAY" };

    const frame = loaded.replay.at(turn);
    if (frame === null) return { ok: false, rejection: "NO_SUCH_TURN" };

    const { record, replay } = loaded;
    return {
      ok: true,
      replay: toReplayView(loaded.id, record.finishedAt, replay.winner, replay.turns.length, frame),
    };
  }

  // CU-10, steps 6-7: the saved match is left as it was.
  closeReplay(): boolean {
    if (this.loaded === null) return false;

    this.loaded = null;
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
      await this.repository.save(toFinishedMatchRecord(match, this.clock(), this.player));
      return true;
    } catch {
      return false;
    }
  }

  private isMatchInProgress(): boolean {
    return this.match !== null && this.match.phase !== MatchPhase.FINISHED;
  }
}
