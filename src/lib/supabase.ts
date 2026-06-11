/**
 * supabase.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client Supabase — dezactivat până când se adaugă credențialele în .env
 *
 * Pentru activare:
 *   1. Creează fișierul .env în rădăcina proiectului:
 *        EXPO_PUBLIC_SUPABASE_URL=https://xyzxyz.supabase.co
 *        EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
 *   2. Decomentează blocul de mai jos
 *   3. Setează USE_MOCK = false în src/lib/api.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

// import { createClient } from '@supabase/supabase-js';
// import AsyncStorage from '@react-native-async-storage/async-storage';
//
// const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
// const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
//
// export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
//   auth: {
//     storage: AsyncStorage,
//     autoRefreshToken: true,
//     persistSession: true,
//     detectSessionInUrl: false,
//   },
// });

/**
 * Placeholder exportat ca să nu crape importurile din alte fișiere.
 * Înlocuit cu clientul real de mai sus când e momentul.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uqrubpbpkbbzbthmfguh.supabase.co/';      // ← URL-ul tău
const SUPABASE_ANON_KEY = 'sb_secret_3OjH_r3im87UaatP1_JUuw_dUjvOxir';                // ← Key-ul tău

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});