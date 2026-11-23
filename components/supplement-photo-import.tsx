"use client";

import { useEffect,useRef,useState } from "react";
import { parseSupplementPhoto } from "@/lib/supplement-label-photo";
import { supplementLabelSchema,type SupplementLabel } from "@/lib/supplement-label";
import { supplementSourceUrl } from "@/lib/supplement-source-url";
import { supplementNihQuery } from "@/lib/supplement-query";

export function SupplementPhotoImport({url,name,onApply}:{url:string;name:string;onApply:(label:SupplementLabel,name?:string)=>void}){
  const run=useRef(0);
  const [result,setResult]=useState<{label:SupplementLabel;omitted?:number;name?:string}|null>(null);
  const [working,setWorking]=useState<"photo"|"barcode"|"web"|null>(null);
  const [message,setMessage]=useState("");
  const [upc,setUpc]=useState("");
  const [matches,setMatches]=useState<{name:string;pack?:string;label:SupplementLabel}[]>([]);
  useEffect(()=>{run.current++;setResult(null);setMatches([]);setMessage("");setWorking(null);},[name,url]);
  useEffect(()=>()=>{run.current++;},[]);

  async function findNihMatches(query:string,id:number){
    try{
      const response=await fetch("/api/supplement-label?"+new URLSearchParams({name:query,live:"1"}),{cache:"no-store",signal:AbortSignal.timeout(13000)});
      if(!response.ok)return null;
      const {products}=await response.json();
      if(run.current!==id||!Array.isArray(products))return false;
      const found=products.flatMap(product=>{
        const label=supplementLabelSchema.safeParse(product?.label);
        return label.success&&typeof product?.name==="string"?[{name:product.name,pack:product.pack,label:label.data}]:[];
      });
      setMatches(found);
      return found.length>0;
    }catch{return null;}
  }

  async function findOnWeb(skipNih=false){
    const id=++run.current;

    setResult(null);
    setMatches([]);
    setMessage("");
    setWorking("web");
    try{
      if(!skipNih){
        const nih=await findNihMatches(supplementNihQuery(name,url),id);
        if(run.current!==id)return;
        if(nih===null){setMessage("NIH 조회에 연결하지 못했어요. 제품이 없다는 의미는 아니에요. 잠시 후 다시 조회해 주세요.");return;}
        if(nih){setMessage("NIH 성분표 후보를 찾았어요. 입력한 상품과 브랜드·함량·제형·포장 수량이 같은 제품을 골라 주세요. 링크와 자동으로 일치 판정한 결과는 아니에요.");return;}
      }
      if(run.current!==id)return;
      const response=await fetch("/api/supplement-web-search",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name,url:url||undefined}),signal:AbortSignal.timeout(38000)});
      const {product,error,reason}=await response.json();
      if(run.current!==id)return;
      const label=supplementLabelSchema.safeParse(product?.label);
      if(!response.ok||!label.success||typeof product?.name!=="string"){
        setMessage(typeof error==="string"?error:reason==="NO_CITATIONS"?"조회 자료의 원본 출처를 확인하지 못했어요. 저장하지 않고 조회를 마쳤어요.":"원문과 일치하는 성분표를 확인하지 못했어요. 정확한 제품의 제조사 상품 링크로 다시 조회해 주세요.");
        return;
      }
      setResult({label:label.data,name:product.name});
    }catch{
      if(run.current===id)setMessage("상품 페이지 분석에 연결하지 못했어요. NIH 바코드 조회도 사용할 수 있어요.");
    }finally{
      if(run.current===id)setWorking(null);
    }
  }

  async function findBarcode(){
    const id=++run.current;
    setMatches([]);
    setResult(null);
    setMessage("");
    setWorking("barcode");
    try{
      const response=await fetch("/api/supplement-label?"+new URLSearchParams({upc}),{signal:AbortSignal.timeout(16000)});
      if(!response.ok)throw Error();
      const {product}=await response.json();
      if(run.current!==id)return;
      const label=supplementLabelSchema.safeParse({...product?.label});
      if(!label.success||typeof product?.name!=="string"){
        setMessage("이 바코드로 정확한 라벨을 찾지 못했어요. 성분표 사진을 올려 주세요.");
        return;
      }
      setResult({label:label.data,name:product.name});
    }catch{
      if(run.current===id)setMessage("바코드를 조회하지 못했어요. 잠시 후 다시 시도하거나 사진을 올려 주세요.");
    }finally{
      if(run.current===id)setWorking(null);
    }
  }

  async function read(file:File){
    const id=++run.current;
    setMatches([]);
    setResult(null);
    setMessage("");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024){
      setMessage("10MB 이하의 JPG, PNG 또는 WebP 이미지를 올려 주세요.");
      return;
    }
    setWorking("photo");
    try{
      const {createWorker}=await import("tesseract.js");
      const worker=await createWorker(["eng","kor"]);
      try{
        const {data}=await worker.recognize(file);
        if(run.current!==id)return;
        const parsed=parseSupplementPhoto(data.text,url);
        setResult(parsed);
        if(!parsed)setMessage("제공량이나 성분 행을 확인하기 어려워요. 성분표 전체가 선명하게 보이는 사진을 올려 주세요.");
      }finally{
        await worker.terminate();
      }
    }catch{
      if(run.current===id)setMessage("사진을 읽지 못했어요. 잠시 후 다시 시도해 주세요.");
    }finally{
      if(run.current===id)setWorking(null);
    }
  }

  return <section className="dose-product-details" aria-label="성분표 가져오기">
    <p className="muted">조회한 결과는 이 창에서만 임시로 보여요. ‘내 영양제에 등록’을 누르면 선택한 성분표와 복용 설정을 저장해요.</p>
    <p className="muted">NIH를 먼저 조회하고, 없으면 상품 링크의 텍스트 성분표를 분석해요. 지원: iHerb · Life Extension · NOW · Solgar · Thorne · Nature Made. Google 검색은 사용하지 않아요.</p>
    <button type="button" className="button secondary" disabled={!!working||(name.trim().length<2&&!supplementSourceUrl(url))} onClick={()=>void findOnWeb()}>제품명·링크로 실시간 조회</button>

    <details>
      <summary>바코드 번호로 성분표 찾기</summary>
      <label className="field"><span>바코드 아래 숫자</span>
        <input type="text" inputMode="numeric" value={upc} maxLength={14} onChange={e=>setUpc(e.target.value.replace(/\D/g,""))}/>
      </label>
      <button type="button" className="button secondary" disabled={!!working||!/^(?:\d{8}|\d{12,14})$/.test(upc)} onClick={()=>void findBarcode()}>성분표 찾기</button>
    </details>
    <label className="field"><span>성분표 사진으로 가져오기</span>
      <small>제공량과 성분 목록이 모두 보이는 성분표 사진이나 캡처를 선택해 주세요.</small>
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!working} onChange={e=>{
        const file=e.currentTarget.files?.[0];
        e.currentTarget.value="";
        if(file)void read(file);
      }}/>
    </label>
    {working&&<p role="status">{working==="photo"?"사진에서 성분표를 읽고 있어요…":working==="web"?"실시간으로 제품 성분표를 찾고 있어요…":"NIH 성분표를 조회하고 있어요…"}</p>}
    {message&&<p role="status">{message}</p>}
    {matches.length>0&&<><ul>
      {matches.map(match=><li key={match.label.dsldId??match.label.upc??match.name}>
        <button type="button" className="text-link" disabled={!!working} onClick={()=>{setResult(match);setMatches([]);setMessage("");}}>
          {match.name}{match.pack?` · ${match.pack}`:""}{match.label.upc?` · ${match.label.upc}`:""}
        </button>
      </li>)}
    </ul><button type="button" className="text-link" disabled={!!working} onClick={()=>void findOnWeb(true)}>이 목록에 없어요 · 상품 페이지 분석</button></>}
    {result&&<div>
      <p className="status-message">조회 완료 · 아직 내 영양제에 등록되지 않았어요.</p>
      {result.name&&<h3>{result.name}</h3>}
      {result.label.dsldId&&<p><a href={`https://dsld.od.nih.gov/label/${result.label.dsldId}`} target="_blank" rel="noopener noreferrer">NIH 원본 라벨 보기</a></p>}
      {result.label.webSources?.map((source,index)=><p key={index}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></p>)}
      {result.label.retrievedAt&&<p className="muted">조회 시각 {new Date(result.label.retrievedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</p>}
      <p>{result.label.servingSize}{result.label.servingUnit} 기준 · 성분 {result.label.facts.length}개</p>
      <p className="muted">{result.label.dailyUnits!==undefined?`제품에 표시된 하루 섭취 안내: ${result.label.dailyUnits}${result.label.servingUnit}`:"하루 섭취 안내는 확인되지 않았어요. 라벨 1회 제공량을 계산 기준으로 제시해요."}</p>
      {result.label.dailyUseText&&<details><summary>제품 섭취 안내 원문</summary><p>{result.label.dailyUseText}</p></details>}
      <p className="muted">{result.label.partial?"함량을 확인할 수 있는 항목만 표시했어요. 제품 라벨과 대조해 주세요.":"보유한 제품 라벨의 제공량과 성분별 숫자·단위가 일치하는지 확인해 주세요."}</p>
      <div className="record-table"><table><thead><tr><th scope="col">성분</th><th scope="col">함량</th></tr></thead>
        <tbody>{result.label.facts.map(fact=><tr key={fact.name+"|"+fact.unit}><th scope="row">{fact.name}</th><td>{fact.amount} {fact.unit}</td></tr>)}</tbody>
      </table></div>
      <button type="button" className="button secondary" onClick={()=>{
        onApply(result.label,result.name);
        setResult(null);
        setMessage("성분표를 반영했어요. 아래 ‘내 영양제에 등록’을 눌러야 저장되고 섭취표에 표시돼요.");
      }}>이 제품의 성분표 선택</button>
    </div>}
  </section>;
}
