import type { Node, Edge } from "@xyflow/react";
import type { Like, RealtimeLike } from "@prisma/client";

export interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
  roomId?: string;
}

export interface BasePost {
  id: bigint;
  canonicalId: bigint;        // ← NEW (posts table id)
  post_id?: bigint | null;   // ← new

  author: { id: bigint; name: string | null; image: string | null };
  type: string;
  content?: string | null;
  roomPostContent?: CanvasState | null;
  image_url?: string | null;
  productReview?: {
    product_name: string;
    rating: number;
    summary?: string | null;
    product_link?: string | null;
    image_urls: string[];
    claims: { text: string }[];
  };
  video_url?: string | null;
  caption?: string | null;
  pluginType?: string | null;
  pluginData?: Record<string, unknown> | null;
  predictionMarket?: any | null;
  claimIds?: (string | number | bigint)[];
  likeCount: number;
  commentCount: number;
  expirationDate?: string | null;
  currentUserLike?: Like | RealtimeLike | null;
  //createdAt: Date;
  createdAt: string;
}
