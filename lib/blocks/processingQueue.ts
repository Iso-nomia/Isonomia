/**
 * Block Processing Queue
 * 
 * Phase 1.2 of Stacks Improvement Roadmap
 * 
 * Handles async processing of blocks (link metadata extraction, video parsing, etc.)
 */

import { prisma } from "@/lib/prismaclient";
import { extractLinkMetadata, parseVideoUrl } from "./linkExtractor";

// Use in-memory queue for simplicity, can be upgraded to Redis/BullMQ later
interface QueueItem {
  blockId: string;
  blockType: string;
  addedAt: Date;
  retries: number;
}

const processingQueue: QueueItem[] = [];
let isProcessing = false;

/**
 * Add a block to the processing queue
 */
export function enqueueBlockProcessing(blockId: string, blockType: string): void {
  processingQueue.push({
    blockId,
    blockType,
    addedAt: new Date(),
    retries: 0,
  });

  // Start processing if not already running
  if (!isProcessing) {
    processQueue();
  }
}

/**
 * Process the queue (called automatically when items are added)
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (processingQueue.length > 0) {
    const item = processingQueue.shift();
    if (!item) continue;

    try {
      await processBlock(item.blockId, item.blockType);
    } catch (error) {
      console.error(`Failed to process block ${item.blockId}:`, error);

      // Retry up to 3 times
      if (item.retries < 3) {
        item.retries++;
        processingQueue.push(item);
      }
    }
  }

  isProcessing = false;
}

/**
 * Process a single block
 */
async function processBlock(blockId: string, blockType: string): Promise<void> {
  // Mark as processing
  await prisma.libraryPost.update({
    where: { id: blockId },
    data: { processingStatus: "processing" },
  });

  try {
    switch (blockType) {
      case "link":
        await processLinkBlock(blockId);
        break;
      case "video":
        await processVideoBlock(blockId);
        break;
      case "image":
        await processImageBlock(blockId);
        break;
      default:
        // No processing needed
        break;
    }

    // Mark as completed
    await prisma.libraryPost.update({
      where: { id: blockId },
      data: {
        processingStatus: "completed",
        processedAt: new Date(),
        processingError: null,
      },
    });
  } catch (error) {
    // Mark as failed
    await prisma.libraryPost.update({
      where: { id: blockId },
      data: {
        processingStatus: "failed",
        processingError: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

/**
 * Process a link block - extract metadata
 */
async function processLinkBlock(blockId: string): Promise<void> {
  const block = await prisma.libraryPost.findUnique({
    where: { id: blockId },
    select: { linkUrl: true },
  });

  if (!block?.linkUrl) {
    throw new Error("No URL for link block");
  }

  const metadata = await extractLinkMetadata(block.linkUrl);

  await prisma.libraryPost.update({
    where: { id: blockId },
    data: {
      linkCanonical: metadata.canonical,
      linkTitle: metadata.title,
      linkDescription: metadata.description,
      linkImage: metadata.image,
      linkFavicon: metadata.favicon,
      linkSiteName: metadata.siteName,
      linkReadableText: metadata.readableText?.slice(0, 10000), // Limit size
      title: metadata.title, // Also set main title field
    },
  });
}

/**
 * Process a video block - extract provider info
 */
async function processVideoBlock(blockId: string): Promise<void> {
  const block = await prisma.libraryPost.findUnique({
    where: { id: blockId },
    select: { videoUrl: true },
  });

  if (!block?.videoUrl) {
    throw new Error("No URL for video block");
  }

  const parsed = parseVideoUrl(block.videoUrl);

  await prisma.libraryPost.update({
    where: { id: blockId },
    data: {
      videoProvider: parsed.provider,
      videoEmbedId: parsed.embedId,
      videoThumb: parsed.thumbnail,
    },
  });

  // If we can get a title from the provider, do so
  if (parsed.provider === "youtube" && parsed.embedId) {
    try {
      const title = await fetchYouTubeTitle(parsed.embedId);
      if (title) {
        await prisma.libraryPost.update({
          where: { id: blockId },
          data: { title },
        });
      }
    } catch {
      // Title fetch is optional, don't fail the whole process
    }
  }
}

/**
 * Process an image block - get dimensions if possible
 */
async function processImageBlock(blockId: string): Promise<void> {
  const block = await prisma.libraryPost.findUnique({
    where: { id: blockId },
    select: { imageUrl: true },
  });

  if (!block?.imageUrl) {
    throw new Error("No URL for image block");
  }

  // For now, just mark as processed
  // Future: could fetch image to get dimensions, generate thumbnails, etc.
}

/**
 * Fetch YouTube video title (uses oEmbed - no API key needed)
 */
async function fetchYouTubeTitle(videoId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.title || null;
  } catch {
    return null;
  }
}

/**
 * Manually trigger processing for a block (useful for retries)
 */
export async function reprocessBlock(blockId: string): Promise<void> {
  const block = await prisma.libraryPost.findUnique({
    where: { id: blockId },
    select: { blockType: true },
  });

  if (!block) {
    throw new Error("Block not found");
  }

  await processBlock(blockId, block.blockType);
}

/**
 * Get processing queue status
 */
export function getQueueStatus(): {
  queueLength: number;
  isProcessing: boolean;
} {
  return {
    queueLength: processingQueue.length,
    isProcessing,
  };
}
