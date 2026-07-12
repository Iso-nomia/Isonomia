import CreateRoom from "@/components/forms/CreateRoom";

export const dynamic = "force-dynamic";

async function Page() {
  return (
    <div className="items-center justify-center">
      <h1 className="head-text items-center justify-center mx-auto text-nowrap ml-[32%] mb-4 ">Create New Room</h1>
      <CreateRoom />
    </div>
  );
}

export default Page;
