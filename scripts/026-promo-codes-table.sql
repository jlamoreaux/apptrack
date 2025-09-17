-- Table to manage promo codes dynamically
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  trial_days integer NOT NULL DEFAULT 90,
  plan_name text NOT NULL DEFAULT 'AI Coach',
  max_uses integer, -- NULL = unlimited
  used_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid, -- Admin who created it
  PRIMARY KEY (id),
  CONSTRAINT promo_codes_plan_check CHECK (
    plan_name IN ('Free', 'Pro', 'AI Coach')
  )
);

-- Index for fast code lookups
CREATE INDEX idx_promo_codes_code ON public.promo_codes(code) 
WHERE active = true;

-- Index for admin management
CREATE INDEX idx_promo_codes_active ON public.promo_codes(active, expires_at);

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at_promo_codes 
BEFORE UPDATE ON promo_codes 
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Insert initial promo codes
INSERT INTO public.promo_codes (code, description, trial_days, plan_name, max_uses) VALUES
('AICOACH90', '90-day AI Coach trial for beta testers', 90, 'AI Coach', 100),
('BETA2024', '2024 Beta program - 90 days free AI Coach', 90, 'AI Coach', 50),
('LAUNCH2024', 'Launch special - 90 days AI Coach', 90, 'AI Coach', NULL)
ON CONFLICT (code) DO NOTHING; -- Don't overwrite if already exists