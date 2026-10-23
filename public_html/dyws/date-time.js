/** Persist UTC seconds on the server; format instants only at the display boundary. */
let timeZone='America/Edmonton';
export function configureTimeZone(value){
 if(typeof value!=='string')return;
 try{new Intl.DateTimeFormat('en-CA',{timeZone:value});timeZone=value;}catch{/* Keep the last valid server setting. */}
}
export const getTimeZone=()=>timeZone;
export const formatTime=seconds=>new Intl.DateTimeFormat('en-CA',{timeZone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(seconds*1000));
export const formatDateTime=seconds=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(seconds*1000));
export const dateKey=(millis=Date.now())=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(millis));
 const value=type=>parts.find(part=>part.type===type).value;
 return `${value('year')}-${value('month')}-${value('day')}`;
};
