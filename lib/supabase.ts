import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Klient publiczny - dla frontendu (czyta dane)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Klient adminowy - dla cron joba (zapisuje dane)
// UWAGA: używać TYLKO w server-side code (API routes, Server Components)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
