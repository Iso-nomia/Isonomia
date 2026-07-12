import { getUserFromCookies } from "@/lib/serverutils";
import { fetchUserAttributes } from "@/lib/actions/userattributes.actions";
import { UserAttributes } from "@prisma/client";
import OnboardingFlow from "./onboarding-flow";

async function Page() {
  const user = await getUserFromCookies();
  if (!user) return null;

  const userData = {
    authId: user.uid || "",
    userId: user.userId || null,
    username: user.email || "",
    name: user.displayName || "",
    bio: user.bio || "",
    image: user?.photoURL || "",
  };
  const userAttributes =
    (await fetchUserAttributes({ userId: user.userId ?? null })) ||
    ({} as UserAttributes);

  return <OnboardingFlow userData={userData} userAttributes={userAttributes} />;
}
export default Page;
