// Public surface of the core: the facade and the plain data it exchanges.
export { Game } from "./application/Game";
export type { ConfigureMatchInput, StartMatchResult } from "./application/Game";
export { CellState } from "./application/MatchView";
export type { BoardView, MatchView, ShipView, WeaponView } from "./application/MatchView";
export { MatchConfig } from "./domain/match/MatchConfig";
export type { MatchConfigResult } from "./domain/match/MatchConfig";
export { MatchConfigRejection } from "./domain/match/MatchConfigRejection";
export { Difficulty } from "./domain/match/Difficulty";
export { FirstTurn } from "./domain/match/FirstTurn";
export { MatchPhase } from "./domain/match/MatchPhase";
export { WeaponType } from "./domain/weapon/WeaponType";
