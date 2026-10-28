"use client";
import { useClerk } from "@clerk/nextjs";
import { useState, type ReactNode } from "react";

export function AccountSignOut({ children, className, label = "로그아웃", role, disabled=false }: { children: ReactNode; className?: string; label?: string; role?:"menuitem"; disabled?:boolean }) {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <><button type="button" className={className} role={role} disabled={busy||disabled} aria-busy={busy} aria-label={label} onClick={async () => {
    setBusy(true); setError("");
    try { await signOut({ redirectUrl: "/" }); }
    catch { setError("로그아웃하지 못했어요. 다시 시도해주세요."); setBusy(false); }
  }}>{children}</button>{error && <span role="alert" className="form-error">{error}</span>}</>;
}
