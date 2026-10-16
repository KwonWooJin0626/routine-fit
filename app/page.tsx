import RoutineFit from "@/components/routine-fit";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getCurrentUser();
  return <RoutineFit user={user} />;
}
