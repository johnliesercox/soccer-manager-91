CREATE TABLE IF NOT EXISTS scores (
  board TEXT NOT NULL,
  player TEXT NOT NULL,
  nick TEXT NOT NULL,
  score INTEGER NOT NULL,
  detail TEXT NOT NULL,
  version TEXT,
  updated INTEGER NOT NULL,
  PRIMARY KEY (board, player)
);
CREATE INDEX IF NOT EXISTS idx_scores_board_score ON scores (board, score);
