import { ConfigureMatch } from "../application/ConfigureMatch";
import { Difficulty } from "../domain/match/Difficulty";
import { MatchConfig } from "../domain/match/MatchConfig";
import { InMemoryMatchConfigRepository } from "../infrastructure/InMemoryMatchConfigRepository";

// Wiring of the local console application.
const configs = new InMemoryMatchConfigRepository(MatchConfig.defaults());
const configureMatch = new ConfigureMatch(configs);

// Scripted run of CU-02; the console presentation will replace it.
console.log("Current configuration:", configureMatch.current());
console.log(
  "Change board size and difficulty:",
  configureMatch.execute({ boardSize: 10, difficulty: Difficulty.HARD }),
);
console.log("Change to a 2 x 2 board:", configureMatch.execute({ boardSize: 2 }));
console.log("Current configuration:", configureMatch.current());
