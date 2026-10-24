import test from 'node:test';
import assert from 'node:assert/strict';
import {statusBadge} from '../public_html/dyws/status-badge.js';
test('Status indicators retain readable labels and distinct shapes without colour',()=>{
 assert.match(statusBadge('paid'),/success.*✓.*Paid/);
 assert.match(statusBadge('unpaid'),/warning.*!.*Unpaid/);
 assert.match(statusBadge('out_for_delivery'),/info.*→.*On the way/);
 assert.match(statusBadge('delivery'),/>Delivery<|Delivery<\/span>/);
});
test('Unknown status and custom labels cannot inject markup or colour rules',()=>{
 const html=statusBadge('<img src=x onerror=alert(1)>','<script>');
 assert.doesNotMatch(html,/<img|<script/);assert.match(html,/data-tone="neutral"/);assert.match(html,/&lt;script&gt;/);
 assert.match(statusBadge('__proto__'),/neutral/);
});
