export function itemOrderCap(catalog) { return Number.isInteger(catalog.itemOrderCap) && catalog.itemOrderCap >= 1 && catalog.itemOrderCap <= 99 ? catalog.itemOrderCap : 10; }
export function itemQuantity(lines, id) { return lines.filter(line=>line.id===id).reduce((sum,line)=>sum+line.quantity,0); }
export function lineKey(id, variant = '') { return JSON.stringify([id, variant]); }
export function resolveItem(catalog, id, variant = '') {
  const item = catalog.categories.flatMap(c => c.items).find(i => i.id === id);
  if (!item || item.active === false) throw new Error('Item unavailable');
  const option = item.variants?.find(v => v.id === variant);
  if ((item.variants?.length || variant) && !option) throw new Error('Choose an option');
  const price = option?.price ?? item.price;
  if (!Number.isSafeInteger(price) || price < 0) throw new Error('Invalid price');
  return { id, variant, name: item.name, option: option?.name || '', price };
}
export function restoreCart(catalog, saved) {
  if (!Array.isArray(saved)) return [];
  const result = [];
  for (const row of saved.slice(0,100)) {
    try {
      const item = resolveItem(catalog, row.id, row.variant);
      if (!Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 99) continue;
      const key = lineKey(item.id,item.variant);
      const existing=result.find(i => lineKey(i.id,i.variant)===key);
      const quantity=Math.min(row.quantity,itemOrderCap(catalog)-itemQuantity(result,item.id));
      if(quantity<=0)continue;
      if(existing) existing.quantity+=quantity;
      else result.push({...item,quantity});
    } catch {}
  }
  return result;
}
export function totals(lines, taxBasisPoints = 0) {
  const subtotal=lines.reduce((sum,l)=>sum+l.price*l.quantity,0);
  const tax=Math.round(subtotal*taxBasisPoints/10000);
  return {subtotal,tax,total:subtotal+tax};
}
