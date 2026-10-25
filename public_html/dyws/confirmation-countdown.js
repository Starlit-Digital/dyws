/** A cancellable final review. Hidden pages pause instead of submitting unseen. */
export function createConfirmationCountdown({seconds=10,onTick,onConfirm,onPause=()=>{},onResume=()=>{},document:doc=globalThis.document,setTimer=setTimeout,clearTimer=clearTimeout}) {
 let remaining=seconds,timer,finished=false,paused=false,generation=0;
 const clear=()=>{generation++;clearTimer(timer);doc?.removeEventListener?.('visibilitychange',visibility);};
 function confirm(){if(finished)return;finished=true;clear();onConfirm();}
 function pause(){if(finished||paused)return;paused=true;clear();onPause();}
 function schedule(){const current=generation;timer=setTimer(()=>{if(current===generation)tick();},1000);}
 function resume(){if(finished||!paused||doc?.hidden)return;paused=false;doc?.addEventListener?.('visibilitychange',visibility);onResume();onTick(remaining);schedule();}
 function toggle(){if(paused)resume();else pause();}
 function visibility(){if(doc.hidden)pause();}
 function tick(){
  if(finished||paused)return;
  if(doc?.hidden){pause();return;}
  remaining--;onTick(remaining);
  if(remaining===0)confirm();else schedule();
 }
 doc?.addEventListener?.('visibilitychange',visibility);onTick(remaining);
 if(doc?.hidden)pause();else schedule();
 return {confirm,pause,resume,toggle,cancel(){finished=true;clear();}};
}
