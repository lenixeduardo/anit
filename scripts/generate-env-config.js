/**
 * Prebuild script: bakes Supabase public credentials into public/env-config.js
 * so that static HTML pages can initialize the Supabase client without
 * relying on an API route (which requires Next.js routing to be active).
 *
 * Run automatically via `npm run prebuild` before `next build`.
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from the
 * build environment (set in Vercel project settings or .env.local).
 */
const fs = require('fs');
const path = require('path');

const FALLBACK_URL = 'https://zzjnbsckeottbnyfvhea.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6am5ic2NrZW90dGJueWZ2aGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTU5NjIsImV4cCI6MjA5NjA5MTk2Mn0.vkSvxopKxgIqYmYZk3g2xYqgl65PBNEE0QKdtrKjAPo';

// Strip Markdown angle brackets, whitespace, newlines from env vars
function sanitize(val) { return (val || '').trim().replace(/^<|>$/g, '').trim(); }

const url = sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL) || FALLBACK_URL;
const key = sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || FALLBACK_KEY;

const content = [
  '/* Generated at build time by scripts/generate-env-config.js — do not edit manually */',
  `window.__SUPABASE_URL = ${JSON.stringify(url)};`,
  `window.__SUPABASE_ANON_KEY = ${JSON.stringify(key)};`,
].join('\n') + '\n';

const dest = path.join(__dirname, '..', 'public', 'env-config.js');
fs.writeFileSync(dest, content, 'utf8');

const status = url && key ? 'PRONTO' : 'AVISO: variáveis não definidas (o site não conectará ao Supabase)';
console.log(`✓ public/env-config.js gerado — ${status}`);
