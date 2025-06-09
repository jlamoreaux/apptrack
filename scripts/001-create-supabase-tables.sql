-- Enable Row Level Security
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.linkedin_profiles ENABLE ROW LEVEL SECURITY;

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create applications table
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    role_link TEXT,
    date_applied DATE NOT NULL,
    status TEXT DEFAULT 'Applied' CHECK (status IN ('Applied', 'Interview Scheduled', 'Interviewed', 'Offer', 'Rejected')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create linkedin_profiles table
CREATE TABLE IF NOT EXISTS public.linkedin_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
    profile_url TEXT NOT NULL,
    name TEXT,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_date_applied ON public.applications(date_applied);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_application_id ON public.linkedin_profiles(application_id);

-- Row Level Security Policies

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Applications policies
CREATE POLICY "Users can view own applications" ON public.applications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications" ON public.applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications" ON public.applications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own applications" ON public.applications
    FOR DELETE USING (auth.uid() = user_id);

-- LinkedIn profiles policies
CREATE POLICY "Users can view linkedin profiles for own applications" ON public.linkedin_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.applications 
            WHERE applications.id = linkedin_profiles.application_id 
            AND applications.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert linkedin profiles for own applications" ON public.linkedin_profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.applications 
            WHERE applications.id = linkedin_profiles.application_id 
            AND applications.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update linkedin profiles for own applications" ON public.linkedin_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.applications 
            WHERE applications.id = linkedin_profiles.application_id 
            AND applications.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete linkedin profiles for own applications" ON public.linkedin_profiles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.applications 
            WHERE applications.id = linkedin_profiles.application_id 
            AND applications.user_id = auth.uid()
        )
    );
