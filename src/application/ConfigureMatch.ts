import { Difficulty } from "../domain/match/Difficulty";
import { FirstTurn } from "../domain/match/FirstTurn";
import { MatchConfig } from "../domain/match/MatchConfig";
import { MatchConfigRepository } from "./MatchConfigRepository";

// What the player wants to change. An omitted value keeps the current one (CU-02, 3a).
export type ConfigureMatchInput = {
  boardSize?: number;
  shipLengths?: number[];
  difficulty?: Difficulty;
  firstTurn?: FirstTurn;
  extraTurnOnHit?: boolean;
  enabledWeapons?: [weapon: string, ammo: number][];
};

export enum ConfigRejection {
  BOARD_SIZE_OUT_OF_LIMITS = "BOARD_SIZE_OUT_OF_LIMITS",
  FLEET_DOES_NOT_FIT = "FLEET_DOES_NOT_FIT",
}

export type ConfigureMatchResult =
  | { accepted: true; config: MatchConfig }
  | { accepted: false; rejection: ConfigRejection };

// CU-02 Configurar partida.
export class ConfigureMatch {
  private configs: MatchConfigRepository;

  constructor(configs: MatchConfigRepository) {
    this.configs = configs;
  }

  // Steps 1-2: present the current configuration.
  current(): MatchConfig {
    return this.configs.getCurrent();
  }

  // Steps 3-10: apply the changes, validate and register the configuration.
  execute(input: ConfigureMatchInput): ConfigureMatchResult {
    const current = this.configs.getCurrent();

    // Steps 3-8 (and 3a).
    const candidate = new MatchConfig(
      input.boardSize ?? current.boardSize,
      input.shipLengths ?? current.shipLengths,
      input.difficulty ?? current.difficulty,
      input.firstTurn ?? current.firstTurn,
      input.extraTurnOnHit ?? current.extraTurnOnHit,
      input.enabledWeapons ?? current.enabledWeapons,
    );

    // Step 9 (9a, 9b). A rejected configuration leaves the current one untouched.
    if (!candidate.isBoardSizeAllowed()) {
      return { accepted: false, rejection: ConfigRejection.BOARD_SIZE_OUT_OF_LIMITS };
    }

    if (!candidate.fleetFitsBoard()) {
      return { accepted: false, rejection: ConfigRejection.FLEET_DOES_NOT_FIT };
    }

    // Step 10.
    this.configs.saveCurrent(candidate);

    return { accepted: true, config: candidate };
  }
}
