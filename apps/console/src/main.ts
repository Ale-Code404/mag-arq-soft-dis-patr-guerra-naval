import { Difficulty, Game } from "@guerra-naval/core";

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

// Scripted run of CU-01 (steps 3-4).
const start = game.startMatch();
if (start.started) {
  console.log("Match phase:", start.match.phase);
  console.log("Board size:", start.match.ownBoard.size);
  console.log("Fleet:", start.match.fleet.map((ship) => ship.length));
  console.log("Arsenal:", start.match.arsenal);
}
console.log("Start again while in progress:", game.startMatch());
