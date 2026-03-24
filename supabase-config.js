// ============================================================
//  File:    supabase-config.js
//  Purpose: Shared Supabase client — loaded by every HTML page.
//
//  HOW TO FILL IN:
//    1. Go to your Supabase project → Settings → API
//    2. Copy "Project URL"  → paste as SUPABASE_URL below
//    3. Copy "anon / public" key → paste as SUPABASE_ANON below
//
//  SECURITY NOTE:
//    The anon key is safe to commit to a public GitHub repo.
//    It is designed to be public. Row Level Security (RLS)
//    policies in supabase-schema.sql enforce all access rules.
//    Never put the "service_role" key here — that stays server-only.
// ============================================================

const SUPABASE_URL  = 'https://lqwfzdaudlioseijnlor.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Vj6VxxABERwOnvKMoghzfw_e28Fp25L';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
