import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DataImport } from "@/components/data-import";

export const dynamic = "force-dynamic";
export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Fimport");
  return <DataImport email={user.email} />;
}
