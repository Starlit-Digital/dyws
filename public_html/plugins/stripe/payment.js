/** Stripe owns its checkout action, pending copy and allowed redirect destination. */
export function renderStripePayment({api,document:doc,order,container,trackingToken,onError,navigate=url=>location.assign(url)}){
 if(order.paymentProvider!=='stripe'||order.paymentStatus!=='unpaid'||order.status!=='placed')return;
 if(!order.checkoutStatus||['creating','open'].includes(order.checkoutStatus)){
  const button=doc.createElement('button');button.type='button';button.textContent='Pay with Stripe';container.append(button);
  button.onclick=async()=>{
   button.disabled=true;
   try{
    const result=await api('/plugins/stripe/orders/'+order.id+'/checkout',{method:'POST',body:{},trackingToken});
    const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||url.username||url.password)throw new Error('Invalid payment link.');
    navigate(url.href);
   }catch(e){onError(e.message);button.disabled=false;}
  };
 }else{
  const note=doc.createElement('p');note.textContent=order.checkoutStatus==='pending'?'Waiting for Stripe to confirm payment. Do not place a duplicate order.':'Checkout '+order.checkoutStatus+'. Contact the business if you need help.';container.append(note);
 }
}
