import { serverSupabaseAuth } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const headers = { "Cache-Control": "private, no-store" };
  if (request.headers.get("origin") !== url.origin) {
    return new Response(null, { status: 403, headers });
  }

  const supabase = await serverSupabaseAuth(true, url.protocol === "https:");
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return new Response(null, { status: 503, headers });
  }
  return new Response(null, { status: 204, headers });
}
