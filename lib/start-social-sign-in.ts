import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authDestination, authReturnCookie } from "@/lib/auth-destination";
import { naverSignInEnabled, serverSupabaseAuth } from "@/lib/supabase-auth";

export async function startSocialSignIn(request: Request, provider: "google" | "custom:naver") {
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin) {
    return new Response("같은 사이트에서 요청해주세요.", { status: 403 });
  }

  const failure = () => NextResponse.redirect(new URL("/sign-in?error=login", url), {
    status: 303,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
  if (provider === "custom:naver" && !naverSignInEnabled()) return failure();
  const supabase = await serverSupabaseAuth(true, url.protocol === "https:");
  if (!supabase) return failure();

  const form = await request.formData().catch(() => null);
  if (!form) return failure();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: new URL("/auth/callback", url).href,
      ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : { scopes: "openid" }),
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) return failure();

  const jar = await cookies();
  jar.set(authReturnCookie, authDestination(form.get("destination")), {
    httpOnly: true, sameSite: "lax", secure: url.protocol === "https:",
    path: "/auth/callback", maxAge: 600,
  });
  return NextResponse.redirect(data.url, {
    status: 303,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
