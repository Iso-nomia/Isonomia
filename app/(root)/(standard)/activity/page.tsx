import Image from "next/image";
import { fetchUser, getActivity } from "@/lib/actions/user.actions";
import { serverConfig } from "@/lib/firebase/config";
import { getUserFromCookies } from "@/lib/serverutils";
import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

async function Page() {
  const user = await getUserFromCookies();
  if (!user?.onboarded) redirect("/onboarding");

  const activity = await getActivity(user.userId!);

  return (
    <section>
      <h1 className="head-text mb-5">Activity</h1>
      <section className="mt-9 flex flex-col gap-3">
        {activity.length > 0 ? (
          <>
            {activity.map((activityItem) => (
              <Link
                key={activityItem.id.toString()}
                href={`/thread/${activityItem.parent_id}`}
              >
                <article className="activity-card bg-slate-800 rounded-md border-[2px] border-slate-500
                 border-slate-200 hover:bg-slate-700">
                  <Image
                    src={activityItem.author!.image || ""}
                    alt="Profile Picture"
                    width={24}
                    height={24}
                    className="rounded-md object-cover mr-2"
                  />
                  <p className="!text-base text-light-1">
                    <span className="mr-2 text-blue">
                      {activityItem.author!.name}
                    </span>{" "}
                    replied to your thread
                  </p>
                </article>
              </Link>
            ))}
          </>
        ) : (
          <p className="!text-base-regular text-light-3">No activity yet</p>
        )}
      </section>
    </section>
  );
}

export default Page;
