class BotPlayer extends Player {
  hitProbability: number;

  constructor(name: string, hitProbability: number) {
    super(name);

    this.hitProbability = hitProbability;
  }
}
