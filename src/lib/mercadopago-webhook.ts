import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifyMercadoPagoSignature(args: {dataId:string;requestId:string;signature:string;secret:string;now?:number;}):boolean {
 const parts=Object.fromEntries(args.signature.split(',').map(p=>{const n=p.indexOf('=');return n<0?['','']:[p.slice(0,n).trim(),p.slice(n+1).trim()];}));
 if(!/^\d{10,13}$/.test(parts.ts||'')|| !/^[a-f0-9]{64}$/i.test(parts.v1||''))return false;
 const timestamp=Number(parts.ts)*(parts.ts.length===10?1000:1);
 if(!Number.isFinite(timestamp)||Math.abs((args.now??Date.now())-timestamp)>300000)return false;
 if(!args.dataId||!args.requestId||!args.secret)return false;
 const payload=`id:${args.dataId.toLowerCase()};request-id:${args.requestId};ts:${parts.ts};`;
 const expected=createHmac('sha256',args.secret).update(payload).digest();
 const received=Buffer.from(parts.v1,'hex');
 return expected.length===received.length&&timingSafeEqual(expected,received);
}
