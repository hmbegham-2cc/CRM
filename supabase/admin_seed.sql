-- ============================================================
-- CRC Reporting — Admin seed
-- Run this AFTER migration.sql, in the Supabase SQL Editor.
-- Creates the initial admin in Supabase Auth.
-- The on_auth_user_created trigger will populate public."User".
-- Idempotent: safe to re-run.
-- ============================================================

DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Insert into auth.users only if it does not exist yet
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@2cconseil.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@2cconseil.com',
      crypt('admin@2cconseil.com', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Admin CRC","role":"ADMIN"}'::jsonb
    )
    RETURNING id INTO v_admin_id;
  END IF;

  -- Make sure the public."User" row has the correct name and role,
  -- in case the trigger ran with default values for any reason.
  UPDATE public."User"
     SET role = 'ADMIN',
         name = 'Admin CRC'
   WHERE email = 'admin@2cconseil.com';
END $$;

-- Verification (optional — uncomment to view results)
-- SELECT id, email, raw_user_meta_data FROM auth.users   WHERE email = 'admin@2cconseil.com';
-- SELECT id, email, name, role         FROM public."User" WHERE email = 'admin@2cconseil.com';
