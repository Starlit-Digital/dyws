/** Fixed local artwork. Profile values never become paths or executable markup. */
export const driverIcons=Object.freeze([
 {id:'car',label:'Car'}, {id:'suv',label:'SUV'}, {id:'pickup',label:'Pickup'},
 {id:'van',label:'Van'}, {id:'motorcycle',label:'Motorcycle'}, {id:'bicycle',label:'Bicycle'}
].map(icon=>Object.freeze({...icon,url:new URL('./icons/driver/'+icon.id+'.svg',import.meta.url).href})));
export const driverIcon=value=>driverIcons.find(icon=>icon.id===value)||driverIcons[0];
export const driverIconImage=value=>`<img class="dyws-driver-avatar" src="${driverIcon(value).url}" width="48" height="56" alt="${driverIcon(value).label} icon">`;
