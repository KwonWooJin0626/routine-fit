"use client";
import { useState } from "react";
import { CalendarDays, Plus, Trash2, ArrowRight } from "lucide-react";
import { Input } from "./forms";
import type { PlacementRange } from "@/lib/planner-placement";
import { weekday, weekdayNames } from "@/lib/planner";

export function PlacementRanges({ ranges, onChange, busy }: { ranges: PlacementRange[]; onChange: (ranges: PlacementRange[]) => void; busy: boolean }) {
  return <div className="sp-placement-ranges">{ranges.map((range, index) => <div className="sp-placement-range" key={index}>
    <b>{index + 1}. {weekdayNames[weekday(range.date)]}요일</b>
    <Input label={`선택 ${index + 1} 날짜`} type="date" required value={range.date} onChange={date => { if (/^\d{4}-\d{2}-\d{2}$/.test(date)) onChange(ranges.map((r, i) => i === index ? { ...r, date } : r)); }} />
    <Input label={`선택 ${index + 1} 시작`} type="time" required value={range.start} onChange={start => onChange(ranges.map((r, i) => i === index ? { ...r, start } : r))} />
    <Input label={`선택 ${index + 1} 종료`} type="time" required value={range.end} onChange={end => onChange(ranges.map((r, i) => i === index ? { ...r, end } : r))} />
    <button className="icon-button" type="button" disabled={busy} aria-label={`선택 ${index + 1} 시간대 삭제`} onClick={() => onChange(ranges.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
    {range.end <= range.start && <small>다음 날 종료</small>}
  </div>)}</div>;
}

export function BlockPlacementPanel({ title, ranges, selected, busy, onChange, onCancel, onContinue }: {
  title: string; ranges: PlacementRange[]; selected: string; busy: boolean;
  onChange: (ranges: PlacementRange[]) => void; onCancel: () => void; onContinue: () => void;
}) {
  const [date, setDate] = useState(selected), [start, setStart] = useState("09:00"), [end, setEnd] = useState("10:00");
  return <section className="sp-placement-panel" aria-label="블록 시간대 선택">
    <div className="sp-placement-heading"><CalendarDays size={20}/><div><h3 tabIndex={-1} data-placement-heading>{title} · 시간대 선택</h3><p>요일별로 원하는 시간을 드래그하세요. 여러 요일·시간대를 고른 뒤 세부 내용을 설정해요.</p></div></div>
    <div className="sp-placement-chips" aria-live="polite">{ranges.length ? ranges.map((r, i) => <button key={i} type="button" disabled={busy} aria-label={`${r.date} ${r.start}–${r.end} 선택 취소`} onClick={() => onChange(ranges.filter((_, n) => n !== i))}>{weekdayNames[weekday(r.date)]} {r.date.slice(5)} · {r.start}–{r.end} ×</button>) : <span>아직 선택한 시간이 없어요. 아래 시간표에서 선택해주세요.</span>}</div>
    <details className="sp-placement-manual"><summary>터치·키보드로 날짜와 시간 직접 선택</summary><div className="sp-placement-manual-fields"><Input label="추가할 날짜" type="date" value={date} onChange={setDate}/><Input label="추가할 시작 시간" type="time" value={start} onChange={setStart}/><Input label="추가할 종료 시간" type="time" value={end} onChange={setEnd}/><button className="button secondary" disabled={busy || ranges.length >= 30 || !date || !start || !end || start === end} onClick={() => onChange([...ranges, {date, start, end}])}><Plus size={15}/>시간대 추가</button></div></details>
    <div className="sp-placement-actions"><span>{ranges.length}개 선택 · 저장 전까지 일정은 바뀌지 않아요.</span><button className="button secondary" disabled={busy} onClick={onCancel}>취소</button><button className="button primary" disabled={busy || !ranges.length} onClick={onContinue}>세부 설정 <ArrowRight size={15}/></button></div>
  </section>;
}
