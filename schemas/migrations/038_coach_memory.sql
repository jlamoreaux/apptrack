-- Coach memory: one row per user holding the running transcript and a short
-- model-written summary so the coach can pick up where the user left off.
CREATE TABLE IF NOT EXISTS public.coach_memory (
  user_id uuid NOT NULL,
  summary text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT coach_memory_pkey PRIMARY KEY (user_id),
  CONSTRAINT coach_memory_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE
);

ALTER TABLE public.coach_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coach memory"
  ON public.coach_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coach memory"
  ON public.coach_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coach memory"
  ON public.coach_memory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own coach memory"
  ON public.coach_memory FOR DELETE
  USING (auth.uid() = user_id);
