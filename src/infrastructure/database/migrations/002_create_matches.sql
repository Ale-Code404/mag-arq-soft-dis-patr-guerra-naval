-- Finished matches (RF-13, CU-06 step 3), each owned by the player who played
-- it. The whole record (configuration, initial placement and turns) stays as
-- JSON (RNF-01); winner and finished_at are copied out to list them (CU-09, 1).
CREATE TABLE matches (
  id CHAR(36) NOT NULL,
  player_id CHAR(36) NOT NULL,
  finished_at DATETIME(3) NOT NULL,
  winner ENUM('PLAYER', 'OPPONENT') NOT NULL,
  record JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_matches_player_finished (player_id, finished_at),
  CONSTRAINT fk_matches_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
