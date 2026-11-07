/** Inclusive rolling calendar periods, expressed as store local date keys. */
export function periodStart(today,period) {
 const end=new Date(today+'T12:00:00Z');
 if(period==='month'){end.setUTCDate(1);return end.toISOString().slice(0,10);}
 const months={'3m':3,'6m':6,year:12}[period];
 if(months){const day=end.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()-months);const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();end.setUTCDate(Math.min(day,last)+1);}
 else{const days=Number(period);if(!Number.isInteger(days)||days<1)throw new RangeError('Unknown report period');end.setUTCDate(end.getUTCDate()-days+1);}
 return end.toISOString().slice(0,10);
}
