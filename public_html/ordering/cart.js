export function lineKey(id, variant = '') { return JSON.stringify([id, variant]); }
export function resolveItem(catalog, id, variant = '') {
  const item = catalog.categories.flatMap(c => c.items).find(i => i.id === id);
  if (!item) throw new Error('Item unavailable');
  const option = item.variants?.find(v => v.id === variant);
  if (item.variants?.length && !option) throw new Error('Choose an option');
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
      if(existing) existing.quantity=Math.min(99,existing.quantity+row.quantity);
      else result.push({...item,quantity:row.quantity});
    } catch {}
  }
  return result;
}
export function totals(lines, taxBasisPoints = 0) {
  const subtotal=lines.reduce((sum,l)=>sum+l.price*l.quantity,0);
  const tax=Math.round(subtotal*taxBasisPoints/10000);
  return {subtotal,tax,total:subtotal+tax};
}
