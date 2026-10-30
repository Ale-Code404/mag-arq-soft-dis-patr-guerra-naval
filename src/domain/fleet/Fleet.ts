import { Ship } from "./Ship";

export class Fleet {
  ships: Ship[];

  constructor(ships: Ship[]) {
    this.ships = ships;
  }

  ship(index: number): Ship | null {
    return this.ships[index] ?? null;
  }

  isPlaced(): boolean {
    return this.ships.every((ship) => ship.isPlaced());
  }

  // RF-18: a fleet with no ship afloat ends the match (CU-06).
  isSunk(): boolean {
    return this.ships.every((ship) => ship.isSunk());
  }
}
