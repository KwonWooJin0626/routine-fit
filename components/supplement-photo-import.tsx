"use client";

import { useEffect,useRef,useState } from "react";
import { parseSupplementPhoto } from "@/lib/supplement-label-photo";
import { iherbProductId,supplementLabelSchema,type SupplementLabel } from "@/lib/supplement-label";

export function SupplementPhotoImport({url,onApply}:{url:string;onApply:(label:SupplementLabel,name?:string)=>void}){
  const run=useRef(0);
  const [result,setResult]=useState<{label:SupplementLabel;omitted?:number;name?:string}|null>(null);
  const [working,setWorking]=useState<"photo"|"barcode"|null>(null);
  const [message,setMessage]=useState("");
  const [upc,setUpc]=useState("");
  useEffect(()=>()=>{run.current++;},[]);

  async function findBarcode(){
    const id=++run.current;
    setResult(null);
    setMessage("");
    setWorking("barcode");
    try{
      const response=await fetch("/api/supplement-label?"+new URLSearchParams({upc}),{signal:AbortSignal.timeout(16000)});
      if(!response.ok)throw Error();
      const {product}=await response.json();
      if(run.current!==id)return;
      const label=supplementLabelSchema.safeParse({...product?.label,productId:iherbProductId(url)??undefined});
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

  return <section className="dose-product-details" aria-label="성분표 사진으로 가져오기">
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
    {working&&<p role="status">{working==="photo"?"사진에서 성분표를 읽고 있어요…":"NIH 성분표를 조회하고 있어요…"}</p>}
    {message&&<p role="status">{message}</p>}
    {result&&<div>
      {result.name&&<h3>{result.name}</h3>}
      <p>{result.label.servingSize}{result.label.servingUnit} 기준 · 성분 {result.label.facts.length}개</p>
      <p className="muted">{result.label.partial?"함량을 확인할 수 있는 항목만 표시했어요. 제품 라벨과 대조해 주세요.":"보유한 제품 라벨의 제공량과 성분별 숫자·단위가 일치하는지 확인해 주세요."}</p>
      <div className="record-table"><table><thead><tr><th scope="col">성분</th><th scope="col">함량</th></tr></thead>
        <tbody>{result.label.facts.map(fact=><tr key={fact.name+"|"+fact.unit}><th scope="row">{fact.name}</th><td>{fact.amount} {fact.unit}</td></tr>)}</tbody>
      </table></div>
      <button type="button" className="button secondary" onClick={()=>{
        onApply(result.label,result.name);
        setResult(null);
        setMessage("성분표를 반영했어요. 복용 계획을 저장하면 섭취표에 표시돼요.");
      }}>이 성분표 사용</button>
    </div>}
  </section>;
}
