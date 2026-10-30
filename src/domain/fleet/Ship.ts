import { Coordinate } from "../shared/Coordinate";
import { Orientation } from "./Orientation";

export class Ship {
  length: number;
  // A ship exists before it is placed (D-11), so it starts without position.
  orientation: Orientation | null = null;
  origin: Coordinate | null = null;
  hits: number = 0;

  constructor(length: number) {
    this.length = length;
  }

  placeAt(origin: Coordinate, orientation: Orientation): void {
    this.origin = origin;
    this.orientation = orientation;
  }

  unplace(): void {
    this.origin = null;
    this.orientation = null;
  }

  hit(): void {
    this.hits++;
  }

  isPlaced(): boolean {
    return this.origin !== null;
  }

  isSunk(): boolean {
    return this.hits >= this.length;
  }
}
