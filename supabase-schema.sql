-- ============================================================
--  File:    supabase-schema.sql
--  Purpose: Complete Supabase schema for Pendleton Plantation
--           community website.
--
--  HOW TO RUN:
--    1. Go to your Supabase project → SQL Editor
--    2. Paste this entire file and click "Run"
--    3. After running, go to Authentication → Users, create
--       your admin account, then run the grant-admin snippet
--       at the bottom of this file.
--
--  AFTER RUNNING:
--    Replace [YOUR-EMAIL] in the last block and run it to
--    grant yourself admin access.
-- ============================================================


-- ── EXTENSIONS ──────────────────────────────────────────────
-- pgcrypto is available by default in Supabase; no action needed.


-- ============================================================
--  TABLES
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
-- One row per authenticated user. Auto-created by trigger below.
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  role          TEXT        NOT NULL DEFAULT 'user'
                            CHECK (role IN ('user', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── config ───────────────────────────────────────────────────
-- Key-value store for organizer info and site settings.
CREATE TABLE IF NOT EXISTS config (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL DEFAULT ''
);

INSERT INTO config (key, value) VALUES
  ('organizer_name',   ''),
  ('organizer_email',  'mandyvaliquette00@gmail.com'),
  ('organizer_phone',  ''),
  ('current_event_id', '')
ON CONFLICT (key) DO NOTHING;

-- ── events ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                 TEXT        PRIMARY KEY,
  event_name         TEXT        NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'Confirmed'
                                 CHECK (status IN ('Confirmed', 'Draft', 'Cancelled')),
  event_date         DATE,
  event_time         TEXT,
  signups_open_date  DATE,
  short_description  TEXT,
  medium_description TEXT,
  long_description   TEXT,
  emoji_row          TEXT,
  headline_adjective TEXT,
  location_name      TEXT,
  location_address   TEXT,
  banner_color_class TEXT        DEFAULT 'card-color-1',
  ics_start          TEXT,
  ics_end            TEXT,
  organizer_name     TEXT,
  organizer_address  TEXT,
  organizer_phone    TEXT,
  organizer_email    TEXT,
  organizer_contact  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── event_volunteer_roles ────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_volunteer_roles (
  id              BIGSERIAL   PRIMARY KEY,
  event_id        TEXT        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role_label      TEXT        NOT NULL,
  role_detail     TEXT,
  max_volunteers  INT,
  sort_order      INT         NOT NULL DEFAULT 0
);

-- Run this migration if the table already exists:
-- ALTER TABLE event_volunteer_roles ADD COLUMN IF NOT EXISTS max_volunteers INT;

-- ── event_donation_items ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_donation_items (
  id          BIGSERIAL   PRIMARY KEY,
  event_id    TEXT        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category    TEXT        NOT NULL,
  item_label  TEXT        NOT NULL,
  qty_needed  INT,
  sort_order  INT         NOT NULL DEFAULT 0
);

-- ── signups ──────────────────────────────────────────────────
-- user_id is nullable — guest submissions have user_id = NULL.
CREATE TABLE IF NOT EXISTS signups (
  id                BIGSERIAL   PRIMARY KEY,
  event_id          TEXT        NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  user_id           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_name        TEXT        NOT NULL,
  last_name         TEXT        NOT NULL,
  email             TEXT        NOT NULL,
  phone             TEXT,
  address           TEXT,
  attending         TEXT,
  num_adults        INT         DEFAULT 0,
  num_children      INT         DEFAULT 0,
  children_0_3      INT         DEFAULT 0,
  children_4_8      INT         DEFAULT 0,
  children_9_plus   INT         DEFAULT 0,
  potluck_item      TEXT,
  other_donation    TEXT,
  cash_donation     TEXT,
  notes             TEXT,
  heard_about       TEXT,
  special_skills    TEXT,
  opt_in_events     BOOLEAN     DEFAULT FALSE,
  opt_in_newsletter BOOLEAN     DEFAULT FALSE,
  archived          BOOLEAN     DEFAULT FALSE
);

-- ── signup_volunteer_roles ───────────────────────────────────
CREATE TABLE IF NOT EXISTS signup_volunteer_roles (
  id         BIGSERIAL PRIMARY KEY,
  signup_id  BIGINT    NOT NULL REFERENCES signups(id) ON DELETE CASCADE,
  role_label TEXT      NOT NULL
);

-- ── signup_donation_items ────────────────────────────────────
CREATE TABLE IF NOT EXISTS signup_donation_items (
  id          BIGSERIAL PRIMARY KEY,
  signup_id   BIGINT    NOT NULL REFERENCES signups(id) ON DELETE CASCADE,
  item_label  TEXT      NOT NULL,
  qty_pledged INT       NOT NULL DEFAULT 1
);

-- ── announcements ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id         BIGSERIAL   PRIMARY KEY,
  day        TEXT,
  month      TEXT,
  title      TEXT        NOT NULL,
  body       TEXT,
  link       TEXT,
  link_text  TEXT,
  published  BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── links ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS links (
  id          BIGSERIAL   PRIMARY KEY,
  category    TEXT        NOT NULL,
  icon        TEXT,
  title       TEXT        NOT NULL,
  description TEXT,
  url         TEXT        NOT NULL,
  url_label   TEXT,
  sort_order  INT         DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── documents ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id          BIGSERIAL   PRIMARY KEY,
  category    TEXT        NOT NULL,
  icon        TEXT,
  title       TEXT        NOT NULL,
  description TEXT,
  url         TEXT        NOT NULL,
  url_label   TEXT,
  sort_order  INT         DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── award_contests ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS award_contests (
  id           TEXT        PRIMARY KEY,
  icon         TEXT,
  badge        TEXT,
  banner_color TEXT,
  award_name   TEXT        NOT NULL,
  category     TEXT,
  period       TEXT,
  status       TEXT        DEFAULT 'soon'
                           CHECK (status IN ('open','soon','voting','deliberating','awarded')),
  description  TEXT,
  deadline     TEXT,
  prize        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── award_nominations ────────────────────────────────────────
-- user_id nullable — guests can nominate without an account.
CREATE TABLE IF NOT EXISTS award_nominations (
  id                 BIGSERIAL   PRIMARY KEY,
  contest_id         TEXT        REFERENCES award_contests(id) ON DELETE SET NULL,
  user_id            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nominator_name     TEXT        NOT NULL,
  nominator_phone    TEXT,
  nominator_email    TEXT        NOT NULL,
  nominator_address  TEXT,
  nominee_name       TEXT        NOT NULL,
  nominee_address    TEXT,
  award_category     TEXT,
  custom_award       TEXT,
  reasons            TEXT,
  photo_urls         TEXT[],
  approved           BOOLEAN     DEFAULT FALSE
);

-- ── winners ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS winners (
  id           BIGSERIAL   PRIMARY KEY,
  contest_id   TEXT        REFERENCES award_contests(id) ON DELETE SET NULL,
  icon         TEXT,
  badge        TEXT,
  banner_color TEXT,
  award        TEXT        NOT NULL,
  period       TEXT        NOT NULL,
  year         TEXT,
  winner_name  TEXT        NOT NULL,
  photo_id     TEXT,
  prize        TEXT,
  blurb        TEXT,
  quote1       TEXT,
  quote2       TEXT,
  quote3       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── winner_prep ──────────────────────────────────────────────
-- Staging table: populated from nominations, promoted to winners.
CREATE TABLE IF NOT EXISTS winner_prep (
  id                BIGSERIAL   PRIMARY KEY,
  nomination_id     BIGINT      REFERENCES award_nominations(id) ON DELETE SET NULL,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  award             TEXT,
  winner_name       TEXT,
  blurb             TEXT,
  quote1            TEXT,
  quote2            TEXT,
  quote3            TEXT,
  full_reasons_text TEXT,
  nominator_name    TEXT,
  icon              TEXT,
  badge             TEXT,
  banner_color      TEXT,
  period            TEXT,
  year              TEXT,
  photo_id          TEXT,
  prize             TEXT,
  promoted          BOOLEAN     DEFAULT FALSE
);

-- ── memories ─────────────────────────────────────────────────
-- Photo URLs are Google Drive share URLs (uploaded via GAS).
CREATE TABLE IF NOT EXISTS memories (
  id            BIGSERIAL   PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploader_name TEXT        NOT NULL,
  email         TEXT,
  event_name    TEXT,
  caption       TEXT,
  photo_urls    TEXT[],
  approved      BOOLEAN     DEFAULT FALSE
);

-- ── bulletin_posts ───────────────────────────────────────────
-- Photo URLs are Google Drive share URLs (uploaded via GAS).
CREATE TABLE IF NOT EXISTS bulletin_posts (
  id            BIGSERIAL   PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  poster_name   TEXT        NOT NULL,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  category      TEXT        DEFAULT 'General / Community News',
  title         TEXT        NOT NULL,
  content       TEXT,
  photo_urls    TEXT[],
  show_phone    BOOLEAN     DEFAULT FALSE,
  show_email    BOOLEAN     DEFAULT FALSE,
  approved      BOOLEAN     DEFAULT FALSE
);


-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE config             ENABLE ROW LEVEL SECURITY;
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_volunteer_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_donation_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE signups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_volunteer_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_donation_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE links              ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE award_contests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE award_nominations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE winners            ENABLE ROW LEVEL SECURITY;
ALTER TABLE winner_prep        ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulletin_posts     ENABLE ROW LEVEL SECURITY;

-- ── Helper: is the current user an admin? ───────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── profiles policies ────────────────────────────────────────
CREATE POLICY "profiles: user reads own or admin reads all"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles: user updates own display_name only"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- ── config policies ──────────────────────────────────────────
CREATE POLICY "config: public reads safe keys"
  ON config FOR SELECT
  USING (key IN ('organizer_name','organizer_email','organizer_phone','current_event_id'));

CREATE POLICY "config: admin reads all"
  ON config FOR SELECT
  USING (is_admin());

CREATE POLICY "config: admin writes"
  ON config FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── events policies ──────────────────────────────────────────
CREATE POLICY "events: public read"
  ON events FOR SELECT USING (true);

CREATE POLICY "events: admin insert"
  ON events FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "events: admin update"
  ON events FOR UPDATE USING (is_admin());

CREATE POLICY "events: admin delete"
  ON events FOR DELETE USING (is_admin());

-- ── event_volunteer_roles policies ──────────────────────────
CREATE POLICY "evr: public read"
  ON event_volunteer_roles FOR SELECT USING (true);

CREATE POLICY "evr: admin write"
  ON event_volunteer_roles FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "evr: admin update"
  ON event_volunteer_roles FOR UPDATE USING (is_admin());

CREATE POLICY "evr: admin delete"
  ON event_volunteer_roles FOR DELETE USING (is_admin());

-- ── event_donation_items policies ───────────────────────────
CREATE POLICY "edi: public read"
  ON event_donation_items FOR SELECT USING (true);

CREATE POLICY "edi: admin write"
  ON event_donation_items FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "edi: admin update"
  ON event_donation_items FOR UPDATE USING (is_admin());

CREATE POLICY "edi: admin delete"
  ON event_donation_items FOR DELETE USING (is_admin());

-- ── signups policies ─────────────────────────────────────────
-- Guests and logged-in users can always insert (guest submissions).
CREATE POLICY "signups: anyone can insert"
  ON signups FOR INSERT WITH CHECK (true);

-- Logged-in users can read only their own rows.
CREATE POLICY "signups: user reads own"
  ON signups FOR SELECT USING (user_id = auth.uid());

-- Admin can read all rows (contacts included).
CREATE POLICY "signups: admin reads all"
  ON signups FOR SELECT USING (is_admin());

CREATE POLICY "signups: admin update"
  ON signups FOR UPDATE USING (is_admin());

CREATE POLICY "signups: admin delete"
  ON signups FOR DELETE USING (is_admin());

-- ── signup_volunteer_roles policies ─────────────────────────
CREATE POLICY "svr: anyone can insert"
  ON signup_volunteer_roles FOR INSERT WITH CHECK (true);

CREATE POLICY "svr: user reads own"
  ON signup_volunteer_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM signups s
      WHERE s.id = signup_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "svr: admin all"
  ON signup_volunteer_roles FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ── signup_donation_items policies ──────────────────────────
CREATE POLICY "sdi: anyone can insert"
  ON signup_donation_items FOR INSERT WITH CHECK (true);

CREATE POLICY "sdi: user reads own"
  ON signup_donation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM signups s
      WHERE s.id = signup_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "sdi: admin all"
  ON signup_donation_items FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ── announcements policies ───────────────────────────────────
CREATE POLICY "ann: public reads published"
  ON announcements FOR SELECT
  USING (published = true OR is_admin());

CREATE POLICY "ann: admin insert"
  ON announcements FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "ann: admin update"
  ON announcements FOR UPDATE USING (is_admin());

CREATE POLICY "ann: admin delete"
  ON announcements FOR DELETE USING (is_admin());

-- ── links policies ───────────────────────────────────────────
CREATE POLICY "links: public read"
  ON links FOR SELECT USING (true);

CREATE POLICY "links: admin write"
  ON links FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "links: admin update"
  ON links FOR UPDATE USING (is_admin());

CREATE POLICY "links: admin delete"
  ON links FOR DELETE USING (is_admin());

-- ── documents policies ───────────────────────────────────────
CREATE POLICY "docs: public read"
  ON documents FOR SELECT USING (true);

CREATE POLICY "docs: admin write"
  ON documents FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "docs: admin update"
  ON documents FOR UPDATE USING (is_admin());

CREATE POLICY "docs: admin delete"
  ON documents FOR DELETE USING (is_admin());

-- ── award_contests policies ──────────────────────────────────
CREATE POLICY "ac: public read"
  ON award_contests FOR SELECT USING (true);

CREATE POLICY "ac: admin write"
  ON award_contests FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "ac: admin update"
  ON award_contests FOR UPDATE USING (is_admin());

CREATE POLICY "ac: admin delete"
  ON award_contests FOR DELETE USING (is_admin());

-- ── award_nominations policies ───────────────────────────────
CREATE POLICY "an: anyone can insert"
  ON award_nominations FOR INSERT WITH CHECK (true);

CREATE POLICY "an: user reads own"
  ON award_nominations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "an: admin reads all"
  ON award_nominations FOR SELECT
  USING (is_admin());

CREATE POLICY "an: admin update"
  ON award_nominations FOR UPDATE USING (is_admin());

CREATE POLICY "an: admin delete"
  ON award_nominations FOR DELETE USING (is_admin());

-- ── winners policies ─────────────────────────────────────────
CREATE POLICY "w: public read"
  ON winners FOR SELECT USING (true);

CREATE POLICY "w: admin write"
  ON winners FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "w: admin update"
  ON winners FOR UPDATE USING (is_admin());

CREATE POLICY "w: admin delete"
  ON winners FOR DELETE USING (is_admin());

-- ── winner_prep policies ─────────────────────────────────────
CREATE POLICY "wp: admin only"
  ON winner_prep FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ── memories policies ────────────────────────────────────────
CREATE POLICY "mem: anyone can insert"
  ON memories FOR INSERT WITH CHECK (true);

-- Public sees only approved memories (no email column — see view below).
CREATE POLICY "mem: public reads approved"
  ON memories FOR SELECT
  USING (approved = true);

-- Logged-in users can also read their own unapproved memories.
CREATE POLICY "mem: user reads own"
  ON memories FOR SELECT
  USING (user_id = auth.uid());

-- Admin reads all.
CREATE POLICY "mem: admin reads all"
  ON memories FOR SELECT USING (is_admin());

CREATE POLICY "mem: admin update"
  ON memories FOR UPDATE USING (is_admin());

CREATE POLICY "mem: admin delete"
  ON memories FOR DELETE USING (is_admin());

-- ── bulletin_posts policies ──────────────────────────────────
CREATE POLICY "bp: anyone can insert"
  ON bulletin_posts FOR INSERT WITH CHECK (true);

CREATE POLICY "bp: public reads approved"
  ON bulletin_posts FOR SELECT
  USING (approved = true);

CREATE POLICY "bp: user reads own"
  ON bulletin_posts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "bp: admin reads all"
  ON bulletin_posts FOR SELECT
  USING (is_admin());

CREATE POLICY "bp: admin update"
  ON bulletin_posts FOR UPDATE USING (is_admin());

CREATE POLICY "bp: admin delete"
  ON bulletin_posts FOR DELETE USING (is_admin());


-- ============================================================
--  PUBLIC-FACING VIEWS (column-level data protection)
--
--  HTML pages query these views, NEVER the raw tables, so that
--  private columns (address, email, phone) are never returned
--  to anonymous visitors.
-- ============================================================

-- ── public_bulletin_posts ────────────────────────────────────
-- address is intentionally excluded (resident verification only).
-- phone/email only included when the poster opted in.
CREATE OR REPLACE VIEW public_bulletin_posts AS
SELECT
  id,
  submitted_at,
  category,
  title,
  content,
  photo_urls,
  poster_name,
  CASE WHEN show_phone THEN phone END AS phone,
  CASE WHEN show_email THEN email END AS email
FROM bulletin_posts
WHERE approved = true;

GRANT SELECT ON public_bulletin_posts TO anon, authenticated;

-- ── public_memories ──────────────────────────────────────────
-- email is intentionally excluded.
CREATE OR REPLACE VIEW public_memories AS
SELECT
  id,
  submitted_at,
  uploader_name,
  event_name,
  caption,
  photo_urls
FROM memories
WHERE approved = true;

GRANT SELECT ON public_memories TO anon, authenticated;


-- ============================================================
--  DASHBOARD AGGREGATE VIEWS (no PII)
--
--  Used by the public dashboard tabs. No names, emails, or
--  phone numbers are included in any of these views.
-- ============================================================

-- Overview: totals per event.
CREATE OR REPLACE VIEW dashboard_overview AS
SELECT
  e.id                                                           AS event_id,
  e.event_name,
  e.event_date,
  COUNT(s.id)                                                    AS total_signups,
  COUNT(s.id) FILTER (WHERE s.attending LIKE 'Yes%')            AS attending_count,
  COALESCE(SUM(s.num_adults),   0)                              AS total_adults,
  COALESCE(SUM(s.num_children), 0)                              AS total_children,
  COALESCE(SUM(s.children_0_3), 0)                              AS ages_0_3,
  COALESCE(SUM(s.children_4_8), 0)                              AS ages_4_8,
  COALESCE(SUM(s.children_9_plus), 0)                           AS ages_9_plus,
  COUNT(DISTINCT svr.signup_id)                                  AS total_volunteers
FROM events e
LEFT JOIN signups s
  ON s.event_id = e.id AND s.archived = false
LEFT JOIN signup_volunteer_roles svr
  ON svr.signup_id = s.id
GROUP BY e.id, e.event_name, e.event_date;

GRANT SELECT ON dashboard_overview TO anon, authenticated;

-- Volunteer role counts (no names).
CREATE OR REPLACE VIEW dashboard_volunteer_counts AS
SELECT
  svr.role_label,
  s.event_id,
  COUNT(svr.id) AS volunteer_count
FROM signup_volunteer_roles svr
JOIN signups s ON s.id = svr.signup_id AND s.archived = false
GROUP BY svr.role_label, s.event_id;

GRANT SELECT ON dashboard_volunteer_counts TO anon, authenticated;

-- Donation item progress (qty needed vs. qty pledged).
CREATE OR REPLACE VIEW dashboard_donations AS
SELECT
  edi.event_id,
  edi.category,
  edi.item_label,
  edi.qty_needed,
  COALESCE(SUM(sdi.qty_pledged), 0)                                       AS qty_pledged,
  GREATEST(0, edi.qty_needed - COALESCE(SUM(sdi.qty_pledged), 0))        AS qty_remaining
FROM event_donation_items edi
LEFT JOIN signup_donation_items sdi
  ON sdi.item_label = edi.item_label
LEFT JOIN signups s
  ON s.id = sdi.signup_id AND s.archived = false
GROUP BY edi.event_id, edi.category, edi.item_label, edi.qty_needed;

GRANT SELECT ON dashboard_donations TO anon, authenticated;

-- Potluck items (no names, no contact details).
CREATE OR REPLACE VIEW dashboard_potluck AS
SELECT
  s.event_id,
  s.potluck_item
FROM signups s
WHERE s.potluck_item IS NOT NULL
  AND s.potluck_item <> ''
  AND s.archived = false;

GRANT SELECT ON dashboard_potluck TO anon, authenticated;


-- ============================================================
--  LOOKUP SIGNUP FUNCTION
--  Public, name-based sign-up lookup for the dashboard "My Sign-Up" tab.
--  Returns limited fields only — no email, phone, or address.
--  SECURITY DEFINER lets anon users call it without a SELECT policy on signups.
-- ============================================================
CREATE OR REPLACE FUNCTION lookup_signup(p_query TEXT)
RETURNS TABLE (
  first_name     TEXT,
  last_name      TEXT,
  attending      TEXT,
  num_adults     INT,
  num_children   INT,
  potluck_item   TEXT,
  other_donation TEXT,
  cash_donation  TEXT,
  notes          TEXT,
  roles          TEXT[],
  donations      JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    s.first_name,
    s.last_name,
    s.attending,
    s.num_adults,
    s.num_children,
    s.potluck_item,
    s.other_donation,
    s.cash_donation,
    s.notes,
    COALESCE(
      array_agg(DISTINCT svr.role_label) FILTER (WHERE svr.role_label IS NOT NULL),
      ARRAY[]::TEXT[]
    ) AS roles,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object('item', sdi.item_label, 'qty', sdi.qty_pledged))
        FILTER (WHERE sdi.item_label IS NOT NULL),
      '[]'::JSONB
    ) AS donations
  FROM signups s
  LEFT JOIN signup_volunteer_roles svr ON svr.signup_id = s.id
  LEFT JOIN signup_donation_items  sdi ON sdi.signup_id = s.id
  WHERE s.archived = false
    AND (
         lower(s.first_name)                           LIKE '%' || lower(p_query) || '%'
      OR lower(s.last_name)                            LIKE '%' || lower(p_query) || '%'
      OR lower(s.first_name || ' ' || s.last_name)    LIKE '%' || lower(p_query) || '%'
    )
  GROUP BY s.id
  LIMIT 10
$$;

GRANT EXECUTE ON FUNCTION lookup_signup(TEXT) TO anon, authenticated;


-- ============================================================
--  TRIGGERS
-- ============================================================

-- Auto-create a profile row when a new user signs up.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    ),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
--  FUNCTIONS
-- ============================================================

-- Links historical guest submissions to a newly created account
-- by matching on email. Called from the browser immediately
-- after supabase.auth.signUp() resolves.
--
-- Usage: await supabase.rpc('claim_guest_submissions')
CREATE OR REPLACE FUNCTION claim_guest_submissions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = auth.uid();

  IF v_email IS NULL THEN RETURN; END IF;

  UPDATE signups
  SET user_id = auth.uid()
  WHERE user_id IS NULL
    AND lower(email) = lower(v_email);

  UPDATE memories
  SET user_id = auth.uid()
  WHERE user_id IS NULL
    AND lower(email) = lower(v_email);

  UPDATE bulletin_posts
  SET user_id = auth.uid()
  WHERE user_id IS NULL
    AND lower(email) = lower(v_email);

  UPDATE award_nominations
  SET user_id = auth.uid()
  WHERE user_id IS NULL
    AND lower(nominator_email) = lower(v_email);
END;
$$;


-- ============================================================
--  INITIAL DATA — Seed links and documents from current site
--  (mirrors the hardcoded fallback arrays in links.html and
--   documents.html so the Supabase version starts with data)
-- ============================================================

INSERT INTO links (category, icon, title, description, url, url_label, sort_order) VALUES
  ('Neighborhood Resources',    '🏠', 'HOA Portal (GoEnumerate)', 'Access your HOA account, pay dues, submit ARC requests, and view community documents through the official management portal.', 'https://engage.goenumerate.com/s/pendletonplantation/', 'engage.goenumerate.com', 1),
  ('Neighborhood Resources',    '📋', 'ARC Request (Online)',      'Submit an Architectural Review Committee request online through the GoEnumerate portal.', 'https://engage.goenumerate.com/s/pendletonplantation/arcrequest', '', 2),
  ('Neighborhood Resources',    '💰', 'Pay HOA Dues',              'Pay your HOA dues online through the GoEnumerate portal.', 'https://engage.goenumerate.com/s/pendletonplantation/payment', '', 3),
  ('City & County Resources',   '🏛️', 'City of Easley',            'Official website for the City of Easley, South Carolina.', 'https://www.cityofeasley.com/', '', 1),
  ('City & County Resources',   '🏛️', 'Pickens County',            'Official website for Pickens County, South Carolina.', 'https://www.co.pickens.sc.us/', '', 2),
  ('City & County Resources',   '🚨', 'Pickens County Sheriff',    'Pickens County Sheriff''s Office — for non-emergency inquiries.', 'https://www.pcsonline.net/', '', 3),
  ('Utilities',                 '💡', 'Duke Energy',               'Report power outages or manage your Duke Energy account.', 'https://www.duke-energy.com/', '', 1),
  ('Utilities',                 '💧', 'Easley Combined Utilities',  'Water, sewer, and electric services for the Easley area.', 'https://www.easleycombined.com/', '', 2)
ON CONFLICT DO NOTHING;

INSERT INTO documents (category, icon, title, description, url, url_label, sort_order) VALUES
  ('Neighborhood Documents — Click to Download', '📝', 'Annual Meeting Proxy Form',                    'Pendleton Plantation Homeowners Association Annual Meeting Proxy Form — Please complete and submit this form if you are unable to attend the annual HOA meeting but would like to designate another resident to vote on your behalf.', 'https://engage.goenumerate.com/s/pendletonplantation/files/5479/PND%20Proxy%20-%202024%20Annual%20Meeting.pdf', '', 1),
  ('Neighborhood Documents — Click to Download', '🛠️', 'Architectural Review Committee Request Form',  'Use this form to submit a physical copy of an ARC request if you prefer not to submit through the online portal.', 'https://engage.goenumerate.com/s/pendletonplantation/files/5479/ARC%20Request%20Form.pdf', '', 2),
  ('Neighborhood Documents — Click to Download', '⚖️', 'Pendleton Plantation Bylaws',                 'Bylaws of the Pendleton Plantation Homeowners Association, outlining the rules and regulations governing our community.', 'https://engage.goenumerate.com/s/pendletonplantation/files/5479/dyn197526/PDT%20-Bylaws.pdf', '', 3),
  ('Neighborhood Documents — Click to Download', '⚠️', 'Declaration of Covenants, Conditions, and Restrictions', 'This document details the covenants, conditions, and restrictions that apply to all properties within Pendleton Plantation.', 'https://engage.goenumerate.com/s/pendletonplantation/files/5479/dyn197526/PDT%20-%20Declaration%20of%20Covenants.pdf', '', 4),
  ('Neighborhood Documents — Click to Download', '📝', 'ARC Guidelines Updates (Effective February 2020)', 'Updated guidelines from the Architectural Review Committee outlining the standards and procedures for submitting architectural requests.', 'https://engage.goenumerate.com/s/pendletonplantation/files/5479/dyn197526/PDT%20-%20ARC%20Guidelines%202020.02.pdf', '', 5),
  ('Neighborhood Documents — Click to Download', '📄', 'First Bylaws Amendment (Effective July 2003)',  'This document contains the amendments made to the original bylaws of Pendleton Plantation as of July 2003.', 'https://engage.goenumerate.com/s/pendletonplantation/files/5479/dyn197526/PDT%20Amendment%20deed%20book%20page%2000085.pdf', '', 6),
  ('Neighborhood Documents — Click to Download', '📄', 'Second Bylaws Amendment (Effective July 2003)', 'This document contains the amendments made to the original bylaws of Pendleton Plantation as of July 2003.', 'https://engage.goenumerate.com/s/pendletonplantation/files/5479/dyn197526/PDT%20Amendment%20deed%20book%20page%2000103.pdf', '', 7),
  ('Neighborhood Documents — Click to Download', '📄', 'Pool Rules (Effective 2024)',                  'This document outlines the rules and regulations for the use of the Pendleton Plantation pool.', 'https://engage.goenumerate.com/s/pendletonplantation/files/5479/dyn197526/PND%202024%20POOL%20RULES.pdf', '', 8),
  ('Neighborhood Documents — Click to Download', '📄', 'Pendleton Plantation Financial Statements',    'This webpage links to the financial statements for Pendleton Plantation, including budgets, income statements, and balance sheets.', 'https://engage.goenumerate.com/s/pendletonplantation/dyndocuments.php?group=230231', '', 9)
ON CONFLICT DO NOTHING;


-- ============================================================
--  GRANT ADMIN ACCESS
--
--  Run this AFTER you create your account on the site.
--  Replace the email address with yours.
-- ============================================================

-- UPDATE profiles SET role = 'admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'mandyvaliquette00@gmail.com');
