"use client";

import Image from "next/image";
import { useState } from "react";
import Button from "antd/lib/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";   // ⬅️ NEW
import ViewGalleryModal from "../modals/ViewGalleryModal";
import ViewImageModal from "../modals/ViewImageModal";
import { buildSlideVariants } from './helpers/slideVariants';
import { GalleryAnimationStyle } from "./GalleryCarousel";


interface Props {
  urls: string[];
  caption?: string;
  animation?: GalleryAnimationStyle;   // NEW   (default = 'cylinder')
}

const StackCarousel = ({ urls, caption , animation = 'cube',
}: Props) => {
 // const [currentIndex, setCurrentIndex] = useState(0);

  const [[currentIndex, direction], setPage] = useState<[number, number]>([0, 0]);

  const [loaded, setLoaded] = useState(false);
  const [open,   setOpen]   = useState(false);

  const paginate = (dir: 1 | -1) => {
    setPage(([idx]) => [(idx + dir + urls.length) % urls.length, dir]);
    setLoaded(false);              // so Skeleton shows until image arrives
  };
  
  const handleNext = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    paginate(+1);
  };
  const handlePrev = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    paginate(-1);}
  // };
  // const handlePrev = (e: React.MouseEvent<HTMLButtonElement>) => {
  //   e.stopPropagation();
  //   setCurrentIndex((prev) => (prev - 1 + urls.length) % urls.length);
  // };

  // const handleNext = (e: React.MouseEvent<HTMLButtonElement>) => {
  //   e.stopPropagation();
  //   setCurrentIndex((prev) => (prev + 1) % urls.length);
  // };

  if (urls.length === 0) return null;
//   const distance = 500;             // px — tune to your design

// const slideVariants = {
//   enter:  (dir: number) => ({ x:  dir > 0 ?  distance : -distance, opacity: 0 }),
//   center:              { x: 0,   opacity: 1 },
//   exit:   (dir: number) => ({ x:  dir > 0 ? -distance :  distance, opacity: 0 })
// };
 const radius      = 270;    // 👈 depth “radius” of the cylinder
 const angle       = 45;     // 👈 how far each neighbour swings away
//  const slideVariants = {
//    enter:  (dir: number) => ({
//      rotateY: dir > 0 ?  angle   : -angle,
//      x:       dir > 0 ?  radius  : -radius,
//      z:       -radius,                 // push into screen
//      opacity: 0.5,
//      scale:   0.7
//    }),
//    center: {
//      rotateY: 0,
//      x:       0,
//      z:       0,
//      opacity: 1,
//      scale:   1
//    },
//    exit:   (dir: number) => ({
//      rotateY: dir > 0 ? angle   :  -angle,
//      x:       dir > 0 ? -radius  :  radius,
//      z:       radius,
//      opacity: 0,
//      scale:   0.5
//    })
//  };
 const slideVariants = buildSlideVariants(animation);

  return (
    <div className="flex flex-col flex-1 p-1 w-full border-[1px] border-indigo-200 border-opacity-50 
    rounded-xl align-center justify-center items-center shadow-md bg-white bg-opacity-10">
    <div className="w-full flex flex-1 flex-col justify-center items-center max-w-[90%] h-fit ">
    <div className=" h-fit  flex flex-col  justify-center ">
    


<Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex justify-center items-center w-fit focus:outline-none
                     focus-visible:ring-2 ring-offset-2 ring-indigo-400"
        >
     
{/* <div className="relative w-[700px] h-[25rem] overflow-hidden"> */}
 <div
   className="relative w-[600px] h-[400px] overflow-hidden"
   style={{ perspective: 900 }}   // 👈 distance (px) of the viewer
 >
{/* <div className="pointer-events-none absolute inset-0 bg-gradient-to-b
                from-black/0 via-black/10 to-black/20 z-10" /> */}


  <AnimatePresence initial={false} custom={direction} mode="wait">
    <motion.div
      key={currentIndex}           // ← causes re‑mount on index change
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
         transformTemplate={(_, transform) =>
             `perspective(1000px) ${transform}`   // ⬅️ keep perspective locked
           }
      transition={{
        x:       { type: "tween" },
        opacity: { duration: 0.3 }
      }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <Image
        fill
        src={urls[currentIndex]}
        alt={`img-${currentIndex}`}
        className="object-contain pt-1"
        sizes="500px"
        priority={currentIndex === 0}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && <Skeleton className="absolute inset-0" />}
    </motion.div>
  </AnimatePresence>
</div>

        </button>
      </DialogTrigger>

      <ViewGalleryModal open={open} onOpenChange={setOpen} images={urls} />

    </Dialog>

      {urls.length > 0 && (
        <div className="pointer-events-none mt-4 justify-center items-center   flex flex-1 w-full relative gap-4  h-full  ">
          <button className=" pointer-events-auto bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors border-none carouselbutton rounded-xl
          px-[10%] py-1  w-auto max-h-[70%] min-h-[20%] h-auto justify-center align-center items-center    " onClick={handlePrev}>          
                        <p className="justify-start  text-[1.2rem]">{"<"}</p>

           
          </button>
          <button className="pointer-events-auto bg-white bg-opacity-20 border-none carouselbutton rounded-xl
           px-[10%] py-1  w-auto  max-h-[70%] min-h-[20%] h-auto justify-center align-center items-center  " onClick={handleNext}>
                                <p className="justify-start   text-[1.2rem]">{">"}</p>

           
          </button>
        </div>
      )}
    
    </div>
    </div>
    <div className="flex flex-wrap mt-4 mb-2 border-t-[1px]   border-indigo-300 border-opacity-50   w-full  rounded-none  justify-center items-center   ">
    {/* <hr className="w-full h-px border-t-0 bg-transparent bg-gradient-to-r from-transparent via-slate-100 to-transparent opacity-55" /> */}
    <p className="text-center tracking-wide pt-2 ">{caption}</p>
    </div>
    </div>
  );
};

export default StackCarousel;

