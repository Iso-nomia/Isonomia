

import { fetchNotifications } from "@/lib/actions/notification.actions";
import { jsonSafe } from "@/lib/bigintjson";
import { getUserFromCookies } from "@/lib/serverutils";
import { redirect } from "next/navigation";
import NotificationsList from "./NotificationsList";
export default async function Page() {
  const user = await getUserFromCookies();
  if (!user?.userId) redirect("/login");
  const initialRaw = await fetchNotifications({ userId: user.userId });
  const initial = jsonSafe(initialRaw);

  return (
    <section>
      <h1 className="head-text mb-2 mt-[-3rem] ">Notifications</h1>
      <hr></hr>
      <NotificationsList initial={initial} />

    </section>
  );
}
