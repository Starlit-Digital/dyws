import {canadianCities} from './canadian-cities.js';
const cityNames=new Set(canadianCities.map(name=>name.toLocaleLowerCase('en-CA')));
export function splitAddress(value,city=''){
 const text=String(value||'').trim();
 const names=city?new Set([city.toLocaleLowerCase('en-CA')]):cityNames;
 const boundaries=[...text.matchAll(/,\s*|\s+/g)].sort((a,b)=>Number(b[0].startsWith(','))-Number(a[0].startsWith(',')));
 for(const delimiter of boundaries){
  const start=delimiter.index+delimiter[0].length,tail=text.slice(start);
  const ends=[...tail.matchAll(/,|\s+(?=(?:AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b)/gi)].map(match=>match.index);
  ends.push(tail.length);
  for(const end of ends.reverse())if(names.has(tail.slice(0,end).trim().toLocaleLowerCase('en-CA'))){
   const street=text.slice(0,delimiter.index).replace(/,\s*$/,'').trim();
   if(street)return [street,tail];
  }
 }
 return [text];
}
