-- Drop the existing update policy for game_sessions
DROP POLICY IF EXISTS "Users can update game sessions they're part of" ON game_sessions;

-- Create a new update policy that also allows conversation participants to update trivia sessions
CREATE POLICY "Users can update game sessions they're part of" 
ON game_sessions 
FOR UPDATE 
USING (
  (created_by = auth.uid()) 
  OR (callee_id = auth.uid())
  OR (
    -- Allow conversation participants to update trivia sessions (for multiplayer trivia)
    game_type = 'trivia' 
    AND EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = game_sessions.conversation_id
      AND conversation_participants.user_id = auth.uid()
    )
  )
);