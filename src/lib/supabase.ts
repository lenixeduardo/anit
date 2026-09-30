import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _instance: SupabaseClient | null = null;

function getInstance(): SupabaseClient {
  if (!_instance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zzjnbsckeottbnyfvhea.supabase.co';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6am5ic2NrZW90dGJueWZ2aGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTU5NjIsImV4cCI6MjA5NjA5MTk2Mn0.vkSvxopKxgIqYmYZk3g2xYqgl65PBNEE0QKdtrKjAPo';
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
