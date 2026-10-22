"use client";
import { useRef, useState } from "react";
import { ArrowUpRight, Leaf, ShieldCheck } from "lucide-react";
import type { Answers, AppState } from "@/lib/model";
import { allergenLabels, emptyNutritionProfile, nutritionProfileSchema, type NutritionProfile } from "@/lib/nutrition-profile";
import { foodOptions, formatChoices, formatComparison, ingredients, proteinDirections, rankIngredients, supplementHolds, type Ingredient } from "@/lib/nutrition";
import { ChoiceButtons } from "./choice-buttons";
import { Input } from "./forms";
import { useChapterScroll } from "./use-chapter-scroll";

export function NutritionGuide({state,busy,onSave,onEdit}:{state:AppState;busy:boolean;onSave:(p:NutritionProfile)=>Promise<void>;onEdit:()=>void}){
  const [profile,setProfile]=useState<NutritionProfile>(()=>state.nutrition??emptyNutritionProfile());
  const [selected,setSelected]=useState<string|null>(null),[error,setError]=useState("");
  const root=useRef<HTMLElement>(null);
  useChapterScroll(root,selected??"overview",{resetPage:true,skipInitial:true});
  const update=<K extends keyof NutritionProfile>(key:K,value:NutritionProfile[K])=>setProfile(p=>({...p,[key]:value,reviewed:false}));
  const isSaved=JSON.stringify(profile)===JSON.stringify(state.nutrition);
  const holds=supplementHolds(state.answers,profile);
  const ranked=rankIngredients(state.answers,profile);
  const active=ingredients.find(i=>i.id===selected);
  const save=async()=>{
    const parsed=nutritionProfileSchema.safeParse({...profile,reviewed:true});
    if(!parsed.success){setError(parsed.error.issues[0].message);return;}
    try{setError("");await onSave(parsed.data);setProfile(parsed.data);}catch(e){setError((e as Error).message);}
  };
  return <section className="nutrition-workspace" ref={root}>
    <div className="nutrition-intro"><span className="eyebrow">NUTRIENTS FIRST · NO GENERATIVE AI</span><h2 data-chapter-heading tabIndex={-1}>성분을 이해하고, 나에게 맞게 챙겨요.</h2><p>여러 후보 중 먼저 살펴볼 성분을 최대 5개 골라요. 결핍 진단이나 모두 복용하라는 뜻은 아니에요.</p><button className="text-link" disabled={busy} onClick={onEdit}>기본 문진·복용약·현재 영양제 확인</button></div>
    {!state.answers.supplementOptIn?<div className="panel"><h3>영양정보 제공을 선택하지 않으셨어요</h3><p>영양정보 없이도 일정·루틴을 이용할 수 있어요.</p><button className="button secondary" onClick={onEdit}>문진에서 선택 변경</button></div>:<>
    <details className="panel nutrition-profile" open={!state.nutrition?.reviewed}><summary>나의 음식·섭취 프로필 <span>{isSaved&&profile.reviewed?"저장된 답변 사용 중":"추천 전 한 번 확인해요"}</span></summary><p>음식 알레르기·소화 불편·기호를 구분해서 저장해요. 자유 입력의 의미를 자동으로 진단하지 않아요.</p><div className="form-grid">
      <div className="form-span"><ChoiceButtons label="음식 알레르기가 있나요?" value={profile.allergyStatus} options={{none:"없어요",known:"있어요",unknown:"잘 모르겠어요"}} disabled={busy} onChange={v=>setProfile(p=>({...p,allergyStatus:v as NutritionProfile["allergyStatus"],allergens:v==="known"?p.allergens:[],allergyNotes:"",reviewed:false}))}/></div>
      {profile.allergyStatus==="known"&&<div className="form-span"><fieldset><legend>반응이 있는 원료를 모두 선택해주세요</legend><div className="choice-buttons">{Object.entries(allergenLabels).map(([key,label])=><label className="check-choice" key={key}><input type="checkbox" disabled={busy} checked={profile.allergens.includes(key as never)} onChange={e=>update("allergens",e.target.checked?[...profile.allergens,key as never]:profile.allergens.filter(a=>a!==key))}/>{label}</label>)}</div></fieldset><Input label="기타 알레르기·반응 설명 (선택)" value={profile.allergyNotes} onChange={v=>update("allergyNotes",v.slice(0,250))}/></div>}
      <div className="form-span"><ChoiceButtons label="우유·유제품을 먹었을 때 소화는 어떤가요?" value={profile.lactose} options={{comfortable:"특별히 불편하지 않아요",discomfort:"복통·가스·설사 등이 있어요",unknown:"잘 모르겠어요"}} disabled={busy} onChange={v=>update("lactose",v as NutritionProfile["lactose"])}/><small>이 답변만으로 유당불내증을 진단하지 않아요. 우유 알레르기와는 다른 항목이에요.</small></div>
      <Input label="다른 음식의 소화 불편 (선택)" value={profile.digestiveNotes} onChange={v=>update("digestiveNotes",v.slice(0,250))}/><Input label="피하거나 먹기 어려운 음식 (선택)" value={profile.avoidFoods} onChange={v=>update("avoidFoods",v.slice(0,250))}/>
      <div className="form-span"><ChoiceButtons label="평소 식사에서 단백질은 어떻게 챙기나요?" value={profile.proteinIntake} options={{unknown:"얼마나 먹는지 몰라요",adequate:"식사로 충분히 챙겨요",difficult:"챙겨 먹기 어려워요"}} disabled={busy} onChange={v=>update("proteinIntake",v as NutritionProfile["proteinIntake"])}/></div>
      </div><p className="muted">모르는 정보는 ‘없음’으로 처리하지 않아요. 내용이 바뀌면 수정 후 다시 저장해주세요.</p><button type="button" className="button primary" disabled={busy} onClick={()=>void save()}>{busy?"저장 중…":"확인한 음식·섭취 정보 저장"}</button>{error&&<p role="alert" className="form-error">{error}</p>}
    </details>
    {active?<><button className="text-link" type="button" onClick={()=>setSelected(null)}>← 우선 성분·전체 목록</button><IngredientDetail key={active.id} ingredient={active} answers={state.answers} profile={profile} dirty={!isSaved} holds={holds} busy={busy} onUpdate={update} onSave={save}/></>:<>
      <div className="section-head"><div><span className="eyebrow">YOUR FIRST PICKS</span><h2>먼저 살펴볼 성분 {ranked.length}개</h2><p>평소 식사·운동 정보를 기준으로 정렬해요. 오늘 피로나 공부 시간만으로 새 영양제를 권하지 않아요.</p></div></div>
      {!ranked.length&&<div className="panel"><h3>현재는 추가 후보를 정할 정보가 충분하지 않아요.</h3><p>식생활을 확인하거나 아래 성분 정보를 살펴볼 수 있어요. 추천 수를 억지로 채우지 않아요.</p></div>}
      <div className="nutrition-candidates">{ranked.map(({ingredient:i,reason},index)=><article className="panel nutrient-card" key={i.id}><span className="nutrient-number">{String(index+1).padStart(2,"0")}</span><small>{i.group} · 우선 검토</small><h3>{i.name}</h3><p>{i.role}</p><div className="nutrient-benefit"><b>어떤 도움을 기대할까요?</b><p>{i.benefit}</p></div><p className="nutrient-reason"><b>왜 보여드리나요?</b> {reason}</p><p className="muted">{i.limit}</p><button className="button secondary" onClick={()=>setSelected(i.id)}>식단·영양제 함께 보기 <ArrowUpRight size={15}/></button></article>)}</div>
      <details className="panel ingredient-library"><summary>다른 영양소·보충 성분 둘러보기 · {ingredients.length}종</summary><p>정보 탐색 목록이지 모두에게 권하는 복용 목록은 아니에요. 제한적 근거·전문가 확인 항목도 포함돼요.</p><div className="choice-buttons">{ingredients.map(i=><button type="button" key={i.id} onClick={()=>setSelected(i.id)}>{i.name}</button>)}</div></details>
    </>}
    <div className="note"><ShieldCheck size={18}/><div>1일 섭취방법을 지켜도 부작용이 없다고 보장하지 않아요. 식사·강화식품·현재 제품을 함께 확인해야 해요. 현재는 검토된 성분·유형 안내와 iHerb 검색 연결이며, 실제 상품 라벨·가격·재고 API는 연결되지 않았어요.</div></div>
    </>}
  </section>;
}

function IngredientDetail({ingredient:i,answers:a,profile:p,dirty,holds,busy,onUpdate,onSave}:{ingredient:Ingredient;answers:Answers;profile:NutritionProfile;dirty:boolean;holds:string[];busy:boolean;onUpdate:<K extends keyof NutritionProfile>(k:K,v:NutritionProfile[K])=>void;onSave:()=>Promise<void>}){
  const foods=foodOptions(i,a,p);
  const restricted=["iron","milkthistle","bcaa","biotin","b5","a","e","k","d","eaa","bcomplex","zinc"].includes(i.id);
  const blocked=dirty||holds.length>0||restricted;
  const directions=i.id==="protein"?proteinDirections(a,p):[{title:i.name,detail:"단일 성분은 별도 제품 비교, 복합 제품은 전체 성분표 검토가 필요해요.",query:i.query}];
  return <>
    <article className="panel ingredient-hero"><small>{i.group}</small><h2 data-chapter-heading tabIndex={-1}>{i.name}</h2><p>{i.role}</p><h3>어떤 도움을 기대할 수 있나요?</h3><p>{i.benefit}</p><div className="note">{i.limit}</div><p className="nutrition-critical"><ShieldCheck size={16}/>{i.caution}</p><details><summary>효과의 한계·함께 챙길 때·참고 자료</summary><p>{i.pairing}</p><a className="text-link" href={i.source} target="_blank" rel="noopener noreferrer">{i.sourceTitle}<ArrowUpRight size={14}/></a></details></article>
    <div className="nutrition-dual"><section className="panel"><span className="eyebrow">FOOD OPTIONS</span><h3><Leaf size={18}/> 식단으로 챙기는 방법</h3>{foods.length?<><p>저장된 원료 정보를 반영한 식품 예시예요. 실제 조리법·혼합 원료까지 확인해야 해요.</p><ul>{foods.map(f=><li key={f.name}>{f.name}</li>)}</ul><p className="muted">분량·조리법이 없어 함량을 추정하지 않아요. 계획에 넣거나 화면에서 본 것만으로 실제 섭취량에 합산하지 않아요.</p></>:<p>{!i.foods.length?"이 보충 성분과 일반 식단을 동일 효과로 일대일 대응하지 않아요. 균형 있는 식사·절주·운동 등 생활관리가 기본이에요.":"음식정보가 미확인되었거나 자유 입력·원료 제한으로 안전한 메뉴를 자동 확정할 수 없어요. 프로필과 실제 원료를 먼저 확인해주세요."}</p>}</section>
    <section className="panel"><span className="eyebrow">SUPPLEMENT OPTIONS</span><h3>영양제는 어떻게 챙기고 싶으세요?</h3><ChoiceButtons label="선호하는 제품 구성" value={p.format} options={formatChoices} disabled={busy} onChange={v=>onUpdate("format",v as NutritionProfile["format"])}/><p>단일 성분 = 한 알, 복합 제품 = 하루 한 알은 아니에요. 실제 하루 섭취 개수·형태를 확인해야 해요.</p><details><summary>단일·복합·혼합 방식의 장단점</summary>{formatComparison.map(f=><div className="format-comparison" key={f.name}><b>{f.name}</b><p>장점 · {f.good}</p><p>확인할 점 · {f.bad}</p></div>)}<a className="text-link" href="https://ods.od.nih.gov/factsheets/MVMS-Consumer/" target="_blank" rel="noopener noreferrer">NIH · Multivitamin/mineral Supplements</a></details></section></div>
    {i.id==="protein"&&<section className="panel"><h3>내 몸과 식단에 맞게 한 단계 더</h3><p>유당 정보를 확인할 수 있는 제품과 식물성 제품을 중심으로 비교해요. 우유 알레르기가 있으면 유청 제품을 추천하지 않아요.</p><ChoiceButtons label="어떤 원료를 비교할까요?" value={p.proteinSource} options={{dairy:"유제품 기반도 괜찮아요",plant:"식물성을 원해요",both:"둘 다 비교"}} disabled={busy} onChange={v=>onUpdate("proteinSource",v as NutritionProfile["proteinSource"])}/><ChoiceButtons label="제품을 비교할 때 중요한 점" value={p.budget} options={{any:"둘 다 중요해요",value:"가격·1회분 비용",convenience:"섭취 편의·휴대성"}} disabled={busy} onChange={v=>onUpdate("budget",v as NutritionProfile["budget"])}/><div className="nutrition-candidates">{directions.map(d=><div key={d.title}><h4>{d.title}</h4><p>{d.detail}</p></div>)}</div><a className="text-link" href="https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/symptoms-causes" target="_blank" rel="noopener noreferrer">NIDDK · 유당불내증과 우유 알레르기</a></section>}
    {dirty&&<div className="panel"><p>선택을 바꿨어요. 저장 후 확인된 조건으로 안내를 이어가요.</p><button className="button primary" disabled={busy} onClick={()=>void onSave()}>선택 내용 저장</button></div>}
    <section className="panel"><h3>제품 선택 전 확인</h3><p>추천 성분을 많이 포함하거나 고함량이라는 이유만으로 더 적합한 제품은 아니에요.</p><ul><li>제품 라벨의 1회분과 하루 섭취 횟수</li><li>같은 성분의 총량·형태·단위 (mg·μg·IU를 단순 합산하지 않기)</li><li>복합 제품의 추천 외 성분과 알레르기·부원료</li><li>현재 제품·식사·강화식품과의 중복, 복용약·질환 주의사항</li></ul>{holds.length>0&&<div className="nutrition-critical" role="status"><b>개인화된 제품 추천 보류</b><ul>{holds.map(r=><li key={r}>{r}</li>)}</ul></div>}{restricted&&<p className="nutrition-critical">이 성분은 현재 자동 우선 구매 추천 대상이 아니에요. 정보와 근거를 먼저 확인하고 필요한 경우 전문가에게 문의해주세요.</p>}
    {!blocked&&<div className="nutrition-links">{p.format!=="multi"&&directions.filter(d=>d.query).map(d=><a className="button secondary" key={d.title} href={`https://kr.iherb.com/search?kw=${encodeURIComponent(d.query)}`} target="_blank" rel="noopener noreferrer">{d.title} 유형 검색<ArrowUpRight size={14}/></a>)}{(p.format==="multi"||p.format==="both")&&<a className="button secondary" href="https://kr.iherb.com/search?kw=multivitamin%20mineral" target="_blank" rel="noopener noreferrer">복합 제품 탐색<ArrowUpRight size={14}/></a>}</div>}
    <p className="muted">검색 결과는 조건별로 검증된 상품 추천이 아니에요. 멀티 제품이 오메가-3·크레아틴·단백질 등을 모두 포함한다고 가정하지 않아요. 실제 구매·결제는 iHerb에서 진행하며 여기서는 구매나 복용 완료로 기록하지 않아요.</p></section>
  </>;
}
