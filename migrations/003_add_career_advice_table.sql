-- Create career_advice table to store AI coaching conversations
CREATE TABLE IF NOT EXISTS public.career_advice (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_user boolean NOT NULL DEFAULT true,
  conversation_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  
  -- Primary key
  CONSTRAINT career_advice_pkey PRIMARY KEY (id),
  
  -- Foreign keys
  CONSTRAINT career_advice_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_career_advice_user_id 
  ON public.career_advice USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_career_advice_conversation_id 
  ON public.career_advice USING btree (conversation_id);

CREATE INDEX IF NOT EXISTS idx_career_advice_created_at 
  ON public.career_advice USING btree (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.career_advice ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own career advice messages" 
  ON public.career_advice FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own career advice messages" 
  ON public.career_advice FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own career advice messages" 
  ON public.career_advice FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own career advice messages" 
  ON public.career_advice FOR DELETE 
  USING (auth.uid() = user_id);