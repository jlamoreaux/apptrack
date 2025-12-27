-- Create table to track promo code usage
CREATE TABLE IF NOT EXISTS promo_code_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    type TEXT CHECK (type IN ('discount', 'free_forever', 'trial')),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_promo_code_usage_user_id ON promo_code_usage(user_id);
CREATE INDEX idx_promo_code_usage_code ON promo_code_usage(code);
CREATE INDEX idx_promo_code_usage_applied_at ON promo_code_usage(applied_at);

-- Add RLS
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own promo code usage
CREATE POLICY "Users can view own promo code usage"
    ON promo_code_usage FOR SELECT
    USING (auth.uid() = user_id);

-- Only the system can insert promo code usage (via service role)
CREATE POLICY "Service role can insert promo code usage"
    ON promo_code_usage FOR INSERT
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Comment on table
COMMENT ON TABLE promo_code_usage IS 'Tracks when users apply promo codes';
COMMENT ON COLUMN promo_code_usage.type IS 'Type of promo code: discount (Stripe coupon), free_forever (cancels subscription), trial (extends trial)';