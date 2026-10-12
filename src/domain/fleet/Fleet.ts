import { Ship } from "./Ship";

export class Fleet {
  ships: Ship[];

  constructor(ships: Ship[]) {
    this.ships = ships;
  }

  area(): number {
    return this.ships.reduce((acc, ship) => acc + ship.length, 0);
  }
}
