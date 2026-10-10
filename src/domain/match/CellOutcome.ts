import { Coordinate } from "../shared/Coordinate";
import { OutcomeType } from "./OutcomeType";

export class CellOutcome {
  position: Coordinate;
  result: OutcomeType;

  constructor(position: Coordinate, result: OutcomeType) {
    this.position = position;
    this.result = result;
  }
}
