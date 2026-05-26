-- Allow users to delete conversations they are part of
CREATE POLICY "Users can delete their conversations"
ON public.conversations
FOR DELETE
USING (
  public.is_conversation_participant(id, auth.uid())
);

-- Allow cascade delete of participants when conversation is deleted
CREATE POLICY "Users can delete participants from their conversations"
ON public.conversation_participants
FOR DELETE
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
);