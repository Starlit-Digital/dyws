import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRoleLabels,loadRole,defaultRole} from '../public_html/dyws/role-labels.js';
test('Role labels use text nodes and do not recursively substitute user text',()=>{
 const node={dataset:{dywsRoleText:'Add {role} to {roles}'},textContent:''};
 applyRoleLabels({querySelectorAll:()=>[node]},{singular:'<Admin> {roles}',plural:'Handlers'});
 assert.equal(node.textContent,'Add <Admin> {roles} to Handlers');
});
test('Role labels fall back when settings cannot load',async()=>{
 assert.deepEqual(await loadRole(async()=>{throw new Error('offline');}),defaultRole);
});
