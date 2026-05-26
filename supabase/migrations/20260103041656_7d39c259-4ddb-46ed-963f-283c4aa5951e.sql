-- Create call_ice_candidates table for fast, reliable ICE candidate exchange
CREATE TABLE public.call_ice_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.active_calls(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('caller', 'callee')),
  candidate JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.call_ice_candidates ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only see/insert candidates for calls they're part of
CREATE POLICY "Users can view candidates for their calls"
ON public.call_ice_candidates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.active_calls ac
    WHERE ac.id = call_id
    AND (ac.caller_id = auth.uid() OR ac.callee_id = auth.uid())
  )
);

CREATE POLICY "Callers can insert caller candidates"
ON public.call_ice_candidates
FOR INSERT
WITH CHECK (
  sender = 'caller' AND EXISTS (
    SELECT 1 FROM public.active_calls ac
    WHERE ac.id = call_id AND ac.caller_id = auth.uid()
  )
);

CREATE POLICY "Callees can insert callee candidates"
ON public.call_ice_candidates
FOR INSERT
WITH CHECK (
  sender = 'callee' AND EXISTS (
    SELECT 1 FROM public.active_calls ac
    WHERE ac.id = call_id AND ac.callee_id = auth.uid()
  )
);

-- Enable realtime for instant candidate delivery
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_ice_candidates;