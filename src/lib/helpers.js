export const formatCurrency=value=>{const number=Number(value);return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number.isFinite(number)?number:0)};
export const formatDate=date=>{if(!date)return '';const parsed=new Date(date);return Number.isNaN(parsed.getTime())?'':parsed.toLocaleDateString('pt-BR')};
export const formatDateTime=date=>{if(!date)return '';const parsed=new Date(date);return Number.isNaN(parsed.getTime())?'':parsed.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})};
export const generateInternalCode=()=>`NX${Date.now().toString().slice(-8)}`;
export const PAYMENT_METHODS=[
  {method:'dinheiro',label:'Dinheiro',color:'bg-green-100 text-green-800 border-green-300'},
  {method:'debito',label:'Cartão de Débito',color:'bg-blue-100 text-blue-800 border-blue-300'},
  {method:'credito',label:'Cartão de Crédito',color:'bg-purple-100 text-purple-800 border-purple-300'},
  {method:'pix',label:'Pix',color:'bg-teal-100 text-teal-800 border-teal-300'},
  {method:'outros',label:'Outros',color:'bg-gray-100 text-gray-800 border-gray-300'},
  {method:'fiado',label:'Venda Fiado',color:'bg-orange-100 text-orange-800 border-orange-300'},
];
export const getPaymentLabel=method=>PAYMENT_METHODS.find(payment=>payment.method===method)?.label||method;
export const calculateSaleTotals=sale=>{const subtotal=(sale.items||[]).reduce((sum,item)=>sum+(Number(item.subtotal)||0),0);let discount=Math.max(0,Number(sale.discount_value)||0);if(sale.discount_type==='percentual')discount=subtotal*(Math.min(discount,100)/100);discount=Math.min(discount,subtotal);const total=Math.max(0,subtotal-discount),totalItems=(sale.items||[]).reduce((sum,item)=>sum+(Number(item.quantity)||(item.weight?1:0)),0);return{subtotal,discount,total,totalItems}};
