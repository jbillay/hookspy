-- Seed admin user
-- Promote the first registered user to admin role
-- This uses a configurable email; update the value below for your deployment

DO $$
DECLARE
  admin_email text := 'jbillay@gmail.com';
  admin_user_id uuid;
BEGIN
  -- Find the user by email in profiles
  SELECT id INTO admin_user_id
  FROM public.profiles
  WHERE email = admin_email;

  IF admin_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'admin', plan = 'pro'
    WHERE id = admin_user_id;
    RAISE NOTICE 'Admin role assigned to user: %', admin_email;
  ELSE
    RAISE NOTICE 'User with email % not found in profiles. Create the account first, then manually run: UPDATE public.profiles SET role = ''admin'' WHERE email = ''%'';', admin_email, admin_email;
  END IF;
END $$;
