/** Pass fragment credentials privately to PHP. No customer details are stored. */
(()=>{
 let id,token;try{[id,token]=location.hash.slice(1).split('.').map(decodeURIComponent);}catch{return;}
 if(!/^[A-Z]{2,7}-[A-F0-9]{12}$/.test(id||'')||!/^[a-f0-9]{64}$/.test(token||''))return;
 const form=document.createElement('form');form.method='post';form.action=location.pathname+(new URL(location.href).searchParams.get('diagnostics')==='1'?'?diagnostics=1':'');form.hidden=true;
 for(const [name,value] of Object.entries({orderId:id,trackingToken:token})){const field=document.createElement('input');field.type='hidden';field.name=name;field.value=value;form.append(field);}
 document.querySelector('[data-dyws-tracking-help]')?.remove();const skeleton=document.querySelector('[data-dyws-handoff]');if(skeleton)skeleton.hidden=false;
 history.replaceState(null,'',form.action);document.body.append(form);form.submit();
})();
