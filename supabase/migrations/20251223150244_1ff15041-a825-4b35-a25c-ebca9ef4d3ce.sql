-- Remove unique constraint on username (usernames don't need to be unique)
ALTER TABLE public.profiles DROP CONSTRAINT profiles_username_key;