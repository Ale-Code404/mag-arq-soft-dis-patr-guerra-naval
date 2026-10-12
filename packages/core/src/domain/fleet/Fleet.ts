import { Ship } from "./Ship";

export class Fleet {
  ships: Ship[];

  constructor(ships: Ship[]) {
    this.ships = ships;
  }
}
