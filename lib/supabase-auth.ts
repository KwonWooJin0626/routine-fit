import "server-only";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function naverSignInEnabled() {
  return Boolean(supabaseAuthConfig()) && process.env.SUPABASE_NAVER_ENABLED === "true";
}

export function createSupabaseAuth(cookies: CookieMethodsServer, secure: boolean) {
  const config = supabaseAuthConfig();
  if (!config) return null;
  return createServerClient(config.url, config.key, {
    cookies,
    cookieOptions: { httpOnly: true, sameSite: "lax", secure, path: "/" },
  });
}

export async function serverSupabaseAuth(writable = false, secure = process.env.NODE_ENV === "production") {
  const jar = await cookies();
  return createSupabaseAuth({
    getAll: () => jar.getAll(),
    setAll: (updates) => {
      // Server Components read sessions refreshed by Proxy. Route handlers write cookies.
      if (writable) {
        for (const { name, value, options } of updates) jar.set(name, value, options);
      }
    },
  }, secure);
}
