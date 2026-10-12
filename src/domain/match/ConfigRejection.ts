export enum ConfigRejection {
  // CU-02, precondition: there is no match in progress.
  MATCH_IN_PROGRESS = "MATCH_IN_PROGRESS",
  // CU-02, 9a.
  BOARD_SIZE_OUT_OF_LIMITS = "BOARD_SIZE_OUT_OF_LIMITS",
  // CU-02, 9b.
  FLEET_DOES_NOT_FIT = "FLEET_DOES_NOT_FIT",
}
