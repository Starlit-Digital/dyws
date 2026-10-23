import test from 'node:test';
import assert from 'node:assert/strict';
import {safeTimingPath,traceLoad} from '../public_html/dyws/diagnostics.js';
test('diagnostic paths discard credentials, queries, fragments and order identifiers',()=>{
 assert.equal(safeTimingPath('https://example.test/api/?key=secret#token'),'/api/');
 assert.equal(safeTimingPath('/manager/orders/DYWS-123456789ABC/status?token=secret'),'/manager/orders/:order/status');
});
test('disabled diagnostics preserve results and failures',async()=>{
 assert.equal(await traceLoad('test',()=>42),42);
 await assert.rejects(traceLoad('test',()=>{throw new Error('failed');}),/failed/);
});
