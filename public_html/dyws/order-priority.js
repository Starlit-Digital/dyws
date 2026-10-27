// Scheduled pickup enters preparation 30 minutes before its promised pickup time.
const terminal=new Set(['completed','delivered','cancelled']);
export const isActiveOrder=order=>!terminal.has(order.status);
export const orderDueAt=order=>order.fulfillmentMeta?.scheduled&&Number.isFinite(order.fulfillmentMeta.scheduledAt)?order.fulfillmentMeta.scheduledAt-1800:order.created_at;
export const orderWorkView=(order,now=Date.now()/1000)=>!isActiveOrder(order)?(order.status==='cancelled'?'cancelled':'complete'):orderDueAt(order)>now?'scheduled':'due';
export const orderSortTime=order=>isActiveOrder(order)?orderDueAt(order):-order.created_at;
export const sortOrders=orders=>[...orders].sort((a,b)=>Number(isActiveOrder(b))-Number(isActiveOrder(a))||orderSortTime(a)-orderSortTime(b)||a.id.localeCompare(b.id));
