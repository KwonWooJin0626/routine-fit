"use client";

import { useState } from "react";
import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import styles from "./social-sign-in.module.css";

export function SocialSignIn({ destination, configured, provider }: {
  destination: string; configured: boolean; provider: "google" | "naver";
}) {
  const [busy, setBusy] = useState(false);
  const label = provider === "naver" ? "네이버" : "Google";

  return (
    <form action={`/auth/${provider}`} method="post" onSubmit={() => setBusy(true)}>
      <input type="hidden" name="destination" value={destination} />
      <button type="submit" className={styles.provider} disabled={!configured || busy}
        aria-label={busy ? `${label} 로그인으로 이동 중` : `${label}로 계속하기`} aria-busy={busy}>
        <span aria-hidden="true" className={`${styles.icon} ${provider === "naver" ? styles.naver : ""}`}>
          {busy ? <LoaderCircle size={20} className="spin" /> : provider === "naver" ? "N" :
            <Image src="/google-sign-in-logo.png" alt="" width={36} height={32} unoptimized />}
        </span>
        {label}
      </button>
    </form>
  );
}
