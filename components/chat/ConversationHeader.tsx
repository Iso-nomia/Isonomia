"use client";

import Image from "next/image";

interface HeaderUser {
  name: string;
  image: string | null;
}

export default function ConversationHeader({
  isGroup,
  headerUsers,
  title,
}: {
  isGroup: boolean;
  headerUsers: HeaderUser[];
  title: string;
}) {
  return (
    <div className="flex w-full h-full items-center justify-center align-center gap-4">
      {isGroup ? (
        <div className="flex flex-wrap rounded-full gap-4 ">
          {headerUsers.slice(0, 4).map((u, i) => (
            <button key={u?.name ?? i} className="flex w-[2.5rem] h-[2.5rem]">
              <Image
                src={u.image || "/assets/user-helsinki.svg"}
                alt={u.name}
                width={50}
                height={50}
                className="rounded-full object-fill p-1 profile-shadow bg-white/20 align-center justify-center items-center"
              />
            </button>
          ))}
        </div>
      ) : (
        <button className="flex w-[2.5rem] h-[2.5rem]">
          <Image
            src={headerUsers[0]?.image || "/assets/user-helsinki.svg"}
            alt={headerUsers[0]?.name ?? "User"}
            width={50}
            height={50}
            className="rounded-full object-fill w-full h-full p-[.1rem] profile-shadow bg-white/20 align-center justify-center items-center"
          />
        </button>
      )}
      <button>
        <h1 className="text-[2.1rem] justify-center items-center align-center tracking-wider mt-1">
          {title}
        </h1>
      </button>
    </div>
  );
}
