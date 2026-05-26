-- Create table to store active calls for signaling
CREATE TABLE public.active_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL DEFAULT 'video',
  status TEXT NOT NULL DEFAULT 'ringing',
  offer JSONB,
  answer JSONB,
  caller_candidates JSONB[] DEFAULT '{}',
  callee_candidates JSONB[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.active_calls ENABLE ROW LEVEL SECURITY;

-- Policies for active calls
CREATE POLICY "Users can view calls they are part of"
  ON public.active_calls
  FOR SELECT
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

CREATE POLICY "Users can create calls"
  ON public.active_calls
  FOR INSERT
  WITH CHECK (caller_id = auth.uid());

CREATE POLICY "Users can update calls they are part of"
  ON public.active_calls
  FOR UPDATE
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

CREATE POLICY "Users can delete calls they are part of"
  ON public.active_calls
  FOR DELETE
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- Enable realtime for active_calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_calls;