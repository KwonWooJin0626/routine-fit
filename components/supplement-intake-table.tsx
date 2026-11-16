"use client";
import { useState } from "react";
import { localDate,type AppState } from "@/lib/model";
import { intakeStatus,nutrientKey,supplementIntake } from "@/lib/supplement-intake";
import type { SupplementJournal } from "@/lib/supplement-journal";
import { Input } from "./forms";
import styles from "./supplement-intake-table.module.css";

const format=new Intl.NumberFormat("ko-KR",{maximumFractionDigits:3});

export function SupplementIntakeTable({journal,app}:{journal:SupplementJournal;app:AppState}){
  const [mode,setMode]=useState<"plan"|"actual">("plan"),[date,setDate]=useState(localDate);
  const {columns,rows,totals,missingCount}=supplementIntake(journal,app,date,mode);
  return <section className={`panel ${styles.panel}`} aria-labelledby="intake-table-title">
    <header className={styles.header}>
      <div><h2 id="intake-table-title">1일 영양소 섭취표</h2><p>등록한 영양제에서 확인한 양 · 식사 제외</p></div>
      <Input label="섭취표 날짜" type="date" value={date} onChange={value=>{if(/^\d{4}-\d{2}-\d{2}$/.test(value))setDate(value);}}/>
    </header>
    <div className="space-tabs" role="group" aria-label="섭취 합계 방식">
      <button type="button" aria-pressed={mode==="plan"} onClick={()=>setMode("plan")}>복용 계획 기준</button>
      <button type="button" aria-pressed={mode==="actual"} onClick={()=>setMode("actual")}>실제 복용</button>
    </div>
    {missingCount>0&&<p className={styles.notice}>제품 {missingCount}개의 라벨 또는 복용량이 일부 확인되지 않았어요. 표에는 확인된 양만 표시해요.</p>}
    {rows.length>0?<div className={styles.scroll} role="region" aria-label="제품별 영양소 섭취량" tabIndex={0}>
      <table>
        <thead><tr><th scope="col">영양제</th>{columns.length?columns.map(column=><th key={nutrientKey(column)} scope="col">{column.name}<small>{column.unit}</small></th>):<th scope="col">성분표</th>}</tr></thead>
        <tbody>
          <tr><th scope="row">1일 확인 합계</th>{columns.length?columns.map(column=>{
            const key=nutrientKey(column),value=totals[key],status=intakeStatus(column,value,missingCount>0);
            return <td key={key} className={styles[status.level]} title={status.reference?`미국 라벨 기준치 ${status.reference} ${column.unit}`:undefined}>
              <b>{value===undefined?"—":format.format(value)}</b><small>{status.label}</small>
            </td>;
          }):<td>판정 보류</td>}</tr>
          {rows.map(row=><tr key={row.id}>
            <th scope="row">{row.name}<small>{row.occurrences}회{row.missing?" · 확인 필요":""}</small></th>
            {columns.length?columns.map(column=>{
              const key=nutrientKey(column),amount=row.amounts[key];
              return <td key={key}>{amount===undefined?(row.missing?"미확인":"—"):`${format.format(amount)}${row.missing?" 이상":""}`}</td>;
            }):<td>확인 필요</td>}
          </tr>)}
        </tbody>
      </table>
    </div>:<p className={styles.notice}>{mode==="plan"?"이 날짜에 등록된 복용 계획이 없어요.":"이 날짜에 완료한 복용 기록이 없어요."}</p>}
    <details><summary>색상과 계산 기준</summary>
      <p>연녹색은 미국 라벨 기준치의 50% 미만, 녹색은 50~100%, 주황색은 100% 초과입니다. 빨간색은 확인된 양만으로 지원하는 상한 기준을 넘은 경우(현재 비타민 D3)에 표시해요. 식사와 미등록 제품이 제외되어요.</p>
      <p>복용량은 라벨과 같은 단위로 입력해 주세요. 예를 들어 2정 기준 라벨이면 <b>1정</b>처럼 적으면 계산돼요. 실제 복용 표에는 기록할 당시 저장한 성분표를 사용합니다.</p>
      <a href="https://www.fda.gov/food/nutrition-facts-label/daily-value-new-nutrition-and-supplement-facts-labels" target="_blank" rel="noreferrer">FDA 라벨 기준치</a>{" · "}
      <a href="https://ods.od.nih.gov/factsheets/VitaminD-Consumer/" target="_blank" rel="noreferrer">NIH 비타민 D 상한</a>
    </details>
  </section>;
}
