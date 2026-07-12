import CreateLounge from "@/components/forms/CreateLounge";
import React from "react";
export const dynamic = "force-dynamic";

async function Page() {
  return (
    <div className="flex flex-col items-center justify-center mt-[-2rem]">
      <h1 className="head-text text-center items-center justify-center mb-4 tracking-wide">Create New Lounge</h1>
      <CreateLounge />
    </div>
  );
}

export default Page;
