import test from 'node:test';
import assert from 'node:assert/strict';
import {isOnlinePayment,paymentChoiceLabel} from '../public_html/dyws/payment-choice.js';
test('door collection never requires online payment UI',()=>{
 for(const provider of ['demo','pay-at-door','pay-at-restaurant',undefined,''])assert.equal(isOnlinePayment(provider),false);
 for(const provider of ['stripe','square'])assert.equal(isOnlinePayment(provider),true);
 assert.equal(paymentChoiceLabel('pay_at_door'),'Pay at the door');assert.equal(paymentChoiceLabel('pay_at_restaurant'),'Pay at pickup');
});
