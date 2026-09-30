export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabase, createAuthenticatedClient } from "@/lib/supabase";
import QRCode from "qrcode";
import { createPixPayload, PIX_KEY } from "@/lib/pix";

export async function POST(request: Request) {
 try {
 const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
 if (!token) return NextResponse.json({error:'Faça login para finalizar'}, {status:401});
 const {data:{user},error:authError}=await supabase.auth.getUser(token);
 if(authError || !user) return NextResponse.json({error:'Sessão expirada'}, {status:401});
 const body=await request.json();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.orderId||'') || !Array.isArray(body.items) || !body.items.length || body.items.length>100 || body.items.some((i:{id?:string;qty?:number})=>!i.id||!Number.isInteger(i.qty)||Number(i.qty)<1||Number(i.qty)>99)) return NextResponse.json({error:'Carrinho inválido. Revise os produtos'}, {status:400});
 const client=createAuthenticatedClient(token);
 const {data,error}=await client.rpc('create_pix_order',{p_id:body.orderId,p_items:body.items.map((i:{id:string;qty:number})=>({id:i.id,qty:i.qty})),p_coupon:body.coupon||''});
 if(error) return NextResponse.json({error:error.code==='PGRST202'?'Checkout Pix ainda não habilitado no banco da loja.':'Não foi possível criar o pedido. Confira estoque, cupom e sua conta.',code:error.code==='PGRST202'?'PIX_SETUP_REQUIRED':'ORDER_FAILED'},{status:error.code==='PGRST202'?503:400});
 const payload=createPixPayload(Math.round(Number(data.total)*100),data.orderId.replace(/-/g,'').slice(0,25));
 const qr=await QRCode.toDataURL(payload,{width:512,margin:4,errorCorrectionLevel:'M'});
 return NextResponse.json({success:true,...data,payload,qr,key:PIX_KEY,receiver:'ANIT HEADSHOP',city:'SAO PAULO'});
 } catch { return NextResponse.json({error:'Não foi possível processar o pedido'},{status:500}); }
}


async function authenticated(request: Request) {
 const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
 if(!token) return null;
 const client=createAuthenticatedClient(token);
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user) return null;
 const {data:profile}=await client.from('profiles').select('role').eq('id',user.id).single();
 return {client,user,admin:profile?.role==='admin'};
}
export async function GET(request: Request) {
 try {
 const auth=await authenticated(request);
 if(!auth) return NextResponse.json({error:'Faça login para consultar pedidos'},{status:401});
 const params=new URL(request.url).searchParams;
 const offset=Number(params.get('offset')||0);
 if(!Number.isSafeInteger(offset)||offset<0||offset>1000000) return NextResponse.json({error:'Página inválida'},{status:400});
 const admin=params.get('scope')==='admin';
 if(admin&&!auth.admin) return NextResponse.json({error:'Acesso restrito ao administrador'},{status:403});
 let query=auth.client.from('orders').select('id,total,status,created_at,tracking_code,paid_at,shipped_at,delivered_at,profiles(name,email),order_items(id,quantity,price,products(name)),order_status_history(previous_status,status,created_at)').order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+99);
 if(!admin) query=query.eq('user_id',auth.user.id);
 if(params.get('id')) query=query.eq('id',params.get('id'));
 const {data,error}=await query;
 if(error) return NextResponse.json({error:'Não foi possível consultar pedidos. Verifique a configuração do banco.'},{status:503});
 if(params.get('id')&&!data?.length) return NextResponse.json({error:'Pedido não encontrado'},{status:404});
 if(params.get('pix')==='1'&&data?.length===1){
 const order=data[0];
 if(order.status!=='pending') return NextResponse.json({error:'Este pedido não está aguardando Pix'},{status:409});
 const payload=createPixPayload(Math.round(Number(order.total)*100),order.id.replace(/-/g,'').slice(0,25));
 return NextResponse.json({payload,qr:await QRCode.toDataURL(payload,{width:512,margin:4}),total:order.total});
 }
 return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
 } catch {return NextResponse.json({error:'Falha ao consultar pedidos'},{status:500});}
}
export async function PATCH(request: Request) {
 try {
 const auth=await authenticated(request);
 if(!auth) return NextResponse.json({error:'Faça login'},{status:401});
 if(!auth.admin) return NextResponse.json({error:'Acesso restrito ao administrador'},{status:403});
 const body=await request.json();
 if(!/^[0-9a-f-]{36}$/i.test(body.id||'')||!['paid','shipped','delivered','cancelled'].includes(body.status)||typeof (body.tracking||'')!=='string'||(body.tracking||'').length>100) return NextResponse.json({error:'Dados inválidos'},{status:400});
 if(body.status==='paid'&&body.paymentVerified!==true) return NextResponse.json({error:'Confirme o recebimento do Pix no banco'},{status:400});
 const {data,error}=await auth.client.rpc('update_order_status',{p_id:body.id,p_status:body.status,p_tracking:body.tracking||''});
 if(error) return NextResponse.json({error:'Não foi possível atualizar. Verifique o status atual, o estoque e o rastreio.'},{status:409});
 return NextResponse.json(data);
 } catch {return NextResponse.json({error:'Falha ao atualizar pedido'},{status:500});}
}
