-- Grant admin role to QA user account
INSERT INTO public.bathos_user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'art+qa1@bath.garden'
ON CONFLICT (user_id, role) DO NOTHING;
