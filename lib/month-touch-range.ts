export const MONTH_LONG_PRESS_MS=400;
export const MONTH_TOUCH_SLOP=10;
export type MonthRange={start:string;end:string};
type Options={
  dateAt:(x:number,y:number)=>string|undefined;
  onPreview:(range:MonthRange|null)=>void;
  onChoose:(range:MonthRange)=>void;
};

/** Keep normal touch scrolling until a stationary long press explicitly selects dates.
 * touchmove must be non-passive: changing touch-action after pointerdown cannot
 * reclaim an in-progress browser pan on iOS/Android.
 */
export function attachMonthTouchRange(grid:HTMLElement,{dateAt,onPreview,onChoose}:Options){
  let gesture:{id:number;start:string;x:number;y:number;active:boolean}|null=null;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const reset=()=>{if(timer!==undefined)clearTimeout(timer);timer=undefined;gesture=null;onPreview(null);};
  const normalized=(a:string,b:string):MonthRange=>a<=b?{start:a,end:b}:{start:b,end:a};
  function start(event:TouchEvent){
    reset();
    if(event.touches.length!==1)return;
    const touch=event.touches[0],date=dateAt(touch.clientX,touch.clientY);
    if(!date)return;
    const pending={id:touch.identifier,start:date,x:touch.clientX,y:touch.clientY,active:false};
    gesture=pending;
    timer=setTimeout(()=>{
      timer=undefined;
      if(gesture!==pending)return;
      pending.active=true;onPreview(normalized(date,date));
    },MONTH_LONG_PRESS_MS);
  }
  function move(event:TouchEvent){
    if(!gesture)return;
    const touch=Array.from(event.touches).find(t=>t.identifier===gesture!.id);
    if(event.touches.length!==1||!touch){reset();return;}
    if(!gesture.active){
      if(Math.hypot(touch.clientX-gesture.x,touch.clientY-gesture.y)>MONTH_TOUCH_SLOP)reset();
      return;
    }
    if(!event.cancelable){reset();return;}
    event.preventDefault();
    const end=dateAt(touch.clientX,touch.clientY);
    onPreview(end?normalized(gesture.start,end):null);
  }
  function end(event:TouchEvent){
    const current=gesture;
    const touch=current&&Array.from(event.changedTouches).find(t=>t.identifier===current.id);
    if(!current||!touch)return;
    if(!current.active){reset();return;}
    // Also suppress a compatibility click when a long press stays in one cell.
    if(event.cancelable)event.preventDefault();
    const date=dateAt(touch.clientX,touch.clientY),chosen=date?normalized(current.start,date):null;
    reset();
    if(chosen)onChoose(chosen);
  }
  const context=(event:Event)=>{if(gesture?.active)event.preventDefault();};
  grid.addEventListener("touchstart",start,{passive:true});
  grid.addEventListener("touchmove",move,{passive:false});
  grid.addEventListener("touchend",end,{passive:false});
  grid.addEventListener("touchcancel",reset);
  grid.addEventListener("contextmenu",context);
  window.addEventListener("blur",reset);
  window.addEventListener("pagehide",reset);
  return ()=>{
    reset();
    grid.removeEventListener("touchstart",start);
    grid.removeEventListener("touchmove",move);
    grid.removeEventListener("touchend",end);
    grid.removeEventListener("touchcancel",reset);
    grid.removeEventListener("contextmenu",context);
    window.removeEventListener("blur",reset);
    window.removeEventListener("pagehide",reset);
  };
}
