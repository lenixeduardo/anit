import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { supabaseConfig } from "./supabase-config";

let _instance: SupabaseClient | null = null;

function getInstance(): SupabaseClient {
  if (!_instance) {
    const url = supabaseConfig.url;
    const key = supabaseConfig.key;
    _instance = createClient(url, key);
  }
  return _instance;
}

// Proxy-based lazy init: createClient is deferred until first property access.
// This prevents build-time failures when env vars are not available during
// the Next.js "Collecting page data" phase.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getInstance(), prop, receiver);
  },
});

export function createAuthenticatedClient(token: string) {
 return createClient(supabaseConfig.url, supabaseConfig.key, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false } });
}
