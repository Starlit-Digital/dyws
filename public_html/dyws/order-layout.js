/** Optional layouts only move existing controls. Missing or invalid layouts leave core markup intact. */
export const orderFields={
 cart:{fields:['items','subtotal','tax','total','actions'],required:['items','total','actions']},
 checkout:{fields:['location','name','phone','fulfillment','street','unit','postal','city','region','country','notes','pickup','total','actions'],required:['name','phone','fulfillment','street','total','actions']},
 review:{fields:['location','items','delivery','tax','name','address','phone','postal','notes','total','pause','actions'],required:['items','delivery','tax','total','pause','actions']}
};
export function validOrderLayout(stage,layout){
 const schema=orderFields[stage];if(!schema||!layout||!Number.isInteger(layout.rows)||layout.rows<1||layout.rows>30||!Array.isArray(layout.fields)||layout.fields.length>30)return false;
 const placed=new Set(),occupied=new Set();
 for(const f of layout.fields){
  if(!f||!schema.fields.includes(f.id)||placed.has(f.id)||!Number.isInteger(f.row)||f.row<1||f.row>layout.rows||![1,2].includes(f.column)||![1,2].includes(f.span)||f.column+f.span>3||!['left','center','right'].includes(f.align)||!['top','center','bottom'].includes(f.vertical)||(f.id==='actions'&&f.span!==2))return false;
  for(let col=f.column;col<f.column+f.span;col++){const key=f.row+':'+col;if(occupied.has(key))return false;occupied.add(key);}placed.add(f.id);
 }
 return schema.required.every(id=>placed.has(id));
}
const extras={city:['City','addressCity',80,'address-level2'],region:['Province or state','addressRegion',60,'address-level1'],country:['Country','addressCountry',60,'country-name']};
export function applyOrderLayout({stage,root,layout}){
 if(!validOrderLayout(stage,layout))return false;
 const doc=root.ownerDocument,nodes=new Map([...root.querySelectorAll('[data-dyws-order-field]')].map(n=>[n.dataset.dywsOrderField,n]));
 if(orderFields[stage].required.some(id=>!nodes.has(id)))return false;
 // All validation happens before the fallback DOM is changed.
 if(stage==='checkout')for(const f of layout.fields)if(extras[f.id]&&!nodes.has(f.id)&&!(root.dataset?.dywsAddressAutocomplete!==undefined&&['city','region','country'].includes(f.id))){
  const [caption,name,max,autocomplete]=extras[f.id],label=doc.createElement('label'),input=doc.createElement('input');
  label.textContent=caption+', optional';label.dataset.dywsOrderField=f.id;label.dataset.dywsDelivery='';input.name=name;input.maxLength=max;input.autocomplete=autocomplete;label.append(input);nodes.set(f.id,label);
 }
 const keep=[...root.querySelectorAll('[data-dyws-checkout-fields],.dyws-error,.dyws-review-notice,.dyws-cancellation-note')];
 const grid=doc.createElement('div');grid.className='dyws-order-grid';grid.dataset.stage=stage;
 for(const f of [...layout.fields].sort((a,b)=>a.row-b.row||a.column-b.column)){
  const node=nodes.get(f.id);if(!node)continue;
  const cell=doc.createElement('div');cell.className='dyws-order-cell';cell.dataset.field=f.id;cell.dataset.align=f.align;cell.dataset.vertical=f.vertical;cell.dataset.span=String(f.span);
  cell.style.gridRow=String(f.row);cell.style.gridColumn=f.column+' / span '+f.span;
  if(node.querySelector('dt')){const list=doc.createElement('dl');list.className='dyws-order-amount';list.append(node);cell.append(list);}else cell.append(node);grid.append(cell);
 }
 const location=nodes.get('location'),unplaced=location&&!layout.fields.some(field=>field.id==='location')?[location]:[];
 const hours=root.querySelector('[data-dyws-hours]');
 root.replaceChildren(...unplaced,...(hours?[hours]:[]),grid,...keep);return true;
}
