/** Short lived cache of OUR GPS measurements, not Google Maps content. Never persisted. */
export function createGPSCache({ttl=120000,now=Date.now}={}){
 let value=null;
 return {
  set(position){
   if(!position||![position.latitude,position.longitude,position.recorded_at].every(Number.isFinite)||Math.abs(position.latitude)>90||Math.abs(position.longitude)>180||position.recorded_at*1000>now()+30000||position.recorded_at*1000+ttl<=now()){value=null;return null;}
   value={...position};return {...value};
  },
  get(){if(value&&value.recorded_at*1000+ttl<=now())value=null;return value?{...value}:null;},
  clear(){value=null;}
 };
}
