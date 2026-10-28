export const isOnlinePayment=provider=>!!provider&&!['demo','pay-at-door','pay-at-restaurant'].includes(provider);
export const paymentChoiceLabel=method=>method==='pay_at_door'?'Pay at the door':method==='pay_at_restaurant'?'Pay at restaurant':'Pay now';
