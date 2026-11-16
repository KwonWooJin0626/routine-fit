import { SocialSignIn } from "@/components/google-sign-in";
import { authDestination } from "@/lib/auth-destination";
import { naverSignInEnabled, supabaseAuthConfig } from "@/lib/supabase-auth";
import styles from "@/components/social-sign-in.module.css";

// Same-origin form POSTs need the Origin header for the login route's check.
export const metadata = { title: "로그인 | ROUTINE FIT", referrer: "same-origin" } as const;

export default async function SignInPage({ searchParams }: {
  searchParams: Promise<{ redirect_url?: string; error?: string }>;
}) {
  const query = await searchParams;
  const configured = Boolean(supabaseAuthConfig());
  const destination = authDestination(query.redirect_url);
  return (
    <main className={styles.page}>
      <a href="/" className={styles.brand} aria-label="ROUTINE FIT 홈">ROUTINE <span>FIT</span></a>
      <section className={styles.section} aria-labelledby="sign-in-title">
        <h1 id="sign-in-title">로그인</h1>
        <p className={styles.description}>사용할 계정을 선택해 주세요.</p>
        <div className={styles.divider}>간편 로그인</div>
        <div className={styles.providers}>
          {naverSignInEnabled() && <SocialSignIn provider="naver" destination={destination} configured />}
          <SocialSignIn provider="google" destination={destination} configured={configured} />
        </div>
        {(query.error === "login" || query.error === "google") && <p className={styles.feedback} role="alert">로그인을 완료하지 못했어요. 다시 시도해 주세요.</p>}
        {!configured && <p className={styles.feedback}>로그인 연결을 준비 중이에요.</p>}
        <a href="/" className={styles.home}>홈으로 돌아가기</a>
      </section>
    </main>
  );
}
