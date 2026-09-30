/* eslint-disable @typescript-eslint/no-require-imports */
require('esbuild').buildSync({
  entryPoints: ['src/lib/auth-browser.ts'],
  outfile: 'public/auth-client.js',
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
});
