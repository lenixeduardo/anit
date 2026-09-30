/* eslint-disable @typescript-eslint/no-require-imports */
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const db = new PGlite();
 try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('test.role',true),'') $$;`);
 await db.exec(fs.readFileSync('supabase/setup-anit.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', ''));
 await db.exec(fs.readFileSync('supabase/order-management.sql','utf8'));
 const customer='10000000-0000-4000-8000-000000000001', other='10000000-0000-4000-8000-000000000002', admin='10000000-0000-4000-8000-000000000003', product='20000000-0000-4000-8000-000000000001', order='30000000-0000-4000-8000-000000000001';
 await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${customer}','customer@example.invalid'),('${other}','other@example.invalid'),('${admin}','admin@example.invalid');
 UPDATE public.profiles SET role='admin' WHERE id='${admin}';
 INSERT INTO public.products(id,name,price,category,stock) VALUES('${product}','Produto teste',100,'bong',3);
 GRANT USAGE ON SCHEMA public,auth TO authenticated;
 GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated; GRANT INSERT,UPDATE ON public.profiles TO authenticated;`);
 async function login(id){await db.exec(`RESET ROLE; SELECT set_config('test.uid','${id}',false); SELECT set_config('test.role','authenticated',false); SET ROLE authenticated;`);}
 await login(customer);
 const params=[order,JSON.stringify([{id:product,qty:2}]),''];
 const quote=(await db.query('SELECT public.create_pix_order($1,$2::jsonb,$3) AS result',params)).rows[0].result;
 assert.equal(quote.total,200);
 await db.query('SELECT public.create_pix_order($1,$2::jsonb,$3)',params);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM orders')).rows[0].n,1);
 await assert.rejects(db.query("INSERT INTO orders(id,user_id,total) VALUES($1,$2,1)", ['30000000-0000-4000-8000-000000000009',customer]), /permission denied/);
 await assert.rejects(db.query("UPDATE profiles SET role='admin' WHERE id=$1",[customer]),/Identidade e função/);
 await assert.rejects(db.query("SELECT public.update_order_status($1,'paid','')",[order]),/Acesso negado/);
 await login(other); assert.equal((await db.query('SELECT count(*)::int AS n FROM orders')).rows[0].n,0);
 await login(admin);
 await db.query("SELECT public.update_order_status($1,'paid','')",[order]);
 await db.query("SELECT public.update_order_status($1,'paid','')",[order]);
 assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[product])).rows[0].stock,1);
 await assert.rejects(db.query("SELECT public.update_order_status($1,'delivered','')",[order]),/Transição/);
 await assert.rejects(db.query("SELECT public.update_order_status($1,'shipped','')",[order]),/rastreio/);
 await db.query("SELECT public.update_order_status($1,'shipped','TEST123')",[order]);
 await db.query("SELECT public.update_order_status($1,'delivered','')",[order]);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM order_status_history WHERE order_id=$1',[order])).rows[0].n,3);
 await login(customer); assert.equal((await db.query('SELECT tracking_code,status FROM orders WHERE id=$1',[order])).rows[0].status,'delivered');
 console.log('PASS PostgreSQL isolado: checkout atômico, idempotência, isolamento por cliente, bloqueio de promoção, permissões admin, estoque, transições, rastreio e histórico.');
 } finally {await db.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
