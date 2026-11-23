import type { Orientation, ShipStateView, ShipView } from "../api/client";

export type ShipShape = {
  row: number;
  column: number;
  length: number;
  orientation: Orientation;
  sunk: boolean;
};

// The API says where each ship is and whether it sank; this is the shape the
// board draws.
export const toShape = (ship: ShipStateView): ShipShape => ({
  row: ship.origin.row,
  column: ship.origin.column,
  length: ship.length,
  orientation: ship.orientation,
  sunk: ship.sunk,
});

// The Jugador's own fleet, as far as it is placed.
export const fleetShapes = (fleet: ShipView[]): ShipShape[] =>
  fleet.flatMap((ship) =>
    ship.origin && ship.orientation
      ? [{ row: ship.origin.row, column: ship.origin.column, length: ship.length, orientation: ship.orientation, sunk: ship.sunk }]
      : [],
  );
