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
-- This uses a CTE to create conversations and immediately update messages in a single transaction
DO $$
DECLARE
  user_record RECORD;
  new_conv_id uuid;
BEGIN
  -- Loop through each user who has messages without a conversation_id
  FOR user_record IN
    SELECT DISTINCT user_id, MIN(created_at) as first_msg, MAX(created_at) as last_msg
    FROM public.career_advice
    WHERE conversation_id IS NULL
    GROUP BY user_id
  LOOP
    -- Create a legacy conversation for this user
    INSERT INTO public.conversations (user_id, title, created_at, updated_at)
    VALUES (user_record.user_id, 'Previous Conversation', user_record.first_msg, user_record.last_msg)
    RETURNING id INTO new_conv_id;

    -- Update all their orphaned messages to reference the new conversation
    UPDATE public.career_advice
    SET conversation_id = new_conv_id
    WHERE user_id = user_record.user_id
      AND conversation_id IS NULL;
  END LOOP;
END $$;

-- Add foreign key constraint now that data is migrated
-- Use IF NOT EXISTS pattern to make migration idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'career_advice_conversation_id_fkey'
  ) THEN
    ALTER TABLE public.career_advice
      ADD CONSTRAINT career_advice_conversation_id_fkey
      FOREIGN KEY (conversation_id)
      REFERENCES public.conversations (id) ON DELETE CASCADE;
  END IF;
END $$;
