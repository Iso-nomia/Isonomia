/**
 * JSON Export Generator
 * 
 * Phase 1.6 of Stacks Improvement Roadmap
 * 
 * Generates a JSON export of stack data for API/automation use.
 */

export interface StackExportData {
  exportedAt: string;
  version: string;
  stack: {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    visibility: string;
    owner: {
      name: string;
      username: string;
    };
    createdAt: string;
  };
  items: Array<{
    id: string;
    kind: string;
    position: number;
    note: string | null;
    addedBy: { name: string; username: string } | null;
    addedAt: string;
    block?: {
      id: string;
      type: string;
      title: string | null;
      // PDF fields
      fileUrl?: string | null;
      pageCount?: number | null;
      // Link fields
      linkUrl?: string | null;
      linkTitle?: string | null;
      linkDescription?: string | null;
      linkImage?: string | null;
      // Text fields
      textContent?: string | null;
      // Video fields
      videoUrl?: string | null;
      videoProvider?: string | null;
    };
    embedStack?: {
      id: string;
      name: string;
      slug: string | null;
    };
  }>;
  stats: {
    totalItems: number;
    blockCount: number;
    embedCount: number;
    byType: Record<string, number>;
  };
}

export interface StackForExport {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  visibility: string;
  created_at: Date;
  owner: {
    name: string | null;
    username: string | null;
  };
  items: Array<{
    id: string;
    kind: string;
    position: number;
    note: string | null;
    createdAt: Date;
    addedBy: { name: string | null; username: string | null } | null;
    block: {
      id: string;
      blockType: string | null;
      title: string | null;
      file_url: string | null;
      page_count: number | null;
      linkUrl: string | null;
      linkTitle: string | null;
      linkDescription: string | null;
      linkImage: string | null;
      textContent: string | null;
      videoUrl: string | null;
      videoProvider: string | null;
    } | null;
    embedStack: {
      id: string;
      name: string;
      slug: string | null;
    } | null;
  }>;
}

export function generateJSONExport(stack: StackForExport): StackExportData {
  const byType: Record<string, number> = {};
  let blockCount = 0;
  let embedCount = 0;

  const items = stack.items.map((item) => {
    const baseItem = {
      id: item.id,
      kind: item.kind,
      position: item.position,
      note: item.note,
      addedBy: item.addedBy ? {
        name: item.addedBy.name || "Unknown",
        username: item.addedBy.username || "unknown",
      } : null,
      addedAt: item.createdAt.toISOString(),
    };

    if (item.kind === "stack_embed" && item.embedStack) {
      embedCount++;
      return {
        ...baseItem,
        embedStack: {
          id: item.embedStack.id,
          name: item.embedStack.name,
          slug: item.embedStack.slug,
        },
      };
    }

    if (item.block) {
      blockCount++;
      const blockType = item.block.blockType || "pdf";
      byType[blockType] = (byType[blockType] || 0) + 1;

      return {
        ...baseItem,
        block: {
          id: item.block.id,
          type: blockType,
          title: item.block.title,
          // PDF fields
          fileUrl: item.block.file_url,
          pageCount: item.block.page_count,
          // Link fields
          linkUrl: item.block.linkUrl,
          linkTitle: item.block.linkTitle,
          linkDescription: item.block.linkDescription,
          linkImage: item.block.linkImage,
          // Text fields
          textContent: item.block.textContent,
          // Video fields
          videoUrl: item.block.videoUrl,
          videoProvider: item.block.videoProvider,
        },
      };
    }

    return baseItem;
  });

  return {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    stack: {
      id: stack.id,
      name: stack.name,
      slug: stack.slug,
      description: stack.description,
      visibility: stack.visibility,
      owner: {
        name: stack.owner.name || "Unknown",
        username: stack.owner.username || "unknown",
      },
      createdAt: stack.created_at.toISOString(),
    },
    items,
    stats: {
      totalItems: items.length,
      blockCount,
      embedCount,
      byType,
    },
  };
}
