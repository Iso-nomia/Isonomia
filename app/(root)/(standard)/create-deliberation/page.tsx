import CreateDeliberation from "@/components/forms/CreateDeliberation";

export const dynamic = "force-dynamic";

// From-scratch deliberation create page
// (docs/DELIBERATION_CREATION_DEV_SPEC.md §4.2). Mirrors the sibling
// create-room / create-lounge / create-thread surfaces under (standard).
function Page() {
  return (
    <div className="mx-auto w-full ">
      <h1 className="head-text mb-6 text-center">New Deliberation</h1>
      <CreateDeliberation />
    </div>
  );
}

export default Page;
