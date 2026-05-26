
-- Fix 1: Restrict profiles SELECT to own profile + conversation participants
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Users can view own and conversation participant profiles" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1
      FROM conversation_participants cp1
      JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = auth.uid() AND cp2.user_id = profiles.id
    )
  );

-- Fix 2: Make chat-media bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-media';
