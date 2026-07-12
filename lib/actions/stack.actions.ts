"use server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { revalidatePath } from "next/cache";
import { feed_post_type } from "@prisma/client";
import { emitBus } from "@/lib/server/bus";
import { createSupabaseServerClient } from "@/lib/supabase-server";


type Viewer = { id: bigint | null };

function canEdit(stack: any, viewer: Viewer) {
  if (!viewer.id) return false;
  if (stack.owner_id === viewer.id) return true;
  if (!stack.collaborators) return false;
  return stack.collaborators.some(
    (c: any) =>
      c.user_id === viewer.id &&
      (c.role === "EDITOR" || c.role === "OWNER")
  );
}
 
function canView(stack: any, viewer: Viewer) {
    if (stack.is_public) return true;
    if (!viewer.id) return false;
    if (stack.owner_id === viewer.id) return true;
    // VIEWER/EDITOR/OWNER collaborators can see private stacks
    return stack.collaborators?.some((c: any) => c.user_id === viewer.id) ?? false;
  }
  export async function assertCanEditStack(stackId: string, userId: bigint) {
    const stack = await prisma.stack.findUnique({
      where: { id: stackId },
      include: { collaborators: true },
    });
    if (!stack) throw new Error("Stack not found");
    if (stack.owner_id === userId) return true;
    const ok = !!stack.collaborators?.some(
      (c) => c.user_id === userId && (c.role === "EDITOR" || c.role === "OWNER")
    );
    if (!ok) throw new Error("Forbidden");
    return true;
  }
  
  async function ensureStackDiscussionThread(stack: {
    id: string;
    name: string;
    owner_id: bigint;
    is_public: boolean;
  }) {
    const threadKey = `stack:${stack.id}`;
    const thread = await prisma.feedPost.upsert({
      where: { articleId: threadKey },
      create: {
        author_id: stack.owner_id,
        type: "TEXT",
        content: `Discussion for stack "${stack.name}"`,
        isPublic: stack.is_public,
        stack_id: stack.id,
        articleId: threadKey,
      },
      update: {},
      select: { id: true },
    });
    return thread.id;
  }
  
export async function getStackPageData(stackId: string, useStackItems: boolean = true) {
  const sb = createSupabaseServerClient();

  const u = await getUserFromCookies();
    
  const viewerId = u?.userId ? BigInt(u.userId) : null;

  // Include StackItems for new ordering system
  const include: any = {
    owner: { select: { id: true, name: true, image: true } },
    collaborators: true,
    // Legacy: keep posts for backward compatibility
    posts: {
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        title: true,
        file_url: true,
        thumb_urls: true,
        page_count: true,
        uploader_id: true,
        created_at: true,
        blockType: true,
        // Link fields
        linkUrl: true,
        linkTitle: true,
        linkDescription: true,
        linkImage: true,
        linkFavicon: true,
        linkSiteName: true,
        linkScreenshot: true,
        // Text fields
        textContent: true,
        textPlain: true,
        // Video fields
        videoUrl: true,
        videoProvider: true,
        videoThumb: true,
        videoDuration: true,
        videoEmbedId: true,
        processingStatus: true,
      },
    },
    // NEW: Include StackItems for multi-stack ordering
    items: {
      orderBy: { position: "asc" },
      include: {
        block: {
          select: {
            id: true,
            title: true,
            file_url: true,
            thumb_urls: true,
            page_count: true,
            uploader_id: true,
            created_at: true,
            // Block type fields
            blockType: true,
            // Link fields
            linkUrl: true,
            linkTitle: true,
            linkDescription: true,
            linkImage: true,
            linkFavicon: true,
            linkSiteName: true,
            linkScreenshot: true,
            // Text fields
            textContent: true,
            textPlain: true,
            // Video fields
            videoUrl: true,
            videoProvider: true,
            videoThumb: true,
            videoDuration: true,
            videoEmbedId: true,
            processingStatus: true,
            // NEW: Count of stacks this block is connected to
            stackConnections: { select: { stackId: true } },
          },
        },
        // NEW: Include embedded stack data
        embedStack: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            is_public: true,
            owner: { select: { id: true, name: true, username: true, image: true } },
            _count: { select: { posts: true, items: true } },
          },
        },
        addedBy: { select: { id: true, name: true, username: true, image: true } },
      },
    },
  };
  if (viewerId) {
    include.subscribers = { where: { user_id: viewerId }, select: { user_id: true } };
  }

  const stack = await prisma.stack.findUnique({ where: { id: stackId }, include });
  if (!stack) return { notFound: true } as const;

  // const posts = await Promise.all(
  //   (stack.posts as Array<{ id: string; thumb_urls?: string[] }>)
  //     .filter((p) => "thumb_urls" in p)
  //     .map(async (p) => ({
  //       ...p,
  //       thumb_urls: await Promise.all((p.thumb_urls ?? []).map(signThumb)),
  //     }))
  // );


 
    // deny access to private stacks if viewer lacks permission
    if (!canView(stack, { id: viewerId })) return { notFound: true } as const;



const signIfExists = async (u?: string|null) => {
  if (!u) return null;
  const m = u.match(/\/storage\/v1\/object\/public\/pdf-thumbs\/(.+)$/);
  const key = m?.[1];
  if (!key) return u; // already some absolute URL we won't sign
  const { data, error } = await sb.storage.from("pdf-thumbs").createSignedUrl(key, 600);
  return error ? null : (data?.signedUrl ?? null);
};

const tryDerivedThumb = async (fileUrl?: string|null) => {
  if (!fileUrl) return null;
  const M = fileUrl.match(/\/storage\/v1\/object\/public\/pdfs\/(.+)\.pdf$/i);
  if (!M) return null;
  const key = `${M[1]}.png`; // storage key in pdf-thumbs
  const { data, error } = await sb.storage.from("pdf-thumbs").createSignedUrl(key, 600);
  return error ? null : (data?.signedUrl ?? null);
};

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// NEW: Use StackItems for ordering if available, fallback to legacy order array
const stackItems = (stack as any).items as Array<any> | undefined;
const legacyPosts = stack.posts as Array<any>;
let posts: Array<any>;

if (useStackItems && stackItems && stackItems.length > 0) {
  // Get block IDs that have StackItems
  const stackItemBlockIds = new Set(
    stackItems
      .filter((item: any) => item.kind === "block" && item.block !== null)
      .map((item: any) => item.block.id)
  );
  
  // Use StackItem-based ordering (new system) - handle both blocks and embeds
  const stackItemPosts = stackItems
    .filter((item: any) => (item.kind === "block" && item.block !== null) || (item.kind === "stack_embed" && item.embedStack !== null))
    .map((item: any) => {
      // Handle stack embeds
      if (item.kind === "stack_embed" && item.embedStack) {
        return {
          id: item.id, // Use StackItem ID for embeds
          kind: "stack_embed" as const,
          embedStack: {
            id: item.embedStack.id,
            name: item.embedStack.name,
            slug: item.embedStack.slug,
            description: item.embedStack.description,
            is_public: item.embedStack.is_public,
            owner: item.embedStack.owner,
            _count: item.embedStack._count,
          },
          note: item.note,
          addedBy: item.addedBy,
          addedAt: item.createdAt,
        };
      }
      
      // Handle regular blocks
      const p = item.block;
      let thumb_urls = p.thumb_urls;
      if (!thumb_urls?.length && p.file_url) {
        const m = p.file_url?.match(/\/storage\/v1\/object\/public\/pdfs\/(.+)\.pdf$/i);
        const derived = m ? `${SUPA}/storage/v1/object/public/pdf-thumbs/${m[1]}.png` : null;
        thumb_urls = derived ? [derived] : [];
      }
      // Extract stack IDs from connections
      const connectedStackIds = (p.stackConnections || []).map((c: any) => c.stackId);
      return {
        ...p,
        kind: "block" as const,
        thumb_urls,
        // Map DB field names to UI field names
        videoThumbnail: p.videoThumb || null,
        videoEmbedCode: null, // Not stored in DB, built dynamically in UI
        textFormat: p.textContent ? "markdown" : null, // Assume markdown if content exists
        // NEW: Include connection metadata
        connectionNote: item.note,
        note: item.note,
        addedBy: item.addedBy,
        addedAt: item.createdAt,
        connectedStacksCount: connectedStackIds.length || 1,
        connectedStackIds,
      };
    });
    
  // Also include legacy posts that don't have StackItems yet
  const legacyOnlyPosts = legacyPosts
    .filter((p: any) => !stackItemBlockIds.has(p.id))
    .map((p: any) => {
      let thumb_urls = p.thumb_urls;
      if (!thumb_urls?.length && p.file_url) {
        const m = p.file_url?.match(/\/storage\/v1\/object\/public\/pdfs\/(.+)\.pdf$/i);
        const derived = m ? `${SUPA}/storage/v1/object/public/pdf-thumbs/${m[1]}.png` : null;
        thumb_urls = derived ? [derived] : [];
      }
      return {
        ...p,
        thumb_urls,
        // Map DB field names to UI field names
        videoThumbnail: p.videoThumb || null,
        videoEmbedCode: null, // Not stored in DB, built dynamically in UI
        textFormat: p.textContent ? "markdown" : null, // Assume markdown if content exists
      };
    });
  
  // Combine: StackItem blocks first (in order), then legacy posts
  posts = [...stackItemPosts, ...legacyOnlyPosts];
} else {
  // Legacy ordering via Stack.order array (fallback during migration)
  const raw = stack.posts as Array<any>;
  const order = stack.order ?? [];
  const ordered = order.map((id: string) => raw.find(p => p.id === id)).filter(Boolean) as any[];
  const missing = raw.filter(p => !order.includes(p.id));
  const seq = order.length ? [...ordered, ...missing] : raw;

  posts = seq.map(p => {
    let thumb_urls = p.thumb_urls;
    if (!thumb_urls?.length && p.file_url) {
      const m = p.file_url?.match(/\/storage\/v1\/object\/public\/pdfs\/(.+)\.pdf$/i);
      const derived = m ? `${SUPA}/storage/v1/object/public/pdf-thumbs/${m[1]}.png` : null;
      thumb_urls = derived ? [derived] : [];
    }
    return {
      ...p,
      thumb_urls,
      // Map DB field names to UI field names
      videoThumbnail: p.videoThumb || null,
      videoEmbedCode: null, // Not stored in DB, built dynamically in UI
      textFormat: p.textContent ? "markdown" : null, // Assume markdown if content exists
    };
  });
}

function deriveThumbKeyFromFile(fileUrl?: string|null) {
  if (!fileUrl) return null;
  const m = fileUrl.match(/\/storage\/v1\/object\/public\/pdfs\/(.+)\.pdf$/i);
  return m ? `${m[1]}.png` : null;
}

// enhance with safe thumbs
// const posts = inOrder.map((p:any) => {
//   // prefer DB
//   if (p.thumb_urls?.length) return p;
//   // conservative derived fallback: you can keep or drop this now that previews exist
//   const key = deriveThumbKeyFromFile(p.file_url);
//   const derived = key ? `${SUPA}/storage/v1/object/public/pdf-thumbs/${key}` : null;
//   return { ...p, thumb_urls: derived ? [derived] : [] };
// });

  // Ensure there is a root FeedPost to anchor the discussion for this stack
       const discussionKey = `stack:${stack.id}`;
       const discussionRoot = await prisma.feedPost.upsert({
         where: { articleId: discussionKey },
         create: {
          author_id: stack.owner_id,
            stack_id: stack.id,                        // ✅ use scalar FK instead of nested connect
             type: feed_post_type.TEXT,
          content: `Discussion for stack “${stack.name}”`,
          isPublic: stack.is_public,
    articleId: discussionKey,
         },
         update: {},
         select: { id: true },
       });
  
  
  const editable = canEdit(stack, { id: viewerId });
  const subscribed = !!(stack as any).subscribers?.length;

  // const order = stack.order ?? [];
  const postsById = new Map(
    (stack.posts as Array<{ id: string }>).map((p) => [p.id, p])
  );
  // const posts =
  //   order.length > 0
  //     ? order.map((id) => postsById.get(id)).filter(Boolean)
  //     : stack.posts;
 
  // const posts = order.length > 0 ? [...ordered, ...missing] : stack.posts;

  const discussionPostId = await ensureStackDiscussionThread({
    id: stack.id,
    name: stack.name,
    owner_id: stack.owner_id,
    is_public: stack.is_public,
  });


  return {
    stack: {
      id: stack.id,
      name: stack.name,
      description: stack.description,
      is_public: stack.is_public,
      visibility: (stack as any).visibility ?? (stack.is_public ? "public_closed" : "private"),
      owner_id: stack.owner_id,
      slug: stack.slug ?? null,
    },
    posts,
  
    viewer: { id: viewerId, editable, subscribed, isOwner: stack.owner_id === viewerId },
    discussionPostId: discussionRoot.id,
  };
}

export async function toggleStackSubscription(formData: FormData) {
  const u = await getUserFromCookies();
  if (!u) throw new Error("Unauthenticated");
  const userId = BigInt(u.userId ?? 0);

  const stackId = String(formData.get("stackId") || "");
  const op = String(formData.get("op") || "toggle");

       const stack = await prisma.stack.findUnique({
           where: { id: stackId },
           include: { collaborators: true },
         });
         if (!stack) throw new Error("Stack not found");
         // Only allow subscribe if public OR viewer could view anyway.
         if (!(stack.is_public || canView(stack, { id: userId }))) {
           throw new Error("Forbidden");
         }
    
  const existing = await prisma.stackSubscription.findUnique({
    where: { stack_id_user_id: { stack_id: stackId, user_id: userId } },
  });

  if (existing) {
    if (op !== "subscribe") {
      await prisma.stackSubscription.delete({
        where: { stack_id_user_id: { stack_id: stackId, user_id: userId } },
      });
       emitBus("stacks:changed", { stackId, op: "unsubscribe", userId: String(userId) });

    }
  } else {
    if (op !== "unsubscribe") {
      await prisma.stackSubscription.create({
        data: { stack_id: stackId, user_id: userId },
      });
       emitBus("stacks:changed", { stackId, op: "subscribe", userId: String(userId) });

    }
  }

  revalidatePath(`/stacks/${stackId}`);
}

export type AddCollaboratorResult = 
  | { success: true; userId: string }
  | { success: false; error: string };

export async function addCollaborator(formData: FormData): Promise<AddCollaboratorResult> {
  const u = await getUserFromCookies();
  if (!u) return { success: false, error: "Unauthenticated" };
  const ownerId = BigInt(u.userId ?? 0);

  const stackId = String(formData.get("stackId") || "");
  const role = String(formData.get("role") || "EDITOR") as "EDITOR" | "VIEWER";
  const rawUserId = String(formData.get("userId") || "").trim();
  const username = String(formData.get("username") || "").trim();

  if (!rawUserId && !username) {
    return { success: false, error: "Please enter a User ID or Username" };
  }

  const stack = await prisma.stack.findUnique({ where: { id: stackId } });
  if (!stack || stack.owner_id !== ownerId) {
    return { success: false, error: "You don't have permission to add collaborators" };
  }

  let target: { id: bigint } | null = null;
  if (rawUserId) {
    try {
      target = await prisma.user.findUnique({
        where: { id: BigInt(rawUserId) },
        select: { id: true },
      });
    } catch {
      return { success: false, error: "Invalid User ID format" };
    }
  } else if (username) {
    target = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true },
    });
  }
  
  if (!target) {
    return { 
      success: false, 
      error: rawUserId 
        ? `No user found with ID "${rawUserId}"` 
        : `No user found with username "${username}"`
    };
  }

  await prisma.stackCollaborator.upsert({
    where: { stack_id_user_id: { stack_id: stackId, user_id: target.id } },
    create: { stack_id: stackId, user_id: target.id, role },
    update: { role },
  });

  revalidatePath(`/stacks/${stackId}`);
  return { success: true, userId: target.id.toString() };
}

export async function removeCollaborator(formData: FormData) {
  const u = await getUserFromCookies();
  if (!u) throw new Error("Unauthenticated");
  const ownerId = BigInt(u.userId ?? 0);
  const stackId = String(formData.get("stackId") || "");
  const targetUserId = BigInt(String(formData.get("userId") || ""));
  const stack = await prisma.stack.findUnique({ where: { id: stackId } });
  if (!stack || stack.owner_id !== ownerId) throw new Error("Forbidden");
  await prisma.stackCollaborator.delete({
    where: { stack_id_user_id: { stack_id: stackId, user_id: targetUserId } },
  });
  revalidatePath(`/stacks/${stackId}`);
}

export async function setStackOrder(formData: FormData) {
  const u = await getUserFromCookies();
  if (!u) throw new Error("Unauthenticated");
  const userId = BigInt(u.userId ?? 0);
  const stackId = String(formData.get("stackId") || "");
  const orderJson = String(formData.get("orderJson") || "[]");
  const order = JSON.parse(orderJson) as string[];

  await assertCanEditStack(stackId, userId);
  await prisma.stack.update({ where: { id: stackId }, data: { order } });
  revalidatePath(`/stacks/${stackId}`);
}

export async function reorderStack(formData: FormData) {
  const u = await getUserFromCookies();
  if (!u) throw new Error("Unauthenticated");
  const userId = BigInt(u.userId ?? 0);

  const stackId = String(formData.get("stackId") || "");
  const direction = String(formData.get("direction") || "up");
  const postId = String(formData.get("postId") || "");

  const stack = await prisma.stack.findUnique({
    where: { id: stackId },
    include: { collaborators: true },
  });
  if (!stack) throw new Error("Stack not found");
  if (!canEdit(stack, { id: userId })) throw new Error("Forbidden");

  const order = [...(stack.order ?? [])];
  const idx = order.indexOf(postId);
  if (idx === -1) {
    const posts = await prisma.libraryPost.findMany({
      where: { stack_id: stackId },
      orderBy: { created_at: "asc" },
      select: { id: true },
    });
    order.splice(0, order.length, ...posts.map((p) => p.id));
  }

  const i = order.indexOf(postId);
  if (i < 0) return;

  if (direction === "up" && i > 0) {
    [order[i - 1], order[i]] = [order[i], order[i - 1]];
  } else if (direction === "down" && i < order.length - 1) {
    [order[i], order[i + 1]] = [order[i + 1], order[i]];
  }

  await prisma.stack.update({
    where: { id: stackId },
    data: { order },
  });
   emitBus("stacks:changed", { stackId, op: "reorder", postId });

  revalidatePath(`/stacks/${stackId}`);
}


   /** POST a new comment under the stack’s discussion root. */
   export async function addStackComment(formData: FormData) {
    const u = await getUserFromCookies();
    if (!u) throw new Error("Unauthenticated");
    const userId = BigInt(u.userId ?? 0);
  
    const rootIdRaw = String(formData.get("rootId") || "");
    const text = String(formData.get("text") || "").trim();
    if (!rootIdRaw) throw new Error("Missing rootId");
    if (!text) throw new Error("Empty comment");
  
    const rootId = BigInt(rootIdRaw);
    const root = await prisma.feedPost.findUnique({
      where: { id: rootId },
      select: { isPublic: true, stack_id: true },
    });
    if (!root) throw new Error("Thread not found");
  
    let stackId: string | null = root.stack_id;
    if (stackId) {
      const stack = await prisma.stack.findUnique({
        where: { id: stackId },
        include: {
          collaborators: true,
          subscribers: { where: { user_id: userId }, select: { user_id: true } },
        },
      });
      const isOwner = stack?.owner_id === userId;
      const isEditor = !!stack?.collaborators?.some(
        (c) => c.user_id === userId && (c.role === "EDITOR" || c.role === "OWNER")
      );
      const isSub = !!stack?.subscribers?.length;
      const allowed = stack?.is_public || isOwner || isEditor || isSub;
      if (!allowed) throw new Error("Forbidden");
    }
  
    const created = await prisma.feedPost.create({
      data: {
        parent_id: rootId,
        author_id: userId,
        type: "TEXT",
        content: text,
        isPublic: root.isPublic,
      },
      select: { id: true },
    });
    emitBus("comments:changed", { stackId, op: "add" });
    if (stackId) revalidatePath(`/stacks/${stackId}`);
    return created.id; // 👈 return the comment id
  }
     
     /** Delete a comment (author, owner, or editor). */
     export async function deleteStackComment(formData: FormData) {
       const u = await getUserFromCookies();
       if (!u) throw new Error("Unauthenticated");
       const userId = BigInt(u.userId ?? 0);
     
       const commentIdRaw = String(formData.get("commentId") || "");
       if (!commentIdRaw) throw new Error("Missing commentId");
       const commentId = BigInt(commentIdRaw);
     
       const comment = await prisma.feedPost.findUnique({
         where: { id: commentId },
         select: { author_id: true, parent_id: true },
       });
       if (!comment) throw new Error("Not found");
       if (!comment.parent_id) throw new Error("Not a comment");
     
       const root = await prisma.feedPost.findUnique({
         where: { id: comment.parent_id },
         select: { stack_id: true },
       });
       const stackId = root?.stack_id || null;
     
       let allowed = comment.author_id === userId;
       if (!allowed && stackId) {
         const stack = await prisma.stack.findUnique({
           where: { id: stackId },
           include: { collaborators: true },
         });
         const isOwner = stack?.owner_id === userId;
         const isEditor = !!stack?.collaborators?.some(
           (c) => c.user_id === userId && (c.role === "EDITOR" || c.role === "OWNER")
         );
         allowed = isOwner || isEditor;
       }
       if (!allowed) throw new Error("Forbidden");
     
       await prisma.feedPost.delete({ where: { id: commentId } });
        emitBus("comments:changed", { stackId, op: "delete" });

       if (stackId) revalidatePath(`/stacks/${stackId}`);
     }
// lib/actions/stack.actions.ts
export async function removeFromStack(formData: FormData) {
  const u = await getUserFromCookies();
  if (!u) throw new Error("Unauthenticated");
  const userId = BigInt(u.userId ?? 0);

  const stackId = String(formData.get("stackId") || "");
  const postId  = String(formData.get("postId")  || "");
  const kind    = String(formData.get("kind")    || "block");

  const stack = await prisma.stack.findUnique({ 
    where: { id: stackId }, 
    include: { collaborators: true } 
  });
  if (!stack) throw new Error("Stack not found");
  if (!canEdit(stack, { id: userId })) throw new Error("Forbidden");

  // Handle stack_embed removal via StackItem
  if (kind === "stack_embed") {
    await prisma.stackItem.deleteMany({
      where: {
        stackId,
        embedStackId: postId,
        kind: "stack_embed",
      },
    });
    emitBus("stacks:changed", { stackId, op: "remove", embedStackId: postId });
    revalidatePath(`/stacks/${stackId}`);
    return;
  }

  // Handle block removal (legacy path + StackItem cleanup)
  const post = await prisma.libraryPost.findUnique({ 
    where: { id: postId }, 
    select: { stack_id: true } 
  });

  // If already detached or belongs elsewhere, just prune order and StackItem
  if (!post || post.stack_id !== stackId) {
    await prisma.$transaction([
      prisma.stack.update({
        where: { id: stackId },
        data: { order: (stack.order ?? []).filter((id) => id !== postId) },
      }),
      prisma.stackItem.deleteMany({
        where: { stackId, blockId: postId },
      }),
    ]);
    emitBus("stacks:changed", { stackId, op: "remove", postId });
    revalidatePath(`/stacks/${stackId}`);
    return;
  }

  // Normal detach: clear stack_id, prune order, remove StackItem
  await prisma.$transaction([
    prisma.libraryPost.update({ where: { id: postId }, data: { stack_id: null } }),
    prisma.stack.update({
      where: { id: stackId },
      data: { order: (stack.order ?? []).filter((id) => id !== postId) },
    }),
    prisma.stackItem.deleteMany({
      where: { stackId, blockId: postId },
    }),
  ]);
  emitBus("stacks:changed", { stackId, op: "remove", postId });
  revalidatePath(`/stacks/${stackId}`);
}