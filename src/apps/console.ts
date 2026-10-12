import { Game } from "../application/Game";
import { Difficulty } from "../domain/match/Difficulty";

// Wiring of the local console application.
const game = new Game();

// Scripted run of CU-02; the console presentation will replace it.
console.log("Current configuration:", game.currentConfig());
console.log(
  "Change board size and difficulty:",
  game.configureMatch({ boardSize: 10, difficulty: Difficulty.HARD }),
);
console.log("Change to a 2 x 2 board:", game.configureMatch({ boardSize: 2 }));
console.log("Current configuration:", game.currentConfig());
