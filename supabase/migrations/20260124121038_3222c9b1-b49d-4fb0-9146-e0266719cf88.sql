-- Add a participants array to game_state for multiplayer games
-- The game_state JSONB column already exists, we'll use it to store:
-- { 
--   "players": [{"id": "uuid", "username": "name", "score": 0, "status": "pending|joined|left"}],
--   "currentQuestion": {...},
--   "questionIndex": 0,
--   "gameStarted": false,
--   "startTime": "timestamp"
-- }

-- No schema changes needed since game_state JSONB is flexible
-- Just adding a comment for documentation purposes

COMMENT ON COLUMN public.game_sessions.game_state IS 'JSONB storing game-specific state. For trivia: { players: [{id, username, score, status}], currentQuestion: {...}, questionIndex: number, gameStarted: boolean, startTime: string }';

-- For multiplayer games like trivia, callee_id will be null (invites go to all group members)
-- We'll track individual player participation in game_state.players array