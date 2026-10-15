export enum Difficulty {
  EASY = "EASY",
  NORMAL = "NORMAL",
  HARD = "HARD",
}

// RF-03: probability that a bot weapon use hits at least one ship cell (D-08).
export const HIT_PROBABILITY: Record<Difficulty, number> = {
  [Difficulty.EASY]: 0.25,
  [Difficulty.NORMAL]: 0.35,
  [Difficulty.HARD]: 0.45,
};
