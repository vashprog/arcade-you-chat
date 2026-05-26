-- Add multiplayer columns to game_sessions
ALTER TABLE public.game_sessions 
ADD COLUMN callee_id UUID REFERENCES auth.users(id),
ADD COLUMN current_turn UUID REFERENCES auth.users(id),
ADD COLUMN game_state JSONB DEFAULT '{}'::jsonb;

-- Add UPDATE policy for game_sessions
CREATE POLICY "Users can update game sessions they're part of"
ON public.game_sessions
FOR UPDATE
USING (
  created_by = auth.uid() OR callee_id = auth.uid()
);

-- Create game_moves table for tracking individual moves
CREATE TABLE public.game_moves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES auth.users(id),
  move_type TEXT NOT NULL,
  move_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on game_moves
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;

-- RLS policies for game_moves
CREATE POLICY "Users can view moves in their game sessions"
ON public.game_moves
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_sessions gs
    WHERE gs.id = session_id
    AND (gs.created_by = auth.uid() OR gs.callee_id = auth.uid())
  )
);

CREATE POLICY "Users can insert moves in their game sessions"
ON public.game_moves
FOR INSERT
WITH CHECK (
  player_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.game_sessions gs
    WHERE gs.id = session_id
    AND (gs.created_by = auth.uid() OR gs.callee_id = auth.uid())
  )
);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_moves;