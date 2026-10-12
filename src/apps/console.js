"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Game_1 = require("../application/Game");
const Difficulty_1 = require("../domain/match/Difficulty");
// Wiring of the local console application.
const game = new Game_1.Game();
// Scripted run of CU-02; the console presentation will replace it.
console.log("Current configuration:", game.currentConfig());
console.log("Change board size and difficulty:", game.configureMatch({ boardSize: 10, difficulty: Difficulty_1.Difficulty.HARD }));
console.log("Change to a 2 x 2 board:", game.configureMatch({ boardSize: 2 }));
console.log("Current configuration:", game.currentConfig());
