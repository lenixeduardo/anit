export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { shippingAdmin, validItems, normalizeItems, shippingOptions } from '@/lib/shipping';
import { shippingEnabled } from '@/lib/shipping-config';
export async function POST(request: Request) {
 try {
  if(!shippingEnabled) return NextResponse.json({error:'Cotação de frete ainda não ativada pela loja.'},{status:503});
  const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token) return NextResponse.json({error:'Faça login para calcular o frete.'},{status:401});
  const {data:{user},error:authError}=await supabase.auth.getUser(token);
  if(authError||!user) return NextResponse.json({error:'Sessão expirada.'},{status:401});
  const body=await request.json();
  const postalCode=typeof body.postalCode==='string'?body.postalCode.replace(/\D/g,''):'';
  if(!/^\d{8}$/.test(postalCode)||!validItems(body.items)) return NextResponse.json({error:'Informe um CEP válido e revise os itens.'},{status:400});
  const origin=process.env.SHIPPING_ORIGIN_POSTAL_CODE||'';
  const apiToken=process.env.MELHOR_ENVIO_TOKEN;
  const agent=process.env.MELHOR_ENVIO_USER_AGENT;
  if(!/^\d{8}$/.test(origin)||!apiToken||!agent) return NextResponse.json({error:'Frete ainda não configurado pela loja.'},{status:503});
  const admin=shippingAdmin();
  const {data:products,error}=await admin.from('products').select('id,name,price,stock,weight_kg,height_cm,width_cm,length_cm').in('id',body.items.map((i:{id:string})=>i.id));
  if(error||!products) return NextResponse.json({error:'Cadastro de frete dos produtos indisponível.'},{status:503});
  const payloadProducts=[];
  for(const item of normalizeItems(body.items)) {
   const p=products.find(p=>p.id===item.id);
   if(!p||p.stock<item.qty||Number(p.price)<=0) return NextResponse.json({error:'Produto indisponível. Revise o carrinho.'},{status:400});
   if(![p.weight_kg,p.height_cm,p.width_cm,p.length_cm].every(n=>Number.isFinite(Number(n))&&Number(n)>0)) return NextResponse.json({error:'A loja precisa cadastrar peso e dimensões de: '+p.name},{status:503});
   payloadProducts.push({id:p.id,quantity:item.qty,insurance_value:Number(p.price),weight:Number(p.weight_kg),height:Number(p.height_cm),width:Number(p.width_cm),length:Number(p.length_cm)});
  }
  const host=process.env.MELHOR_ENVIO_SANDBOX==='true'?'sandbox.melhorenvio.com.br':'www.melhorenvio.com.br';
  const response=await fetch('https://'+host+'/api/v2/me/shipment/calculate',{method:'POST',headers:{Authorization:'Bearer '+apiToken,'User-Agent':agent,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({from:{postal_code:origin},to:{postal_code:postalCode},products:payloadProducts,services:'1,2',options:{receipt:false,own_hand:false}}),signal:AbortSignal.timeout(15000)});
  if(!response.ok) return NextResponse.json({error:'Transportadora indisponível. Tente novamente.'},{status:502});
  const options=shippingOptions(await response.json());
  if(options.length<2) return NextResponse.json({error:'Não há duas modalidades disponíveis para este CEP e estes itens. Confira o CEP ou tente novamente.'},{status:422});
  const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
  const rows=options.map(o=>({user_id:user.id,items:normalizeItems(body.items),postal_code:postalCode,service_id:o.serviceId,service_name:o.name,price:o.price,delivery_days:o.days,expires_at:expiresAt,sandbox:process.env.MELHOR_ENVIO_SANDBOX==='true'}));
  const {data:quotes,error:saveError}=await admin.from('shipping_quotes').insert(rows).select('id,service_id');
  if(saveError||!quotes) return NextResponse.json({error:'Não foi possível salvar a cotação. Tente novamente.'},{status:503});
  return NextResponse.json({options:options.map(o=>({...o,quoteId:quotes.find(q=>q.service_id===o.serviceId)?.id})),expiresAt,sandbox:process.env.MELHOR_ENVIO_SANDBOX==='true'},{headers:{'Cache-Control':'no-store'}});
 } catch {return NextResponse.json({error:'Não foi possível calcular o frete. Tente novamente.'},{status:503});}
}
