import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabase-config';

export type ShippingItem = { id: string; qty: number };
export function validItems(items: unknown): items is ShippingItem[] {
 return Array.isArray(items) && items.length > 0 && items.length <= 100 && items.every(i => i && typeof i.id === 'string' && /^[0-9a-f-]{36}$/i.test(i.id) && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 99) && new Set(items.map(i => i.id)).size === items.length;
}
export function normalizeItems(items: ShippingItem[]) { return items.map(({id,qty})=>({id,qty})).sort((a,b)=>a.id.localeCompare(b.id)); }
export function shippingAdmin() {
 const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!key) throw new Error('Configuração de frete indisponível.');
 return createClient(supabaseConfig.url, key, {auth:{persistSession:false}});
}
type Rate = {id:number;name:string;error?:string;price?:string;custom_price?:string;delivery_time?:number;custom_delivery_time?:number;company?:{name:string}};
export function shippingOptions(rates: unknown) {
 if (!Array.isArray(rates)) return [];
 return (rates as Rate[]).filter(r => r && !r.error && [1,2].includes(Number(r.id)) && typeof r.name === 'string' && (r.custom_price ?? r.price) != null && String(r.custom_price ?? r.price).trim() !== '' && Number.isFinite(Number(r.custom_price ?? r.price)) && Number(r.custom_price ?? r.price) >= 0 && Number.isInteger(Number(r.custom_delivery_time ?? r.delivery_time)) && Number(r.custom_delivery_time ?? r.delivery_time) > 0)
 .map(r => ({serviceId:String(r.id),name:r.company?.name ? r.company.name+' · '+r.name : r.name,price:Number(r.custom_price ?? r.price),days:Number(r.custom_delivery_time ?? r.delivery_time)}))
 .filter((r,i,all)=>all.findIndex(x=>x.serviceId===r.serviceId)===i).sort((a,b)=>a.price-b.price);
}
