import test from 'node:test';
import assert from 'node:assert/strict';
import {chartSVG,csvText,comparison} from '../public_html/plugins/order-reporting/charts.js';
import {register} from '../public_html/plugins/datatables/index.js';
test('SVG handles negative refunds, one day and escaped labels',()=>{
 const svg=chartSVG([{date:'<script>',net:-1234}],{title:'A & B',key:'net',label:'date'});
 assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('role="img"'));assert.ok(svg.includes('<desc>'));assert.ok(!/NaN|Infinity/.test(svg));assert.ok(svg.includes('-1234'));
 assert.ok(!/NaN|Infinity/.test(chartSVG([],{title:'Empty',key:'net',label:'date'})));
 assert.ok(chartSVG([{date:'today',count:0}],{title:'Zero',key:'count',label:'date',bars:true}).includes('<rect'));
});
test('CSV quotes values and neutralises spreadsheet formulas without losing numeric negatives',()=>{
 assert.equal(csvText([['=SUM(A1)', 'a,"b',-200,'\t@SUM(1)']]),'"\'=SUM(A1)","a,""b","-200","\'\t@SUM(1)"\r\n');
});
test('Comparison does not invent a percentage with a zero baseline',()=>{
 assert.equal(comparison(100,0),'No previous baseline');assert.equal(comparison(0,0),'No change');assert.match(comparison(150,100),/50.0%/);
});
test('DataTables uses the shared table lifecycle and remains lazy with no marked tables',async()=>{
 const hooks=new Map();let destroy;register({addAction:(name,fn)=>hooks.set(name,fn),onDestroy:fn=>destroy=fn});
 assert.ok(hooks.has('admin:tables'));await hooks.get('admin:tables')({root:{querySelectorAll:()=>[]},phase:'mount'});destroy();
});
test('Reporting exports use selected plugin metrics and explicit units',async()=>{
 const {register:registerReports}=await import('../public_html/plugins/order-reporting/index.js');const filters=new Map(),providers=new Map();
 registerReports({addAction(){},addFilter:(n,f)=>filters.set(n,f),provide:(n,f)=>providers.set(n,f)});
 const data={timeZone:'America/Toronto',currency:'USD',fulfillment:'delivery',range:{from:'2026-01-01',to:'2026-01-02'},current:{summary:{orders:2,netCollected:-500,preparationSeconds:60,completionRate:50}}};
 const rows=filters.get('reports:export')([],{key:'summary',report:{orderReporting:data}});
 assert.deepEqual(rows[1],['orders',2,'USD','count','2026-01-01','2026-01-02','delivery','America/Toronto']);assert.equal(rows[2][1],-500);assert.equal(rows[3][3],'seconds');assert.equal(rows[4][3],'percent');assert.ok(providers.has('reports.renderer'));
 assert.deepEqual(filters.get('reports:export')([],{key:'summary',report:{orderReportingError:'Invalid filter'}}),[['Error','Invalid filter']]);
});
