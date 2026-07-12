// GalleryCarousel.tsx
"use client";
import Image from "next/image";
import { useState, useMemo } from "react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { buildSlideVariants } from "./helpers/slideVariants";

export type GalleryAnimationStyle = "cylinder" | "cube" | "portal" | "towardscreen";

interface Props {
  urls: string[];
  caption?: string;
  animation?: GalleryAnimationStyle;
  embed?: boolean;
  unoptimized?: boolean;
  sizes?: string;
}

export default function GalleryCarousel({
  urls,
  caption,
  animation = "cylinder",
  embed = false,
  unoptimized = false,
  sizes,
}: Props) {
  const prefersReduced = useReducedMotion();
  const [[currentIndex, direction], setPage] = useState<[number, number]>([0, 0]);
  const slideVariants = useMemo(() => buildSlideVariants(animation), [animation]);

  // If there is nothing to show, bail early (outside embed only)
  if (!embed && urls.length === 0) return null;

  const inRepeater = false;
  const fit = "contain" as const;
  const simplePreview = inRepeater || embed;   // 👈 key change
  const fitMode = inRepeater ? fit : "contain";

  // In a Repeater cell we render a single cheap <img> and stop here.
  if (simplePreview && urls.length) {
    const src = urls[0]; // keep it deterministic for preview cells
    return (
      <div className="w-full h-full relative">
        <img
          src={src}
          alt="preview"
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: fitMode,
            display: "block",
          }}
        />
        {!!caption && (
          <div className="absolute bottom-0 left-0 right-0 text-center text-xs text-black/70 bg-white/30">
            {caption}
          </div>
        )}
      </div>
    );
  }

  // ---- original rich carousel (outside Repeater) ----
  const hasArrows = urls.length > 1;

  const handleNext = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setPage(([i]) => [(i + 1) % urls.length, +1]);
  };
  const handlePrev = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setPage(([i]) => [(i - 1 + urls.length) % urls.length, -1]);
  };

  return (
    <div className="flex flex-col flex-1 p-1 w-full border border-indigo-200/50 rounded-xl items-center shadow-md bg-slate-300/10">
      <div className="w-full flex flex-1 flex-col justify-center items-center max-w-[90%] h-fit">
        <div className="relative w-[600px] h-[400px] overflow-hidden" style={{ perspective: 900 }}>
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="flex justify-center items-center w-fit focus:outline-none focus-visible:ring-2 ring-offset-2 ring-indigo-400">
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  <motion.div
                    key={`${animation}-${currentIndex}-${urls.length}`}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={prefersReduced ? { duration: 0.2, opacity: { duration: 0.2 } } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    transformTemplate={(_, t) => `perspective(1000px) ${t}`}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ willChange: "transform, opacity", transformStyle: "preserve-3d" }}
                  >
                    <Image
                      fill
                      src={urls[currentIndex]}
                      alt={`img-${currentIndex}`}
                      className="object-contain pt-1"
                      sizes={sizes ?? "(max-width: 768px) 100vw, 800px"}
                      unoptimized={unoptimized}
                      priority={currentIndex === 0}
                    />
                  </motion.div>
                </AnimatePresence>
              </button>
            </DialogTrigger>
            {/* keep your modal viewer as-is */}
          </Dialog>

          {hasArrows && (
            <div className="absolute inset-0 pointer-events-none">
              <button
                type="button"
                aria-label="Previous image"
                className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 rounded-3xl bg-white/40 likebutton text-black px-3 py-2"
                onClick={handlePrev}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next image"
                className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 rounded-3xl bg-white/40 likebutton text-black px-3 py-2"
                onClick={handleNext}
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {!!caption && (
        <div className="flex flex-wrap mt-4 mb-2 border-t border-indigo-300/50 w-full justify-center items-center">
          <p className="text-center tracking-wide pt-2">{caption}</p>
        </div>
      )}
    </div>
  );
}
