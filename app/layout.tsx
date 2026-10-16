import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROUTINE FIT — 오늘의 작은 실천, 나다운 건강",
  description: "질문으로 나를 이해하고, 오늘의 건강 루틴과 하루 계획을 함께 만들어 보세요.",
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
