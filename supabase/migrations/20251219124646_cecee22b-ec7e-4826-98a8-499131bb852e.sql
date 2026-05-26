-- Drop the insecure policy that allows anyone to add participants
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;

-- Create a secure policy that only allows existing participants to add new members
-- Also allow the first participant (conversation creator) to be added
CREATE POLICY "Users can add participants to their conversations" 
  ON public.conversation_participants
  FOR INSERT 
  WITH CHECK (
    -- Allow if user is adding themselves to a conversation they created (first participant)
    (user_id = auth.uid() AND NOT EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
    ))
    OR
    -- Allow if user is already a participant in the conversation
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id 
      AND cp.user_id = auth.uid()
    )
  );