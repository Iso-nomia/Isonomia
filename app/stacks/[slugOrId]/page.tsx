import { notFound } from "next/navigation";
import {
  getStackPageData,
  toggleStackSubscription,
  reorderStack,
  removeFromStack,
} from "@/lib/actions/stack.actions";
import StackAddModal from "@/components/modals/StackAddModal";
import PdfLightbox from "@/components/modals/PdfLightbox";
import { prisma } from "@/lib/prismaclient";
import StackDiscussion from "@/components/stack/StackDiscussion";
import Image from "next/image";
import SortablePdfGrid from "@/components/stack/SortablePdfGrid";
import AddCollaboratorForm from "@/components/stack/AddCollaboratorForm";
import StackComposer from "@/components/stack/StackComposer";
import StackSettingsModal from "@/components/stack/StackSettingsModal";
import ExportButton from "@/components/stack/ExportButton";

export default async function StackPage({ params }: { params: { slugOrId: string } }) {
  const { slugOrId } = params;
  const bySlug = await prisma.stack.findUnique({
    where: { slug: slugOrId },
    select: { id: true },
  });
  const id = bySlug?.id ?? slugOrId;
  const data = await getStackPageData(id);
  if ((data as any).notFound) return notFound();
  const { stack, posts, viewer, discussionPostId } = data as any;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{stack.name}</h1>
          {stack.description && (
            <p className="mt-2 text-sm text-muted-foreground">{stack.description}</p>
          )}
          <div className="mt-2 text-xs text-slate-500">
            Visibility: {stack.is_public ? "Public" : "Private"}
          </div>
          {stack.slug && (
            <div className="mt-1 text-xs text-slate-400">Slug: /stacks/{stack.slug}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ExportButton stackId={stack.id} stackName={stack.name} />
          <form action={toggleStackSubscription}>
            <input type="hidden" name="stackId" value={stack.id} />
            <input
              type="hidden"
              name="op"
              value={viewer.subscribed ? "unsubscribe" : "subscribe"}
            />
      <button className="px-3 py-1 text-sm bg-rose-700/70 sendbutton rounded-md text-center text-slate-100 ">
              {viewer.subscribed ? "Unsubscribe" : "Subscribe"}
            </button>
          </form>
          {viewer.editable && <StackAddModal stackId={stack.id} />}
          {viewer.isOwner && (
            <StackSettingsModal
              stackId={stack.id}
              initialName={stack.name}
              initialDescription={stack.description}
              initialVisibility={stack.visibility || (stack.is_public ? "public_closed" : "private")}
              initialSlug={stack.slug}
            />
          )}
        </div>
      </div>
      {viewer.isOwner && (
        <div className="mt-4 rounded-xl  bg-white/30 px-3 py-4">
          <div className="text-md font-medium mb-2 tracking-wide">Collaborators</div>
          <AddCollaboratorForm stackId={stack.id} />
        </div>
      )}
<div className="mt-2 ml-2">
                {viewer.editable && <StackComposer stackId={stack.id} />}
</div>

      {/* <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {posts.map((p: any) => {
          const cover = p.thumb_urls?.[0] || "/assets/pdf-placeholder.png";
          return (
            <div key={p.id} className="group relative rounded border overflow-hidden bg-white">
              <PdfLightbox
                trigger={
                  <Image
                    src={cover}
                    alt={p.title || "PDF"}
                    width={400}
                    height={300}
                    unoptimized
                    className="w-full aspect-[4/3] object-cover cursor-pointer"
                    loading="lazy"
                  />
                }
                fileUrl={p.file_url}
                title={p.title ?? "PDF"}
              />
              {viewer.editable && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <form action={reorderStack}>
                    <input type="hidden" name="stackId" value={stack.id} />
                    <input type="hidden" name="postId" value={p.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button className="px-2 py-1 text-xs rounded bg-white/90 border">↑</button>
                  </form>
                  <form action={reorderStack}>
                    <input type="hidden" name="stackId" value={stack.id} />
                    <input type="hidden" name="postId" value={p.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button className="px-2 py-1 text-xs rounded bg-white/90 border">↓</button>
                  </form>
                  <form action={removeFromStack}>
                    <input type="hidden" name="stackId" value={stack.id} />
                    <input type="hidden" name="postId" value={p.id} />
                    <button className="px-2 py-1 text-xs rounded bg-white/90 border">Remove</button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div> */}
       <SortablePdfGrid
        stackId={stack.id}
        editable={viewer.editable}
        posts={posts}
      />
              <hr className="mt-6 border-slate-500/50"></hr>


      <div className="mt-2 mb-4">
        <h2 className="text-[1.5rem] px-1 tracking-wider font-semibold py-1 ">Comments</h2>
        <StackDiscussion feedPostId={discussionPostId} />
      </div>
    </div>
  );
}
