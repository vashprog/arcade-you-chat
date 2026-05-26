-- Drop and recreate the update policy for game_sessions to include word-chain game type
DROP POLICY IF EXISTS "Users can update game sessions they're part of" ON public.game_sessions;

CREATE POLICY "Users can update game sessions they're part of" 
ON public.game_sessions 
FOR UPDATE 
USING (
  (created_by = auth.uid()) 
  OR (callee_id = auth.uid()) 
  OR (
    (game_type IN ('trivia', 'word-chain')) 
    AND (EXISTS (
      SELECT 1
      FROM conversation_participants
      WHERE (
        conversation_participants.conversation_id = game_sessions.conversation_id
        AND conversation_participants.user_id = auth.uid()
      )
    ))
  )
);