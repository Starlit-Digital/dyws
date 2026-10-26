/** Use the existing protected browser form, including its CSRF cookie and token. */
export async function signInDemo(role,{document:doc=globalThis.document,request=globalThis.fetch,parse=html=>new DOMParser().parseFromString(html,'text/html'),navigate=url=>doc.defaultView.location.assign(url),baseURL=new URL('../../',import.meta.url)}={}){
 const account={admin:{path:'auth/',destination:'orders/',field:'username'},driver:{path:'driver/',destination:'driver/',field:'driverId'}}[role];
 if(!account)throw new Error('Choose the Admin or Driver demo.');
 const target=new URL(account.path,baseURL),destination=new URL(account.destination,baseURL);
 const response=await request(target.href,{credentials:'same-origin',mode:'same-origin',cache:'no-store'});
 if(!response.ok||![target.href,destination.href].includes(response.url))throw new Error('Demo sign in is temporarily unavailable.');
 if(role==='admin'&&response.url===destination.href){navigate(destination.href);return;}
 const page=parse(await response.text());
 if(role==='driver'&&page.querySelector('#driver-board:not([hidden])')){navigate(destination.href);return;}
 const csrf=page.querySelector('form input[name="csrf"]')?.value;
 if(!/^[a-f0-9]{64}$/.test(csrf||''))throw new Error('The sign in form could not be loaded.');
 const form=doc.createElement('form');form.method='post';form.action=target.href;form.hidden=true;
 for(const [name,value]of Object.entries({csrf,[account.field]:role,password:role})){
  const input=doc.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input);
 }
 doc.body.append(form);
 try{form.submit();}catch(error){form.remove();throw error;}
}
