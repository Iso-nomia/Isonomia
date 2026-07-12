"use client";
import { ThumbsUp, ThumbsDown, BadgeDollarSign } from "lucide-react";
import { useState, useEffect } from "react";
import { fetchClaimStats, voteClaim, vouchClaim } from "@/lib/actions/productreview.actions";
import { useAuth } from "@/lib/AuthContext";
import ProductPhotoGalleryModal from "../modals/ProductPhotoGalleryModal";
import { Button } from "../ui/button";
import Link from "next/link";
import { createFeedPost } from "@/lib/actions/feedpost.actions";
import { feed_post_type }  from "@prisma/client";

interface ProductReviewCardProps {
  productName: string;
  rating: number;
  summary: string;
  productLink: string;
  claims: string[];
  claimIds?: (string | number | bigint)[];
  productimages?: (string[] | null);
}

const ProductReviewCard = ({
  productName,
  rating,
  summary,
  productLink,
  claims,
  claimIds,
  productimages
}: ProductReviewCardProps) => {
  const auth = useAuth();
  const userId = auth.user?.userId ?? null;
  const [voteCounts, setVoteCounts] = useState(
    claims.map(() => ({ helpful: 0, unhelpful: 0, vouch: 0 }))
  );
  const [images, setImages] = useState<string[]>(productimages || []);
  const [viewerOpen, setViewerOpen] = useState(false);
  useEffect(() => {

    setImages(productimages || []);
  }, [productimages]);
  useEffect(() => {
    setVoteCounts(claims.map(() => ({ helpful: 0, unhelpful: 0, vouch: 0 })));
  }, [claims]);

  useEffect(() => {
    async function loadCounts() {
      if (!claimIds || claimIds.length === 0) return;
      const counts = await Promise.all(
        claims.map((_, i) => {
          const id = claimIds[i];
          return id != null ? fetchClaimStats(id.toString()) : Promise.resolve(null);
        })
      );
      setVoteCounts(
        counts.map((c) => ({
          helpful: c?.helpful_count ?? 0,
          unhelpful: c?.unhelpful_count ?? 0,
          vouch: c?.vouch_total ?? 0,
        }))
      );
    }
    loadCounts();
  }, [claimIds, claims]);

  const handleVote = async (idx: number, type: "helpful" | "unhelpful") => {
    if (claimIds && claimIds[idx] != null) {
      if (userId === null) return;
      await voteClaim({
        claimId: claimIds[idx].toString(),
        userId: userId!.toString(),
        type: type === "helpful" ? "HELPFUL" : "UNHELPFUL",
      });
      const updated = await fetchClaimStats(claimIds[idx].toString());
      setVoteCounts((prev) => {
        const copy = [...prev];
        copy[idx] = {
          helpful: updated?.helpful_count ?? 0,
          unhelpful: updated?.unhelpful_count ?? 0,
          vouch: copy[idx].vouch,
        };
        return copy;
      });
    } else {
      setVoteCounts((prev) => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], [type]: copy[idx][type] + 1 };
        return copy;
      });
    }
  };

  const handleVouch = async (idx: number) => {
    if (claimIds && claimIds[idx] != null) {
      if (userId === null) return;
      await vouchClaim({
        claimId: claimIds[idx].toString(),
        userId: userId!.toString(),
        amount: 1,
      });
      const updated = await fetchClaimStats(claimIds[idx].toString());
      setVoteCounts((prev) => {
        const copy = [...prev];
        copy[idx] = {
          helpful: updated?.helpful_count ?? copy[idx].helpful,
          unhelpful: updated?.unhelpful_count ?? copy[idx].unhelpful,
          vouch: updated?.vouch_total ?? copy[idx].vouch,
        };
        return copy;
      });
    } else {
      setVoteCounts((prev) => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], vouch: copy[idx].vouch + 1 };
        return copy;
      });
    }
  };

  return (
    <div className="flex justify-center text-[1rem]">
    <div className="w-[45rem] h-fit  rounded-md">
    <div className="flex flex-col   mt-0 mb-0">
      <div className="flex flex-col items-center">
      <div className="items-center text-center  font-bold"> <h1 className="text-[1.5rem] text-center tracking-wider font-bold"> {productName} </h1> </div>
      <div className="text-[1.1rem] text-center mb-2">Rating: {rating}/5</div>
      </div>
      <hr className="border-indigo-300"></hr>
      <div className=" my-2 items-start tracking-wide">{"Review: " + summary}</div>
      <hr className="border-indigo-300"></hr>

      <ul className="flex  flex-wrap gap-x-4 px-2 my-2  w-full h-fit">
        {claims.map((c, idx) => (
          <li key={idx} className="text-[1rem] w-fit text-block rounded-xl h-fit bg-white/20 border-none outline-none cardelement">
            <div className="flex flex-col my-2 mx-2  justify-between items-center">
              <span className="text-block text-[1rem] tracking-wide rounded-md leading-[1.2rem]">{c}</span>
              <div className="flex items-center mt-1  gap-3 text-xs">
                <button onClick={() => handleVote(idx, "helpful")} aria-label="Helpful" className="py-1">
                  <ThumbsUp className="h-4 w-4 mb-1" /> {voteCounts[idx]?.helpful ?? 0}
                </button>
                <button onClick={() => handleVote(idx, "unhelpful")} aria-label="Unhelpful" className="py-1">
                  <ThumbsDown className="h-4 w-4 mb-1" /> {voteCounts[idx]?.unhelpful ?? 0}
                </button>
                <button onClick={() => handleVouch(idx)} aria-label="Vouch" className="py-1">
                  <BadgeDollarSign className="h-4 w-4 mb-1" /> {voteCounts[idx]?.vouch ?? 0}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <hr className="border-indigo-300"></hr>

<div className="flex flex-wrap gap-4 mt-2">

      <button
          className="mt-1 bg-transparent bg-white/20 border-none outline-none savebutton w-fit text-black tracking-widest rounded-xl px-4 py-2">
 <a
          href={productLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm"
        >
          Link
        </a>
      </button>

      {images.length > 0 && (
        <button onClick={() => setViewerOpen(true)} 
        className="mt-1 bg-transparent likebutton border-none outline-black outline-blue w-fit text-black  rounded-xl px-2 py-2">
          View Photos
        </button>
      )}
        </div>
        <ProductPhotoGalleryModal
          images={images}
          open={viewerOpen}
          onOpenChange={setViewerOpen}
        />
      </div>
    </div>
    </div>


  );
};

export default ProductReviewCard;
