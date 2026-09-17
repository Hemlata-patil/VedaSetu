-- ==============================================================================
-- AYUSH CONNECT: Real E2E Test Accounts Setup (Fixed Schema Scanner Requirements)
-- Run this script in the Supabase SQL Editor
--
-- Password for all 4 test accounts: TestPassword123!
-- ==============================================================================

-- 1. Clean up existing test users if re-running
DELETE FROM auth.users WHERE email IN (
  'student.test@ayush.local',
  'faculty.test@ayush.local',
  'institution.test@ayush.local',
  'industry.test@ayush.local'
);

-- 2. Insert Student Test User
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'student.test@ayush.local', crypt('TestPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"],"role":"student"}',
  '{"full_name":"Dr. Scholar (Student Test)"}', now(), now(),
  '', '', '', ''
);

-- 3. Insert Faculty Test User
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'faculty.test@ayush.local', crypt('TestPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"],"role":"faculty"}',
  '{"full_name":"Prof. Mentor (Faculty Test)"}', now(), now(),
  '', '', '', ''
);

-- 4. Insert Institution Test User
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'institution.test@ayush.local', crypt('TestPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"],"role":"institution"}',
  '{"full_name":"Collegiate Dean (Institution Test)"}', now(), now(),
  '', '', '', ''
);

-- 5. Insert Industry Test User
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'industry.test@ayush.local', crypt('TestPassword123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"],"role":"industry"}',
  '{"full_name":"Enterprise Director (Industry Test)"}', now(), now(),
  '', '', '', ''
);

-- 6. Ensure GoTrue non-null string scanner invariant
UPDATE auth.users
SET 
  confirmation_token = coalesce(confirmation_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  recovery_token = coalesce(recovery_token, '');

-- Verification: Check that the handle_new_user trigger correctly populated profiles
SELECT id, email, role, full_name, created_at FROM public.profiles
WHERE email IN (
  'student.test@ayush.local',
  'faculty.test@ayush.local',
  'institution.test@ayush.local',
  'industry.test@ayush.local'
);
