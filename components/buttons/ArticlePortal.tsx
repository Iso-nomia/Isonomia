"use client";

import Image from "next/image";
import Link from "next/link";



export default function ArticlePortal() {
  return (
    <button className="flex">
    <Link className="flex gap-4"
      href={`/profile/articles`}

    >
      <Image
        src="/assets/blog.svg"
        alt="reply"
        width={28}
        height={28}
        className="cursor-pointer object-contain"
      />
              Articles Dashboard

    </Link>
    {/* <span className="text-subtle-medium text-black">{commentCount}</span> */}
    </button>
  );
}
