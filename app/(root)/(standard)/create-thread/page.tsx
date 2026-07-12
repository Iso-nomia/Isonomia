import PostThread from "@/components/forms/PostThread";
import { getUserFromCookies } from "@/lib/serverutils";
import { redirect } from "next/navigation";

async function Page() {
  const user = await getUserFromCookies();
  if (!user?.onboarded) redirect("/onboarding");

  return (
    <>
      <h1 className="head-text">Create Post</h1>
      <PostThread userId={user.userId!} />
    </>
  );
}

export default Page;
