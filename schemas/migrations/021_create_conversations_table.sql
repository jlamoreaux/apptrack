-- Create conversations table for AI coach chat sessions
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  -- Primary key
  CONSTRAINT conversations_pkey PRIMARY KEY (id),

  -- Foreign keys
  CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON public.conversations USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
  ON public.conversations USING btree (updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Migrate existing career_advice messages to a legacy conversation per user
-- This creates one conversation per user who has existing messages
INSERT INTO public.conversations (id, user_id, title, created_at, updated_at)
SELECT DISTINCT
  gen_random_uuid() as id,
  user_id,
  'Previous Conversation' as title,
  MIN(created_at) as created_at,
  MAX(created_at) as updated_at
FROM public.career_advice
WHERE conversation_id IS NULL
GROUP BY user_id;

-- Update existing career_advice messages to reference their legacy conversation
UPDATE public.career_advice ca
SET conversation_id = c.id
FROM public.conversations c
WHERE ca.user_id = c.user_id
  AND ca.conversation_id IS NULL
  AND c.title = 'Previous Conversation';

-- Add foreign key constraint now that data is migrated
-- Note: conversation_id remains nullable to allow for edge cases
ALTER TABLE public.career_advice
  ADD CONSTRAINT career_advice_conversation_id_fkey
  FOREIGN KEY (conversation_id)
  REFERENCES public.conversations (id) ON DELETE CASCADE;
