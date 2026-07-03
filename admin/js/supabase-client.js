import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = 'https://junfgutjyicdrvpoyuzz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_GY-aCPbwOTu_BXGGGNx5rQ_Rmc_Nddb';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});
