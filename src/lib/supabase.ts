import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uqrubpbpkbbzbthmfguh.supabase.co/';
const SUPABASE_ANON_KEY = 'sb_secret_3OjH_r3im87UaatP1_JUuw_dUjvOxir';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
