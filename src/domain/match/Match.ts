import { Player } from "../player/Player";
import { MatchConfig } from "./MatchConfig";
import { MatchPhase } from "./MatchPhase";
import { Turn } from "./Turn";

export class Match {
  config: MatchConfig;
  players: [Player, Player];
  turns: Turn[] = [];
  phase: MatchPhase = MatchPhase.PLACEMENT;

  constructor(config: MatchConfig, players: [Player, Player]) {
    this.config = config;
    this.players = players;
  }
}
