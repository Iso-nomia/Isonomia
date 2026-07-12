"use client";

import { useState } from "react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { AnimatedDialog } from "../ui/AnimatedDialog";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createFeedPost as createFeedPostAction } from "@/lib/actions/feedpost.actions";
import { feed_post_type, realtime_post_type } from "@prisma/client";
import TextNodeModal from "@/components/modals/TextNodeModal";
import ImageNodeModal from "@/components/modals/ImageNodeModal";
import YoutubeNodeModal from "@/components/modals/YoutubeNodeModal";
import CollageCreationModal from "@/components/modals/CollageCreationModal";
import GalleryNodeModal from "@/components/modals/GalleryNodeModal";
import PortalNodeModal from "@/components/modals/PortalNodeModal";
import LivechatNodeModal from "@/components/modals/LivechatNodeModal";
import EntropyNodeModal from "@/components/modals/EntropyNodeModal";
import PdfViewerNodeModal from "@/components/modals/PdfViewerNodeModal";
import ProductReviewNodeModal from "../modals/ProductReviewNodeModal";
import MusicNodeModal from "../modals/MusicNodeModal";
import SplineViewerNodeModal from "../modals/SplineViewerNodeModal";
import PredictionMarketModal from "../modals/PredictionMarketModal";
// import LibraryPostModal from "@/components/modals/LibraryPostModal";
import dynamic from "next/dynamic";
import {
  uploadFileToSupabase,
  uploadAudioToSupabase,
  serializeBigInt,
} from "@/lib/utils";
import { createRealtimePost } from "@/lib/actions/realtimepost.actions";
import { fetchUserByUsername } from "@/lib/actions/user.actions";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  TextPostValidation,
  ImagePostValidation,
  YoutubePostValidation,
  GalleryPostValidation,
  PortalNodeValidation,
  PdfViewerPostValidation,
  SplineViewerPostValidation,
  ProductReviewValidation,
} from "@/lib/validations/thread";

import { useCreateFeedPost } from "@/lib/hooks/useCreateFeedPost";  // client
import { useSession }        from "@/lib/hooks/useSession";
const LibraryPostModal = dynamic(() => import("@/components/modals/LibraryPostModal"), { ssr: false });
const nodeOptions: { label: string; nodeType: string }[] = [
  { label: "TEXT", nodeType: "TEXT" },
  { label: "IMAGE", nodeType: "IMAGE" },
  { label: "VIDEO", nodeType: "VIDEO" },
  { label: "MUSIC", nodeType: "MUSIC" },
  { label: "LIVESTREAM", nodeType: "LIVESTREAM" },
  // { label: "IMAGE_COMPUTE", nodeType: "IMAGE_COMPUTE" },
  // { label: "COLLAGE", nodeType: "COLLAGE" },
  { label: "GALLERY", nodeType: "GALLERY" },
  // { label: "PORTAL", nodeType: "PORTAL" },
  { label: "DRAW", nodeType: "DRAW" },
  { label: "LIVECHAT", nodeType: "LIVECHAT" },

  { label: "ENTROPY", nodeType: "ENTROPY" },
  { label: "PDF", nodeType: "PDF_VIEWER" },
  { label: "SPLINE", nodeType: "SPLINE_VIEWER" },
  { label: "PRODUCT_REVIEW", nodeType: "PRODUCT_REVIEW" },
  { label: "PREDICTION", nodeType: "PREDICTION" },
  { label: "ROOM_CANVAS", nodeType: "ROOM_CANVAS" },
  { label: "LIBRARY", nodeType: "LIBRARY" },
];

interface Props {
  roomId?: string;
}

const CreateFeedPost = ({ roomId = "global" }: Props) => {
    const { session, loading: authLoading } = useSession();     // who is this?
  const createFeedPost = useCreateFeedPost();                 // POST helper
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const router = useRouter();

  function reset() {
    setOpen(false);
    setSelectedType("");
  }

  async function handleTextSubmit(values: z.infer<typeof TextPostValidation>) {
    if (roomId === "global") {
      await createFeedPost({
        type: "TEXT",
        content: values.postContent,
      });
    }
    if (roomId === "global") {   // ⬅ use the hook not the server action
            await createFeedPost({ type: "TEXT", content: values.postContent });     }
      else {
      await createRealtimePost({
        text: values.postContent,
        path: "/",
        coordinates: { x: 0, y: 0 },
        type: "TEXT",
        realtimeRoomId: roomId,
      });
    }
    reset();
    router.refresh();
  }

  async function handleImageSubmit(
    values: z.infer<typeof ImagePostValidation>
  ) {
    const result = await uploadFileToSupabase(values.image);
    if (!result.error) {
      if (roomId === "global") {
        await createFeedPost({
          type: "IMAGE",
          imageUrl: result.fileURL ?? undefined,
          caption: values.caption,
        });
      } else {
        await createRealtimePost({
          imageUrl: result.fileURL ?? undefined,
          text: values.caption,
          path: "/",
          coordinates: { x: 0, y: 0 },
          type: "IMAGE",
          realtimeRoomId: roomId,
        });
      }
      reset();
      router.refresh();
    }
  }

  async function handleVideoSubmit(
    values: z.infer<typeof YoutubePostValidation>
  ) {
    if (roomId === "global") {
      await createFeedPost({
        type: "VIDEO",
        videoUrl: values.videoURL,
      });
    } else {
      await createRealtimePost({
        videoUrl: values.videoURL,
        path: "/",
        coordinates: { x: 0, y: 0 },
        type: "VIDEO",
        realtimeRoomId: roomId,
      });
    }
    reset();
    router.refresh();
  }

  async function handleMusicSubmit(values: { audioFile: File; title: string }) {
    const result = await uploadAudioToSupabase(values.audioFile);
    if (result.error) return;
    if (roomId === "global") {
          // treat audio files the same way we treat images / video in the feed
          await createFeedPost({
            type: "MUSIC",                 // enum value in Prisma
           videoUrl: result.fileURL ?? undefined,      // ← stored in `video_url` column
           caption:  values.title.slice(0, 140) || undefined,
          });}
        // } else {
        //   await createRealtimePost({
        //     videoUrl:     result.fileURL,        // reused column
        //     text:         values.title,
        //     path:         "/",
        //     coordinates:  { x: 0, y: 0 },
        //     type:         "MUSIC",
        //   realtimeRoomId: roomId,
        //   });
        // }
    reset();
    router.refresh();
  }

  async function handleGallerySubmit(
    values: z.infer<typeof GalleryPostValidation>
  ) {
    const uploads = await Promise.all(
      values.images.map((img) => uploadFileToSupabase(img))
    );
    const urls = uploads
      .filter((r) => !r.error)
      .map((r) => r.fileURL)
      .filter((u): u is string => u != null);
    if (urls.length > 0) {
      if (roomId === "global") {
        await createFeedPost({
          type: "GALLERY",
          imageUrl: urls[0],
          content: JSON.stringify(urls),
          caption: values.caption,
          isPublic: values.isPublic,
        });
      } else {
        await createRealtimePost({
          path: "/",
          coordinates: { x: 0, y: 0 },
          type: "GALLERY",
          realtimeRoomId: roomId,
          isPublic: values.isPublic,
          imageUrl: urls[0],
          text: JSON.stringify(urls),
          caption: values.caption,
        });
      }
      reset();
      router.refresh();
    }
  }

  async function handlePortalSubmit(
    values: z.infer<typeof PortalNodeValidation>
  ) {
    await createRealtimePost({
      text: JSON.stringify(values),
      path: "/",
      coordinates: { x: 0, y: 0 },
      type: "PORTAL",
      realtimeRoomId: roomId,
    });
    reset();
    router.refresh();
  }

  const handleSelect = async (value: string) => {
    if (value === "LIVESTREAM" || value === "DRAW") {
      await createRealtimePost({
        path: "/",
        coordinates: { x: 0, y: 0 },
        type: value as realtime_post_type,
        realtimeRoomId: roomId,
      });
      reset();
      router.refresh();
      return;
    }

    if (value === "IMAGE_COMPUTE") {
      await createRealtimePost({
        path: "/",
        coordinates: { x: 0, y: 0 },
        type: "IMAGE_COMPUTE",
        realtimeRoomId: roomId,
        imageUrl: "",
      });
      reset();
      router.refresh();
      return;
    }

    setSelectedType(value);
  };

  const renderModal = () => {
    switch (selectedType) {
      case "TEXT":
        return (
          <TextNodeModal
            isOwned={true}
            currentText=""
            onSubmit={handleTextSubmit}
          />
        );
      case "IMAGE":
        return (
          <ImageNodeModal
            isOwned={true}
            currentImageURL=""
            currentCaption=""
            onSubmit={handleImageSubmit}
          />
        );
      case "VIDEO":
        return (
          <YoutubeNodeModal
            isOwned={true}
            currentVideoURL=""
            onSubmit={handleVideoSubmit}
          />
        );
      case "MUSIC":
        return (
          <MusicNodeModal
            isOwned={true}
            currentUrl=""
            currentTitle=""
            onSubmit={handleMusicSubmit}
          />
        );
      case "COLLAGE":
        return (
          <CollageCreationModal
            isOwned={true}
            onSubmit={async (vals) => {
              await createRealtimePost({
                path: "/",
                coordinates: { x: 0, y: 0 },
                type: "COLLAGE",
                realtimeRoomId: roomId,
                collageLayoutStyle: vals.layoutStyle,
                collageColumns: vals.columns,
                collageGap: vals.gap,
              });
              reset();
              router.refresh();
            }}
          />
        );
      case "GALLERY":
        return (
          <GalleryNodeModal
            isOwned={true}
            isPublic={false}
            currentImages={[]}
            currentCaption=""
            onSubmit={handleGallerySubmit as (values: unknown) => void}
          />
        );
      case "PORTAL":
        return (
          <PortalNodeModal
            isOwned={true}
            onSubmit={handlePortalSubmit}
            currentX={0}
            currentY={0}
          />
        );
      case "LIVECHAT":
        return (
          <LivechatNodeModal
            isOwned={true}
            currentInvitee=""
            onSubmit={async (vals) => {
              const username = vals.invitee.replace(/^@/, "");
              const user = await fetchUserByUsername(username);
              if (!user) return;
              await createRealtimePost({
                path: "/",
                coordinates: { x: 0, y: 0 },
                type: "LIVECHAT",
                realtimeRoomId: roomId,
                text: JSON.stringify({ inviteeId: Number(user.id) }),
              });
              reset();
              router.refresh();
            }}
          />
        );
      case "ENTROPY":
        return (
          <EntropyNodeModal
            isOwned={true}
            currentInvitee=""
            onSubmit={async (vals) => {
              const username = vals.invitee.replace(/^@/, "");
              const user = await fetchUserByUsername(username);
              if (!user) return;
              const res = await fetch("/api/random-secret");
              const { word } = await res.json();
              await createRealtimePost({
                path: "/",
                coordinates: { x: 0, y: 0 },
                type: "ENTROPY",
                realtimeRoomId: roomId,
                text: JSON.stringify({
                  inviteeId: Number(user.id),
                  secret: word,
                  guesses: [],
                }),
              });
              reset();
              router.refresh();
            }}
          />
        );
      case "PDF_VIEWER":
        return (
          <PdfViewerNodeModal
            isOwned={true}
            currentUrl=""
            onSubmit={async (vals) => {
              await createRealtimePost({
                path: "/",
                coordinates: { x: 0, y: 0 },
                type: "PLUGIN",
                realtimeRoomId: roomId,
                pluginType: "PDF_VIEWER",
                pluginData: { pdfUrl: vals.pdfUrl },
              });
              reset();
              router.refresh();
            }}
          />
        );
      case "SPLINE_VIEWER":
        return (
          <SplineViewerNodeModal
            isOwned={true}
            currentUrl=""
            onSubmit={async (vals) => {
              await createRealtimePost({
                path: "/",
                coordinates: { x: 0, y: 0 },
                type: "PLUGIN",
                realtimeRoomId: roomId,
                pluginType: "SPLINE_VIEWER",
                pluginData: { sceneUrl: vals.sceneUrl },
              });
              reset();
              router.refresh();
            }}
          />
        );
      case "PRODUCT_REVIEW":
        return (
          <ProductReviewNodeModal
            isOwned={true}
            currentProductName=""
            currentRating={5}
            currentSummary=""
            currentProductLink=""
            currentClaims={[]}
            currentImages={[]}
            onSubmit={async (vals) => {
              const uploads = await Promise.all(
                (vals.images || []).map((img) => uploadFileToSupabase(img))
              );
              const urls = uploads
                .filter((r) => !r.error)
                .map((r) => r.fileURL)
                .filter((u): u is string => u != null);
              const filtered = vals.claims.filter((c) => c.trim() !== "");
              if (roomId === "global") {
                await createFeedPostAction({
                  postType: "PRODUCT_REVIEW" as feed_post_type,

                  caption: vals.summary.slice(0, 140),
                  imageUrl: urls[0] ?? undefined,
                  content: JSON.stringify({        // 👈 add this
                         ...vals,
                         images: urls,
                         claims: filtered,
                       }),
                  productReview: {
                    productName: vals.productName,
                    rating:      vals.rating,
                    summary:     vals.summary,
                    productLink: vals.productLink,
                    images:      urls,
                    claims:      filtered,
                  },
                });
              } else {
                await createRealtimePost({
                  text: JSON.stringify({
                    ...vals,
                    images: urls,
                    claims: filtered,
                  }),
                  path: "/",
                  coordinates: { x: 0, y: 0 },
                  type: "PRODUCT_REVIEW",
                  realtimeRoomId: roomId,
                  ...(urls.length > 0 && { imageUrl: urls[0] }),
                });
              }
              reset();
              router.refresh();
            }}
          />
        );

      case "PREDICTION":
        return (
          <PredictionMarketModal
            onSubmit={async (vals) => {
              await fetch("/api/market", {
                method: "POST",
                body: JSON.stringify({
                  question: vals.question,
                  closesAt: vals.closesAt,
                  liquidity: vals.liquidity,
                }),
              });
              reset();
              router.refresh();
            }}
          />
        );
      case "LIBRARY":
        return <LibraryPostModal onOpenChange={(v) => { if (!v) reset(); }} />;

      // onSubmit={async (vals) => {
      //   await createRealtimePost({
      //     path: "/",
      //     coordinates: { x: 0, y: 0 },
      //     type: "PLUGIN",
      //     realtimeRoomId: roomId,
      //     pluginType: "PRODUCT_REVIEW",
      //     pluginData: {},
      //   });
      //   reset();
      //   router.refresh();
      // }}

      default:
        return (
          <DialogContent className="flex flex-1 p-8 bg-slate-300 border-[2px] rounded-xl border-blue max-w-[35rem]  max-h-[14rem] mt-[-6rem] ">
            <Select onValueChange={(v) => handleSelect(v)}>
              <SelectTrigger className=" ring-blue border-none ring-[2px] h-auto flex flex-1 text-[1.2rem] text-center tracking-wide focus:ring-blue focus:border-none focus:ring-[1px]">
                <SelectValue
                  placeholder="Select post type"
                  className="px-4 py-1 "
                />
              </SelectTrigger>
              <SelectContent className="max-h-[18rem] justify-center w-[95%] mx-auto border-blue border-2 rounded-xl">
                {nodeOptions.map((item) => (
                  <div key={item.nodeType}>
                    <SelectItem
                      value={item.nodeType}
                      className="px-4  hover:bg-slate-200"
                    >
                      {item.label}
                    </SelectItem>
                    <hr />
                  </div>
                ))}
              </SelectContent>
            </Select>
          </DialogContent>
        );
    }
  };
  if (authLoading) return null;        // still checking cookies

  if (!session) {
    return (
      <Button onClick={() => router.push("/login")} /* … */>
        Sign in to post
      </Button>
    );
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSelectedType("");
      }}
    >
      <DialogTrigger
      
      className="flex  w-full flex flex-col gap-4 px-2"
        asChild
      >

         <button
              className="flex  bubblebutton leftsidebar_link align-center leftsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent"
              >
       <div className="flex align-center gap-3">
          <Image
            src="/assets/add--alt.svg"
            alt="create post"
            className="flex align-center"

            width={24}
            height={24}
          />
           <div className="flex  justify-center items-center text-center tracking-wider py-0 align-center text-black 
                    text-[1rem] h-full w-full  max-lg:hidden">New Post</div>
              </div>
            </button>
      </DialogTrigger>
      {renderModal()}
    </Dialog>
  );
};

export default CreateFeedPost;
