import test from 'node:test';
import assert from 'node:assert/strict';
import {dealBadge,dealCards} from '../public_html/dyws/deals.js';
test('quantity deal labels and merchant text render safely',()=>{
 assert.equal(dealBadge({type:'quantity',buyQuantity:1,getQuantity:1}),'2 for 1');
 assert.equal(dealBadge({type:'quantity',buyQuantity:1,getQuantity:2}),'3 for 1');
 const html=dealCards([{id:'deal',type:'quantity',buyQuantity:1,getQuantity:1,name:'<img src=x onerror=alert(1)>',description:'A & B',endsOn:'2026-12-31',schedule:'Mon',rule:'Example'}]);
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('A &amp; B'));
});
