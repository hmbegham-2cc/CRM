-- ============================================================
-- CRC Reporting — Supabase Migration (idempotent)
-- Run this in the Supabase SQL Editor, then run admin_seed.sql
-- Safe to re-run.
-- ============================================================

-- 0. Required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Schema migration: drop legacy auth columns, switch IDs to UUID
-- ============================================================

-- Add `active` column to Campaign table
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT TRUE;

-- Drop password / setupToken (Supabase Auth replaces them)
ALTER TABLE public."User" DROP COLUMN IF EXISTS "password";
ALTER TABLE public."User" DROP COLUMN IF EXISTS "setupToken";

-- Add `active` boolean and `createdAt` timestamp.
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Soft-delete column. When set, the user is treated as removed by the UI but
-- the row still exists so historical data (DailyReport rows, audit trails)
-- keeps working. We anonymize name/email on soft-delete so the only thing
-- left is "the user that authored these reports, no longer with us".
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS "idx_User_deletedAt" ON public."User"("deletedAt");

-- Remove the legacy seed admin (by email so it works at any state)
DELETE FROM public."User" WHERE email = 'admin@2cconseil.com';

-- Switch User.id and dependent FKs from TEXT to UUID (idempotent, transactional)
-- Order matters: drop FKs → convert all columns → recreate FKs.
DO $$
DECLARE v_type text;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'id';

  IF v_type = 'text' THEN
    -- 1. Drop FK constraints depending on User.id
    ALTER TABLE public."CampaignMember" DROP CONSTRAINT IF EXISTS "CampaignMember_userId_fkey";
    ALTER TABLE public."DailyReport"    DROP CONSTRAINT IF EXISTS "DailyReport_userId_fkey";
    ALTER TABLE public."DailyReport"    DROP CONSTRAINT IF EXISTS "DailyReport_validatedById_fkey";
    ALTER TABLE public."Notification"   DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";

    -- 2. Convert primary key column
    ALTER TABLE public."User" ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE public."User" ALTER COLUMN id TYPE uuid USING id::uuid;
    ALTER TABLE public."User" ALTER COLUMN id SET DEFAULT gen_random_uuid();

    -- 3. Convert dependent FK columns
    ALTER TABLE public."CampaignMember" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;
    ALTER TABLE public."DailyReport"    ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;
    ALTER TABLE public."DailyReport"    ALTER COLUMN "validatedById" TYPE uuid
      USING CASE WHEN "validatedById" IS NOT NULL THEN "validatedById"::uuid END;
    ALTER TABLE public."Notification"   ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;

    -- 4. Recreate FK constraints (matches Prisma schema cascade rules)
    ALTER TABLE public."CampaignMember"
      ADD CONSTRAINT "CampaignMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES public."User"(id)
      ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE public."DailyReport"
      ADD CONSTRAINT "DailyReport_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES public."User"(id)
      ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE public."DailyReport"
      ADD CONSTRAINT "DailyReport_validatedById_fkey"
      FOREIGN KEY ("validatedById") REFERENCES public."User"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;

    ALTER TABLE public."Notification"
      ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES public."User"(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 2. Helper function: current user's role
--    SECURITY DEFINER bypasses RLS to avoid recursion on "User"
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public."Role"
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public."User" WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- ============================================================
-- 3. FK public."User".id → auth.users.id (soft-delete friendly)
--
-- Historically this constraint was ON DELETE CASCADE, which meant deleting
-- the auth.users row also nuked public."User" and (via further CASCADEs)
-- every DailyReport / Notification / CampaignMember they ever owned.
-- That's not what we want: when an admin "deletes" a user we still need
-- their reports to count in dashboards / exports.
--
-- We now drop the CASCADE entirely. Soft-delete logic in the
-- admin-user-action Edge function:
--   1. anonymizes name/email + sets deletedAt on public."User"
--   2. deletes from auth.users so they can't log in anymore
-- The public."User" row therefore survives auth deletion, keeping FK
-- targets alive for every historical report.
-- ============================================================
ALTER TABLE public."User" DROP CONSTRAINT IF EXISTS "User_id_fkey";

-- ============================================================
-- 4. Enable RLS on all tables
-- ============================================================
ALTER TABLE public."User"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Campaign"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CampaignMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DailyReport"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notification"   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4b. Grant permissions and policy for supabase_auth_admin
-- GoTrue (Supabase Auth) reads public.User during login flows.
-- Without these grants/policies, login fails with
-- "Database error querying schema" (HTTP 500).
-- ============================================================
GRANT USAGE ON SCHEMA public        TO supabase_auth_admin;
GRANT USAGE ON TYPE  public."Role"  TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."User" TO supabase_auth_admin;

DROP POLICY IF EXISTS "Auth admin full access on users" ON public."User";
CREATE POLICY "Auth admin full access on users"
  ON public."User" FOR ALL
  TO supabase_auth_admin
  USING (true) WITH CHECK (true);

-- ============================================================
-- 4. RLS Policies — User
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read users" ON public."User";
CREATE POLICY "Authenticated users can read users"
  ON public."User" FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can update users" ON public."User";
CREATE POLICY "Admins can update users"
  ON public."User" FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Admins can insert users" ON public."User";
CREATE POLICY "Admins can insert users"
  ON public."User" FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Service role full access on users" ON public."User";
CREATE POLICY "Service role full access on users"
  ON public."User" FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 5. RLS Policies — Campaign
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read campaigns" ON public."Campaign";
CREATE POLICY "Authenticated users can read campaigns"
  ON public."Campaign" FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and Superviseurs can create campaigns" ON public."Campaign";
CREATE POLICY "Admins and Superviseurs can create campaigns"
  ON public."Campaign" FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('ADMIN','SUPERVISEUR'));

DROP POLICY IF EXISTS "Admins and Superviseurs can update campaigns" ON public."Campaign";
CREATE POLICY "Admins and Superviseurs can update campaigns"
  ON public."Campaign" FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('ADMIN','SUPERVISEUR'));

DROP POLICY IF EXISTS "Admins can delete campaigns" ON public."Campaign";
CREATE POLICY "Admins can delete campaigns"
  ON public."Campaign" FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'ADMIN');

-- ============================================================
-- 6. RLS Policies — CampaignMember
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read campaign members" ON public."CampaignMember";
CREATE POLICY "Authenticated users can read campaign members"
  ON public."CampaignMember" FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and Superviseurs can insert campaign members" ON public."CampaignMember";
CREATE POLICY "Admins and Superviseurs can insert campaign members"
  ON public."CampaignMember" FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('ADMIN','SUPERVISEUR'));

DROP POLICY IF EXISTS "Admins and Superviseurs can update campaign members" ON public."CampaignMember";
CREATE POLICY "Admins and Superviseurs can update campaign members"
  ON public."CampaignMember" FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('ADMIN','SUPERVISEUR'));

DROP POLICY IF EXISTS "Admins and Superviseurs can delete campaign members" ON public."CampaignMember";
CREATE POLICY "Admins and Superviseurs can delete campaign members"
  ON public."CampaignMember" FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('ADMIN','SUPERVISEUR'));

-- ============================================================
-- 7. RLS Policies — DailyReport
-- ============================================================
DROP POLICY IF EXISTS "Users can read reports based on role" ON public."DailyReport";
CREATE POLICY "Users can read reports based on role"
  ON public."DailyReport" FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN'
    OR "userId" = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public."CampaignMember" cm
      WHERE cm."userId" = auth.uid()
        AND cm."endDate" IS NULL
        AND cm."campaignId" = public."DailyReport"."campaignId"
    )
  );

DROP POLICY IF EXISTS "Users can create own reports" ON public."DailyReport";
CREATE POLICY "Users can create own reports"
  ON public."DailyReport" FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'ADMIN'
    OR (
      "userId" = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public."CampaignMember" cm
        WHERE cm."userId" = auth.uid()
          AND cm."campaignId" = public."DailyReport"."campaignId"
          AND cm."endDate" IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "Users can update reports" ON public."DailyReport";
CREATE POLICY "Users can update reports"
  ON public."DailyReport" FOR UPDATE
  TO authenticated
  USING (
    "userId" = auth.uid()
    OR (
      public.current_user_role() IN ('ADMIN','SUPERVISEUR')
      AND EXISTS (
        SELECT 1 FROM public."CampaignMember" cm
        WHERE cm."userId" = auth.uid()
          AND cm."endDate" IS NULL
          AND cm."campaignId" = public."DailyReport"."campaignId"
      )
    )
  );

-- ============================================================
-- 8. RLS Policies — Notification
-- ============================================================
DROP POLICY IF EXISTS "Users can read own notifications" ON public."Notification";
CREATE POLICY "Users can read own notifications"
  ON public."Notification" FOR SELECT
  TO authenticated
  USING ("userId" = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public."Notification";
CREATE POLICY "Users can update own notifications"
  ON public."Notification" FOR UPDATE
  TO authenticated
  USING ("userId" = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public."Notification";
CREATE POLICY "Users can delete own notifications"
  ON public."Notification" FOR DELETE
  TO authenticated
  USING ("userId" = auth.uid());

DROP POLICY IF EXISTS "Service role can insert notifications" ON public."Notification";
CREATE POLICY "Service role can insert notifications"
  ON public."Notification" FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- 9. Trigger: auto-create User row when new auth user signs up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role public."Role" := 'TELECONSEILLER'::public."Role";
  v_meta text;
BEGIN
  -- Role may live in user_metadata (invite flow) OR app_metadata (dashboard / API)
  v_meta := NULLIF(trim(NEW.raw_user_meta_data->>'role'), '');
  IF v_meta IN ('TELECONSEILLER', 'SUPERVISEUR', 'ADMIN') THEN
    v_role := v_meta::public."Role";
  ELSE
    v_meta := NULLIF(trim(NEW.raw_app_meta_data->>'role'), '');
    IF v_meta IN ('TELECONSEILLER', 'SUPERVISEUR', 'ADMIN') THEN
      v_role := v_meta::public."Role";
    END IF;
  END IF;

  INSERT INTO public."User" (id, email, name, role, "createdAt", "updatedAt")
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)),
    v_role,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP FUNCTION IF EXISTS public.ensure_user_row();

-- ============================================================
-- 9b. RPC: repair missing public."User" row (auth OK, profile absent)
--
-- Some projects never ran the auth trigger, or invite flow only UPDATEd
-- a row that did not exist yet — leaving auth.users without public."User".
-- The app then logs in (token OK) but fetchProfile returns nothing.
-- This function inserts the missing row from auth.users + user_metadata.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_user_row()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  aid uuid := auth.uid();
  u record;
  v_role public."Role";
  v_meta text;
BEGIN
  IF aid IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public."User" WHERE id = aid) THEN
    RETURN;
  END IF;

  SELECT id, email, raw_user_meta_data, raw_app_meta_data
    INTO u
    FROM auth.users
   WHERE id = aid;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_role := 'TELECONSEILLER'::public."Role";
  v_meta := NULLIF(trim(u.raw_user_meta_data->>'role'), '');
  IF v_meta IN ('TELECONSEILLER', 'SUPERVISEUR', 'ADMIN') THEN
    v_role := v_meta::public."Role";
  ELSE
    v_meta := NULLIF(trim(u.raw_app_meta_data->>'role'), '');
    IF v_meta IN ('TELECONSEILLER', 'SUPERVISEUR', 'ADMIN') THEN
      v_role := v_meta::public."Role";
    END IF;
  END IF;

  INSERT INTO public."User" (id, email, name, role, "createdAt", "updatedAt", active, "deletedAt")
  VALUES (
    u.id,
    u.email,
    COALESCE(NULLIF(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1)),
    v_role,
    now(),
    now(),
    true,
    null
  );
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_row() TO authenticated;

-- ============================================================
-- 9c. RPC: upgrade public."User".role from auth metadata (one-way)
--
-- Fixes accounts where public."User" was created with default TELECONSEILLER
-- but raw_user_meta_data / raw_app_meta_data on auth.users still carries
-- ADMIN or SUPERVISEUR (common after ensure_user_row() or a failed trigger).
-- Only *promotes* role (never demotes) so normal admin demotions stay in DB.
-- ============================================================
DROP FUNCTION IF EXISTS public.sync_my_role_from_auth();

CREATE OR REPLACE FUNCTION public.sync_my_role_from_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  aid uuid := auth.uid();
  au record;
  v_meta text;
  v_meta_role public."Role";
  cur_role public."Role";
  r_meta int;
  r_cur int;
BEGIN
  IF aid IS NULL THEN
    RETURN;
  END IF;

  SELECT role INTO cur_role FROM public."User" WHERE id = aid;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT raw_user_meta_data, raw_app_meta_data INTO au FROM auth.users WHERE id = aid;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_meta := NULLIF(trim(au.raw_user_meta_data->>'role'), '');
  IF v_meta NOT IN ('TELECONSEILLER', 'SUPERVISEUR', 'ADMIN') THEN
    v_meta := NULLIF(trim(au.raw_app_meta_data->>'role'), '');
  END IF;
  IF v_meta NOT IN ('TELECONSEILLER', 'SUPERVISEUR', 'ADMIN') THEN
    RETURN;
  END IF;

  v_meta_role := v_meta::public."Role";
  r_meta := CASE v_meta_role WHEN 'ADMIN' THEN 3 WHEN 'SUPERVISEUR' THEN 2 ELSE 1 END;
  r_cur  := CASE cur_role WHEN 'ADMIN' THEN 3 WHEN 'SUPERVISEUR' THEN 2 ELSE 1 END;

  IF r_meta > r_cur THEN
    UPDATE public."User" SET role = v_meta_role, "updatedAt" = now() WHERE id = aid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_my_role_from_auth() TO authenticated;

-- ============================================================
-- 10. RPC: validate or reject a report + create notification
-- ============================================================
DROP FUNCTION IF EXISTS public.action_report(TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.action_report(
  p_report_id  TEXT,
  p_action     TEXT,            -- 'validate' or 'reject'
  p_validator_id UUID,
  p_reason     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report public."DailyReport"%ROWTYPE;
  v_status public."DailyReportStatus";
BEGIN
  SELECT * INTO v_report FROM public."DailyReport" WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Rapport introuvable');
  END IF;

  IF    p_action = 'validate' THEN v_status := 'VALIDATED';
  ELSIF p_action = 'reject'   THEN v_status := 'REJECTED';
  ELSE  RETURN jsonb_build_object('error', 'Action invalide');
  END IF;

  UPDATE public."DailyReport"
     SET status            = v_status,
         "validatedAt"     = now(),
         "validatedById"   = p_validator_id,
         "rejectionReason" = p_reason
   WHERE id = p_report_id;

  IF p_action = 'validate' THEN
    INSERT INTO public."Notification" ("userId", title, message, type)
    VALUES (
      v_report."userId",
      'Rapport validé',
      'Votre rapport du ' || to_char(v_report.date, 'DD/MM/YYYY') || ' a été validé.',
      'success'
    );
  ELSE
    INSERT INTO public."Notification" ("userId", title, message, type)
    VALUES (
      v_report."userId",
      'Rapport rejeté',
      'Votre rapport du ' || to_char(v_report.date, 'DD/MM/YYYY') || ' a été rejeté.' ||
        CASE WHEN p_reason IS NOT NULL THEN ' Raison : ' || p_reason ELSE '' END ||
        ' Merci de le corriger et le resoumettre.',
      'error'
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- 11. RPC: submit a report (owner only) — with input validation
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_report(p_report_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report public."DailyReport"%ROWTYPE;
BEGIN
  SELECT * INTO v_report
  FROM public."DailyReport"
  WHERE id = p_report_id AND "userId" = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Rapport introuvable ou action non autorisée');
  END IF;

  -- Sanity checks: numbers must be >= 0. The UI may allow entering a report
  -- ahead of time for planning/backfill workflows, so we do not reject future
  -- dates here.
  IF v_report."incomingTotal" < 0
     OR v_report."outgoingTotal" < 0
     OR v_report."handled" < 0
     OR v_report."missed" < 0
     OR v_report."rdvTotal" < 0
     OR v_report."smsTotal" < 0 THEN
    RETURN jsonb_build_object('error', 'Les valeurs ne peuvent pas être négatives');
  END IF;

  -- Forbid resubmitting an already validated report
  IF v_report.status = 'VALIDATED' THEN
    RETURN jsonb_build_object('error', 'Ce rapport est déjà validé');
  END IF;

  UPDATE public."DailyReport"
     SET status        = 'SUBMITTED',
         "submittedAt" = now()
   WHERE id = p_report_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- 11b. RPC: set user active flag (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_user_active(p_user_id UUID, p_active BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_count INT;
BEGIN
  IF public.current_user_role() <> 'ADMIN' THEN
    RETURN jsonb_build_object('error', 'Accès refusé : admin uniquement');
  END IF;

  -- Don't allow disabling the last admin
  IF p_active = FALSE THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM public."User"
    WHERE role = 'ADMIN' AND "active" = TRUE AND id <> p_user_id;
    IF v_admin_count = 0 AND (
      SELECT role FROM public."User" WHERE id = p_user_id
    ) = 'ADMIN' THEN
      RETURN jsonb_build_object('error', 'Impossible de désactiver le dernier administrateur');
    END IF;
  END IF;

  UPDATE public."User" SET "active" = p_active WHERE id = p_user_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_user_active(UUID, BOOLEAN) TO authenticated;

-- ============================================================
-- 12. RPC: assign team to campaign
-- ============================================================
-- Ensure CampaignMember.id is auto-generated when omitted by inserts/RPCs
ALTER TABLE public."CampaignMember"
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

DROP FUNCTION IF EXISTS public.assign_team(TEXT, TEXT[]);
CREATE OR REPLACE FUNCTION public.assign_team(p_campaign_id TEXT, p_user_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public."CampaignMember"
     SET "endDate" = now()
   WHERE "campaignId" = p_campaign_id
     AND "endDate" IS NULL;

  IF p_user_ids IS NOT NULL AND array_length(p_user_ids, 1) IS NOT NULL THEN
    INSERT INTO public."CampaignMember" (id, "campaignId", "userId")
    SELECT gen_random_uuid(), p_campaign_id, unnest(p_user_ids);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- 13. RPC: check missing reports (used by pg_cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_missing_reports(p_date DATE DEFAULT (CURRENT_DATE - 1))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_created   INT := 0;
  v_member    RECORD;
  v_msg       TEXT;
  v_day_start TIMESTAMPTZ;
  v_day_end   TIMESTAMPTZ;
BEGIN
  v_day_start := p_date::timestamptz;
  v_day_end   := (p_date + 1)::timestamptz;

  FOR v_member IN
    SELECT cm."userId", cm."campaignId",
           u.email, u.name, u.role,
           c.name AS campaign_name
      FROM public."CampaignMember" cm
      JOIN public."User"     u ON u.id = cm."userId"
      JOIN public."Campaign" c ON c.id = cm."campaignId"
     WHERE cm."startDate" <= v_day_start
       AND (cm."endDate" IS NULL OR cm."endDate" >= v_day_start)
  LOOP
    IF v_member.role = 'ADMIN' THEN CONTINUE; END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public."DailyReport"
       WHERE "userId"     = v_member."userId"
         AND "campaignId" = v_member."campaignId"
         AND date >= v_day_start AND date < v_day_end
         AND status IN ('SUBMITTED','VALIDATED')
    ) THEN
      v_msg := 'Votre rapport du ' || to_char(p_date, 'DD/MM/YYYY')
            || ' pour la campagne ' || v_member.campaign_name
            || ' n''a pas été soumis. Merci de le compléter.';

      IF NOT EXISTS (
        SELECT 1
          FROM public."Notification"
         WHERE "userId"    = v_member."userId"
           AND title       = 'Rapport manquant'
           AND message     = v_msg
           AND "createdAt" >= v_day_start
      ) THEN
        INSERT INTO public."Notification" ("userId", title, message, type)
        VALUES (v_member."userId", 'Rapport manquant', v_msg, 'warning');
        v_created := v_created + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'date', p_date, 'created', v_created);
END;
$$;

-- ============================================================
-- 14. Grants on RPC functions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.action_report(TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_report(TEXT)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_team(TEXT, UUID[])             TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_missing_reports(DATE)           TO authenticated, service_role;

-- ============================================================
-- 15. Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS "idx_User_email" ON public."User"("email");
CREATE INDEX IF NOT EXISTS "idx_CampaignMember_userId" ON public."CampaignMember"("userId");
CREATE INDEX IF NOT EXISTS "idx_CampaignMember_campaignId" ON public."CampaignMember"("campaignId");
CREATE INDEX IF NOT EXISTS "idx_DailyReport_userId" ON public."DailyReport"("userId");
CREATE INDEX IF NOT EXISTS "idx_DailyReport_campaignId" ON public."DailyReport"("campaignId");
CREATE INDEX IF NOT EXISTS "idx_DailyReport_date" ON public."DailyReport"("date");
CREATE INDEX IF NOT EXISTS "idx_Notification_userId" ON public."Notification"("userId");
CREATE INDEX IF NOT EXISTS "idx_Notification_createdAt" ON public."Notification"("createdAt");

-- ============================================================
-- 16. (Optional) pg_cron scheduling
-- Enable pg_cron in Dashboard → Database → Extensions, then run:
--
-- SELECT cron.schedule(
--   'check-missing-reports',
--   '0 8 * * *',
--   $$SELECT public.check_missing_reports();$$
-- );
-- ============================================================
