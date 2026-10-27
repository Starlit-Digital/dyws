/** Whole dollars at entry, integer cents everywhere else. */
export function tipCents(value,enabled=true){
 if(!enabled)return 0;
 if(typeof value!=='string'||!/^\d{1,6}$/.test(value))throw new Error('Enter a tip in whole dollars, from 0 to 999999.');
 return Number(value)*100;
}
