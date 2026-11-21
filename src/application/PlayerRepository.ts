// The person who plays, as the application knows it: not the domain Player of a
// match (HumanPlayer), but who that HumanPlayer belongs to.
export type PlayerAccount = { id: string; name: string };

// Port: where players are kept, so a name finds the same player after a restart.
export interface PlayerRepository {
  // Names are compared without case or surrounding spaces.
  findByName(name: string): Promise<PlayerAccount | null>;
  create(name: string): Promise<PlayerAccount>;
}
