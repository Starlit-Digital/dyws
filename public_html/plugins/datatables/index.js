/** DataTables is optional. Tables stay usable if loading or enhancement fails. */
export function register(plugin) {
 const tables=new Map();let library;
 const dispose=table=>{tables.get(table)?.destroy();tables.delete(table);};
 plugin.addAction('admin:tables',async({root,phase='mount'})=>{
  for(const table of tables.keys())if(!table.isConnected||(phase==='dispose'&&root.contains(table)))dispose(table);
  if(phase==='dispose')return;
  const pending=[...root.querySelectorAll('table[data-dyws-report-table]')].filter(table=>!tables.has(table));if(!pending.length)return;
  library??=import('./vendor/dataTables.min.js');const {default:DataTable}=await library;
  if(!root.isConnected)return;
  for(const table of pending){
   if(!table.isConnected||tables.has(table))continue;
   const instance=new DataTable(table,{pageLength:10,lengthMenu:[10,25,50],order:[],stateSave:false,autoWidth:false,language:{search:'Search table:',lengthMenu:'Rows _MENU_',emptyTable:'No data in this range',zeroRecords:'No matching rows',info:'_START_ to _END_ of _TOTAL_',infoEmpty:'No rows',infoFiltered:'(of _MAX_)'}});tables.set(table,instance);
  }
 });
 plugin.onDestroy(()=>{for(const table of tables.keys())dispose(table);});
}
