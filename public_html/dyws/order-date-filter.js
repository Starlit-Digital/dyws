import {dateKey} from './date-time.js';

/** Compare civil dates in the business timezone, including across DST changes. */
export function orderDateRange(preset,now=Date.now()) {
 if(!preset)return null;
 const today=dateKey(now),start=new Date(today+'T00:00:00Z'),end=new Date(start);
 if(preset==='today')end.setUTCDate(end.getUTCDate()+1);
 else if(preset==='yesterday')start.setUTCDate(start.getUTCDate()-1);
 else if(preset==='week'){
  start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);
  end.setTime(start.getTime());end.setUTCDate(end.getUTCDate()+7);
 }else if(preset==='month'){
  start.setUTCDate(1);end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1);
 }else return null;
 return {from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)};
}
export function matchesOrderDate(day,range){return !range||(day>=range.from&&day<range.to);}
