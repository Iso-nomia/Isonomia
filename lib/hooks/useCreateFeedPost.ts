"use client";

export type ClientCreateFeedPostArgs = {
  type:
    | "TEXT" | "IMAGE" | "VIDEO" | "GALLERY" | "PREDICTION" | "PRODUCT_REVIEW"
    | "MUSIC" | "LIVECHAT" | "ARTICLE" | "LIBRARY";
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  isPublic?: boolean;
library?: {     kind: "single" | "stack";
libraryPostId: string | null;
coverUrl: string | null;
coverUrls: string[];
size: number;
stackId?: string;
caption?: string;}
  productReview?: {
    productName: string;
    rating: number;
    summary: string;
    productLink?: string;
    images?: string[];
    claims?: string[];
  };
};

export function useCreateFeedPost() {
  return async function createFeedPost(args: ClientCreateFeedPostArgs) {
    const res = await fetch("/api/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(`Failed: ${error}`);
    }
    return res.json();
  };
}
