import test from 'node:test';
import assert from 'node:assert/strict';
import {pluginType,pluginsOfType} from '../public_html/dyws/plugin-types.js';
test('Plugin categories retain unknown plugins and filter independent payment providers',()=>{
 const plugins=[{id:'square',type:'payments'},{id:'paypal',type:'payments'},{id:'order-format',type:'ordering'},{id:'extension',type:'future'}];
 assert.equal(pluginsOfType(plugins,'payments').length,2);assert.equal(pluginsOfType(plugins,'ordering')[0].id,'order-format');assert.equal(pluginType(plugins[3]),'other');assert.equal(pluginsOfType(plugins,'all').length,4);
});
