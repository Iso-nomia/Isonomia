import UserCard from "@/components/cards/UserCard";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Explore",
  description: "Discover new users and rooms",
};

export default async function Page() {
  const user = await getUserFromCookies();
  if (!user?.onboarded) redirect("/onboarding");
  if (!user.userId) redirect("/login");

  const [users, rooms] = await Promise.all([
    prisma.user.findMany({
      where: { id: { not: Number(user.userId) } },
      take: 10,
      orderBy: { created_at: "desc" },
      select: { id: true, name: true, username: true, image: true },
    }),
    prisma.realtimeRoom.findMany({
      take: 10,
      orderBy: { created_at: "desc" },
      select: { id: true, room_icon: true },
    }),
  ]);

  return (
    <section>
      <h1 className="head-text mb-10">Explore</h1>

      <h2 className="text-heading2-semibold mb-3">People you may like</h2>
      <div className="flex flex-col gap-4">
        {users.length === 0 ? (
          <p className="no-result">No suggestions</p>
        ) : (
          users.map((u) => (
            <UserCard
              key={u.id.toString()}
              userId={u.id}
              name={u.name || ""}
              username={u.username}
              imgUrl={u.image}
              personType="User"
            />
          ))
        )}
      </div>

      <h2 className="text-heading2-semibold mb-3 mt-8">Rooms to join</h2>
      <div className="flex flex-col gap-3">
        {rooms.length === 0 ? (
          <p className="no-result">No rooms</p>
        ) : (
          rooms.map((r) => (
            <Link
              key={r.id.toString()}
              href={`/room/${r.id}`}
              className="leftsidebar_link leftsidebar-item rounded-md hover:outline-2 hover:outline-double hover:outline-indigo-400"
            >
              <div className="rounded_icon_container shadow-sm shadow-black h-6 w-6">
                <Image
                  src={r.room_icon}
                  alt={r.id}
                  width={48}
                  height={48}
                  className="object-contain"
                />
              </div>
              <p className="text-black tracking-[.05rem] max-lg:hidden">{r.id}</p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
