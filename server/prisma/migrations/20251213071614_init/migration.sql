-- CreateTable
CREATE TABLE "completed_games" (
    "id" TEXT NOT NULL,
    "player_red" TEXT NOT NULL,
    "player_yellow" TEXT NOT NULL,
    "winner" TEXT,
    "is_draw" BOOLEAN NOT NULL,
    "moves" INTEGER NOT NULL,
    "started_at" BIGINT NOT NULL,
    "ended_at" BIGINT NOT NULL,
    "duration_ms" BIGINT NOT NULL,
    "is_bot_game" BOOLEAN NOT NULL,

    CONSTRAINT "completed_games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "completed_games_winner_idx" ON "completed_games"("winner");
