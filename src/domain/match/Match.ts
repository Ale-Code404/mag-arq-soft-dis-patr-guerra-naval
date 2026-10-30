import { Orientation } from "../fleet/Orientation";
import { BotPlayer } from "../player/BotPlayer";
import { HumanPlayer } from "../player/HumanPlayer";
import { Player } from "../player/Player";
import { ShotRequest } from "../player/Shot";
import { Clock } from "../shared/Clock";
import { Coordinate } from "../shared/Coordinate";
import { Random } from "../shared/Random";
import { FirstTurn } from "./FirstTurn";
import { MatchConfig } from "./MatchConfig";
import { MatchPhase } from "./MatchPhase";
import { MatchResult } from "./MatchRejection";
import { FinishedState } from "./state/FinishedState";
import { MatchState } from "./state/MatchState";
import { PlacementState } from "./state/PlacementState";
import { Turn } from "./Turn";

// RF-11: the initial state is where each ship was placed.
export type ShipPlacement = {
  player: Player;
  length: number;
  origin: Coordinate;
  orientation: Orientation;
};

export class Match {
  config: MatchConfig;
  players: [HumanPlayer, BotPlayer];
  turns: Turn[] = [];
  initialPlacement: ShipPlacement[] = [];
  winner: Player | null = null;
  private state: MatchState = new PlacementState();
  private random: Random;
  private clock: Clock;

  constructor(config: MatchConfig, players: [HumanPlayer, BotPlayer], random: Random, clock: Clock) {
    this.config = config;
    this.players = players;
    this.random = random;
    this.clock = clock;
  }

  get phase(): MatchPhase {
    return this.state.phase;
  }

  get human(): HumanPlayer {
    return this.players[0];
  }

  get bot(): BotPlayer {
    return this.players[1];
  }

  // The actions delegate to the current state.
  placeShip(index: number, origin: Coordinate, orientation: Orientation): MatchResult {
    return this.state.placeShip(this, index, origin, orientation);
  }

  removeShip(index: number): MatchResult {
    return this.state.removeShip(this, index);
  }

  confirmPlacement(): MatchResult<{ turns: Turn[] }> {
    return this.state.confirmPlacement(this);
  }

  fire(request: ShotRequest): MatchResult<{ turns: Turn[] }> {
    return this.state.fire(this, request);
  }

  // Used by the states.
  changeState(state: MatchState): void {
    this.state = state;
  }

  saveInitialSnapshot(): void {
    this.initialPlacement = this.players.flatMap((player) =>
      player.fleet.ships.map((ship) => ({
        player,
        length: ship.length,
        origin: ship.origin!,
        orientation: ship.orientation!,
      })),
    );
  }

  // CU-01, 7a and 7b.
  drawOpponentFirst(): boolean {
    if (this.config.firstTurn === FirstTurn.RANDOM) return this.random() < 0.5;
    return this.config.firstTurn === FirstTurn.BOT;
  }

  // One turn of either side, recorded as its snapshot (RF-11).
  playTurn(player: Player, rival: Player, request?: ShotRequest): MatchResult<{ turn: Turn }> {
    const startedAt = this.clock();
    const shot = player.takeTurn(rival, request);
    if (!shot.fired) return { ok: false, rejection: shot.rejection };

    const turn = new Turn(
      this.turns.length + 1,
      player,
      shot.weapon,
      shot.target,
      shot.outcomes,
      startedAt,
      this.clock(),
    );
    this.turns.push(turn);

    return { ok: true, turn };
  }

  // CU-12, including 4b (another turn on a hit) and CU-04, 6a.
  playOpponentTurns(): Turn[] {
    const turns: Turn[] = [];

    while (true) {
      const played = this.playTurn(this.bot, this.human);
      if (!played.ok) break;

      turns.push(played.turn);

      if (this.human.fleet.isSunk()) {
        this.finish(this.bot);
        break;
      }

      if (!(this.config.extraTurnOnHit && played.turn.isHit())) break;
    }

    return turns;
  }

  // CU-06, steps 1-2.
  finish(winner: Player): void {
    this.winner = winner;
    this.changeState(new FinishedState());
  }
}
