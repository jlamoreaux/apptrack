-- Create cover_letters table to store generated cover letters
CREATE TABLE IF NOT EXISTS public.cover_letters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  application_id uuid,
  company_name text,
  role_name text,
  job_description text NOT NULL,
  cover_letter text NOT NULL,
  tone text DEFAULT 'professional',
  additional_info text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Primary key
  CONSTRAINT cover_letters_pkey PRIMARY KEY (id),
  
  -- Foreign keys
  CONSTRAINT cover_letters_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT cover_letters_application_id_fkey FOREIGN KEY (application_id) 
    REFERENCES public.applications (id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cover_letters_user_id 
  ON public.cover_letters USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_cover_letters_application_id 
  ON public.cover_letters USING btree (application_id);

CREATE INDEX IF NOT EXISTS idx_cover_letters_created_at 
  ON public.cover_letters USING btree (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own cover letters" 
  ON public.cover_letters FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cover letters" 
  ON public.cover_letters FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cover letters" 
  ON public.cover_letters FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cover letters" 
  ON public.cover_letters FOR DELETE 
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at 
  BEFORE UPDATE ON public.cover_letters 
  FOR EACH ROW 
  EXECUTE FUNCTION handle_updated_at();