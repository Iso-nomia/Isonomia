import {
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
  import { AnimatedDialog } from "../ui/AnimatedDialog";
  import { motion } from "framer-motion";
  import { useState, useEffect } from "react";
  import { ImagePostValidation } from "@/lib/validations/thread";
  import Image from "next/image";
  import { z } from "zod";
  import ImageNodeForm from "../forms/ImageNodeForm";
  
  // interface Props {
  //   id?: string;
  //   isOwned: boolean;
  //   onSubmit?: (values: z.infer<typeof ImagePostValidation>) => void;
  //   currentImageURL: string;
  // }

interface Props {
  open: boolean;
  onOpenChange(v: boolean): void;

  images?: string[];          // 1) mark optional


}

  
  
const ViewGalleryModal = ({   images = [], open, onOpenChange }: Props) => {
  
  const [currentIndex, setCurrentIndex] = useState(0);
    // reset index if a shorter array arrives (optional but nice)
    useEffect(() => {
      if (currentIndex >= images.length) setCurrentIndex(0);
    }, [images.length]);
  
  const handlePrev = () =>
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  const handleNext = () =>
    setCurrentIndex((prev) => (prev + 1) % images.length);
  return (
    <AnimatedDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className=" w-full justify-center items-center flex py-0 px-4 flex-col min-w-[750px] h-min-[27rem]
      max-w-[70%] max-h-[96%] h-full bg-slate-100 bg-opacity-100  border-blue">
        {/* close button (optional) */}
        <DialogClose className="absolute top-4 right-4 text-black text-2xl">
          ×
        </DialogClose>
        {images.length > 0 && (
          <div className="relative flex flex-col justify-center ">

        {/* the image itself */}
        <Image
        src={images[currentIndex]}
        alt={`photo-${currentIndex}`}
          width={0}
          height={0}
          sizes="300vw"
          className="img-view-modal justify-center items-center mx-auto "
          priority          /* avoids a second request if cached */
        />
        {/* {images.length > 1 && (
         <div className="pointer-events-none mt-4 justify-center items-center   flex flex-1 w-full relative gap-4  h-full  ">
         <button className=" pointer-events-auto bg-white bg-opacity-20 border-none carouselbutton rounded-xl
         px-[15%]   w-auto max-h-[70%] min-h-[20%] h-auto justify-center align-center items-center    " onClick={handlePrev}>          
                       <p className="justify-start  text-[1.2rem]">{"<"}</p>

          
         </button>
         <button className="pointer-events-auto bg-white bg-opacity-20 border-none carouselbutton rounded-xl
          px-[15%]  w-auto  max-h-[70%] min-h-[20%] h-auto justify-center align-center items-center  " onClick={handleNext}>
                               <p className="justify-start   text-[1.2rem]">{">"}</p>

          
         </button>
       </div>
        )} */}
         
        </div>
        
        )}
        {images.length > 1 && (
              <div className="justify-center ">
                <button
                  className="absolute savebutton rounded-xl border-indigo-400 bg-white bg-opacity-20 text-[2rem] w-fit border-solid   h-[60%] left-3 mx-4 top-1/2 -translate-y-1/2 bg-black/50 text-black px-12 py-12"
                  onClick={handlePrev}
                >
                  ‹
                </button>
                <button
                  className="absolute  savebutton rounded-xl border-indigo-400 text-[2rem] b border-solid bg-white bg-opacity-20  h-[60%] right-4 top-1/2 -translate-y-1/2 bg-black/50    text-black px-12 py-12"
                  onClick={handleNext}
                >
                  ›
                </button>
              </div>
            )}
      </DialogContent>
    </AnimatedDialog>
  );
}


export default ViewGalleryModal;

  
 