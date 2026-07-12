/**
 * Markdown Export Generator
 * 
 * Phase 1.6 of Stacks Improvement Roadmap
 * 
 * Generates a readable Markdown export of a stack.
 */

export interface StackForMarkdownExport {
  name: string;
  description: string | null;
  visibility: string;
  created_at: Date;
  owner: {
    name: string | null;
    username: string | null;
  };
  items: Array<{
    kind: string;
    note: string | null;
    addedBy: { name: string | null } | null;
    block: {
      blockType: string | null;
      title: string | null;
      file_url: string | null;
      linkUrl: string | null;
      linkTitle: string | null;
      linkDescription: string | null;
      textContent: string | null;
      textPlain: string | null;
      videoUrl: string | null;
      videoProvider: string | null;
    } | null;
    embedStack: {
      name: string;
      slug: string | null;
      description: string | null;
    } | null;
  }>;
}

export function generateMarkdownExport(stack: StackForMarkdownExport): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${stack.name}`);
  lines.push("");
  
  if (stack.description) {
    lines.push(`> ${stack.description}`);
    lines.push("");
  }
  
  lines.push(`*Curated by ${stack.owner.name || "Unknown"} (@${stack.owner.username || "unknown"})*`);
  lines.push("");
  lines.push(`**Visibility**: ${formatVisibility(stack.visibility)}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Items
  let itemNumber = 0;
  for (const item of stack.items) {
    itemNumber++;

    // Handle embedded stacks
    if (item.kind === "stack_embed" && item.embedStack) {
      lines.push(`## ${itemNumber}. 📁 ${item.embedStack.name}`);
      lines.push("");
      lines.push("*Embedded Stack*");
      if (item.embedStack.description) {
        lines.push("");
        lines.push(`> ${item.embedStack.description}`);
      }
      if (item.note) {
        lines.push("");
        lines.push(`💬 *"${item.note}"*`);
      }
      lines.push("");
      lines.push("---");
      lines.push("");
      continue;
    }

    // Handle blocks
    if (!item.block) continue;
    const block = item.block;
    const blockType = block.blockType || "pdf";

    switch (blockType) {
      case "pdf":
        lines.push(`## ${itemNumber}. 📄 ${block.title || "Untitled PDF"}`);
        lines.push("");
        if (block.file_url) {
          lines.push(`📎 [Download PDF](${block.file_url})`);
          lines.push("");
        }
        break;

      case "link":
        const linkTitle = block.linkTitle || block.title || block.linkUrl || "Untitled Link";
        lines.push(`## ${itemNumber}. 🔗 ${linkTitle}`);
        lines.push("");
        if (block.linkUrl) {
          lines.push(`🌐 ${block.linkUrl}`);
          lines.push("");
        }
        if (block.linkDescription) {
          lines.push(`> ${block.linkDescription}`);
          lines.push("");
        }
        break;

      case "text":
        lines.push(`## ${itemNumber}. 📝 ${block.title || "Note"}`);
        lines.push("");
        if (block.textContent) {
          // Include the text content directly (it's already markdown)
          lines.push(block.textContent);
          lines.push("");
        } else if (block.textPlain) {
          lines.push(block.textPlain);
          lines.push("");
        }
        break;

      case "video":
        lines.push(`## ${itemNumber}. 🎬 ${block.title || "Video"}`);
        lines.push("");
        if (block.videoUrl) {
          const provider = block.videoProvider ? ` (${block.videoProvider})` : "";
          lines.push(`🎥 [Watch Video${provider}](${block.videoUrl})`);
          lines.push("");
        }
        break;

      default:
        lines.push(`## ${itemNumber}. ${block.title || "Untitled"}`);
        lines.push("");
    }

    // Add note if present
    if (item.note) {
      lines.push(`💬 *"${item.note}"*`);
      if (item.addedBy?.name) {
        lines.push(`— Added by ${item.addedBy.name}`);
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  // Footer
  lines.push("");
  lines.push(`---`);
  lines.push("");
  lines.push(`*Exported from Mesh on ${new Date().toISOString().split("T")[0]}*`);
  lines.push(`*${stack.items.length} items total*`);

  return lines.join("\n");
}

function formatVisibility(visibility: string): string {
  switch (visibility) {
    case "public_open":
      return "Public Open (anyone can add)";
    case "public_closed":
      return "Public";
    case "private":
      return "Private";
    case "unlisted":
      return "Unlisted";
    default:
      return visibility;
  }
}
