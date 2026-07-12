import ProfileHeader from "@/components/shared/ProfileHeader";
import ThreadsTab from "@/components/shared/ThreadsTab";
import RealtimePostsTab from "@/components/shared/RealtimePostsTab";
import AboutTab from "@/components/shared/AboutTab";
import FriendsTab from "@/components/shared/FriendsTab";
import MessagesTab from "@/components/shared/MessagesTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { profileTabs } from "@/constants";
import { fetchUser } from "@/lib/actions/user.actions";
import { areFriends, isFollowing } from "@/lib/actions/follow.actions";
import { getUserFromCookies } from "@/lib/serverutils";
import Image from "next/image";
import { redirect, notFound } from "next/navigation";
import ArticlePortal from "@/components/buttons/ArticlePortal";
import StacksPortal from "@/components/buttons/StacksPortal";
import SitesPortal from "@/components/buttons/SitesPortal";

async function Page({ params }: { params: { id: string } }) {
  if (!params?.id && params?.id?.length !== 1) return notFound();

  const activeUser = await getUserFromCookies();
  if (!activeUser?.onboarded) redirect("/onboarding");
  const profilePageUser = await fetchUser(BigInt(params.id));
  if (!profilePageUser?.onboarded) notFound();
  const following = activeUser.userId
    ? await isFollowing({ followerId: activeUser.userId, followingId: profilePageUser.id })
    : false;
  const friend = activeUser.userId
    ? await areFriends({ userId: activeUser.userId, targetUserId: profilePageUser.id })
    : false;

    const isOwnProfile =
    BigInt(activeUser.userId!) === BigInt(profilePageUser.id); // ← helper

  // 1️⃣  Only include “Messages” in the tab list when it’s your own profile
  const visibleTabs = profileTabs.filter(
    (tab) => tab.label !== "Messages" || isOwnProfile
  );

  return (
    <section className=" mt-[-2rem]">
      <ProfileHeader
        accountId={profilePageUser.id}
        name={profilePageUser.name!}
        username={profilePageUser.username}
        imgUrl={profilePageUser.image}
        bio={profilePageUser.bio}
        currentUserId={activeUser.userId}
        isFollowing={following}
        isFriend={friend}
      />
       <div className="mt-4">
        <Tabs defaultValue="threads" className="w-full">
          <TabsList className="mb-4">
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.label}
                value={tab.value}
                className="tab mx-1 tab-button border-none outline-indigo-400"
              >
                <Image
                  src={tab.icon}
                  alt={tab.label}
                  width={24}
                  height={24}
                  className="object-contain"
                />
                <p className="max-sm:hidden">{tab.label}</p>
                {tab.label === "Threads" && (
                  <p className="ml-1 rounded-none bg-light-4 px-2 py-1 !text-tiny-medium text-light-2">
                    0
                  </p>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {visibleTabs.map((tab) => (
            <TabsContent
              key={`content-${tab.label}`}
              value={tab.value}
              className="w-full text-light-1"
            >
              {tab.label === "Posts" ? (
                <RealtimePostsTab
                  currentUserId={activeUser.userId!}
                  accountId={profilePageUser.id}
                />
              ) : tab.label === "About" ? (
                <AboutTab
                  currentUserId={activeUser.userId!}
                  accountId={profilePageUser.id}
                />
              ) : tab.label === "Friends" ? (
                <FriendsTab
                  currentUserId={activeUser.userId!}
                  accountId={profilePageUser.id}
                />
              ) : tab.label === "Messages" ? (
                /* 2️⃣  This branch only exists when isOwnProfile === true */
                <MessagesTab
                  currentUserId={activeUser.userId!}
                  accountId={profilePageUser.id}
                />
              ) : (
                <div className="placeholder">Content for {tab.label}</div>
              )}
            </TabsContent>
          ))}
        </Tabs>
        <div className="flex flex-wrap w-full mt-12 gap-8">
        <div className="flex flex-col w-fit tracking-wide rounded-3xl bg-white/20   p-5 likebutton">

<ArticlePortal/>
</div>
<div className="flex flex-col w-fit tracking-wide rounded-3xl bg-white/20   p-5 likebutton">

<SitesPortal/>
</div>
<div className="flex flex-col w-fit tracking-wide rounded-3xl bg-white/20   p-5 likebutton">

<StacksPortal/>
</div>
</div>
      </div>
   
    </section>

  );
}

export default Page;
