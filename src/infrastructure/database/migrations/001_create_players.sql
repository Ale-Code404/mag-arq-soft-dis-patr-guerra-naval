-- Players (sign-in by code). Only the SHA-256 of the code is kept, so reading
-- the table does not let anyone sign in as another player.
CREATE TABLE players (
  id CHAR(36) NOT NULL,
  name VARCHAR(30) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_players_code_hash (code_hash)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
