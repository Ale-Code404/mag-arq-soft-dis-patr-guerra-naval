import { Board } from "../board/Board";
import { Fleet } from "../fleet/Fleet";
import { Ship } from "../fleet/Ship";
import { BotPlayer } from "../player/BotPlayer";
import { HumanPlayer } from "../player/HumanPlayer";
import { Clock } from "../shared/Clock";
import { Random } from "../shared/Random";
import { WeaponFactory } from "../weapon/WeaponFactory";
import { HIT_PROBABILITY } from "./Difficulty";
import { Match } from "./Match";
import { MatchConfig } from "./MatchConfig";

// CU-01, step 4: two empty boards, two unplaced fleets and an arsenal per side,
// all from the current configuration (D-10).
export class MatchFactory {
  static create(config: MatchConfig, random: Random, clock: Clock): Match {
    // The boards come first: the bot knows the rival board (D-09).
    const humanBoard = Board.empty(config.boardSize);
    const botBoard = Board.empty(config.boardSize);

    const human = new HumanPlayer(
      "Player",
      humanBoard,
      MatchFactory.fleet(config),
      WeaponFactory.arsenal(config.enabledWeapons),
    );

    const bot = new BotPlayer(
      "Bot",
      botBoard,
      MatchFactory.fleet(config),
      WeaponFactory.arsenal(config.enabledWeapons),
      HIT_PROBABILITY[config.difficulty],
      humanBoard,
      random,
    );

    return new Match(config, [human, bot], random, clock);
  }

  // Ships exist before they are placed (D-11).
  private static fleet(config: MatchConfig): Fleet {
    return new Fleet(config.shipLengths.map((length) => new Ship(length)));
  }
}
