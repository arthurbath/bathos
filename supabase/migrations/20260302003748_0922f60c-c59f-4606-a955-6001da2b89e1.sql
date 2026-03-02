
-- Table to track auth rate limits by IP address (for unauthenticated users)
CREATE TABLE public.bathos_auth_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  action_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX idx_bathos_auth_rate_limits_lookup
  ON public.bathos_auth_rate_limits (ip_address, action_type, created_at DESC);

-- RLS enabled with NO policies = no direct client access
-- Edge functions use service role which bypasses RLS
ALTER TABLE public.bathos_auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Cleanup function to remove old records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_bathos_auth_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.bathos_auth_rate_limits
  WHERE created_at < now() - interval '1 hour';
END;
$$;
