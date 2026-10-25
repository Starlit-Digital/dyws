export function formatPhoneInput(value){
 const text=String(value??''),digits=text.replace(/\D/g,'');
 if(!digits||digits.length>11||(digits.length===11&&digits[0]!=='1')||(/^\+/.test(text)&&digits[0]!=='1'))return text;
 const prefix=digits.length===11?'1 ':'';
 const local=digits.length===11?digits.slice(1):digits;
 if(local.length<=3)return prefix+'('+local;
 if(local.length<=6)return prefix+'('+local.slice(0,3)+') '+local.slice(3);
 return prefix+'('+local.slice(0,3)+') '+local.slice(3,6)+'-'+local.slice(6);
}
export function formatPhoneField(event){
 const input=event.target;if(input?.name!=='phone'||event.isComposing)return;
 const original=input.value,start=input.selectionStart,end=input.selectionEnd;
 const formatted=formatPhoneInput(original);if(formatted===original)return;
 const position=offset=>{
  if(offset===null)return formatted.length;
  const count=original.slice(0,offset).replace(/\D/g,'').length;
  if(!count)return 0;
  let seen=0;for(let i=0;i<formatted.length;i++)if(/\d/.test(formatted[i])&&++seen===count)return i+1;
  return formatted.length;
 };
 input.value=formatted;input.setSelectionRange?.(position(start),position(end));
}
