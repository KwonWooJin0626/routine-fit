import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";

// Account ownership comes only from a verified Clerk session, never headers
// supplied by a visitor or a user ID sent in the request body.
export async function getSessionUser() {
  const { userId } = await auth();
  return userId ? { userId } : null;
}

export async function getCurrentUser() {
  if (!await getSessionUser()) return null;
  const user = await currentUser();
  if (!user) return null;
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  return { name: user.fullName || user.username || email || "사용자", email };
}
