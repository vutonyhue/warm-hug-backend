-- Add law_of_light_accepted_at column if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS law_of_light_accepted_at TIMESTAMPTZ;