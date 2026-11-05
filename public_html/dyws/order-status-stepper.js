import {escapeHTML as esc} from './api.js';
export const orderStatusLabels={placed:'Order received',accepted:'Accepted',preparing:'Preparing',ready:'Ready',out_for_delivery:'Out for delivery',delivered:'Delivered',completed:'Completed',cancelled:'Cancelled'};
export function orderStatusSteps(order){return ['placed','accepted','preparing','ready',...(order.fulfillment==='delivery'?['out_for_delivery','delivered']:['completed'])];}
/** Render a semantic horizontal sequence. With no manager capability it is read only. */
export function statusStepperHTML(order){
 const controls=order.statusControls,steps=orderStatusSteps(order),index=steps.indexOf(order.status),editable=!!controls?.editable;
 const attributes=(action,status='')=>`data-dyws-status-action="${action}" data-dyws-status="${esc(status)}" data-dyws-status-revision="${esc(controls?.revision||'')}"`;
 return `<section class="dyws-order-status-stepper" aria-label="Order status"><div class="dyws-stepper-ends"><span>Beginning</span><span>End</span></div><ol class="dyws-stepper-track">${steps.map((state,i)=>{
  const label=`<span class="dyws-step-number" aria-hidden="true">${i+1}</span><span>${esc(orderStatusLabels[state])}</span>`,current=state===order.status;
  return `<li class="${i<index?'dyws-step-done':''}" ${current?'aria-current="step"':''}>${editable?`<button type="button" ${attributes('set',state)} aria-label="Set status to ${esc(orderStatusLabels[state])}" ${current||!controls.allowedStatuses.includes(state)?'disabled':''}>${label}</button>`:`<span class="dyws-step-label">${label}</span>`}</li>`;
 }).join('')}</ol>${order.status==='cancelled'?'<p class="dyws-stepper-cancelled">Cancelled</p>':''}${controls?`<div class="dyws-stepper-actions"><button type="button" ${attributes('undo')} ${!controls.canUndo?'disabled':''}>Undo status</button><button type="button" ${attributes('redo')} ${!controls.canRedo?'disabled':''}>Redo status</button>${editable&&order.status!=='cancelled'&&controls.allowedStatuses.includes('cancelled')?`<button type="button" ${attributes('set','cancelled')}>Set cancelled</button>`:''}</div><p class="dyws-stepper-note">${editable?'Demo status only. Payment records stay unchanged.':'Status correction is unavailable for this order. Normal order controls still apply.'}</p>`:''}</section>`;
}
export function statusStepperAction(button){return {action:button.dataset.dywsStatusAction,...(button.dataset.dywsStatus?{status:button.dataset.dywsStatus}:{}),revision:button.dataset.dywsStatusRevision};}
