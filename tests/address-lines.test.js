import test from 'node:test';
import assert from 'node:assert/strict';
import {splitAddress} from '../public_html/dyws/address-lines.js';
test('address splits at city and preserves province and postal code',()=>{
 assert.deepEqual(splitAddress('123 Main Street, Edmonton, AB T5A 1A1'),['123 Main Street','Edmonton, AB T5A 1A1']);
 assert.deepEqual(splitAddress('123 Main Street Calgary AB'),['123 Main Street','Calgary AB']);
 assert.deepEqual(splitAddress('123 Main Street'),['123 Main Street']);
 assert.deepEqual(splitAddress('123 Edmonton Trail, Calgary, AB'),['123 Edmonton Trail','Calgary, AB']);
});
