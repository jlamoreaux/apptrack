-- Create user_resumes table
CREATE TABLE IF NOT EXISTS public.user_resumes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    extracted_text TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Only allow one resume per user (latest upload replaces previous)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_resumes_user_id ON public.user_resumes(user_id);

-- Enable RLS
ALTER TABLE public.user_resumes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own resume" ON public.user_resumes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resume" ON public.user_resumes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resume" ON public.user_resumes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resume" ON public.user_resumes
    FOR DELETE USING (auth.uid() = user_id); 