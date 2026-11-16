import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authDestination, authReturnCookie } from "@/lib/auth-destination";
import { serverSupabaseAuth } from "@/lib/supabase-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const destination = authDestination(jar.get(authReturnCookie)?.value);
  jar.set(authReturnCookie, "", { path: "/auth/callback", maxAge: 0 });

  let target = "/sign-in?error=login";
  const code = url.searchParams.get("code");
  if (code && !url.searchParams.has("error")) {
    const supabase = await serverSupabaseAuth(true, url.protocol === "https:");
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) target = destination;
    }
  }
  return NextResponse.redirect(new URL(target, url), {
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
