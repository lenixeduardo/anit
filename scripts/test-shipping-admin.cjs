const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const html=fs.readFileSync('public/admin.html','utf8');const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{_value:'',get value(){return this._value;},set value(v){this._value=String(v);},style:{},classList:{add(){},remove(){}},addEventListener(){}});return nodes.get(id);};
 const alerts=[];const context={document:{getElementById:node,querySelector:()=>({reset(){}})},alert:m=>alerts.push(m),setTimeout(){},console,location:{}};context.window=context;
 vm.createContext(context);vm.runInContext(script,context);let saved=null;
 context.supabaseClient={from:()=>({insert:async data=>{saved=data;return {error:null};},update:data=>({eq:async()=>{saved=data;return {error:null};}})})};
 context.loadProducts=()=>{};context.showToast=()=>{};context.closeModal=()=>{};
 node('f-name').value='Produto';node('f-price').value='10';node('f-stock').value='2';node('f-cat').value='bong';
 const measures={weight_kg:'0.3',height_cm:'12',width_cm:'15',length_cm:'20'};
 node('f-weight_kg').value='0.3';await context.saveProduct({preventDefault(){}});assert.equal(saved,null);assert.equal(alerts.length,1);
 for(const [key,val]of Object.entries(measures))node('f-'+key).value=val;
 await context.saveProduct({preventDefault(){}});for(const [key,val]of Object.entries(measures))assert.equal(saved[key],Number(val));
 context.products=[{id:'test',name:'Produto',price:'R$ 10,00',cat:'bong',stock:2,...saved}];context.products[0].price='R$ 10,00';context.editProduct('test');assert.equal(node('f-weight_kg').value,'0.3');assert.equal(node('f-length_cm').value,'20');
 saved=null;node('f-height_cm').value='0';await context.saveProduct({preventDefault(){}});assert.equal(saved,null);
 console.log('PASS cadastro de frete: exige quatro medidas, salva números, recupera edição e rejeita zero.');
})().catch(e=>{console.error(e);process.exitCode=1;});
