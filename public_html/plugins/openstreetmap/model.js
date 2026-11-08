export function visibleGroups(groups,layers){return groups.filter(group=>layers.has(group.layer));}
export function orderRadius(count){return Math.min(32,8+Math.sqrt(Math.max(0,Number(count)||0))*2);}
export function orderMapURL(point){const url=new URL('https://www.openstreetmap.org/');url.searchParams.set('mlat',String(point.latitude));url.searchParams.set('mlon',String(point.longitude));url.hash=`map=13/${point.latitude}/${point.longitude}`;return url.href;}
export function mapSummary(data){return `${data.mappedOrders} mapped · ${data.unmappedOrders} without a location${data.omittedOrders?` · ${data.omittedOrders} beyond the 10,000 order limit`:''}`;}
