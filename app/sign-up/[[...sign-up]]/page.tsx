import { redirect } from "next/navigation";
import { authDestination } from "@/lib/auth-destination";

export default async function SignUpPage({ searchParams }: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const destination = authDestination((await searchParams).redirect_url);
  redirect("/sign-in?" + new URLSearchParams({ redirect_url: destination }));
}
