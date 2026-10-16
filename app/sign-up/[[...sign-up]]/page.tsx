import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return <main className="loading-screen"><a href="/" className="text-link">ROUTINE FIT · 홈으로</a><SignUp signInUrl="/sign-in" fallbackRedirectUrl="/?start=1" /></main>;
}
