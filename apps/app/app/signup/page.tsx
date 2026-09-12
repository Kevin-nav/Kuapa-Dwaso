import { parseOnboardingIntent } from "@kuapa-dwaso/utils";
import { PhoneAuthPage } from "../auth/phone/page";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ intent?: string | string[] }> }) {
  const params = await searchParams;
  return <PhoneAuthPage initialIntent={parseOnboardingIntent(params.intent)} />;
}
