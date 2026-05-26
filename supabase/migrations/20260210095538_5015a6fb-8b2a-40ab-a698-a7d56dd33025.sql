
DROP POLICY IF EXISTS "Users can update game sessions they're part of" ON game_sessions;

CREATE POLICY "Users can update game sessions they're part of"
ON game_sessions
FOR UPDATE
USING (
  (created_by = auth.uid())
  OR (callee_id = auth.uid())
  OR (
    (game_type = ANY (ARRAY['trivia'::text, 'word-chain'::text, 'dice-roll'::text, 'rock-paper-scissors'::text]))
    AND (EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = game_sessions.conversation_id
        AND conversation_participants.user_id = auth.uid()
    ))
  )
);
