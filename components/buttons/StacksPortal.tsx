"use client";

import Image from "next/image";
import Link from "next/link";



export default function StacksPortal() {
  return (
    <button className="flex">
    <Link className="flex gap-4"
      href={`/`}

    >
      <Image
        src="/assets/blog.svg"
        alt="reply"
        width={28}
        height={28}
        className="cursor-pointer object-contain"
      />
              Stacks Dashboard

    </Link>
    {/* <span className="text-subtle-medium text-black">{commentCount}</span> */}
    </button>
  );
}
