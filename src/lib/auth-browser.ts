import { createBrowserClient } from '@supabase/ssr';

// Keep the existing static pages' API while sharing cookies with Next.js.
Object.assign(window, { supabase: { createClient: createBrowserClient } });
