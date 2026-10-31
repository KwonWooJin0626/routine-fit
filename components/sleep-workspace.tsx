"use client";
import { useEffect,useState } from "react";
import { Moon,Sun,Check,Mail } from "lucide-react";
import { defaultSleepSettings,koreanDate,koreanTime,plannedSleepTime,sleepSessionDate,sleepSettingsSchema,type SleepRecord,type SleepSettings } from "@/lib/sleep";
import type { SleepProfile } from "@/lib/sleep-api";
import { Input,Toggle } from "./forms";
import { ChoiceButtons } from "./choice-buttons";

async function sleepApi(method="GET",body?:unknown){const res=await fetch("/api/sleep",{method,headers:{"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();if(!res.ok)throw Error(data.error??"요청을 처리하지 못했어요.");return data;}
const display=(value:string|null)=>value?new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"미입력";
export function SleepWorkspace({demo,initialBed,initialWake,onPetRecord,onRecordsChange}:{demo:boolean;initialBed:string;initialWake:string;onPetRecord?:(bed:SleepRecord,wake:SleepRecord)=>void;onRecordsChange?:(records:SleepRecord[])=>Promise<void>}){
  const [settings,setSettings]=useState<SleepSettings>(()=>defaultSleepSettings(initialBed,initialWake)),[profile,setProfile]=useState<SleepProfile|null>(null),[records,setRecords]=useState<SleepRecord[]>([]);
  const [capability,setCapability]=useState({mailConfigured:false,schedulerConfigured:false}),[loading,setLoading]=useState(!demo),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [editing,setEditing]=useState<SleepRecord|null>(null),[actual,setActual]=useState("");
  useEffect(()=>{if(demo)return;let active=true;sleepApi().then(data=>{if(!active)return;setProfile(data.profile);if(data.profile)setSettings(data.profile.settings);setRecords(data.records);setCapability(data);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[demo]);
  const perform=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError("");setNotice("");try{await action();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const save=()=>void perform(async()=>{
    const result=sleepSettingsSchema.safeParse(settings);if(!result.success)throw Error(result.error.issues[0].message);
    if(demo)setProfile({settings:result.data,revision:(profile?.revision??0)+1,email:""});else {const data=await sleepApi("PUT",{settings:result.data,revision:profile?.revision??0});setProfile(data.profile);}
    setNotice("목표를 저장했어요. 설정 저장 시각을 실제 취침·기상으로 기록하지 않아요.");
  });
  const checkin=(kind:"bed"|"wake")=>void perform(async()=>{
    if(!profile)throw Error("목표를 먼저 저장해주세요.");
    let record:SleepRecord;
    if(demo){const now=new Date(),date=sleepSessionDate(kind,now,profile.settings),old=records.find(r=>r.sessionDate===date&&r.kind===kind);record=old??{id:`demo-${date}-${kind}`,sessionDate:date,kind,plannedAt:plannedSleepTime(date,kind,profile.settings),checkedAt:now.toISOString(),actualAt:null,method:kind==="bed"&&profile.settings.bedReference==="alarm-setting"?"alarm-setting":"web",updatedAt:now.toISOString()};}
    else record=(await sleepApi("POST",{kind})).record;
    const next=[record,...records.filter(r=>r.id!==record.id)].slice(0,180);await onRecordsChange?.(next);setRecords(next);setNotice(`${kind==="bed"?"취침 준비":"기상"} 체크인을 기록했어요. 같은 날 반복 클릭해도 최초 확인 시각을 유지해요.`);
  });
  const correct=()=>void perform(async()=>{
    if(!editing)return;const actualAt=actual?new Date(`${actual}:00+09:00`).toISOString():null;
    if(actualAt&&(new Date(actualAt)>new Date()||Math.abs(new Date(actualAt).getTime()-new Date(editing.checkedAt).getTime())>36*3600000))throw Error("미래 시각이나 확인 시각에서 36시간 넘게 떨어진 시각은 입력할 수 없어요.");
    const record=demo?{...editing,actualAt,updatedAt:new Date().toISOString()}:(await sleepApi("PATCH",{id:editing.id,actualAt})).record;
    const next=records.map(r=>r.id===record.id?record:r);await onRecordsChange?.(next);setRecords(next);setEditing(null);setNotice("자기보고 시각을 수정했어요. 최초 체크인 시각은 유지돼요.");
  });
  if(loading)return <section className="panel"><p>수면 기록을 불러오고 있어요.</p></section>;
  const available=capability.mailConfigured&&capability.schedulerConfigured&&!demo;
  return <div className="sleep-grid">
    {error&&<div role="alert" className="error-banner">{error}<button className="text-link" onClick={()=>window.location.reload()}>다시 불러오기</button></div>}{notice&&<p role="status" className="sleep-success"><Check size={16}/>{notice}</p>}
    <section className="panel sleep-settings"><span className="eyebrow">MY SLEEP TARGETS</span><h2>취침·기상 목표</h2><p>한국 시간 기준이에요. 목표와 실제 수면 기록은 달라요.</p><div className="form-grid"><Input label="취침 준비 목표" type="time" value={settings.bed} onChange={bed=>setSettings(s=>({...s,bed}))}/><Input label="기상 목표" type="time" value={settings.wake} onChange={wake=>setSettings(s=>({...s,wake}))}/></div><fieldset><legend>기상일 기준 적용 요일</legend><div className="choice-buttons">{["일","월","화","수","목","금","토"].map((label,i)=><button type="button" key={label} aria-pressed={settings.weekdays.includes(i)} onClick={()=>setSettings(s=>({...s,weekdays:s.weekdays.includes(i)?s.weekdays.filter(d=>d!==i):[...s.weekdays,i]}))}>{label}</button>)}</div></fieldset><div className="sleep-status">월요일 기상일을 선택하면, 월요일 기상 목표와 그에 앞선 취침 준비 목표에 적용해요. 체크인은 요일과 관계없이 직접 기록할 수 있어요.</div><ChoiceButtons label="취침 준비를 어떻게 남길까요?" value={settings.bedReference} options={{checkin:"잠자리에 들 때 직접 체크", "alarm-setting":"알람을 맞췄을 때 직접 체크"}} onChange={v=>setSettings(s=>({...s,bedReference:v as SleepSettings["bedReference"]}))}/><p className="muted">휴대전화 알람을 자동으로 읽지 않아요. ‘알람을 맞췄어요’ 버튼을 누른 시각만 취침 준비 기준으로 기록해요.</p>
      <div className={`sleep-status ${!available?"sleep-email-pending":""}`}><Mail size={17}/>{available?"Resend 메일 알림을 사용할 수 있어요. 아래에서 직접 켜주세요.":"Resend 메일 설정 대기 · 지금은 웹 체크인을 사용할 수 있어요. 발송 키·인증된 발신 주소·예약 실행 연결 후 메일을 켤 수 있어요."}</div>
      {available?<Toggle label="설정한 요일·시각에 취침·기상 안내 메일 받기" checked={settings.emailEnabled} onChange={emailEnabled=>setSettings(s=>({...s,emailEnabled}))} hint="언제든 끌 수 있어요. 메일은 전달이 지연될 수 있으므로 기상 알람은 휴대전화에서 사용해주세요."/>:settings.emailEnabled?<button className="button secondary" onClick={()=>setSettings(s=>({...s,emailEnabled:false}))}>메일 알림 중지하고 웹 체크인 사용</button>:null}
      <button className="button primary" disabled={busy||!!error||!settings.weekdays.length} onClick={save}>목표·알림 설정 저장</button>
    </section>
    <section className="panel sleep-checkin"><h2>지금 체크인하기</h2><p>버튼을 누른 확인 시각을 기록해요. 실제 잠든 시각·눈을 뜬 시각의 증명은 아니에요.</p><div className="choice-buttons"><button className="button secondary" disabled={busy||!profile} onClick={()=>checkin("bed")}><Moon size={17}/>{profile?.settings.bedReference==="alarm-setting"?"지금 알람을 맞췄어요":"이제 잠자리에 들어요"}</button><button className="button primary" disabled={busy||!profile} onClick={()=>checkin("wake")}><Sun size={17}/>일어났어요</button></div>{!profile&&<p className="muted">목표를 먼저 저장하면 체크인을 남길 수 있어요.</p>}</section>
    {onPetRecord&&<section className="panel pet-sleep-link"><h2>확인한 수면을 사모예드에게 연결</h2><p>취침·기상 두 실제 시각이 모두 있어야 해요. 체크인 버튼 시각이나 알람 설정만으로는 반영하지 않아요.</p>{Array.from(new Set(records.map(r=>r.sessionDate))).sort().reverse().map(date=>{const bed=records.find(r=>r.sessionDate===date&&r.kind==="bed"),wake=records.find(r=>r.sessionDate===date&&r.kind==="wake");return <div className="pet-sleep-session" key={date}><div><b>{date}</b><p>{bed?.actualAt&&wake?.actualAt?`${display(bed.actualAt)} ~ ${display(wake.actualAt)}`:"아래에서 취침·기상 실제 시각을 입력해주세요."}</p></div><button className="button secondary" disabled={busy||!bed?.actualAt||!wake?.actualAt} onClick={()=>bed&&wake&&onPetRecord(bed,wake)}>실제 수면 확인·반영</button></div>;})}{!records.length&&<p className="muted">먼저 체크인을 남기고 실제 시각을 확인해주세요.</p>}</section>}
    <section className="panel sleep-records"><h2>내 수면 체크인 기록</h2><p>날짜는 기상일 기준이에요. 미확인은 실패로 처리하지 않아요. 취침 준비와 기상 확인 사이의 간격을 실제 수면시간으로 계산하지 않아요.</p>{records.length?<div className="record-table"><table><thead><tr><th>기상일</th><th>종류</th><th>목표</th><th>최초 확인</th><th>자기보고 시각</th><th>관리</th></tr></thead><tbody>{[...records].sort((a,b)=>b.checkedAt.localeCompare(a.checkedAt)).map(r=><tr key={r.id}><td>{r.sessionDate}</td><td>{r.kind==="bed"?"취침 준비":"기상"}{r.method==="alarm-setting"?" · 알람 설정":""}</td><td>{display(r.plannedAt)}</td><td>{display(r.checkedAt)}</td><td>{display(r.actualAt)}</td><td><button className="text-link" disabled={busy} onClick={()=>{setEditing(r);setActual(r.actualAt?`${koreanDate(new Date(r.actualAt))}T${koreanTime(new Date(r.actualAt))}`:"");}}>실제 시각 수정</button></td></tr>)}</tbody></table></div>:<p className="sleep-status">아직 기록이 없어요. 미기록을 늦잠으로 판단하지 않아요.</p>}
      {editing&&<div className="sleep-status"><Input label={editing.kind==="wake"?"실제 일어난 시각 (자기보고)":"실제 잠자리에 든 시각 (자기보고)"} type="datetime-local" value={actual} onChange={setActual}/><p>비워서 저장하면 자기보고 시각을 지워요. 확인 시각과 최대 36시간 차이까지 입력할 수 있어요.</p><div className="choice-buttons"><button className="button primary" disabled={busy} onClick={correct}>수정 저장</button><button className="button secondary" disabled={busy} onClick={()=>setEditing(null)}>취소</button></div></div>}
    </section>
  </div>;
}
