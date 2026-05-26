-- Drop the overly permissive public profiles policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Create new policy requiring authentication to view profiles
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);