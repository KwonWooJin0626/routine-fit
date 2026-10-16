import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return <main className="loading-screen"><a href="/" className="text-link">ROUTINE FIT · 홈으로</a><SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/?start=1" /></main>;
}
