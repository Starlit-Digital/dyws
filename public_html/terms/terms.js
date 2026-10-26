import {createAPIClient} from '../dyws/api.js';
const api=createAPIClient(new URL('../api/',import.meta.url));
const button=document.querySelector('#forget-details'),status=document.querySelector('#saved-details-status');
async function load(){
 try{const state=await api('/guest-details',{guest:true});button.hidden=!state.profileId;status.textContent=state.profileId?'You can remove the details saved for this browser here.':'No details are saved for this browser.';}
 catch{status.textContent='Saved details could not be checked. Refresh this page to try again.';}
}
button.onclick=async()=>{
 button.disabled=true;
 try{await api('/guest-details',{method:'POST',guest:true,body:{action:'forget'}});button.hidden=true;status.textContent='Your saved details have been removed.';}
 catch{status.textContent='Your saved details could not be removed. Please try again.';}
 finally{button.disabled=false;}
};
void load();
