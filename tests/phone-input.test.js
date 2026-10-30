import test from 'node:test';
import assert from 'node:assert/strict';
import {formatPhoneInput,formatPhoneField} from '../public_html/dyws/phone-input.js';
test('checkout phone formats partial typing and pasted local numbers',()=>{
 assert.equal(formatPhoneInput('780555014'),'(780) 555-014');
 assert.equal(formatPhoneInput('7805550142'),'(780) 555-0142');
 assert.equal(formatPhoneInput('+1 7805550142'),'1 (780) 555-0142');
 assert.equal(formatPhoneInput('+44 2071234567'),'+44 2071234567');
 assert.equal(formatPhoneInput(''),'');
});
test('delegated phone input retains position when editing in the middle',()=>{
 const input={name:'phone',value:'780555014',selectionStart:4,selectionEnd:4,setSelectionRange(a,b){this.selection=[a,b];}};
 formatPhoneField({target:input});assert.equal(input.value,'(780) 555-014');assert.deepEqual(input.selection,[7,7]);
 const other={name:'customer',value:'7805550142'};formatPhoneField({target:other});assert.equal(other.value,'7805550142');
});

test('business and location telephone fields format as they are edited',()=>{
 for(const input of [{name:'businessPhone',type:'tel',value:'7805550142',selectionStart:10,selectionEnd:10,setSelectionRange(){}},{dataset:{locationField:'phone'},value:'7805550142',selectionStart:10,selectionEnd:10,setSelectionRange(){}}]){formatPhoneField({target:input});assert.equal(input.value,'(780) 555-0142');}
});
