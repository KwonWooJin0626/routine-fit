import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "./pet.css";

export const metadata: Metadata = {
  title: "ROUTINE FIT — 오늘의 작은 실천, 나다운 성장",
  description: "짧은 질문으로 작은 루틴을 시작하고, 계획과 실행 기록으로 나에게 맞는 자기개발 습관을 만들어 보세요.",
  icons: {
    icon: "/mark.svg",
    shortcut: "/mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/?start=1" signUpFallbackRedirectUrl="/?start=1">
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
