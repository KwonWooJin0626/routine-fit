import { startSocialSignIn } from "@/lib/start-social-sign-in";

export function POST(request: Request) {
  return startSocialSignIn(request, "google");
}
