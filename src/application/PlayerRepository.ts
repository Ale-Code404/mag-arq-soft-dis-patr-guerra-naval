// The person who plays, as the application knows it: not the domain Player of a
// match (HumanPlayer), but who that HumanPlayer belongs to. The name is only
// shown; two players may share it.
export type PlayerAccount = { id: string; name: string };

// Port: where players are kept. A player is found by the code it was given
// when created, never by its name, so knowing a name is not enough to play as
// someone else.
export interface PlayerRepository {
  // The code is returned only here; the repository may keep just a hash of it.
  create(name: string): Promise<{ player: PlayerAccount; code: string }>;
  findByCode(code: string): Promise<PlayerAccount | null>;
}
