export function itemOrderCap(catalog) { return Number.isInteger(catalog.itemOrderCap) && catalog.itemOrderCap >= 1 && catalog.itemOrderCap <= 99 ? catalog.itemOrderCap : 10; }
export function itemQuantity(lines, id) { return lines.filter(line=>line.id===id).reduce((sum,line)=>sum+line.quantity,0); }
export function lineKey(id, variant = '', selections = {}) { const entries=Object.entries(selections).filter(([,v])=>v.length).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,[...v].sort()]);return JSON.stringify([id, variant,...(entries.length?[entries]:[])]); }
export function resolveItem(catalog, id, variant = '', selections = {}) {
  const item = catalog.categories.flatMap(c => c.items).find(i => i.id === id);
  if (!item || item.active === false) throw new Error('Item unavailable');
  const option = item.variants?.find(v => v.id === variant);
  if ((item.variants?.length || variant) && !option) throw new Error('Choose an option');
  let price = option?.price ?? item.price;
  if(!selections || typeof selections!=='object' || Array.isArray(selections)&&selections.length)throw new Error('Invalid choices');
  const groups=item.optionGroups||[], canonical={},labels=[];
  if(Object.keys(selections).some(id=>!groups.some(g=>g.id===id)))throw new Error('Unknown option group');
  for(const group of groups){
    const ids=selections[group.id]||[];
    if(!Array.isArray(ids)||ids.length<group.min||ids.length>group.max||new Set(ids).size!==ids.length||ids.some(id=>!group.choices.some(c=>c.id===id)))throw new Error(group.min===group.max?`Choose exactly ${group.max} for ${group.name}.`:`Choose ${group.min} to ${group.max} options for ${group.name}.`);
    const chosen=group.choices.filter(c=>ids.includes(c.id));
    if(chosen.length){canonical[group.id]=chosen.map(c=>c.id);labels.push(group.name+': '+chosen.map(c=>c.name).join(', '));price+=chosen.reduce((n,c)=>n+c.price,0);}
  }
  if (!Number.isSafeInteger(price) || price < 0) throw new Error('Invalid price');
  return { id, variant, ...(groups.length?{selections:canonical}:{}), name: item.name, option: [option?.name,...labels].filter(Boolean).join(' · '), price };
}
export function restoreCart(catalog, saved) {
  if (!Array.isArray(saved)) return [];
  const result = [];
  for (const row of saved.slice(0,100)) {
    try {
      const item = resolveItem(catalog, row.id, row.variant, row.selections);
      if (!Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 99) continue;
      const key = lineKey(item.id,item.variant,item.selections);
      const existing=result.find(i => lineKey(i.id,i.variant,i.selections)===key);
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
