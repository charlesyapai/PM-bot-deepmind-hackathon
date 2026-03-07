import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wyvhdkvpxrcfdyfntgfc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jt35G65SV0tTT9C58kBfKA_0Ysy6ZRB';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Returns Authorization header with the current session's access token.
 * Returns an empty object if no active session exists.
 */
export async function getAuthHeaders(): Promise<{ Authorization: string } | Record<string, never>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}
