import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAuth } from "@/lib/supabase-auth";

export async function proxy(request: NextRequest) {
  const updates: Parameters<SetAllCookies>[0] = [];
  const headers = new Headers();
  const supabase = createSupabaseAuth({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies, cacheHeaders) => {
      for (const cookie of cookies) request.cookies.set(cookie.name, cookie.value);
      updates.push(...cookies);
      for (const [name, value] of Object.entries(cacheHeaders)) headers.set(name, value);
    },
  }, request.nextUrl.protocol === "https:");
  if (supabase) await supabase.auth.getClaims();

  const response = NextResponse.next({ request });
  for (const { name, value, options } of updates) response.cookies.set(name, value, options);
  headers.forEach((value, name) => response.headers.set(name, value));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/|auth/|api/cron/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
