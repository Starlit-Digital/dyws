/** A cancellable final review. Hidden pages pause instead of submitting unseen. */
export function createConfirmationCountdown({seconds=10,onTick,onConfirm,onPause=()=>{},document:doc=globalThis.document,setTimer=setTimeout,clearTimer=clearTimeout}) {
 let remaining=seconds,timer,finished=false,paused=false;
 const clear=()=>{clearTimer(timer);doc?.removeEventListener?.('visibilitychange',visibility);};
 function confirm(){if(finished)return;finished=true;clear();onConfirm();}
 function pause(){if(finished||paused)return;paused=true;clear();onPause();}
 function visibility(){if(doc.hidden)pause();}
 function tick(){
  if(finished||paused)return;
  if(doc?.hidden){pause();return;}
  remaining--;onTick(remaining);
  if(remaining===0)confirm();else timer=setTimer(tick,1000);
 }
 doc?.addEventListener?.('visibilitychange',visibility);onTick(remaining);
 if(doc?.hidden)pause();else timer=setTimer(tick,1000);
 return {confirm,pause,cancel(){finished=true;clear();}};
}
