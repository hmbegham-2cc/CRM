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

-- Drop password / setupToken (Supabase Auth replaces them)
ALTER TABLE public."User" DROP COLUMN IF EXISTS "password";
ALTER TABLE public."User" DROP COLUMN IF EXISTS "setupToken";

-- Add `active` boolean: lets admins disable accounts without losing history.
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT TRUE;

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
-- 3. FK public."User".id → auth.users.id ON DELETE CASCADE
-- Ensures public.User stays in sync when an auth user is deleted.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_id_fkey' AND conrelid = 'public."User"'::regclass
  ) THEN
    ALTER TABLE public."User"
      ADD CONSTRAINT "User_id_fkey"
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

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
BEGIN
  INSERT INTO public."User" (id, email, name, role, "updatedAt")
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public."Role", 'TELECONSEILLER'),
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

  -- Sanity checks: numbers must be >= 0 and date can't be in the future
  IF v_report."incomingTotal" < 0
     OR v_report."outgoingTotal" < 0
     OR v_report."handled" < 0
     OR v_report."missed" < 0
     OR v_report."rdvTotal" < 0
     OR v_report."smsTotal" < 0 THEN
    RETURN jsonb_build_object('error', 'Les valeurs ne peuvent pas être négatives');
  END IF;

  IF v_report.date > CURRENT_DATE THEN
    RETURN jsonb_build_object('error', 'La date du rapport ne peut pas être dans le futur');
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
    INSERT INTO public."CampaignMember" ("campaignId", "userId")
    SELECT p_campaign_id, unnest(p_user_ids);
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
-- 15. (Optional) pg_cron scheduling
-- Enable pg_cron in Dashboard → Database → Extensions, then run:
--
-- SELECT cron.schedule(
--   'check-missing-reports',
--   '0 8 * * *',
--   $$SELECT public.check_missing_reports();$$
-- );
-- ============================================================
