"use client";

import Image from "next/image";
import Link from "next/link";



export default function HomeButton() {
  return (
    <button className="lockbutton p-2 bg-white/20 rounded-xl">
    <Link
      href={`/`}

    >
      <Image
        src="/assets/home.svg"
        alt="reply"
        width={26}
        height={26}
        className="cursor-pointer  object-contain"
      />
    </Link>
    {/* <span className="text-subtle-medium text-black">{commentCount}</span> */}
    </button>
  );
}
