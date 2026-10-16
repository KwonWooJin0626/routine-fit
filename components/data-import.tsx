"use client";
import { useEffect, useState } from "react";
import { Upload, ShieldCheck } from "lucide-react";
import { stateSchema, type AppState } from "@/lib/model";
import { validatePlanner } from "@/lib/planner";

export function DataImport({ email }: { email: string }) {
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState(false);
  const [candidate, setCandidate] = useState<AppState | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) throw new Error("계정의 저장 상태를 확인하지 못했어요. 페이지를 새로고침해주세요.");
        const data = await res.json();
        if (active) setExisting(data.state !== null || data.revision !== 0);
      } catch (e) { if (active) setError((e as Error).message); }
      finally { if (active) setLoading(false); }
    }
    void check();
    return () => { active = false; };
  }, []);

  async function choose(file?: File) {
    setCandidate(null); setConfirmed(false); setError("");
    if (!file) return;
    if (file.size > 1_500_000 || !file.name.toLowerCase().endsWith(".json")) {
      setError("기존 사이트에서 내보낸 1.5MB 이하 JSON 파일을 선택해주세요."); return;
    }
    setSelecting(true);
    try {
      const raw = await file.text();
      if (raw.length > 500_000) throw new Error("저장 가능한 데이터 크기를 초과했어요.");
      const parsed = stateSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) throw new Error("지원하는 ROUTINE FIT 내보내기 파일이 아니에요. 기존 사이트에서 다시 내려받아주세요.");
      if (parsed.data.planner && validatePlanner(parsed.data.planner).length) throw new Error("일정이 겹치는 데이터예요. 기존 사이트에서 일정을 정리한 후 다시 내보내주세요.");
      setCandidate(parsed.data);
    } catch (e) { setError(e instanceof SyntaxError ? "JSON 파일 형식이 올바르지 않아요." : (e as Error).message); }
    finally { setSelecting(false); }
  }

  async function importData() {
    if (!candidate || !confirmed || busy || existing || loading) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: candidate, revision: 0 }) });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) setExisting(true);
        throw new Error(data.error ?? "가져오지 못했어요. 다시 시도해주세요.");
      }
      window.location.assign("/");
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return <main className="import-page"><a className="text-link" href="/">← ROUTINE FIT 홈으로</a>
    <section className="panel"><span className="eyebrow">CONTINUE YOUR ROUTINE</span><h1>기존 기록 이어가기</h1>
      <p>현재 로그인 계정: <strong>{email || "로그인된 계정"}</strong></p>
      <ol><li>기존 사이트에서 설정 → 건강정보 관리 → 내 데이터 내려받기를 선택하세요.</li><li>내려받은 JSON 파일을 아래에서 선택하세요.</li><li>내용과 현재 계정을 확인하고 가져오기를 눌러주세요.</li></ol>
      <p className="note"><ShieldCheck size={16} /> 파일을 선택하는 것만으로 서버에 전송되지 않습니다. 확인 후 가져오기를 누르면 현재 계정에 저장해요. 기존 사이트의 기록은 삭제하지 않습니다.</p>
      {loading ? <p role="status">계정의 저장 상태를 확인하고 있어요.</p> : existing ? <p className="note" role="status">이 계정에는 이미 기록이 있어요. 실수로 덮어쓰지 않도록 가져오기를 막았습니다. 홈에서 기존 기록을 확인해주세요.</p> : <>
        <label className="field"><span>ROUTINE FIT 내보내기 파일</span><input type="file" accept=".json,application/json" disabled={busy || selecting || !!error && !candidate && error.includes("저장 상태")} onChange={e => void choose(e.target.files?.[0])} /></label>
        {selecting && <p role="status">파일 형식을 확인하고 있어요.</p>}
        {candidate && <div className="import-preview"><h2>가져올 기록</h2><p>프로필 이름: {candidate.answers.name}</p><p>하루 기록 {candidate.days.length}건 · InBody 수치 {candidate.inbody.length}건 · 일정 블록 {candidate.planner?.blocks.length ?? 0}개</p>
          <label className="check-choice"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />이 파일은 내 기록이며, 건강정보를 현재 로그인 계정에 저장하는 데 동의합니다.</label>
          <button className="button primary" disabled={!confirmed || busy || selecting} onClick={() => void importData()}><Upload size={16} />{busy ? "기록을 가져오는 중…" : "확인한 기록 가져오기"}</button>
        </div>}
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  </main>;
}
