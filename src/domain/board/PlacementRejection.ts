// CU-03, alternate courses 3a, 3b and 3c.
export enum PlacementRejection {
  OUT_OF_BOARD = "OUT_OF_BOARD",
  OVERLAP = "OVERLAP",
  // 3c: another ship lies within the margin around it (Ship.DEFAULT_MARGIN).
  TOO_CLOSE = "TOO_CLOSE",
}
