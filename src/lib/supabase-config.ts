// Public API configuration only; never use a service role key here.
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zzjnbsckeottbnyfvhea.supabase.co',
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6am5ic2NrZW90dGJueWZ2aGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTU5NjIsImV4cCI6MjA5NjA5MTk2Mn0.vkSvxopKxgIqYmYZk3g2xYqgl65PBNEE0QKdtrKjAPo',
};
