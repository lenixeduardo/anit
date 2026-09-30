/* eslint-disable @typescript-eslint/no-require-imports */
// Execute com: node --env-file=.env.local scripts/create-admin.cjs
// A senha é solicitada no terminal e nunca salva no repositório.
const { createClient } = require('@supabase/supabase-js');
const readline = require('node:readline/promises');
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.ANIT_ADMIN_EMAIL || 'lenix.camargo@gmail.com';
  if (!url || !key) throw new Error('Configure o projeto Supabase ativo e SUPABASE_SERVICE_ROLE_KEY em .env.local.');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // Confirma conectividade antes de pedir a senha ou criar a conta.
  const { data: firstPage, error: probeError } = await client.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (probeError) throw new Error('Não foi possível acessar a administração do Supabase: ' + probeError.message);
  let users = firstPage.users, page = 1;
  let existing = users.find(user => user.email?.toLowerCase() === email.toLowerCase());
  while (!existing && users.length === 100) {
    const result = await client.auth.admin.listUsers({ page: ++page, perPage: 100 });
    if (result.error) throw result.error;
    users = result.data.users;
    existing = users.find(user => user.email?.toLowerCase() === email.toLowerCase());
  }
  let user = existing;
  if (!user) {
    let password = process.env.ANIT_ADMIN_PASSWORD;
    if (!password) {
      const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
      try { password = await terminal.question('Senha da nova conta administradora: '); }
      finally { terminal.close(); }
    }
    if (!password || password.length < 6) throw new Error('Informe uma senha com pelo menos seis caracteres.');
    const result = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Administrador ANIT' } });
    if (result.error) throw result.error;
    user = result.data.user;
  }
  // Não troca a senha de uma conta existente sem autorização específica.
  const { error: profileError } = await client.from('profiles').upsert({ id: user.id, email, name: 'Administrador ANIT', role: 'admin' }, { onConflict: 'id' });
  if (profileError) throw new Error('A conta existe, mas a atribuição de administrador falhou: ' + profileError.message);
  const { data: profile, error: verifyError } = await client.from('profiles').select('id,role').eq('id', user.id).single();
  if (verifyError || profile?.role !== 'admin') throw new Error('Não foi possível confirmar a função administrativa.');
  console.log('Conta administradora verificada: ' + email + (existing ? ' (senha existente preservada)' : ' (nova conta)'));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
