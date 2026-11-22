import test,{type TestContext} from "node:test";
import assert from "node:assert/strict";
import { attachMonthTouchRange,MONTH_LONG_PRESS_MS,type MonthRange } from "../lib/month-touch-range";
import { addDate } from "../lib/planner";

function setup(t:TestContext){
  t.mock.timers.enable({apis:["setTimeout"]});
  const previous=Object.getOwnPropertyDescriptor(globalThis,"window"),page=new EventTarget();
  Object.defineProperty(globalThis,"window",{configurable:true,value:page});
  const surface=new EventTarget(),previews:(MonthRange|null)[]=[],chosen:MonthRange[]=[];
  const dispose=attachMonthTouchRange(surface as HTMLElement,{
    dateAt:(x,y)=>x>=0&&x<350&&y>=0&&y<250?addDate("2026-11-23",Math.floor(y/50)*7+Math.floor(x/50)):undefined,
    onPreview:value=>previews.push(value),onChoose:value=>chosen.push(value),
  });
  t.after(()=>{dispose();if(previous)Object.defineProperty(globalThis,"window",previous);else Reflect.deleteProperty(globalThis,"window");});
  const touch=(x=25,y=25,id=1)=>({clientX:x,clientY:y,identifier:id});
  const send=(type:string,points=[touch()],cancelable=true)=>{
    const event=new Event(type,{cancelable});
    Object.assign(event,{touches:type==="touchend"?[]:points,changedTouches:points});
    surface.dispatchEvent(event);return event;
  };
  return {page,surface,previews,chosen,send,touch,dispose,tick:(ms=MONTH_LONG_PRESS_MS)=>t.mock.timers.tick(ms)};
}

test("휴대폰 짧은 탭은 날짜 선택을 유지하고 할 일 창을 열지 않는다",t=>{
  const h=setup(t);h.send("touchstart");h.tick(MONTH_LONG_PRESS_MS-1);
  assert.equal(h.send("touchend").defaultPrevented,false);h.tick();
  assert.deepEqual(h.chosen,[]);assert.equal(h.previews.some(Boolean),false);
});

test("길게 누른 뒤 여러 주·월을 가로질러 드래그하면 선택 기간을 한 번 전달한다",t=>{
  const h=setup(t);h.send("touchstart");h.tick();
  assert.deepEqual(h.previews.at(-1),{start:"2026-11-23",end:"2026-11-23"});
  assert.equal(h.send("touchmove",[h.touch(125,75)]).defaultPrevented,true);
  assert.deepEqual(h.previews.at(-1),{start:"2026-11-23",end:"2026-12-02"});
  assert.equal(h.send("touchend",[h.touch(125,75)]).defaultPrevented,true);
  h.send("touchend",[h.touch(125,75)]);
  assert.deepEqual(h.chosen,[{start:"2026-11-23",end:"2026-12-02"}]);assert.equal(h.previews.at(-1),null);
});

test("역방향 드래그와 단일 날짜의 길게 누르기도 올바른 기간으로 전달한다",t=>{
  const h=setup(t);h.send("touchstart",[h.touch(125,75)]);h.tick();h.send("touchmove");h.send("touchend");
  assert.deepEqual(h.chosen[0],{start:"2026-11-23",end:"2026-12-02"});
  h.send("touchstart");h.tick();h.send("touchend");
  assert.deepEqual(h.chosen[1],{start:"2026-11-23",end:"2026-11-23"});
});

test("길게 누르기 전 스크롤과 여러 손가락 동작은 선택을 취소하고 스크롤을 막지 않는다",t=>{
  const h=setup(t);h.send("touchstart");
  assert.equal(h.send("touchmove",[h.touch(25,50)]).defaultPrevented,false);
  h.tick();h.send("touchend");assert.deepEqual(h.chosen,[]);
  h.send("touchstart");h.tick();h.send("touchstart",[h.touch(),h.touch(30,30,2)]);h.tick();h.send("touchend");
  assert.deepEqual(h.chosen,[]);assert.equal(h.previews.at(-1),null);
});

test("작은 손떨림은 허용하고 활성 선택 중 기본 메뉴만 차단한다",t=>{
  const h=setup(t);h.send("touchstart");
  assert.equal(h.send("contextmenu").defaultPrevented,false);
  h.send("touchmove",[h.touch(28,29)]);h.tick();
  assert.equal(h.send("contextmenu").defaultPrevented,true);
  h.send("touchend");assert.equal(h.chosen.length,1);
});

test("달력 밖에서 놓기·터치 취소·페이지 이탈·해제 후에는 새 할 일을 만들지 않는다",t=>{
  const h=setup(t);
  h.send("touchstart");h.tick();h.send("touchend",[h.touch(-1,-1)]);
  h.send("touchstart");h.send("touchcancel");h.tick();h.send("touchend");
  h.send("touchstart");h.tick();h.page.dispatchEvent(new Event("blur"));h.send("touchend");
  h.send("touchstart");h.page.dispatchEvent(new Event("pagehide"));h.tick();h.send("touchend");
  h.send("touchstart");h.dispose();h.tick();h.send("touchend");
  assert.deepEqual(h.chosen,[]);assert.equal(h.previews.at(-1),null);
});

test("이미 브라우저 스크롤이 된 취소 불가 이동에서는 범위를 저장하지 않는다",t=>{
  const h=setup(t);h.send("touchstart");h.tick();
  h.send("touchmove",[h.touch(125,75)],false);h.send("touchend");
  assert.deepEqual(h.chosen,[]);
});
