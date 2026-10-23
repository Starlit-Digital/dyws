/** DataTables is optional. State lasts only in memory, never in browser storage. */
export function register(plugin) {
 const tables=new Map(),states=new Map();let library;
 const dispose=(table,forget=false)=>{const instance=tables.get(table),key=table.dataset.dywsTable;if(instance){if(key&&!forget)states.set(key,{search:instance.search(),order:instance.order(),length:instance.page.len(),page:instance.page()});instance.destroy();}if(forget&&key)states.delete(key);tables.delete(table);};
 plugin.addAction('admin:tables',async({root,phase='mount',options={},ready,forget=false})=>{
  for(const table of tables.keys())if(!table.isConnected||(phase==='dispose'&&root.contains(table)))dispose(table,forget);
  if(phase==='dispose')return;
  const pending=[...root.querySelectorAll('table[data-dyws-report-table],table[data-dyws-table]')].filter(table=>!tables.has(table));if(!pending.length)return;
  library??=import('./vendor/dataTables.min.js');const {default:DataTable}=await library;
  if(!root.isConnected)return;
  for(const table of pending){
   if(!table.isConnected||tables.has(table))continue;
   const state=states.get(table.dataset.dywsTable);
   const instance=new DataTable(table,{pageLength:state?.length||10,lengthMenu:[10,25,50],order:state?.order||[],stateSave:false,autoWidth:false,language:{search:'Search:',lengthMenu:'Rows _MENU_',emptyTable:'No orders or data yet',zeroRecords:'No matching rows',info:'_START_ to _END_ of _TOTAL_',infoEmpty:'No rows',infoFiltered:'(of _MAX_)'},...options,...(state?{order:state.order}:{} )});tables.set(table,instance);
   if(state)instance.search(state.search);ready?.(instance,table);
   if(state){instance.draw(false);instance.page(Math.min(state.page,Math.max(0,instance.page.info().pages-1))).draw('page');}
  }
 });
 plugin.onDestroy(()=>{for(const table of tables.keys())dispose(table,true);states.clear();});
}
