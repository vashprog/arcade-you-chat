-- Fix 1: Add UPDATE and DELETE policies for messages table
-- Allow users to update their own messages
CREATE POLICY "Users can update own messages" ON public.messages
  FOR UPDATE USING (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id 
      AND user_id = auth.uid()
    )
  );

-- Allow users to delete their own messages
CREATE POLICY "Users can delete own messages" ON public.messages
  FOR DELETE USING (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id 
      AND user_id = auth.uid()
    )
  );

-- Fix 2: Create secure RPC function for conversation creation
-- This ensures conversations always have at least the creator as participant
CREATE OR REPLACE FUNCTION public.create_conversation_with_participants(
  p_name TEXT,
  p_is_group BOOLEAN DEFAULT false,
  p_participant_ids UUID[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_participant_id UUID;
  v_all_participants UUID[];
BEGIN
  -- Validate user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate conversation name
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Conversation name required';
  END IF;
  
  -- Ensure creator is included in participants
  IF p_participant_ids IS NULL THEN
    v_all_participants := ARRAY[auth.uid()];
  ELSE
    -- Add creator if not already in the list
    IF NOT (auth.uid() = ANY(p_participant_ids)) THEN
      v_all_participants := array_append(p_participant_ids, auth.uid());
    ELSE
      v_all_participants := p_participant_ids;
    END IF;
  END IF;
  
  -- Validate at least one participant (should always be true after above)
  IF array_length(v_all_participants, 1) IS NULL OR array_length(v_all_participants, 1) = 0 THEN
    RAISE EXCEPTION 'At least one participant required';
  END IF;
  
  -- Create conversation
  INSERT INTO conversations (name, is_group)
  VALUES (trim(p_name), p_is_group)
  RETURNING id INTO v_conversation_id;
  
  -- Add all participants
  FOREACH v_participant_id IN ARRAY v_all_participants
  LOOP
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conversation_id, v_participant_id);
  END LOOP;
  
  RETURN v_conversation_id;
END;
$$;

-- Update conversations INSERT policy to be more restrictive
-- Only allow direct inserts from authenticated users (for backwards compatibility)
-- But recommend using the RPC function
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations" ON public.conversations
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);