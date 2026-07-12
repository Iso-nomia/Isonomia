import {
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
  import { AnimatedDialog } from "../ui/AnimatedDialog";
  import { motion } from "framer-motion";
  
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
  imageUrl: string;
}

  
  const renderCreate = ({
    onSubmit,
  }: {
    onSubmit?: (values: z.infer<typeof ImagePostValidation>) => void;
  }) => {
    return (
      <div>
        <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
          <b> Create Post</b>
        </DialogHeader>
        <hr />
        <ImageNodeForm onSubmit={onSubmit!} currentImageURL={""} currentCaption="" />
      </div>
    );
  };
  
  const renderEdit = ({
    onSubmit,
    currentImageURL,
  }: {
    onSubmit?: (values: z.infer<typeof ImagePostValidation>) => void;
    currentImageURL: string;
  }) => {
    return (
      <div>
        <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
          <b> Edit Post</b>
        </DialogHeader>
        <hr />
        <ImageNodeForm onSubmit={onSubmit!} currentImageURL={currentImageURL} currentCaption=""/>
      </div>
    );
  };
  
  const renderView = (currentImageURL: string) => {
    return (

      <div className="h-full w-full justify-center items-center flex p-0 flex-col  ">
        <DialogHeader className=" text-white text-lg  ">
          <DialogTitle hidden> view </DialogTitle>
        </DialogHeader>
  
        <div className="grid ">
          <Image
            className="img-view-modal justify-center items-center mx-auto w-fit h-fit  transition-opacity duration-400"
            src={currentImageURL}
            alt="404"
            width={0}
            height={0}
            sizes="200vw"
          />
        </div>
        <div className="py-0 relative justify-center items-center mx-auto ">
          <DialogClose
            id="animateButton"
            className={`w-2`}
          >
            
          </DialogClose>
          
        </div>

      </div>

    );
  };
  
export default function ViewImageModal({ open, onOpenChange, imageUrl }: Props) {
  return (
    <AnimatedDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className=" w-fit justify-center items-center flex py-0 px-4 flex-col min-w-[750px] h-min-[27rem]
      max-w-[60%] max-h-[90%] h-full bg-slate-400 bg-opacity-100  border-blue">
        {/* close button (optional) */}
        <DialogClose className="absolute top-4 right-4 text-white text-2xl">
          ×
        </DialogClose>

        {/* the image itself */}
        <Image
          src={imageUrl}
          alt="posted image"
          width={0}
          height={0}
          sizes="300vw"
          className="img-view-modal justify-center items-center mx-auto w-fit h-fit  transition-opacity duration-400"
          priority          /* avoids a second request if cached */
        />
      </DialogContent>
    </AnimatedDialog>
  );
}
  
  