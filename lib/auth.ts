import "server-only";
import { cache } from "react";
import { parseLegacyAccountLinks } from "./auth-owner";
import { serverSupabaseAuth } from "./supabase-auth";

let legacyLinks: ReturnType<typeof parseLegacyAccountLinks> | undefined;

export const getSessionUser = cache(async () => {
  const supabase = await serverSupabaseAuth();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous) return null;

  legacyLinks ??= parseLegacyAccountLinks(process.env.SUPABASE_LEGACY_ACCOUNT_LINKS);
  const email = user.email ?? "";
  const name = [user.user_metadata?.full_name, user.user_metadata?.name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return {
    userId: legacyLinks.get(user.id) ?? user.id,
    email,
    verified: Boolean(email && user.email_confirmed_at),
    name: name?.trim().slice(0, 100) || email || "사용자",
  };
});

export async function getCurrentUser() {
  const user = await getSessionUser();
  if (!user) return null;
  return { name: user.name, email: user.email };
}
