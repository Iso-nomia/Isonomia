"use client";

import Image from "next/image";
import Link from "next/link";
import LikeButton from "../buttons/LikeButton";
import ShareButton from "../buttons/ShareButton";
import ExpandButton from "../buttons/ExpandButton";
import TimerButton from "../buttons/TimerButton";
import ReplicateButton from "../buttons/ReplicateButton";
import { canRepost } from "@/lib/repostPolicy";
import ReplicatedPostCard from "./ReplicatedPostCard";
import ProductReviewCard from "./ProductReviewCard";
import DeleteCardButton from "../buttons/DeleteCardButton";

import SoundCloudPlayer from "../players/SoundCloudPlayer";
import Spline from "@splinetool/react-spline";
import dynamic from "next/dynamic";
import PredictionMarketCard from "./PredictionMarketCard";
import GalleryCarousel from "./GalleryCarousel";
import PdfLightbox from "../modals/PdfLightbox";
import LibraryCard from "./LibraryCard";
import ArticleCard from "../article/ArticleCard";
import type { Like, RealtimeLike } from "@prisma/client";
import { useState } from "react";
import React from "react";
import localFont from "next/font/local";
import type { BasePost, CanvasState } from "@/lib/types/post";
import { parseJson } from "@/lib/parsejsonhelper";


const founders = localFont({ src: "./NewEdgeTest-RegularRounded.otf" });
const DrawCanvas = dynamic(() => import("./DrawCanvas"), { ssr: false });
const LivechatCard = dynamic(() => import("./LivechatCard"), { ssr: false });
const EntropyCard = dynamic(() => import("./EntropyCard"), { ssr: false });

type ArticleFeedPayload = {
  kind: 'article'
  slug: string
  title?: string
  heroImageKey?: string | null
  excerpt?: string | null
  readingTime?: number | null
  articleId?: string | null
}

const isArticleMeta = (v: any): v is ArticleFeedPayload =>
  v && typeof v === 'object' && v.kind === 'article' && typeof v.slug === 'string'

interface ExtraUIProps {
  currentUserId?: bigint | null;
  currentUserLike?: Like | RealtimeLike | null;
  isRealtimePost?: boolean;
  isFeedPost?: boolean;
  embedPost?: React.ReactNode;
}

type PostCardProps = BasePost & ExtraUIProps & { library?: any | null };

const PostCard = ({
  id,
  currentUserId,
  currentUserLike = null,
  content,
  roomPostContent = null,
  author,
  image_url,
  productReview,
  video_url,
  caption,
  type,
  createdAt,
  isRealtimePost = false,
  isFeedPost = true,
  likeCount = 0,
  commentCount = 0,
  expirationDate = null,
  embedPost,
  pluginType = null,
  pluginData = null,
  claimIds,
  predictionMarket = null,
  library = null,
}: PostCardProps) => {

const [postId, setPostId] = useState<string | null>(null);
 const [lightboxOpen, setLightboxOpen] = React.useState(false);
  if (content && content.startsWith("REPLICATE:")) {
    const dataStr = content.slice("REPLICATE:".length);
    // let originalId: bigint | null = null;
    // let replicateText = "Replicated";
    let originalId: bigint | null = null;
    let replicateText = "Replicated";
    let source: "feed" | "realtime" = "realtime";
    try {
      const parsed = JSON.parse(dataStr);
      originalId = BigInt(parsed.id);
      replicateText = parsed.text || replicateText;
      source = parsed.source || "realtime";
    } catch (e) {
      try {
        originalId = BigInt(dataStr);
      } catch {
        originalId = null;
      }
    }

    if (!originalId) return null;

    return (
      <ReplicatedPostCard
        id={id}
        originalPostId={originalId}
        source={source}
        currentUserId={currentUserId}
        author={author}
        createdAt={new Date(createdAt)}
        likeCount={likeCount}
        expirationDate={expirationDate ?? undefined}
        text={replicateText}
      />
    );
  }
  return (
    <article className="relative flex w-full flex-col postcard p-7 ">
      <div className="flex items-start justify-between ">
        <div className="flex w-full flex-1 flex-row gap-4 ">
          <div className="flex flex-col items-center  ">
            <Link
              href={`/profile/${author.id}`}
              className="relative h-[2.75rem] w-[2.75rem] left-[.65rem] top-[.1rem]  "
            >
              <Image
                src={author.image || "/assets/user-helsinki.svg"}
                alt="Profile Image"
                fill
                style={{ objectFit: "cover" }}
                className="cursor-pointer rounded-full border-[.05rem] border-indigo-300 profile-shadow hover:shadow-none 

                "
              />
            </Link>
          </div>
          <div className=""></div>
          <div>
            <Link href={`/profile/${author.id}`} className="w-fit ">
              <div className={`${founders.className} `}>
                <p className="cursor-pointer  text-[1.08rem] tracking-[.05rem] font-semibold text-black relative top-[.2rem] right-[.25rem] ">
                  {author.name}
                </p>
              </div>
            </Link>
            <div className="relative right-[.25rem] text-[.75rem] text-gray-500">
              {new Date(createdAt).toLocaleDateString()}
            </div>

            <hr className="mt-2 mb-3 w-full h-px border-t-0 bg-transparent bg-gradient-to-r from-transparent via-slate-100 to-transparent opacity-55" />
            {type === "TEXT" && content && (
              <p className="mt-2 ml-1 text-left  text-[1.08rem] text-black tracking-[.05rem] max-w-[90%]">
                {content}
              </p>
            )}

{type === "ARTICLE" && (() => {
  const meta = parseJson<any>(content)

  // ✅ New payload path
  if (isArticleMeta(meta)) {
    return (
      <div className="w-full flex px-8 flex-1 justify-center items-center">
        <ArticleCard
          postId={id}
          meta={{
            articleId: meta.articleId ?? null,
            slug: meta.slug,
            title: meta.title ?? "Untitled",
            heroImageKey: meta.heroImageKey ?? null,
            excerpt: meta.excerpt ?? null,
            readingTime: meta.readingTime ?? null,
          }}
        />
       </div>
    )
  }

  // 🕜 Legacy string fallback: content === "/article/slug"
  if (typeof content === 'string' && content.startsWith('/article/')) {
    return (
      <Link href={content}>
        <button className="px-2 py-1 border rounded text-sm">View article</button>
      </Link>
    )
  }

  // 🕳️ Nothing renderable—avoid crash
  return null
})()}
            {(type === "IMAGE" || type === "IMAGE_COMPUTE") && image_url && (
              <Image
                className="flex img-feed-frame ml-[19%] mr-[19%] rounded-sm mt-[1rem] mb-[1rem]"
                src={image_url}
                alt={caption || "image"}
                width={700}
                height={400}
                sizes="100vw"
                style={{ width: "auto", height: "auto" }}
              />

              // <Image
              //   className=" flex img-feed-frame ml-[19%] mr-[19%] rounded-sm mt-[1rem] mb-[1rem] "
              //   src={image_url}
              //   alt="image not found"
              //   width={0}
              //   height={0}
              //   sizes="200vw"
              // />
            )}
            {type === "VIDEO" && video_url && (
              <div className="mt-2 mb-2 w-[70%] border-none loginbutton hover:loginbutton ">
                <iframe
                  title="video"
                  width={696}
                  height={378}
                  src={video_url}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                ></iframe>
              </div>
            )}
            {type === "MUSIC" && video_url && (
              <SoundCloudPlayer src={video_url} title={content || caption || undefined} />
            )}
            {type === "GALLERY" && content && (
              // <div className="ml-[7rem] w-[500px] justify-center items-center">
              <div className="grid justify-center items-center align-center w-full ">
                <GalleryCarousel
                  urls={JSON.parse(content)}
                  caption={caption || undefined}
                />
              </div>
            )}
            
            {type === "LIBRARY" &&
            
              (() => {
                const lib =
                  library ??
                  (() => {
                    try {
                      return content ? JSON.parse(content) : null;
                    } catch {
                      return null;
                    }
                  })();
                if (!lib) return null;
                return (
                  <>

                  <LibraryCard
                    kind={lib.kind}
                    coverUrl={lib.coverUrl}
                    libraryPostId={lib.libraryPostId}
                    stackId={lib.stackId}
                    coverUrls={lib.coverUrls}
                    size={lib.size}
                    caption={caption}
                    onOpenPdf={(id) => {
                      setPostId(id);
                      setLightboxOpen(true);
                    }}
                    onOpenStack={(id) => console.debug("openStack", id)}
                  />
                  {/* PDF Lightbox mounted once per PostCard */}
                  <PdfLightbox
  open={lightboxOpen}
  onOpenChange={(v) => {
    setLightboxOpen(v);
    if (!v) setTimeout(() => setPostId(null), 150);
  }}
  postId={postId ?? undefined}
/>
                </>
                );
              })()}
            {type === "LIVECHAT" &&
              content &&
              (() => {
                let inviteeId = 0;
                try {
                  inviteeId = JSON.parse(content).inviteeId;
                } catch (e) {
                  inviteeId = 0;
                }
                return (
                  <div className="mt-2 mb-2 flex justify-center items-center">
                    <LivechatCard
                      id={id.toString()}
                      inviteeId={inviteeId}
                      authorId={Number(author.id)}
                    />
                  </div>
                );
              })()}
            {type === "ENTROPY" &&
              content &&
              (() => {
                let inviteeId = 0;
                try {
                  inviteeId = JSON.parse(content).inviteeId;
                } catch (e) {
                  inviteeId = 0;
                }
                return (
                  <div className="mt-2 mb-2 flex justify-center items-center">
                    <EntropyCard
                      id={id.toString()}
                      content={content}
                      inviteeId={inviteeId}
                      authorId={Number(author.id)}
                    />
                  </div>
                );
              })()}
            {type === "DRAW" && (
              <div className="mt-2 mb-2 flex justify-center items-center">
                <DrawCanvas id={id.toString()} content={content ?? undefined} />
              </div>
            )}
            {/* {type === "ROOM_CANVAS" && roomPostContent && (
              <div className="mt-2 mb-2 flex flex-col items-center justify-center">
                <EmbeddedCanvas canvas={roomPostContent} roomId={roomPostContent.roomId || "global"} />
              </div>
            )}
            {type === "ROOM_CANVAS" && content && (
              <p className="mt-2 text-[1.08rem] text-black tracking-[.05rem]">{content}</p>
            )} */}
            {type === "PRODUCT_REVIEW" &&
              /* Prefer the 1-to-1 relation; fall back to legacy JSON string */
              (productReview ? (
                <ProductReviewCard
                  productName={productReview.product_name}
                  rating={productReview.rating}
                  summary={productReview.summary ?? ""}
                  productLink={productReview.product_link ?? ""}
                  /* relation is optional ➜ defensive chaining */
                  claims={productReview.claims?.map((c) => c.text) ?? []}
                  claimIds={claimIds ?? []}
                  productimages={productReview.image_urls}
                />
              ) : (
                content &&
                (() => {
                  let vals: any = null;
                  try {
                    vals = JSON.parse(content);
                  } catch {
                    /* ignore */
                  }
                  return vals ? (
                    <ProductReviewCard
                      productName={vals.productName}
                      rating={vals.rating}
                      summary={vals.summary}
                      productLink={vals.productLink}
                      claims={vals.claims || []}
                      claimIds={claimIds ?? []}
                      productimages={vals.images || []}
                    />
                  ) : null;
                })()
              ))}

            {type === "PREDICTION" && predictionMarket && (
              <PredictionMarketCard
                key={id.toString()}
                post={{ id, predictionMarket }}
              />
            )}
            {type === "PLUGIN" && pluginType === "PDF_VIEWER" && pluginData && (
              <div className="mt-2 mb-2 flex img-feed-frame w-[100%] ml-[23%]  justify-center items-center">
                <object
                  data={(pluginData as any).pdfUrl}
                  type="application/pdf"
                  width="200%"
                  height="500"
                >
                  <p>
                    <a href={(pluginData as any).pdfUrl}>Download PDF</a>
                  </p>
                </object>
              </div>
            )}
            {type === "PLUGIN" &&
              pluginType === "SPLINE_VIEWER" &&
              pluginData && (
                <div className="mt-2 mb-2 flex justify-center items-center  ml-1/2 w-full">
                  <Spline
                    scene={(pluginData as any).sceneUrl}
                    className="w-[100%] h-[30vw]"
                  />
                </div>
              )}
            <div className="items-start justify-start  px-12  w-full">
              {embedPost && (
                <>
                  <hr className="mt-2 mb-4 w-full h-px border-t-0 bg-transparent bg-gradient-to-r from-transparent via-slate-100 to-transparent opacity-55" />

                  <div className="flex flex-2 mt-2   items-center scale-85">
                    {embedPost}
                  </div>
                </>
              )}
            </div>
            <hr className="mt-3 mb-3 w-full h-px border-t-0 bg-transparent bg-gradient-to-r from-transparent via-slate-100 to-transparent opacity-55" />

            <div className="mt-4 flex flex-col gap-x-3 gap-y-4">
              <div className="flex gap-x-10 gap-y-8">
                <LikeButton
                  {...(isRealtimePost
                    ? { realtimePostId: id.toString() }
                    : { feedpostId: id.toString() })}
                  likeCount={likeCount}
                  initialLikeState={currentUserLike}
                />
                <div className="flex flex-row items-center gap-2 ">
                  <ExpandButton
                    // {...(isRealtimePost
                    //   ? { realtimePostId: id.toString() }
                    //   : isFeedPost
                    //   ? { postId: id }
                    //   : { postId: id })}
                    targetId={id} // ← always the post table PK
                  />
                  {commentCount >= 0 && (
                    <div className="w-2 text-center  text-subtle-medium text-black">
                      {commentCount}
                    </div>
                  )}
                </div>
                {canRepost(type) && (
                  <ReplicateButton
                    type={type}
                    {...(isRealtimePost
                      ? { realtimePostId: id.toString() }
                      : isFeedPost
                      ? { feedPostId: id }
                      : { feedPostId: id })}
                  />
                )}
                <ShareButton feedpostId={id} />

                <TimerButton
                  {...(isRealtimePost
                    ? { realtimePostId: id.toString() }
                    : isFeedPost
                    ? { feedPostId: id }
                    : { feedPostId: id })}
                  isOwned={String(currentUserId ?? "") === String(author.id)}
                  expirationDate={expirationDate ?? undefined}
                />

                {String(currentUserId ?? "") === String(author.id) && (
                  <DeleteCardButton
                    {...(isRealtimePost
                      ? { realtimePostId: id.toString() }
                      : isFeedPost
                      ? { feedPostId: id }
                      : { feedPostId: id })}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>

  );
};

export default PostCard;
