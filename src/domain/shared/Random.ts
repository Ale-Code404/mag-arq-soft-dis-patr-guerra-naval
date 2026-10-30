// A number in [0, 1). The domain receives it instead of calling Math.random,
// so a match can be replayed with a fixed seed (Anexo C) and tested.
export type Random = () => number;

export function pick<T>(items: T[], random: Random): T {
  return items[Math.floor(random() * items.length)];
}
