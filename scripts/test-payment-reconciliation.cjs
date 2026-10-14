/* Isolated transactional regression; no external database or payment provider. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

(async () => {
 const db = new PGlite();
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('test.role',true),'') $$;`);
  await db.exec(fs.readFileSync('supabase/setup-anit.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',''));
  await db.exec(fs.readFileSync('supabase/order-management.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/payment-reconciliation.sql','utf8'));
  const uid='10000000-0000-4000-8000-000000000001';
  const product='20000000-0000-4000-8000-000000000001';
  const order='30000000-0000-4000-8000-000000000001';
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${uid}','buyer@example.invalid');
    INSERT INTO public.products(id,name,price,category,stock) VALUES('${product}','Teste',100,'bong',3);
    INSERT INTO public.orders(id,user_id,status,total,shipping_address) VALUES('${order}','${uid}','pending',200,'{"recipient":"Teste","postal_code":"01001000","street":"Rua Teste","number":"1","neighborhood":"Centro","city":"São Paulo","state":"SP"}'::jsonb);
    INSERT INTO public.order_items(order_id,product_id,quantity,price) VALUES('${order}','${product}',2,100);
    SELECT set_config('test.role','service_role',false);`);
  let result=await db.query('SELECT public.confirm_provider_pix_payment($1,$2,$3) AS ok',['987654321',order,200]);
  assert.equal(result.rows[0].ok,true);
  result=await db.query('SELECT stock FROM public.products WHERE id=$1',[product]);
  assert.equal(result.rows[0].stock,1);
  result=await db.query('SELECT public.confirm_provider_pix_payment($1,$2,$3) AS ok',['987654321',order,200]);
  assert.equal(result.rows[0].ok,true);
  result=await db.query('SELECT stock FROM public.products WHERE id=$1',[product]);
  assert.equal(result.rows[0].stock,1);
  result=await db.query('SELECT COUNT(*)::integer AS n FROM public.order_status_history WHERE order_id=$1',[order]);
  assert.equal(result.rows[0].n,1);
  await db.exec(`UPDATE public.orders SET status='shipped' WHERE id='${order}'`);
  result=await db.query('SELECT public.confirm_provider_pix_payment($1,$2,$3) AS ok',['987654321',order,200]);
  assert.equal(result.rows[0].ok,true);
  await assert.rejects(db.query('SELECT public.confirm_provider_pix_payment($1,$2,$3)',['987654321',order,201]));
  await assert.rejects(db.query('SELECT public.confirm_provider_pix_payment($1,$2,$3)',['987654322',order,200]));
  result=await db.query('SELECT stock FROM public.products WHERE id=$1',[product]);
  assert.equal(result.rows[0].stock,1);
  console.log('Conciliação SQL: estado pago, reenvio, envio, integridade de estoque e rejeição de duplicação OK.');
 } finally { await db.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
